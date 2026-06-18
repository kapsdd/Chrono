const { app, BrowserWindow, ipcMain, shell } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

// ---- Supabase Discord OAuth (loopback) ------------------------------------
// Auth is owned by Supabase: it holds the Discord app credentials and issues the
// session that RLS keys every project/task row to. Here we just open Supabase's
// authorize URL in the system browser and capture the PKCE `code` it sends back
// to the fixed loopback redirect. The renderer exchanges the code for a session.
//
// Register this exact URL under Supabase → Auth → URL Configuration → Redirect
// URLs:  http://127.0.0.1:53117/auth/callback
const AUTH_PORT = 53117;
const AUTH_PATH = "/auth/callback";

function captureAuthCode(authUrl) {
  if (!authUrl) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      try {
        server.close();
      } catch {}
      resolve(v);
    };

    const server = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${AUTH_PORT}`);
      if (u.pathname !== AUTH_PATH) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<html><body style='background:#1a0f2e;color:#e9cf8c;font-family:sans-serif;text-align:center;padding-top:20vh'><h2>CHRONO</h2><p>Вход выполнен — можно вернуться в приложение.</p></body></html>",
      );
      done(u.searchParams.get("code"));
    });

    server.on("error", () => done(null));
    server.listen(AUTH_PORT, "127.0.0.1", () => {
      shell.openExternal(authUrl);
    });
    setTimeout(() => done(null), 120000); // give up after 2 min
  });
}

// The Next.js static export lives in ../out. Next emits absolute asset paths
// (/_next/...), which file:// can't resolve — so serve out/ over loopback http.
const OUT_DIR = path.join(__dirname, "..", "out");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

function resolveFile(urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  let filePath = path.join(OUT_DIR, rel);
  // Keep resolved paths inside OUT_DIR (block ../ traversal).
  if (!filePath.startsWith(OUT_DIR)) return path.join(OUT_DIR, "index.html");
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  } else if (!fs.existsSync(filePath) && fs.existsSync(filePath + ".html")) {
    filePath += ".html";
  } else if (!fs.existsSync(filePath)) {
    filePath = path.join(OUT_DIR, "index.html");
  }
  return filePath;
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const filePath = resolveFile(req.url);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.on("error", reject);
    // Fixed port → stable origin (http://127.0.0.1:53110) across launches. This
    // is essential: localStorage (Supabase session, theme, offline cache, write
    // queue) is partitioned by origin, so a random port would wipe everything —
    // including the login — on every restart.
    server.listen(APP_PORT, "127.0.0.1", () => resolve(APP_PORT));
  });
}

// Stable app-server port (distinct from the 53117 OAuth-callback port).
const APP_PORT = 53110;

// App icon (okno/icon.png — included in the build via electron-builder `files`).
// Resolves in dev and inside the asar; the exe/installer icon is set separately
// via electron-builder's win.icon.
const ICON_PATH = path.join(__dirname, "..", "okno", "icon.png");

async function createWindow() {
  const port = await startServer();
  const win = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    autoHideMenuBar: true,
    icon: ICON_PATH,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.once("ready-to-show", () => win.show());
  win.loadURL(`http://127.0.0.1:${port}/`);

  // Desktop chrome, applied from the main process so it never depends on the
  // preload running inside the asar bundle: kill the purple wallpaper and the
  // gap so only the rounded glass pane shows over a transparent window.
  win.webContents.on("did-finish-load", () => {
    win.webContents.insertCSS(
      "html,body{background:transparent !important;}" +
        ".chrono-frame{padding:0 !important;}" +
        ".is-max .app-window{border-radius:0 !important;border:0 !important;}",
    );
    applyMaxClass();
  });

  const applyMaxClass = () => {
    const on = win.isMaximized() || win.isFullScreen();
    win.webContents
      .executeJavaScript(
        `document.documentElement.classList.toggle('is-max', ${on});`,
      )
      .catch(() => {});
  };
  win.on("maximize", applyMaxClass);
  win.on("unmaximize", applyMaxClass);
  win.on("enter-full-screen", applyMaxClass);
  win.on("leave-full-screen", applyMaxClass);

}

function registerIpc() {
  const focused = () => BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  ipcMain.on("win:minimize", () => focused()?.minimize());
  ipcMain.on("win:toggle-maximize", () => {
    const w = focused();
    if (w) (w.isMaximized() ? w.unmaximize() : w.maximize());
  });
  ipcMain.on("win:close", () => focused()?.close());
  ipcMain.handle("discord:authCode", (_e, authUrl) => captureAuthCode(authUrl));
}

// Single-instance lock: a second launch just focuses the existing window. This
// also guarantees the fixed APP_PORT can't collide with our own process.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    createWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
