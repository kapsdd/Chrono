"use client";

import type { Friend, Project, Task } from "@/lib/types";
import {
  ref,
  set,
  update,
  remove,
  get,
  child,
  push,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";
import { db } from "@/lib/firebase";
import { normalizeKanbanColumns } from "@/lib/kanban";

// Firebase Realtime Database paths:
//   users/{uid}/projects/{projectId}  — personal + owned shared projects
//   users/{uid}/tasks/{taskId}        — tasks created by this user
//   users/{uid}/friends/{friendId}    — friends
//   shared/{projectId}/tasks/{taskId} — tasks in a shared project (all members)
//   shared/{projectId}/members/{uid}  — membership
//   shared/{projectId}/meta           — project metadata for members
//   joinCodes/{code}                  — maps lobby code → projectId + password

// ---- path helpers ----------------------------------------------------------
const userProjects = (uid: string) => `users/${uid}/projects`;
const userTasks = (uid: string) => `users/${uid}/tasks`;
const userFriends = (uid: string) => `users/${uid}/friends`;
const sharedTasks = (pid: string) => `shared/${pid}/tasks`;
const sharedMembers = (pid: string) => `shared/${pid}/members`;
const sharedMeta = (pid: string) => `shared/${pid}/meta`;
const joinCodes = () => "joinCodes";

// ---- project serialization -------------------------------------------------
function projectToDB(p: Project, ownerId: string) {
  return {
    id: p.id,
    owner_id: p.ownerId ?? ownerId,
    name: p.name,
    share_id: p.shareId,
    color: p.color ?? null,
    shared: p.shared ?? false,
    collaborators: p.collaborators ?? [],
    view: p.view ?? "list",
    kanban_columns: normalizeKanbanColumns(p.kanbanColumns),
    published: p.published ?? false,
    join_code: p.joinCode ?? null,
    created_at: p.createdAt,
  };
}

function dbToProject(r: Record<string, unknown>): Project {
  return {
    id: r.id as string,
    ownerId: (r.owner_id as string) ?? undefined,
    name: r.name as string,
    shareId: (r.share_id as string) ?? "",
    color: (r.color as string) ?? undefined,
    shared: (r.shared as boolean) ?? false,
    collaborators: (r.collaborators as Project["collaborators"]) ?? [],
    view: (r.view as Project["view"]) ?? "list",
    kanbanColumns: normalizeKanbanColumns(r.kanban_columns as Project["kanbanColumns"]),
    published: Boolean(r.published || r.join_code),
    joinCode: (r.join_code as string) ?? null,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

// ---- task serialization ----------------------------------------------------
function taskToDB(t: Task, ownerId: string) {
  return {
    id: t.id,
    owner_id: ownerId,
    title: t.title,
    is_completed: t.isCompleted,
    priority: t.priority,
    parent_id: t.parentId,
    project_id: t.projectId,
    tags: t.tags ?? [],
    order: t.order ?? null,
    due: t.due ?? null,
    collapsed: t.collapsed ?? false,
    time_spent: t.timeSpent ?? 0,
    note: t.note?.trim() ? t.note : null,
    recurrence: t.recurrence ?? null,
    streak: t.streak ?? 0,
    last_completed_at: t.lastCompletedAt ?? null,
    created_at: t.createdAt,
  };
}

function dbToTask(r: Record<string, unknown>): Task {
  return {
    id: r.id as string,
    title: r.title as string,
    isCompleted: (r.is_completed as boolean) ?? false,
    priority: (r.priority as Task["priority"]) ?? 0,
    parentId: (r.parent_id as string) ?? null,
    projectId: (r.project_id as string) ?? null,
    tags: (r.tags as string[]) ?? [],
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
    order: (r.order as number) ?? undefined,
    due: (r.due as string) ?? null,
    collapsed: (r.collapsed as boolean) ?? false,
    timeSpent: (r.time_spent as number) ?? 0,
    note: (r.note as string) ?? "",
    recurrence: (r.recurrence as Task["recurrence"]) ?? null,
    streak: (r.streak as number) ?? 0,
    lastCompletedAt: (r.last_completed_at as string) ?? null,
  };
}

// ---- friend serialization --------------------------------------------------
function friendToDB(f: Friend) {
  return {
    id: f.id,
    name: f.name,
    avatar: f.avatar ?? null,
    added_at: f.addedAt,
  };
}

function dbToFriend(r: Record<string, unknown>): Friend {
  return {
    id: r.id as string,
    name: r.name as string,
    avatar: (r.avatar as string) ?? undefined,
    addedAt: (r.added_at as string) ?? new Date().toISOString(),
  };
}

// ---- helpers ---------------------------------------------------------------
async function getSnapshot<T>(
  path: string,
  mapper: (r: Record<string, unknown>) => T,
): Promise<T[]> {
  const snap = await get(ref(db, path));
  if (!snap.exists()) return [];
  const val = snap.val() as Record<string, Record<string, unknown>>;
  return Object.values(val).map(mapper);
}

async function getSharedProjectIds(uid: string): Promise<string[]> {
  const snap = await get(ref(db, joinCodes()));
  if (!snap.exists()) return [];
  const codes = snap.val() as Record<string, { project_id: string }>;
  const projectIds = Object.values(codes).map((c) => c.project_id);
  const memberChecks = await Promise.all(
    projectIds.map(async (pid) => {
      const memberSnap = await get(child(ref(db, sharedMembers(pid)), uid));
      return memberSnap.exists() ? pid : null;
    }),
  );
  return memberChecks.filter((p): p is string => p !== null);
}

export interface Snapshot {
  projects: Project[];
  tasks: Task[];
  friends: Friend[];
}

export const repo = {
  async fetchAll(uid: string): Promise<Snapshot> {
    const [personalProjects, personalTasks, friends, sharedProjectIds] =
      await Promise.all([
        getSnapshot(`${userProjects(uid)}`, dbToProject),
        getSnapshot(`${userTasks(uid)}`, dbToTask),
        getSnapshot(`${userFriends(uid)}`, dbToFriend),
        getSharedProjectIds(uid),
      ]);

    const sharedProjects: Project[] = [];
    const sharedTasksAll: Task[] = [];

    for (const pid of sharedProjectIds) {
      const [metaSnap, tasksSnap] = await Promise.all([
        get(ref(db, sharedMeta(pid))),
        getSnapshot(`${sharedTasks(pid)}`, dbToTask),
      ]);
      if (metaSnap.exists()) {
        const meta = metaSnap.val() as Record<string, unknown>;
        sharedProjects.push(dbToProject({ ...meta, id: pid, shared: true }));
      }
      sharedTasksAll.push(...tasksSnap);
    }

    const allProjects = [...personalProjects, ...sharedProjects];
    const seen = new Set<string>(sharedTasksAll.map((t) => t.id));
    const allTasks = [
      ...sharedTasksAll,
      ...personalTasks.filter((t) => !seen.has(t.id)),
    ];

    return {
      projects: allProjects,
      tasks: allTasks,
      friends,
    };
  },

  async upsertProject(p: Project, ownerId: string) {
    await set(
      ref(db, `${userProjects(ownerId)}/${p.id}`),
      projectToDB(p, ownerId),
    );
    if (p.published && p.joinCode) {
      const metaSnap = await get(ref(db, sharedMeta(p.id)));
      if (metaSnap.exists()) {
        await update(ref(db, sharedMeta(p.id)), {
          name: p.name,
          color: p.color ?? null,
          view: p.view ?? "list",
          kanban_columns: normalizeKanbanColumns(p.kanbanColumns),
        });
      }
    }
  },

  async deleteProject(id: string, ownerId: string) {
    await remove(ref(db, `${userProjects(ownerId)}/${id}`));
    await remove(ref(db, sharedTasks(id)));
    await remove(ref(db, sharedMembers(id)));
    await remove(ref(db, sharedMeta(id)));
    const codeSnap = await get(ref(db, joinCodes()));
    if (codeSnap.exists()) {
      const codes = codeSnap.val() as Record<string, { project_id: string }>;
      for (const [code, data] of Object.entries(codes)) {
        if (data.project_id === id) {
          await remove(ref(db, `${joinCodes()}/${code}`));
        }
      }
    }
  },

  async upsertTask(t: Task, ownerId: string) {
    const row = taskToDB(t, ownerId);
    const updates: Record<string, unknown> = {};
    updates[`${userTasks(ownerId)}/${t.id}`] = row;
    if (t.projectId) {
      updates[`${sharedTasks(t.projectId)}/${t.id}`] = row;
    }
    await update(ref(db), updates);
  },

  async upsertTasks(tasks: Task[], ownerId: string) {
    if (tasks.length === 0) return;
    const updates: Record<string, unknown> = {};
    for (const t of tasks) {
      const row = taskToDB(t, ownerId);
      updates[`${userTasks(ownerId)}/${t.id}`] = row;
      if (t.projectId) {
        updates[`${sharedTasks(t.projectId)}/${t.id}`] = row;
      }
    }
    await update(ref(db), updates);
  },

  async deleteTasks(ids: string[], ownerId: string, taskMap?: Map<string, string | null>) {
    if (ids.length === 0) return;
    const updates: Record<string, null> = {};
    for (const id of ids) {
      updates[`${userTasks(ownerId)}/${id}`] = null;
      const pid = taskMap?.get(id);
      if (pid) {
        updates[`${sharedTasks(pid)}/${id}`] = null;
      }
    }
    await update(ref(db), updates);
  },

  async upsertFriend(f: Friend, ownerId: string) {
    await set(ref(db, `${userFriends(ownerId)}/${f.id}`), friendToDB(f));
  },

  async deleteFriend(id: string, ownerId: string) {
    await remove(ref(db, `${userFriends(ownerId)}/${id}`));
  },

  async publishProject(projectId: string, code: string, password: string, project: Project, ownerId: string) {
    console.log("[repo] publishProject start", projectId, code);
    const hash = await hashPassword(password);
    console.log("[repo] password hashed");
    await set(ref(db, `${joinCodes()}/${code}`), {
      project_id: projectId,
      password_hash: hash,
      owner_id: ownerId,
    });
    console.log("[repo] joinCode written");
    await set(ref(db, sharedMeta(projectId)), {
      name: project.name,
      color: project.color ?? null,
      owner_id: ownerId,
      shared: true,
      view: project.view ?? "list",
      kanban_columns: normalizeKanbanColumns(project.kanbanColumns),
      created_at: project.createdAt,
    });
    console.log("[repo] meta written");
    await set(ref(db, `${sharedMembers(projectId)}/${ownerId}`), {
      role: "owner",
      name: project.collaborators?.find((c) => c.role === "owner")?.name ?? "Владелец",
      avatar: project.collaborators?.find((c) => c.role === "owner")?.avatar ?? null,
      joined_at: new Date().toISOString(),
    });
    console.log("[repo] publishProject done");
  },

  async unpublishProject(projectId: string) {
    const codeSnap = await get(ref(db, joinCodes()));
    if (codeSnap.exists()) {
      const codes = codeSnap.val() as Record<string, { project_id: string }>;
      for (const [code, data] of Object.entries(codes)) {
        if (data.project_id === projectId) {
          await remove(ref(db, `${joinCodes()}/${code}`));
        }
      }
    }
    await remove(ref(db, sharedMeta(projectId)));
    await remove(ref(db, sharedMembers(projectId)));
    await remove(ref(db, sharedTasks(projectId)));
  },

  async joinProject(code: string, password: string, name?: string, avatar?: string) {
    const codeSnap = await get(child(ref(db, joinCodes()), code));
    if (!codeSnap.exists()) throw new Error("Неверный код");
    const codeData = codeSnap.val() as {
      project_id: string;
      password_hash: string;
      owner_id: string;
    };
    const valid = await verifyPassword(password, codeData.password_hash);
    if (!valid) throw new Error("Неверный пароль");
    return codeData.project_id;
  },

  async addMember(projectId: string, uid: string, name?: string, avatar?: string) {
    await set(ref(db, `${sharedMembers(projectId)}/${uid}`), {
      role: "editor",
      name: name ?? "Участник",
      avatar: avatar ?? null,
      joined_at: new Date().toISOString(),
    });
  },

  async fetchMembers(projectId: string) {
    return getSnapshot(`${sharedMembers(projectId)}`, (r: Record<string, unknown>) => ({
      user_id: r.user_id as string ?? "",
      role: r.role as string ?? "editor",
      name: (r.name as string) ?? null,
      avatar: (r.avatar as string) ?? null,
      joined_at: (r.joined_at as string) ?? "",
    }));
  },

  async leaveProject(projectId: string, userId: string) {
    await remove(ref(db, `${sharedMembers(projectId)}/${userId}`));
  },

  async updateMemberRole(projectId: string, userId: string, role: "editor" | "viewer") {
    await update(ref(db, `${sharedMembers(projectId)}/${userId}`), { role });
  },
};

// ---- password hashing (Web Crypto API) ------------------------------------
async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const encoded = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex === stored;
}
