"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { downloadICS } from "@/lib/ics";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Month grid of tasks placed on their due dates, plus a one-click .ics export
// (#12). Weeks start on Monday.
export function CalendarView({ tasks }: { tasks: Task[] }) {
  const [today, setToday] = useState(() => new Date());
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    const id = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const dated = useMemo(() => tasks.filter((t) => t.due), [tasks]);

  // Build the 6-row grid: leading days from the previous month fill the first
  // week so the 1st lands under its weekday (Mon-based).
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
    const start = new Date(first);
    start.setDate(first.getDate() - lead);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });
  }, [cursor]);

  const tasksOn = (day: Date) =>
    dated.filter((t) => sameDay(new Date(t.due as string), day));

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <div className="mx-auto max-w-4xl">
      {/* header */}
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-white/90">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/60 hover:bg-white/5 hover:text-white/90"
          >
            ‹
          </button>
          <button
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-white/65 hover:bg-white/5"
          >
            Сегодня
          </button>
          <button
            onClick={() => shiftMonth(1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/60 hover:bg-white/5 hover:text-white/90"
          >
            ›
          </button>
        </div>
        <button
          onClick={() => downloadICS(tasks)}
          title="Экспортировать в календарь (.ics)"
          className="ml-auto rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-[12.5px] text-violet-100 transition-colors hover:bg-violet-500/20"
        >
          Экспорт .ics
        </button>
      </div>

      {/* weekday header */}
      <div className="grid grid-cols-7 gap-1.5 pb-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-1 text-[11px] font-medium uppercase tracking-wider text-white/30">
            {w}
          </div>
        ))}
      </div>

      {/* day grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = sameDay(day, today);
          const items = tasksOn(day);
          return (
            <div
              key={i}
              className={`min-h-[92px] rounded-xl border p-1.5 transition-colors ${
                inMonth
                  ? "border-white/[0.06] bg-white/[0.02]"
                  : "border-transparent bg-transparent opacity-40"
              } ${isToday ? "border-violet-400/40 bg-violet-500/[0.07]" : ""}`}
            >
              <div
                className={`mb-1 text-right text-[11px] ${
                  isToday ? "font-semibold text-violet-200" : "text-white/40"
                }`}
              >
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {items.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    title={t.title}
                    className={`truncate rounded-md px-1.5 py-0.5 text-[11px] ${
                      t.isCompleted
                        ? "bg-white/5 text-white/35 line-through"
                        : "bg-gradient-to-r from-violet-500/25 to-fuchsia-500/15 text-white/85"
                    }`}
                  >
                    {t.title}
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="px-1.5 text-[10px] text-white/40">+{items.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
