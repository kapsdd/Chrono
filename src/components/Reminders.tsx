"use client";

import { useEffect, useRef } from "react";
import { useChronoStore } from "@/store/useChronoStore";

// Due-date reminders (#4, client-side). Fires a desktop notification — native
// in the Electron shell, the Web Notification API in the browser — when a task
// reaches its due time while the app is open. No Discord bot required.
//
// A persisted "notified" set dedupes across reloads; a 24h floor stops a flood
// of ancient overdue tasks from firing on first launch.
const NOTIFIED_KEY = "chrono.notified";
const FLOOR_MS = 24 * 60 * 60 * 1000;

function loadNotified(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(NOTIFIED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveNotified(s: Set<string>) {
  try {
    // Keep the list bounded so it can't grow without limit.
    window.localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...s].slice(-500)));
  } catch {
    /* ignore */
  }
}

export function Reminders() {
  const tasks = useChronoStore((s) => s.tasks);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const notified = useRef<Set<string>>(loadNotified());

  // Ask for permission once.
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined") return;

    const check = () => {
      if (Notification.permission !== "granted") return;
      const now = Date.now();
      let changed = false;
      for (const t of tasksRef.current) {
        if (t.isCompleted || !t.due) continue;
        const due = Date.parse(t.due);
        if (Number.isNaN(due)) continue;
        // Key by id+due so each occurrence of a recurring task notifies once.
        const key = `${t.id}:${t.due}`;
        if (due <= now && due >= now - FLOOR_MS && !notified.current.has(key)) {
          notified.current.add(key);
          changed = true;
          try {
            new Notification("CHRONO — срок задачи", {
              body: t.title,
              tag: t.id,
            });
          } catch {
            /* notifications unavailable in this context */
          }
        }
      }
      if (changed) saveNotified(notified.current);
    };

    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
