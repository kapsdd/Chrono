import type { KanbanColumn, Priority } from "@/lib/types";

export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { priority: 3, label: "Срочно", color: "#fb7185" },
  { priority: 2, label: "Высокий", color: "#f59e0b" },
  { priority: 1, label: "Средний", color: "#a78bfa" },
  { priority: 0, label: "Без приоритета", color: "#64748b" },
];

const PRIORITIES: Priority[] = [3, 2, 1, 0];

export function normalizeKanbanColumns(columns?: KanbanColumn[] | null): KanbanColumn[] {
  return PRIORITIES.map((priority) => {
    const fallback = DEFAULT_KANBAN_COLUMNS.find((c) => c.priority === priority)!;
    const saved = columns?.find((c) => c.priority === priority);
    return {
      priority,
      label: saved?.label?.trim() || fallback.label,
      color: /^#[0-9a-f]{6}$/i.test(saved?.color ?? "") ? saved!.color : fallback.color,
    };
  });
}
