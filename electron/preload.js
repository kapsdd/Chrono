const { contextBridge, ipcRenderer } = require("electron");

// Exposed only inside the Electron shell. The web build won't have window.chrono,
// so UI can feature-detect it to show window controls only in the desktop app.
contextBridge.exposeInMainWorld("chrono", {
  isDesktop: true,
  minimize: () => ipcRenderer.send("win:minimize"),
  toggleMaximize: () => ipcRenderer.send("win:toggle-maximize"),
  close: () => ipcRenderer.send("win:close"),
  // Opens the Supabase Discord auth URL in the system browser and resolves the
  // OAuth `code` captured on the loopback redirect (null on cancel/timeout).
  // The renderer exchanges it for a Supabase session via PKCE.
  discordAuthCode: (authUrl) => ipcRenderer.invoke("discord:authCode", authUrl),
});

// Mark the document so desktop-only CSS (transparent backdrop) can apply,
// leaving the browser build's purple wallpaper untouched.
window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("is-desktop");
});
