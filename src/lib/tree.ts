import type { Task, TaskNode } from "@/lib/types";

// Build the rendered forest from a flat task list.
//
// - Children are grouped by parentId; a node whose parent is absent from the
//   set (e.g. filtered out by project scope, or an orphan) is promoted to a
//   root so it never disappears silently.
// - Within each level, higher priority first, then newest first — matching the
//   "what needs attention" reading order.
// - depth is assigned during the walk so the UI can indent without recomputing.

export function buildTree(tasks: Task[]): TaskNode[] {
  const byId = new Map<string, Task>();
  for (const t of tasks) byId.set(t.id, t);

  const childrenOf = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const key = t.parentId && byId.has(t.parentId) ? t.parentId : null;
    const bucket = childrenOf.get(key);
    if (bucket) bucket.push(t);
    else childrenOf.set(key, [t]);
  }

  // Manual drag-and-drop order is authoritative; fall back to creation time.
  const sortLevel = (a: Task, b: Task) =>
    (a.order ?? 0) - (b.order ?? 0) || (a.createdAt < b.createdAt ? 1 : -1);

  const walk = (parentId: string | null, depth: number, visited: Set<string>): TaskNode[] =>
    (childrenOf.get(parentId) ?? [])
      .filter((t) => {
        if (visited.has(t.id)) return false;
        visited.add(t.id);
        return true;
      })
      .slice()
      .sort(sortLevel)
      .map((t) => ({
        ...t,
        depth,
        children: walk(t.id, depth + 1, visited),
      }));

  return walk(null, 0, new Set());
}
