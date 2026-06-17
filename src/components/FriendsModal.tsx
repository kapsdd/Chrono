"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useChronoStore } from "@/store/useChronoStore";

const initials = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

export function FriendsModal({ onClose }: { onClose: () => void }) {
  const friends = useChronoStore((s) => s.friends);
  const addFriend = useChronoStore((s) => s.addFriend);
  const removeFriend = useChronoStore((s) => s.removeFriend);
  const [name, setName] = useState("");

  const add = () => {
    if (!name.trim()) return;
    addFriend(name);
    setName("");
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-[min(94vw,480px)]"
      >
        <div className="app-window max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 p-6 shadow-neon-strong">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white/90">Друзья</h2>
              <p className="mt-0.5 text-[13px] text-white/45">
                Добавляйте друзей по Discord и быстро зовите их в проекты
              </p>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/80"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {friends.length === 0 && (
              <div className="grid h-24 place-items-center rounded-xl border border-dashed border-white/10 text-[13px] text-white/30">
                Пока никого нет
              </div>
            )}
            {friends.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[12px] font-semibold text-white"
                  style={f.avatar ? { background: `url(${f.avatar}) center/cover` } : undefined}
                >
                  {!f.avatar && initials(f.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-white/85">{f.name}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-300/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  онлайн
                </span>
                <button
                  onClick={() => removeFriend(f.id)}
                  title="Удалить из друзей"
                  className="grid h-7 w-7 place-items-center rounded-md text-white/40 hover:bg-white/5 hover:text-rose-300"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Discord-ник друга"
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 outline-none focus:border-violet-400/40"
            />
            <button
              onClick={add}
              className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-[13px] font-medium text-white hover:scale-[1.02] active:scale-95"
            >
              Добавить
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
