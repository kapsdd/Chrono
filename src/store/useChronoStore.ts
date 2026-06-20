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
import { enqueue, flush, pendingWrites, readCache, writeCache } from "@/lib/sync";
import { supabase } from "@/lib/supabase";
import { DEFAULT_KANBAN_COLUMNS, normalizeKanbanColumns } from "@/lib/kanban";

// Persistence: Supabase, keyed on the signed-in Discord profile (owner_id =
// auth.uid()). Mutations update local state optimistically and write through to
// Supabase in the background, so a profile's projects follow it across devices.
// Mutators keep their Promise-returning signatures — components already await.

export type ViewFilter = string | null;

/** The smart views in the sidebar (everything that isn't a single project). */
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

// Device-local UI navigation state. This is a per-device preference, not profile
// data, so it stays in localStorage rather than syncing through Supabase.
const NAV_KEY = "chrono.nav";

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
  addFromInput: (raw: string, parentId?: string | null) => Promise<void>;
  renameTask: (id: string, title: string) => void;
  toggleComplete: (id: string) => Promise<void>;
  toggleCollapse: (id: string) => void;
  deleteTask: (id: string) => Promise<void>;
  setTaskDue: (id: string, due: string | null) => void;
  setPriority: (id: string, priority: Priority) => void;
  setTaskNote: (id: string, note: string) => void;
  setTaskOrder: (id: string, order: number) => void;
  // project view + sharing
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
  // time tracking (#11) + recurrence / habits (#14)
  addTime: (id: string, seconds: number) => void;
  setRecurrence: (id: string, recurrence: Recurrence | null) => void;
  // lobby — shared projects joined by code + password (#19)
  publishLobby: (projectId: string, password: string) => Promise<string | null>;
  unpublishLobby: (projectId: string) => Promise<void>;
  joinLobby: (
    code: string,
    password: string,
    name?: string,
    avatar?: string,
  ) => Promise<boolean>;
  /** Re-pull the signed-in profile's data from the server. */
  refresh: () => Promise<void>;
}

// Streak/roll helpers for recurring tasks. A check-in continues the streak if
// the previous one happened within ~1.5 periods; otherwise it resets to 1.
const PERIOD_MS: Record<Recurrence, number> = {
  daily: 86_400_000,
  weekly: 7 * 86_400_000,
  monthly: 30 * 86_400_000,
};

function nextStreak(prevIso: string | null | undefined, now: number, r: Recurrence): number {
  if (!prevIso) return 1;
  const gap = now - Date.parse(prevIso);
  return gap >= 0 && gap <= PERIOD_MS[r] * 1.5 ? -1 : 1; // -1 = "continue" sentinel
}

function rollDue(due: string | null | undefined, now: number, r: Recurrence): string {
  const base = Math.max(now, due ? Date.parse(due) : now);
  return new Date(base + PERIOD_MS[r]).toISOString();
}

// crypto.randomUUID yields a valid uuid — matching the uuid primary keys in the
// Supabase schema. The fallback keeps SSR / older runtimes from throwing.
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
  // Owner of the rows we write — auth.uid() of the signed-in Discord profile.
  // Null when signed out; mutations become no-op writes until a profile loads.
  let ownerId: string | null = null;
  let subscribed = false;

  const saveNav = () => {
    if (typeof window === "undefined") return;
    const { activeProjectId, activeView } = get();
    try {
      window.localStorage.setItem(NAV_KEY, JSON.stringify({ activeProjectId, activeView }));
    } catch {
      /* quota / private-mode */
    }
  };

  // Writes created before the profile finishes loading (ownerId still null).
  // Rather than silently dropping them — which left rows only in memory and is
  // the root cause of "project missing" on publish — we stash a closure here and
  // replay it the moment ownerId resolves (see reload()), so every create still
  // reaches the DB. Each closure stamps the now-known owner onto its payload.
  let deferred: Array<(owner: string) => void> = [];
  const flushDeferred = (owner: string) => {
    if (!deferred.length) return;
    const pending = deferred;
    deferred = [];
    pending.forEach((fn) => fn(owner));
  };

  // Snapshot the local data into the offline cache for instant next-launch load.
  const cache = () => {
    if (!ownerId) return;
    const { tasks, projects, friends } = get();
    writeCache(ownerId, { tasks, projects, friends });
  };

  // Write-through helpers: update the offline queue (which writes through to
  // Supabase, or retries later if offline), then refresh the local cache. When
  // ownerId isn't known yet, defer the enqueue instead of dropping it.
  const saveProject = (p: Project) => {
    if (ownerId) enqueue({ k: "upProject", project: p, owner: ownerId });
    else deferred.push((owner) => enqueue({ k: "upProject", project: { ...p, ownerId: p.ownerId ?? owner }, owner }));
    cache();
  };
  const saveTask = (t: Task) => {
    if (ownerId) enqueue({ k: "upTask", task: t, owner: ownerId });
    else deferred.push((owner) => enqueue({ k: "upTask", task: t, owner }));
    cache();
  };
  const saveTasks = (tasks: Task[]) => {
    if (!tasks.length) return;
    if (ownerId) enqueue({ k: "upTasks", tasks, owner: ownerId });
    else deferred.push((owner) => enqueue({ k: "upTasks", tasks, owner }));
    cache();
  };

  // Load the signed-in profile's data, or clear to empty when signed out.
  const reload = async () => {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user?.id ?? null;
    ownerId = id;
    if (!id) {
      set({ tasks: [], projects: [], friends: [], ready: true });
      return;
    }
    // The profile is now known — replay any writes made before it loaded so
    // they reach the DB instead of living only in memory.
    flushDeferred(id);
    // Paint cached data immediately (offline-first), then reconcile with the
    // server. If the fetch fails (offline), the cache stays on screen.
    const cached = readCache(id);
    if (cached) set({ ...cached, ready: true });
    try {
      // Drain writes queued in a previous session BEFORE pulling the snapshot.
      // Otherwise a delete that never reached the server (e.g. the app closed
      // before its request finished) gets undone when the still-present row
      // comes back in fetchAll. If writes remain queued afterwards (offline),
      // keep the optimistic cache rather than reconciling against stale data.
      await flush();
      if (pendingWrites() > 0) {
        set({ ready: true });
        return;
      }
      const snap = await repo.fetchAll();
      set({ ...snap, ready: true });
      writeCache(id, snap);
    } catch (e) {
      console.error("Failed to load profile data", e);
      set({ ready: true });
    }
  };

  // ---- realtime sync (#19) ----
  // Subscribe to row changes on tasks/projects; RLS scopes events to rows this
  // user can see, so collaborators on a shared project get each other's edits
  // live. We reconcile by reloading (debounced), but only once our own pending
  // writes have drained, so a remote event never clobbers a local edit.
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let reloadTimer: number | undefined;

  const scheduleReload = () => {
    if (typeof window === "undefined") return;
    window.clearTimeout(reloadTimer);
    reloadTimer = window.setTimeout(() => {
      if (pendingWrites() > 0) {
        scheduleReload(); // our writes haven't landed yet — wait
        return;
      }
      void reload();
    }, 900);
  };

  const subscribeRealtime = () => {
    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
    }
    if (!ownerId) return;
    channel = supabase
      .channel("chrono-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, scheduleReload)
      .subscribe();
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
      // Restore device-local nav, load profile data, and reload whenever the
      // signed-in profile changes (login, logout, switching accounts).
      set({ ...loadNav() });
      if (!subscribed) {
        subscribed = true;
        supabase.auth.onAuthStateChange(() => {
          void reload().then(subscribeRealtime);
        });
      }
      await reload();
      subscribeRealtime();
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
      // Drop the project and its tasks locally; the DB cascades tasks via FK.
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        tasks: s.tasks.filter((t) => t.projectId !== id),
        activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        activeView: s.activeProjectId === id ? "plans" : s.activeView,
      }));
      enqueue({ k: "delProject", id });
      cache();
      saveNav();
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
      const tasks = get().tasks;
      const target = tasks.find((t) => t.id === id);
      if (!target) return;

      // Recurring task / habit: completing is a "check-in" — bump the streak,
      // roll the due date to the next period, and stay active rather than done.
      if (target.recurrence && !target.isCompleted) {
        const now = Date.now();
        const cont = nextStreak(target.lastCompletedAt, now, target.recurrence);
        const streak = cont === -1 ? (target.streak ?? 0) + 1 : 1;
        patchTask(id, (t) => ({
          ...t,
          streak,
          lastCompletedAt: new Date(now).toISOString(),
          due: rollDue(t.due, now, t.recurrence as Recurrence),
        }));
        return;
      }

      // Completing a task completes its whole subtree; un-completing only the node.
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

      const changed: Task[] = [];
      const updated = tasks.map((t) => {
        if (t.id === id || (next && descendants.has(t.id))) {
          const nt = { ...t, isCompleted: next };
          changed.push(nt);
          return nt;
        }
        return t;
      });
      set({ tasks: updated });
      saveTasks(changed);
    },

    toggleCollapse: (id) => {
      patchTask(id, (t) => ({ ...t, collapsed: !t.collapsed }));
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
      enqueue({ k: "delTasks", ids: [...doomed] });
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
        if (existing.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
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
      const touched: Project[] = [];
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
      if (get().friends.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
        return;
      }
      const friend: Friend = { id: uid(), name: trimmed, avatar, addedAt: nowIso() };
      set((s) => ({ friends: [...s.friends, friend] }));
      if (ownerId) enqueue({ k: "upFriend", friend, owner: ownerId });
      else deferred.push((owner) => enqueue({ k: "upFriend", friend, owner }));
      cache();
    },

    removeFriend: (id) => {
      set((s) => ({ friends: s.friends.filter((f) => f.id !== id) }));
      enqueue({ k: "delFriend", id });
      cache();
    },

    // ---- time tracking (#11) ----
    addTime: (id, seconds) => {
      if (seconds <= 0) return;
      patchTask(id, (t) => ({ ...t, timeSpent: (t.timeSpent ?? 0) + Math.round(seconds) }));
    },

    // ---- recurrence / habits (#14) ----
    setRecurrence: (id, recurrence) => {
      patchTask(id, (t) => ({
        ...t,
        recurrence,
        // Seed a due date so the first check-in has something to roll forward.
        due: recurrence && !t.due ? rollDue(null, Date.now(), recurrence) : t.due,
        streak: recurrence ? t.streak ?? 0 : 0,
      }));
    },

    // ---- lobby (#19) ----
    publishLobby: async (projectId, password) => {
      // Throws on failure so the UI can surface the real reason (missing RPC =
      // migration not applied, or auth error = not signed in).
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) throw new Error("Проект не найден");
      if (!ownerId) throw new Error("Сначала войдите в аккаунт");
      // Capture into a const so the type stays `string` inside the closure below
      // (a captured `let` widens back to `string | null`).
      const owner = ownerId;

      // The publish_project RPC scopes its UPDATE to (id, owner_id = auth.uid()).
      // If the project's row isn't in the DB yet it matches 0 rows and raises
      // "not owner or project missing". That happens when the create write is
      // still queued, or the project was created before the profile loaded (so
      // saveProject skipped the enqueue). Drain the queue and write the row
      // through synchronously before publishing, preserving the real owner.
      await flush();
      await repo.upsertProject({ ...project, ownerId: project.ownerId ?? owner }, owner);

      const code = makeJoinCode();
      await repo.publishProject(projectId, code, password);
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
        patchProject(projectId, (p) => ({ ...p, published: false, joinCode: null }));
      } catch (e) {
        console.error("unpublishLobby", e);
      }
    },

    joinLobby: async (code, password, name, avatar) => {
      try {
        await repo.joinProject(code.trim(), password, name, avatar);
        await reload(); // pull the newly visible shared project + its tasks
        subscribeRealtime();
        return true;
      } catch (e) {
        console.error("joinLobby", e);
        return false;
      }
    },

    refresh: async () => {
      await reload();
    },
  };
});

// Short, unambiguous lobby code (no easily-confused chars), e.g. "K7P-29Q".
function makeJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${pick(3)}-${pick(3)}`;
}
