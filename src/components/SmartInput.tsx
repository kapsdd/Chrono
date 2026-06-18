"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { parseInput } from "@/lib/parseInput";
import { SPRING } from "@/lib/motion";
import { useChronoStore } from "@/store/useChronoStore";
import { PriorityDots } from "./TaskMeta";

export function SmartInput() {
  const [value, setValue] = useState("");
  const addFromInput = useChronoStore((s) => s.addFromInput);

  const parsed = useMemo(() => parseInput(value), [value]);
  const showPreview =
    value.trim().length > 0 &&
    (!!parsed.project || parsed.tags.length > 0 || parsed.priority > 0);

  const submit = async () => {
    if (!parsed.title) return;
    await addFromInput(value);
    setValue("");
  };

  return (
    <div className="w-full">
      <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 transition-shadow duration-300 focus-within:shadow-neon-strong">
        <span className="select-none font-mono text-sm text-violet-300/80">›</span>
        <input
          id="smart-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Новая задача…   /Проект  #тег  !!!"
          className="flex-1 bg-transparent text-[15px] text-white/90 outline-none"
          aria-label="Быстрый ввод задачи"
        />
        <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/30 sm:block">
          Enter
        </kbd>
      </div>

      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SPRING}
            className="mt-2 flex flex-wrap items-center gap-2 px-2 text-xs"
          >
            {parsed.title && (
              <span className="text-white/55">
                → <span className="text-white/85">{parsed.title}</span>
              </span>
            )}
            {parsed.project && (
              <span className="rounded-md border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 font-mono text-violet-200/90">
                /{parsed.project}
              </span>
            )}
            {parsed.tags.map((t) => (
              <span
                key={t}
                className="rounded-md border border-fuchsia-400/20 bg-fuchsia-500/10 px-2 py-0.5 font-mono text-fuchsia-200/90"
              >
                #{t}
              </span>
            ))}
            {parsed.priority > 0 && <PriorityDots priority={parsed.priority} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
