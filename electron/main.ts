import { app, BrowserWindow, ipcMain, systemPreferences } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { Chat } from "chat";
import { createMemoryState } from "@chat-adapter/state-memory";
import {
  LlmAgent,
  InMemoryRunner,
  isFinalResponse,
  stringifyContent,
} from "@google/adk";
import { GoogleGenAI } from "@google/genai";
import { LocalAdapter } from "./local-adapter";
import { gwsTools } from "./tools/gws";
import { computerTools } from "./tools/computer";
import { loadStoredToken, startOAuthFlow, disconnect, isConnected } from "./auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

dotenv.config({ path: path.join(process.env.APP_ROOT, ".env") });

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

const localAdapter = new LocalAdapter("Agy");

const bot = new Chat({
  userName: "Agy",
  adapters: { local: localAdapter },
  state: createMemoryState(),
  logger: "debug",
});

const agent = new LlmAgent({
  name: "agy",
  model: "gemini-2.5-flash",
  instruction: `You are Agy, a next-generation personal AI assistant that can control the user's Mac computer. You help users manage their Google Workspace, control their browser, AND interact with native macOS applications.

## Core Principles
- Be concise and clear. Use markdown formatting.
- You have full computer control: you can open apps, click, type, press keyboard shortcuts, take screenshots, and inspect UI elements.
- For email drafts: create via Gmail API, then navigate to drafts for review.
- For calendar events: create them and navigate to the event link.
- When a Google API tool returns an auth error, tell the user to click the Connect button.
- Use computer control tools for ALL interactions: apps, browser, desktop.

## Computer Control Strategy
When asked to interact with the computer:
1. First use get_frontmost_app or list_running_apps to understand the current state
2. Use open_application to launch apps if needed (this works for browsers too: 'Safari', 'Google Chrome', 'Firefox', etc.)
3. Use get_ui_elements to discover clickable buttons, text fields, menus
4. Use type_text for text input, press_key for shortcuts, click_at_position for clicking
5. Use take_screenshot to verify the result if needed
6. For complex multi-step tasks, use run_applescript for powerful macOS automation

## Browser Interaction via Computer Control
When asked to browse the web, search, or interact with websites:
1. Use open_application to open the user's default browser (try 'Safari' first, or the browser they specify)
2. Use press_key("command+l") to focus the address bar
3. Use type_text to type the URL or search query
4. Use press_key("return") to navigate
5. Wait briefly, then use get_ui_elements or take_screenshot to see what loaded
6. Use click_at_position to click links, buttons, etc.
7. Use run_applescript for more complex browser automation like:
   - Getting the current URL: tell application "Safari" to get URL of current tab of window 1
   - Getting page content: tell application "Safari" to get text of current tab of window 1

## Draft-then-Preview Pattern
When the user asks to write/draft/compose an email:
1. Use create_email_draft to create the draft via Gmail API
2. Use open_application to open Safari/Chrome and navigate to Gmail drafts
3. Tell the user the draft is ready for review

## Examples of what you can do
- "Open Spotify and play my liked songs" → open_application + AppleScript
- "Switch to VS Code and open the terminal" → open_application + press_key("command+\`")
- "Take a screenshot" → take_screenshot
- "Close the current window" → press_key("command+w")
- "Set volume to 50%" → set_volume
- "What apps are running?" → list_running_apps
- "Search for X on Google" → open_application("Safari") + press_key("command+l") + type_text("X") + press_key("return")
- "Go to youtube.com" → open_application("Safari") + press_key("command+l") + type_text("youtube.com") + press_key("return")`,
  tools: [...gwsTools, ...computerTools],
});

const runner = new InMemoryRunner({ agent, appName: "agy" });

const sessionIds = new Map<string, string>();

async function askAgent(userId: string, text: string): Promise<string> {
  let sessionId = sessionIds.get(userId);
  if (!sessionId) {
    const session = await runner.sessionService.createSession({
      appName: "agy",
      userId,
    });
    sessionId = session.id;
    sessionIds.set(userId, sessionId);
  }

  const parts: string[] = [];
  for await (const event of runner.runAsync({
    userId,
    sessionId,
    newMessage: { role: "user", parts: [{ text }] },
  })) {
    if (isFinalResponse(event)) {
      const content = stringifyContent(event);
      if (content) parts.push(content);
    }
  }

  return parts.join("") || "Sorry, I couldn't generate a response.";
}

bot.onNewMention(async (thread, message) => {
  await thread.subscribe();
  const response = await askAgent("default", message.text);
  await thread.post(response);
});

bot.onSubscribedMessage(async (thread, message) => {
  if (message.author.isBot) return;
  const response = await askAgent("default", message.text);
  await thread.post(response);
});

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 700,
    minWidth: 360,
    minHeight: 500,
    icon: path.join(process.env.VITE_PUBLIC!, "electron-vite.svg"),
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });
  win.setContentProtection(true);
  // Forward bot messages to the renderer
  localAdapter.events.on("bot-message", (data) => {
    win?.webContents.send("chat:bot-message", data);
  });

  localAdapter.events.on("bot-edit", (data) => {
    win?.webContents.send("chat:bot-edit", data);
  });

  localAdapter.events.on("bot-typing", () => {
    win?.webContents.send("chat:bot-typing");
  });

  // Handle user messages from the renderer
  ipcMain.on("chat:user-message", (_event, text: string) => {
    localAdapter.injectUserMessage(text);
  });

  // Pin window (always on top)
  ipcMain.handle("window:set-pinned", (_event, pinned: boolean) => {
    win?.setAlwaysOnTop(pinned, "floating");
    return pinned;
  });

  // Google OAuth
  ipcMain.handle("auth:status", () => isConnected());
  ipcMain.handle("auth:connect", async () => {
    const success = await startOAuthFlow();
    if (success) win?.webContents.send("auth:changed", true);
    return success;
  });
  ipcMain.handle("auth:disconnect", () => {
    disconnect();
    win?.webContents.send("auth:changed", false);
  });

  // Microphone permission for voice input
  ipcMain.handle("voice:request-mic-permission", async () => {
    if (process.platform === "darwin") {
      const status = systemPreferences.getMediaAccessStatus("microphone");
      if (status === "granted") return true;
      return systemPreferences.askForMediaAccess("microphone");
    }
    return true;
  });

  // Transcribe audio using Gemini
  ipcMain.handle("voice:transcribe", async (_event, audioBase64: string, mimeType: string) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
      if (!apiKey) return { error: "No Gemini API key configured" };

      const genai = new GoogleGenAI({ apiKey });
      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: audioBase64 } },
              { text: "Transcribe this audio exactly. Return only the transcription text, nothing else. No quotes, no prefixes, no explanations." },
            ],
          },
        ],
      });

      const text = response.text?.trim();
      return text ? { text } : { error: "No transcription produced" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  });

  if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(RENDERER_DIST, "index.html"));
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.whenReady().then(async () => {
  await loadStoredToken();
  await bot.initialize();
  createWindow();
});
