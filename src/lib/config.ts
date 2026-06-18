// Public Supabase connection values. The anon key is safe to ship in the client
// (it only grants what Row-Level Security allows). Build-time NEXT_PUBLIC_* env
// vars win; the fallbacks mirror chrono.config.json so the static export and the
// Electron bundle work without an .env file.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://kzvkecedzkkgfeehpzhh.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6dmtlY2VkemtrZ2ZlZWhwemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDY0NTEsImV4cCI6MjA5NzI4MjQ1MX0.RoT84_GbRWGKzga3FAoo0qmGop_NjCPAUajbTuekwOs";

// Fixed loopback redirect for the Electron OAuth flow. Must be added to the
// Supabase project's "Redirect URLs" allow-list (Auth → URL Configuration).
export const ELECTRON_REDIRECT_PORT = 53117;
export const ELECTRON_REDIRECT_URI = `http://127.0.0.1:${ELECTRON_REDIRECT_PORT}/auth/callback`;