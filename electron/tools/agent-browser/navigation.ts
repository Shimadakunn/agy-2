import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { run, ok, fail } from "./core";

export const browserGo = new FunctionTool({
  name: "browser_go",
  description:
    "Navigate the browser to a URL in the user's actual browser session. Returns the page title and final URL. Always call browser_snapshot after to get interactive element refs.",
  parameters: z.object({
    url: z.string().describe("URL to navigate to"),
    waitUntil: z
      .enum(["load", "networkidle"])
      .optional()
      .describe(
        "Wait strategy after navigation. 'networkidle' waits for all network requests to finish (slower but more reliable for SPAs).",
      ),
  }),
  execute: async ({ url, waitUntil }) => {
    try {
      await run(["open", url]);
      if (waitUntil === "networkidle")
        await run(["wait", "--load", "networkidle"], 60_000);
      const title = await run(["get", "title"]).catch(() => "");
      const finalUrl = await run(["get", "url"]).catch(() => url);
      return { status: "success", url: finalUrl, title };
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserWait = new FunctionTool({
  name: "browser_wait",
  description:
    "Wait for a condition before proceeding. Use after navigation, dynamic content loading, or before interacting with slow-loading elements.",
  parameters: z.object({
    type: z
      .enum([
        "element",
        "text",
        "url",
        "networkidle",
        "time",
        "js_condition",
        "hidden",
        "download",
      ])
      .describe(
        "What to wait for: 'element' (appear), 'text' (substring match), 'url' (glob pattern), 'networkidle' (no pending requests), 'time' (ms delay), 'js_condition' (JS expression returns truthy), 'hidden' (element disappears), 'download' (file download completes)",
      ),
    value: z
      .string()
      .optional()
      .describe(
        "Ref/selector for element/hidden, text substring for text, glob for url, milliseconds for time, JS expression for js_condition, file path for download. Not needed for networkidle.",
      ),
  }),
  execute: async ({ type, value }) => {
    try {
      let args: string[];
      switch (type) {
        case "element":
          args = ["wait", value!];
          break;
        case "text":
          args = ["wait", "--text", value!];
          break;
        case "url":
          args = ["wait", "--url", value!];
          break;
        case "networkidle":
          args = ["wait", "--load", "networkidle"];
          break;
        case "time":
          args = ["wait", value || "2000"];
          break;
        case "js_condition":
          args = ["wait", "--fn", value!];
          break;
        case "hidden":
          args = ["wait", value!, "--state", "hidden"];
          break;
        case "download":
          args = ["wait", "--download", value || "./download"];
          break;
      }
      await run(args!, 60_000);
      return ok("Done");
    } catch (err) {
      return fail(err);
    }
  },
});
