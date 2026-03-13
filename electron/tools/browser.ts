import { shell } from "electron";
import { FunctionTool } from "@google/adk";
import { z } from "zod";

export const openInBrowser = new FunctionTool({
  name: "open_in_browser",
  description:
    "Open a URL in the user's default browser. Use this to let the user review drafts in Gmail, view calendar events, open Drive files, or visit any webpage.",
  parameters: z.object({
    url: z.string().describe("The URL to open"),
  }),
  execute: async ({ url }) => {
    await shell.openExternal(url);
    return { status: "success", url };
  },
});

export const browserTools = [openInBrowser];
