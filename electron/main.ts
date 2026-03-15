import { app, BrowserWindow, ipcMain, shell, systemPreferences } from "electron";
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
import { LocalAdapter, type AttachedFile } from "./local-adapter";
import { gwsTools } from "./tools/gws";
import { computerTools } from "./tools/computer";
import {
  getBrowserTools,
  closeBrowserToolset,
  isBrowserConnected,
  cleanupChatTabs,
  getChatTabInfo,
} from "./tools/agent-browser";
import { chatTabContext } from "./tools/tab-context";
import {
  loadStoredToken,
  startOAuthFlow,
  disconnect,
  isConnected,
  getUserEmail,
} from "./auth";
import {
  saveMessage,
  saveConversation,
  loadMessages,
  loadConversations,
  deleteConversation,
} from "./db";

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

const AGENT_INSTRUCTION = `You are Agy, a personal assistant with direct access to Google Workspace APIs.

IMPORTANT: For ANY Google Workspace operation (email, calendar, drive, docs, sheets, slides, tasks, forms, meet, contacts), ALWAYS use the "gws" tool. NEVER use the browser to interact with Google services — the gws tool is faster and more reliable.

If you don't know the exact gws command syntax, use "gws_schema" first to look up the method and its parameters.

Only use browser tools for non-Google websites or when the user explicitly asks you to interact with a webpage.

BROWSER TABS: Each chat has its own dedicated browser tabs. You can manage multiple tabs per chat:
- browser_tab_list: See your current tabs
- browser_tab_new: Open a new tab (added to your chat's tab pool)
- browser_tab_switch: Switch between your tabs
- browser_tab_close: Close a tab
Your commands (click, fill, snapshot, etc.) always target the active tab. Use browser_tab_new for multi-tab workflows.`;

let runner: InMemoryRunner | null = null;
const sessionIds = new Map<string, string>();

async function initAgent(): Promise<void> {
  const browserTools = await getBrowserTools();

  const agent = new LlmAgent({
    name: "agy",
    model: "gemini-3.1-flash-lite-preview",
    instruction: AGENT_INSTRUCTION,
    tools: [...gwsTools, ...computerTools, ...browserTools],
  });

  runner = new InMemoryRunner({ agent, appName: "agy" });
}

function isTextMimeType(mime: string): boolean {
  if (mime.startsWith("text/")) return true;
  return ["application/json", "application/xml", "application/javascript", "application/x-yaml", "application/yaml", "application/toml"].includes(mime);
}

async function askAgent(userId: string, text: string, files?: AttachedFile[]): Promise<string> {
  if (!runner) return "Agent not initialized yet. Please wait a moment.";

  return chatTabContext.run(userId, async () => {
    let sessionId = sessionIds.get(userId);
    if (!sessionId) {
      const session = await runner!.sessionService.createSession({
        appName: "agy",
        userId,
      });
      sessionId = session.id;
      sessionIds.set(userId, sessionId);
    }

    const messageParts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
    if (files?.length) {
      for (const file of files) {
        if (isTextMimeType(file.mimeType))
          messageParts.push({ text: `[File: ${file.name}]\n${Buffer.from(file.data, "base64").toString("utf-8")}` });
        else
          messageParts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
      }
    }
    if (text) messageParts.push({ text });
    if (messageParts.length === 0) messageParts.push({ text: "" });

    const responseParts: string[] = [];
    for await (const event of runner!.runAsync({
      userId,
      sessionId,
      newMessage: { role: "user", parts: messageParts },
    })) {
      if (isFinalResponse(event)) {
        const content = stringifyContent(event);
        if (content) responseParts.push(content);
      }
    }

    return responseParts.join("") || "Sorry, I couldn't generate a response.";
  });
}

bot.onNewMention(async (thread, message) => {
  await thread.subscribe();
  const tabId = thread.id.split(":")[1] || "tab-1";
  const files = localAdapter.consumeFiles(message.id);
  const response = await askAgent(tabId, message.text, files);
  await thread.post(response);
});

bot.onSubscribedMessage(async (thread, message) => {
  if (message.author.isBot) return;
  const tabId = thread.id.split(":")[1] || "tab-1";
  const files = localAdapter.consumeFiles(message.id);
  const response = await askAgent(tabId, message.text, files);
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
  // Forward bot messages to the renderer + persist to Firestore
  localAdapter.events.on("bot-message", (data) => {
    win?.webContents.send("chat:bot-message", data);
    saveMessage(data.tabId, {
      id: data.id,
      text: data.text,
      author: "bot",
      timestamp: data.timestamp,
    }).catch(() => {});
  });

  localAdapter.events.on("bot-edit", (data) => {
    win?.webContents.send("chat:bot-edit", data);
    saveMessage(data.tabId, {
      id: data.id,
      text: data.text,
      author: "bot",
      timestamp: data.timestamp,
    }).catch(() => {});
  });

  localAdapter.events.on("bot-typing", (data) => {
    win?.webContents.send("chat:bot-typing", data);
  });

  // Handle user messages from the renderer
  ipcMain.on("chat:user-message", (_event, tabId: string, text: string, files?: AttachedFile[]) => {
    localAdapter.injectUserMessage(tabId, text, files);
    // Persist user message to Firestore (fire-and-forget)
    const filesMeta = files?.map(({ name, mimeType }) => ({ name, mimeType }));
    saveMessage(tabId, {
      id: `user_${Date.now()}`,
      text,
      author: "user",
      timestamp: Date.now(),
      files: filesMeta,
    }).catch(() => {});
  });

  // Pin window (always on top)
  ipcMain.handle("window:set-pinned", (_event, pinned: boolean) => {
    win?.setAlwaysOnTop(pinned, "floating");
    return pinned;
  });

  // Browser CDP connection status
  ipcMain.handle("browser:extension-status", () => isBrowserConnected());

  // Tab lifecycle — clean up browser tabs + agent session
  ipcMain.on("chat:close-tab", (_event, tabId: string) => {
    sessionIds.delete(tabId);
    cleanupChatTabs(tabId);
    deleteConversation(tabId).catch(() => {});
  });

  // Save conversation metadata when a tab is created/renamed
  ipcMain.on("chat:save-conversation", (_event, tabId: string, label: string) => {
    saveConversation(tabId, label).catch(() => {});
  });

  // Cloud database — load persisted conversations and messages
  ipcMain.handle("db:load-conversations", () => loadConversations());
  ipcMain.handle("db:load-messages", (_event, tabId: string) => loadMessages(tabId));
  ipcMain.handle("db:get-user-email", () => getUserEmail());

  // Browser tab info per chat (for UI display)
  ipcMain.handle("browser:chat-tabs", async (_event, chatId: string) => {
    const tabs = await getChatTabInfo(chatId);
    return tabs.map((t, i) => ({ index: i, url: t.url, title: t.title || "", active: t.active }));
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
  ipcMain.handle(
    "voice:transcribe",
    async (_event, audioBase64: string, mimeType: string) => {
      try {
        const apiKey =
          process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
        if (!apiKey) return { error: "No Gemini API key configured" };

        const genai = new GoogleGenAI({ apiKey });
        const response = await genai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType, data: audioBase64 } },
                {
                  text: "Transcribe this audio exactly. Return only the transcription text, nothing else. No quotes, no prefixes, no explanations.",
                },
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
    },
  );

  // Open external links in the OS default browser instead of navigating the app window
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (VITE_DEV_SERVER_URL && url.startsWith(VITE_DEV_SERVER_URL)) return;
    if (url.startsWith("file://")) return;
    event.preventDefault();
    shell.openExternal(url);
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

app.on("before-quit", () => {
  closeBrowserToolset();
});

app.whenReady().then(async () => {
  await loadStoredToken();
  await initAgent();
  await bot.initialize();
  createWindow();
});
