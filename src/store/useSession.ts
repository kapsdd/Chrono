"use client";

import { create } from "zustand";
import type { Session } from "@/lib/types";

const SESSION_KEY = "chrono.session";

declare global {
  interface Window {
    chrono?: {
      isDesktop?: boolean;
      minimize?: () => void;
      toggleMaximize?: () => void;
      close?: () => void;
      discordLogin?: () => Promise<Session | null>;
    };
  }
}

function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null) {
  if (typeof window === "undefined") return;
  try {
    if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore quota */
  }
}

interface SessionState {
  session: Session | null;
  hydrated: boolean;
  pending: boolean;
  error: string | null;
  hydrate: () => void;
  loginWithDiscord: () => Promise<void>;
  logout: () => void;
}

export const useSession = create<SessionState>((set) => ({
  session: null,
  hydrated: false,
  pending: false,
  error: null,

  hydrate: () => set({ session: loadSession(), hydrated: true }),

  // Discord is the only way in — a profile is always a Discord profile.
  loginWithDiscord: async () => {
    set({ pending: true, error: null });
    try {
      const session = window.chrono?.discordLogin
        ? await window.chrono.discordLogin()
        : null;
      if (!session) {
        set({
          pending: false,
          error:
            "Discord не настроен или вход отменён. Добавьте Client ID в chrono.config.json.",
        });
        return;
      }
      saveSession(session);
      set({ session, pending: false, error: null });
    } catch {
      set({ pending: false, error: "Не удалось войти через Discord." });
    }
  },

  logout: () => {
    saveSession(null);
    set({ session: null });
  },
}));
