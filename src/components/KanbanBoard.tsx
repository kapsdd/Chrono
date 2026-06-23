"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import type { KanbanColumn, Priority, Task } from "@/lib/types";
import { SPRING } from "@/lib/motion";
import { useChronoStore } from "@/store/useChronoStore";
import { normalizeKanbanColumns } from "@/lib/kanban";
import { TagChip } from "./TaskMeta";
import { NoteControl, TimeBadge } from "./TaskExtras";

const ord = (t: Task) => t.order ?? 0;

export function KanbanBoard({
  tasks,
  columns,
}: {
  tasks: Task[];
  columns?: KanbanColumn[];
}) {
  const toggleComplete = useChronoStore((s) => s.toggleComplete);
  const deleteTask = useChronoStore((s) => s.deleteTask);
  const moveTask = useChronoStore((s) => s.moveTask);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Priority | null>(null);

  const colItems = (p: Priority) =>
    tasks.filter((t) => (t.priority ?? 0) === p && !t.isCompleted).sort((a, b) => ord(a) - ord(b));

  // Drop onto a column body → append to the end of that column.
  const dropToColumn = (p: Priority) => {
    if (!dragId) return;
    const items = colItems(p).filter((t) => t.id !== dragId);
    const last = items[items.length - 1];
    moveTask(dragId, p, last ? ord(last) + 1 : 0);
    setDragId(null);
    setOverCol(null);
  };

  // Drop onto a card → insert just above it.
  const dropBefore = (p: Priority, targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverCol(null);
      return;
    }
    const items = colItems(p).filter((t) => t.id !== dragId);
    const idx = items.findIndex((t) => t.id === targetId);
    const target = items[idx];
    const prev = items[idx - 1];
    const newOrder = prev ? (ord(prev) + ord(target)) / 2 : ord(target) - 1;
    moveTask(dragId, p, newOrder);
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {normalizeKanbanColumns(columns).map((col) => {
        const items = colItems(col.priority);
        const isOver = overCol === col.priority;
        return (
          <div key={col.priority} className="flex w-72 shrink-0 flex-col">
            <div className="mb-3 flex items-center gap-2 px-1">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: col.color, boxShadow: `0 0 8px ${col.color}` }}
              />
              <span className="text-[13px] font-medium text-white/80">{col.label}</span>
              <span className="font-mono text-[11px] text-white/30">{items.length}</span>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.priority);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) setOverCol(null);
              }}
              onDrop={() => dropToColumn(col.priority)}
              className={clsx(
                "flex min-h-[140px] flex-col gap-2 rounded-2xl border p-2 transition-colors",
                isOver
                  ? "border-violet-400/40 bg-violet-500/[0.06]"
                  : "border-white/[0.05] bg-white/[0.015]",
              )}
            >
              <AnimatePresence initial={false}>
                {items.map((t) => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={SPRING}
                  >
                    <div
                      draggable
                      onDragStart={(e) => {
                        setDragId(t.id);
                        e.dataTransfer.setData("text/plain", t.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                      }}
                      onDrop={(e) => {
                        e.stopPropagation();
                        dropBefore(col.priority, t.id);
                      }}
                      className={clsx(
                        "glass group cursor-grab rounded-xl px-3 py-2.5 active:cursor-grabbing",
                        dragId === t.id && "opacity-40",
                      )}
                    >
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() => void toggleComplete(t.id)}
                        className="mt-0.5 grid shrink-0 place-items-center rounded-full border border-violet-400/40 transition-colors hover:border-violet-300"
                        style={{ height: 18, width: 18 }}
                        aria-label="Выполнить"
                      />
                      <span className="min-w-0 flex-1 text-[13.5px] text-white/85">{t.title}</span>
                    </div>
                    {t.tags && t.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 pl-7">
                        {t.tags.slice(0, 3).map((tag) => (
                          <TagChip key={tag} name={tag} />
                        ))}
                      </div>
                    )}
                    {(t.note?.trim() || (t.timeSpent ?? 0) > 0) && (
                      <div className="mt-2 flex items-center gap-1 pl-7">
                        {t.note?.trim() && (
                          <span
                            title={t.note}
                            className="max-w-[180px] truncate rounded-md border border-amber-300/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-100/80"
                          >
                            {t.note.replace(/\s+/g, " ").slice(0, 40)}
                          </span>
                        )}
                        <TimeBadge seconds={t.timeSpent ?? 0} />
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-end gap-1 pl-7 opacity-0 transition-opacity group-hover:opacity-100">
                      <NoteControl node={t} />
                      <button
                        onClick={() => void deleteTask(t.id)}
                        title="Удалить"
                        className="grid h-6 w-6 place-items-center rounded-md text-white/40 hover:bg-white/5 hover:text-rose-300"
                      >
                        ✕
                      </button>
                    </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {items.length === 0 && (
                <div className="grid h-20 place-items-center text-[12px] text-white/20">
                  Перетащите сюда
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
