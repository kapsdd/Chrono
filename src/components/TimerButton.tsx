"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./icons";
import { useChronoStore } from "@/store/useChronoStore";

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
  mode: "countdown" | "stopwatch";
  taskId: string | null;
  elapsed: number;
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
    mode: "countdown",
    taskId: null,
    elapsed: 0,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(TIMER_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<TimerState>;
    const duration = Number(parsed.duration) > 0 ? Number(parsed.duration) : fallback.duration;
    const endsAt = typeof parsed.endsAt === "number" ? parsed.endsAt : null;
    const mode = parsed.mode === "stopwatch" ? "stopwatch" : "countdown";
    if (parsed.running && endsAt && mode === "countdown") {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      return {
        duration,
        remaining,
        running: remaining > 0,
        endsAt: remaining > 0 ? endsAt : null,
        mode,
        taskId: parsed.taskId ?? null,
        elapsed: parsed.elapsed ?? 0,
      };
    }
    if (parsed.running && endsAt && mode === "stopwatch") {
      const elapsed = (parsed.elapsed ?? 0) + Math.floor((Date.now() - endsAt) / 1000);
      return {
        duration,
        remaining: 0,
        running: true,
        endsAt: Date.now(),
        mode,
        taskId: parsed.taskId ?? null,
        elapsed,
      };
    }
    return {
      duration,
      remaining: Number(parsed.remaining) > 0 ? Number(parsed.remaining) : duration,
      running: false,
      endsAt: null,
      mode,
      taskId: parsed.taskId ?? null,
      elapsed: parsed.elapsed ?? 0,
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
  const [taskSelectorOpen, setTaskSelectorOpen] = useState(false);
  const endedRef = useRef(false);
  const stopwatchRef = useRef<number | null>(null);

  const tasks = useChronoStore((s) => s.tasks);
  const addTime = useChronoStore((s) => s.addTime);
  const activeTasks = useMemo(() => tasks.filter((t) => !t.isCompleted), [tasks]);
  const linkedTask = useMemo(
    () => (timer.taskId ? tasks.find((t) => t.id === timer.taskId) : null),
    [tasks, timer.taskId],
  );

  const pct = useMemo(
    () => (timer.duration > 0 ? ((timer.duration - timer.remaining) / timer.duration) * 100 : 0),
    [timer.duration, timer.remaining],
  );
  const active = timer.running;
  const isCountdown = timer.mode === "countdown";
  const displaySeconds = isCountdown ? timer.remaining : timer.elapsed;

  useEffect(() => {
    saveTimer(timer);
  }, [timer]);

  // Countdown tick
  useEffect(() => {
    if (!timer.running || !timer.endsAt || timer.mode !== "countdown") return;
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
  }, [timer.running, timer.endsAt, timer.mode]);

  // Stopwatch tick
  useEffect(() => {
    if (!timer.running || timer.mode !== "stopwatch") {
      if (stopwatchRef.current) {
        window.clearInterval(stopwatchRef.current);
        stopwatchRef.current = null;
      }
      return;
    }
    stopwatchRef.current = window.setInterval(() => {
      setTimer((current) => ({
        ...current,
        elapsed: current.elapsed + 1,
      }));
    }, 1000);
    return () => {
      if (stopwatchRef.current) {
        window.clearInterval(stopwatchRef.current);
        stopwatchRef.current = null;
      }
    };
  }, [timer.running, timer.mode]);

  const choose = (mins: number) => {
    const seconds = clampMinutes(mins) * 60;
    setTimer((prev) => ({
      ...prev,
      duration: seconds,
      remaining: seconds,
      running: false,
      endsAt: null,
      mode: "countdown",
      elapsed: 0,
    }));
    setCustomMinutes(String(Math.round(seconds / 60)));
  };

  const toggleMode = () => {
    setTimer((prev) => ({
      ...prev,
      mode: prev.mode === "countdown" ? "stopwatch" : "countdown",
      running: false,
      endsAt: null,
      remaining: prev.mode === "stopwatch" ? prev.duration : prev.remaining,
      elapsed: prev.mode === "countdown" ? 0 : prev.elapsed,
    }));
  };

  const startPause = () => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        void Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
    setTimer((current) => {
      if (current.running) {
        if (current.mode === "stopwatch") {
          return { ...current, running: false, endsAt: null };
        }
        const remaining = current.endsAt
          ? Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000))
          : current.remaining;
        return { ...current, remaining, running: false, endsAt: null };
      }
      if (current.mode === "stopwatch") {
        return { ...current, running: true, endsAt: Date.now() };
      }
      const remaining = current.remaining > 0 ? current.remaining : current.duration;
      if (remaining <= 0) return current;
      return { ...current, remaining, running: true, endsAt: Date.now() + remaining * 1000 };
    });
  };

  const reset = () => {
    endedRef.current = false;
    setTimer((current) => ({
      ...current,
      remaining: current.duration,
      running: false,
      endsAt: null,
      elapsed: 0,
    }));
  };

  const applyCustom = () => {
    const parsed = Number(customMinutes);
    const safe = Number.isFinite(parsed) && parsed > 0 ? clampMinutes(parsed) : 1;
    choose(safe);
  };

  const saveTimeToTask = () => {
    const seconds = isCountdown ? timer.duration - timer.remaining : timer.elapsed;
    if (seconds > 0 && timer.taskId) {
      addTime(timer.taskId, seconds);
    }
    reset();
  };

  const selectTask = (taskId: string | null) => {
    setTimer((prev) => ({ ...prev, taskId }));
    setTaskSelectorOpen(false);
  };

  return (
    <div className="no-drag relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={active ? `Таймер: ${fmt(displaySeconds)}` : "Таймер"}
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
              className="app-window absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-2xl border border-white/10 p-4 shadow-neon-strong"
            >
              {/* Mode toggle */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.mins}
                      onClick={() => choose(p.mins)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
                        isCountdown && timer.duration === p.mins * 60
                          ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                          : "border-white/10 text-white/55 hover:text-white/80"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={toggleMode}
                  title={isCountdown ? "Переключить на секундомер" : "Переключить на таймер"}
                  className="grid h-7 w-7 place-items-center rounded-md text-white/40 hover:bg-white/[0.06] hover:text-violet-200"
                >
                  <Icon name={isCountdown ? "timer" : "repeat"} size={14} />
                </button>
              </div>

              {/* Timer display */}
              <div className="my-2 text-center font-mono text-4xl font-semibold tracking-wider text-white/90">
                {fmt(displaySeconds)}
              </div>

              {/* Progress bar (countdown only) */}
              {isCountdown && (
                <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {/* Stopwatch doesn't need progress bar, show elapsed */}
              {!isCountdown && (
                <div className="mb-3 text-center text-[11px] text-white/35">
                  Секундомер
                </div>
              )}

              {/* Custom minutes (countdown only) */}
              {isCountdown && (
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
              )}

              {/* Task selector */}
              <div className="mb-3">
                <button
                  onClick={() => setTaskSelectorOpen((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/65 hover:border-violet-400/30"
                >
                  <Icon name="link" size={13} />
                  <span className="flex-1 truncate text-left">
                    {linkedTask ? linkedTask.title : "Привязать к задаче"}
                  </span>
                  {linkedTask && (
                    <button
                      onClick={(e) => { e.stopPropagation(); selectTask(null); }}
                      className="text-white/30 hover:text-rose-300"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  )}
                </button>
                {taskSelectorOpen && (
                  <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-white/10 bg-black/60 backdrop-blur-sm">
                    {activeTasks.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-white/30">Нет активных задач</div>
                    ) : (
                      activeTasks.slice(0, 20).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => selectTask(t.id)}
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-white/[0.06] ${
                            timer.taskId === t.id ? "text-violet-200" : "text-white/65"
                          }`}
                        >
                          <span className="truncate">{t.title}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex gap-2">
                <button
                  onClick={startPause}
                  disabled={isCountdown && timer.remaining === 0 && timer.duration === 0}
                  className="flex-1 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-[13px] font-medium text-white hover:scale-[1.02] active:scale-95 disabled:opacity-40"
                >
                  {active ? "Пауза" : isCountdown && timer.remaining === 0 ? "Заново" : "Старт"}
                </button>
                <button
                  onClick={reset}
                  className="rounded-lg border border-white/10 px-3 py-2 text-[13px] text-white/65 hover:bg-white/5"
                >
                  Сброс
                </button>
                {timer.taskId && (timer.elapsed > 0 || (isCountdown && timer.remaining < timer.duration)) && (
                  <button
                    onClick={saveTimeToTask}
                    title="Записать время в задачу"
                    className="rounded-lg border border-emerald-500/30 px-3 py-2 text-[13px] text-emerald-300 hover:bg-emerald-500/10"
                  >
                    <Icon name="check" size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
