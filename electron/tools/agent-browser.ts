import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { FunctionTool } from "@google/adk";
import { z } from "zod";

const execFile = promisify(execFileCb);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the agent-browser binary: node_modules/.bin first, then PATH
const localBin = path.resolve(__dirname, "..", "node_modules", ".bin", "agent-browser");
let bin = "";
let cdpPort: number | null = null;

function strip(s: string): string {
  return s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").trim();
}

async function resolveBin(): Promise<string> {
  if (bin) return bin;

  for (const candidate of [
    localBin,
    "agent-browser",
    `${process.env.HOME}/Library/pnpm/agent-browser`,
  ]) {
    try {
      await execFile(candidate, ["--version"], { timeout: 5000 });
      bin = candidate;
      return bin;
    } catch {}
  }
  throw new Error("agent-browser binary not found. Run: pnpm add agent-browser");
}

async function detectCdp(): Promise<number | null> {
  if (process.env.BROWSER_CDP_PORT)
    return parseInt(process.env.BROWSER_CDP_PORT, 10);

  for (const port of [9222, 9229, 9333]) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) return port;
    } catch {}
  }
  return null;
}

async function run(args: string[], timeout = 30_000): Promise<string> {
  const binary = await resolveBin();
  if (!cdpPort) cdpPort = await detectCdp();

  const fullArgs = cdpPort ? ["--cdp", String(cdpPort), ...args] : args;

  try {
    const { stdout } = await execFile(binary, fullArgs, {
      timeout,
      env: { ...process.env, AGENT_BROWSER_DEBUG: "1" },
    });
    return strip(stdout);
  } catch (err: any) {
    const out = strip(err.stdout || "");
    const errMsg = strip(err.stderr || "");

    // Usable output despite non-zero exit (e.g. wait timeouts)
    if (out && !out.includes("Failed to connect")) return out;

    if (errMsg.includes("Failed to connect") || out.includes("Failed to connect"))
      cdpPort = null;

    throw new Error(out || errMsg || (err instanceof Error ? err.message : String(err)));
  }
}

function ok(result: string) {
  return { status: "success" as const, result };
}

function fail(err: unknown) {
  return {
    status: "error" as const,
    error: err instanceof Error ? err.message : String(err),
  };
}

// --------------- Tools ---------------

const browserGo = new FunctionTool({
  name: "browser_go",
  description:
    "Navigate the browser to a URL in the user's actual browser session. Returns the page title and final URL.",
  parameters: z.object({
    url: z.string().describe("URL to navigate to"),
  }),
  execute: async ({ url }) => {
    try {
      await run(["open", url]);
      const title = await run(["get", "title"]).catch(() => "");
      const finalUrl = await run(["get", "url"]).catch(() => url);
      return { status: "success", url: finalUrl, title };
    } catch (err) {
      return fail(err);
    }
  },
});

const browserSnapshot = new FunctionTool({
  name: "browser_snapshot",
  description:
    "Get a structured list of all interactive elements on the current page with refs (like @e1, @e2). Use these refs with browser_click, browser_fill, browser_select. ALWAYS call this after navigating or when the page changes to get fresh refs.",
  parameters: z.object({
    includeClickable: z
      .boolean()
      .optional()
      .describe("Also include elements with cursor:pointer (divs with onclick, etc.)"),
  }),
  execute: async ({ includeClickable }) => {
    try {
      const args = ["snapshot", "-i"];
      if (includeClickable) args.push("-C");
      const result = await run(args);
      return ok(result || "(no interactive elements found)");
    } catch (err) {
      return fail(err);
    }
  },
});

const browserClick = new FunctionTool({
  name: "browser_click",
  description:
    "Click an interactive element by its ref (e.g. @e1). Get refs from browser_snapshot first. After clicking a link that navigates, call browser_snapshot again to get new refs.",
  parameters: z.object({
    ref: z.string().describe("Element ref from browser_snapshot (e.g. @e1, @e2)"),
  }),
  execute: async ({ ref }) => {
    try {
      return ok(await run(["click", ref]));
    } catch (err) {
      return fail(err);
    }
  },
});

const browserFill = new FunctionTool({
  name: "browser_fill",
  description:
    "Clear an input field and type new text into it. Use for form fields, search boxes, text inputs.",
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

const browserSelect = new FunctionTool({
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

const browserGetText = new FunctionTool({
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

const browserPageInfo = new FunctionTool({
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

const browserScroll = new FunctionTool({
  name: "browser_scroll",
  description: "Scroll the page up or down by a given number of pixels.",
  parameters: z.object({
    direction: z.enum(["up", "down"]).describe("Scroll direction"),
    amount: z.number().optional().describe("Pixels to scroll (default: 500)"),
  }),
  execute: async ({ direction, amount }) => {
    try {
      return ok(await run(["scroll", direction, String(amount ?? 500)]));
    } catch (err) {
      return fail(err);
    }
  },
});

const browserPressKey = new FunctionTool({
  name: "browser_press_key",
  description:
    "Press a keyboard key in the browser. Examples: Enter, Escape, Tab, ArrowDown, Backspace.",
  parameters: z.object({
    key: z.string().describe("Key to press (e.g. Enter, Escape, Tab, ArrowDown, Backspace)"),
  }),
  execute: async ({ key }) => {
    try {
      return ok(await run(["press", key]));
    } catch (err) {
      return fail(err);
    }
  },
});

const browserRunJs = new FunctionTool({
  name: "browser_run_js",
  description:
    "Execute JavaScript in the browser page context and return the result. Code is base64-encoded before being sent to avoid shell issues. Use for complex data extraction or page manipulation.",
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

const browserWait = new FunctionTool({
  name: "browser_wait",
  description:
    "Wait for a condition before proceeding. Use after navigation or dynamic content loading.",
  parameters: z.object({
    type: z
      .enum(["element", "text", "url", "networkidle", "time"])
      .describe("What to wait for"),
    value: z
      .string()
      .optional()
      .describe(
        "Ref (@e1) for element, text substring for text, glob pattern for url, or milliseconds for time. Not needed for networkidle.",
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
      }
      await run(args!, 60_000);
      return ok("Done");
    } catch (err) {
      return fail(err);
    }
  },
});

const browserScreenshot = new FunctionTool({
  name: "browser_screenshot",
  description:
    "Take an annotated screenshot of the browser page. Returns numbered labels mapping to element refs (@eN), useful for visual understanding of the page layout.",
  parameters: z.object({
    fullPage: z
      .boolean()
      .optional()
      .describe("Capture the full scrollable page instead of just the viewport"),
  }),
  execute: async ({ fullPage }) => {
    try {
      const args = ["screenshot", "--annotate"];
      if (fullPage) args.push("--full");
      return ok(await run(args));
    } catch (err) {
      return fail(err);
    }
  },
});

const allTools = [
  browserGo,
  browserSnapshot,
  browserClick,
  browserFill,
  browserSelect,
  browserGetText,
  browserPageInfo,
  browserScroll,
  browserPressKey,
  browserRunJs,
  browserWait,
  browserScreenshot,
];

export async function getBrowserTools(): Promise<FunctionTool[]> {
  try {
    await resolveBin();
    console.log(`[Browser] agent-browser found at ${bin}`);
  } catch (err) {
    console.warn("[Browser]", err instanceof Error ? err.message : err);
    return [];
  }

  cdpPort = await detectCdp();
  if (cdpPort) console.log(`[Browser] CDP detected on port ${cdpPort}`);
  else console.warn("[Browser] No browser CDP port detected. Tools will retry on use.");

  return allTools;
}

export async function closeBrowserToolset(): Promise<void> {
  try {
    const binary = await resolveBin();
    await execFile(binary, ["close"], { timeout: 5000 });
  } catch {}
  cdpPort = null;
}

export async function isBrowserConnected(): Promise<boolean> {
  return (await detectCdp()) !== null;
}
