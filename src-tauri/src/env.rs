use std::fs;
use std::path::PathBuf;

/// Load `.env` into the process environment, mirroring the old Electron
/// bootstrap. Existing variables always win so a real environment overrides
/// the file.
pub fn load_dotenv() {
    for base in candidate_dirs() {
        let path = base.join(".env");
        if let Ok(content) = fs::read_to_string(&path) {
            apply(&content);
            return;
        }
    }
}

fn candidate_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            dirs.push(dir.to_path_buf());
            // packaged layout: next to the resources directory
            dirs.push(dir.join("resources"));
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        dirs.push(cwd.clone());
        dirs.push(cwd.join(".."));
    }
    dirs
}

fn apply(content: &str) {
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some(eq) = line.find('=') else {
            continue;
        };
        let key = line[..eq].trim();
        let val = line[eq + 1..].trim();
        if key.is_empty() {
            continue;
        }
        if std::env::var_os(key).is_none() {
            std::env::set_var(key, val);
        }
    }
}
