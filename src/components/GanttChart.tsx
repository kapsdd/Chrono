"use client";

import { useMemo } from "react";
import type { Priority, Task } from "@/lib/types";
import { useChronoStore } from "@/store/useChronoStore";

const DAY = 86_400_000;
const PRIORITY_COLOR: Record<Priority, string> = {
  3: "#fb7185",
  2: "#f59e0b",
  1: "#a78bfa",
  0: "#64748b",
};

const isoDay = (d: number) => new Date(d).toISOString().slice(0, 10);

export function GanttChart({ tasks }: { tasks: Task[] }) {
  const setTaskDue = useChronoStore((s) => s.setTaskDue);

  const rows = useMemo(
    () =>
      tasks
        .filter((t) => !t.isCompleted)
        .map((t) => {
          const start = new Date(t.createdAt).getTime();
          const end = t.due ? new Date(t.due).getTime() : start + 3 * DAY;
          return { task: t, start, end: Math.max(end, start + DAY) };
        })
        .sort((a, b) => a.start - b.start),
    [tasks],
  );

  const { min, max } = useMemo(() => {
    if (rows.length === 0) {
      const now = Date.now();
      return { min: now - DAY, max: now + 7 * DAY };
    }
    const min = Math.min(...rows.map((r) => r.start)) - DAY;
    const max = Math.max(...rows.map((r) => r.end)) + DAY;
    return { min, max };
  }, [rows]);

  const span = Math.max(max - min, DAY);
  const ticks = useMemo(() => {
    const out: number[] = [];
    const step = Math.ceil(span / DAY / 6) * DAY;
    for (let d = min; d <= max; d += step) out.push(d);
    return out;
  }, [min, max, span]);

  if (rows.length === 0) {
    return (
      <div className="grid h-40 place-items-center text-[13px] text-white/30">
        Нет активных задач для диаграммы
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4">
      {/* axis */}
      <div className="relative mb-2 ml-[40%] h-5 border-b border-white/10">
        {ticks.map((d) => (
          <span
            key={d}
            className="absolute -translate-x-1/2 font-mono text-[10px] text-white/35"
            style={{ left: `${((d - min) / span) * 100}%` }}
          >
            {new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map(({ task, start, end }) => {
          const left = ((start - min) / span) * 100;
          const width = ((end - start) / span) * 100;
          const color = PRIORITY_COLOR[task.priority];
          return (
            <div key={task.id} className="flex items-center gap-2">
              <div className="flex w-[40%] min-w-0 items-center gap-2 pr-3">
                <span className="truncate text-[13px] text-white/80">{task.title}</span>
                <input
                  type="date"
                  value={task.due ? isoDay(new Date(task.due).getTime()) : ""}
                  onChange={(e) =>
                    setTaskDue(task.id, e.target.value ? new Date(e.target.value).toISOString() : null)
                  }
                  title="Срок"
                  className="ml-auto shrink-0 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white/50 outline-none focus:border-violet-400/40"
                />
              </div>
              <div className="relative h-7 flex-1 rounded-md bg-white/[0.02]">
                {ticks.map((d) => (
                  <span
                    key={d}
                    className="absolute top-0 h-full w-px bg-white/[0.04]"
                    style={{ left: `${((d - min) / span) * 100}%` }}
                  />
                ))}
                <div
                  className="absolute top-1/2 h-4 -translate-y-1/2 rounded-md"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: `linear-gradient(90deg, ${color}cc, ${color}77)`,
                    boxShadow: `0 0 12px ${color}55`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
