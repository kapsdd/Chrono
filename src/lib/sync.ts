// Offline snapshot cache. On desktop the Rust process owns the file store in
// the app-data directory; the browser build falls back to localStorage.

import { invoke } from "@tauri-apps/api/core";
import { isDesktop } from "@/lib/desktop";
import type { Snapshot } from "@/lib/repo";

const cacheKey = (owner: string) => `chrono.cache.${owner}`;

export async function readCache(owner: string): Promise<Snapshot | null> {
  if (typeof window === "undefined") return null;
  try {
    if (isDesktop()) {
      const raw = await invoke<Snapshot | null>("read_cache", { owner });
      return raw ?? null;
    }
    const cached = window.localStorage.getItem(cacheKey(owner));
    return cached ? (JSON.parse(cached) as Snapshot) : null;
  } catch {
    return null;
  }
}

export async function writeCache(owner: string, snap: Snapshot): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (isDesktop()) {
      await invoke<void>("write_cache", { owner, snapshot: snap });
      return;
    }
    window.localStorage.setItem(cacheKey(owner), JSON.stringify(snap));
  } catch {
    /* quota / shutdown */
  }
}

export async function clearCache(owner: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (isDesktop()) {
      await invoke<void>("clear_cache", { owner });
      return;
    }
    window.localStorage.removeItem(cacheKey(owner));
  } catch {
    /* ignore */
  }
}

export function pendingWrites(): number {
  return 0;
}

export function flush(): Promise<void> {
  return Promise.resolve();
}

export function enqueue() {}

export function clearQueue() {}

export function syncTick(): number {
  return 0;
}
