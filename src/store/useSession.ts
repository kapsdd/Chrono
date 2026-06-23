"use client";

import { create } from "zustand";
import type { Session } from "@/lib/types";
import {
  signInWithCredential,
  GoogleAuthProvider,
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
    provider: "google",
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

export const useSession = create<SessionState>((set, get) => {
  let unsubAuth: (() => void) | null = null;

  return {
    session: null,
    hydrated: false,
    pending: false,
    error: null,

    hydrate: () => {
      if (typeof window === "undefined") return;
      unsubAuth?.();
      unsubAuth = onAuthStateChanged(auth, (user) => {
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
        const isDesktop = !!window.chrono?.isDesktop;

        if (isDesktop && window.chrono?.googleSignIn) {
          const result = await window.chrono.googleSignIn();
          if (result?.idToken) {
            const credential = GoogleAuthProvider.credential(result.idToken);
            await signInWithCredential(auth, credential);
            return;
          }
          if (result?.error) {
            set({ pending: false, error: `Ошибка: ${result.error}` });
            return;
          }
          set({ pending: false, error: "Авторизация отменена." });
          return;
        }

        const { signInWithRedirect } = await import("firebase/auth");
        await signInWithRedirect(auth, googleProvider);
      } catch (e) {
        console.error("Login failed", e);
        if (get().session) return;
        const detail = e instanceof Error ? e.message : String(e);
        set({ pending: false, error: `Не удалось войти: ${detail}` });
      }
    },

    logout: async () => {
      await fbSignOut(auth);
      set({ session: null, pending: false, error: null });
    },
  };
});
