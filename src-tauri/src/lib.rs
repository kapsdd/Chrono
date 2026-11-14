mod cache;
mod commands;
mod env;
mod oauth;

use tauri::{Manager, WebviewWindowBuilder, WebviewUrl};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env::load_dotenv();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            commands::minimize_window,
            commands::toggle_maximize_window,
            commands::close_window,
            commands::is_window_maximized,
            commands::open_external,
            commands::google_sign_in,
            commands::parse_input,
            commands::build_tree,
            commands::normalize_kanban_columns,
            commands::build_ics,
            commands::hash_password,
            commands::verify_password,
            commands::read_cache,
            commands::write_cache,
            commands::clear_cache,
        ])
        .setup(|app| {
            // The window is built in code (not config) so Linux can opt out of
            // transparency: transparent windows are unreliable on some Linux
            // WMs, exactly like the old Electron shell.
            let mut builder = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::App("index.html".into()),
            )
            .title("CHRONO")
            .inner_size(1280.0, 832.0)
            .min_inner_size(900.0, 600.0)
            .decorations(false)
            .shadow(false)
            .resizable(true)
            .center()
            .focused(true);

            #[cfg(not(target_os = "linux"))]
            {
                builder = builder.transparent(true);
            }

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running CHRONO");
}
