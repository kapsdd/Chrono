"use client";

import { create } from "zustand";
import type { Session } from "@/lib/types";
import {
  signInWithPopup,
  onAuthStateChanged,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

function toSession(user: User | null): Session | null {
  if (!user) return null;
  return {
    id: user.uid,
    username: user.displayName || user.email?.split("@")[0] || "Профиль",
    avatar: user.photoURL || undefined,
    provider: "discord",
    grantedAt: user.metadata.creationTime ?? new Date().toISOString(),
  };
}

interface SessionState {
  session: Session | null;
  hydrated: boolean;
  pending: boolean;
  error: string | null;
  hydrate: () => void;
  loginWithDiscord: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  session: null,
  hydrated: false,
  pending: false,
  error: null,

  hydrate: () => {
    if (typeof window === "undefined") return;

    onAuthStateChanged(auth, (user) => {
      set({
        session: toSession(user),
        hydrated: true,
        pending: false,
      });
    });
  },

  loginWithDiscord: async () => {
    set({ pending: true, error: null });
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Login failed", e);
      if (get().session) return;
      const detail = e instanceof Error ? e.message : String(e);
      set({ pending: false, error: `Не удалось войти: ${detail}` });
    }
  },

  logout: async () => {
    await fbSignOut(auth);
    set({ session: null });
  },
}));
