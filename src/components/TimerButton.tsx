"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./icons";

const PRESETS = [
  { label: "Фокус", mins: 25 },
  { label: "Короткий", mins: 5 },
  { label: "Длинный", mins: 15 },
];

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function TimerButton() {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState(25 * 60);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const tick = useRef<number | null>(null);

  useEffect(() => {
    if (running && left > 0) {
      tick.current = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
      return () => {
        if (tick.current) window.clearInterval(tick.current);
      };
    }
    if (left === 0) setRunning(false);
  }, [running, left]);

  const choose = (mins: number) => {
    setTotal(mins * 60);
    setLeft(mins * 60);
    setRunning(false);
  };

  const pct = total > 0 ? ((total - left) / total) * 100 : 0;
  const active = running && left > 0;

  return (
    <div className="no-drag relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Таймер"
        className="relative grid h-9 w-9 place-items-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.06] hover:text-violet-200"
      >
        <Icon name="timer" size={17} />
        {active && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.16 }}
              className="app-window absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-2xl border border-white/10 p-4 shadow-neon-strong"
            >
              <div className="mb-3 flex gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.mins}
                    onClick={() => choose(p.mins)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
                      total === p.mins * 60
                        ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                        : "border-white/10 text-white/55 hover:text-white/80"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="my-2 text-center font-mono text-4xl font-semibold tracking-wider text-white/90">
                {fmt(left)}
              </div>

              <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setRunning((r) => !r)}
                  disabled={left === 0}
                  className="flex-1 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-[13px] font-medium text-white hover:scale-[1.02] active:scale-95 disabled:opacity-40"
                >
                  {active ? "Пауза" : "Старт"}
                </button>
                <button
                  onClick={() => choose(total / 60)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-[13px] text-white/65 hover:bg-white/5"
                >
                  Сброс
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
