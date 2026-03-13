import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import { FunctionTool } from "@google/adk";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const execAsync = promisify(exec);

async function runAppleScript(script: string): Promise<string> {
  const { stdout } = await execAsync(`osascript -e ${JSON.stringify(script)}`, {
    timeout: 15_000,
  });
  return stdout.trim();
}

export const openApplication = new FunctionTool({
  name: "open_application",
  description:
    "Open a macOS application by name. Use the exact app name as it appears in /Applications (e.g. 'Safari', 'Finder', 'Terminal', 'System Settings').",
  parameters: z.object({
    appName: z.string().describe("Application name (e.g. 'Safari', 'Visual Studio Code', 'Terminal')"),
  }),
  execute: async ({ appName }) => {
    try {
      await runAppleScript(`tell application "${appName}" to activate`);
      return { status: "success", message: `Opened ${appName}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const getFrontmostApp = new FunctionTool({
  name: "get_frontmost_app",
  description: "Get the name and details of the currently active (frontmost) application and its windows.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const appName = await runAppleScript(
        'tell application "System Events" to get name of first application process whose frontmost is true'
      );
      const windowList = await runAppleScript(
        `tell application "System Events" to tell process "${appName}" to get name of every window`
      ).catch(() => "");
      return { status: "success", appName, windows: windowList };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const listRunningApps = new FunctionTool({
  name: "list_running_apps",
  description: "List all currently running applications on the Mac.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const result = await runAppleScript(
        'tell application "System Events" to get name of every application process whose background only is false'
      );
      const apps = result.split(", ").map((a) => a.trim());
      return { status: "success", apps };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const clickAtPosition = new FunctionTool({
  name: "click_at_position",
  description:
    "Click at specific screen coordinates. Requires Accessibility permissions. Use take_screenshot first to identify coordinates.",
  parameters: z.object({
    x: z.number().describe("X coordinate on screen"),
    y: z.number().describe("Y coordinate on screen"),
    clickType: z
      .enum(["left", "right", "double"])
      .optional()
      .describe("Type of click (default: left)"),
  }),
  execute: async ({ x, y, clickType }) => {
    try {
      const roundX = Math.round(x);
      const roundY = Math.round(y);
      const clickCount = clickType === "double" ? 2 : 1;
      const buttonType = clickType === "right" ? "kCGEventRightMouseDown" : "kCGEventLeftMouseDown";
      const buttonUpType = clickType === "right" ? "kCGEventRightMouseUp" : "kCGEventLeftMouseUp";
      const buttonId = clickType === "right" ? "kCGMouseButtonRight" : "kCGMouseButtonLeft";

      const pyScript = [
        "import Quartz, time",
        `p = (${roundX}, ${roundY})`,
        `for _ in range(${clickCount}):`,
        `    e = Quartz.CGEventCreateMouseEvent(None, Quartz.${buttonType}, p, Quartz.${buttonId})`,
        "    Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)",
        `    e = Quartz.CGEventCreateMouseEvent(None, Quartz.${buttonUpType}, p, Quartz.${buttonId})`,
        "    Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)",
        "    time.sleep(0.05)",
      ].join("\n");

      await execAsync(`python3 -c ${JSON.stringify(pyScript)}`, { timeout: 5000 });

      return { status: "success", message: `Clicked at (${roundX}, ${roundY})` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const typeText = new FunctionTool({
  name: "type_text",
  description: "Type text into the currently focused application using keyboard simulation.",
  parameters: z.object({
    text: z.string().describe("Text to type"),
  }),
  execute: async ({ text }) => {
    try {
      const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      await runAppleScript(
        `tell application "System Events" to keystroke "${escaped}"`
      );
      return { status: "success", message: "Typed text" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const pressKey = new FunctionTool({
  name: "press_key",
  description:
    "Press a keyboard shortcut or special key. Supports modifiers: command, control, option, shift. Examples: 'command+c' (copy), 'command+v' (paste), 'command+tab' (switch app), 'return', 'escape', 'tab', 'space', 'delete'.",
  parameters: z.object({
    keys: z
      .string()
      .describe(
        "Key combination like 'command+c', 'command+shift+s', 'return', 'escape', 'tab', 'space', 'up', 'down', 'left', 'right'"
      ),
  }),
  execute: async ({ keys }) => {
    try {
      const parts = keys.toLowerCase().split("+").map((k) => k.trim());
      const modifiers: string[] = [];
      let key = "";

      for (const part of parts) {
        if (["command", "control", "option", "shift"].includes(part))
          modifiers.push(part);
        else key = part;
      }

      const keyCodeMap: Record<string, number> = {
        return: 36, enter: 36, escape: 53, esc: 53, tab: 48,
        space: 49, delete: 51, backspace: 51, forwarddelete: 117,
        up: 126, down: 125, left: 123, right: 124,
        home: 115, end: 119, pageup: 116, pagedown: 121,
        f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97,
        f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
      };

      const modString = modifiers.length
        ? ` using {${modifiers.map((m) => `${m} down`).join(", ")}}`
        : "";

      if (keyCodeMap[key] !== undefined)
        await runAppleScript(`tell application "System Events" to key code ${keyCodeMap[key]}${modString}`);
      else if (key.length === 1)
        await runAppleScript(`tell application "System Events" to keystroke "${key}"${modString}`);
      else
        return { status: "error", error: `Unknown key: ${key}` };

      return { status: "success", message: `Pressed ${keys}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

async function analyzeScreenshot(filepath: string, context?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) return "[Vision unavailable: no API key]";

  const imageData = await readFile(filepath);
  const base64 = imageData.toString("base64");

  const genai = new GoogleGenAI({ apiKey });
  const prompt = context
    ? `Analyze this screenshot. ${context}. Describe precisely what you see: app name, window content, buttons, text fields, links, and their approximate screen positions (x,y coordinates from top-left). Be detailed but concise.`
    : "Describe this screenshot in detail. List: the application visible, all text content, buttons, links, text fields, and their approximate screen positions (x,y coordinates from top-left). This will be used to interact with the screen programmatically.";

  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: base64 } },
          { text: prompt },
        ],
      },
    ],
  });

  return response.text?.trim() || "[No analysis produced]";
}

export const takeScreenshot = new FunctionTool({
  name: "take_screenshot",
  description:
    "Take a screenshot and analyze it using AI vision. Returns a detailed description of what's on screen including UI elements and their approximate positions. Use this to SEE what's on screen before clicking or interacting. This is your primary way to understand what the user sees.",
  parameters: z.object({
    region: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      })
      .optional()
      .describe("Optional region to capture. If omitted, captures the full screen."),
    context: z
      .string()
      .optional()
      .describe("Optional context about what you're looking for (e.g. 'looking for the search results', 'finding the play button')"),
  }),
  execute: async ({ region, context }) => {
    try {
      const filename = `screenshot_${Date.now()}.png`;
      const filepath = path.join(tmpdir(), filename);

      if (region)
        await execAsync(
          `screencapture -x -R${region.x},${region.y},${region.width},${region.height} "${filepath}"`,
          { timeout: 10_000 }
        );
      else
        await execAsync(`screencapture -x "${filepath}"`, { timeout: 10_000 });

      // Get screen resolution for coordinate context
      const screenSize = await execAsync(
        `python3 -c "import Quartz; d=Quartz.CGDisplayBounds(Quartz.CGMainDisplayID()); print(f'{int(d.size.width)}x{int(d.size.height)}')"`,
      ).then((r) => r.stdout.trim()).catch(() => "unknown");

      // Analyze the screenshot with Gemini Vision
      const analysis = await analyzeScreenshot(filepath, context);

      return {
        status: "success",
        screenResolution: screenSize,
        analysis,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const runAppleScriptTool = new FunctionTool({
  name: "run_applescript",
  description:
    "Run an arbitrary AppleScript command for complex macOS automation that other tools cannot handle.",
  parameters: z.object({
    script: z.string().describe("The AppleScript code to execute"),
  }),
  execute: async ({ script }) => {
    try {
      const result = await runAppleScript(script);
      return { status: "success", result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const getUIElements = new FunctionTool({
  name: "get_ui_elements",
  description:
    "Get the UI elements (buttons, text fields, menus, etc.) of the frontmost application. Useful for understanding what can be interacted with.",
  parameters: z.object({
    elementType: z
      .enum(["buttons", "text fields", "menus", "all"])
      .optional()
      .describe("Type of UI elements to list (default: all)"),
  }),
  execute: async ({ elementType }) => {
    try {
      const appName = await runAppleScript(
        'tell application "System Events" to get name of first application process whose frontmost is true'
      );

      let script: string;
      if (elementType === "buttons")
        script = `tell application "System Events" to tell process "${appName}" to get description of every button of window 1`;
      else if (elementType === "text fields")
        script = `tell application "System Events" to tell process "${appName}" to get value of every text field of window 1`;
      else if (elementType === "menus")
        script = `tell application "System Events" to tell process "${appName}" to get name of every menu bar item of menu bar 1`;
      else
        script = `tell application "System Events" to tell process "${appName}" to get entire contents of window 1`;

      const result = await runAppleScript(script);
      return { status: "success", appName, elements: result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const setVolume = new FunctionTool({
  name: "set_volume",
  description: "Set the system volume (0-100) or mute/unmute.",
  parameters: z.object({
    level: z.number().min(0).max(100).optional().describe("Volume level 0-100"),
    mute: z.boolean().optional().describe("Mute or unmute"),
  }),
  execute: async ({ level, mute }) => {
    try {
      if (mute === true)
        await runAppleScript("set volume with output muted");
      else if (mute === false)
        await runAppleScript("set volume without output muted");

      if (level !== undefined)
        await runAppleScript(`set volume output volume ${level}`);

      return { status: "success", message: "Volume updated" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const computerTools = [
  openApplication,
  getFrontmostApp,
  listRunningApps,
  clickAtPosition,
  typeText,
  pressKey,
  takeScreenshot,
  runAppleScriptTool,
  getUIElements,
  setVolume,
];
