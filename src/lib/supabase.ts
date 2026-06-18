"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

// A single browser client, shared across the app. PKCE is required for the
// Electron loopback flow (we exchange the auth code by hand) and is fine for the
// web redirect too. The session is persisted to localStorage and auto-refreshed,
// so a signed-in Discord profile survives reloads and app restarts.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
