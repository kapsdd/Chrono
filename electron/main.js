const { app, BrowserWindow, ipcMain, shell } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

// ---- Discord OAuth config -------------------------------------------------
// Provide credentials via env or a chrono.config.json next to the executable:
//   { "discordClientId": "...", "discordClientSecret": "..." }
// Without them, login falls back to a local guest session.
function discordConfig() {
  if (process.env.DISCORD_CLIENT_ID) {
    return { id: process.env.DISCORD_CLIENT_ID, secret: process.env.DISCORD_CLIENT_SECRET };
  }
  // Search: bundled (inside app.asar), next to the exe, then cwd. The first two
  // let credentials ship with the build; the exe-dir copy allows overriding.
  const dirs = [app.getAppPath(), path.dirname(app.getPath("exe")), process.cwd()];
  for (const dir of dirs) {
    try {
      const raw = fs.readFileSync(path.join(dir, "chrono.config.json"), "utf8");
      const j = JSON.parse(raw);
      if (j.discordClientId) return { id: j.discordClientId, secret: j.discordClientSecret };
    } catch {
      /* not present here */
    }
  }
  return { id: null, secret: null };
}

// Real Authorization-Code flow over a loopback redirect. Resolves a Session.
function discordLogin() {
  const { id, secret } = discordConfig();
  if (!id) return Promise.resolve(null); // → renderer uses guest demo

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

    const server = http.createServer(async (req, res) => {
      const u = new URL(req.url, "http://127.0.0.1");
      if (u.pathname !== "/discord/callback") {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<html><body style='background:#1a0f2e;color:#e9cf8c;font-family:sans-serif;text-align:center;padding-top:20vh'><h2>CHRONO</h2><p>Можно вернуться в приложение.</p></body></html>");
      const code = u.searchParams.get("code");
      if (!code) return done(null);
      try {
        const redirectUri = `http://127.0.0.1:${port}/discord/callback`;
        const body = new URLSearchParams({
          client_id: id,
          client_secret: secret || "",
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        });
        const tok = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        }).then((r) => r.json());
        const me = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${tok.access_token}` },
        }).then((r) => r.json());
        done({
          id: me.id,
          username: me.global_name || me.username,
          avatar: me.avatar
            ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png`
            : undefined,
          provider: "discord",
          grantedAt: new Date().toISOString(),
        });
      } catch {
        done(null);
      }
    });

    // Fixed port so a single redirect URI can be registered in Discord:
    //   http://127.0.0.1:53117/discord/callback
    const port = 53117;
    server.on("error", () => done(null));
    server.listen(port, "127.0.0.1", () => {
      const redirectUri = `http://127.0.0.1:${port}/discord/callback`;
      const authUrl =
        "https://discord.com/api/oauth2/authorize?" +
        new URLSearchParams({
          client_id: id,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "identify",
        }).toString();
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
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

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
  ipcMain.handle("discord:login", () => discordLogin());
}

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
