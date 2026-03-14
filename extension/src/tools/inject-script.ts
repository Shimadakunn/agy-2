import { createErrorResponse, ToolResult } from './types';
import { BaseBrowserToolExecutor } from './base-browser';
import { TOOL_NAMES } from './names';
import { ExecutionWorld } from './constants';

interface InjectScriptParam {
  url?: string;
  tabId?: number;
  windowId?: number;
  background?: boolean;
}

interface ScriptConfig {
  type: ExecutionWorld;
  jsScript: string;
}

interface SendCommandToInjectScriptToolParam {
  tabId?: number;
  eventName: string;
  payload?: string;
}

const injectedTabs = new Map();

class InjectScriptTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.INJECT_SCRIPT;

  async execute(args: InjectScriptParam & ScriptConfig): Promise<ToolResult> {
    try {
      const { url, type, jsScript, tabId, windowId, background } = args;
      let tab: chrome.tabs.Tab | undefined;

      if (!type || !jsScript)
        return createErrorResponse('Param [type] and [jsScript] is required');

      if (typeof tabId === 'number') {
        tab = await chrome.tabs.get(tabId);
      } else if (url) {
        const allTabs = await chrome.tabs.query({});
        const matchingTabs = allTabs.filter((t) => {
          const tabUrl = t.url?.endsWith('/') ? t.url.slice(0, -1) : t.url;
          const targetUrl = url.endsWith('/') ? url.slice(0, -1) : url;
          return tabUrl === targetUrl;
        });

        if (matchingTabs.length > 0) {
          tab = matchingTabs[0];
        } else {
          tab = await chrome.tabs.create({
            url,
            active: background !== true,
            windowId,
          });
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } else {
        const tabs =
          typeof windowId === 'number'
            ? await chrome.tabs.query({ active: true, windowId })
            : await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0])
          return createErrorResponse('No active tab found');
        tab = tabs[0];
      }

      if (!tab.id)
        return createErrorResponse('Tab has no ID');

      if (background !== true) {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      }

      const res = await handleInject(tab.id!, { ...args });

      return {
        content: [{ type: 'text', text: JSON.stringify(res) }],
        isError: false,
      };
    } catch (error) {
      console.error('Error in InjectScriptTool.execute:', error);
      return createErrorResponse(
        `Inject script error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

class SendCommandToInjectScriptTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.SEND_COMMAND_TO_INJECT_SCRIPT;

  async execute(args: SendCommandToInjectScriptToolParam): Promise<ToolResult> {
    try {
      const { tabId, eventName, payload } = args;

      if (!eventName)
        return createErrorResponse('Param [eventName] is required');

      if (tabId) {
        const tabExists = await isTabExists(tabId);
        if (!tabExists)
          return createErrorResponse('The tab:[tabId] is not exists');
      }

      let finalTabId: number | undefined = tabId;

      if (finalTabId === undefined) {
        const tabs = await chrome.tabs.query({ active: true });
        if (!tabs[0])
          return createErrorResponse('No active tab found');
        finalTabId = tabs[0].id;
      }

      if (!finalTabId)
        return createErrorResponse('No active tab found');

      if (!injectedTabs.has(finalTabId))
        throw new Error('No script injected in this tab.');

      const result = await chrome.tabs.sendMessage(finalTabId, {
        action: eventName,
        payload,
        targetWorld: injectedTabs.get(finalTabId).type,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: false,
      };
    } catch (error) {
      console.error('Error in SendCommandToInjectScriptTool.execute:', error);
      return createErrorResponse(
        `Inject script error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

async function isTabExists(tabId: number) {
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

// This tool intentionally executes user-provided code in browser tab contexts.
// The new Function() usage is required for dynamic script injection - this is the tool's core purpose.
async function handleInject(tabId: number, scriptConfig: ScriptConfig) {
  if (injectedTabs.has(tabId))
    await handleCleanup(tabId);

  const { type, jsScript } = scriptConfig;
  const hasMain = type === ExecutionWorld.MAIN;

  if (hasMain) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['inject-scripts/inject-bridge.js'],
      world: ExecutionWorld.ISOLATED,
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      // eslint-disable-next-line no-new-func
      func: (code: string) => Function(code)(),
      args: [jsScript],
      world: ExecutionWorld.MAIN,
    });
  } else {
    await chrome.scripting.executeScript({
      target: { tabId },
      // eslint-disable-next-line no-new-func
      func: (code: string) => Function(code)(),
      args: [jsScript],
      world: ExecutionWorld.ISOLATED,
    });
  }
  injectedTabs.set(tabId, scriptConfig);
  return { injected: true };
}

async function handleCleanup(tabId: number) {
  if (!injectedTabs.has(tabId)) return;
  chrome.tabs
    .sendMessage(tabId, { type: 'chrome-mcp:cleanup' })
    .catch(() => {});
  injectedTabs.delete(tabId);
}

export const injectScriptTool = new InjectScriptTool();
export const sendCommandToInjectScriptTool = new SendCommandToInjectScriptTool();

chrome.tabs.onRemoved.addListener((tabId) => {
  if (injectedTabs.has(tabId))
    injectedTabs.delete(tabId);
});
