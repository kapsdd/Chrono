"use client";

import { motion } from "framer-motion";
import { useSession } from "@/store/useSession";
import { APP_ICON } from "@/lib/brand";

const GOOGLE_BLUE = "#4285F4";

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
            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-black shadow-[0_8px_30px_rgba(139,92,246,0.5)]">
              <img src={APP_ICON} alt="CHRONO" className="h-full w-full object-cover" draggable={false} />
            </div>
            <h1 className="mt-4 text-xl font-semibold tracking-wide text-white/90">
              CHRONO
            </h1>
            <p className="mt-1 text-[13px] text-white/45">
              Войдите через Google, чтобы делиться проектами с командой
            </p>
          </div>

          {/* Discord login */}
          <button
            disabled={pending}
            onClick={() => void loginWithDiscord()}
            className="flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium text-white shadow-[0_8px_24px_rgba(88,101,242,0.4)] transition-transform hover:scale-[1.015] active:scale-95 disabled:opacity-60"
            style={{ backgroundColor: GOOGLE_BLUE }}
          >
            {pending ? (
              <Spinner />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" opacity="0.8"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" opacity="0.6"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" opacity="0.9"/>
              </svg>
            )}
            {pending ? "Подключение…" : "Войти через Google"}
          </button>

          {error && (
            <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-center text-[12px] leading-relaxed text-rose-200/80">
              {error}
            </p>
          )}

          <p className="mt-5 text-center text-[11px] leading-relaxed text-white/30">
            Профиль и аватар берутся из вашего Google-аккаунта.
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
