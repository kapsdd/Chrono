"use client";

import { create } from "zustand";

export type Theme = "dark" | "light";

const UI_KEY = "chrono.ui";

interface PersistedUI {
  theme: Theme;
  sidebarCollapsed: boolean;
}

function load(): PersistedUI {
  const fallback: PersistedUI = { theme: "dark", sidebarCollapsed: false };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(UI_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<PersistedUI>;
    return {
      theme: p.theme === "light" ? "light" : "dark",
      sidebarCollapsed: Boolean(p.sidebarCollapsed),
    };
  } catch {
    return fallback;
  }
}

interface UIState extends PersistedUI {
  hydrated: boolean;
  hydrate: () => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
}

function save(s: PersistedUI) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
}

export const useUI = create<UIState>((set, get) => ({
  theme: "dark",
  sidebarCollapsed: false,
  hydrated: false,

  hydrate: () => {
    const ui = load();
    applyTheme(ui.theme);
    set({ ...ui, hydrated: true });
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    save({ theme, sidebarCollapsed: get().sidebarCollapsed });
  },

  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),

  toggleSidebar: () => {
    const sidebarCollapsed = !get().sidebarCollapsed;
    set({ sidebarCollapsed });
    save({ theme: get().theme, sidebarCollapsed });
  },
}));
