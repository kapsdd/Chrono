"use client";

import type { MouseEvent } from "react";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import type { TaskNode } from "@/lib/types";
import { SPRING } from "@/lib/motion";
import { useChronoStore } from "@/store/useChronoStore";
import { PriorityDots, TagChip } from "./TaskMeta";
import { NoteControl, RecurrenceControl, StreakBadge, TimeTracker } from "./TaskExtras";

export function TaskCard({ node }: { node: TaskNode }) {
  const toggleComplete = useChronoStore((s) => s.toggleComplete);
  const toggleCollapse = useChronoStore((s) => s.toggleCollapse);
  const deleteTask = useChronoStore((s) => s.deleteTask);
  const addFromInput = useChronoStore((s) => s.addFromInput);
  const renameTask = useChronoStore((s) => s.renameTask);

  const [completing, setCompleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [subValue, setSubValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [titleValue, setTitleValue] = useState(node.title);
  const cardRef = useRef<HTMLDivElement>(null);

  const commitTitle = () => {
    if (titleValue.trim()) renameTask(node.id, titleValue);
    else setTitleValue(node.title);
    setEditing(false);
  };

  const hasChildren = node.children.length > 0;
  const struck = node.isCompleted || completing;

  const onCheck = () => {
    // Recurring task: a check-in (bumps streak, rolls the due date) — it stays
    // in the list, so skip the fly-away strikethrough.
    if (node.recurrence) {
      void toggleComplete(node.id);
      return;
    }
    if (node.isCompleted) {
      void toggleComplete(node.id);
      return;
    }
    // Draw the strikethrough first, then commit — the commit removes the card
    // from the active tree, triggering the collapse-and-fly-away exit.
    setCompleting(true);
    window.setTimeout(() => void toggleComplete(node.id), 380);
  };

  // Track the cursor inside the card for the radial glow.
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const submitSub = async () => {
    if (!subValue.trim()) return;
    await addFromInput(subValue, node.id);
    setSubValue("");
    setAddOpen(false);
  };

  return (
    <motion.div
      ref={cardRef}
      layout
      onMouseMove={onMove}
      whileHover={{ y: -2 }}
      transition={SPRING}
      className={clsx(
        "glass group relative overflow-hidden rounded-xl px-3.5 py-2.5",
        "shadow-neon transition-[box-shadow,border-color] duration-300 hover:border-violet-400/30 hover:shadow-neon-strong",
        node.isCompleted && "opacity-60",
      )}
    >
      {/* cursor-following glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(180px circle at var(--mx, 50%) var(--my, 50%), rgba(139,92,246,0.18), transparent 70%)",
        }}
      />

      <div className="relative flex items-center gap-3">
        {/* collapse / expand */}
        {hasChildren ? (
          <button
            onClick={() => toggleCollapse(node.id)}
            className="shrink-0 text-white/40 transition-colors hover:text-violet-300"
            aria-label={node.collapsed ? "Развернуть" : "Свернуть"}
          >
            <motion.svg
              animate={{ rotate: node.collapsed ? -90 : 0 }}
              transition={SPRING}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          </button>
        ) : (
          <span className="w-[14px] shrink-0" />
        )}

        {/* custom round checkbox */}
        <button
          onClick={onCheck}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-violet-400/40 transition-colors hover:border-violet-300"
          aria-label="Отметить выполненной"
        >
          <AnimatePresence>
            {struck && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={SPRING}
                className="h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_8px_#8b5cf6]"
              />
            )}
          </AnimatePresence>
        </button>

        {/* title + animated strikethrough (double-click to rename) */}
        <div className="relative min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTitle();
                }
                if (e.key === "Escape") {
                  setTitleValue(node.title);
                  setEditing(false);
                }
              }}
              className="w-full rounded-md border border-violet-400/40 bg-white/[0.04] px-2 py-0.5 text-[14.5px] text-white/90 outline-none"
            />
          ) : (
            <span
              onDoubleClick={() => {
                setTitleValue(node.title);
                setEditing(true);
              }}
              className={clsx(
                "block truncate text-[14.5px]",
                node.isCompleted ? "text-white/45" : "text-white/90",
              )}
            >
              {node.title}
            </span>
          )}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute left-0 top-1/2 h-px w-full origin-left bg-violet-400 shadow-[0_0_6px_#8b5cf6]"
            initial={{ scaleX: node.isCompleted ? 1 : 0 }}
            animate={{ scaleX: struck ? 1 : 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          />
        </div>

        {/* meta */}
        <div className="flex shrink-0 items-center gap-2">
          {node.recurrence && <StreakBadge streak={node.streak ?? 0} />}
          {node.note?.trim() && (
            <span
              title={node.note}
              className="rounded-md border border-amber-300/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-100/80"
            >
              заметка
            </span>
          )}
          {node.tags.slice(0, 3).map((t) => (
            <TagChip key={t} name={t} />
          ))}
          <PriorityDots priority={node.priority} />
        </div>

        {/* hover actions */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <NoteControl node={node} />
          <TimeTracker node={node} />
          <RecurrenceControl node={node} />
          <button
            onClick={() => {
              setTitleValue(node.title);
              setEditing(true);
            }}
            title="Переименовать"
            className="grid h-6 w-6 place-items-center rounded-md text-white/40 hover:bg-white/5 hover:text-violet-300"
          >
            ✎
          </button>
          <button
            onClick={() => setAddOpen((v) => !v)}
            title="Добавить подзадачу"
            className="grid h-6 w-6 place-items-center rounded-md text-white/40 hover:bg-white/5 hover:text-violet-300"
          >
            +
          </button>
          <button
            onClick={() => void deleteTask(node.id)}
            title="Удалить"
            className="grid h-6 w-6 place-items-center rounded-md text-white/40 hover:bg-white/5 hover:text-rose-300"
          >
            ✕
          </button>
        </div>
      </div>

      {/* inline subtask input */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING}
            className="overflow-hidden"
          >
            <div className="ml-8 mt-2 flex items-center gap-2">
              <span className="font-mono text-xs text-violet-400/70">↳</span>
              <input
                autoFocus
                value={subValue}
                onChange={(e) => setSubValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submitSub();
                  }
                  if (e.key === "Escape") {
                    setAddOpen(false);
                    setSubValue("");
                  }
                }}
                placeholder="Подзадача…   #тег  !!"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[13px] text-white/90 outline-none focus:border-violet-400/40"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
