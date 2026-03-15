import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { run, ok, fail } from "./core";

export const browserClick = new FunctionTool({
  name: "browser_click",
  description:
    "Click an interactive element by its ref (e.g. @e1). Get refs from browser_snapshot first. After clicking a link that navigates, call browser_snapshot again to get new refs.",
  parameters: z.object({
    ref: z.string().describe("Element ref from browser_snapshot (e.g. @e1, @e2)"),
    newTab: z
      .boolean()
      .optional()
      .describe("Open the link in a new tab instead of navigating the current page"),
  }),
  execute: async ({ ref, newTab }) => {
    try {
      const args = ["click", ref];
      if (newTab) args.push("--new-tab");
      return ok(await run(args));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserFill = new FunctionTool({
  name: "browser_fill",
  description:
    "Clear an input field and type new text into it. Use for form fields, search boxes, text inputs. This CLEARS existing text first. Use browser_type to append without clearing.",
  parameters: z.object({
    ref: z.string().describe("Element ref of the input field (e.g. @e2)"),
    text: z.string().describe("Text to fill in"),
  }),
  execute: async ({ ref, text }) => {
    try {
      return ok(await run(["fill", ref, text]));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserType = new FunctionTool({
  name: "browser_type",
  description:
    "Type text into an input field WITHOUT clearing it first. Appends to existing content. Use browser_fill to replace text entirely.",
  parameters: z.object({
    ref: z.string().describe("Element ref of the input field"),
    text: z.string().describe("Text to type"),
  }),
  execute: async ({ ref, text }) => {
    try {
      return ok(await run(["type", ref, text]));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserSelect = new FunctionTool({
  name: "browser_select",
  description: "Select an option from a dropdown/select element.",
  parameters: z.object({
    ref: z.string().describe("Element ref of the select/dropdown"),
    option: z.string().describe("Option text or value to select"),
  }),
  execute: async ({ ref, option }) => {
    try {
      return ok(await run(["select", ref, option]));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserCheck = new FunctionTool({
  name: "browser_check",
  description: "Check or toggle a checkbox element.",
  parameters: z.object({
    ref: z.string().describe("Element ref of the checkbox"),
  }),
  execute: async ({ ref }) => {
    try {
      return ok(await run(["check", ref]));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserPressKey = new FunctionTool({
  name: "browser_press_key",
  description:
    "Press a keyboard key in the browser. Supports key combos. Examples: Enter, Escape, Tab, ArrowDown, Backspace, Control+a, Meta+c.",
  parameters: z.object({
    key: z
      .string()
      .describe("Key to press (e.g. Enter, Escape, Tab, ArrowDown, Control+a, Meta+v)"),
  }),
  execute: async ({ key }) => {
    try {
      return ok(await run(["press", key]));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserKeyboard = new FunctionTool({
  name: "browser_keyboard",
  description:
    "Type text at the current focus position without targeting a specific element. Use 'type' mode for key events (triggers input handlers), or 'inserttext' mode for direct text insertion (bypasses key events).",
  parameters: z.object({
    mode: z
      .enum(["type", "inserttext"])
      .describe(
        "'type' dispatches keydown/keypress/keyup events. 'inserttext' inserts text directly without key events.",
      ),
    text: z.string().describe("Text to type"),
  }),
  execute: async ({ mode, text }) => {
    try {
      return ok(await run(["keyboard", mode, text]));
    } catch (err) {
      return fail(err);
    }
  },
});

export const browserScroll = new FunctionTool({
  name: "browser_scroll",
  description: "Scroll the page or a specific scrollable container up or down.",
  parameters: z.object({
    direction: z.enum(["up", "down"]).describe("Scroll direction"),
    amount: z.number().optional().describe("Pixels to scroll (default: 500)"),
    selector: z
      .string()
      .optional()
      .describe(
        "CSS selector of a scrollable container (e.g. 'div.content'). Omit to scroll the page.",
      ),
  }),
  execute: async ({ direction, amount, selector }) => {
    try {
      const args = ["scroll", direction, String(amount ?? 500)];
      if (selector) args.push("--selector", selector);
      return ok(await run(args));
    } catch (err) {
      return fail(err);
    }
  },
});
