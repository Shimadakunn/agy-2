"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...rest) => listener(event, ...rest));
  },
  off(...args) {
    const [channel, ...rest] = args;
    return electron.ipcRenderer.off(channel, ...rest);
  },
  send(...args) {
    const [channel, ...rest] = args;
    return electron.ipcRenderer.send(channel, ...rest);
  },
  invoke(...args) {
    const [channel, ...rest] = args;
    return electron.ipcRenderer.invoke(channel, ...rest);
  }
});
electron.contextBridge.exposeInMainWorld("chatBridge", {
  sendMessage: (text) => electron.ipcRenderer.send("chat:user-message", text),
  setPinned: (pinned) => electron.ipcRenderer.invoke("window:set-pinned", pinned),
  onBotMessage: (callback) => {
    const handler = (_event, data) => callback(data);
    electron.ipcRenderer.on("chat:bot-message", handler);
    return () => electron.ipcRenderer.off("chat:bot-message", handler);
  },
  onBotEdit: (callback) => {
    const handler = (_event, data) => callback(data);
    electron.ipcRenderer.on("chat:bot-edit", handler);
    return () => electron.ipcRenderer.off("chat:bot-edit", handler);
  },
  onBotTyping: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("chat:bot-typing", handler);
    return () => electron.ipcRenderer.off("chat:bot-typing", handler);
  }
});
