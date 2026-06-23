"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./icons";

const TIMER_KEY = "chrono.timer";

const PRESETS = [
  { label: "Фокус", mins: 25 },
  { label: "Короткий", mins: 5 },
  { label: "Длинный", mins: 15 },
];

interface TimerState {
  duration: number;
  remaining: number;
  running: boolean;
  endsAt: number | null;
}

const clampMinutes = (value: number) => Math.min(180, Math.max(1, Math.round(value || 1)));
const fmt = (s: number) =>
  `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

function loadTimer(): TimerState {
  const fallback: TimerState = {
    duration: 25 * 60,
    remaining: 25 * 60,
    running: false,
    endsAt: null,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(TIMER_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<TimerState>;
    const duration = Number(parsed.duration) > 0 ? Number(parsed.duration) : fallback.duration;
    const endsAt = typeof parsed.endsAt === "number" ? parsed.endsAt : null;
    if (parsed.running && endsAt) {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      return { duration, remaining, running: remaining > 0, endsAt: remaining > 0 ? endsAt : null };
    }
    return {
      duration,
      remaining: Number(parsed.remaining) > 0 ? Number(parsed.remaining) : duration,
      running: false,
      endsAt: null,
    };
  } catch {
    return fallback;
  }
}

function saveTimer(state: TimerState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TIMER_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

// Quick chime via WebAudio — no asset needed and not blocked by autoplay
// after the user has interacted with the page (clicking Start counts).
function chime() {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.05);
    };
    playTone(880, 0, 0.18);
    playTone(1175, 0.2, 0.22);
    playTone(1568, 0.45, 0.32);
    window.setTimeout(() => void ctx.close().catch(() => undefined), 1200);
  } catch {
    /* ignore audio failures */
  }
}

function notifyEnd() {
  if (typeof window === "undefined") return;
  chime();
  if (typeof navigator !== "undefined") navigator.vibrate?.([120, 60, 120]);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("Таймер CHRONO", { body: "Время вышло!", silent: false });
    } catch {
      /* ignore */
    }
  }
}

export function TimerButton() {
  const [open, setOpen] = useState(false);
  const initialTimer = useMemo(() => loadTimer(), []);
  const [timer, setTimer] = useState<TimerState>(initialTimer);
  const [customMinutes, setCustomMinutes] = useState(() => String(Math.round(initialTimer.duration / 60)));
  const endedRef = useRef(false);

  const pct = useMemo(
    () => (timer.duration > 0 ? ((timer.duration - timer.remaining) / timer.duration) * 100 : 0),
    [timer.duration, timer.remaining],
  );
  const active = timer.running && timer.remaining > 0;

  useEffect(() => {
    saveTimer(timer);
  }, [timer]);

  useEffect(() => {
    if (!timer.running || !timer.endsAt) return;
    endedRef.current = false;
    const id = window.setInterval(() => {
      setTimer((current) => {
        if (!current.running || !current.endsAt) return current;
        const remaining = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000));
        if (remaining === 0 && !endedRef.current) {
          endedRef.current = true;
          notifyEnd();
          return { ...current, remaining: 0, running: false, endsAt: null };
        }
        return { ...current, remaining };
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [timer.running, timer.endsAt]);

  const choose = (mins: number) => {
    const seconds = clampMinutes(mins) * 60;
    setTimer({ duration: seconds, remaining: seconds, running: false, endsAt: null });
    setCustomMinutes(String(Math.round(seconds / 60)));
  };

  const startPause = () => {
    // Request notification permission on first start so the end-of-timer toast
    // can actually fire. No-op if already granted/denied.
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        void Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
    setTimer((current) => {
      if (current.running) {
        const remaining = current.endsAt
          ? Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000))
          : current.remaining;
        return { ...current, remaining, running: false, endsAt: null };
      }
      const remaining = current.remaining > 0 ? current.remaining : current.duration;
      if (remaining <= 0) return current;
      return { ...current, remaining, running: true, endsAt: Date.now() + remaining * 1000 };
    });
  };

  const reset = () => {
    endedRef.current = false;
    setTimer((current) => ({
      duration: current.duration,
      remaining: current.duration,
      running: false,
      endsAt: null,
    }));
  };

  const applyCustom = () => {
    const parsed = Number(customMinutes);
    const safe = Number.isFinite(parsed) && parsed > 0 ? clampMinutes(parsed) : 1;
    choose(safe);
  };

  return (
    <div className="no-drag relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={active ? `Таймер: ${fmt(timer.remaining)}` : "Таймер"}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.06] hover:text-violet-200"
      >
        <Icon name="timer" size={17} />
        {active && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
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
              className="app-window absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-white/10 p-4 shadow-neon-strong"
            >
              <div className="mb-3 flex gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.mins}
                    onClick={() => choose(p.mins)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
                      timer.duration === p.mins * 60
                        ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                        : "border-white/10 text-white/55 hover:text-white/80"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="my-2 text-center font-mono text-4xl font-semibold tracking-wider text-white/90">
                {fmt(timer.remaining)}
              </div>

              <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="mb-3 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  onBlur={() => {
                    const parsed = Number(customMinutes);
                    if (!Number.isFinite(parsed) || parsed <= 0) setCustomMinutes("1");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && applyCustom()}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[12px] text-white/75 outline-none focus:border-violet-400/40"
                  aria-label="Минуты"
                />
                <button
                  onClick={applyCustom}
                  className="rounded-lg border border-white/10 px-3 py-2 text-[12px] text-white/65 hover:bg-white/5 hover:text-white/85"
                >
                  мин
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={startPause}
                  disabled={timer.remaining === 0 && timer.duration === 0}
                  className="flex-1 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-[13px] font-medium text-white hover:scale-[1.02] active:scale-95 disabled:opacity-40"
                >
                  {active ? "Пауза" : timer.remaining === 0 ? "Заново" : "Старт"}
                </button>
                <button
                  onClick={reset}
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
