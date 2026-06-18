"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useChronoStore } from "@/store/useChronoStore";
import { useSession } from "@/store/useSession";

// Join a shared project by its lobby code + password (#19). On success the
// store reloads and the project appears under "Совместные проекты".
export function LobbyJoinModal({ onClose }: { onClose: () => void }) {
  const session = useSession((s) => s.session);
  const joinLobby = useChronoStore((s) => s.joinLobby);

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!code.trim() || !password) return;
    setBusy(true);
    setError(null);
    const ok = await joinLobby(code, password, session?.username, session?.avatar);
    setBusy(false);
    if (ok) onClose();
    else setError("Неверный код или пароль.");
  };

  return (
    <div className="absolute inset-0 z-40 grid place-items-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-[min(92vw,420px)]"
      >
        <div className="app-window rounded-2xl border border-white/10 p-6 shadow-neon-strong">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white/90">Войти по коду</h2>
              <p className="mt-0.5 text-[13px] text-white/45">
                Присоединиться к общему проекту
              </p>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/80"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2.5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="Код проекта — напр. K7P-29Q"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center font-mono text-[15px] tracking-[0.15em] text-white/90 outline-none focus:border-violet-400/40"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="Пароль"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-white/90 outline-none focus:border-violet-400/40"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-center text-[12px] text-rose-200/80">
              {error}
            </p>
          )}

          <button
            disabled={busy || !code.trim() || !password}
            onClick={() => void submit()}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-[14px] font-medium text-white hover:scale-[1.01] active:scale-95 disabled:opacity-40"
          >
            {busy ? "Подключение…" : "Войти"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
