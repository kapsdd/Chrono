"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Project, Role } from "@/lib/types";
import { useChronoStore } from "@/store/useChronoStore";
import { useSession } from "@/store/useSession";
import { repo } from "@/lib/repo";
import { db } from "@/lib/firebase";
import { ref, onValue, off } from "firebase/database";
import { errMessage } from "@/lib/errMessage";

interface LobbyMember {
  user_id: string;
  role: string;
  name: string | null;
  avatar: string | null;
  joined_at: string;
}

// Только editor / viewer — admin/owner для участников лобби не назначаются:
// владелец один (projects.owner_id), а более тонкие тиры не нужны.
const LOBBY_ROLES: Array<{ value: "editor" | "viewer"; label: string }> = [
  { value: "editor", label: "Редактор" },
  { value: "viewer", label: "Наблюдатель" },
];

const LOBBY_ROLE_LABEL: Record<string, string> = {
  editor: "Редактор",
  viewer: "Наблюдатель",
};

const LOBBY_ROLE_BADGE: Record<string, string> = {
  editor: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  viewer: "border-white/15 bg-white/5 text-white/55",
};

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
  const setCollaboratorRole = useChronoStore((s) => s.setCollaboratorRole);
  const removeCollaborator = useChronoStore((s) => s.removeCollaborator);
  const transferOwnership = useChronoStore((s) => s.transferOwnership);
  const publishLobby = useChronoStore((s) => s.publishLobby);
  const unpublishLobby = useChronoStore((s) => s.unpublishLobby);
  const updateLobbyMemberRole = useChronoStore((s) => s.updateLobbyMemberRole);
  const leaveProjectAction = useChronoStore((s) => s.leaveProject);
  // Re-read the live project so the list updates as we mutate.
  const live = useChronoStore((s) => s.projects.find((p) => p.id === project.id)) ?? project;

  const [confirmTransfer, setConfirmTransfer] = useState<string | null>(null);
  const [lobbyPass, setLobbyPass] = useState("");
  const [lobbyBusy, setLobbyBusy] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lobbyMembers, setLobbyMembers] = useState<LobbyMember[]>([]);
  // We keep the just-set password in memory so we can show it back in the
  // invitation text. The server only stores the hash, so once the modal closes
  // we lose it — that's intentional, the owner can rotate it any time.
  const [sharedPass, setSharedPass] = useState<string>("");
  const [showPass, setShowPass] = useState(false);

  const copyText = (text: string, key: string) => {
    if (typeof navigator !== "undefined") navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1500);
  };

  // Only the real owner can open/close the lobby (the RPC enforces it too).
  const isOwner = !session || !live.ownerId || session.id === live.ownerId;

  // Load the lobby membership list for a shared project.
  const loadMembers = useCallback(() => {
    if (!live.published) {
      setLobbyMembers([]);
      return;
    }
    repo
      .fetchMembers(live.id)
      .then(setLobbyMembers)
      .catch((e) => console.error("fetchMembers", e));
  }, [live.id, live.published]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Keep the lobby list live without forcing the owner to reopen the modal:
  // any insert/delete/role-update on project_members for this project pulls
  // a fresh list. RLS scopes the events to projects we can see.
  useEffect(() => {
    if (!live.published) return;
    const membersRef = ref(db, `shared/${live.id}/members`);
    const unsub = onValue(membersRef, () => loadMembers());
    return () => {
      off(membersRef, "value", unsub);
    };
  }, [live.id, live.published, loadMembers]);

  const kick = async (userId: string) => {
    await repo.leaveProject(live.id, userId);
    loadMembers();
  };

  const changeMemberRole = async (userId: string, role: "editor" | "viewer") => {
    // Optimistic update so the dropdown reflects immediately; realtime will
    // confirm. If the RPC fails (e.g. not actually owner), reload to revert.
    setLobbyMembers((list) =>
      list.map((m) => (m.user_id === userId ? { ...m, role } : m)),
    );
    const ok = await updateLobbyMemberRole(live.id, userId, role);
    if (!ok) loadMembers();
  };

  const leave = async () => {
    if (!session) return;
    await leaveProjectAction(live.id);
    onClose();
  };

  // Seed the signed-in user as owner only on projects they actually own —
  // for joined (member) projects this is the wrong identity to stamp. The
  // store's ensureOwner now guards against cross-owner writes too, but
  // we also gate the call here so we don't even attempt it.
  useEffect(() => {
    if (!isOwner) return;
    ensureOwner(session?.username ?? "Вы", session?.avatar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const members = live.collaborators ?? [];
  const youAreOwner = true; // local-first: the signed-in user owns their copy

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

          {/* lobby — join by code + password */}
          {isOwner ? (
            <div className="mt-5 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-3">
              <div className="mb-2 text-[12px] font-medium text-violet-100/80">
                Лобби — вход по коду и паролю
              </div>
              {live.published && live.joinCode ? (
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-white/35">
                      Код проекта
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center font-mono text-[15px] tracking-[0.2em] text-violet-100">
                        {live.joinCode}
                      </code>
                      <button
                        onClick={() => copyText(live.joinCode ?? "", "code")}
                        className="rounded-lg border border-white/10 px-3 py-2 text-[12px] text-white/70 hover:bg-white/5"
                      >
                        {copiedKey === "code" ? "✓" : "Копировать"}
                      </button>
                    </div>
                  </div>

                  {sharedPass && (
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/35">
                        <span>Пароль</span>
                        <button
                          onClick={() => setShowPass((v) => !v)}
                          className="rounded px-1 text-[10px] normal-case tracking-normal text-white/45 hover:text-violet-200"
                        >
                          {showPass ? "скрыть" : "показать"}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center font-mono text-[14px] text-violet-100">
                          {showPass ? sharedPass : "•".repeat(Math.min(sharedPass.length, 12))}
                        </code>
                        <button
                          onClick={() => copyText(sharedPass, "pass")}
                          className="rounded-lg border border-white/10 px-3 py-2 text-[12px] text-white/70 hover:bg-white/5"
                        >
                          {copiedKey === "pass" ? "✓" : "Копировать"}
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] leading-relaxed text-white/40">
                    {sharedPass
                      ? "Код и пароль показаны выше — отправьте оба."
                      : "Пароль не показывается после перезагрузки. Откройте лобби заново, чтобы задать новый."}
                  </p>

                  <div className="rounded-lg border border-white/10 bg-black/15 p-2.5">
                    <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-white/30">
                      <span>Приглашение</span>
                      <span className="text-white/25">для отправки</span>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-white/65">
{`Приглашаю в проект «${live.name}» в CHRONO.

Код: ${live.joinCode}${sharedPass ? `\nПароль: ${sharedPass}` : `\nПароль: отправлю отдельно`}

Открой CHRONO → «Войти по коду», введи код и пароль.`}
                    </pre>
                    <button
                      onClick={() => {
                        const text = `Приглашаю в проект «${live.name}» в CHRONO.\n\nКод: ${live.joinCode}${sharedPass ? `\nПароль: ${sharedPass}` : `\nПароль: отправлю отдельно`}\n\nОткрой CHRONO → «Войти по коду», введи код и пароль.`;
                        copyText(text, "invite");
                      }}
                      className="mt-2 w-full rounded-lg border border-violet-400/30 bg-violet-500/[0.08] px-3 py-1.5 text-[12px] text-violet-100/85 hover:bg-violet-500/15"
                    >
                      {copiedKey === "invite" ? "✓ Скопировано" : "Скопировать приглашение"}
                    </button>
                  </div>

                  {/* lobby members */}
                  {lobbyMembers.length > 0 && (
                    <div className="mt-1 space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider text-white/35">
                        Присоединились ({lobbyMembers.length})
                      </div>
                      {lobbyMembers.map((m) => {
                        const roleKey = m.role === "viewer" ? "viewer" : "editor";
                        return (
                          <div
                            key={m.user_id}
                            className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5"
                          >
                            <span
                              className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[11px] font-semibold text-white"
                              style={m.avatar ? { background: `url(${m.avatar}) center/cover` } : undefined}
                            >
                              {!m.avatar && initials(m.name ?? "?")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12.5px] text-white/80">
                                {m.name ?? "Участник"}
                              </div>
                              <span
                                className={`mt-0.5 inline-block rounded border px-1.5 py-px text-[10px] ${LOBBY_ROLE_BADGE[roleKey]}`}
                              >
                                {LOBBY_ROLE_LABEL[roleKey]}
                              </span>
                            </div>
                            <select
                              value={roleKey}
                              onChange={(e) =>
                                void changeMemberRole(
                                  m.user_id,
                                  e.target.value as "editor" | "viewer",
                                )
                              }
                              title="Права участника"
                              className="rounded-md border border-white/10 bg-[#171228] px-2 py-1 text-[11.5px] text-white/75 outline-none focus:border-violet-400/40"
                            >
                              {LOBBY_ROLES.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => void kick(m.user_id)}
                              title="Исключить"
                              className="grid h-6 w-6 place-items-center rounded-md text-white/40 hover:bg-white/5 hover:text-rose-300"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setSharedPass("");
                      setShowPass(false);
                      void unpublishLobby(live.id);
                    }}
                    className="text-[12px] text-rose-300/70 hover:text-rose-300"
                  >
                    Закрыть доступ
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] leading-relaxed text-white/45">
                    Придумайте пароль и нажмите «Открыть». Приложение выдаст код —
                    делитесь кодом и паролем, по ним другие войдут в проект.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type={showPass ? "text" : "password"}
                      value={lobbyPass}
                      onChange={(e) => setLobbyPass(e.target.value)}
                      placeholder="Пароль для входа (мин. 3 символа)"
                      className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 outline-none focus:border-violet-400/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      title={showPass ? "Скрыть пароль" : "Показать пароль"}
                      className="rounded-lg border border-white/10 px-2.5 py-2 text-[11px] text-white/55 hover:bg-white/5"
                    >
                      {showPass ? "скрыть" : "показать"}
                    </button>
                    <button
                      disabled={lobbyBusy || lobbyPass.trim().length < 3}
                      onClick={async () => {
                        setLobbyBusy(true);
                        setLobbyError(null);
                        const pw = lobbyPass.trim();
                        try {
                          await publishLobby(live.id, pw);
                          setSharedPass(pw);
                          setLobbyPass("");
                        } catch (e) {
                          setLobbyError(`Не удалось открыть лобби: ${errMessage(e)}`);
                        } finally {
                          setLobbyBusy(false);
                        }
                      }}
                      className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-[13px] font-medium text-white hover:scale-[1.02] active:scale-95 disabled:opacity-40"
                    >
                      {lobbyBusy ? "…" : "Открыть"}
                    </button>
                  </div>
                  {lobbyError && (
                    <p className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200/80">
                      {lobbyError}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : live.published ? (
            <div className="mt-5 space-y-2 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-3">
              <div className="mb-1 text-[12px] font-medium text-violet-100/80">Лобби</div>
              <p className="text-[12px] text-white/60">Вы участник этого общего проекта.</p>
              <button
                onClick={() => void leave()}
                className="rounded-lg border border-rose-400/30 px-3 py-1.5 text-[12.5px] text-rose-200/80 hover:bg-rose-500/10"
              >
                Покинуть проект
              </button>
            </div>
          ) : null}

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
