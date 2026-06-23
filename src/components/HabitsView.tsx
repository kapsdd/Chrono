"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Recurrence, Task } from "@/lib/types";
import { useChronoStore } from "@/store/useChronoStore";
import { Icon } from "./icons";
import { EmptyState } from "./EmptyState";

const PERIOD_MS: Record<Recurrence, number> = {
  daily: 86_400_000,
  weekly: 7 * 86_400_000,
  monthly: 30 * 86_400_000,
};
const RECUR_LABEL: Record<Recurrence, string> = {
  daily: "Ежедневно",
  weekly: "Еженедельно",
  monthly: "Ежемесячно",
};

function dueLabel(due: string | null | undefined): string {
  if (!due) return "—";
  const d = new Date(due);
  const today = new Date();
  const diffDays = Math.round((d.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86_400_000);
  if (diffDays < 0) return "просрочено";
  if (diffDays === 0) return "сегодня";
  if (diffDays === 1) return "завтра";
  return `через ${diffDays} дн.`;
}

// Dedicated habits screen (#14): each recurring task as a check-in card with its
// streak, "done this period" state, and next due. One click = check in.
export function HabitsView({ tasks }: { tasks: Task[] }) {
  const toggleComplete = useChronoStore((s) => s.toggleComplete);
  const setRecurrence = useChronoStore((s) => s.setRecurrence);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const habits = useMemo(
    () => tasks.filter((t) => t.recurrence && !t.isCompleted),
    [tasks],
  );

  const isDone = (t: Task) => {
    if (!t.lastCompletedAt || !t.recurrence) return false;
    return Date.now() - Date.parse(t.lastCompletedAt) < PERIOD_MS[t.recurrence];
  };

  const sorted = useMemo(
    () => [...habits].sort((a, b) => Number(isDone(a)) - Number(isDone(b))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habits],
  );

  if (habits.length === 0) {
    return (
      <EmptyState
        title="Привычек пока нет"
        hint="Откройте задачу, нажмите значок ↻ и выберите частоту — она появится здесь."
        icon="repeat"
        showGrammar={false}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-2.5">
      {sorted.map((t) => {
        const done = isDone(t);
        const r = t.recurrence as Recurrence;
        return (
          <motion.div
            key={t.id}
            layout
            className="glass flex items-center gap-3.5 rounded-2xl px-4 py-3.5"
          >
            {/* big check-in button */}
            <button
              onClick={() => void toggleComplete(t.id)}
              title={done ? "Отметить ещё раз" : "Отметить выполнение"}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition-all ${
                done
                  ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300"
                  : "border-violet-400/40 text-violet-200 hover:border-violet-300 hover:bg-violet-500/10"
              }`}
            >
              {done ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <Icon name="repeat" size={18} />
              )}
            </button>

            {/* title + meta */}
            <div className="min-w-0 flex-1">
              <div className={`truncate text-[15px] ${done ? "text-white/55" : "text-white/90"}`}>
                {t.title}
              </div>
              <div className="mt-0.5 flex items-center gap-2.5 text-[12px] text-white/40">
                <span>{RECUR_LABEL[r]}</span>
                <span className="text-white/20">·</span>
                <span>следующий: {dueLabel(t.due)}</span>
                {done && <span className="text-emerald-300/70">✓ в этом периоде</span>}
              </div>
            </div>

            {/* streak */}
            <div className="flex shrink-0 flex-col items-center px-1">
              <span className="text-[18px] leading-none">🔥</span>
              <span className="mt-0.5 font-mono text-[13px] font-semibold text-amber-200/90">
                {t.streak ?? 0}
              </span>
            </div>

            {/* stop being a habit */}
            <button
              onClick={() => setRecurrence(t.id, null)}
              title="Убрать из привычек"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/30 hover:bg-white/5 hover:text-rose-300"
            >
              ✕
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
