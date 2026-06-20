"use client";

import { create } from "zustand";
import type { Note } from "@/lib/types";

// Notes live in localStorage (per-user). Cloud sync can be added later by
// adding a Supabase table — the store is shaped so the only change needed
// would be swapping save()/load() for a repo call.

const STORAGE_PREFIX = "chrono.notes:";
const LAST_OWNER_KEY = "chrono.notes:lastOwner";

function ownerKey(ownerId: string | null) {
  return `${STORAGE_PREFIX}${ownerId ?? "guest"}`;
}

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

const nowIso = () => new Date().toISOString();

function load(ownerId: string | null): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ownerKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Note[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(ownerId: string | null, notes: Note[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ownerKey(ownerId), JSON.stringify(notes));
    window.localStorage.setItem(LAST_OWNER_KEY, ownerId ?? "guest");
  } catch {
    /* quota / private mode */
  }
}

interface NotesState {
  notes: Note[];
  activeId: string | null;
  ownerId: string | null;
  hydrated: boolean;

  hydrate: (ownerId: string | null) => void;
  setActive: (id: string | null) => void;
  create: (preset?: Partial<Note>) => Note;
  update: (id: string, patch: Partial<Note>) => void;
  remove: (id: string) => void;
  togglePinned: (id: string) => void;
}

export const useNotes = create<NotesState>((set, get) => ({
  notes: [],
  activeId: null,
  ownerId: null,
  hydrated: false,

  hydrate: (ownerId) => {
    const notes = load(ownerId);
    const sorted = [...notes].sort((a, b) =>
      a.pinned === b.pinned
        ? (a.updatedAt < b.updatedAt ? 1 : -1)
        : a.pinned
          ? -1
          : 1,
    );
    set({
      notes: sorted,
      ownerId,
      hydrated: true,
      activeId: sorted[0]?.id ?? null,
    });
  },

  setActive: (id) => set({ activeId: id }),

  create: (preset) => {
    const note: Note = {
      id: uid(),
      title: preset?.title ?? "Без названия",
      content: preset?.content ?? "",
      pinned: preset?.pinned ?? false,
      color: preset?.color,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const notes = [note, ...get().notes];
    set({ notes, activeId: note.id });
    save(get().ownerId, notes);
    return note;
  },

  update: (id, patch) => {
    const notes = get().notes.map((n) =>
      n.id === id ? { ...n, ...patch, updatedAt: nowIso() } : n,
    );
    set({ notes });
    save(get().ownerId, notes);
  },

  remove: (id) => {
    const notes = get().notes.filter((n) => n.id !== id);
    const activeId =
      get().activeId === id ? notes[0]?.id ?? null : get().activeId;
    set({ notes, activeId });
    save(get().ownerId, notes);
  },

  togglePinned: (id) => {
    const notes = get().notes
      .map((n) => (n.id === id ? { ...n, pinned: !n.pinned, updatedAt: nowIso() } : n))
      .sort((a, b) =>
        a.pinned === b.pinned
          ? (a.updatedAt < b.updatedAt ? 1 : -1)
          : a.pinned
            ? -1
            : 1,
      );
    set({ notes });
    save(get().ownerId, notes);
  },
}));
