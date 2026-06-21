"use client";

import type { Snapshot } from "@/lib/repo";

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
  } catch {}
}

export function pendingWrites(): number {
  return 0;
}

export function flush(): Promise<void> {
  return Promise.resolve();
}

export function enqueue() {}

export function clearQueue() {}

export function clearCache(owner: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(cacheKey(owner));
  } catch {}
}

export function syncTick(): number {
  return 0;
}
