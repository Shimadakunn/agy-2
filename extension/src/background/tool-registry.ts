import type { ToolExecutor, ToolResult } from '../tools/types';
import { TOOL_NAMES } from '../tools/names';

// Simple tools
import { windowTool } from '../tools/window';
import { navigateTool, closeTabsTool, switchTabTool } from '../tools/common';
import { keyboardTool } from '../tools/keyboard';
import { historyTool } from '../tools/history';
import { bookmarkSearchTool, bookmarkAddTool, bookmarkDeleteTool } from '../tools/bookmark';
import { handleDialogTool } from '../tools/dialog';
import { handleDownloadTool } from '../tools/download';

// Complex tools
import { screenshotTool } from '../tools/screenshot';
import { readPageTool } from '../tools/read-page';
import { javascriptTool } from '../tools/javascript';
import { consoleTool } from '../tools/console';
import { clickTool, fillTool } from '../tools/interaction';
import { webFetcherTool, getInteractiveElementsTool } from '../tools/web-fetcher';
import { networkRequestTool } from '../tools/network-request';
import { networkCaptureTool } from '../tools/network-capture';
import { fileUploadTool } from '../tools/file-upload';
import { injectScriptTool, sendCommandToInjectScriptTool } from '../tools/inject-script';

const toolMap = new Map<string, ToolExecutor>([
  [TOOL_NAMES.GET_WINDOWS_AND_TABS, windowTool],
  [TOOL_NAMES.NAVIGATE, navigateTool],
  [TOOL_NAMES.SCREENSHOT, screenshotTool],
  [TOOL_NAMES.CLOSE_TABS, closeTabsTool],
  [TOOL_NAMES.SWITCH_TAB, switchTabTool],
  [TOOL_NAMES.WEB_FETCHER, webFetcherTool],
  [TOOL_NAMES.CLICK, clickTool],
  [TOOL_NAMES.FILL, fillTool],
  [TOOL_NAMES.GET_INTERACTIVE_ELEMENTS, getInteractiveElementsTool],
  [TOOL_NAMES.NETWORK_CAPTURE, networkCaptureTool],
  [TOOL_NAMES.NETWORK_REQUEST, networkRequestTool],
  [TOOL_NAMES.KEYBOARD, keyboardTool],
  [TOOL_NAMES.HISTORY, historyTool],
  [TOOL_NAMES.BOOKMARK_SEARCH, bookmarkSearchTool],
  [TOOL_NAMES.BOOKMARK_ADD, bookmarkAddTool],
  [TOOL_NAMES.BOOKMARK_DELETE, bookmarkDeleteTool],
  [TOOL_NAMES.JAVASCRIPT, javascriptTool],
  [TOOL_NAMES.CONSOLE, consoleTool],
  [TOOL_NAMES.FILE_UPLOAD, fileUploadTool],
  [TOOL_NAMES.READ_PAGE, readPageTool],
  [TOOL_NAMES.HANDLE_DIALOG, handleDialogTool],
  [TOOL_NAMES.HANDLE_DOWNLOAD, handleDownloadTool],
  [TOOL_NAMES.INJECT_SCRIPT, injectScriptTool],
  [TOOL_NAMES.SEND_COMMAND_TO_INJECT_SCRIPT, sendCommandToInjectScriptTool],
]);

const TOOL_SCHEMAS = [
  {
    name: TOOL_NAMES.GET_WINDOWS_AND_TABS,
    description: 'Get all currently open browser windows and tabs',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: TOOL_NAMES.NAVIGATE,
    description: 'Navigate to a URL, refresh the current tab, or navigate browser history (back/forward)',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to. Special values: "back" or "forward" to navigate browser history.' },
        newWindow: { type: 'boolean', description: 'Create a new window (default: false)' },
        tabId: { type: 'number', description: 'Target an existing tab by ID' },
        windowId: { type: 'number', description: 'Target window by ID' },
        background: { type: 'boolean', description: 'Do not steal focus (default: false)' },
        width: { type: 'number', description: 'Window width in pixels (default: 1280)' },
        height: { type: 'number', description: 'Window height in pixels (default: 720)' },
        refresh: { type: 'boolean', description: 'Refresh current tab (default: false)' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.SCREENSHOT,
    description: 'Take a screenshot of the current page or a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the screenshot' },
        selector: { type: 'string', description: 'CSS selector for element to screenshot' },
        tabId: { type: 'number', description: 'Target tab ID' },
        windowId: { type: 'number', description: 'Target window ID' },
        background: { type: 'boolean', description: 'Capture without bringing to foreground (default: false)' },
        width: { type: 'number', description: 'Width in pixels (default: 800)' },
        height: { type: 'number', description: 'Height in pixels (default: 600)' },
        storeBase64: { type: 'boolean', description: 'Return screenshot in base64 (default: false)' },
        fullPage: { type: 'boolean', description: 'Capture entire page (default: true)' },
        savePng: { type: 'boolean', description: 'Save as PNG file (default: true)' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.CLOSE_TABS,
    description: 'Close one or more browser tabs',
    inputSchema: {
      type: 'object',
      properties: {
        tabIds: { type: 'array', items: { type: 'number' }, description: 'Array of tab IDs to close' },
        url: { type: 'string', description: 'Close tabs matching this URL' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.SWITCH_TAB,
    description: 'Switch to a specific browser tab',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: 'The ID of the tab to switch to' },
        windowId: { type: 'number', description: 'The window ID' },
      },
      required: ['tabId'],
    },
  },
  {
    name: TOOL_NAMES.WEB_FETCHER,
    description: 'Fetch content from a web page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch from (default: active tab)' },
        tabId: { type: 'number', description: 'Target tab by ID' },
        background: { type: 'boolean', description: 'Do not activate tab (default: false)' },
        htmlContent: { type: 'boolean', description: 'Get HTML content (default: false)' },
        textContent: { type: 'boolean', description: 'Get text content (default: true)' },
        selector: { type: 'string', description: 'CSS selector for specific element' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.CLICK,
    description: 'Click on an element in a web page. Supports CSS selector, XPath, element ref, or viewport coordinates.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or XPath for the element' },
        selectorType: { type: 'string', enum: ['css', 'xpath'], description: 'Type of selector (default: "css")' },
        ref: { type: 'string', description: 'Element ref from chrome_read_page' },
        coordinates: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, description: 'Viewport coordinates' },
        double: { type: 'boolean', description: 'Double click (default: false)' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button (default: "left")' },
        modifiers: { type: 'object', properties: { altKey: { type: 'boolean' }, ctrlKey: { type: 'boolean' }, metaKey: { type: 'boolean' }, shiftKey: { type: 'boolean' } } },
        waitForNavigation: { type: 'boolean', description: 'Wait for navigation after click (default: false)' },
        timeout: { type: 'number', description: 'Timeout in ms (default: 5000)' },
        tabId: { type: 'number', description: 'Target tab ID' },
        windowId: { type: 'number', description: 'Window ID' },
        frameId: { type: 'number', description: 'Target frame ID' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.FILL,
    description: 'Fill or select a form element on a web page',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or XPath' },
        selectorType: { type: 'string', enum: ['css', 'xpath'], description: 'Type of selector (default: "css")' },
        ref: { type: 'string', description: 'Element ref from chrome_read_page' },
        value: { type: ['string', 'number', 'boolean'], description: 'Value to fill' },
        tabId: { type: 'number', description: 'Target tab ID' },
        windowId: { type: 'number', description: 'Window ID' },
        frameId: { type: 'number', description: 'Target frame ID' },
      },
      required: ['value'],
    },
  },
  {
    name: TOOL_NAMES.GET_INTERACTIVE_ELEMENTS,
    description: 'Get interactive elements on the current page',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: 'Target tab ID' },
        windowId: { type: 'number', description: 'Window ID' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.NETWORK_CAPTURE,
    description: 'Unified network capture tool. Use action="start" to begin capturing, action="stop" to end and retrieve results.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'stop'], description: 'Action: "start" or "stop"' },
        needResponseBody: { type: 'boolean', description: 'Capture response body via Debugger API (default: false)' },
        url: { type: 'string', description: 'URL to capture from (default: active tab)' },
        maxCaptureTime: { type: 'number', description: 'Max capture time in ms (default: 180000)' },
        inactivityTimeout: { type: 'number', description: 'Stop after inactivity in ms (default: 60000)' },
        includeStatic: { type: 'boolean', description: 'Include static resources (default: false)' },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.NETWORK_REQUEST,
    description: 'Send a network request from the browser with cookies and browser context',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to send request to' },
        method: { type: 'string', description: 'HTTP method (default: GET)' },
        headers: { type: 'object', description: 'Request headers' },
        body: { type: 'string', description: 'Request body' },
        timeout: { type: 'number', description: 'Timeout in ms (default: 30000)' },
        formData: { type: 'object', description: 'Multipart/form-data descriptor' },
      },
      required: ['url'],
    },
  },
  {
    name: TOOL_NAMES.KEYBOARD,
    description: 'Simulate keyboard input on a web page',
    inputSchema: {
      type: 'object',
      properties: {
        keys: { type: 'string', description: 'Keys or key combinations to simulate' },
        selector: { type: 'string', description: 'CSS selector or XPath for target element' },
        selectorType: { type: 'string', enum: ['css', 'xpath'], description: 'Type of selector (default: "css")' },
        delay: { type: 'number', description: 'Delay between keystrokes in ms (default: 50)' },
        tabId: { type: 'number', description: 'Target tab ID' },
        windowId: { type: 'number', description: 'Window ID' },
        frameId: { type: 'number', description: 'Target frame ID' },
      },
      required: ['keys'],
    },
  },
  {
    name: TOOL_NAMES.HISTORY,
    description: 'Retrieve and search browsing history from Chrome',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to search for in history URLs and titles' },
        startTime: { type: 'string', description: 'Start time (ISO, relative, or keyword). Default: 24h ago' },
        endTime: { type: 'string', description: 'End time (ISO, relative, or keyword). Default: now' },
        maxResults: { type: 'number', description: 'Max history entries to return (default: 100)' },
        excludeCurrentTabs: { type: 'boolean', description: 'Exclude currently open URLs (default: false)' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BOOKMARK_SEARCH,
    description: 'Search Chrome bookmarks by title and URL',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Max results (default: 50)' },
        folderPath: { type: 'string', description: 'Folder path or ID to limit search' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BOOKMARK_ADD,
    description: 'Add a new bookmark to Chrome',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to bookmark (default: active tab)' },
        title: { type: 'string', description: 'Bookmark title' },
        parentId: { type: 'string', description: 'Parent folder path or ID' },
        createFolder: { type: 'boolean', description: 'Create parent folder if missing (default: false)' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BOOKMARK_DELETE,
    description: 'Delete a bookmark from Chrome',
    inputSchema: {
      type: 'object',
      properties: {
        bookmarkId: { type: 'string', description: 'Bookmark ID' },
        url: { type: 'string', description: 'Bookmark URL (used if ID not provided)' },
        title: { type: 'string', description: 'Title for matching when deleting by URL' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.JAVASCRIPT,
    description: 'Execute JavaScript code in a browser tab and return the result',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code to execute' },
        tabId: { type: 'number', description: 'Target tab ID' },
        timeoutMs: { type: 'number', description: 'Execution timeout in ms (default: 15000)' },
        maxOutputBytes: { type: 'number', description: 'Max output size in bytes (default: 51200)' },
      },
      required: ['code'],
    },
  },
  {
    name: TOOL_NAMES.CONSOLE,
    description: 'Capture console output from a browser tab. Supports snapshot and buffer modes.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to and capture from' },
        tabId: { type: 'number', description: 'Target tab ID' },
        windowId: { type: 'number', description: 'Target window ID' },
        background: { type: 'boolean', description: 'Do not activate tab (default: false)' },
        includeExceptions: { type: 'boolean', description: 'Include uncaught exceptions (default: true)' },
        maxMessages: { type: 'number', description: 'Max messages in snapshot mode (default: 100)' },
        mode: { type: 'string', enum: ['snapshot', 'buffer'], description: 'Capture mode (default: snapshot)' },
        buffer: { type: 'boolean', description: 'Alias for mode="buffer"' },
        clear: { type: 'boolean', description: 'Buffer mode: clear before reading (default: false)' },
        clearAfterRead: { type: 'boolean', description: 'Buffer mode: clear after reading (default: false)' },
        pattern: { type: 'string', description: 'Regex filter for messages' },
        onlyErrors: { type: 'boolean', description: 'Only error-level messages (default: false)' },
        limit: { type: 'number', description: 'Limit returned messages' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.FILE_UPLOAD,
    description: 'Upload files to web forms with file input elements',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: 'Target tab ID' },
        windowId: { type: 'number', description: 'Target window ID' },
        selector: { type: 'string', description: 'CSS selector for file input element' },
        filePath: { type: 'string', description: 'Local file path to upload' },
        fileUrl: { type: 'string', description: 'URL to download file from' },
        base64Data: { type: 'string', description: 'Base64 encoded file data' },
        fileName: { type: 'string', description: 'Filename (default: "uploaded-file")' },
        multiple: { type: 'boolean', description: 'Accept multiple files (default: false)' },
      },
      required: ['selector'],
    },
  },
  {
    name: TOOL_NAMES.READ_PAGE,
    description: 'Get an accessibility tree representation of visible elements on the page',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Filter: "interactive" for buttons/links/inputs only' },
        depth: { type: 'number', description: 'Maximum DOM depth to traverse' },
        refId: { type: 'string', description: 'Focus on subtree rooted at this element refId' },
        tabId: { type: 'number', description: 'Target tab ID' },
        windowId: { type: 'number', description: 'Target window ID' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.HANDLE_DIALOG,
    description: 'Handle JavaScript dialogs (alert/confirm/prompt) via CDP',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'accept | dismiss' },
        promptText: { type: 'string', description: 'Optional prompt text when accepting' },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.HANDLE_DOWNLOAD,
    description: 'Wait for a browser download and return details',
    inputSchema: {
      type: 'object',
      properties: {
        filenameContains: { type: 'string', description: 'Filter by substring in filename or URL' },
        timeoutMs: { type: 'number', description: 'Timeout in ms (default: 60000, max: 300000)' },
        waitForComplete: { type: 'boolean', description: 'Wait until completed (default: true)' },
      },
      required: [],
    },
  },
];

export function getToolSchemas(): typeof TOOL_SCHEMAS {
  return TOOL_SCHEMAS;
}

export async function executeToolCall(name: string, args: any): Promise<ToolResult> {
  const executor = toolMap.get(name);
  if (!executor)
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };

  return executor.execute(args);
}
