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
  | "light"
  | "aurora"
  | "lavender"
  | "neon"
  | "forest"
  | "cherry"
  | "arctic"
  | "volcano"
  | "sakura"
  | "cyber"
  | "autumn";

export interface ThemeMeta {
  id: Theme;
  label: string;
  /** Swatch gradient shown in the settings picker. */
  swatch: string;
  light?: boolean;
}

export interface AchievementTheme {
  tasks: number;
  theme: Theme;
  label: string;
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
  { id: "aurora", label: "Аврора", swatch: "linear-gradient(135deg,#06b6d4,#8b5cf6,#10b981)" },
  { id: "lavender", label: "Лаванда", swatch: "linear-gradient(135deg,#a78baa,#e9d5ff,#f0abfc)" },
  { id: "neon", label: "Неон", swatch: "linear-gradient(135deg,#f43f5e,#06b6d4)" },
  { id: "forest", label: "Лес", swatch: "linear-gradient(135deg,#064e3b,#166534,#65a30d)" },
  { id: "cherry", label: "Вишня", swatch: "linear-gradient(135deg,#881337,#e11d48,#fb7185)" },
  { id: "arctic", label: "Арктика", swatch: "linear-gradient(135deg,#e0f2fe,#bae6fd,#7dd3fc)" },
  { id: "volcano", label: "Вулкан", swatch: "linear-gradient(135deg,#1c1917,#9a3412,#f97316)" },
  { id: "sakura", label: "Сакура", swatch: "linear-gradient(135deg,#fce7f3,#fbcfe8,#f9a8d4)" },
  { id: "cyber", label: "Кибер", swatch: "linear-gradient(135deg,#3b82f6,#d946ef)" },
  { id: "autumn", label: "Осень", swatch: "linear-gradient(135deg,#78350f,#c2410c,#eab308)" },
];

export const ACHIEVEMENT_THEMES: AchievementTheme[] = [
  { tasks: 0, theme: "amethyst", label: "Старт" },
  { tasks: 5, theme: "emerald", label: "5 задач" },
  { tasks: 15, theme: "ocean", label: "15 задач" },
  { tasks: 30, theme: "sunset", label: "30 задач" },
  { tasks: 50, theme: "gold", label: "50 задач" },
  { tasks: 100, theme: "graphite", label: "100 задач" },
];

const THEME_IDS = new Set<Theme>(THEMES.map((t) => t.id));
const isLight = (t: Theme) => THEMES.find((m) => m.id === t)?.light === true;

const UI_KEY = "chrono.ui";

interface PersistedUI {
  theme: Theme;
  sidebarCollapsed: boolean;
  achievementThemesEnabled: boolean;
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
  const fallback: PersistedUI = {
    theme: "amethyst",
    sidebarCollapsed: false,
    achievementThemesEnabled: false,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(UI_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<PersistedUI>;
    return {
      theme: normalizeTheme(p.theme),
      sidebarCollapsed: Boolean(p.sidebarCollapsed),
      achievementThemesEnabled: Boolean(p.achievementThemesEnabled),
    };
  } catch {
    return fallback;
  }
}

interface UIState extends PersistedUI {
  hydrated: boolean;
  hydrate: () => void;
  setTheme: (t: Theme) => void;
  setAchievementThemesEnabled: (enabled: boolean) => void;
  setThemeFromAchievement: (completedTasks: number) => void;
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
  achievementThemesEnabled: false,
  hydrated: false,

  hydrate: () => {
    const ui = load();
    applyTheme(ui.theme);
    set({ ...ui, hydrated: true });
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    save({
      theme,
      sidebarCollapsed: get().sidebarCollapsed,
      achievementThemesEnabled: get().achievementThemesEnabled,
    });
  },

  setAchievementThemesEnabled: (achievementThemesEnabled) => {
    set({ achievementThemesEnabled });
    save({
      theme: get().theme,
      sidebarCollapsed: get().sidebarCollapsed,
      achievementThemesEnabled,
    });
  },

  setThemeFromAchievement: (completedTasks) => {
    if (!get().achievementThemesEnabled) return;
    const unlocked = [...ACHIEVEMENT_THEMES]
      .reverse()
      .find((item) => completedTasks >= item.tasks);
    if (!unlocked || unlocked.theme === get().theme) return;
    applyTheme(unlocked.theme);
    set({ theme: unlocked.theme });
    save({
      theme: unlocked.theme,
      sidebarCollapsed: get().sidebarCollapsed,
      achievementThemesEnabled: true,
    });
  },

  toggleSidebar: () => {
    const sidebarCollapsed = !get().sidebarCollapsed;
    set({ sidebarCollapsed });
    save({
      theme: get().theme,
      sidebarCollapsed,
      achievementThemesEnabled: get().achievementThemesEnabled,
    });
  },
}));
