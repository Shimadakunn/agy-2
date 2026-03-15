import type { FunctionTool } from "@google/adk";
import {
  resolveBin,
  detectCdp,
  setCdpPort,
  getCdpPort,
} from "./core";

export {
  openUrlInTab,
  cleanupChatTabs,
  closeBrowserToolset,
  isBrowserConnected,
  getChatTabInfo,
} from "./core";

// Navigation
import { browserGo, browserWait } from "./navigation";
// Observation
import {
  browserSnapshot,
  browserPageInfo,
  browserGetText,
  browserScreenshot,
  browserHighlight,
} from "./observation";
// Interaction
import {
  browserClick,
  browserFill,
  browserType,
  browserSelect,
  browserCheck,
  browserPressKey,
  browserKeyboard,
  browserScroll,
} from "./interaction";
// Advanced
import {
  browserRunJs,
  browserFind,
  browserClipboard,
  browserDownload,
  browserDiff,
  browserSetViewport,
} from "./advanced";
// Tab management
import { browserTabList, browserTabNew, browserTabSwitch, browserTabClose } from "./tabs";

const allTools: FunctionTool[] = [
  // Navigation
  browserGo,
  browserWait,
  // Observation
  browserSnapshot,
  browserPageInfo,
  browserGetText,
  browserScreenshot,
  browserHighlight,
  // Interaction
  browserClick,
  browserFill,
  browserType,
  browserSelect,
  browserCheck,
  browserPressKey,
  browserKeyboard,
  browserScroll,
  // Advanced
  browserRunJs,
  browserFind,
  browserClipboard,
  browserDownload,
  browserDiff,
  browserSetViewport,
  // Tab management
  browserTabList,
  browserTabNew,
  browserTabSwitch,
  browserTabClose,
];

export async function getBrowserTools(): Promise<FunctionTool[]> {
  try {
    const binPath = await resolveBin();
    console.log(`[Browser] agent-browser found at ${binPath}`);
  } catch (err) {
    console.warn("[Browser]", err instanceof Error ? err.message : err);
    return [];
  }

  setCdpPort(await detectCdp());
  const port = getCdpPort();
  if (port) console.log(`[Browser] CDP detected on port ${port}`);
  else console.warn("[Browser] No browser CDP port detected. Tools will retry on use.");

  return allTools;
}
