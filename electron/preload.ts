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
  sendMessage: (text: string) => ipcRenderer.send("chat:user-message", text),
  setPinned: (pinned: boolean) => ipcRenderer.invoke("window:set-pinned", pinned),
  onBotMessage: (callback: (data: { id: string; text: string; timestamp: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; text: string; timestamp: number }) => callback(data);
    ipcRenderer.on("chat:bot-message", handler);
    return () => ipcRenderer.off("chat:bot-message", handler);
  },
  onBotEdit: (callback: (data: { id: string; text: string; timestamp: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; text: string; timestamp: number }) => callback(data);
    ipcRenderer.on("chat:bot-edit", handler);
    return () => ipcRenderer.off("chat:bot-edit", handler);
  },
  onBotTyping: (callback: () => void) => {
    const handler = () => callback();
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
});
