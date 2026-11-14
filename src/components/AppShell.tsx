"use client";

import { useEffect, type ReactNode } from "react";
import { initDesktop } from "@/lib/desktop";

// The outer chrome: a single full-viewport glass pane floating over the
// textured backdrop. The Tauri shell makes this frame the draggable window.
export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    initDesktop();
  }, []);

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
