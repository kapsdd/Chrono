"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import type { Task } from "@/lib/types";
import { SPRING } from "@/lib/motion";
import { useChronoStore } from "@/store/useChronoStore";

// Collapsible "done" pile. Completed tasks are shown flat (no nesting) — the
// hierarchy mattered while they were active; here they're just a history.
export function CompletedSection({ tasks }: { tasks: Task[] }) {
  const [open, setOpen] = useState(false);
  const toggleComplete = useChronoStore((s) => s.toggleComplete);
  const deleteTask = useChronoStore((s) => s.deleteTask);

  if (tasks.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-1 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-white/35 transition-colors hover:text-white/60"
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={SPRING}>
          ›
        </motion.span>
        Выполнено · {tasks.length}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-col gap-1.5">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.03]"
                >
                  <button
                    onClick={() => void toggleComplete(t.id)}
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-violet-400/40 bg-violet-500/20"
                    aria-label="Вернуть в активные"
                  >
                    <span className="h-2 w-2 rounded-full bg-violet-400/80" />
                  </button>
                  <span
                    className={clsx(
                      "min-w-0 flex-1 truncate text-[13.5px] text-white/40 line-through",
                    )}
                  >
                    {t.title}
                  </span>
                  <button
                    onClick={() => void deleteTask(t.id)}
                    title="Удалить"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/30 opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
