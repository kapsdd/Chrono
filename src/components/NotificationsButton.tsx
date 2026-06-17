"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./icons";
import { useChronoStore } from "@/store/useChronoStore";

const DAY = 86_400_000;

export function NotificationsButton() {
  const tasks = useChronoStore((s) => s.tasks);
  const [open, setOpen] = useState(false);

  // Build a lightweight feed: overdue and soon-due tasks.
  const items = useMemo(() => {
    const now = Date.now();
    const out: { id: string; title: string; tone: "danger" | "warn"; text: string }[] = [];
    for (const t of tasks) {
      if (t.isCompleted || !t.due) continue;
      const due = new Date(t.due).getTime();
      if (due < now) out.push({ id: t.id, title: t.title, tone: "danger", text: "просрочена" });
      else if (due - now < 2 * DAY)
        out.push({ id: t.id, title: t.title, tone: "warn", text: "скоро срок" });
    }
    return out.slice(0, 8);
  }, [tasks]);

  return (
    <div className="no-drag relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Уведомления"
        className="relative grid h-9 w-9 place-items-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.06] hover:text-violet-200"
      >
        <Icon name="bell" size={17} />
        {items.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_6px_#e879f9]" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.16 }}
              className="app-window absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-2xl border border-white/10 p-2 shadow-neon-strong"
            >
              <div className="px-2 py-1.5 text-[12px] font-medium text-white/55">Уведомления</div>
              {items.length === 0 ? (
                <div className="grid h-20 place-items-center text-[13px] text-white/30">
                  Всё спокойно
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {items.map((n) => (
                    <div key={n.id} className="flex items-start gap-2.5 rounded-lg px-2.5 py-2">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          n.tone === "danger" ? "bg-rose-400" : "bg-amber-400"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] text-white/85">{n.title}</div>
                        <div
                          className={`text-[11px] ${
                            n.tone === "danger" ? "text-rose-300/70" : "text-amber-300/70"
                          }`}
                        >
                          {n.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
