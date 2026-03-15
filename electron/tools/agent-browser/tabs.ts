import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { run, ok, fail, fetchCdpTargets, tabTargets } from "./core";
import { chatTabContext } from "../tab-context";

export const browserTabList = new FunctionTool({
  name: "browser_tab_list",
  description:
    "List all open browser tabs with their URLs and titles. Shows which tab is active for the current chat session. Each chat tab has a dedicated browser tab for pair browsing so the user can see the agent's actions in real-time.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const targets = await fetchCdpTargets();
      if (targets.length === 0)
        return fail(new Error("No browser tabs found. Is the browser running with CDP?"));

      const chatTabId = chatTabContext.getStore();
      const activeTargetId = chatTabId ? tabTargets.get(chatTabId) : null;
      const tabs = targets.map((t, i) => ({
        index: i,
        url: t.url,
        title: t.title || "",
        active: t.id === activeTargetId,
      }));
      return { status: "success", tabs, chatTabId: chatTabId || null };
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserTabSwitch = new FunctionTool({
  name: "browser_tab_switch",
  description:
    "Switch to a browser tab by its index (from browser_tab_list). For multi-tab workflows within a single chat session. The user will see the browser focus change.",
  parameters: z.object({
    index: z.number().describe("Tab index to switch to (0-based, from browser_tab_list)"),
  }),
  execute: async ({ index }) => {
    try {
      return ok(await run(["tab", String(index)]));
    } catch (err) {
      return fail(err);
    }
  },
});
