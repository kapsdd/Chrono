"use client";

import type { ReactNode } from "react";

// The outer chrome: a single full-viewport glass pane floating over the
// textured backdrop. In Tauri (Phase 2) this frame becomes the draggable window.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="chrono-frame h-screen w-screen overflow-hidden p-3">
      <div className="app-window relative h-full w-full overflow-hidden rounded-3xl shadow-neon">
        {/* top edge highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent"
        />
        {children}
      </div>
    </div>
  );
}
