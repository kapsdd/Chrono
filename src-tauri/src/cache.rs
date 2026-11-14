//! Local snapshot cache on disk.
//!
//! Replaces the old `localStorage` cache with a real file store owned by the
//! Rust process, so the app opens instantly and keeps working offline.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Owner ids are Firebase UIDs; reject anything that could escape the cache dir.
fn safe_owner(owner: &str) -> Result<&str, String> {
    if owner.is_empty() || owner.len() > 128 {
        return Err("invalid owner id".into());
    }
    if !owner
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
    {
        return Err("invalid owner id".into());
    }
    Ok(owner)
}

fn cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("cache");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn cache_file(app: &AppHandle, owner: &str) -> Result<PathBuf, String> {
    let owner = safe_owner(owner)?;
    Ok(cache_dir(app)?.join(format!("{owner}.json")))
}

pub fn read(app: &AppHandle, owner: &str) -> Result<Option<Value>, String> {
    let path = cache_file(app, owner)?;
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw)
            .map(Some)
            .map_err(|e| e.to_string()),
        Err(_) => Ok(None),
    }
}

pub fn write(app: &AppHandle, owner: &str, snapshot: &Value) -> Result<(), String> {
    let path = cache_file(app, owner)?;
    let tmp = path.with_extension("json.tmp");
    let body = serde_json::to_string(snapshot).map_err(|e| e.to_string())?;
    fs::write(&tmp, body).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn clear(app: &AppHandle, owner: &str) -> Result<(), String> {
    let path = cache_file(app, owner)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
