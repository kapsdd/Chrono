"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { useNotes } from "@/store/useNotes";
import { Icon } from "./icons";
import type { Note } from "@/lib/types";

const NOTE_COLORS = [
  "#a78bfa", // violet
  "#f472b6", // pink
  "#22d3ee", // cyan
  "#facc15", // amber
  "#34d399", // emerald
  "#fb7185", // rose
];

// Strip dangerous tags/attributes from rich-text editor output. We allow only a
// small whitelist of formatting tags + safe attributes — no scripts, no inline
// event handlers, no external URLs except http(s).
function sanitizeHtml(input: string): string {
  if (typeof document === "undefined") return input;
  const allowedTags = new Set([
    "b", "strong", "i", "em", "u", "s", "strike",
    "p", "div", "br", "span",
    "h1", "h2", "h3",
    "ul", "ol", "li",
    "blockquote", "pre", "code",
    "a",
  ]);
  const allowedAttrs: Record<string, Set<string>> = {
    a: new Set(["href", "title"]),
  };
  const wrap = document.createElement("div");
  wrap.innerHTML = input;

  const walk = (node: Element) => {
    const children = Array.from(node.children);
    for (const child of children) {
      const tag = child.tagName.toLowerCase();
      if (!allowedTags.has(tag)) {
        // Replace with its text content so user keeps their writing
        const text = document.createTextNode(child.textContent ?? "");
        child.replaceWith(text);
        continue;
      }
      const allowed = allowedAttrs[tag] ?? new Set<string>();
      for (const attr of Array.from(child.attributes)) {
        if (!allowed.has(attr.name)) {
          child.removeAttribute(attr.name);
        } else if (attr.name === "href") {
          const v = attr.value.trim();
          if (!/^https?:\/\//i.test(v) && !v.startsWith("mailto:")) {
            child.removeAttribute("href");
          } else {
            child.setAttribute("target", "_blank");
            child.setAttribute("rel", "noopener noreferrer");
          }
        }
      }
      walk(child);
    }
  };
  walk(wrap);
  return wrap.innerHTML;
}

function plainTextPreview(html: string, max = 80): string {
  if (typeof document === "undefined") return html.slice(0, max);
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const text = (tmp.textContent ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (!t) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} дн назад`;
  return new Date(t).toLocaleDateString("ru-RU");
}

export function NotesView({ ownerId }: { ownerId: string | null }) {
  const notes = useNotes((s) => s.notes);
  const activeId = useNotes((s) => s.activeId);
  const hydrated = useNotes((s) => s.hydrated);
  const currentOwner = useNotes((s) => s.ownerId);
  const hydrate = useNotes((s) => s.hydrate);
  const setActive = useNotes((s) => s.setActive);
  const create = useNotes((s) => s.create);
  const update = useNotes((s) => s.update);
  const remove = useNotes((s) => s.remove);
  const togglePinned = useNotes((s) => s.togglePinned);

  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!hydrated || currentOwner !== ownerId) hydrate(ownerId);
  }, [hydrated, currentOwner, ownerId, hydrate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        plainTextPreview(n.content, 5000).toLowerCase().includes(q),
    );
  }, [notes, search]);

  const active = notes.find((n) => n.id === activeId) ?? null;

  return (
    <div className="flex h-full min-h-[60vh] gap-4">
      {/* list */}
      <aside className="flex w-72 shrink-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-3">
        <div className="mb-2 flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по заметкам"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-white/85 outline-none placeholder:text-white/30 focus:border-violet-400/40"
          />
          <button
            onClick={() => create({ title: "Новая заметка" })}
            title="Создать заметку"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_6px_18px_rgba(139,92,246,0.4)] transition-transform hover:scale-105 active:scale-95"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>

        <div className="-mr-1 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="grid h-40 place-items-center text-center text-[12px] text-white/30">
              {notes.length === 0 ? (
                <span>
                  Нет заметок.
                  <br />
                  Нажмите + чтобы создать.
                </span>
              ) : (
                <span>Ничего не найдено</span>
              )}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((n) => (
                <motion.button
                  layout
                  key={n.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setActive(n.id)}
                  className={clsx(
                    "group/note relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors",
                    activeId === n.id
                      ? "border-violet-400/40 bg-violet-500/[0.08]"
                      : "border-white/[0.05] bg-white/[0.02] hover:border-white/15",
                  )}
                >
                  {n.color && (
                    <span
                      className="absolute left-0 top-0 h-full w-[3px]"
                      style={{ background: n.color, boxShadow: `0 0 8px ${n.color}` }}
                    />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-white/85">
                      {n.title || "Без названия"}
                    </span>
                    {n.pinned && (
                      <span className="shrink-0 text-amber-300/80" title="Закреплена">
                        <Icon name="pin" size={12} />
                      </span>
                    )}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-white/45">
                    {plainTextPreview(n.content, 120) || (
                      <span className="text-white/25">Пусто</span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[10px] font-mono uppercase tracking-wider text-white/25">
                    {formatRelative(n.updatedAt)}
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          )}
        </div>
      </aside>

      {/* editor */}
      <section className="glass flex min-w-0 flex-1 flex-col rounded-2xl">
        {active ? (
          <NoteEditor
            key={active.id}
            note={active}
            onChangeTitle={(title) => update(active.id, { title })}
            onChangeContent={(content) => update(active.id, { content })}
            onChangeColor={(color) => update(active.id, { color })}
            onTogglePin={() => togglePinned(active.id)}
            onDelete={() => remove(active.id)}
          />
        ) : (
          <div className="grid flex-1 place-items-center px-8 text-center">
            <div>
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-violet-200">
                <Icon name="note" size={22} />
              </div>
              <p className="text-[14px] text-white/65">Заметки</p>
              <p className="mt-1 text-[12px] text-white/35">
                Выберите заметку слева или создайте новую.
              </p>
              <button
                onClick={() => create({ title: "Новая заметка" })}
                className="mt-4 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-[13px] font-medium text-white hover:scale-[1.02] active:scale-95"
              >
                + Создать
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function NoteEditor({
  note,
  onChangeTitle,
  onChangeContent,
  onChangeColor,
  onTogglePin,
  onDelete,
}: {
  note: Note;
  onChangeTitle: (v: string) => void;
  onChangeContent: (v: string) => void;
  onChangeColor: (v: string) => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [showColors, setShowColors] = useState(false);

  // Push initial content once per note id, then let contentEditable own it.
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== note.content) {
      editorRef.current.innerHTML = note.content || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const flush = () => {
    if (!editorRef.current) return;
    const html = sanitizeHtml(editorRef.current.innerHTML);
    onChangeContent(html);
  };

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    flush();
  };

  const insertLink = () => {
    const url = window.prompt("URL ссылки:", "https://");
    if (!url) return;
    exec("createLink", url);
  };

  return (
      <div className="flex h-full min-h-0 flex-col">
        {/* title row */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
          <input
            value={note.title}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="Без названия"
            className="min-w-0 flex-1 bg-transparent text-[18px] font-semibold text-white/90 outline-none placeholder:text-white/30"
          />
          <button
            onClick={onTogglePin}
            title={note.pinned ? "Открепить" : "Закрепить"}
            className={clsx(
              "grid h-8 w-8 place-items-center rounded-lg transition-colors",
              note.pinned
                ? "text-amber-300"
                : "text-white/40 hover:bg-white/5 hover:text-amber-200",
            )}
          >
            <Icon name="pin" size={15} />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowColors((v) => !v)}
              title="Цвет акцента"
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 hover:border-white/25"
              style={{ background: note.color ?? "transparent" }}
            >
              {!note.color && <span className="text-[14px] text-white/30">∅</span>}
            </button>
            {showColors && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowColors(false)} />
                <div className="app-window absolute right-0 top-[calc(100%+6px)] z-40 flex gap-1.5 rounded-xl border border-white/10 p-2 shadow-neon-strong">
                  <button
                    onClick={() => {
                      onChangeColor("");
                      setShowColors(false);
                    }}
                    title="Без цвета"
                    className="grid h-6 w-6 place-items-center rounded-md border border-white/10 text-[10px] text-white/40 hover:border-white/30"
                  >
                    ∅
                  </button>
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        onChangeColor(c);
                        setShowColors(false);
                      }}
                      className={clsx(
                        "h-6 w-6 rounded-md border transition-transform hover:scale-110",
                        note.color === c ? "border-white/60" : "border-white/10",
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          {confirmDel ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setConfirmDel(false);
                  onDelete();
                }}
                className="rounded-md px-2 py-1 text-[12px] text-rose-300 hover:bg-rose-500/15"
              >
                Удалить
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="rounded-md px-2 py-1 text-[12px] text-white/45 hover:bg-white/5"
              >
                Нет
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              title="Удалить заметку"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/5 hover:text-rose-300"
            >
              ✕
            </button>
          )}
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.05] px-3 py-1.5">
          <ToolBtn label="B" title="Жирный (Ctrl+B)" onClick={() => exec("bold")} bold />
          <ToolBtn label="I" title="Курсив (Ctrl+I)" onClick={() => exec("italic")} italic />
          <ToolBtn label="U" title="Подчёркивание (Ctrl+U)" onClick={() => exec("underline")} underline />
          <ToolBtn label="S" title="Зачёркивание" onClick={() => exec("strikeThrough")} strike />
          <ToolDivider />
          <ToolBtn label="H1" title="Заголовок" onClick={() => exec("formatBlock", "<h1>")} />
          <ToolBtn label="H2" title="Подзаголовок" onClick={() => exec("formatBlock", "<h2>")} />
          <ToolBtn label="¶" title="Обычный текст" onClick={() => exec("formatBlock", "<p>")} />
          <ToolDivider />
          <ToolBtn label="• —" title="Маркированный список" onClick={() => exec("insertUnorderedList")} />
          <ToolBtn label="1." title="Нумерованный список" onClick={() => exec("insertOrderedList")} />
          <ToolBtn label="❝" title="Цитата" onClick={() => exec("formatBlock", "<blockquote>")} />
          <ToolBtn label="‹›" title="Код" onClick={() => exec("formatBlock", "<pre>")} mono />
          <ToolDivider />
          <ToolBtn label="↗" title="Вставить ссылку" onClick={insertLink} />
          <ToolBtn label="⌫×" title="Очистить форматирование" onClick={() => exec("removeFormat")} />
        </div>

        {/* editor surface */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={flush}
          onBlur={flush}
          onKeyDown={(e) => {
            // Tab inside a list bumps the list level — preserve that behaviour.
            if (e.key === "Tab") {
              const isList = !!(window.getSelection()?.anchorNode as Element | null)?.closest?.(
                "li",
              );
              if (isList) {
                e.preventDefault();
                document.execCommand(e.shiftKey ? "outdent" : "indent");
              }
            }
          }}
          className="note-editor flex-1 overflow-y-auto px-6 py-5 text-[14px] leading-relaxed text-white/85 outline-none [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-violet-400/50 [&_blockquote]:bg-violet-500/[0.06] [&_blockquote]:px-3 [&_blockquote]:py-1 [&_blockquote]:italic [&_blockquote]:text-white/70 [&_code]:rounded [&_code]:bg-white/[0.06] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px] [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-[22px] [&_h1]:font-semibold [&_h1]:text-white/95 [&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:text-white/90 [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-white/85 [&_a]:text-violet-300 [&_a]:underline [&_a:hover]:text-violet-200 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_p]:my-1.5 [&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:bg-black/30 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[12.5px] [&_pre]:text-emerald-200/90"
          spellCheck
        />

        {/* footer meta */}
        <div className="flex items-center justify-between border-t border-white/[0.05] px-5 py-2 text-[11px] text-white/30">
          <span>Изменено: {formatRelative(note.updatedAt)}</span>
          <span className="font-mono">
            {plainTextPreview(note.content, 5000).length} симв.
          </span>
        </div>
      </div>
    );
}

function ToolBtn({
  label,
  title,
  onClick,
  bold,
  italic,
  underline,
  strike,
  mono,
}: {
  label: string;
  title: string;
  onClick: () => void;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep selection
      onClick={onClick}
      title={title}
      className={clsx(
        "min-w-[28px] rounded-md px-2 py-1 text-[12px] text-white/65 transition-colors hover:bg-white/5 hover:text-violet-200",
        bold && "font-bold",
        italic && "italic",
        underline && "underline",
        strike && "line-through",
        mono && "font-mono",
      )}
    >
      {label}
    </button>
  );
}

function ToolDivider() {
  return <span className="mx-1 h-5 w-px bg-white/10" />;
}
