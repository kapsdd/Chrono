-- CHRONO — notes + kanban customization. Run after 0003.
-- Additive/idempotent: safe to re-run.

alter table public.tasks
  add column if not exists note text;

alter table public.projects
  add column if not exists kanban_columns jsonb not null default '[
    {"priority":3,"label":"Срочно","color":"#fb7185"},
    {"priority":2,"label":"Высокий","color":"#f59e0b"},
    {"priority":1,"label":"Средний","color":"#a78bfa"},
    {"priority":0,"label":"Без приоритета","color":"#64748b"}
  ]'::jsonb;
