//! Google OAuth through the system browser with a loopback redirect.
//!
//! Port of the old Electron main-process flow: open Google sign-in in the
//! user's default browser, capture the auth code on a local loopback server,
//! exchange it for tokens, and hand the ID token back to the renderer for
//! Firebase `signInWithCredential`.
//!
//! Register this redirect URI in Google Cloud Console → Credentials:
//!   `http://127.0.0.1:53117/auth/callback`

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::RngCore;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::time::{Duration, Instant};

pub const AUTH_PORT: u16 = 53117;
pub const AUTH_PATH: &str = "/auth/callback";

const DEFAULT_GOOGLE_CLIENT_ID: &str =
    "514930791311-7segq89uui29nbpk3ihr6ftue48e7m84.apps.googleusercontent.com";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleAuthResult {
    pub id_token: Option<String>,
    pub error: Option<String>,
}

fn client_id() -> String {
    std::env::var("GOOGLE_CLIENT_ID").unwrap_or_else(|_| DEFAULT_GOOGLE_CLIENT_ID.to_string())
}

fn client_secret() -> Option<String> {
    // Runtime .env wins (dev), otherwise the value baked in at build time.
    std::env::var("GOOGLE_CLIENT_SECRET")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| option_env!("GOOGLE_CLIENT_SECRET").map(str::to_string))
}

fn redirect_uri() -> String {
    format!("http://127.0.0.1:{AUTH_PORT}{AUTH_PATH}")
}

fn generate_code_verifier() -> String {
    let mut buf = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut buf);
    URL_SAFE_NO_PAD.encode(buf)
}

fn sha256_base64url(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn google_auth_url(code_challenge: &str) -> String {
    let cid = client_id();
    let redir = redirect_uri();
    let params: [(&str, &str); 7] = [
        ("client_id", &cid),
        ("redirect_uri", &redir),
        ("response_type", "code"),
        ("scope", "openid email profile"),
        ("code_challenge", code_challenge),
        ("code_challenge_method", "S256"),
        ("prompt", "select_account"),
    ];
    let query: Vec<String> = params
        .iter()
        .map(|(k, v)| format!("{k}={}", urlencode(v)))
        .collect();
    format!(
        "https://accounts.google.com/o/oauth2/v2/auth?{}",
        query.join("&")
    )
}

fn urlencode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for b in value.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

fn exchange_code_for_tokens(code: &str, code_verifier: &str) -> Result<serde_json::Value, String> {
    let cid = client_id();
    let redir = redirect_uri();
    // Desktop clients using PKCE don't need the client secret — Google treats
    // it as public information for installed apps. It is only sent when one is
    // actually configured (e.g. via .env) so the packaged build works as-is.
    let secret = client_secret();
    let mut pairs: Vec<(&str, &str)> = vec![
        ("code", code),
        ("client_id", &cid),
        ("redirect_uri", &redir),
        ("grant_type", "authorization_code"),
        ("code_verifier", code_verifier),
    ];
    if let Some(ref s) = secret {
        pairs.push(("client_secret", s));
    }
    let body = pairs
        .iter()
        .map(|(k, v)| format!("{k}={}", urlencode(v)))
        .collect::<Vec<_>>()
        .join("&");

    let resp = ureq::post("https://oauth2.googleapis.com/token")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .timeout(Duration::from_secs(30))
        .send_string(&body)
        .map_err(|e| e.to_string())?;

    let parsed: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
    if let Some(err) = parsed.get("error") {
        let msg = parsed
            .get("error_description")
            .and_then(|d| d.as_str())
            .or_else(|| err.as_str())
            .unwrap_or("token exchange failed")
            .to_string();
        return Err(msg);
    }
    Ok(parsed)
}

fn html_page(title: &str, body: &str) -> String {
    format!(
        "<html><body style='background:#1a0f2e;color:#e9cf8c;font-family:sans-serif;text-align:center;padding-top:20vh'><h2>{title}</h2><p>{body}</p></body></html>"
    )
}

fn respond(request: tiny_http::Request, page: &str) {
    let header = tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..])
        .expect("valid header");
    let response = tiny_http::Response::from_string(page).with_header(header);
    let _ = request.respond(response);
}

/// Run the whole loopback flow, blocking until the browser round-trips or the
/// timeout elapses.
pub fn capture_google_auth() -> GoogleAuthResult {
    if client_secret().is_none() {
        return GoogleAuthResult {
            id_token: None,
            error: Some(
                "Вход через Google не настроен: отсутствует GOOGLE_CLIENT_SECRET. \
                 Соберите приложение с секретом в окружении (см. scripts/build-release.ps1)."
                    .into(),
            ),
        };
    }

    let code_verifier = generate_code_verifier();
    let code_challenge = sha256_base64url(&code_verifier);

    let server = match tiny_http::Server::http(("127.0.0.1", AUTH_PORT)) {
        Ok(s) => s,
        Err(e) => {
            return GoogleAuthResult {
                id_token: None,
                error: Some(format!("server error: {e}")),
            }
        }
    };

    if let Err(e) = open::that_detached(google_auth_url(&code_challenge)) {
        return GoogleAuthResult {
            id_token: None,
            error: Some(format!("failed to open browser: {e}")),
        };
    }

    let deadline = Instant::now() + Duration::from_secs(120);
    loop {
        let now = Instant::now();
        if now >= deadline {
            return GoogleAuthResult {
                id_token: None,
                error: Some("timeout".into()),
            };
        }
        let remaining = deadline - now;

        match server.recv_timeout(remaining) {
            Ok(Some(request)) => {
                let url = request.url().to_string();
                let parsed = parse_url(&url);

                if parsed.path != AUTH_PATH {
                    let _ = request.respond(tiny_http::Response::empty(404));
                    continue;
                }

                let code = parsed.param("code");
                let error = parsed.param("error");

                let (page, result) = match (code, error) {
                    (_, Some(err)) => (
                        html_page("CHRONO", "Авторизация отменена."),
                        GoogleAuthResult {
                            id_token: None,
                            error: Some(err),
                        },
                    ),
                    (Some(code), None) => match exchange_code_for_tokens(&code, &code_verifier) {
                        Ok(tokens) => {
                            let id_token = tokens
                                .get("id_token")
                                .and_then(|t| t.as_str())
                                .map(|s| s.to_string());
                            let page = html_page(
                                "CHRONO",
                                "Вход выполнен — можно вернуться в приложение.",
                            );
                            if id_token.is_some() {
                                (page, GoogleAuthResult { id_token, error: None })
                            } else {
                                (
                                    html_page("CHRONO", "Ошибка авторизации."),
                                    GoogleAuthResult {
                                        id_token: None,
                                        error: Some("no id_token in response".into()),
                                    },
                                )
                            }
                        }
                        Err(e) => (
                            html_page("CHRONO", "Ошибка авторизации."),
                            GoogleAuthResult {
                                id_token: None,
                                error: Some(e),
                            },
                        ),
                    },
                    (None, None) => (
                        html_page("CHRONO", "Авторизация отменена."),
                        GoogleAuthResult {
                            id_token: None,
                            error: Some("no code".into()),
                        },
                    ),
                };

                respond(request, &page);
                return result;
            }
            Ok(None) => continue,
            Err(_) => {
                return GoogleAuthResult {
                    id_token: None,
                    error: Some("server error".into()),
                }
            }
        }
    }
}

struct ParsedUrl {
    path: String,
    params: Vec<(String, String)>,
}

impl ParsedUrl {
    fn param(&self, key: &str) -> Option<String> {
        self.params
            .iter()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.clone())
    }
}

fn parse_url(url: &str) -> ParsedUrl {
    let (path, query) = match url.split_once('?') {
        Some((p, q)) => (p, q),
        None => (url, ""),
    };
    let params = query
        .split('&')
        .filter(|s| !s.is_empty())
        .filter_map(|pair| {
            let (k, v) = pair.split_once('=')?;
            Some((urldecode(k), urldecode(v)))
        })
        .collect();
    ParsedUrl {
        path: path.to_string(),
        params,
    }
}

fn urldecode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 3 <= bytes.len() => {
                if let Ok(b) = u8::from_str_radix(&value[i + 1..i + 3], 16) {
                    out.push(b);
                    i += 3;
                } else {
                    out.push(bytes[i]);
                    i += 1;
                }
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}
