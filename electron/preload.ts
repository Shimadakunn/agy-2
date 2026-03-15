import { ipcRenderer, contextBridge } from "electron";

contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...rest) => listener(event, ...rest));
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...rest] = args;
    return ipcRenderer.off(channel, ...rest);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...rest] = args;
    return ipcRenderer.send(channel, ...rest);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...rest] = args;
    return ipcRenderer.invoke(channel, ...rest);
  },
});

contextBridge.exposeInMainWorld("chatBridge", {
  sendMessage: (tabId: string, text: string, files?: { name: string; mimeType: string; data: string }[]) =>
    ipcRenderer.send("chat:user-message", tabId, text, files),
  closeTab: (tabId: string) => ipcRenderer.send("chat:close-tab", tabId),
  setPinned: (pinned: boolean) => ipcRenderer.invoke("window:set-pinned", pinned),
  onBotMessage: (callback: (data: { id: string; text: string; timestamp: number; tabId: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; text: string; timestamp: number; tabId: string }) => callback(data);
    ipcRenderer.on("chat:bot-message", handler);
    return () => ipcRenderer.off("chat:bot-message", handler);
  },
  onBotEdit: (callback: (data: { id: string; text: string; timestamp: number; tabId: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; text: string; timestamp: number; tabId: string }) => callback(data);
    ipcRenderer.on("chat:bot-edit", handler);
    return () => ipcRenderer.off("chat:bot-edit", handler);
  },
  onBotTyping: (callback: (data: { tabId: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { tabId: string }) => callback(data);
    ipcRenderer.on("chat:bot-typing", handler);
    return () => ipcRenderer.off("chat:bot-typing", handler);
  },
  getAuthStatus: (): Promise<boolean> => ipcRenderer.invoke("auth:status"),
  connect: (): Promise<boolean> => ipcRenderer.invoke("auth:connect"),
  disconnect: (): Promise<void> => ipcRenderer.invoke("auth:disconnect"),
  onAuthChanged: (callback: (connected: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, connected: boolean) => callback(connected);
    ipcRenderer.on("auth:changed", handler);
    return () => ipcRenderer.off("auth:changed", handler);
  },
  requestMicPermission: (): Promise<boolean> => ipcRenderer.invoke("voice:request-mic-permission"),
  transcribeAudio: (audioBase64: string, mimeType: string): Promise<{ text?: string; error?: string }> =>
    ipcRenderer.invoke("voice:transcribe", audioBase64, mimeType),
  showOverlay: (tabIndex: number, tabLabel: string) =>
    ipcRenderer.send("overlay:show", tabIndex, tabLabel),
  hideOverlay: () => ipcRenderer.send("overlay:hide"),
  updateOverlay: (tabIndex: number, tabLabel: string, isTranscribing: boolean) =>
    ipcRenderer.send("overlay:update", tabIndex, tabLabel, isTranscribing),
  loadConversations: (): Promise<{ id: string; label: string; createdAt: number; updatedAt: number; browserTabs?: { url: string; title: string }[] }[]> =>
    ipcRenderer.invoke("db:load-conversations"),
  getChatBrowserTabs: (chatId: string): Promise<{ index: number; url: string; title: string; active: boolean }[]> =>
    ipcRenderer.invoke("browser:chat-tabs", chatId),
  loadMessages: (tabId: string): Promise<{ id: string; text: string; author: "user" | "bot"; timestamp: number; files?: { name: string; mimeType: string }[] }[]> =>
    ipcRenderer.invoke("db:load-messages", tabId),
  saveConversation: (tabId: string, label: string) =>
    ipcRenderer.send("chat:save-conversation", tabId, label),
  getUserEmail: (): Promise<string | null> =>
    ipcRenderer.invoke("db:get-user-email"),
});
