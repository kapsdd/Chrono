"use client";

// Render-side hooks for the Rust core. The tree and the kanban column set are
// computed in the Rust process and cached in component state.

import { useEffect, useMemo, useState } from "react";
import { buildTree, normalizeKanbanColumns } from "@/lib/core";
import { DEFAULT_KANBAN_COLUMNS } from "@/lib/kanban";
import type { KanbanColumn, Task, TaskNode } from "@/lib/types";

export function useTaskTree(tasks: Task[]): TaskNode[] {
  const [tree, setTree] = useState<TaskNode[]>([]);
  useEffect(() => {
    let alive = true;
    void buildTree(tasks).then((t) => {
      if (alive) setTree(t);
    });
    return () => {
      alive = false;
    };
  }, [tasks]);
  return tree;
}

export function useKanbanColumns(columns?: KanbanColumn[] | null): KanbanColumn[] {
  const [normalized, setNormalized] = useState<KanbanColumn[]>(DEFAULT_KANBAN_COLUMNS);
  // The column array is recreated on every render; key on its content instead.
  const key = useMemo(() => JSON.stringify(columns ?? null), [columns]);
  useEffect(() => {
    let alive = true;
    void normalizeKanbanColumns(columns ?? null).then((c) => {
      if (alive) setNormalized(c);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return normalized;
}
