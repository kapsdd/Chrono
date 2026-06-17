"use client";

import { create } from "zustand";
import type {
  Collaborator,
  Friend,
  Priority,
  Project,
  ProjectView,
  Role,
  Task,
} from "@/lib/types";
import { parseInput } from "@/lib/parseInput";

// Phase 1 persistence: a single localStorage blob. The async method signatures
// (Promise-returning) intentionally mirror the Phase 2 repository so swapping in
// the SQLite/Tauri backend later is a drop-in — the components already `await`.

export type ViewFilter = string | null;

/** The smart views in the sidebar (everything that isn't a single project). */
export type ViewId =
  | "inbox"
  | "today"
  | "plans"
  | "calendar"
  | "project"
  | "noproject"
  | "someday"
  | "archive"
  | "trash"
  | "settings";

const STORAGE_KEY = "chrono.v1";

// Accent colours cycled onto new projects (sidebar dots).
const PROJECT_COLORS = [
  "#a78bfa", // violet
  "#f472b6", // pink
  "#22d3ee", // cyan
  "#facc15", // amber
  "#34d399", // emerald
  "#fb7185", // rose
  "#818cf8", // indigo
];

interface Persisted {
  tasks: Task[];
  projects: Project[];
  friends: Friend[];
  activeProjectId: ViewFilter;
  activeView: ViewId;
}

interface ChronoState extends Persisted {
  ready: boolean;
  query: string;
  bootstrap: () => Promise<void>;
  setView: (view: ViewId) => void;
  setQuery: (q: string) => void;
  setActiveProject: (id: ViewFilter) => void;
  createProject: (name: string) => Promise<Project | null>;
  addFromInput: (raw: string, parentId?: string | null) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  toggleCollapse: (id: string) => void;
  deleteTask: (id: string) => Promise<void>;
  setTaskDue: (id: string, due: string | null) => void;
  setPriority: (id: string, priority: Priority) => void;
  setTaskOrder: (id: string, order: number) => void;
  // project view + sharing
  setProjectView: (projectId: string, view: ProjectView) => void;
  addCollaborator: (projectId: string, name: string, role?: Role) => void;
  setCollaboratorRole: (projectId: string, collaboratorId: string, role: Role) => void;
  removeCollaborator: (projectId: string, collaboratorId: string) => void;
  transferOwnership: (projectId: string, collaboratorId: string) => void;
  ensureOwner: (name: string, avatar?: string) => void;
  addFriend: (name: string, avatar?: string) => void;
  removeFriend: (id: string) => void;
}

// crypto.randomUUID is available in every browser CHRONO targets; the fallback
// keeps SSR / older runtimes from throwing.
const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.floor(performance.now() * 1000).toString(36)}`;

const nowIso = () => new Date().toISOString();

function load(): Persisted {
  const empty: Persisted = {
    tasks: [],
    projects: [],
    friends: [],
    activeProjectId: null,
    activeView: "plans",
  };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      // Backfill the drag-and-drop sort key for tasks saved before it existed.
      tasks: (parsed.tasks ?? []).map((t) => ({
        ...t,
        order: t.order ?? (Date.parse(t.createdAt) || 0),
      })),
      projects: parsed.projects ?? [],
      friends: parsed.friends ?? [],
      activeProjectId: parsed.activeProjectId ?? null,
      activeView: parsed.activeView ?? "plans",
    };
  } catch {
    return empty;
  }
}

export const useChronoStore = create<ChronoState>((set, get) => {
  // Write-through: snapshot the persisted slice on every mutation.
  const persist = () => {
    if (typeof window === "undefined") return;
    const { tasks, projects, friends, activeProjectId, activeView } = get();
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ tasks, projects, friends, activeProjectId, activeView }),
      );
    } catch {
      /* quota / private-mode — state still lives in memory this session */
    }
  };

  const findOrCreateProjectByName = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = get().projects.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing.id;
    const color = PROJECT_COLORS[get().projects.length % PROJECT_COLORS.length];
    const project: Project = {
      id: uid(),
      name: trimmed,
      shareId: uid(),
      color,
      createdAt: nowIso(),
    };
    set((s) => ({ projects: [...s.projects, project] }));
    return project.id;
  };

  const patchProject = (projectId: string, patch: (p: Project) => Project) => {
    set((s) => ({
      projects: s.projects.map((p) => (p.id === projectId ? patch(p) : p)),
    }));
    persist();
  };

  return {
    tasks: [],
    projects: [],
    friends: [],
    activeProjectId: null,
    activeView: "plans",
    query: "",
    ready: false,

    bootstrap: async () => {
      if (get().ready) return;
      set({ ...load(), ready: true });
    },

    setView: (view) => {
      set({ activeView: view, activeProjectId: null });
      persist();
    },

    setQuery: (q) => set({ query: q }),

    setActiveProject: (id) => {
      set({ activeProjectId: id, activeView: "project" });
      persist();
    },

    createProject: async (name) => {
      const id = findOrCreateProjectByName(name);
      if (!id) return null;
      persist();
      return get().projects.find((p) => p.id === id) ?? null;
    },

    addFromInput: async (raw, parentId = null) => {
      const parsed = parseInput(raw);
      if (!parsed.title) return;

      // A /Project token overrides scope; otherwise inherit the active view
      // (and, for subtasks, the parent's project).
      let projectId: ViewFilter = get().activeProjectId;
      if (parentId) {
        projectId = get().tasks.find((t) => t.id === parentId)?.projectId ?? projectId;
      }
      if (parsed.project) projectId = findOrCreateProjectByName(parsed.project);

      // New tasks sort to the top (smallest order) of their list.
      const minOrder = get().tasks.reduce(
        (m, t) => Math.min(m, t.order ?? 0),
        0,
      );
      const task: Task = {
        id: uid(),
        title: parsed.title,
        isCompleted: false,
        priority: parsed.priority as Priority,
        parentId,
        projectId,
        tags: parsed.tags,
        order: minOrder - 1,
        createdAt: nowIso(),
      };
      set((s) => ({ tasks: [...s.tasks, task] }));
      persist();
    },

    toggleComplete: async (id) => {
      // Completing a task completes its whole subtree; un-completing only the node.
      const tasks = get().tasks;
      const target = tasks.find((t) => t.id === id);
      if (!target) return;
      const next = !target.isCompleted;

      const descendants = new Set<string>([id]);
      if (next) {
        let grew = true;
        while (grew) {
          grew = false;
          for (const t of tasks) {
            if (t.parentId && descendants.has(t.parentId) && !descendants.has(t.id)) {
              descendants.add(t.id);
              grew = true;
            }
          }
        }
      }

      set({
        tasks: tasks.map((t) =>
          t.id === id || (next && descendants.has(t.id))
            ? { ...t, isCompleted: next }
            : t,
        ),
      });
      persist();
    },

    toggleCollapse: (id) => {
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, collapsed: !t.collapsed } : t,
        ),
      }));
      persist();
    },

    deleteTask: async (id) => {
      // Cascade: drop the node and its entire subtree (mirrors the FK rule).
      const tasks = get().tasks;
      const doomed = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const t of tasks) {
          if (t.parentId && doomed.has(t.parentId) && !doomed.has(t.id)) {
            doomed.add(t.id);
            grew = true;
          }
        }
      }
      set({ tasks: tasks.filter((t) => !doomed.has(t.id)) });
      persist();
    },

    setTaskDue: (id, due) => {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, due } : t)),
      }));
      persist();
    },

    setPriority: (id, priority) => {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, priority } : t)),
      }));
      persist();
    },

    setTaskOrder: (id, order) => {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, order } : t)),
      }));
      persist();
    },

    setProjectView: (projectId, view) => {
      patchProject(projectId, (p) => ({ ...p, view }));
    },

    addCollaborator: (projectId, name, role = "editor") => {
      const trimmed = name.trim();
      if (!trimmed) return;
      patchProject(projectId, (p) => {
        const existing = p.collaborators ?? [];
        if (
          existing.some(
            (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
          )
        ) {
          return p;
        }
        const collaborator: Collaborator = {
          id: uid(),
          name: trimmed,
          role,
          addedAt: nowIso(),
        };
        const collaborators = [...existing, collaborator];
        return { ...p, collaborators, shared: collaborators.length > 1 };
      });
    },

    setCollaboratorRole: (projectId, collaboratorId, role) => {
      patchProject(projectId, (p) => {
        let collaborators = (p.collaborators ?? []).map((c) =>
          c.id === collaboratorId ? { ...c, role } : c,
        );
        // Only one owner at a time — demote any other owner to admin.
        if (role === "owner") {
          collaborators = collaborators.map((c) =>
            c.id !== collaboratorId && c.role === "owner"
              ? { ...c, role: "admin" as Role }
              : c,
          );
        }
        return { ...p, collaborators };
      });
    },

    removeCollaborator: (projectId, collaboratorId) => {
      patchProject(projectId, (p) => {
        const collaborators = (p.collaborators ?? []).filter(
          (c) => c.id !== collaboratorId,
        );
        return { ...p, collaborators, shared: collaborators.length > 1 };
      });
    },

    transferOwnership: (projectId, collaboratorId) => {
      patchProject(projectId, (p) => {
        const collaborators = (p.collaborators ?? []).map((c) => {
          if (c.id === collaboratorId) return { ...c, role: "owner" as Role };
          if (c.role === "owner") return { ...c, role: "admin" as Role };
          return c;
        });
        return { ...p, collaborators };
      });
    },

    ensureOwner: (name, avatar) => {
      const trimmed = name.trim() || "Вы";
      set((s) => ({
        projects: s.projects.map((p) => {
          const existing = p.collaborators ?? [];
          if (existing.some((c) => c.role === "owner")) return p;
          const owner: Collaborator = {
            id: uid(),
            name: trimmed,
            avatar,
            role: "owner",
            addedAt: nowIso(),
          };
          return { ...p, collaborators: [owner, ...existing] };
        }),
      }));
      persist();
    },

    addFriend: (name, avatar) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (
        get().friends.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())
      ) {
        return;
      }
      const friend: Friend = { id: uid(), name: trimmed, avatar, addedAt: nowIso() };
      set((s) => ({ friends: [...s.friends, friend] }));
      persist();
    },

    removeFriend: (id) => {
      set((s) => ({ friends: s.friends.filter((f) => f.id !== id) }));
      persist();
    },
  };
});
