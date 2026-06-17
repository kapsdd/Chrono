"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { SmartInput } from "@/components/SmartInput";
import { TaskTree } from "@/components/TaskTree";
import { CompletedSection } from "@/components/CompletedSection";
import { EmptyState } from "@/components/EmptyState";
import { Icon, type IconName } from "@/components/icons";
import { Intro } from "@/components/Intro";
import { AuthScreen } from "@/components/AuthScreen";
import { WindowControls } from "@/components/WindowControls";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { KanbanBoard } from "@/components/KanbanBoard";
import { GanttChart } from "@/components/GanttChart";
import { ProjectMembers } from "@/components/ProjectMembers";
import { FriendsModal } from "@/components/FriendsModal";
import { buildTree } from "@/lib/tree";
import { useChronoStore, type ViewId } from "@/store/useChronoStore";
import { useSession } from "@/store/useSession";
import { useUI } from "@/store/useUI";
import type { ProjectView } from "@/lib/types";

const VIEW_META: Record<Exclude<ViewId, "project">, { title: string; icon: IconName }> = {
  inbox: { title: "Входящие", icon: "inbox" },
  today: { title: "Сегодня", icon: "star" },
  plans: { title: "Планы", icon: "list" },
  calendar: { title: "Календарь", icon: "calendar" },
  noproject: { title: "Без проекта", icon: "shuffle" },
  someday: { title: "Когда-нибудь", icon: "moon" },
  archive: { title: "Архив", icon: "archive" },
  trash: { title: "Корзина", icon: "trash" },
  settings: { title: "Настройки", icon: "settings" },
};

const TASK_VIEWS: ViewId[] = ["plans", "calendar", "project", "noproject"];

export default function Home() {
  const ready = useChronoStore((s) => s.ready);
  const bootstrap = useChronoStore((s) => s.bootstrap);
  const tasks = useChronoStore((s) => s.tasks);
  const projects = useChronoStore((s) => s.projects);
  const activeView = useChronoStore((s) => s.activeView);
  const activeProjectId = useChronoStore((s) => s.activeProjectId);
  const query = useChronoStore((s) => s.query);
  const setProjectView = useChronoStore((s) => s.setProjectView);

  const session = useSession((s) => s.session);
  const hydrated = useSession((s) => s.hydrated);
  const hydrate = useSession((s) => s.hydrate);

  const sidebarCollapsed = useUI((s) => s.sidebarCollapsed);
  const hydrateUI = useUI((s) => s.hydrate);

  const [introDone, setIntroDone] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);

  useEffect(() => {
    hydrate();
    hydrateUI();
    void bootstrap();
  }, [hydrate, hydrateUI, bootstrap]);

  const q = query.trim().toLowerCase();
  const matchesQuery = (title: string) => q === "" || title.toLowerCase().includes(q);

  const { activeTasks, completedTasks } = useMemo(() => {
    const inProject = (id: string | null) => tasks.filter((t) => t.projectId === id);
    let active = tasks.filter((t) => !t.isCompleted);
    let completed: typeof tasks = [];

    switch (activeView) {
      case "inbox":
      case "noproject":
        active = inProject(null).filter((t) => !t.isCompleted);
        break;
      case "project":
        active = inProject(activeProjectId).filter((t) => !t.isCompleted);
        break;
      case "archive":
        active = [];
        completed = tasks.filter((t) => t.isCompleted);
        break;
      case "someday":
      case "trash":
      case "settings":
        active = [];
        break;
    }

    if (TASK_VIEWS.includes(activeView)) {
      completed = tasks.filter(
        (t) =>
          t.isCompleted &&
          (activeView === "project"
            ? t.projectId === activeProjectId
            : activeView === "inbox" || activeView === "noproject"
              ? !t.projectId
              : true),
      );
    }

    return {
      activeTasks: active
        .filter((t) => matchesQuery(t.title))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      completedTasks: completed
        .filter((t) => matchesQuery(t.title))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, activeView, activeProjectId, q]);

  const tree = useMemo(() => buildTree(activeTasks), [activeTasks]);

  const activeProject =
    activeView === "project" ? projects.find((p) => p.id === activeProjectId) : undefined;
  const projectView: ProjectView = activeProject?.view ?? "list";

  const meta =
    activeView === "project"
      ? { title: activeProject?.name ?? "Проект", icon: "list" as IconName }
      : VIEW_META[activeView];

  const projectColor = activeProject?.color;
  const showInput = TASK_VIEWS.includes(activeView) && !(activeView === "project" && projectView === "gantt");
  const isSettings = activeView === "settings";
  const nothingHere = ready && activeTasks.length === 0 && completedTasks.length === 0;

  // ---- startup gate ----
  const showIntro = !introDone;
  const showAuth = introDone && hydrated && !session;
  const showApp = introDone && hydrated && !!session;

  return (
    <AppShell>
      {/* always-available window chrome for intro / auth screens */}
      {!showApp && (
        <div className="drag-region absolute right-0 top-0 z-[60] flex h-12 items-center pr-2">
          <WindowControls />
        </div>
      )}

      {showApp && (
        <div className="flex h-full">
          <div
            className={`shrink-0 overflow-hidden transition-[width] duration-300 ${
              sidebarCollapsed ? "w-0" : "w-64"
            }`}
          >
            <Sidebar />
          </div>

          <main className="flex h-full min-w-0 flex-1 flex-col">
            <Topbar onOpenFriends={() => setFriendsOpen(true)} />

            <header className="flex items-center gap-3 px-8 pb-4 pt-6">
              <span
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-violet-200"
                style={
                  projectColor
                    ? { color: projectColor, borderColor: `${projectColor}55` }
                    : undefined
                }
              >
                <Icon name={meta.icon} size={18} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-white/90">{meta.title}</h1>
                {showInput && (
                  <p className="mt-0.5 text-xs text-white/35">
                    {activeTasks.length} активных · {completedTasks.length} выполнено
                  </p>
                )}
              </div>

              {activeView === "project" && activeProject && (
                <div className="ml-auto flex items-center gap-2">
                  <ViewSwitcher
                    value={projectView}
                    onChange={(v) => setProjectView(activeProject.id, v)}
                  />
                  <button
                    onClick={() => setMembersOpen(true)}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[12.5px] text-white/65 transition-colors hover:border-violet-400/30 hover:text-white/90"
                  >
                    <Icon name="users" size={15} />
                    Участники
                    {activeProject.collaborators && activeProject.collaborators.length > 0 && (
                      <span className="font-mono text-[11px] text-violet-200/70">
                        {activeProject.collaborators.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </header>

            {showInput && (
              <div className="px-8">
                <SmartInput />
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-8 py-5">
              {isSettings ? (
                <SettingsPanel />
              ) : activeView === "project" && projectView === "board" ? (
                <KanbanBoard tasks={activeTasks} />
              ) : activeView === "project" && projectView === "gantt" ? (
                <GanttChart tasks={activeTasks} />
              ) : nothingHere ? (
                <EmptyState
                  title={showInput ? "Тут пока ничего нет" : `${meta.title}: пусто`}
                  hint={
                    showInput
                      ? "Нажмите CTRL+N или SPACE для создания новой задачи"
                      : "Здесь появятся соответствующие задачи."
                  }
                  icon={meta.icon}
                  showGrammar={showInput}
                />
              ) : (
                <>
                  {tree.length > 0 && <TaskTree nodes={tree} topLevel />}
                  <CompletedSection tasks={completedTasks} />
                </>
              )}
            </div>
          </main>

          {membersOpen && activeProject && (
            <ProjectMembers project={activeProject} onClose={() => setMembersOpen(false)} />
          )}
          {friendsOpen && <FriendsModal onClose={() => setFriendsOpen(false)} />}
        </div>
      )}

      {showAuth && <AuthScreen />}
      {showIntro && <Intro onDone={() => setIntroDone(true)} />}
    </AppShell>
  );
}

function SettingsPanel() {
  const session = useSession((s) => s.session);
  const logout = useSession((s) => s.logout);
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="glass rounded-2xl p-6">
        <h2 className="text-base font-medium text-white/85">Аккаунт</h2>
        {session ? (
          <div className="mt-4 flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[13px] font-semibold text-white"
              style={session.avatar ? { background: `url(${session.avatar}) center/cover` } : undefined}
            >
              {!session.avatar && session.username[0]?.toUpperCase()}
            </span>
            <div className="flex-1">
              <div className="text-[14px] text-white/85">{session.username}</div>
              <div className="text-[12px] text-white/40">
                {session.provider === "discord" ? "Discord" : "Гостевая сессия"}
              </div>
            </div>
            <button
              onClick={logout}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[13px] text-white/65 hover:bg-white/5 hover:text-rose-300"
            >
              Выйти
            </button>
          </div>
        ) : (
          <p className="mt-1 text-[13px] text-white/40">Не выполнен вход.</p>
        )}
      </div>

      <div className="glass rounded-2xl p-6">
        <h2 className="text-base font-medium text-white/85">Внешний вид</h2>

        <div className="mt-4">
          <div className="mb-2 text-[13px] text-white/55">Тема оформления</div>
          <div className="flex gap-2">
            <ThemeOption
              active={theme === "dark"}
              onClick={() => setTheme("dark")}
              label="Тёмная"
              swatch="linear-gradient(135deg,#1a1230,#0f0b1c)"
            />
            <ThemeOption
              active={theme === "light"}
              onClick={() => setTheme("light")}
              label="Светлая"
              swatch="linear-gradient(135deg,#f4f1fb,#e6e0f5)"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_12px_rgba(139,92,246,0.6)]" />
          <span className="text-[13px] text-white/60">Акцент: Violet / Fuchsia</span>
        </div>
      </div>
    </div>
  );
}

function ThemeOption({
  active,
  onClick,
  label,
  swatch,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  swatch: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center gap-3 rounded-xl border p-3 transition-colors ${
        active
          ? "border-violet-400/50 bg-violet-500/10"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      <span
        className="h-9 w-9 rounded-lg border border-white/15"
        style={{ background: swatch }}
      />
      <span className="text-[13px] text-white/80">{label}</span>
      {active && <span className="ml-auto text-violet-300">✓</span>}
    </button>
  );
}
