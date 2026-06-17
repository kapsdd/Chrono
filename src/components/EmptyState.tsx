"use client";

import { motion } from "framer-motion";
import { Icon, type IconName } from "./icons";

// Shown when the active view has no tasks — doubles as a cheat-sheet for the
// Smart Input grammar on task views.
export function EmptyState({
  title = "Тут пока ничего нет",
  hint = "Нажмите CTRL+N или SPACE для создания новой задачи",
  icon = "inbox",
  showGrammar = true,
}: {
  title?: string;
  hint?: string;
  icon?: IconName;
  showGrammar?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid h-full place-items-center text-center"
    >
      <div>
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-violet-400/25 bg-violet-500/10 text-violet-200/80 animate-pulse-neon">
          <Icon name={icon} size={26} />
        </div>
        <h2 className="text-base font-medium text-white/70">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-white/35">
          {hint}
        </p>

        {showGrammar && (
          <div className="mx-auto mt-5 flex flex-wrap justify-center gap-2 font-mono text-[11px]">
            <span className="rounded-md border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-violet-200/80">
              /Проект
            </span>
            <span className="rounded-md border border-fuchsia-400/20 bg-fuchsia-500/10 px-2 py-1 text-fuchsia-200/80">
              #тег
            </span>
            <span className="rounded-md border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-rose-300/80">
              !!! приоритет
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
