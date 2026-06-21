const { app, BrowserWindow, ipcMain, shell } = require("electron");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Load .env from project root (dev) or app root (packaged)
try {
  const baseDir = app.isPackaged
    ? path.dirname(app.getPath("exe"))
    : path.join(__dirname, "..");
  const envPath = path.join(baseDir, ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch {}

// ---- Google OAuth (system browser loopback) --------------------------------
// Opens Google sign-in in the user's default browser, captures the auth code
// on a local loopback server, exchanges it for tokens, and returns the ID
// token to the renderer for Firebase signInWithCredential.
//
// Register this redirect URI in Google Cloud Console → Credentials:
//   http://127.0.0.1:53117/auth/callback
const AUTH_PORT = 53117;
const AUTH_PATH = "/auth/callback";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = `http://127.0.0.1:${AUTH_PORT}${AUTH_PATH}`;

function googleAuthUrl(codeChallenge) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function generateCodeVerifier() {
  const buf = crypto.randomBytes(32);
  return buf.toString("base64url");
}

function sha256Base64Url(str) {
  return crypto.createHash("sha256").update(str).digest("base64url");
}

function exchangeCodeForTokens(code, codeVerifier) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    });

    const req = https.request("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Failed to parse token response"));
        }
      });
    });
    req.on("error", reject);
    req.write(body.toString());
    req.end();
  });
}

function captureGoogleAuth() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      try { server.close(); } catch {}
      resolve(v);
    };

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = sha256Base64Url(codeVerifier);

    const server = http.createServer(async (req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${AUTH_PORT}`);
      if (u.pathname !== AUTH_PATH) {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = u.searchParams.get("code");
      const error = u.searchParams.get("error");

      if (error || !code) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<html><body style='background:#1a0f2e;color:#e9cf8c;font-family:sans-serif;text-align:center;padding-top:20vh'><h2>CHRONO</h2><p>Авторизация отменена.</p></body></html>");
        done({ idToken: null, error: error || "no code" });
        return;
      }

      try {
        const tokens = await exchangeCodeForTokens(code, codeVerifier);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<html><body style='background:#1a0f2e;color:#e9cf8c;font-family:sans-serif;text-align:center;padding-top:20vh'><h2>CHRONO</h2><p>Вход выполнен — можно вернуться в приложение.</p></body></html>");
        done({ idToken: tokens.id_token, error: null });
      } catch (e) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<html><body style='background:#1a0f2e;color:#e9cf8c;font-family:sans-serif;text-align:center;padding-top:20vh'><h2>CHRONO</h2><p>Ошибка авторизации.</p></body></html>");
        done({ idToken: null, error: e.message });
      }
    });

    server.on("error", () => done({ idToken: null, error: "server error" }));
    server.listen(AUTH_PORT, "127.0.0.1", () => {
      shell.openExternal(googleAuthUrl(codeChallenge));
    });
    setTimeout(() => done({ idToken: null, error: "timeout" }), 120000);
  });
}

// ---- App HTTP server (static files from out/) ------------------------------
function resolveFile(urlPath) {
  let filePath = path.join(__dirname, "..", "out", decodeURIComponent(urlPath.split("?")[0]));
  if (!filePath.startsWith(path.join(__dirname, "..", "out"))) return path.join(__dirname, "..", "out", "index.html");
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  } else if (!fs.existsSync(filePath) && fs.existsSync(filePath + ".html")) {
    filePath += ".html";
  } else if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, "..", "out", "index.html");
  }
  return filePath;
}

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};

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
    server.listen(APP_PORT, "127.0.0.1", () => resolve(APP_PORT));
  });
}

const APP_PORT = 53110;

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
  ipcMain.handle("google:signIn", () => captureGoogleAuth());
}

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
