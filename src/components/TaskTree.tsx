"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { TaskNode } from "@/lib/types";
import { SPRING } from "@/lib/motion";
import { useChronoStore } from "@/store/useChronoStore";
import { TaskCard } from "./TaskCard";

const ord = (n: TaskNode) => n.order ?? 0;

// Recursive renderer. Top-level rows are drag-reorderable; nested subtrees are
// rendered without drag to keep the parent-child structure intact.
export function TaskTree({
  nodes,
  topLevel = false,
}: {
  nodes: TaskNode[];
  topLevel?: boolean;
}) {
  const setTaskOrder = useChronoStore((s) => s.setTaskOrder);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const dropBefore = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const list = nodes.filter((n) => n.id !== dragId);
    const idx = list.findIndex((n) => n.id === targetId);
    const target = list[idx];
    const prev = list[idx - 1];
    const newOrder = prev ? (ord(prev) + ord(target)) / 2 : ord(target) - 1;
    setTaskOrder(dragId, newOrder);
    setDragId(null);
    setOverId(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {nodes.map((node) => (
          <motion.div
            key={node.id}
            layout
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.96 }}
            transition={SPRING}
          >
            <div
              draggable={topLevel}
              onDragStart={
                topLevel
                  ? (e) => {
                      setDragId(node.id);
                      e.dataTransfer.setData("text/plain", node.id);
                      e.dataTransfer.effectAllowed = "move";
                    }
                  : undefined
              }
              onDragEnd={topLevel ? () => { setDragId(null); setOverId(null); } : undefined}
              onDragOver={
                topLevel
                  ? (e) => {
                      e.preventDefault();
                      if (overId !== node.id) setOverId(node.id);
                    }
                  : undefined
              }
              onDrop={topLevel ? () => dropBefore(node.id) : undefined}
              className={
                topLevel
                  ? "cursor-grab active:cursor-grabbing" +
                    (dragId === node.id ? " opacity-40" : "") +
                    (overId === node.id && dragId && dragId !== node.id
                      ? " rounded-xl ring-1 ring-violet-400/40"
                      : "")
                  : undefined
              }
            >
              <TaskCard node={node} />
            </div>

            <AnimatePresence initial={false}>
              {!node.collapsed && node.children.length > 0 && (
                <motion.div
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={SPRING}
                  className="ml-6 mt-2 overflow-hidden border-l border-white/5 pl-3"
                >
                  <TaskTree nodes={node.children} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
