import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { run, ok, fail } from "./core";

export const browserSnapshot = new FunctionTool({
  name: "browser_snapshot",
  description:
    "Get a structured accessibility tree of all interactive elements on the current page with refs like @e1, @e2. Use these refs with browser_click, browser_fill, browser_select, etc. ALWAYS call this after navigating or when the page changes to get fresh refs. Refs are invalidated by navigation or DOM changes.",
  parameters: z.object({
    includeClickable: z
      .boolean()
      .optional()
      .describe("Also include elements with cursor:pointer (divs with onclick, etc.)"),
    selector: z
      .string()
      .optional()
      .describe("CSS selector to scope the snapshot to a specific part of the page"),
  }),
  execute: async ({ includeClickable, selector }) => {
    try {
      const args = ["snapshot", "-i"];
      if (includeClickable) args.push("-C");
      if (selector) args.push("-s", selector);
      return ok(await run(args) || "(no interactive elements found)");
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserPageInfo = new FunctionTool({
  name: "browser_page_info",
  description: "Get the current page URL and title.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const encoded = Buffer.from(
        "JSON.stringify({url:location.href,title:document.title})",
      ).toString("base64");
      const raw = await run(["eval", "-b", encoded]);
      return { status: "success", ...JSON.parse(raw) };
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserGetText = new FunctionTool({
  name: "browser_get_text",
  description:
    "Get the text content of a specific element by ref, or the entire visible page text if no ref is given.",
  parameters: z.object({
    ref: z
      .string()
      .optional()
      .describe("Element ref (e.g. @e5). Omit to get full page text."),
  }),
  execute: async ({ ref }) => {
    try {
      return ok(await run(["get", "text", ref || "body"], 15_000));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserScreenshot = new FunctionTool({
  name: "browser_screenshot",
  description:
    "Take a screenshot of the current page. In annotated mode (default), overlays numbered labels [N] on interactive elements that map to refs @eN. Returns the image path and legend. Use for visual page understanding, verifying layout, or when elements aren't visible in snapshots (icons, canvas, charts).",
  parameters: z.object({
    annotate: z
      .boolean()
      .optional()
      .describe("Overlay numbered element labels on the screenshot (default: true)"),
    fullPage: z
      .boolean()
      .optional()
      .describe("Capture the full scrollable page instead of just the viewport"),
  }),
  execute: async ({ annotate, fullPage }) => {
    try {
      const args = ["screenshot"];
      if (annotate !== false) args.push("--annotate");
      if (fullPage) args.push("--full");
      return ok(await run(args));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserHighlight = new FunctionTool({
  name: "browser_highlight",
  description:
    "Highlight an element visually in the browser with a colored overlay. Essential for pair browsing: shows the user exactly which element you are about to interact with. Call this before clicking or filling so the user can follow along.",
  parameters: z.object({
    ref: z.string().describe("Element ref to highlight (e.g. @e1)"),
  }),
  execute: async ({ ref }) => {
    try {
      return ok(await run(["highlight", ref]));
    } catch (err) {
      return fail(err);
    }
  },
});
