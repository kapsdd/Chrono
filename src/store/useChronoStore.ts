"use client";

import { create } from "zustand";
import type {
  Collaborator,
  Friend,
  Priority,
  Project,
  ProjectView,
  Recurrence,
  Role,
  Task,
} from "@/lib/types";
import { parseInput } from "@/lib/parseInput";
import { repo } from "@/lib/repo";
import { writeCache, readCache } from "@/lib/sync";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { DEFAULT_KANBAN_COLUMNS, normalizeKanbanColumns } from "@/lib/kanban";
import {
  ref,
  onValue,
  off,
  push,
  set,
  get,
  child,
  update,
} from "firebase/database";
import { db } from "@/lib/firebase";

export type ViewFilter = string | null;

export type ViewId =
  | "inbox"
  | "today"
  | "plans"
  | "calendar"
  | "habits"
  | "notes"
  | "project"
  | "noproject"
  | "someday"
  | "archive"
  | "trash"
  | "settings";

const NAV_KEY = "chrono.nav";

const PROJECT_COLORS = [
  "#a78bfa",
  "#f472b6",
  "#22d3ee",
  "#facc15",
  "#34d399",
  "#fb7185",
  "#818cf8",
];

interface ChronoState {
  tasks: Task[];
  projects: Project[];
  friends: Friend[];
  activeProjectId: ViewFilter;
  activeView: ViewId;
  ready: boolean;
  query: string;
  bootstrap: () => Promise<void>;
  setView: (view: ViewId) => void;
  setQuery: (q: string) => void;
  setActiveProject: (id: ViewFilter) => void;
  createProject: (name: string) => Promise<Project | null>;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => Promise<void>;
  leaveProject: (id: string) => Promise<void>;
  addFromInput: (raw: string, parentId?: string | null) => Promise<void>;
  renameTask: (id: string, title: string) => void;
  toggleComplete: (id: string) => Promise<void>;
  toggleCollapse: (id: string) => void;
  deleteTask: (id: string) => Promise<void>;
  setTaskDue: (id: string, due: string | null) => void;
  setPriority: (id: string, priority: Priority) => void;
  setTaskNote: (id: string, note: string) => void;
  setTaskOrder: (id: string, order: number) => void;
  moveTask: (id: string, priority: Priority, order: number) => void;
  setProjectView: (projectId: string, view: ProjectView) => void;
  setKanbanColumn: (projectId: string, priority: Priority, label: string, color: string) => void;
  resetKanbanColumns: (projectId: string) => void;
  addCollaborator: (projectId: string, name: string, role?: Role) => void;
  setCollaboratorRole: (projectId: string, collaboratorId: string, role: Role) => void;
  removeCollaborator: (projectId: string, collaboratorId: string) => void;
  transferOwnership: (projectId: string, collaboratorId: string) => void;
  ensureOwner: (name: string, avatar?: string) => void;
  addFriend: (name: string, avatar?: string) => void;
  removeFriend: (id: string) => void;
  addTime: (id: string, seconds: number) => void;
  setRecurrence: (id: string, recurrence: Recurrence | null) => void;
  publishLobby: (projectId: string, password: string) => Promise<string | null>;
  unpublishLobby: (projectId: string) => Promise<void>;
  joinLobby: (code: string, password: string, name?: string, avatar?: string) => Promise<boolean>;
  updateLobbyMemberRole: (projectId: string, userId: string, role: "editor" | "viewer") => Promise<boolean>;
  refresh: () => Promise<void>;
  resetLocal: () => Promise<void>;
}

const PERIOD_MS: Record<Recurrence, number> = {
  daily: 86_400_000,
  weekly: 7 * 86_400_000,
  monthly: 30 * 86_400_000,
};

function nextStreak(prevIso: string | null | undefined, now: number, r: Recurrence): number {
  if (!prevIso) return 1;
  const gap = now - Date.parse(prevIso);
  return gap >= 0 && gap <= PERIOD_MS[r] * 1.5 ? -1 : 1;
}

function rollDue(due: string | null | undefined, now: number, r: Recurrence): string {
  const base = Math.max(now, due ? Date.parse(due) : now);
  return new Date(base + PERIOD_MS[r]).toISOString();
}

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.floor(performance.now() * 1000).toString(36)}`;

const nowIso = () => new Date().toISOString();

function loadNav(): { activeProjectId: ViewFilter; activeView: ViewId } {
  const fallback = { activeProjectId: null as ViewFilter, activeView: "plans" as ViewId };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(NAV_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<typeof fallback>;
    return {
      activeProjectId: p.activeProjectId ?? null,
      activeView: p.activeView ?? "plans",
    };
  } catch {
    return fallback;
  }
}

export const useChronoStore = create<ChronoState>((set, get) => {
  let ownerId: string | null = null;
  let subscribed = false;
  let realtimeListeners: Array<{ path: string; unsub: () => void }> = [];
  let knownProjectIds = new Set<string>();
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;

  const saveNav = () => {
    if (typeof window === "undefined") return;
    const { activeProjectId, activeView } = get();
    try {
      window.localStorage.setItem(NAV_KEY, JSON.stringify({ activeProjectId, activeView }));
    } catch {}
  };

  const cache = () => {
    if (!ownerId) return;
    const { tasks, projects, friends } = get();
    writeCache(ownerId, { tasks, projects, friends });
  };

  const saveProject = (p: Project) => {
    if (!ownerId) return;
    void repo.upsertProject(p, ownerId);
    cache();
  };

  const saveTask = (t: Task) => {
    if (!ownerId) return;
    void repo.upsertTask(t, ownerId);
    cache();
  };

  const saveTasks = (tasks: Task[]) => {
    if (!ownerId || !tasks.length) return;
    void repo.upsertTasks(tasks, ownerId);
    cache();
  };

  const reload = async () => {
    const user = auth.currentUser;
    const id = user?.uid ?? null;
    ownerId = id;
    if (!id) {
      set({ tasks: [], projects: [], friends: [], ready: true });
      return;
    }
    const cached = readCache(id);
    if (cached) set({ ...cached, ready: true });
    try {
      const snap = await repo.fetchAll(id);
      set({ ...snap, ready: true });
      writeCache(id, snap);
      const newIds = new Set(snap.projects.map((p) => p.id));
      const changed = newIds.size !== knownProjectIds.size || [...newIds].some((id) => !knownProjectIds.has(id));
      knownProjectIds = newIds;
      if (changed) setupRealtime();
    } catch (e) {
      console.error("Failed to load profile data", e);
      set({ ready: true });
    }
  };

  const stopRealtime = () => {
    realtimeListeners.forEach(({ path, unsub }) => {
      try { unsub(); } catch {}
    });
    realtimeListeners = [];
  };

  const setupRealtime = () => {
    stopRealtime();
    if (!ownerId) return;

    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        void reload();
      }, 150);
    };

    const userTasksRef = ref(db, `users/${ownerId}/tasks`);
    const unsub1 = onValue(userTasksRef, scheduleReload);
    realtimeListeners.push({ path: `users/${ownerId}/tasks`, unsub: () => off(userTasksRef, "value", unsub1) });

    const userProjectsRef = ref(db, `users/${ownerId}/projects`);
    const unsub2 = onValue(userProjectsRef, scheduleReload);
    realtimeListeners.push({ path: `users/${ownerId}/projects`, unsub: () => off(userProjectsRef, "value", unsub2) });

    const projects = get().projects;
    for (const p of projects) {
      if (p.published || p.shared) {
        const stRef = ref(db, `shared/${p.id}/tasks`);
        const unsubST = onValue(stRef, scheduleReload);
        realtimeListeners.push({ path: `shared/${p.id}/tasks`, unsub: () => off(stRef, "value", unsubST) });
      }
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
      ownerId: ownerId ?? undefined,
      name: trimmed,
      shareId: uid(),
      color,
      kanbanColumns: normalizeKanbanColumns(),
      createdAt: nowIso(),
    };
    set((s) => ({ projects: [...s.projects, project] }));
    saveProject(project);
    return project.id;
  };

  const patchProject = (projectId: string, patch: (p: Project) => Project) => {
    let updated: Project | undefined;
    set((s) => ({
      projects: s.projects.map((p) => {
        if (p.id !== projectId) return p;
        updated = patch(p);
        return updated;
      }),
    }));
    if (updated) saveProject(updated);
  };

  const patchTask = (id: string, patch: (t: Task) => Task) => {
    let updated: Task | undefined;
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        updated = patch(t);
        return updated;
      }),
    }));
    if (updated) saveTask(updated);
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
      set({ ...loadNav() });
      if (!subscribed) {
        subscribed = true;
        onAuthStateChanged(auth, (user: User | null) => {
          if (!user) {
            set({ tasks: [], projects: [], friends: [], ready: true });
            stopRealtime();
            return;
          }
          void reload().then(() => setupRealtime());
        });
      } else {
        await reload();
        setupRealtime();
      }
    },

    setView: (view) => {
      set({ activeView: view, activeProjectId: null });
      saveNav();
    },

    setQuery: (q) => set({ query: q }),

    setActiveProject: (id) => {
      set({ activeProjectId: id, activeView: "project" });
      saveNav();
    },

    createProject: async (name) => {
      const id = findOrCreateProjectByName(name);
      if (!id) return null;
      return get().projects.find((p) => p.id === id) ?? null;
    },

    renameProject: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      patchProject(id, (p) => ({ ...p, name: trimmed }));
    },

    deleteProject: async (id) => {
      const project = get().projects.find((p) => p.id === id);
      if (project && ownerId && project.ownerId && project.ownerId !== ownerId) {
        await get().leaveProject(id);
        return;
      }
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        tasks: s.tasks.filter((t) => t.projectId !== id),
        activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        activeView: s.activeProjectId === id ? "plans" : s.activeView,
      }));
      try {
        if (ownerId) await repo.deleteProject(id, ownerId);
      } catch (e) {
        console.error("deleteProject failed", e);
        await reload();
        return;
      }
      cache();
      saveNav();
    },

    leaveProject: async (id) => {
      if (!ownerId) return;
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        tasks: s.tasks.filter((t) => t.projectId !== id),
        activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        activeView: s.activeProjectId === id ? "plans" : s.activeView,
      }));
      cache();
      saveNav();
      try {
        await repo.leaveProject(id, ownerId);
      } catch (e) {
        console.error("leaveProject", e);
        await reload();
      }
    },

    addFromInput: async (raw, parentId = null) => {
      const parsed = parseInput(raw);
      if (!parsed.title) return;

      let projectId: ViewFilter = get().activeProjectId;
      if (parentId) {
        projectId = get().tasks.find((t) => t.id === parentId)?.projectId ?? projectId;
      }
      if (parsed.project) projectId = findOrCreateProjectByName(parsed.project);

      const minOrder = get().tasks.reduce((m, t) => Math.min(m, t.order ?? 0), 0);
      const task: Task = {
        id: uid(),
        title: parsed.title,
        isCompleted: false,
        priority: parsed.priority as Priority,
        parentId,
        projectId,
        tags: parsed.tags,
        note: "",
        order: minOrder - 1,
        createdAt: nowIso(),
      };
      set((s) => ({ tasks: [...s.tasks, task] }));
      saveTask(task);
    },

    renameTask: (id, title) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      patchTask(id, (t) => ({ ...t, title: trimmed }));
    },

    toggleComplete: async (id) => {
      let changed: Task[] = [];

      set((s) => {
        const target = s.tasks.find((t) => t.id === id);
        if (!target) return s;

        if (target.recurrence && !target.isCompleted) {
          const now = Date.now();
          const cont = nextStreak(target.lastCompletedAt, now, target.recurrence);
          const streak = cont === -1 ? (target.streak ?? 0) + 1 : 1;
          const nt = {
            ...target,
            streak,
            lastCompletedAt: new Date(now).toISOString(),
            due: rollDue(target.due, now, target.recurrence as Recurrence),
          };
          changed = [nt];
          return { tasks: s.tasks.map((t) => (t.id === id ? nt : t)) };
        }

        const next = !target.isCompleted;
        const descendants = new Set<string>([id]);
        if (next) {
          let grew = true;
          while (grew) {
            grew = false;
            for (const t of s.tasks) {
              if (t.parentId && descendants.has(t.parentId) && !descendants.has(t.id)) {
                descendants.add(t.id);
                grew = true;
              }
            }
          }
        }

        const updated = s.tasks.map((t) => {
          if (t.id === id || (next && descendants.has(t.id))) {
            const nt = { ...t, isCompleted: next };
            changed.push(nt);
            return nt;
          }
          return t;
        });
        return { tasks: updated };
      });

      if (changed.length) saveTasks(changed);
    },

    toggleCollapse: (id) => {
      patchTask(id, (t) => ({ ...t, collapsed: !t.collapsed }));
    },

    deleteTask: async (id) => {
      let taskMap = new Map<string, string | null>();
      let doomedIds: string[] = [];

      set((s) => {
        const doomed = new Set<string>([id]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const t of s.tasks) {
            if (t.parentId && doomed.has(t.parentId) && !doomed.has(t.id)) {
              doomed.add(t.id);
              grew = true;
            }
          }
        }
        for (const t of s.tasks) {
          if (doomed.has(t.id)) taskMap.set(t.id, t.projectId);
        }
        doomedIds = [...doomed];
        return { tasks: s.tasks.filter((t) => !doomed.has(t.id)) };
      });

      try {
        if (ownerId && doomedIds.length) await repo.deleteTasks(doomedIds, ownerId, taskMap);
      } catch (e) {
        console.error("deleteTask failed", e);
        await reload();
        return;
      }
      cache();
    },

    setTaskDue: (id, due) => {
      patchTask(id, (t) => ({ ...t, due }));
    },

    setPriority: (id, priority) => {
      patchTask(id, (t) => ({ ...t, priority }));
    },

    setTaskNote: (id, note) => {
      patchTask(id, (t) => ({ ...t, note }));
    },

    setTaskOrder: (id, order) => {
      patchTask(id, (t) => ({ ...t, order }));
    },

    moveTask: (id, priority, order) => {
      patchTask(id, (t) => ({ ...t, priority, order }));
    },

    setProjectView: (projectId, view) => {
      patchProject(projectId, (p) => ({ ...p, view }));
    },

    setKanbanColumn: (projectId, priority, label, color) => {
      const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : "#64748b";
      patchProject(projectId, (p) => ({
        ...p,
        kanbanColumns: normalizeKanbanColumns(p.kanbanColumns).map((c) =>
          c.priority === priority ? { ...c, label: label.trim() || c.label, color: safeColor } : c,
        ),
      }));
    },

    resetKanbanColumns: (projectId) => {
      patchProject(projectId, (p) => ({
        ...p,
        kanbanColumns: DEFAULT_KANBAN_COLUMNS.map((c) => ({ ...c })),
      }));
    },

    addCollaborator: (projectId, name, role = "editor") => {
      const trimmed = name.trim();
      if (!trimmed) return;
      patchProject(projectId, (p) => {
        const existing = p.collaborators ?? [];
        if (existing.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return p;
        const collaborator: Collaborator = {
          id: uid(),
          name: trimmed,
          role,
          addedAt: nowIso(),
        };
        return { ...p, collaborators: [...existing, collaborator] };
      });
    },

    setCollaboratorRole: (projectId, collaboratorId, role) => {
      patchProject(projectId, (p) => {
        let collaborators = (p.collaborators ?? []).map((c) =>
          c.id === collaboratorId ? { ...c, role } : c,
        );
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
      patchProject(projectId, (p) => ({
        ...p,
        collaborators: (p.collaborators ?? []).filter((c) => c.id !== collaboratorId),
      }));
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
      const touched: Project[] = [];
      set((s) => ({
        projects: s.projects.map((p) => {
          if (ownerId && p.ownerId && p.ownerId !== ownerId) return p;
          const existing = p.collaborators ?? [];
          if (existing.some((c) => c.role === "owner")) return p;
          const owner: Collaborator = {
            id: uid(),
            name: trimmed,
            avatar,
            role: "owner",
            addedAt: nowIso(),
          };
          const np = { ...p, collaborators: [owner, ...existing] };
          touched.push(np);
          return np;
        }),
      }));
      touched.forEach(saveProject);
    },

    addFriend: (name, avatar) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (get().friends.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) return;
      const friend: Friend = { id: uid(), name: trimmed, avatar, addedAt: nowIso() };
      set((s) => ({ friends: [...s.friends, friend] }));
      if (ownerId) void repo.upsertFriend(friend, ownerId);
      cache();
    },

    removeFriend: (id) => {
      set((s) => ({ friends: s.friends.filter((f) => f.id !== id) }));
      if (ownerId) void repo.deleteFriend(id, ownerId);
      cache();
    },

    addTime: (id, seconds) => {
      if (seconds <= 0) return;
      patchTask(id, (t) => ({ ...t, timeSpent: (t.timeSpent ?? 0) + Math.round(seconds) }));
    },

    setRecurrence: (id, recurrence) => {
      patchTask(id, (t) => ({
        ...t,
        recurrence,
        due: recurrence && !t.due ? rollDue(null, Date.now(), recurrence) : t.due,
        streak: recurrence ? t.streak ?? 0 : 0,
      }));
    },

    publishLobby: async (projectId, password) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) throw new Error("Проект не найден");
      if (!ownerId) throw new Error("Сначала войдите в аккаунт");
      const owner = ownerId;
      const code = makeJoinCode();
      await repo.publishProject(projectId, code, password, project, owner);
      patchProject(projectId, (p) => ({
        ...p,
        ownerId: p.ownerId ?? owner,
        published: true,
        joinCode: code,
        shared: true,
      }));
      return code;
    },

    unpublishLobby: async (projectId) => {
      try {
        await repo.unpublishProject(projectId);
        patchProject(projectId, (p) => ({
          ...p,
          published: false,
          joinCode: null,
          shared: false,
        }));
      } catch (e) {
        console.error("unpublishLobby", e);
      }
    },

    joinLobby: async (code, password, name, avatar) => {
      try {
        const joinedId = await repo.joinProject(code.trim(), password, name, avatar);
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("Необходима авторизация");
        await repo.addMember(joinedId, uid, name, avatar);
        await reload();
        set({
          activeProjectId: joinedId,
          activeView: "project",
          ready: true,
        });
        saveNav();
        setupRealtime();
        return true;
      } catch (e) {
        console.error("joinLobby", e);
        return false;
      }
    },

    updateLobbyMemberRole: async (projectId, userId, role) => {
      try {
        await repo.updateMemberRole(projectId, userId, role);
        return true;
      } catch (e) {
        console.error("updateLobbyMemberRole", e);
        return false;
      }
    },

    refresh: async () => {
      await reload();
    },

    resetLocal: async () => {
      if (ownerId) {
        const { clearCache } = await import("@/lib/sync");
        clearCache(ownerId);
      }
      set({ tasks: [], projects: [], friends: [], ready: false });
      await reload();
    },
  };
});

function makeJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${pick(3)}-${pick(3)}`;
}
