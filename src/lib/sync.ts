"use client";

import { repo, type Snapshot } from "@/lib/repo";
import type { Friend, Project, Task } from "@/lib/types";

// Offline layer (#10). Two parts:
//  1) A local snapshot cache so a profile's data paints instantly on launch,
//     even before (or without) a network round-trip.
//  2) A durable write queue: every mutation is tried immediately and, if the
//     write fails (offline / transient), it is persisted and retried on
//     reconnect. Operations keep their order, so the server converges to the
//     local state once connectivity returns.

// ---- snapshot cache -------------------------------------------------------
const cacheKey = (owner: string) => `chrono.cache.${owner}`;

export function readCache(owner: string): Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(owner));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

export function writeCache(owner: string, snap: Snapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(owner), JSON.stringify(snap));
  } catch {
    /* quota — fine, we still have it in memory */
  }
}

// ---- write queue ----------------------------------------------------------
type Op =
  | { k: "upTask"; task: Task; owner: string }
  | { k: "upTasks"; tasks: Task[]; owner: string }
  | { k: "delTasks"; ids: string[] }
  | { k: "upProject"; project: Project; owner: string }
  | { k: "delProject"; id: string }
  | { k: "upFriend"; friend: Friend; owner: string }
  | { k: "delFriend"; id: string };

const QUEUE_KEY = "chrono.queue";
let queue: Op[] = loadQueue();
let activeFlush: Promise<void> | null = null;
let wired = false;

function loadQueue(): Op[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as Op[]) : [];
  } catch {
    return [];
  }
}

function persistQueue() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* ignore */
  }
}

function runOp(op: Op): Promise<void> {
  switch (op.k) {
    case "upTask":
      return repo.upsertTask(op.task, op.owner);
    case "upTasks":
      return repo.upsertTasks(op.tasks, op.owner);
    case "delTasks":
      return repo.deleteTasks(op.ids);
    case "upProject":
      return repo.upsertProject(op.project, op.owner);
    case "delProject":
      return repo.deleteProject(op.id);
    case "upFriend":
      return repo.upsertFriend(op.friend, op.owner);
    case "delFriend":
      return repo.deleteFriend(op.id);
  }
}

/** Whether there are writes still waiting to reach the server. */
export function pendingWrites(): number {
  return queue.length;
}

/** Number of times flush() has fully drained — lets the UI react to syncs. */
let drainTick = 0;
export function syncTick(): number {
  return drainTick;
}

// Always returns a promise tied to the currently-running drain. Callers that
// `await flush()` are guaranteed to wait for it, even if another path already
// kicked off a flush — important for joinLobby + reload, which must not run
// fetchAll while a pending delete is still in transit (otherwise the deleted
// row comes back from the server).
export function flush(): Promise<void> {
  if (activeFlush) return activeFlush;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return Promise.resolve();
  }
  activeFlush = (async () => {
    try {
      while (queue.length) {
        try {
          await runOp(queue[0]);
        } catch (e) {
          console.error("[chrono.sync] op failed:", queue[0]?.k, e);
          console.error("[chrono.sync] full op:", JSON.stringify(queue[0]));
          queue.shift();
          persistQueue();
          break;
        }
        queue.shift();
        persistQueue();
      }
      drainTick++;
    } finally {
      activeFlush = null;
    }
  })();
  return activeFlush;
}

/** Enqueue a write, attempt it now, and persist it if it can't go through yet. */
export function enqueue(op: Op) {
  wire();
  queue.push(op);
  persistQueue();
  void flush();
}

/** Drop the entire pending write queue. Used by the store's resetLocal()
 *  escape hatch when the user wants to force a fresh server pull (e.g. an
 *  older device build left stale ops queued under a previous auth.uid that
 *  RLS now rejects, blocking flush forever). */
export function clearQueue() {
  queue = [];
  persistQueue();
}

/** Wipe the snapshot cache for a specific signed-in user. Pair with
 *  clearQueue() before calling repo.fetchAll() to start fully clean. */
export function clearCache(owner: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(cacheKey(owner));
  } catch {
    /* ignore */
  }
}

// Retry the queue whenever the browser regains connectivity.
function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("online", () => void flush());
}
