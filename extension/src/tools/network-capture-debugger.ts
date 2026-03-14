import { createErrorResponse, ToolResult } from './types';
import { BaseBrowserToolExecutor } from './base-browser';
import { TOOL_NAMES } from './names';
import { cdpSessionManager } from '../utils/cdp-session-manager';
import { NETWORK_FILTERS } from './constants';

interface NetworkDebuggerStartToolParams {
  url?: string;
  maxCaptureTime?: number;
  inactivityTimeout?: number;
  includeStatic?: boolean;
}

interface NetworkRequestInfo {
  requestId: string;
  url: string;
  method: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestTime?: number;
  responseTime?: number;
  type: string;
  status: string;
  statusCode?: number;
  statusText?: string;
  requestBody?: string;
  responseBody?: string;
  base64Encoded?: boolean;
  encodedDataLength?: number;
  errorText?: string;
  canceled?: boolean;
  mimeType?: string;
  specificRequestHeaders?: Record<string, string>;
  specificResponseHeaders?: Record<string, string>;
  [key: string]: any;
}

const MAX_RESPONSE_BODY_SIZE_BYTES = 1 * 1024 * 1024;
const DEFAULT_MAX_CAPTURE_TIME_MS = 3 * 60 * 1000;
const DEFAULT_INACTIVITY_TIMEOUT_MS = 60 * 1000;

class NetworkDebuggerStartTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.NETWORK_DEBUGGER_START;
  private captureData: Map<number, any> = new Map();
  private captureTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private inactivityTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private lastActivityTime: Map<number, number> = new Map();
  private pendingResponseBodies: Map<string, Promise<any>> = new Map();
  private requestCounters: Map<number, number> = new Map();
  private static MAX_REQUESTS_PER_CAPTURE = 100;
  public static instance: NetworkDebuggerStartTool | null = null;

  constructor() {
    super();
    if (NetworkDebuggerStartTool.instance)
      return NetworkDebuggerStartTool.instance;
    NetworkDebuggerStartTool.instance = this;

    chrome.debugger.onEvent.addListener(this.handleDebuggerEvent.bind(this));
    chrome.debugger.onDetach.addListener(this.handleDebuggerDetach.bind(this));
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    chrome.tabs.onCreated.addListener(this.handleTabCreated.bind(this));
  }

  private handleTabRemoved(tabId: number) {
    if (this.captureData.has(tabId))
      this.cleanupCapture(tabId);
  }

  private async handleTabCreated(tab: chrome.tabs.Tab) {
    try {
      if (this.captureData.size === 0) return;
      const openerTabId = tab.openerTabId;
      if (!openerTabId || !this.captureData.has(openerTabId)) return;
      const newTabId = tab.id;
      if (!newTabId) return;

      const openerCaptureInfo = this.captureData.get(openerTabId);
      if (!openerCaptureInfo) return;

      await new Promise((resolve) => setTimeout(resolve, 500));
      await this.startCaptureForTab(newTabId, {
        maxCaptureTime: openerCaptureInfo.maxCaptureTime,
        inactivityTimeout: openerCaptureInfo.inactivityTimeout,
        includeStatic: openerCaptureInfo.includeStatic,
      });
    } catch (error) {
      console.error(`NetworkDebuggerStartTool: Error extending capture to new tab:`, error);
    }
  }

  private async startCaptureForTab(
    tabId: number,
    options: { maxCaptureTime: number; inactivityTimeout: number; includeStatic: boolean },
  ): Promise<void> {
    const { maxCaptureTime, inactivityTimeout, includeStatic } = options;

    if (this.captureData.has(tabId))
      await this.stopCapture(tabId);

    try {
      const tab = await chrome.tabs.get(tabId);
      await cdpSessionManager.attach(tabId, 'network-capture');

      try {
        await cdpSessionManager.sendCommand(tabId, 'Network.enable');
      } catch (error: any) {
        await cdpSessionManager.detach(tabId, 'network-capture').catch(() => {});
        throw error;
      }

      this.captureData.set(tabId, {
        startTime: Date.now(),
        tabUrl: tab.url,
        tabTitle: tab.title,
        maxCaptureTime,
        inactivityTimeout,
        includeStatic,
        requests: {},
        limitReached: false,
      });

      this.requestCounters.set(tabId, 0);
      this.updateLastActivityTime(tabId);

      if (maxCaptureTime > 0)
        this.captureTimers.set(
          tabId,
          setTimeout(async () => {
            await this.stopCapture(tabId, true);
          }, maxCaptureTime),
        );
    } catch (error: any) {
      if (this.captureData.has(tabId)) {
        await cdpSessionManager.detach(tabId, 'network-capture').catch(() => {});
        this.cleanupCapture(tabId);
      }
      throw error;
    }
  }

  private handleDebuggerEvent(source: chrome.debugger.Debuggee, method: string, params?: any) {
    if (!source.tabId) return;
    const tabId = source.tabId;
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    this.updateLastActivityTime(tabId);

    switch (method) {
      case 'Network.requestWillBeSent':
        this.handleRequestWillBeSent(tabId, params);
        break;
      case 'Network.responseReceived':
        this.handleResponseReceived(tabId, params);
        break;
      case 'Network.loadingFinished':
        this.handleLoadingFinished(tabId, params);
        break;
      case 'Network.loadingFailed':
        this.handleLoadingFailed(tabId, params);
        break;
    }
  }

  private handleDebuggerDetach(source: chrome.debugger.Debuggee, reason: string) {
    if (source.tabId && this.captureData.has(source.tabId))
      this.cleanupCapture(source.tabId);
  }

  private updateLastActivityTime(tabId: number) {
    this.lastActivityTime.set(tabId, Date.now());
    const captureInfo = this.captureData.get(tabId);

    if (captureInfo && captureInfo.inactivityTimeout > 0) {
      if (this.inactivityTimers.has(tabId))
        clearTimeout(this.inactivityTimers.get(tabId)!);
      this.inactivityTimers.set(
        tabId,
        setTimeout(() => this.checkInactivity(tabId), captureInfo.inactivityTimeout),
      );
    }
  }

  private checkInactivity(tabId: number) {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    const lastActivity = this.lastActivityTime.get(tabId) || captureInfo.startTime;
    const inactiveTime = Date.now() - lastActivity;

    if (inactiveTime >= captureInfo.inactivityTimeout)
      this.stopCapture(tabId, true);
    else {
      const remainingTime = Math.max(0, captureInfo.inactivityTimeout - inactiveTime);
      this.inactivityTimers.set(
        tabId,
        setTimeout(() => this.checkInactivity(tabId), remainingTime),
      );
    }
  }

  private shouldFilterRequestByUrl(url: string): boolean {
    const normalizedUrl = String(url || '').toLowerCase();
    if (!normalizedUrl) return false;
    return NETWORK_FILTERS.EXCLUDED_DOMAINS.some((pattern) => normalizedUrl.includes(pattern));
  }

  private shouldFilterRequestByExtension(url: string, includeStatic: boolean): boolean {
    if (includeStatic) return false;
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.toLowerCase();
      return NETWORK_FILTERS.STATIC_RESOURCE_EXTENSIONS.some((ext) => path.endsWith(ext));
    } catch {
      return false;
    }
  }

  private shouldFilterByMimeType(mimeType: string, includeStatic: boolean): boolean {
    if (!mimeType) return false;
    if (NETWORK_FILTERS.API_MIME_TYPES.some((apiMime) => mimeType.startsWith(apiMime)))
      return false;
    if (!includeStatic)
      return NETWORK_FILTERS.STATIC_MIME_TYPES_TO_FILTER.some((staticMime) => mimeType.startsWith(staticMime));
    return false;
  }

  private handleRequestWillBeSent(tabId: number, params: any) {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    const { requestId, request, timestamp, type } = params;

    if (this.shouldFilterRequestByUrl(request.url) || this.shouldFilterRequestByExtension(request.url, captureInfo.includeStatic))
      return;

    const currentCount = this.requestCounters.get(tabId) || 0;
    if (currentCount >= NetworkDebuggerStartTool.MAX_REQUESTS_PER_CAPTURE) {
      captureInfo.limitReached = true;
      return;
    }

    if (!captureInfo.requests[requestId]) {
      captureInfo.requests[requestId] = {
        requestId,
        url: request.url,
        method: request.method,
        requestHeaders: request.headers,
        requestTime: timestamp * 1000,
        type: type || 'Other',
        status: 'pending',
      };
      if (request.postData)
        captureInfo.requests[requestId].requestBody = request.postData;
    } else {
      const existingRequest = captureInfo.requests[requestId];
      existingRequest.url = request.url;
      existingRequest.requestTime = timestamp * 1000;
      if (request.headers) existingRequest.requestHeaders = request.headers;
      if (request.postData) existingRequest.requestBody = request.postData;
      else delete existingRequest.requestBody;
    }
  }

  private handleResponseReceived(tabId: number, params: any) {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    const { requestId, response, timestamp, type } = params;
    const requestInfo: NetworkRequestInfo = captureInfo.requests[requestId];
    if (!requestInfo) return;

    if (this.shouldFilterByMimeType(response.mimeType, captureInfo.includeStatic)) {
      delete captureInfo.requests[requestId];
      return;
    }

    const currentStoredCount = Object.keys(captureInfo.requests).length;
    this.requestCounters.set(tabId, currentStoredCount);

    requestInfo.status = response.status === 0 ? 'pending' : 'complete';
    requestInfo.statusCode = response.status;
    requestInfo.statusText = response.statusText;
    requestInfo.responseHeaders = response.headers;
    requestInfo.mimeType = response.mimeType;
    requestInfo.responseTime = timestamp * 1000;
    if (type) requestInfo.type = type;
  }

  private async handleLoadingFinished(tabId: number, params: any) {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    const { requestId, encodedDataLength } = params;
    const requestInfo: NetworkRequestInfo = captureInfo.requests[requestId];
    if (!requestInfo) return;

    requestInfo.encodedDataLength = encodedDataLength;
    if (requestInfo.status === 'pending') requestInfo.status = 'complete';

    if (this.shouldCaptureResponseBody(requestInfo)) {
      try {
        const responseBodyData = await this.getResponseBody(tabId, requestId);
        if (responseBodyData) {
          if (responseBodyData.body && responseBodyData.body.length > MAX_RESPONSE_BODY_SIZE_BYTES)
            requestInfo.responseBody =
              responseBodyData.body.substring(0, MAX_RESPONSE_BODY_SIZE_BYTES) +
              `\n\n... [Response truncated, total size: ${responseBodyData.body.length} bytes] ...`;
          else
            requestInfo.responseBody = responseBodyData.body;
          requestInfo.base64Encoded = responseBodyData.base64Encoded;
        }
      } catch (error) {
        requestInfo.errorText =
          (requestInfo.errorText || '') +
          ` Failed to get body: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  }

  private shouldCaptureResponseBody(requestInfo: NetworkRequestInfo): boolean {
    const mimeType = requestInfo.mimeType || '';
    if (NETWORK_FILTERS.API_MIME_TYPES.some((type) => mimeType.startsWith(type)))
      return true;

    const url = requestInfo.url.toLowerCase();
    if (
      /\/(api|service|rest|graphql|query|data|rpc|v[0-9]+)\//i.test(url) ||
      url.includes('.json') || url.includes('json=') || url.includes('format=json')
    ) {
      if (mimeType && NETWORK_FILTERS.STATIC_MIME_TYPES_TO_FILTER.some((staticMime) => mimeType.startsWith(staticMime)))
        return false;
      return true;
    }

    return false;
  }

  private handleLoadingFailed(tabId: number, params: any) {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    const { requestId, errorText, canceled, type } = params;
    const requestInfo: NetworkRequestInfo = captureInfo.requests[requestId];
    if (!requestInfo) return;

    requestInfo.status = 'error';
    requestInfo.errorText = errorText;
    requestInfo.canceled = canceled;
    if (type) requestInfo.type = type;
  }

  private async getResponseBody(
    tabId: number,
    requestId: string,
  ): Promise<{ body: string; base64Encoded: boolean } | null> {
    const pendingKey = `${tabId}_${requestId}`;
    if (this.pendingResponseBodies.has(pendingKey))
      return this.pendingResponseBodies.get(pendingKey)!;

    const responseBodyPromise = (async () => {
      try {
        return (await cdpSessionManager.sendCommand(tabId, 'Network.getResponseBody', {
          requestId,
        })) as { body: string; base64Encoded: boolean };
      } finally {
        this.pendingResponseBodies.delete(pendingKey);
      }
    })();

    this.pendingResponseBodies.set(pendingKey, responseBodyPromise);
    return responseBodyPromise;
  }

  private cleanupCapture(tabId: number) {
    if (this.captureTimers.has(tabId)) {
      clearTimeout(this.captureTimers.get(tabId)!);
      this.captureTimers.delete(tabId);
    }
    if (this.inactivityTimers.has(tabId)) {
      clearTimeout(this.inactivityTimers.get(tabId)!);
      this.inactivityTimers.delete(tabId);
    }

    this.lastActivityTime.delete(tabId);
    this.captureData.delete(tabId);
    this.requestCounters.delete(tabId);

    const keysToDelete: string[] = [];
    this.pendingResponseBodies.forEach((_, key) => {
      if (key.startsWith(`${tabId}_`))
        keysToDelete.push(key);
    });
    keysToDelete.forEach((key) => this.pendingResponseBodies.delete(key));
  }

  async stopCapture(tabId: number, isAutoStop: boolean = false): Promise<any> {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo)
      return { success: false, message: 'No capture in progress for this tab.' };

    try {
      try {
        await cdpSessionManager.sendCommand(tabId, 'Network.disable');
      } catch { /* best effort */ }
      try {
        await cdpSessionManager.detach(tabId, 'network-capture');
      } catch { /* best effort */ }
    } catch { /* best effort */ }

    const allRequests = Object.values(captureInfo.requests) as NetworkRequestInfo[];
    const commonRequestHeaders = this.analyzeCommonHeaders(allRequests, 'requestHeaders');
    const commonResponseHeaders = this.analyzeCommonHeaders(allRequests, 'responseHeaders');

    const processedRequests = allRequests.map((req) => {
      const finalReq: any = { ...req };
      if (finalReq.requestHeaders) {
        finalReq.specificRequestHeaders = this.filterOutCommonHeaders(finalReq.requestHeaders, commonRequestHeaders);
        delete finalReq.requestHeaders;
      } else
        finalReq.specificRequestHeaders = {};
      if (finalReq.responseHeaders) {
        finalReq.specificResponseHeaders = this.filterOutCommonHeaders(finalReq.responseHeaders, commonResponseHeaders);
        delete finalReq.responseHeaders;
      } else
        finalReq.specificResponseHeaders = {};
      return finalReq;
    });

    processedRequests.sort((a: any, b: any) => (a.requestTime || 0) - (b.requestTime || 0));

    const resultData = {
      captureStartTime: captureInfo.startTime,
      captureEndTime: Date.now(),
      totalDurationMs: Date.now() - captureInfo.startTime,
      commonRequestHeaders,
      commonResponseHeaders,
      requests: processedRequests,
      requestCount: processedRequests.length,
      requestLimitReached: !!captureInfo.limitReached,
      stoppedBy: isAutoStop ? 'auto' : 'user_request',
      tabUrl: captureInfo.tabUrl,
      tabTitle: captureInfo.tabTitle,
    };

    this.cleanupCapture(tabId);

    return { success: true, message: `Capture stopped. ${resultData.requestCount} requests.`, data: resultData };
  }

  private analyzeCommonHeaders(
    requests: NetworkRequestInfo[],
    headerTypeKey: 'requestHeaders' | 'responseHeaders',
  ): Record<string, string> {
    if (!requests || requests.length === 0) return {};

    const headerValueCounts = new Map<string, Map<string, number>>();
    let requestsWithHeadersCount = 0;

    for (const req of requests) {
      const headers = req[headerTypeKey] as Record<string, string> | undefined;
      if (headers && Object.keys(headers).length > 0) {
        requestsWithHeadersCount++;
        for (const name in headers) {
          const lowerName = name.toLowerCase();
          const value = headers[name];
          if (!headerValueCounts.has(lowerName))
            headerValueCounts.set(lowerName, new Map());
          const values = headerValueCounts.get(lowerName)!;
          values.set(value, (values.get(value) || 0) + 1);
        }
      }
    }

    if (requestsWithHeadersCount === 0) return {};

    const commonHeaders: Record<string, string> = {};
    headerValueCounts.forEach((values, name) => {
      values.forEach((count, value) => {
        if (count === requestsWithHeadersCount) {
          let originalName = name;
          for (const req of requests) {
            const hdrs = req[headerTypeKey] as Record<string, string> | undefined;
            if (hdrs) {
              const foundName = Object.keys(hdrs).find((k) => k.toLowerCase() === name);
              if (foundName) {
                originalName = foundName;
                break;
              }
            }
          }
          commonHeaders[originalName] = value;
        }
      });
    });
    return commonHeaders;
  }

  private filterOutCommonHeaders(
    headers: Record<string, string>,
    commonHeaders: Record<string, string>,
  ): Record<string, string> {
    if (!headers || typeof headers !== 'object') return {};
    const commonHeadersLower: Record<string, string> = {};
    Object.keys(commonHeaders).forEach((commonName) => {
      commonHeadersLower[commonName.toLowerCase()] = commonHeaders[commonName];
    });

    const specificHeaders: Record<string, string> = {};
    Object.keys(headers).forEach((name) => {
      const lowerName = name.toLowerCase();
      if (!(lowerName in commonHeadersLower) || headers[name] !== commonHeadersLower[lowerName])
        specificHeaders[name] = headers[name];
    });
    return specificHeaders;
  }

  async execute(args: NetworkDebuggerStartToolParams): Promise<ToolResult> {
    const {
      url: targetUrl,
      maxCaptureTime = DEFAULT_MAX_CAPTURE_TIME_MS,
      inactivityTimeout = DEFAULT_INACTIVITY_TIMEOUT_MS,
      includeStatic = false,
    } = args;

    let tabToOperateOn: chrome.tabs.Tab | undefined;

    try {
      if (targetUrl) {
        const existingTabs = await chrome.tabs.query({
          url: targetUrl.startsWith('http') ? targetUrl : `*://*/*${targetUrl}*`,
        });
        if (existingTabs.length > 0 && existingTabs[0]?.id) {
          tabToOperateOn = existingTabs[0];
          await chrome.windows.update(tabToOperateOn.windowId, { focused: true });
          await chrome.tabs.update(tabToOperateOn.id!, { active: true });
        } else {
          tabToOperateOn = await chrome.tabs.create({ url: targetUrl, active: true });
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } else {
        const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTabs.length > 0 && activeTabs[0]?.id)
          tabToOperateOn = activeTabs[0];
        else
          return createErrorResponse('No active tab found and no URL provided.');
      }

      if (!tabToOperateOn?.id)
        return createErrorResponse('Failed to identify or create a target tab.');

      const tabId = tabToOperateOn.id;

      try {
        await this.startCaptureForTab(tabId, { maxCaptureTime, inactivityTimeout, includeStatic });
      } catch (error: any) {
        return createErrorResponse(`Failed to start capture for tab ${tabId}: ${error.message || String(error)}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Network capture started on tab ${tabId}. Waiting for stop command or timeout.`,
              tabId,
              url: tabToOperateOn.url,
              maxCaptureTime,
              inactivityTimeout,
              includeStatic,
              maxRequests: NetworkDebuggerStartTool.MAX_REQUESTS_PER_CAPTURE,
            }),
          },
        ],
        isError: false,
      };
    } catch (error: any) {
      const tabIdToClean = tabToOperateOn?.id;
      if (tabIdToClean && this.captureData.has(tabIdToClean)) {
        await cdpSessionManager.detach(tabIdToClean, 'network-capture').catch(() => {});
        this.cleanupCapture(tabIdToClean);
      }
      return createErrorResponse(`Error in NetworkDebuggerStartTool: ${error.message || String(error)}`);
    }
  }
}

class NetworkDebuggerStopTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.NETWORK_DEBUGGER_STOP;
  public static instance: NetworkDebuggerStopTool | null = null;

  constructor() {
    super();
    if (NetworkDebuggerStopTool.instance)
      return NetworkDebuggerStopTool.instance;
    NetworkDebuggerStopTool.instance = this;
  }

  async execute(): Promise<ToolResult> {
    const startTool = NetworkDebuggerStartTool.instance;
    if (!startTool)
      return createErrorResponse('NetworkDebuggerStartTool instance not available. Cannot stop capture.');

    const ongoingCaptures = Array.from(startTool['captureData'].keys());
    if (ongoingCaptures.length === 0)
      return createErrorResponse('No active network captures found in any tab.');

    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = activeTabs[0]?.id;

    let primaryTabId: number;
    if (activeTabId && startTool['captureData'].has(activeTabId))
      primaryTabId = activeTabId;
    else if (ongoingCaptures.length === 1)
      primaryTabId = ongoingCaptures[0];
    else
      primaryTabId = ongoingCaptures[0];

    const result = await this.performStop(startTool, primaryTabId);

    if (ongoingCaptures.length > 1) {
      const otherTabIds = ongoingCaptures.filter((id) => id !== primaryTabId);
      for (const tabId of otherTabIds) {
        try {
          await startTool.stopCapture(tabId);
        } catch (error) {
          console.error(`NetworkDebuggerStopTool: Error stopping capture on tab ${tabId}:`, error);
        }
      }
    }

    return result;
  }

  private async performStop(
    startTool: NetworkDebuggerStartTool,
    tabId: number,
  ): Promise<ToolResult> {
    const stopResult = await startTool.stopCapture(tabId);

    if (!stopResult?.success)
      return createErrorResponse(
        stopResult?.message || `Failed to stop network capture for tab ${tabId}.`,
      );

    const resultData = stopResult.data || {};

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Capture for tab ${tabId} stopped. ${resultData.requestCount || 0} requests captured.`,
            tabId,
            tabUrl: resultData.tabUrl || 'N/A',
            tabTitle: resultData.tabTitle || 'Unknown Tab',
            requestCount: resultData.requestCount || 0,
            commonRequestHeaders: resultData.commonRequestHeaders || {},
            commonResponseHeaders: resultData.commonResponseHeaders || {},
            requests: resultData.requests || [],
            captureStartTime: resultData.captureStartTime,
            captureEndTime: resultData.captureEndTime,
            totalDurationMs: resultData.totalDurationMs,
            remainingCaptures: Array.from(startTool['captureData'].keys()),
            requestLimitReached: resultData.requestLimitReached || false,
          }),
        },
      ],
      isError: false,
    };
  }
}

export const networkDebuggerStartTool = new NetworkDebuggerStartTool();
export const networkDebuggerStopTool = new NetworkDebuggerStopTool();
