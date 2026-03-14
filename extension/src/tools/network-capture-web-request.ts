import { createErrorResponse, ToolResult } from './types';
import { BaseBrowserToolExecutor } from './base-browser';
import { TOOL_NAMES } from './names';
import { LIMITS, NETWORK_FILTERS } from './constants';

const STATIC_RESOURCE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp',
  '.css', '.scss', '.less',
  '.js', '.jsx', '.ts', '.tsx',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.ogg', '.wav',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
];

const AD_ANALYTICS_DOMAINS = NETWORK_FILTERS.EXCLUDED_DOMAINS;

interface NetworkCaptureStartToolParams {
  url?: string;
  maxCaptureTime?: number;
  inactivityTimeout?: number;
  includeStatic?: boolean;
}

interface NetworkRequestInfo {
  requestId: string;
  url: string;
  method: string;
  type: string;
  requestTime: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseTime?: number;
  status?: number;
  statusText?: string;
  responseSize?: number;
  responseType?: string;
  responseBody?: string;
  errorText?: string;
  specificRequestHeaders?: Record<string, string>;
  specificResponseHeaders?: Record<string, string>;
  mimeType?: string;
}

interface CaptureInfo {
  tabId: number;
  tabUrl: string;
  tabTitle: string;
  startTime: number;
  endTime?: number;
  requests: Record<string, NetworkRequestInfo>;
  maxCaptureTime: number;
  inactivityTimeout: number;
  includeStatic: boolean;
  limitReached?: boolean;
}

class NetworkCaptureStartTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.NETWORK_CAPTURE_START;
  public static instance: NetworkCaptureStartTool | null = null;
  public captureData: Map<number, CaptureInfo> = new Map();
  private captureTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private inactivityTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private lastActivityTime: Map<number, number> = new Map();
  private requestCounters: Map<number, number> = new Map();
  public static MAX_REQUESTS_PER_CAPTURE = LIMITS.MAX_NETWORK_REQUESTS;
  private listeners: { [key: string]: (details: any) => void } = {};

  private static STATIC_MIME_TYPES_TO_FILTER = [
    'image/', 'font/', 'audio/', 'video/',
    'text/css', 'text/javascript',
    'application/javascript', 'application/x-javascript',
    'application/pdf', 'application/zip', 'application/octet-stream',
  ];

  private static API_MIME_TYPES = [
    'application/json', 'application/xml', 'text/xml',
    'application/x-www-form-urlencoded', 'application/graphql',
    'application/grpc', 'application/protobuf', 'application/x-protobuf',
    'application/x-json', 'application/ld+json',
    'application/problem+json', 'application/problem+xml',
    'application/soap+xml', 'application/vnd.api+json',
  ];

  constructor() {
    super();
    if (NetworkCaptureStartTool.instance)
      return NetworkCaptureStartTool.instance;
    NetworkCaptureStartTool.instance = this;

    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    chrome.tabs.onCreated.addListener(this.handleTabCreated.bind(this));
  }

  private handleTabRemoved(tabId: number) {
    if (this.captureData.has(tabId)) {
      console.log(`NetworkCaptureV2: Tab ${tabId} was closed, cleaning up resources.`);
      this.cleanupCapture(tabId);
    }
  }

  private async handleTabCreated(tab: chrome.tabs.Tab) {
    try {
      if (this.captureData.size === 0) return;
      const openerTabId = tab.openerTabId;
      if (!openerTabId) return;
      if (!this.captureData.has(openerTabId)) return;
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
      console.error(`NetworkCaptureV2: Error extending capture to new tab:`, error);
    }
  }

  private shouldFilterRequest(url: string, includeStatic: boolean): boolean {
    const normalizedUrl = String(url || '').toLowerCase();
    if (!normalizedUrl) return false;

    if (AD_ANALYTICS_DOMAINS.some((pattern) => normalizedUrl.includes(pattern)))
      return true;

    if (!includeStatic) {
      try {
        const urlObj = new URL(url);
        const path = urlObj.pathname.toLowerCase();
        if (STATIC_RESOURCE_EXTENSIONS.some((ext) => path.endsWith(ext)))
          return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  private shouldFilterByMimeType(mimeType: string, includeStatic: boolean): boolean {
    if (!mimeType) return false;
    if (NetworkCaptureStartTool.API_MIME_TYPES.some((type) => mimeType.startsWith(type)))
      return false;

    if (!includeStatic) {
      if (NetworkCaptureStartTool.STATIC_MIME_TYPES_TO_FILTER.some((type) => mimeType.startsWith(type)))
        return true;
      if (mimeType.startsWith('text/'))
        return true;
    }

    return false;
  }

  private updateLastActivityTime(tabId: number): void {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    this.lastActivityTime.set(tabId, Date.now());

    if (this.inactivityTimers.has(tabId))
      clearTimeout(this.inactivityTimers.get(tabId)!);

    if (captureInfo.inactivityTimeout > 0)
      this.inactivityTimers.set(
        tabId,
        setTimeout(() => this.checkInactivity(tabId), captureInfo.inactivityTimeout),
      );
  }

  private checkInactivity(tabId: number): void {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    const lastActivity = this.lastActivityTime.get(tabId) || captureInfo.startTime;
    const now = Date.now();
    const inactiveTime = now - lastActivity;

    if (inactiveTime >= captureInfo.inactivityTimeout) {
      this.stopCaptureByInactivity(tabId);
    } else {
      const remainingTime = captureInfo.inactivityTimeout - inactiveTime;
      this.inactivityTimers.set(
        tabId,
        setTimeout(() => this.checkInactivity(tabId), remainingTime),
      );
    }
  }

  private async stopCaptureByInactivity(tabId: number): Promise<void> {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;
    await this.stopCapture(tabId);
  }

  private cleanupCapture(tabId: number): void {
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
  }

  private setupListeners(): void {
    if (this.listeners.onBeforeRequest) return;

    this.listeners.onBeforeRequest = (details: chrome.webRequest.WebRequestBodyDetails) => {
      const captureInfo = this.captureData.get(details.tabId);
      if (!captureInfo) return;
      if (this.shouldFilterRequest(details.url, captureInfo.includeStatic)) return;

      const currentCount = this.requestCounters.get(details.tabId) || 0;
      if (currentCount >= NetworkCaptureStartTool.MAX_REQUESTS_PER_CAPTURE) {
        captureInfo.limitReached = true;
        return;
      }

      this.requestCounters.set(details.tabId, currentCount + 1);
      this.updateLastActivityTime(details.tabId);

      if (!captureInfo.requests[details.requestId]) {
        captureInfo.requests[details.requestId] = {
          requestId: details.requestId,
          url: details.url,
          method: details.method,
          type: details.type,
          requestTime: details.timeStamp,
        };

        if (details.requestBody) {
          const requestBody = this.processRequestBody(details.requestBody);
          if (requestBody)
            captureInfo.requests[details.requestId].requestBody = requestBody;
        }
      }
    };

    this.listeners.onSendHeaders = (details: chrome.webRequest.WebRequestHeadersDetails) => {
      const captureInfo = this.captureData.get(details.tabId);
      if (!captureInfo || !captureInfo.requests[details.requestId]) return;

      if (details.requestHeaders) {
        const headers: Record<string, string> = {};
        details.requestHeaders.forEach((header) => {
          headers[header.name] = header.value || '';
        });
        captureInfo.requests[details.requestId].requestHeaders = headers;
      }
    };

    this.listeners.onHeadersReceived = (details: chrome.webRequest.WebResponseHeadersDetails) => {
      const captureInfo = this.captureData.get(details.tabId);
      if (!captureInfo || !captureInfo.requests[details.requestId]) return;

      const requestInfo = captureInfo.requests[details.requestId];
      requestInfo.status = details.statusCode;
      requestInfo.statusText = details.statusLine;
      requestInfo.responseTime = details.timeStamp;
      requestInfo.mimeType = details.responseHeaders?.find(
        (h) => h.name.toLowerCase() === 'content-type',
      )?.value;

      if (requestInfo.mimeType && this.shouldFilterByMimeType(requestInfo.mimeType, captureInfo.includeStatic)) {
        delete captureInfo.requests[details.requestId];
        const currentCount = this.requestCounters.get(details.tabId) || 0;
        if (currentCount > 0)
          this.requestCounters.set(details.tabId, currentCount - 1);
        return;
      }

      if (details.responseHeaders) {
        const headers: Record<string, string> = {};
        details.responseHeaders.forEach((header) => {
          headers[header.name] = header.value || '';
        });
        requestInfo.responseHeaders = headers;
      }

      this.updateLastActivityTime(details.tabId);
    };

    this.listeners.onCompleted = (details: chrome.webRequest.WebResponseCacheDetails) => {
      const captureInfo = this.captureData.get(details.tabId);
      if (!captureInfo || !captureInfo.requests[details.requestId]) return;
      this.updateLastActivityTime(details.tabId);
    };

    this.listeners.onErrorOccurred = (details: chrome.webRequest.WebResponseErrorDetails) => {
      const captureInfo = this.captureData.get(details.tabId);
      if (!captureInfo || !captureInfo.requests[details.requestId]) return;
      captureInfo.requests[details.requestId].errorText = details.error;
      this.updateLastActivityTime(details.tabId);
    };

    chrome.webRequest.onBeforeRequest.addListener(
      this.listeners.onBeforeRequest, { urls: ['<all_urls>'] }, ['requestBody'],
    );
    chrome.webRequest.onSendHeaders.addListener(
      this.listeners.onSendHeaders, { urls: ['<all_urls>'] }, ['requestHeaders'],
    );
    chrome.webRequest.onHeadersReceived.addListener(
      this.listeners.onHeadersReceived, { urls: ['<all_urls>'] }, ['responseHeaders'],
    );
    chrome.webRequest.onCompleted.addListener(
      this.listeners.onCompleted, { urls: ['<all_urls>'] },
    );
    chrome.webRequest.onErrorOccurred.addListener(
      this.listeners.onErrorOccurred, { urls: ['<all_urls>'] },
    );
  }

  private removeListeners(): void {
    if (this.captureData.size > 0) return;

    if (this.listeners.onBeforeRequest)
      chrome.webRequest.onBeforeRequest.removeListener(this.listeners.onBeforeRequest);
    if (this.listeners.onSendHeaders)
      chrome.webRequest.onSendHeaders.removeListener(this.listeners.onSendHeaders);
    if (this.listeners.onHeadersReceived)
      chrome.webRequest.onHeadersReceived.removeListener(this.listeners.onHeadersReceived);
    if (this.listeners.onCompleted)
      chrome.webRequest.onCompleted.removeListener(this.listeners.onCompleted);
    if (this.listeners.onErrorOccurred)
      chrome.webRequest.onErrorOccurred.removeListener(this.listeners.onErrorOccurred);

    this.listeners = {};
  }

  private processRequestBody(requestBody: chrome.webRequest.WebRequestBody): string | undefined {
    if (requestBody.raw && requestBody.raw.length > 0)
      return '[Binary data]';
    if (requestBody.formData)
      return JSON.stringify(requestBody.formData);
    return undefined;
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

      this.captureData.set(tabId, {
        tabId,
        tabUrl: tab.url || '',
        tabTitle: tab.title || '',
        startTime: Date.now(),
        requests: {},
        maxCaptureTime,
        inactivityTimeout,
        includeStatic,
        limitReached: false,
      });

      this.requestCounters.set(tabId, 0);
      this.setupListeners();
      this.updateLastActivityTime(tabId);

      if (maxCaptureTime > 0)
        this.captureTimers.set(
          tabId,
          setTimeout(async () => {
            await this.stopCapture(tabId);
          }, maxCaptureTime),
        );
    } catch (error: any) {
      if (this.captureData.has(tabId))
        this.cleanupCapture(tabId);
      throw error;
    }
  }

  public async stopCapture(
    tabId: number,
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo)
      return { success: false, message: `No capture in progress for tab ${tabId}` };

    try {
      captureInfo.endTime = Date.now();

      const requestsArray = Object.values(captureInfo.requests);
      const commonRequestHeaders = this.analyzeCommonHeaders(requestsArray, 'requestHeaders');
      const commonResponseHeaders = this.analyzeCommonHeaders(requestsArray, 'responseHeaders');

      const processedRequests = requestsArray.map((req) => {
        const finalReq: NetworkRequestInfo = { ...req };

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

      processedRequests.sort((a, b) => (a.requestTime || 0) - (b.requestTime || 0));

      this.removeListeners();

      const resultData = {
        captureStartTime: captureInfo.startTime,
        captureEndTime: captureInfo.endTime,
        totalDurationMs: captureInfo.endTime - captureInfo.startTime,
        settingsUsed: {
          maxCaptureTime: captureInfo.maxCaptureTime,
          inactivityTimeout: captureInfo.inactivityTimeout,
          includeStatic: captureInfo.includeStatic,
          maxRequests: NetworkCaptureStartTool.MAX_REQUESTS_PER_CAPTURE,
        },
        commonRequestHeaders,
        commonResponseHeaders,
        requests: processedRequests,
        requestCount: processedRequests.length,
        totalRequestsReceived: this.requestCounters.get(tabId) || 0,
        requestLimitReached: captureInfo.limitReached || false,
        tabUrl: captureInfo.tabUrl,
        tabTitle: captureInfo.tabTitle,
      };

      this.cleanupCapture(tabId);

      return { success: true, data: resultData };
    } catch (error: any) {
      this.cleanupCapture(tabId);
      return { success: false, message: `Error stopping capture: ${error.message || String(error)}` };
    }
  }

  private analyzeCommonHeaders(
    requests: NetworkRequestInfo[],
    headerType: 'requestHeaders' | 'responseHeaders',
  ): Record<string, string> {
    if (!requests || requests.length === 0) return {};

    const commonHeaders: Record<string, string> = {};
    const firstRequestWithHeaders = requests.find(
      (req) => req[headerType] && Object.keys(req[headerType] || {}).length > 0,
    );

    if (!firstRequestWithHeaders || !firstRequestWithHeaders[headerType])
      return {};

    const headers = firstRequestWithHeaders[headerType] as Record<string, string>;
    const headerNames = Object.keys(headers);

    for (const name of headerNames) {
      const value = headers[name];
      const isCommon = requests.every((req) => {
        const reqHeaders = req[headerType] as Record<string, string>;
        return reqHeaders && reqHeaders[name] === value;
      });
      if (isCommon)
        commonHeaders[name] = value;
    }

    return commonHeaders;
  }

  private filterOutCommonHeaders(
    headers: Record<string, string>,
    commonHeaders: Record<string, string>,
  ): Record<string, string> {
    if (!headers || typeof headers !== 'object') return {};
    const specificHeaders: Record<string, string> = {};
    Object.keys(headers).forEach((name) => {
      if (!(name in commonHeaders) || headers[name] !== commonHeaders[name])
        specificHeaders[name] = headers[name];
    });
    return specificHeaders;
  }

  async execute(args: NetworkCaptureStartToolParams): Promise<ToolResult> {
    const {
      url: targetUrl,
      maxCaptureTime = 3 * 60 * 1000,
      inactivityTimeout = 60 * 1000,
      includeStatic = false,
    } = args;

    try {
      let tabToOperateOn: chrome.tabs.Tab;

      if (targetUrl) {
        const matchingTabs = await chrome.tabs.query({ url: targetUrl });
        if (matchingTabs.length > 0) {
          tabToOperateOn = matchingTabs[0];
        } else {
          tabToOperateOn = await chrome.tabs.create({ url: targetUrl, active: true });
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } else {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0])
          return createErrorResponse('No active tab found');
        tabToOperateOn = tabs[0];
      }

      if (!tabToOperateOn?.id)
        return createErrorResponse('Failed to identify or create a tab');

      try {
        await this.startCaptureForTab(tabToOperateOn.id, { maxCaptureTime, inactivityTimeout, includeStatic });
      } catch (error: any) {
        return createErrorResponse(
          `Failed to start capture for tab ${tabToOperateOn.id}: ${error.message || String(error)}`,
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Network capture V2 started successfully, waiting for stop command.',
              tabId: tabToOperateOn.id,
              url: tabToOperateOn.url,
              maxCaptureTime,
              inactivityTimeout,
              includeStatic,
              maxRequests: NetworkCaptureStartTool.MAX_REQUESTS_PER_CAPTURE,
            }),
          },
        ],
        isError: false,
      };
    } catch (error: any) {
      return createErrorResponse(`Error in NetworkCaptureStartTool: ${error.message || String(error)}`);
    }
  }
}

class NetworkCaptureStopTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.NETWORK_CAPTURE_STOP;
  public static instance: NetworkCaptureStopTool | null = null;

  constructor() {
    super();
    if (NetworkCaptureStopTool.instance)
      return NetworkCaptureStopTool.instance;
    NetworkCaptureStopTool.instance = this;
  }

  async execute(): Promise<ToolResult> {
    try {
      const startTool = NetworkCaptureStartTool.instance;
      if (!startTool)
        return createErrorResponse('Network capture V2 start tool instance not found');

      const ongoingCaptures = Array.from(startTool.captureData.keys());
      if (ongoingCaptures.length === 0)
        return createErrorResponse('No active network captures found in any tab.');

      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTabId = activeTabs[0]?.id;

      let primaryTabId: number;
      if (activeTabId && startTool.captureData.has(activeTabId))
        primaryTabId = activeTabId;
      else if (ongoingCaptures.length === 1)
        primaryTabId = ongoingCaptures[0];
      else
        primaryTabId = ongoingCaptures[0];

      const stopResult = await startTool.stopCapture(primaryTabId);

      if (!stopResult.success)
        return createErrorResponse(
          stopResult.message || `Failed to stop network capture for tab ${primaryTabId}`,
        );

      if (ongoingCaptures.length > 1) {
        const otherTabIds = ongoingCaptures.filter((id) => id !== primaryTabId);
        for (const tabId of otherTabIds) {
          try {
            await startTool.stopCapture(tabId);
          } catch (error) {
            console.error(`NetworkCaptureStopTool: Error stopping capture on tab ${tabId}:`, error);
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Capture complete. ${stopResult.data?.requestCount || 0} requests captured.`,
              tabId: primaryTabId,
              tabUrl: stopResult.data?.tabUrl || 'N/A',
              tabTitle: stopResult.data?.tabTitle || 'Unknown Tab',
              requestCount: stopResult.data?.requestCount || 0,
              commonRequestHeaders: stopResult.data?.commonRequestHeaders || {},
              commonResponseHeaders: stopResult.data?.commonResponseHeaders || {},
              requests: stopResult.data?.requests || [],
              captureStartTime: stopResult.data?.captureStartTime,
              captureEndTime: stopResult.data?.captureEndTime,
              totalDurationMs: stopResult.data?.totalDurationMs,
              settingsUsed: stopResult.data?.settingsUsed || {},
              totalRequestsReceived: stopResult.data?.totalRequestsReceived || 0,
              requestLimitReached: stopResult.data?.requestLimitReached || false,
              remainingCaptures: Array.from(startTool.captureData.keys()),
            }),
          },
        ],
        isError: false,
      };
    } catch (error: any) {
      return createErrorResponse(`Error in NetworkCaptureStopTool: ${error.message || String(error)}`);
    }
  }
}

export const networkCaptureStartTool = new NetworkCaptureStartTool();
export const networkCaptureStopTool = new NetworkCaptureStopTool();
