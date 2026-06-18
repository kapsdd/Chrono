"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { SPRING } from "@/lib/motion";
import { Icon, type IconName } from "./icons";
import { APP_ICON } from "@/lib/brand";
import { useChronoStore, type ViewId } from "@/store/useChronoStore";

function focusSmartInput() {
  const el = document.getElementById("smart-input") as HTMLInputElement | null;
  el?.focus();
}

export function Sidebar({ onJoinLobby }: { onJoinLobby?: () => void }) {
  const projects = useChronoStore((s) => s.projects);
  const tasks = useChronoStore((s) => s.tasks);
  const activeView = useChronoStore((s) => s.activeView);
  const activeProjectId = useChronoStore((s) => s.activeProjectId);
  const setView = useChronoStore((s) => s.setView);
  const setActiveProject = useChronoStore((s) => s.setActiveProject);
  const createProject = useChronoStore((s) => s.createProject);
  const renameProject = useChronoStore((s) => s.renameProject);
  const deleteProject = useChronoStore((s) => s.deleteProject);

  const [newName, setNewName] = useState("");

  const activeCount = (pid: string | null) =>
    tasks.filter(
      (t) => !t.isCompleted && (pid === null ? true : t.projectId === pid),
    ).length;

  const archivedCount = tasks.filter((t) => t.isCompleted).length;
  const habitCount = tasks.filter((t) => t.recurrence && !t.isCompleted).length;

  const sharedProjects = projects.filter((p) => p.shared);
  const myProjects = projects.filter((p) => !p.shared);

  const addProject = () => {
    if (!newName.trim()) return;
    void createProject(newName);
    setNewName("");
  };

  return (
    <aside className="panel flex h-full w-64 shrink-0 flex-col border-r border-white/[0.06]">
      {/* logo */}
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="h-8 w-8 overflow-hidden rounded-lg bg-black shadow-[0_4px_14px_rgba(139,92,246,0.5)]">
          <img src={APP_ICON} alt="CHRONO" className="h-full w-full object-cover" draggable={false} />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-wide text-white/90">
            CHRONO
          </div>
          <div className="font-mono text-[9px] tracking-widest text-white/30">
            TASK · v0.1
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 pb-2">
        {/* smart views */}
        <div className="flex flex-col gap-0.5">
          <NavItem
            icon="list"
            label="Планы"
            active={activeView === "plans"}
            onClick={() => setView("plans")}
          />
          <NavItem
            icon="calendar"
            label="Календарь"
            active={activeView === "calendar"}
            onClick={() => setView("calendar")}
          />
          <NavItem
            icon="repeat"
            label="Привычки"
            count={habitCount}
            active={activeView === "habits"}
            onClick={() => setView("habits")}
          />
        </div>

        {/* shared projects */}
        <div className="mb-1 mt-4 flex items-center justify-between px-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/30">
            Совместные проекты <span className="text-violet-300/60">β</span>
          </span>
          <button
            onClick={onJoinLobby}
            title="Войти по коду"
            className="rounded-md px-1.5 py-0.5 text-[11px] text-violet-300/70 transition-colors hover:bg-white/5 hover:text-violet-200"
          >
            + код
          </button>
        </div>
        {sharedProjects.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {sharedProjects.map((p) => (
              <ProjectRow
                key={p.id}
                name={p.name}
                color={p.color}
                count={activeCount(p.id)}
                active={activeView === "project" && activeProjectId === p.id}
                onOpen={() => setActiveProject(p.id)}
                onRename={(name) => renameProject(p.id, name)}
                onDelete={() => void deleteProject(p.id)}
              />
            ))}
          </div>
        ) : (
          <div className="px-3 py-1 text-[11px] text-white/25">
            Пока нет общих проектов
          </div>
        )}

        {/* my projects */}
        <SectionLabel>Мои проекты</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {myProjects.map((p) => (
            <ProjectRow
              key={p.id}
              name={p.name}
              color={p.color}
              count={activeCount(p.id)}
              active={activeView === "project" && activeProjectId === p.id}
              onOpen={() => setActiveProject(p.id)}
              onRename={(name) => renameProject(p.id, name)}
              onDelete={() => void deleteProject(p.id)}
            />
          ))}
          <div className="flex items-center gap-2.5 px-3 py-1.5">
            <Icon name="plus" size={15} className="shrink-0 text-white/35" />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addProject();
              }}
              placeholder="Новый проект"
              className="w-full bg-transparent text-[13px] text-white/70 outline-none placeholder:text-white/30"
            />
          </div>
        </div>
      </div>

      {/* pinned bottom views */}
      <div className="flex flex-col gap-0.5 border-t border-white/[0.06] px-2.5 py-2">
        <NavItem
          icon="shuffle"
          label="Без проекта"
          active={activeView === "noproject"}
          onClick={() => setView("noproject")}
        />
        <NavItem
          icon="moon"
          label="Когда-нибудь"
          active={activeView === "someday"}
          onClick={() => setView("someday")}
        />
        <NavItem
          icon="archive"
          label="Архив"
          count={archivedCount}
          active={activeView === "archive"}
          onClick={() => setView("archive")}
        />
        <NavItem
          icon="trash"
          label="Корзина"
          active={activeView === "trash"}
          onClick={() => setView("trash")}
        />
        <NavItem
          icon="settings"
          label="Настройки"
          active={activeView === "settings"}
          onClick={() => setView("settings")}
        />
      </div>

      {/* new task */}
      <div className="px-3 pb-4 pt-1">
        <button
          onClick={focusSmartInput}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(139,92,246,0.4)] transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Icon name="plus" size={16} />
          Новая задача
        </button>
      </div>
    </aside>
  );
}

// Project row: opens on click, with rename (inline) and delete (two-step
// confirm) actions revealed on hover.
function ProjectRow({
  name,
  color,
  count,
  active,
  onOpen,
  onRename,
  onDelete,
}: {
  name: string;
  color?: string;
  count?: number;
  active: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [confirm, setConfirm] = useState(false);

  if (editing) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={color ? { backgroundColor: color, boxShadow: `0 0 8px ${color}` } : undefined}
        />
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (value.trim()) onRename(value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (value.trim()) onRename(value);
              setEditing(false);
            }
            if (e.key === "Escape") {
              setValue(name);
              setEditing(false);
            }
          }}
          className="w-full rounded-md border border-violet-400/40 bg-white/[0.04] px-1.5 py-0.5 text-[13px] text-white/90 outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "group/row relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors",
        active ? "text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white/85",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-lg border border-violet-400/30 bg-gradient-to-r from-violet-500/25 to-fuchsia-500/10"
          transition={SPRING}
        />
      )}
      <button onClick={onOpen} className="relative flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={color ? { backgroundColor: color, boxShadow: `0 0 8px ${color}` } : undefined}
        />
        <span className="truncate">{name}</span>
      </button>

      {confirm ? (
        <div className="relative flex items-center gap-1">
          <button
            onClick={() => {
              setConfirm(false);
              onDelete();
            }}
            className="rounded px-1.5 py-0.5 text-[11px] text-rose-300 hover:bg-rose-500/15"
          >
            Удалить
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="rounded px-1 py-0.5 text-[11px] text-white/40 hover:bg-white/5"
          >
            Нет
          </button>
        </div>
      ) : (
        <div className="relative flex items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100">
          <button
            onClick={() => {
              setValue(name);
              setEditing(true);
            }}
            title="Переименовать"
            className="grid h-6 w-6 place-items-center rounded-md text-white/40 hover:bg-white/5 hover:text-violet-300"
          >
            ✎
          </button>
          <button
            onClick={() => setConfirm(true)}
            title="Удалить проект"
            className="grid h-6 w-6 place-items-center rounded-md text-white/40 hover:bg-white/5 hover:text-rose-300"
          >
            ✕
          </button>
          {count ? (
            <span className="ml-0.5 font-mono text-[11px] text-white/30">{count}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 mt-4 px-3 text-[11px] font-medium uppercase tracking-wider text-white/30">
      {children}
    </div>
  );
}

function NavItem({
  icon,
  dot,
  label,
  count,
  active,
  onClick,
}: {
  icon?: IconName;
  dot?: string;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors",
        active ? "text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white/85",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-lg border border-violet-400/30 bg-gradient-to-r from-violet-500/25 to-fuchsia-500/10"
          transition={SPRING}
        />
      )}
      <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        {dot ? (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: dot,
              boxShadow: `0 0 8px ${dot}`,
            }}
          />
        ) : icon ? (
          <Icon
            name={icon}
            size={17}
            className={active ? "text-violet-200" : "text-current"}
          />
        ) : null}
      </span>
      <span className="relative flex-1 truncate">{label}</span>
      {count ? (
        <span
          className={clsx(
            "relative font-mono text-[11px]",
            active ? "text-violet-200/80" : "text-white/30",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
