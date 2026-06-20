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
import { LobbyJoinModal } from "@/components/LobbyJoinModal";
import { CalendarView } from "@/components/CalendarView";
import { HabitsView } from "@/components/HabitsView";
import { NotesView } from "@/components/NotesView";
import { Reminders } from "@/components/Reminders";
import { CommandPalette } from "@/components/CommandPalette";
import { buildTree } from "@/lib/tree";
import { useChronoStore, type ViewId } from "@/store/useChronoStore";
import { useSession } from "@/store/useSession";
import { ACHIEVEMENT_THEMES, useUI, THEMES } from "@/store/useUI";
import { normalizeKanbanColumns } from "@/lib/kanban";
import type { KanbanColumn, Priority, ProjectView } from "@/lib/types";

const VIEW_META: Record<Exclude<ViewId, "project">, { title: string; icon: IconName }> = {
  inbox: { title: "Входящие", icon: "inbox" },
  today: { title: "Сегодня", icon: "star" },
  plans: { title: "Планы", icon: "list" },
  calendar: { title: "Календарь", icon: "calendar" },
  habits: { title: "Привычки", icon: "repeat" },
  notes: { title: "Заметки", icon: "note" },
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
  const setThemeFromAchievement = useUI((s) => s.setThemeFromAchievement);

  const [introDone, setIntroDone] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(false);

  useEffect(() => {
    hydrate();
    hydrateUI();
    void bootstrap();
  }, [hydrate, hydrateUI, bootstrap]);

  const completedTotal = useMemo(() => tasks.filter((t) => t.isCompleted).length, [tasks]);

  useEffect(() => {
    setThemeFromAchievement(completedTotal);
  }, [completedTotal, setThemeFromAchievement]);

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
      case "habits":
        // Recurring tasks live here; they never sit in the "completed" bucket.
        active = tasks.filter((t) => t.recurrence && !t.isCompleted);
        completed = [];
        break;
      case "archive":
        active = [];
        completed = tasks.filter((t) => t.isCompleted);
        break;
      case "someday":
      case "trash":
      case "settings":
      case "notes":
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
          <Reminders />
          <CommandPalette />
          <div
            className={`shrink-0 overflow-hidden transition-[width] duration-300 ${
              sidebarCollapsed ? "w-0" : "w-64"
            }`}
          >
            <Sidebar onJoinLobby={() => setLobbyOpen(true)} />
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
                  {projectView === "board" && <KanbanSettings projectId={activeProject.id} />}
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
              ) : activeView === "calendar" ? (
                <CalendarView tasks={tasks} />
              ) : activeView === "habits" ? (
                <HabitsView tasks={tasks} />
              ) : activeView === "notes" ? (
                <NotesView ownerId={session?.id ?? null} />
              ) : activeView === "project" && projectView === "board" ? (
                <KanbanBoard tasks={activeTasks} columns={activeProject?.kanbanColumns} />
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
          {lobbyOpen && <LobbyJoinModal onClose={() => setLobbyOpen(false)} />}
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
  const tasks = useChronoStore((s) => s.tasks);
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const achievementThemesEnabled = useUI((s) => s.achievementThemesEnabled);
  const setAchievementThemesEnabled = useUI((s) => s.setAchievementThemesEnabled);
  const setThemeFromAchievement = useUI((s) => s.setThemeFromAchievement);
  const completedCount = tasks.filter((t) => t.isCompleted).length;

  // Find the next milestone for the progress meter.
  const sorted = [...ACHIEVEMENT_THEMES].sort((a, b) => a.tasks - b.tasks);
  const unlocked = [...sorted].reverse().find((item) => completedCount >= item.tasks) ?? sorted[0];
  const next = sorted.find((item) => completedCount < item.tasks);
  const progressPct = next
    ? Math.round(
        ((completedCount - unlocked.tasks) / Math.max(1, next.tasks - unlocked.tasks)) * 100,
      )
    : 100;

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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {THEMES.map((t) => (
              <ThemeOption
                key={t.id}
                active={theme === t.id}
                onClick={() => setTheme(t.id)}
                label={t.label}
                swatch={t.swatch}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-[13px] font-medium text-white/80">
                Темы за выполненные задачи
              </span>
              <span className="mt-0.5 block text-[11px] text-white/40">
                Автоматически меняет тему по мере выполнения задач
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={achievementThemesEnabled}
              onClick={() => {
                const enabled = !achievementThemesEnabled;
                setAchievementThemesEnabled(enabled);
                if (enabled) setThemeFromAchievement(completedCount);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors ${
                achievementThemesEnabled
                  ? "border-violet-400/50 bg-gradient-to-r from-violet-600 to-fuchsia-600"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  achievementThemesEnabled ? "translate-x-5" : "translate-x-0.5"
                } mt-px`}
              />
            </button>
          </label>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-[12px] text-white/50">
              Выполнено: <span className="font-mono text-white/80">{completedCount}</span>
            </span>
            {next ? (
              <span className="text-[11px] text-white/40">
                до «{next.label}»:{" "}
                <span className="font-mono text-violet-200/85">
                  {Math.max(0, next.tasks - completedCount)}
                </span>
              </span>
            ) : (
              <span className="text-[11px] text-amber-200/80">Все темы открыты ★</span>
            )}
          </div>

          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                achievementThemesEnabled
                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-500"
                  : "bg-white/20"
              }`}
              style={{ width: `${Math.max(2, Math.min(100, progressPct))}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {sorted.map((item) => {
              const unlockedNow = completedCount >= item.tasks;
              const isCurrent = unlocked.theme === item.theme;
              return (
                <span
                  key={`${item.tasks}-${item.theme}`}
                  title={`${item.label} (${item.tasks} задач)`}
                  className={`rounded-full border px-2 py-1 text-[11px] transition-colors ${
                    isCurrent
                      ? "border-violet-300/60 bg-violet-500/20 text-violet-100"
                      : unlockedNow
                        ? "border-violet-400/35 bg-violet-500/10 text-violet-100/80"
                        : "border-white/10 text-white/30"
                  }`}
                >
                  {unlockedNow ? "✓ " : ""}
                  {item.label}
                </span>
              );
            })}
          </div>
          {!achievementThemesEnabled && (
            <p className="mt-3 text-[11px] leading-relaxed text-white/35">
              Сейчас тема меняется только вручную. Включите переключатель, чтобы CHRONO сам подбирал
              тему по достижениям.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanSettings({ projectId }: { projectId: string }) {
  const project = useChronoStore((s) => s.projects.find((p) => p.id === projectId));
  const setKanbanColumn = useChronoStore((s) => s.setKanbanColumn);
  const resetKanbanColumns = useChronoStore((s) => s.resetKanbanColumns);
  const [open, setOpen] = useState(false);
  const columns = normalizeKanbanColumns(project?.kanbanColumns);

  // Suggested color palette — faster than picking with the OS picker every time.
  const PALETTE = [
    "#fb7185", "#f59e0b", "#facc15", "#34d399",
    "#22d3ee", "#a78bfa", "#f472b6", "#64748b",
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[12.5px] text-white/65 transition-colors hover:border-violet-400/30 hover:text-white/90"
      >
        <Icon name="settings" size={15} />
        Kanban
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="app-window absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] rounded-2xl border border-white/10 p-4 shadow-neon-strong">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[13px] font-medium text-white/75">Колонки Kanban</div>
              <button
                onClick={() => resetKanbanColumns(projectId)}
                className="rounded-md px-2 py-1 text-[11px] text-white/40 hover:bg-white/5 hover:text-violet-200"
              >
                Сброс
              </button>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-white/40">
              Назовите колонки как вам удобно — задачи распределяются по приоритету (P3 — самый
              срочный, P0 — без приоритета).
            </p>
            <div className="space-y-2">
              {columns.map((column) => (
                <KanbanColumnEditor
                  key={column.priority}
                  column={column}
                  palette={PALETTE}
                  onSave={(label, color) =>
                    setKanbanColumn(projectId, column.priority as Priority, label, color)
                  }
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KanbanColumnEditor({
  column,
  palette,
  onSave,
}: {
  column: KanbanColumn;
  palette: string[];
  onSave: (label: string, color: string) => void;
}) {
  const [label, setLabel] = useState(column.label);
  const [color, setColor] = useState(column.color);
  const [showPalette, setShowPalette] = useState(false);

  useEffect(() => {
    setLabel(column.label);
    setColor(column.color);
  }, [column.label, column.color]);

  const commitLabel = () => {
    if (label.trim() && label !== column.label) onSave(label, color);
  };

  const pickColor = (next: string) => {
    setColor(next);
    onSave(label || column.label, next);
    setShowPalette(false);
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowPalette((v) => !v)}
          aria-label="Цвет колонки"
          title="Выбрать цвет"
          className="grid h-8 w-9 shrink-0 cursor-pointer place-items-center rounded-md border border-white/10 transition-colors hover:border-white/25"
          style={{ background: color }}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitLabel();
              (e.target as HTMLInputElement).blur();
            }
          }}
          maxLength={28}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[12.5px] text-white/80 outline-none focus:border-violet-400/40"
        />
        <span className="w-6 shrink-0 text-right font-mono text-[11px] text-white/30">
          P{column.priority}
        </span>
      </div>
      {showPalette && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.05] bg-black/20 p-2">
          {palette.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => pickColor(swatch)}
              className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${
                color.toLowerCase() === swatch.toLowerCase()
                  ? "border-white/60"
                  : "border-white/10"
              }`}
              style={{ background: swatch }}
              aria-label={swatch}
            />
          ))}
          <label className="ml-auto cursor-pointer rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-white/55 hover:text-violet-200">
            свой
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                onSave(label || column.label, e.target.value);
              }}
              className="ml-1 h-4 w-4 cursor-pointer rounded-sm border-none bg-transparent align-middle"
            />
          </label>
        </div>
      )}
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
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        active
          ? "border-violet-400/50 bg-violet-500/10"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      <span
        className="h-9 w-9 shrink-0 rounded-lg border border-white/15"
        style={{ background: swatch }}
      />
      <span className="truncate text-[13px] text-white/80">{label}</span>
      {active && <span className="ml-auto text-violet-300">✓</span>}
    </button>
  );
}
