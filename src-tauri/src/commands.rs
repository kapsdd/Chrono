//! Tauri command surface: window controls, Google auth and the Rust core
//! domain logic (smart input, task tree, kanban, iCal, crypto) plus the local
//! snapshot cache.

use crate::{cache, oauth};
use chrono_core::{KanbanColumn, ParsedInput, Task, TaskNode};
use serde_json::Value;
use tauri::{AppHandle, Manager, WebviewWindow};

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())
}

// ---- window controls -------------------------------------------------------

#[tauri::command]
pub fn minimize_window(app: AppHandle) -> Result<(), String> {
    main_window(&app)?.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_maximize_window(app: AppHandle) -> Result<(), String> {
    let win = main_window(&app)?;
    if win.is_maximized().map_err(|e| e.to_string())? {
        win.unmaximize().map_err(|e| e.to_string())
    } else {
        win.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn close_window(app: AppHandle) -> Result<(), String> {
    main_window(&app)?.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn is_window_maximized(app: AppHandle) -> Result<bool, String> {
    main_window(&app)?.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("only http(s) urls may be opened".into());
    }
    open::that_detached(url).map_err(|e| e.to_string())
}

// ---- auth ------------------------------------------------------------------

/// Blocking loopback OAuth; runs on the blocking pool so the UI keeps painting.
#[tauri::command]
pub async fn google_sign_in() -> GoogleAuthResult {
    tauri::async_runtime::spawn_blocking(oauth::capture_google_auth)
        .await
        .unwrap_or(oauth::GoogleAuthResult {
            id_token: None,
            error: Some("auth task failed".into()),
        })
}

// re-export so the generated command glue can name the type
pub use oauth::GoogleAuthResult;

// ---- core domain logic -----------------------------------------------------

#[tauri::command]
pub fn parse_input(raw: String) -> ParsedInput {
    chrono_core::parse_input(&raw)
}

#[tauri::command]
pub fn build_tree(tasks: Vec<Task>) -> Vec<TaskNode> {
    chrono_core::build_tree(&tasks)
}

#[tauri::command]
pub fn normalize_kanban_columns(columns: Option<Vec<KanbanColumn>>) -> Vec<KanbanColumn> {
    chrono_core::normalize_kanban_columns(columns.as_deref())
}

#[tauri::command]
pub fn build_ics(tasks: Vec<Task>, stamp: String) -> String {
    chrono_core::build_ics_at(&tasks, &stamp)
}

#[tauri::command]
pub fn hash_password(password: String) -> String {
    chrono_core::hash_password(&password)
}

#[tauri::command]
pub fn verify_password(password: String, stored: String) -> bool {
    chrono_core::verify_password(&password, &stored)
}

// ---- local cache -----------------------------------------------------------

#[tauri::command]
pub fn read_cache(app: AppHandle, owner: String) -> Result<Option<Value>, String> {
    cache::read(&app, &owner)
}

#[tauri::command]
pub fn write_cache(app: AppHandle, owner: String, snapshot: Value) -> Result<(), String> {
    cache::write(&app, &owner, &snapshot)
}

#[tauri::command]
pub fn clear_cache(app: AppHandle, owner: String) -> Result<(), String> {
    cache::clear(&app, &owner)
}
