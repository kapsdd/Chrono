"use client";

import { motion } from "framer-motion";
import { useSession } from "@/store/useSession";

const DISCORD = "#5865F2";

export function AuthScreen() {
  const pending = useSession((s) => s.pending);
  const error = useSession((s) => s.error);
  const loginWithDiscord = useSession((s) => s.loginWithDiscord);

  return (
    <div className="absolute inset-0 z-40 grid place-items-center overflow-hidden">
      {/* ambient backdrop */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 600px at 50% 20%, rgba(88,101,242,0.18), transparent 60%), radial-gradient(700px 500px at 50% 100%, rgba(139,92,246,0.16), transparent 60%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-[min(92vw,420px)]"
      >
        <div className="glass rounded-3xl border border-white/10 p-8 shadow-neon-strong">
          {/* brand */}
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_8px_30px_rgba(139,92,246,0.5)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3c-3 3-4 7-4 10 0 3 1.6 6 4 8 2.4-2 4-5 4-8 0-3-1-7-4-10z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-xl font-semibold tracking-wide text-white/90">
              CHRONO
            </h1>
            <p className="mt-1 text-[13px] text-white/45">
              Войдите через Discord, чтобы делиться проектами с командой
            </p>
          </div>

          {/* Discord login */}
          <button
            disabled={pending}
            onClick={() => void loginWithDiscord()}
            className="flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium text-white shadow-[0_8px_24px_rgba(88,101,242,0.4)] transition-transform hover:scale-[1.015] active:scale-95 disabled:opacity-60"
            style={{ backgroundColor: DISCORD }}
          >
            {pending ? (
              <Spinner />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.27 5.33A16.5 16.5 0 0 0 15.1 4l-.2.42a14 14 0 0 1 3.7 1.2 13.6 13.6 0 0 0-11.2 0A14 14 0 0 1 11.1 4.4L10.9 4a16.5 16.5 0 0 0-4.16 1.33C3.3 9.86 2.6 14.27 2.9 18.6a16.7 16.7 0 0 0 5.08 2.6l.4-.6a10.5 10.5 0 0 1-1.62-.78l.4-.3a11.9 11.9 0 0 0 9.9 0l.4.3c-.5.3-1.04.56-1.62.78l.4.6a16.6 16.6 0 0 0 5.08-2.6c.36-5-.74-9.37-2.95-13.27ZM9.1 15.8c-.98 0-1.78-.9-1.78-2.02 0-1.1.78-2.01 1.78-2.01s1.8.92 1.78 2.01c0 1.11-.79 2.02-1.78 2.02Zm5.8 0c-.98 0-1.78-.9-1.78-2.02 0-1.1.78-2.01 1.78-2.01s1.8.92 1.78 2.01c0 1.11-.78 2.02-1.78 2.02Z" />
              </svg>
            )}
            {pending ? "Подключение…" : "Войти через Discord"}
          </button>

          {error && (
            <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-center text-[12px] leading-relaxed text-rose-200/80">
              {error}
            </p>
          )}

          <p className="mt-5 text-center text-[11px] leading-relaxed text-white/30">
            Профиль и аватар берутся из вашего Discord-аккаунта.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
