import { FunctionTool } from "@google/adk";
import { z } from "zod";
import {
  run,
  ok,
  fail,
  fetchCdpTargets,
  getChatTabInfo,
  createTabForChat,
  setActiveChatTab,
  getChatTabs,
  getCdpPort,
} from "./core";
import { chatTabContext } from "../tab-context";

export const browserTabList = new FunctionTool({
  name: "browser_tab_list",
  description:
    "List the browser tabs owned by the current chat. Each chat has its own dedicated browser tabs. Shows which tab is active (the one commands will target). Use browser_tab_new to create additional tabs for multi-tab workflows.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const chatId = chatTabContext.getStore();
      if (!chatId) return fail(new Error("No chat context"));

      const tabs = await getChatTabInfo(chatId);
      if (tabs.length === 0)
        return { status: "success", tabs: [], note: "No browser tabs yet. Use browser_go or browser_tab_new to create one." };

      return {
        status: "success",
        chatId,
        tabs: tabs.map((t, i) => ({
          index: i,
          url: t.url,
          title: t.title || "",
          active: t.active,
          targetId: t.id,
        })),
      };
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserTabNew = new FunctionTool({
  name: "browser_tab_new",
  description:
    "Create a new browser tab in the current chat's tab pool. The new tab becomes the active tab for subsequent commands. Use this for multi-tab workflows (e.g., comparing two pages, filling a form from another page's data).",
  parameters: z.object({
    url: z.string().optional().describe("URL to open in the new tab (default: about:blank)"),
  }),
  execute: async ({ url }) => {
    try {
      const chatId = chatTabContext.getStore();
      if (!chatId) return fail(new Error("No chat context"));

      const target = await createTabForChat(chatId, url || "about:blank");
      if (!target) return fail(new Error("Failed to create browser tab. Is the browser running with CDP?"));

      if (url && url !== "about:blank") {
        try { await run(["open", url]); } catch {}
      }

      const tabs = await getChatTabInfo(chatId);
      return {
        status: "success",
        message: `Created new tab (${tabs.length} total for this chat)`,
        url: target.url,
        tabIndex: tabs.length - 1,
      };
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserTabSwitch = new FunctionTool({
  name: "browser_tab_switch",
  description:
    "Switch to a different browser tab within the current chat's tabs. Use the index from browser_tab_list. Subsequent commands will target this tab.",
  parameters: z.object({
    index: z.number().describe("Tab index within the chat's tabs (0-based, from browser_tab_list)"),
  }),
  execute: async ({ index }) => {
    try {
      const chatId = chatTabContext.getStore();
      if (!chatId) return fail(new Error("No chat context"));

      const tabs = await getChatTabInfo(chatId);
      if (index < 0 || index >= tabs.length)
        return fail(new Error(`Invalid tab index ${index}. Chat has ${tabs.length} tab(s).`));

      const target = tabs[index];
      setActiveChatTab(chatId, target.id);

      const allTargets = await fetchCdpTargets();
      const globalIndex = allTargets.findIndex((t) => t.id === target.id);
      if (globalIndex >= 0) await run(["tab", String(globalIndex)]);

      return ok(`Switched to tab ${index}: ${target.title || target.url}`);
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserTabClose = new FunctionTool({
  name: "browser_tab_close",
  description:
    "Close a browser tab from the current chat's tab pool. If closing the active tab, the previous tab becomes active.",
  parameters: z.object({
    index: z.number().describe("Tab index within the chat's tabs (0-based, from browser_tab_list)"),
  }),
  execute: async ({ index }) => {
    try {
      const chatId = chatTabContext.getStore();
      if (!chatId) return fail(new Error("No chat context"));

      const tabs = await getChatTabInfo(chatId);
      if (index < 0 || index >= tabs.length)
        return fail(new Error(`Invalid tab index ${index}. Chat has ${tabs.length} tab(s).`));

      const target = tabs[index];
      const chatTabList = getChatTabs().get(chatId);

      const port = getCdpPort();
      if (port) {
        try {
          await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`, {
            signal: AbortSignal.timeout(2000),
          });
        } catch {}
      }

      if (chatTabList) {
        const idx = chatTabList.indexOf(target.id);
        if (idx >= 0) chatTabList.splice(idx, 1);
      }

      if (target.active && chatTabList?.length) {
        const newActive = chatTabList[Math.min(index, chatTabList.length - 1)];
        setActiveChatTab(chatId, newActive);
      }

      const remaining = chatTabList?.length ?? 0;
      return ok(`Closed tab ${index}. ${remaining} tab(s) remaining.`);
    } catch (err) {
      return fail(err);
    }
  },
});
