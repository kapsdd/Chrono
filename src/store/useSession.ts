"use client";

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import type { Session } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { ELECTRON_REDIRECT_URI } from "@/lib/config";

declare global {
  interface Window {
    chrono?: {
      isDesktop?: boolean;
      minimize?: () => void;
      toggleMaximize?: () => void;
      close?: () => void;
      // Opens `authUrl` in the system browser and resolves the OAuth `code`
      // captured on the loopback redirect (or null on cancel/timeout).
      discordAuthCode?: (authUrl: string) => Promise<string | null>;
    };
  }
}

// Map a Supabase auth user (Discord identity) to the app's Session shape. The
// id is auth.uid() — the same value RLS pins every project/task row to, so the
// profile resolves to identical data on any device.
function toSession(user: User | null): Session | null {
  if (!user) return null;
  const m = user.user_metadata ?? {};
  return {
    id: user.id,
    username: m.full_name || m.name || m.user_name || m.preferred_username || "Профиль",
    avatar: m.avatar_url || m.picture || undefined,
    provider: "discord",
    grantedAt: user.created_at ?? new Date().toISOString(),
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

  // Read the persisted Supabase session and subscribe to future changes
  // (token refresh, sign-in/out in another tab, the OAuth round-trip).
  hydrate: () => {
    if (typeof window === "undefined") return;

    void supabase.auth.getSession().then(({ data }) => {
      set({ session: toSession(data.session?.user ?? null), hydrated: true });
    });

    supabase.auth.onAuthStateChange((_event, supaSession) => {
      set({
        session: toSession(supaSession?.user ?? null),
        hydrated: true,
        pending: false,
      });
    });
  },

  // Discord is the only way in — a profile is always a Discord profile.
  loginWithDiscord: async () => {
    set({ pending: true, error: null });
    try {
      const isDesktop = !!window.chrono?.isDesktop;

      if (isDesktop && window.chrono?.discordAuthCode) {
        // Desktop: get the provider URL without redirecting the Electron window,
        // open it in the system browser, then exchange the captured code. The
        // PKCE verifier lives in this renderer's storage, so the swap succeeds.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "discord",
          options: { redirectTo: ELECTRON_REDIRECT_URI, skipBrowserRedirect: true },
        });
        if (error || !data?.url) throw error ?? new Error("no auth url");

        const code = await window.chrono.discordAuthCode(data.url);
        if (!code) {
          set({
            pending: false,
            error:
              "Discord не вернул код. Проверьте, что провайдер Discord включён в Supabase " +
              "и redirect-URL содержит http://127.0.0.1:53117/auth/callback.",
          });
          return;
        }
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) throw exErr;
        // onAuthStateChange will populate session + clear pending.
        return;
      }

      // Web: full-page redirect to Discord, back to this origin. detectSessionInUrl
      // finishes the handshake and onAuthStateChange fires on return.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      // Navigation is in progress; leave `pending` until the redirect lands.
    } catch (e) {
      console.error("Discord login failed", e);
      if (get().session) return; // a parallel auth event already signed us in
      const detail = e instanceof Error ? e.message : String(e);
      set({ pending: false, error: `Не удалось войти через Discord: ${detail}` });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ session: null });
  },
}));
