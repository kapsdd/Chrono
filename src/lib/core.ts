// Gateway to the Rust core (`chrono-core` via Tauri commands). This is the
// canonical implementation the desktop app runs on; the local TS modules are
// only consulted outside Tauri (static prerender / plain browser build).

import { invoke } from "@tauri-apps/api/core";
import { isDesktop } from "@/lib/desktop";
import type { KanbanColumn, ParsedInput, Task, TaskNode } from "@/lib/types";
import { parseInput as parseInputLocal } from "@/lib/parseInput";
import { buildTree as buildTreeLocal } from "@/lib/tree";
import { normalizeKanbanColumns as normalizeKanbanLocal } from "@/lib/kanban";
import { buildICS as buildICSLocal } from "@/lib/ics";

export async function parseInput(raw: string): Promise<ParsedInput> {
  if (isDesktop()) return invoke<ParsedInput>("parse_input", { raw });
  return parseInputLocal(raw);
}

export async function buildTree(tasks: Task[]): Promise<TaskNode[]> {
  if (isDesktop()) return invoke<TaskNode[]>("build_tree", { tasks });
  return buildTreeLocal(tasks);
}

export async function normalizeKanbanColumns(
  columns?: KanbanColumn[] | null,
): Promise<KanbanColumn[]> {
  if (isDesktop()) {
    return invoke<KanbanColumn[]>("normalize_kanban_columns", {
      columns: columns ?? null,
    });
  }
  return normalizeKanbanLocal(columns ?? null);
}

export async function buildICS(tasks: Task[], stamp: Date): Promise<string> {
  if (isDesktop()) {
    return invoke<string>("build_ics", { tasks, stamp: stamp.toISOString() });
  }
  return buildICSLocal(tasks, stamp);
}

/** Trigger a download of the current tasks as a .ics file. */
export async function downloadICS(tasks: Task[]): Promise<void> {
  if (typeof window === "undefined") return;
  const ics = await buildICS(tasks, new Date());
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chrono.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function hashPassword(password: string): Promise<string> {
  if (isDesktop()) return invoke<string>("hash_password", { password });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (isDesktop()) {
    return invoke<boolean>("verify_password", { password, stored });
  }
  return (await hashPassword(password)) === stored;
}
