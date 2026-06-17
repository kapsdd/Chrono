"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { SPRING } from "@/lib/motion";
import { Icon, type IconName } from "./icons";
import { useChronoStore, type ViewId } from "@/store/useChronoStore";

function focusSmartInput() {
  const el = document.getElementById("smart-input") as HTMLInputElement | null;
  el?.focus();
}

export function Sidebar() {
  const projects = useChronoStore((s) => s.projects);
  const tasks = useChronoStore((s) => s.tasks);
  const activeView = useChronoStore((s) => s.activeView);
  const activeProjectId = useChronoStore((s) => s.activeProjectId);
  const setView = useChronoStore((s) => s.setView);
  const setActiveProject = useChronoStore((s) => s.setActiveProject);
  const createProject = useChronoStore((s) => s.createProject);

  const [newName, setNewName] = useState("");

  const activeCount = (pid: string | null) =>
    tasks.filter(
      (t) => !t.isCompleted && (pid === null ? true : t.projectId === pid),
    ).length;

  const archivedCount = tasks.filter((t) => t.isCompleted).length;

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
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_4px_14px_rgba(139,92,246,0.5)]">
          <Icon name="star" size={16} />
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
        </div>

        {/* shared projects */}
        <SectionLabel>
          Совместные проекты <span className="text-violet-300/60">β</span>
        </SectionLabel>
        {sharedProjects.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {sharedProjects.map((p) => (
              <NavItem
                key={p.id}
                dot={p.color}
                label={p.name}
                count={activeCount(p.id)}
                active={activeView === "project" && activeProjectId === p.id}
                onClick={() => setActiveProject(p.id)}
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
            <NavItem
              key={p.id}
              dot={p.color}
              label={p.name}
              count={activeCount(p.id)}
              active={activeView === "project" && activeProjectId === p.id}
              onClick={() => setActiveProject(p.id)}
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
