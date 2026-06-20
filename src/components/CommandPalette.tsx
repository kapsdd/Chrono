"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "./icons";
import { useChronoStore, type ViewId } from "@/store/useChronoStore";
import { useUI, THEMES } from "@/store/useUI";

// Global command palette (Cmd/Ctrl+K): fuzzy-jump to any view, project, or
// task, and switch theme — all from the keyboard. Built to match CHRONO's glass
// aesthetic and the shared SPRING motion voice.

type Command = {
  id: string;
  label: string;
  hint?: string;
  icon?: IconName;
  /** Coloured dot (projects) shown instead of an icon. */
  dot?: string;
  /** CSS background (e.g. a theme gradient) shown as a rounded swatch. */
  swatch?: string;
  /** Section heading in the grouped list. */
  group: string;
  /** Extra text matched by the query but not displayed. */
  keywords?: string;
  run: () => void;
};

const NAV: { id: ViewId; label: string; icon: IconName; keywords: string }[] = [
  { id: "plans", label: "Планы", icon: "list", keywords: "plans tasks plany zadachi" },
  { id: "calendar", label: "Календарь", icon: "calendar", keywords: "calendar kalendar" },
  { id: "habits", label: "Привычки", icon: "repeat", keywords: "habits privychki streak" },
  { id: "noproject", label: "Без проекта", icon: "shuffle", keywords: "no project bez proekta" },
  { id: "someday", label: "Когда-нибудь", icon: "moon", keywords: "someday kogda nibud" },
  { id: "archive", label: "Архив", icon: "archive", keywords: "archive arhiv completed done" },
  { id: "trash", label: "Корзина", icon: "trash", keywords: "trash korzina" },
  { id: "settings", label: "Настройки", icon: "settings", keywords: "settings nastroyki theme" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const projects = useChronoStore((s) => s.projects);
  const tasks = useChronoStore((s) => s.tasks);
  const setView = useChronoStore((s) => s.setView);
  const setActiveProject = useChronoStore((s) => s.setActiveProject);
  const setTheme = useUI((s) => s.setTheme);

  // Toggle on Cmd/Ctrl+K from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset query/selection and focus the field each time it opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  const close = () => setOpen(false);

  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [];

    for (const v of NAV) {
      cmds.push({
        id: `nav:${v.id}`,
        label: v.label,
        icon: v.icon,
        group: "Переход",
        keywords: v.keywords,
        run: () => setView(v.id),
      });
    }

    for (const p of projects) {
      const count = tasks.filter((t) => t.projectId === p.id && !t.isCompleted).length;
      cmds.push({
        id: `project:${p.id}`,
        label: p.name,
        hint: count ? `${count} активных` : undefined,
        dot: p.color,
        group: "Проекты",
        keywords: "project proekt",
        run: () => setActiveProject(p.id),
      });
    }

    // Tasks: only surface them once the user types, and cap the list so the
    // palette stays snappy on large boards. Selecting one jumps to its project
    // (or Plans, for an unfiled task) so it's on screen.
    const q = query.trim().toLowerCase();
    if (q) {
      const matches = tasks
        .filter((t) => !t.isCompleted && t.title.toLowerCase().includes(q))
        .slice(0, 8);
      for (const t of matches) {
        const project = projects.find((p) => p.id === t.projectId);
        cmds.push({
          id: `task:${t.id}`,
          label: t.title,
          hint: project?.name,
          icon: "list",
          group: "Задачи",
          keywords: "task zadacha",
          run: () => {
            if (project) setActiveProject(project.id);
            else setView("plans");
          },
        });
      }
    }

    for (const t of THEMES) {
      cmds.push({
        id: `theme:${t.id}`,
        label: `Тема: ${t.label}`,
        swatch: t.swatch,
        group: "Оформление",
        keywords: `theme tema oformlenie ${t.id}`,
        run: () => setTheme(t.id),
      });
    }

    return cmds;
  }, [projects, tasks, query, setView, setActiveProject, setTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Group the filtered results, preserving section order of first appearance.
  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  // Keep the active index in range as the result set shrinks.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // Scroll the highlighted row into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const runAt = (idx: number) => {
    const cmd = filtered[idx];
    if (!cmd) return;
    cmd.run();
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (filtered.length ? (a + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (filtered.length ? (a - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  // Flat index used to map grouped rows back to the keyboard selection.
  let flatIdx = -1;

  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-50 grid place-items-start justify-center p-6 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-[min(94vw,560px)]"
          >
            <div className="app-window overflow-hidden rounded-2xl border border-white/10 shadow-neon-strong">
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                <Icon name="search" size={18} className="shrink-0 text-white/40" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Куда перейти? Введите проект, вид или тему…"
                  className="w-full bg-transparent text-[15px] text-white/90 outline-none placeholder:text-white/30"
                />
                <kbd className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/40">
                  ESC
                </kbd>
              </div>

              <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
                {filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[13px] text-white/35">
                    Ничего не найдено
                  </div>
                ) : (
                  groups.map(([group, items]) => (
                    <div key={group} className="mb-1">
                      <div className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-white/30">
                        {group}
                      </div>
                      {items.map((cmd) => {
                        flatIdx++;
                        const idx = flatIdx;
                        const isActive = idx === active;
                        return (
                          <button
                            key={cmd.id}
                            data-idx={idx}
                            onClick={() => runAt(idx)}
                            onMouseMove={() => setActive(idx)}
                            className={`flex w-full items-center gap-3 px-4 py-2 text-left text-[13.5px] transition-colors ${
                              isActive ? "bg-violet-500/15 text-white" : "text-white/65"
                            }`}
                          >
                            <span className="grid h-5 w-5 shrink-0 place-items-center">
                              {cmd.swatch ? (
                                <span
                                  className="h-4 w-4 rounded-md border border-white/15"
                                  style={{ background: cmd.swatch }}
                                />
                              ) : cmd.dot ? (
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: cmd.dot, boxShadow: `0 0 8px ${cmd.dot}` }}
                                />
                              ) : cmd.icon ? (
                                <Icon
                                  name={cmd.icon}
                                  size={16}
                                  className={isActive ? "text-violet-200" : "text-white/40"}
                                />
                              ) : null}
                            </span>
                            <span className="flex-1 truncate">{cmd.label}</span>
                            {cmd.hint && (
                              <span className="shrink-0 font-mono text-[11px] text-white/30">
                                {cmd.hint}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2 text-[11px] text-white/30">
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
                  выбор
                  <kbd className="ml-2 rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[10px]">↵</kbd>
                  открыть
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[10px]">⌘K</kbd>
                  команды
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
