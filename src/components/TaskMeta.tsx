import clsx from "clsx";
import type { Priority } from "@/lib/types";

// Priority as a row of three dots: filled = current level, glowing at P3.
const DOT_TONE: Record<Exclude<Priority, 0>, string> = {
  1: "bg-violet-400/70",
  2: "bg-amber-400/80",
  3: "bg-rose-400 shadow-[0_0_6px_#fb7185]",
};

export function PriorityDots({ priority }: { priority: Priority }) {
  if (priority === 0) return null;
  const tone = DOT_TONE[priority as Exclude<Priority, 0>];
  return (
    <span className="flex items-center gap-0.5" aria-label={`Приоритет ${priority}`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={clsx(
            "h-1.5 w-1.5 rounded-full",
            i <= priority ? tone : "bg-white/10",
          )}
        />
      ))}
    </span>
  );
}

export function TagChip({ name }: { name: string }) {
  return (
    <span className="rounded-md border border-fuchsia-300/20 bg-fuchsia-400/10 px-1.5 py-0.5 font-mono text-[10px] text-fuchsia-200/90">
      #{name}
    </span>
  );
}
