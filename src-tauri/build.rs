fn main() {
    // Bake the Google OAuth client secret into the binary when it is present at
    // build time (the release script loads it from the gitignored .env). It is
    // an app identifier for a desktop client, not an account credential — see
    // `oauth.rs`. `rerun-if-env-changed` makes cargo recompile when it changes.
    if let Ok(secret) = std::env::var("GOOGLE_CLIENT_SECRET") {
        if !secret.trim().is_empty() {
            println!("cargo:rustc-env=GOOGLE_CLIENT_SECRET={secret}");
        }
    }
    println!("cargo:rerun-if-env-changed=GOOGLE_CLIENT_SECRET");

    tauri_build::build()
}
