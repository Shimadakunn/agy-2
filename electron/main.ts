import { app, BrowserWindow, ipcMain } from "electron";
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
import { LocalAdapter } from "./local-adapter";
import { gwsTools } from "./tools/gws";
import { browserTools } from "./tools/browser";

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
  instruction: `You are Agy, a personal productivity assistant. You help users manage their Google Workspace (Gmail, Calendar, Drive, Sheets) and browse the web.

## Core Principles
- Be concise and clear. Use markdown formatting.
- For email drafts: create the draft via the API tool, then open Gmail drafts in the user's browser so they can review and send manually. Never send emails directly.
- For calendar events: create them and open the event link in the browser.
- When a tool returns an error about authentication, tell the user they need to run "gws auth login" in their terminal first.

## Draft-then-Preview Pattern
When the user asks to write/draft/compose an email:
1. Use create_email_draft to create the draft via Gmail API
2. Use open_in_browser to open "https://mail.google.com/mail/u/0/#drafts" so the user sees their draft
3. Tell the user the draft is ready for review in Gmail`,
  tools: [...gwsTools, ...browserTools],
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
  await bot.initialize();
  createWindow();
});
