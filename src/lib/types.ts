// Core domain types for CHRONO (Phase 1).
// These mirror prisma/schema.prisma — the canonical data model — but tags are
// denormalized to string[] on Task for Phase 1 simplicity. The canonical M:N
// Task<->Tag relation is restored when we move to the SQLite repository (Phase 2).

export type Priority = 0 | 1 | 2 | 3;

/** Project view modes (the List / Kanban / Gantt switcher). */
export type ProjectView = "list" | "board" | "gantt";

/** Repeat cadence for recurring tasks / habits. */
export type Recurrence = "daily" | "weekly" | "monthly";

/** Collaborator permission tiers, from most to least powerful. */
export type Role = "owner" | "admin" | "editor" | "viewer";

export interface Collaborator {
  id: string;
  /** Display name / Discord username. */
  name: string;
  /** Optional avatar URL. */
  avatar?: string;
  role: Role;
  addedAt: string; // ISO string
}

export interface Project {
  id: string;
  /** auth.uid() of the project owner. Preserved on edits so shared-project
   *  members never accidentally reassign ownership. */
  ownerId?: string;
  name: string;
  /** UUID exposed for the project-sharing feature. */
  shareId: string;
  /** Accent dot colour shown in the sidebar (hex). */
  color?: string;
  /** Marks a "shared" (collaborative) project for the sidebar grouping. */
  shared?: boolean;
  /** People this project is shared with, with their roles. */
  collaborators?: Collaborator[];
  /** Active view mode for this project. Defaults to "list". */
  view?: ProjectView;
  /** Published to the lobby (joinable by code + password). */
  published?: boolean;
  /** Lobby join code (visible to the owner so they can share it). */
  joinCode?: string | null;
  createdAt: string; // ISO string (localStorage-friendly)
}

/** A Discord friend you can quickly add to projects. */
export interface Friend {
  id: string;
  name: string;
  avatar?: string;
  addedAt: string;
}

/** The signed-in user (Discord or a local guest session). */
export interface Session {
  id: string;
  username: string;
  avatar?: string;
  provider: "discord" | "guest";
  grantedAt: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  priority: Priority;
  parentId: string | null;
  projectId: string | null;
  tags: string[]; // tag names
  createdAt: string; // ISO string
  /** Manual sort key (drag-and-drop). Lower = higher in the list. */
  order?: number;
  /** Optional due date (ISO). Drives the Gantt timeline length. */
  due?: string | null;
  /** UI-only: whether this task's subtree is collapsed. Persisted for convenience. */
  collapsed?: boolean;
  /** Tracked time in seconds (Pomodoro / manual timer). */
  timeSpent?: number;
  /** Repeat cadence; non-null makes this a recurring task / habit. */
  recurrence?: Recurrence | null;
  /** Consecutive on-time completions (habit streak). */
  streak?: number;
  /** ISO timestamp of the last completion (drives streak continuity). */
  lastCompletedAt?: string | null;
}

/** Result of parsing a Smart Input line. */
export interface ParsedInput {
  title: string;
  project: string | null;
  tags: string[];
  priority: Priority;
}

/** Payload for creating a task through the repository. */
export interface NewTask {
  title: string;
  priority?: Priority;
  parentId?: string | null;
  projectId?: string | null;
  tags?: string[];
}

/** A task with its children resolved + depth — the shape the tree renders. */
export interface TaskNode extends Task {
  children: TaskNode[];
  depth: number;
}
