import { createErrorResponse, ToolResult } from './types';
import { BaseBrowserToolExecutor } from './base-browser';
import { TOOL_NAMES } from './names';

const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 720;

interface NavigateToolParams {
  url?: string;
  newWindow?: boolean;
  width?: number;
  height?: number;
  refresh?: boolean;
  tabId?: number;
  windowId?: number;
  background?: boolean;
}

class NavigateTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.NAVIGATE;

  async execute(args: NavigateToolParams): Promise<ToolResult> {
    const {
      newWindow = false,
      width,
      height,
      url,
      refresh = false,
      tabId,
      background,
      windowId,
    } = args;

    console.log(
      `Attempting to ${refresh ? 'refresh current tab' : `open URL: ${url}`} with options:`,
      args,
    );

    try {
      if (refresh) {
        const explicit = await this.tryGetTab(tabId);
        const targetTab = explicit || (await this.getActiveTabOrThrowInWindow(windowId));
        if (!targetTab.id) return createErrorResponse('No target tab found to refresh');
        await chrome.tabs.reload(targetTab.id);

        const updatedTab = await chrome.tabs.get(targetTab.id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Successfully refreshed current tab',
                tabId: updatedTab.id,
                windowId: updatedTab.windowId,
                url: updatedTab.url,
              }),
            },
          ],
          isError: false,
        };
      }

      if (!url)
        return createErrorResponse('URL parameter is required when refresh is not true');

      if (url === 'back' || url === 'forward') {
        const explicitTab = await this.tryGetTab(tabId);
        const targetTab = explicitTab || (await this.getActiveTabOrThrowInWindow(windowId));
        if (!targetTab.id)
          return createErrorResponse('No target tab found for history navigation');

        await this.ensureFocus(targetTab, {
          activate: background !== true,
          focusWindow: background !== true,
        });

        if (url === 'forward')
          await chrome.tabs.goForward(targetTab.id);
        else
          await chrome.tabs.goBack(targetTab.id);

        const updatedTab = await chrome.tabs.get(targetTab.id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Successfully navigated ${url} in browser history`,
                tabId: updatedTab.id,
                windowId: updatedTab.windowId,
                url: updatedTab.url,
              }),
            },
          ],
          isError: false,
        };
      }

      const buildUrlPatterns = (input: string): string[] => {
        const patterns = new Set<string>();
        try {
          if (!input.includes('*')) {
            const u = new URL(input);
            const pathWildcard = '/*';
            const hostNoWww = u.host.replace(/^www\./, '');
            const hostWithWww = hostNoWww.startsWith('www.') ? hostNoWww : `www.${hostNoWww}`;

            patterns.add(`${u.protocol}//${u.host}${pathWildcard}`);
            patterns.add(`${u.protocol}//${hostNoWww}${pathWildcard}`);
            patterns.add(`${u.protocol}//${hostWithWww}${pathWildcard}`);

            const altProtocol = u.protocol === 'https:' ? 'http:' : 'https:';
            patterns.add(`${altProtocol}//${u.host}${pathWildcard}`);
            patterns.add(`${altProtocol}//${hostNoWww}${pathWildcard}`);
            patterns.add(`${altProtocol}//${hostWithWww}${pathWildcard}`);
          } else {
            patterns.add(input);
          }
        } catch {
          patterns.add(input.endsWith('/') ? `${input}*` : `${input}/*`);
        }
        return Array.from(patterns);
      };

      const urlPatterns = buildUrlPatterns(url);
      const candidateTabs = await chrome.tabs.query({ url: urlPatterns });

      const pickBestMatch = (target: string, tabsToPick: chrome.tabs.Tab[]) => {
        let targetUrl: URL | undefined;
        try {
          targetUrl = new URL(target);
        } catch {
          return tabsToPick[0];
        }

        const normalizePath = (p: string) => {
          if (!p) return '/';
          const withLeading = p.startsWith('/') ? p : `/${p}`;
          return withLeading !== '/' && withLeading.endsWith('/')
            ? withLeading.slice(0, -1)
            : withLeading;
        };

        const hostBase = (h: string) => h.replace(/^www\./, '').toLowerCase();
        const targetPath = normalizePath(targetUrl.pathname);
        const targetSearch = targetUrl.search || '';
        const targetHostBase = hostBase(targetUrl.host);

        let best: { tab?: chrome.tabs.Tab; score: number } = { score: -1 };

        for (const tab of tabsToPick) {
          let tabUrl: URL | undefined;
          try {
            tabUrl = new URL(tab.url || '');
          } catch {
            continue;
          }

          const tabHostBase = hostBase(tabUrl.host);
          if (tabHostBase !== targetHostBase) continue;

          const tabPath = normalizePath(tabUrl.pathname);
          const tabSearch = tabUrl.search || '';

          let score = -1;
          const pathEqual = tabPath === targetPath;
          const searchEqual = tabSearch === targetSearch;

          if (pathEqual && (targetSearch ? searchEqual : true))
            score = 3;
          else if (pathEqual && !targetSearch)
            score = 2;

          if (score > best.score) {
            best = { tab, score };
            if (score === 3) break;
          }
        }

        return best.tab;
      };

      const explicitTab = await this.tryGetTab(tabId);
      const existingTab = explicitTab || pickBestMatch(url, candidateTabs);
      if (existingTab?.id !== undefined) {
        if (explicitTab && typeof explicitTab.id === 'number')
          await chrome.tabs.update(explicitTab.id, { url });

        await this.ensureFocus(existingTab, {
          activate: background !== true,
          focusWindow: background !== true,
        });

        const updatedTab = await chrome.tabs.get(existingTab.id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Activated existing tab',
                tabId: updatedTab.id,
                windowId: updatedTab.windowId,
                url: updatedTab.url,
              }),
            },
          ],
          isError: false,
        };
      }

      const openInNewWindow = newWindow || typeof width === 'number' || typeof height === 'number';

      if (openInNewWindow) {
        const win = await chrome.windows.create({
          url: url,
          width: typeof width === 'number' ? width : DEFAULT_WINDOW_WIDTH,
          height: typeof height === 'number' ? height : DEFAULT_WINDOW_HEIGHT,
          focused: background !== true,
        });

        if (win && win.id !== undefined) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: 'Opened URL in new window',
                  windowId: win.id,
                  tabs: win.tabs
                    ? win.tabs.map((tab) => ({ tabId: tab.id, url: tab.url }))
                    : [],
                }),
              },
            ],
            isError: false,
          };
        }
      } else {
        let targetWindow: chrome.windows.Window | null = null;
        if (typeof windowId === 'number')
          targetWindow = await chrome.windows.get(windowId, { populate: false });
        if (!targetWindow)
          targetWindow = await chrome.windows.getLastFocused({ populate: false });

        if (targetWindow && targetWindow.id !== undefined) {
          const newTab = await chrome.tabs.create({
            url: url,
            windowId: targetWindow.id,
            active: background !== true,
          });
          if (background !== true)
            await chrome.windows.update(targetWindow.id, { focused: true });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: 'Opened URL in new tab in existing window',
                  tabId: newTab.id,
                  windowId: targetWindow.id,
                  url: newTab.url,
                }),
              },
            ],
            isError: false,
          };
        } else {
          const fallbackWindow = await chrome.windows.create({
            url: url,
            width: DEFAULT_WINDOW_WIDTH,
            height: DEFAULT_WINDOW_HEIGHT,
            focused: true,
          });

          if (fallbackWindow && fallbackWindow.id !== undefined) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Opened URL in new window',
                    windowId: fallbackWindow.id,
                    tabs: fallbackWindow.tabs
                      ? fallbackWindow.tabs.map((tab) => ({ tabId: tab.id, url: tab.url }))
                      : [],
                  }),
                },
              ],
              isError: false,
            };
          }
        }
      }

      return createErrorResponse('Failed to open URL: Unknown error occurred');
    } catch (error) {
      if (chrome.runtime.lastError)
        return createErrorResponse(`Chrome API Error: ${chrome.runtime.lastError.message}`);
      return createErrorResponse(
        `Error navigating to URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
export const navigateTool = new NavigateTool();

interface CloseTabsToolParams {
  tabIds?: number[];
  url?: string;
}

class CloseTabsTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.CLOSE_TABS;

  async execute(args: CloseTabsToolParams): Promise<ToolResult> {
    const { tabIds, url } = args;
    let urlPattern = url;

    try {
      if (urlPattern) {
        try {
          if (!urlPattern.includes('*')) {
            try {
              const u = new URL(urlPattern);
              const basePath = u.pathname || '/';
              const pathWithWildcard = basePath.endsWith('/') ? `${basePath}*` : `${basePath}/*`;
              urlPattern = `${u.protocol}//${u.host}${pathWithWildcard}`;
            } catch {
              urlPattern = urlPattern.endsWith('/') ? `${urlPattern}*` : `${urlPattern}/*`;
            }
          }
        } catch {
          urlPattern = urlPattern.endsWith('*')
            ? urlPattern
            : urlPattern.endsWith('/')
              ? `${urlPattern}*`
              : `${urlPattern}/*`;
        }

        const tabs = await chrome.tabs.query({ url: urlPattern });

        if (!tabs || tabs.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  message: `No tabs found with URL pattern: ${urlPattern}`,
                  closedCount: 0,
                }),
              },
            ],
            isError: false,
          };
        }

        const tabIdsToClose = tabs
          .map((tab) => tab.id)
          .filter((id): id is number => id !== undefined);

        if (tabIdsToClose.length === 0)
          return createErrorResponse('Found tabs but could not get their IDs');

        await chrome.tabs.remove(tabIdsToClose);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Closed ${tabIdsToClose.length} tabs with URL: ${url}`,
                closedCount: tabIdsToClose.length,
                closedTabIds: tabIdsToClose,
              }),
            },
          ],
          isError: false,
        };
      }

      if (tabIds && tabIds.length > 0) {
        const existingTabs = await Promise.all(
          tabIds.map(async (id) => {
            try {
              return await chrome.tabs.get(id);
            } catch {
              return null;
            }
          }),
        );

        const validTabIds = existingTabs
          .filter((tab): tab is chrome.tabs.Tab => tab !== null)
          .map((tab) => tab.id)
          .filter((id): id is number => id !== undefined);

        if (validTabIds.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  message: 'None of the provided tab IDs exist',
                  closedCount: 0,
                }),
              },
            ],
            isError: false,
          };
        }

        await chrome.tabs.remove(validTabIds);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Closed ${validTabIds.length} tabs`,
                closedCount: validTabIds.length,
                closedTabIds: validTabIds,
                invalidTabIds: tabIds.filter((id) => !validTabIds.includes(id)),
              }),
            },
          ],
          isError: false,
        };
      }

      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.id)
        return createErrorResponse('No active tab found');

      await chrome.tabs.remove(activeTab.id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Closed active tab',
              closedCount: 1,
              closedTabIds: [activeTab.id],
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return createErrorResponse(
        `Error closing tabs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const closeTabsTool = new CloseTabsTool();

interface SwitchTabToolParams {
  tabId: number;
  windowId?: number;
}

class SwitchTabTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.SWITCH_TAB;

  async execute(args: SwitchTabToolParams): Promise<ToolResult> {
    const { tabId, windowId } = args;

    try {
      if (windowId !== undefined)
        await chrome.windows.update(windowId, { focused: true });
      await chrome.tabs.update(tabId, { active: true });

      const updatedTab = await chrome.tabs.get(tabId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Successfully switched to tab ID: ${tabId}`,
              tabId: updatedTab.id,
              windowId: updatedTab.windowId,
              url: updatedTab.url,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      if (chrome.runtime.lastError)
        return createErrorResponse(`Chrome API Error: ${chrome.runtime.lastError.message}`);
      return createErrorResponse(
        `Error switching tab: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const switchTabTool = new SwitchTabTool();
