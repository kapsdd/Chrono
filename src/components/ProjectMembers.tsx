"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Project, Role } from "@/lib/types";
import { useChronoStore } from "@/store/useChronoStore";
import { useSession } from "@/store/useSession";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Владелец",
  admin: "Администратор",
  editor: "Редактор",
  viewer: "Наблюдатель",
};

const ROLE_BADGE: Record<Role, string> = {
  owner: "border-amber-300/40 bg-amber-300/15 text-amber-200",
  admin: "border-violet-400/40 bg-violet-500/15 text-violet-200",
  editor: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  viewer: "border-white/15 bg-white/5 text-white/55",
};

const initials = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

export function ProjectMembers({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const session = useSession((s) => s.session);
  const ensureOwner = useChronoStore((s) => s.ensureOwner);
  const friends = useChronoStore((s) => s.friends);
  const addCollaborator = useChronoStore((s) => s.addCollaborator);
  const setCollaboratorRole = useChronoStore((s) => s.setCollaboratorRole);
  const removeCollaborator = useChronoStore((s) => s.removeCollaborator);
  const transferOwnership = useChronoStore((s) => s.transferOwnership);
  // Re-read the live project so the list updates as we mutate.
  const live = useChronoStore((s) => s.projects.find((p) => p.id === project.id)) ?? project;

  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [confirmTransfer, setConfirmTransfer] = useState<string | null>(null);

  // Seed the signed-in user as owner the first time the panel opens.
  useEffect(() => {
    ensureOwner(session?.username ?? "Вы", session?.avatar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const members = live.collaborators ?? [];
  const youAreOwner = true; // local-first: the signed-in user owns their copy

  const invite = () => {
    if (!name.trim()) return;
    addCollaborator(live.id, name, role);
    setName("");
    setRole("editor");
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center p-6">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-[min(94vw,560px)]"
      >
        <div className="app-window max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 p-6 shadow-neon-strong">
          {/* header */}
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white/90">Участники проекта</h2>
              <p className="mt-0.5 text-[13px] text-white/45">{live.name}</p>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/80"
            >
              ✕
            </button>
          </div>

          {/* members list */}
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[12px] font-semibold text-white"
                  style={m.avatar ? { background: `url(${m.avatar}) center/cover` } : undefined}
                >
                  {!m.avatar && initials(m.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] text-white/85">{m.name}</div>
                  <span
                    className={`mt-0.5 inline-block rounded border px-1.5 py-px text-[10px] ${ROLE_BADGE[m.role]}`}
                  >
                    {ROLE_LABEL[m.role]}
                  </span>
                </div>

                {m.role === "owner" ? (
                  <span className="text-[11px] text-amber-200/50">★</span>
                ) : (
                  youAreOwner && (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={m.role}
                        onChange={(e) => setCollaboratorRole(live.id, m.id, e.target.value as Role)}
                        className="rounded-md border border-white/10 bg-[#171228] px-2 py-1 text-[12px] text-white/75 outline-none focus:border-violet-400/40"
                      >
                        <option value="admin">Администратор</option>
                        <option value="editor">Редактор</option>
                        <option value="viewer">Наблюдатель</option>
                      </select>
                      <button
                        onClick={() => setConfirmTransfer(m.id)}
                        title="Передать владение"
                        className="grid h-7 w-7 place-items-center rounded-md text-amber-200/60 hover:bg-amber-300/10 hover:text-amber-200"
                      >
                        ♛
                      </button>
                      <button
                        onClick={() => removeCollaborator(live.id, m.id)}
                        title="Убрать"
                        className="grid h-7 w-7 place-items-center rounded-md text-white/40 hover:bg-white/5 hover:text-rose-300"
                      >
                        ✕
                      </button>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>

          {/* invite */}
          <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="mb-2 text-[12px] font-medium text-white/60">
              Пригласить по Discord-нику
            </div>
            {friends.filter(
              (f) => !members.some((m) => m.name.toLowerCase() === f.name.toLowerCase()),
            ).length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {friends
                  .filter(
                    (f) => !members.some((m) => m.name.toLowerCase() === f.name.toLowerCase()),
                  )
                  .map((f) => (
                    <button
                      key={f.id}
                      onClick={() => addCollaborator(live.id, f.name, role)}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[12px] text-white/70 transition-colors hover:border-violet-400/40 hover:text-white/90"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {f.name}
                    </button>
                  ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite()}
                placeholder="username или username#0000"
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 outline-none focus:border-violet-400/40"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="rounded-lg border border-white/10 bg-[#171228] px-2 py-2 text-[12px] text-white/75 outline-none focus:border-violet-400/40"
              >
                <option value="admin">Администратор</option>
                <option value="editor">Редактор</option>
                <option value="viewer">Наблюдатель</option>
              </select>
              <button
                onClick={invite}
                className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-[13px] font-medium text-white hover:scale-[1.02] active:scale-95"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* transfer-ownership confirm */}
      <AnimatePresence>
        {confirmTransfer && (
          <div className="absolute inset-0 z-40 grid place-items-center p-6">
            <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmTransfer(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-[min(90vw,400px)] rounded-2xl border border-amber-300/20 bg-[#15101f] p-6 shadow-neon-strong"
            >
              <h3 className="text-base font-semibold text-amber-100/90">Передать владение?</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/55">
                {members.find((m) => m.id === confirmTransfer)?.name} станет владельцем проекта.
                Вы будете понижены до администратора. Это действие можно отменить только новым
                владельцем.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setConfirmTransfer(null)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-[13px] text-white/65 hover:bg-white/5"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    transferOwnership(live.id, confirmTransfer);
                    setConfirmTransfer(null);
                  }}
                  className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-[13px] font-semibold text-black hover:scale-[1.02] active:scale-95"
                >
                  Передать
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
