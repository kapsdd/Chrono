"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./icons";
import { useSession } from "@/store/useSession";
import { useChronoStore } from "@/store/useChronoStore";

export function ProfileMenu({ onOpenFriends }: { onOpenFriends: () => void }) {
  const session = useSession((s) => s.session);
  const logout = useSession((s) => s.logout);
  const setView = useChronoStore((s) => s.setView);
  const friendsCount = useChronoStore((s) => s.friends.length);
  const [open, setOpen] = useState(false);

  if (!session) return null;
  const letter = session.username[0]?.toUpperCase() ?? "?";

  return (
    <div className="no-drag relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-2.5 transition-colors hover:border-violet-400/40"
      >
        <span
          className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[12px] font-semibold text-white"
          style={session.avatar ? { background: `url(${session.avatar}) center/cover` } : undefined}
        >
          {!session.avatar && letter}
        </span>
        <span className="max-w-[110px] truncate text-[12.5px] text-white/80">
          {session.username}
        </span>
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
              className="app-window absolute right-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-2xl border border-white/10 p-2 shadow-neon-strong"
            >
              <div className="flex items-center gap-3 px-2 py-2">
                <span
                  className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[14px] font-semibold text-white"
                  style={session.avatar ? { background: `url(${session.avatar}) center/cover` } : undefined}
                >
                  {!session.avatar && letter}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] text-white/90">{session.username}</div>
                  <div className="text-[11px] text-white/40">Discord</div>
                </div>
              </div>

              <div className="my-1.5 h-px bg-white/[0.06]" />

              <MenuItem
                icon="users"
                label="Друзья"
                badge={friendsCount || undefined}
                onClick={() => {
                  setOpen(false);
                  onOpenFriends();
                }}
              />
              <MenuItem
                icon="settings"
                label="Настройки"
                onClick={() => {
                  setOpen(false);
                  setView("settings");
                }}
              />

              <div className="my-1.5 h-px bg-white/[0.06]" />

              <MenuItem icon="shuffle" label="Выйти" danger onClick={logout} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  badge,
  danger,
  onClick,
}: {
  icon: "users" | "settings" | "shuffle";
  label: string;
  badge?: number;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
        danger
          ? "text-white/60 hover:bg-rose-500/10 hover:text-rose-300"
          : "text-white/75 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      <Icon name={icon} size={16} />
      <span className="flex-1 text-left">{label}</span>
      {badge ? <span className="font-mono text-[11px] text-violet-200/70">{badge}</span> : null}
    </button>
  );
}
