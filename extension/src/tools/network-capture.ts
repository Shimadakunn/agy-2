import { createErrorResponse, ToolResult } from './types';
import { BaseBrowserToolExecutor } from './base-browser';
import { TOOL_NAMES } from './names';
import { networkCaptureStartTool, networkCaptureStopTool } from './network-capture-web-request';
import { networkDebuggerStartTool, networkDebuggerStopTool } from './network-capture-debugger';

type NetworkCaptureBackend = 'webRequest' | 'debugger';

interface NetworkCaptureToolParams {
  action: 'start' | 'stop';
  needResponseBody?: boolean;
  url?: string;
  maxCaptureTime?: number;
  inactivityTimeout?: number;
  includeStatic?: boolean;
}

function getFirstText(result: ToolResult): string | undefined {
  const first = result.content?.[0];
  return first && first.type === 'text' ? first.text : undefined;
}

function decorateJsonResult(result: ToolResult, extra: Record<string, unknown>): ToolResult {
  const text = getFirstText(result);
  if (typeof text !== 'string') return result;

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      return {
        ...result,
        content: [{ type: 'text', text: JSON.stringify({ ...parsed, ...extra }) }],
      };
  } catch {
    // keep as-is
  }
  return result;
}

function isDebuggerCaptureActive(): boolean {
  const captureData = (
    networkDebuggerStartTool as unknown as { captureData?: Map<number, unknown> }
  ).captureData;
  return captureData instanceof Map && captureData.size > 0;
}

function isWebRequestCaptureActive(): boolean {
  return networkCaptureStartTool.captureData.size > 0;
}

class NetworkCaptureTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.NETWORK_CAPTURE;

  async execute(args: NetworkCaptureToolParams): Promise<ToolResult> {
    const action = args?.action;
    if (action !== 'start' && action !== 'stop')
      return createErrorResponse('Parameter [action] is required and must be one of: start, stop');

    const wantBody = args?.needResponseBody === true;
    const debuggerActive = isDebuggerCaptureActive();
    const webActive = isWebRequestCaptureActive();

    if (action === 'start')
      return this.handleStart(args, wantBody, debuggerActive, webActive);

    return this.handleStop(args, debuggerActive, webActive);
  }

  private async handleStart(
    args: NetworkCaptureToolParams,
    wantBody: boolean,
    debuggerActive: boolean,
    webActive: boolean,
  ): Promise<ToolResult> {
    if (debuggerActive || webActive) {
      const activeMode = debuggerActive ? 'debugger' : 'webRequest';
      return createErrorResponse(
        `Network capture is already active in ${activeMode} mode. Stop it before starting a new capture.`,
      );
    }

    const delegate = wantBody ? networkDebuggerStartTool : networkCaptureStartTool;
    const backend: NetworkCaptureBackend = wantBody ? 'debugger' : 'webRequest';

    const result = await delegate.execute({
      url: args.url,
      maxCaptureTime: args.maxCaptureTime,
      inactivityTimeout: args.inactivityTimeout,
      includeStatic: args.includeStatic,
    });

    return decorateJsonResult(result, { backend, needResponseBody: wantBody });
  }

  private async handleStop(
    args: NetworkCaptureToolParams,
    debuggerActive: boolean,
    webActive: boolean,
  ): Promise<ToolResult> {
    let backendToStop: NetworkCaptureBackend | null = null;

    if (args?.needResponseBody === true)
      backendToStop = debuggerActive ? 'debugger' : null;
    else if (args?.needResponseBody === false)
      backendToStop = webActive ? 'webRequest' : null;

    if (!backendToStop) {
      if (debuggerActive) backendToStop = 'debugger';
      else if (webActive) backendToStop = 'webRequest';
    }

    if (!backendToStop)
      return createErrorResponse('No active network captures found in any tab.');

    const delegateStop =
      backendToStop === 'debugger' ? networkDebuggerStopTool : networkCaptureStopTool;
    const result = await delegateStop.execute();

    return decorateJsonResult(result, {
      backend: backendToStop,
      needResponseBody: backendToStop === 'debugger',
    });
  }
}

export const networkCaptureTool = new NetworkCaptureTool();
