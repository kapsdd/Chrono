"use client";

import { create } from "zustand";
import type { Note } from "@/lib/types";
import { repo } from "@/lib/repo";
import { auth, db } from "@/lib/firebase";
import { ref, onValue, off } from "firebase/database";

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

const nowIso = () => new Date().toISOString();

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

let unsubscribe: (() => void) | null = null;

export const useNotes = create<NotesState>((set, get) => ({
  notes: [],
  activeId: null,
  ownerId: null,
  hydrated: false,

  hydrate: (ownerId) => {
    // Clean up previous listener
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (!ownerId) {
      set({ notes: [], ownerId: null, hydrated: true, activeId: null });
      return;
    }

    // Set up realtime listener
    const notesRef = ref(db, `users/${ownerId}/notes`);
    const handler = onValue(notesRef, (snap) => {
      const raw = snap.val();
      const notes: Note[] = raw
        ? Object.values(raw as Record<string, Record<string, unknown>>).map((r) => ({
            id: r.id as string,
            title: (r.title as string) ?? "",
            content: (r.content as string) ?? "",
            pinned: (r.pinned as boolean) ?? false,
            color: (r.color as string) ?? undefined,
            createdAt: (r.created_at as string) ?? new Date().toISOString(),
            updatedAt: (r.updated_at as string) ?? new Date().toISOString(),
          }))
        : [];

      const sorted = [...notes].sort((a, b) =>
        a.pinned === b.pinned
          ? (a.updatedAt < b.updatedAt ? 1 : -1)
          : a.pinned
            ? -1
            : 1,
      );

      const prev = get().activeId;
      set({
        notes: sorted,
        ownerId,
        hydrated: true,
        activeId: sorted.find((n) => n.id === prev)?.id ?? sorted[0]?.id ?? null,
      });
    });

    unsubscribe = () => off(notesRef, "value", handler);
    set({ ownerId, hydrated: false });
  },

  setActive: (id) => set({ activeId: id }),

  create: (preset) => {
    const ownerId = get().ownerId;
    if (!ownerId) return { id: "", title: "", content: "", createdAt: "", updatedAt: "" };

    const note: Note = {
      id: uid(),
      title: preset?.title ?? "Без названия",
      content: preset?.content ?? "",
      pinned: preset?.pinned ?? false,
      color: preset?.color,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    void repo.upsertNote(note, ownerId);
    set({ activeId: note.id });
    return note;
  },

  update: (id, patch) => {
    const ownerId = get().ownerId;
    if (!ownerId) return;
    const existing = get().notes.find((n) => n.id === id);
    if (!existing) return;
    const updated = { ...existing, ...patch, updatedAt: nowIso() };
    void repo.upsertNote(updated, ownerId);
  },

  remove: (id) => {
    const ownerId = get().ownerId;
    if (!ownerId) return;
    void repo.deleteNote(id, ownerId);
    if (get().activeId === id) {
      const remaining = get().notes.filter((n) => n.id !== id);
      set({ activeId: remaining[0]?.id ?? null });
    }
  },

  togglePinned: (id) => {
    const ownerId = get().ownerId;
    if (!ownerId) return;
    const existing = get().notes.find((n) => n.id === id);
    if (!existing) return;
    const updated = { ...existing, pinned: !existing.pinned, updatedAt: nowIso() };
    void repo.upsertNote(updated, ownerId);
  },
}));
