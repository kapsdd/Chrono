"use client";

import { create } from "zustand";

// Named themes. Each id maps to a CSS block in globals.css that retints the
// ambient wallpaper, the glass window, the primary accent gradient, scrollbar
// and selection. "light" is the one light theme (keeps the dark-on-light remap).
export type Theme =
  | "amethyst"
  | "emerald"
  | "midnight"
  | "sunset"
  | "crimson"
  | "ocean"
  | "rose"
  | "gold"
  | "graphite"
  | "light";

export interface ThemeMeta {
  id: Theme;
  label: string;
  /** Swatch gradient shown in the settings picker. */
  swatch: string;
  light?: boolean;
}

export const THEMES: ThemeMeta[] = [
  { id: "amethyst", label: "Аметист", swatch: "linear-gradient(135deg,#8b5cf6,#d946ef)" },
  { id: "emerald", label: "Изумруд", swatch: "linear-gradient(135deg,#10b981,#34d399)" },
  { id: "midnight", label: "Полночь", swatch: "linear-gradient(135deg,#1e3a8a,#0ea5e9)" },
  { id: "sunset", label: "Закат", swatch: "linear-gradient(135deg,#fb7185,#f59e0b)" },
  { id: "crimson", label: "Багровый", swatch: "linear-gradient(135deg,#ef4444,#f97316)" },
  { id: "ocean", label: "Океан", swatch: "linear-gradient(135deg,#06b6d4,#14b8a6)" },
  { id: "rose", label: "Роза", swatch: "linear-gradient(135deg,#ec4899,#f43f5e)" },
  { id: "gold", label: "Золото", swatch: "linear-gradient(135deg,#f59e0b,#eab308)" },
  { id: "graphite", label: "Графит", swatch: "linear-gradient(135deg,#64748b,#94a3b8)" },
  { id: "light", label: "Светлая", swatch: "linear-gradient(135deg,#f4f1fb,#e6e0f5)", light: true },
];

const THEME_IDS = new Set<Theme>(THEMES.map((t) => t.id));
const isLight = (t: Theme) => THEMES.find((m) => m.id === t)?.light === true;

const UI_KEY = "chrono.ui";

interface PersistedUI {
  theme: Theme;
  sidebarCollapsed: boolean;
}

// Map legacy values ("dark"/"light") onto the new named themes.
function normalizeTheme(value: unknown): Theme {
  if (value === "light") return "light";
  if (value === "dark") return "amethyst";
  return typeof value === "string" && THEME_IDS.has(value as Theme)
    ? (value as Theme)
    : "amethyst";
}

function load(): PersistedUI {
  const fallback: PersistedUI = { theme: "amethyst", sidebarCollapsed: false };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(UI_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<PersistedUI>;
    return {
      theme: normalizeTheme(p.theme),
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
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Keep the existing class-based light remap working for the light theme.
  root.classList.toggle("light", isLight(theme));
}

export const useUI = create<UIState>((set, get) => ({
  theme: "amethyst",
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

  toggleSidebar: () => {
    const sidebarCollapsed = !get().sidebarCollapsed;
    set({ sidebarCollapsed });
    save({ theme: get().theme, sidebarCollapsed });
  },
}));
