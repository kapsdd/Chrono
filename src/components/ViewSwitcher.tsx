"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import { SPRING } from "@/lib/motion";
import type { ProjectView } from "@/lib/types";

const OPTIONS: { id: ProjectView; label: string; icon: React.ReactNode }[] = [
  {
    id: "list",
    label: "Список",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "board",
    label: "Канбан",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="6" height="16" rx="1.5" stroke="currentColor" strokeWidth="2" />
        <rect x="15" y="4" width="6" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "gantt",
    label: "Гант",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M4 6h9M7 12h11M4 18h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function ViewSwitcher({
  value,
  onChange,
}: {
  value: ProjectView;
  onChange: (v: ProjectView) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
      {OPTIONS.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={clsx(
              "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              active ? "text-white" : "text-white/45 hover:text-white/75",
            )}
          >
            {active && (
              <motion.span
                layoutId="view-active"
                transition={SPRING}
                className="absolute inset-0 rounded-lg border border-violet-400/30 bg-gradient-to-r from-violet-500/30 to-fuchsia-500/15"
              />
            )}
            <span className="relative">{o.icon}</span>
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
