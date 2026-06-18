"use client";

import type { Friend, Project, Task } from "@/lib/types";
import { supabase } from "@/lib/supabase";

// Translation layer between the app's camelCase domain objects and the
// snake_case Supabase rows. Row-Level Security (owner_id = auth.uid()) scopes
// every read and write to the signed-in Discord profile, so the same account
// resolves to the same projects/tasks on any device.

// ---- projects -------------------------------------------------------------
function projectToRow(p: Project, ownerId: string) {
  return {
    id: p.id,
    // Preserve the real owner on member edits; fall back to the current user for
    // brand-new projects that haven't been stamped yet.
    owner_id: p.ownerId ?? ownerId,
    name: p.name,
    share_id: p.shareId,
    color: p.color ?? null,
    shared: p.shared ?? false,
    collaborators: p.collaborators ?? [],
    view: p.view ?? "list",
    created_at: p.createdAt,
  };
}

function rowToProject(r: Record<string, unknown>): Project {
  return {
    id: r.id as string,
    ownerId: (r.owner_id as string) ?? undefined,
    name: r.name as string,
    shareId: r.share_id as string,
    color: (r.color as string) ?? undefined,
    shared: (r.shared as boolean) ?? false,
    collaborators: (r.collaborators as Project["collaborators"]) ?? [],
    view: (r.view as Project["view"]) ?? "list",
    // join_code only exists once migration 0002 is applied; tolerate its absence.
    published: Boolean(r.join_code),
    joinCode: (r.join_code as string) ?? null,
    createdAt: r.created_at as string,
  };
}

// ---- tasks ----------------------------------------------------------------
function taskToRow(t: Task, ownerId: string) {
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
    recurrence: t.recurrence ?? null,
    streak: t.streak ?? 0,
    last_completed_at: t.lastCompletedAt ?? null,
    created_at: t.createdAt,
  };
}

function rowToTask(r: Record<string, unknown>): Task {
  return {
    id: r.id as string,
    title: r.title as string,
    isCompleted: (r.is_completed as boolean) ?? false,
    priority: (r.priority as Task["priority"]) ?? 0,
    parentId: (r.parent_id as string) ?? null,
    projectId: (r.project_id as string) ?? null,
    tags: (r.tags as string[]) ?? [],
    createdAt: r.created_at as string,
    order: (r.order as number) ?? undefined,
    due: (r.due as string) ?? null,
    collapsed: (r.collapsed as boolean) ?? false,
    timeSpent: (r.time_spent as number) ?? 0,
    recurrence: (r.recurrence as Task["recurrence"]) ?? null,
    streak: (r.streak as number) ?? 0,
    lastCompletedAt: (r.last_completed_at as string) ?? null,
  };
}

// ---- friends --------------------------------------------------------------
function friendToRow(f: Friend, ownerId: string) {
  return {
    id: f.id,
    owner_id: ownerId,
    name: f.name,
    avatar: f.avatar ?? null,
    created_at: f.addedAt,
  };
}

function rowToFriend(r: Record<string, unknown>): Friend {
  return {
    id: r.id as string,
    name: r.name as string,
    avatar: (r.avatar as string) ?? undefined,
    addedAt: r.created_at as string,
  };
}

export interface Snapshot {
  projects: Project[];
  tasks: Task[];
  friends: Friend[];
}

export const repo = {
  // Pull the whole profile in parallel. RLS filters to the current user.
  async fetchAll(): Promise<Snapshot> {
    const [projects, tasks, friends] = await Promise.all([
      // select("*") rather than a fixed column list so the query still works if
      // migration 0002 (which adds join_code) hasn't been applied yet. The
      // bcrypt join_password is never mapped into app state by rowToProject.
      supabase.from("projects").select("*").order("created_at", { ascending: true }),
      supabase.from("tasks").select("*").order("order", { ascending: true, nullsFirst: true }),
      supabase.from("friends").select("*").order("created_at", { ascending: true }),
    ]);
    if (projects.error) throw projects.error;
    if (tasks.error) throw tasks.error;
    if (friends.error) throw friends.error;
    return {
      projects: (projects.data ?? []).map(rowToProject),
      tasks: (tasks.data ?? []).map(rowToTask),
      friends: (friends.data ?? []).map(rowToFriend),
    };
  },

  // Write methods throw on error so the offline sync queue can detect failures
  // and retry them later (see lib/sync.ts).
  async upsertProject(p: Project, ownerId: string) {
    const { error } = await supabase.from("projects").upsert(projectToRow(p, ownerId));
    if (error) throw error;
  },

  async deleteProject(id: string) {
    // tasks cascade via the project_id FK (on delete cascade).
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
  },

  async upsertTask(t: Task, ownerId: string) {
    const { error } = await supabase.from("tasks").upsert(taskToRow(t, ownerId));
    if (error) throw error;
  },

  async upsertTasks(tasks: Task[], ownerId: string) {
    if (tasks.length === 0) return;
    const { error } = await supabase
      .from("tasks")
      .upsert(tasks.map((t) => taskToRow(t, ownerId)));
    if (error) throw error;
  },

  async deleteTasks(ids: string[]) {
    if (ids.length === 0) return;
    const { error } = await supabase.from("tasks").delete().in("id", ids);
    if (error) throw error;
  },

  async upsertFriend(f: Friend, ownerId: string) {
    const { error } = await supabase.from("friends").upsert(friendToRow(f, ownerId));
    if (error) throw error;
  },

  async deleteFriend(id: string) {
    const { error } = await supabase.from("friends").delete().eq("id", id);
    if (error) throw error;
  },

  // ---- lobby (shared projects) -------------------------------------------
  // Owner publishes a project to the lobby with a join code + password.
  async publishProject(projectId: string, code: string, password: string) {
    const { error } = await supabase.rpc("publish_project", {
      p_project: projectId,
      p_code: code,
      p_password: password,
    });
    if (error) throw error;
  },

  async unpublishProject(projectId: string) {
    const { error } = await supabase.rpc("unpublish_project", { p_project: projectId });
    if (error) throw error;
  },

  // Join by code + password; resolves the joined project's id.
  async joinProject(code: string, password: string, name?: string, avatar?: string) {
    const { data, error } = await supabase.rpc("join_project", {
      p_code: code,
      p_password: password,
      p_name: name ?? null,
      p_avatar: avatar ?? null,
    });
    if (error) throw error;
    return data as string;
  },

  // Lobby members of a project (the owner is implicit, not in this table).
  async fetchMembers(projectId: string) {
    const { data, error } = await supabase
      .from("project_members")
      .select("user_id,role,name,avatar,joined_at")
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Array<{
      user_id: string;
      role: string;
      name: string | null;
      avatar: string | null;
      joined_at: string;
    }>;
  },

  async leaveProject(projectId: string, userId: string) {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);
    if (error) throw error;
  },
};
