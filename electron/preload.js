const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chrono", {
  isDesktop: true,
  minimize: () => ipcRenderer.send("win:minimize"),
  toggleMaximize: () => ipcRenderer.send("win:toggle-maximize"),
  close: () => ipcRenderer.send("win:close"),
  googleSignIn: () => ipcRenderer.invoke("google:signIn"),
});

window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("is-desktop");
});
