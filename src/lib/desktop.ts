// Desktop bridge for the Tauri shell. The Rust process owns window control,
// auth and all core logic; this module exposes them to the React tree and
// keeps the DOM flags the CSS depends on up to date.

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** True when running inside the Tauri webview (false during SSR/prerender). */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface GoogleAuthResponse {
  idToken: string | null;
  error: string | null;
}

export const desktop = {
  minimize: () => invoke<void>("minimize_window"),
  toggleMaximize: () => invoke<void>("toggle_maximize_window"),
  close: () => invoke<void>("close_window"),
  isMaximized: () => invoke<boolean>("is_window_maximized"),
  googleSignIn: () => invoke<GoogleAuthResponse>("google_sign_in"),
  openExternal: (url: string) => invoke<void>("open_external", { url }),
};

/** Wire up DOM flags and expose `window.chrono` for existing components. */
export function initDesktop(): void {
  if (!isDesktop()) return;

  document.documentElement.classList.add("is-desktop");

  // `-webkit-app-region: drag` is Electron-only; Tauri uses this attribute.
  const applyDragRegions = () => {
    document
      .querySelectorAll<HTMLElement>(".drag-region")
      .forEach((el) => el.setAttribute("data-tauri-drag-region", ""));
  };
  applyDragRegions();
  // Topbar / page content mount asynchronously.
  const observer = new MutationObserver(applyDragRegions);
  observer.observe(document.body, { childList: true, subtree: true });

  // Double-clicking the drag region maximizes/restores, like a native frame.
  document.addEventListener("dblclick", (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest(".drag-region")) {
      void desktop.toggleMaximize();
    }
  });

  // `.is-max` drops the window chrome rounding while maximized.
  const syncMax = async () => {
    try {
      const on = await desktop.isMaximized();
      document.documentElement.classList.toggle("is-max", on);
    } catch {
      /* window may be closing */
    }
  };
  void syncMax();
  void getCurrentWindow().onResized(() => void syncMax());

  window.chrono = {
    isDesktop: true,
    minimize: () => void desktop.minimize(),
    toggleMaximize: () => void desktop.toggleMaximize(),
    close: () => void desktop.close(),
    googleSignIn: () => desktop.googleSignIn(),
  };
}
