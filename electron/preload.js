const { contextBridge, ipcRenderer } = require("electron");

// Exposed only inside the Electron shell. The web build won't have window.chrono,
// so UI can feature-detect it to show window controls only in the desktop app.
contextBridge.exposeInMainWorld("chrono", {
  isDesktop: true,
  minimize: () => ipcRenderer.send("win:minimize"),
  toggleMaximize: () => ipcRenderer.send("win:toggle-maximize"),
  close: () => ipcRenderer.send("win:close"),
  // Resolves a Session when Discord is configured, else null (→ guest demo).
  discordLogin: () => ipcRenderer.invoke("discord:login"),
});

// Mark the document so desktop-only CSS (transparent backdrop) can apply,
// leaving the browser build's purple wallpaper untouched.
window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("is-desktop");
});
