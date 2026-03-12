import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Chat } from "chat";
import { createMemoryState } from "@chat-adapter/state-memory";
import { LocalAdapter } from "./local-adapter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

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

bot.onNewMention(async (thread, message) => {
  await thread.subscribe();
  await thread.post(`You said: "${message.text}"\n\nI'm **Agy**, your local chat bot powered by Chat SDK. Try sending me another message!`);
});

bot.onSubscribedMessage(async (thread, message) => {
  if (message.author.isBot) return;

  const text = message.text.toLowerCase();

  if (text === "help") {
    await thread.post("Available commands:\n- **help** — show this message\n- **time** — current time\n- **ping** — pong!\n- Or just chat with me!");
    return;
  }

  if (text === "ping") {
    await thread.post("Pong!");
    return;
  }

  if (text === "time") {
    await thread.post(`Current time: **${new Date().toLocaleTimeString()}**`);
    return;
  }

  await thread.post(`Echo: "${message.text}"`);
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

  if (VITE_DEV_SERVER_URL)
    win.loadURL(VITE_DEV_SERVER_URL);
  else
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0)
    createWindow();
});

app.whenReady().then(async () => {
  await bot.initialize();
  createWindow();
});
