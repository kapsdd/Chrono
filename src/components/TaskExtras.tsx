"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Recurrence, Task, TaskNode } from "@/lib/types";
import { useChronoStore } from "@/store/useChronoStore";
import { Icon } from "./icons";

// Compact duration: "45с" / "25м" / "1ч 05м".
export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}м`;
  const h = Math.floor(m / 60);
  return `${h}ч ${String(m % 60).padStart(2, "0")}м`;
}

const RECUR_LABEL: Record<Recurrence, string> = {
  daily: "Каждый день",
  weekly: "Каждую неделю",
  monthly: "Каждый месяц",
};
const RECUR_SHORT: Record<Recurrence, string> = {
  daily: "день",
  weekly: "неделя",
  monthly: "месяц",
};

/** 🔥-streak badge for habits/recurring tasks. */
export function StreakBadge({ streak }: { streak: number }) {
  if (!streak) return null;
  return (
    <span
      title={`Серия: ${streak}`}
      className="flex items-center gap-0.5 rounded-md border border-amber-300/25 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-200/90"
    >
      🔥{streak}
    </span>
  );
}

/** Per-task time tracker: shows accumulated time and a play/pause control that
 *  accrues a session and flushes it into the task on pause. */
export function TimeTracker({ node }: { node: TaskNode }) {
  const addTime = useChronoStore((s) => s.addTime);
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState(0); // seconds in the current run
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (startRef.current != null) {
        setSession(Math.round((performance.now() - startRef.current) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const flush = () => {
    if (startRef.current != null) {
      const secs = Math.round((performance.now() - startRef.current) / 1000);
      if (secs > 0) addTime(node.id, secs);
    }
    startRef.current = null;
    setSession(0);
  };

  // Flush any in-flight session if the card unmounts mid-run.
  useEffect(() => {
    return () => {
      if (startRef.current != null) {
        const secs = Math.round((performance.now() - startRef.current) / 1000);
        if (secs > 0) addTime(node.id, secs);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    if (running) {
      flush();
      setRunning(false);
    } else {
      startRef.current = performance.now();
      setRunning(true);
    }
  };

  const shown = (node.timeSpent ?? 0) + session;

  return (
    <button
      onClick={toggle}
      title={running ? "Остановить трекинг" : "Засечь время"}
      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
        running
          ? "bg-emerald-400/15 text-emerald-200"
          : "text-white/40 hover:bg-white/5 hover:text-violet-200"
      }`}
    >
      <Icon name={running ? "timer" : "timer"} size={12} />
      {shown > 0 || running ? fmtDuration(shown) : "трек"}
    </button>
  );
}

/** Always-visible time chip (no controls) — used in completed/readonly rows. */
export function TimeBadge({ seconds }: { seconds: number }) {
  if (!seconds) return null;
  return (
    <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50">
      {fmtDuration(seconds)}
    </span>
  );
}

export function NoteControl({ node }: { node: Pick<Task, "id" | "note"> }) {
  const setTaskNote = useChronoStore((s) => s.setTaskNote);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(node.note ?? "");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const hasNote = Boolean(node.note?.trim());

  useEffect(() => {
    if (!open) setDraft(node.note ?? "");
  }, [node.note, open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(window.innerWidth - 300, r.right - 280)) });
      setDraft(node.note ?? "");
    }
    setOpen((v) => !v);
  };

  const save = () => {
    setTaskNote(node.id, draft.trim());
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title={hasNote ? "Открыть заметку" : "Добавить заметку"}
        className={`grid h-6 w-6 place-items-center rounded-md transition-colors ${
          hasNote ? "text-amber-200" : "text-white/40 hover:bg-white/5 hover:text-violet-300"
        }`}
      >
        <span className="text-[13px] leading-none">≡</span>
      </button>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[80]" onClick={save} />
            <div
              className="app-window fixed z-[81] w-72 rounded-xl border border-white/10 p-3 shadow-neon-strong"
              style={{ top: pos.top, left: pos.left }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[12px] font-medium text-white/70">Заметка</div>
                <button
                  onClick={() => {
                    setDraft("");
                    setTaskNote(node.id, "");
                    setOpen(false);
                  }}
                  className="rounded-md px-1.5 py-0.5 text-[11px] text-white/35 hover:bg-white/5 hover:text-rose-300"
                >
                  Очистить
                </button>
              </div>
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    save();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setOpen(false);
                  }
                }}
                placeholder="Контекст, ссылки, решение..."
                className="h-32 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] leading-relaxed text-white/85 outline-none placeholder:text-white/25 focus:border-violet-400/40"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={save}
                  className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-[12px] font-medium text-white"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

/** Recurrence picker — sets daily/weekly/monthly or turns repetition off.
 *  The menu renders in a portal with fixed positioning so the task card's
 *  overflow-hidden can't clip it. */
export function RecurrenceControl({ node }: { node: TaskNode }) {
  const setRecurrence = useChronoStore((s) => s.setRecurrence);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const active = node.recurrence ?? null;

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Anchor the 160px-wide menu to the button's right edge, just below it.
      setPos({ top: r.bottom + 6, left: Math.max(8, r.right - 160) });
    }
    setOpen((v) => !v);
  };

  const choose = (r: Recurrence | null) => {
    setRecurrence(node.id, r);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title={active ? `Повтор: ${RECUR_LABEL[active]}` : "Сделать повторяющейся"}
        className={`grid h-6 w-6 place-items-center rounded-md transition-colors ${
          active ? "text-violet-300" : "text-white/40 hover:bg-white/5 hover:text-violet-300"
        }`}
      >
        <Icon name="repeat" size={14} />
      </button>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
            <div
              className="app-window fixed z-[81] w-40 rounded-xl border border-white/10 p-1.5 shadow-neon-strong"
              style={{ top: pos.top, left: pos.left }}
            >
              {(["daily", "weekly", "monthly"] as Recurrence[]).map((r) => (
                <button
                  key={r}
                  onClick={() => choose(r)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-white/5 ${
                    active === r ? "text-violet-200" : "text-white/70"
                  }`}
                >
                  {RECUR_LABEL[r]}
                  <span className="font-mono text-[10px] text-white/30">{RECUR_SHORT[r]}</span>
                </button>
              ))}
              {active && (
                <button
                  onClick={() => choose(null)}
                  className="mt-1 w-full rounded-lg border-t border-white/5 px-2.5 py-1.5 text-left text-[12.5px] text-white/50 hover:bg-white/5 hover:text-rose-300"
                >
                  Отключить повтор
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
