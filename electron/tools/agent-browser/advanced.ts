import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { run, ok, fail } from "./core";

export const browserRunJs = new FunctionTool({
  name: "browser_run_js",
  description:
    "Execute JavaScript in the browser page context and return the result. Code is base64-encoded internally to avoid shell issues. Use for complex data extraction, page manipulation, or any operation not covered by other tools.",
  parameters: z.object({
    code: z.string().describe("JavaScript code to execute in the browser"),
  }),
  execute: async ({ code }) => {
    try {
      const encoded = Buffer.from(code).toString("base64");
      return ok(await run(["eval", "-b", encoded]));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserFind = new FunctionTool({
  name: "browser_find",
  description:
    "Find and optionally interact with elements using semantic locators instead of refs. Useful when refs are unavailable or when you know the text/label/role of the element. Strategies: 'text' matches visible text, 'label' matches form labels, 'role' matches ARIA role, 'placeholder' matches placeholder, 'testid' matches data-testid.",
  parameters: z.object({
    by: z
      .enum(["text", "label", "role", "placeholder", "testid"])
      .describe("Locator strategy"),
    value: z
      .string()
      .describe("Value to search for (e.g. 'Sign In', 'email', 'button', 'Search...')"),
    action: z
      .enum(["click", "fill", "type", "check"])
      .optional()
      .describe("Action to perform on the found element"),
    actionValue: z
      .string()
      .optional()
      .describe("Value for the action (text for fill/type)"),
    name: z
      .string()
      .optional()
      .describe("For 'role' strategy: additional accessible name filter (--name)"),
  }),
  execute: async ({ by, value, action, actionValue, name }) => {
    try {
      const args = ["find", by, value];
      if (action) {
        args.push(action);
        if (actionValue) args.push(actionValue);
      }
      if (name) args.push("--name", name);
      return ok(await run(args));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserClipboard = new FunctionTool({
  name: "browser_clipboard",
  description:
    "Interact with the browser clipboard. 'read' gets clipboard text, 'write' sets text, 'copy' copies current selection, 'paste' pastes into focused element.",
  parameters: z.object({
    action: z.enum(["read", "write", "copy", "paste"]).describe("Clipboard action"),
    text: z.string().optional().describe("Text to write (only for 'write' action)"),
  }),
  execute: async ({ action, text }) => {
    try {
      const args = ["clipboard", action];
      if (action === "write" && text) args.push(text);
      return ok(await run(args));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserDownload = new FunctionTool({
  name: "browser_download",
  description:
    "Download a file by clicking an element that triggers a download. Returns the download path.",
  parameters: z.object({
    ref: z
      .string()
      .describe("Element ref that triggers the download (e.g. a download button or link)"),
    savePath: z
      .string()
      .optional()
      .describe("File path to save the download (e.g. ./report.pdf)"),
  }),
  execute: async ({ ref, savePath }) => {
    try {
      const args = ["download", ref];
      if (savePath) args.push(savePath);
      return ok(await run(args, 60_000));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserDiff = new FunctionTool({
  name: "browser_diff",
  description:
    "Compare the current page state against the last snapshot to see what changed. 'snapshot' mode compares accessibility trees (shows + additions, - removals). 'screenshot' mode compares pixels with mismatch percentage. Use after an action to verify it had the intended effect.",
  parameters: z.object({
    mode: z
      .enum(["snapshot", "screenshot"])
      .optional()
      .describe("Comparison mode (default: 'snapshot')"),
    baseline: z
      .string()
      .optional()
      .describe("Path to a saved baseline file to compare against, instead of last snapshot"),
  }),
  execute: async ({ mode, baseline }) => {
    try {
      const args = ["diff", mode || "snapshot"];
      if (baseline) args.push("--baseline", baseline);
      return ok(await run(args));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserSetViewport = new FunctionTool({
  name: "browser_set_viewport",
  description:
    "Set the browser viewport size or emulate a specific device. Use for responsive testing or to match the user's expected view.",
  parameters: z.object({
    width: z.number().optional().describe("Viewport width in pixels"),
    height: z.number().optional().describe("Viewport height in pixels"),
    device: z
      .string()
      .optional()
      .describe(
        "Device name to emulate (e.g. 'iPhone 14', 'iPad Pro'). Sets viewport + user agent. Overrides width/height.",
      ),
    scale: z
      .number()
      .optional()
      .describe("Device pixel ratio for retina/HiDPI (e.g. 2)"),
  }),
  execute: async ({ width, height, device, scale }) => {
    try {
      if (device) return ok(await run(["set", "device", device]));
      const args = ["set", "viewport", String(width || 1280), String(height || 720)];
      if (scale) args.push(String(scale));
      return ok(await run(args));
    } catch (err) {
      return fail(err);
    }
  },
});
