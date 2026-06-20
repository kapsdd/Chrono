-- ============================================================================
-- CHRONO — полная настройка базы Supabase. ОДИН файл, вставить целиком в
-- Supabase → SQL Editor → New query → Run. Запускать можно сколько угодно раз:
-- всё идемпотентно (create if not exists / drop policy if exists / create or
-- replace), повторный запуск ничего не ломает и не теряет данные.
--
-- Заменяет собой schema.sql + migrations/0002 + migrations/0003.
-- Покрывает: проекты, задачи (дерево), друзей, тайм-трекинг, привычки,
-- общий доступ по коду+паролю (lobby) и Realtime для live-совместной работы.
-- Каждая строка принадлежит вошедшему пользователю: owner_id = auth.uid().
-- Row-Level Security гарантирует, что профиль видит только свои данные.
-- ============================================================================

-- pgcrypto нужен для crypt()/gen_salt() — пароль лобби хранится хешем.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  share_id      uuid not null default gen_random_uuid(),
  color         text,
  shared        boolean not null default false,
  collaborators jsonb not null default '[]'::jsonb,
  view          text not null default 'list',
  join_code     text,
  join_password  text, -- bcrypt-хеш, никогда не plaintext
  kanban_columns jsonb not null default '[]'::jsonb, -- кастомизация колонок Kanban
  created_at     timestamptz not null default now()
);

-- На случай, если таблица уже была создана старой schema.sql без lobby-колонок.
alter table public.projects
  add column if not exists color          text,
  add column if not exists shared         boolean not null default false,
  add column if not exists collaborators  jsonb not null default '[]'::jsonb,
  add column if not exists view           text not null default 'list',
  add column if not exists join_code      text,
  add column if not exists join_password  text,
  add column if not exists kanban_columns jsonb not null default '[]'::jsonb;

create index if not exists projects_owner_idx on public.projects (owner_id);
create unique index if not exists projects_join_code_idx
  on public.projects (join_code) where join_code is not null;

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users (id) on delete cascade,
  title             text not null,
  is_completed      boolean not null default false,
  priority          int not null default 0,
  parent_id         uuid references public.tasks (id) on delete cascade,
  project_id        uuid references public.projects (id) on delete cascade,
  tags              jsonb not null default '[]'::jsonb,
  "order"           double precision,
  due               timestamptz,
  collapsed         boolean not null default false,
  time_spent        integer not null default 0, -- секунды
  recurrence        text,                        -- null | daily | weekly | monthly
  streak            integer not null default 0,
  last_completed_at timestamptz,
  note              text,                          -- свободная заметка к задаче
  created_at        timestamptz not null default now()
);

-- На случай старой таблицы tasks без feature-колонок.
alter table public.tasks
  add column if not exists "order"           double precision,
  add column if not exists due               timestamptz,
  add column if not exists collapsed         boolean not null default false,
  add column if not exists time_spent        integer not null default 0,
  add column if not exists recurrence        text,
  add column if not exists streak            integer not null default 0,
  add column if not exists last_completed_at timestamptz,
  add column if not exists note              text;

create index if not exists tasks_owner_idx   on public.tasks (owner_id);
create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists tasks_parent_idx  on public.tasks (parent_id);

-- ---------------------------------------------------------------------------
-- friends (личный список контактов)
-- ---------------------------------------------------------------------------
create table if not exists public.friends (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  avatar     text,
  created_at timestamptz not null default now()
);

create index if not exists friends_owner_idx on public.friends (owner_id);

-- ---------------------------------------------------------------------------
-- project_members (участники общего проекта; владелец неявный — projects.owner_id)
-- ---------------------------------------------------------------------------
create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'editor',
  name       text,
  avatar     text,
  joined_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members (user_id);

-- ---------------------------------------------------------------------------
-- Проверка членства (SECURITY DEFINER обходит RLS, чтобы политики, которые
-- ссылаются на project_members, не рекурсировали сами на себя — классическая
-- ловушка Supabase).
-- ---------------------------------------------------------------------------
create or replace function public.is_project_member(p_project uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $member$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = p_user
  );
$member$;

-- Может ли пользователь писать в проект: владелец или участник с ролью editor.
-- Наблюдатели (viewer) проходят чтение, но не пишут — RLS на tasks использует
-- эту функцию для разграничения.
create or replace function public.can_write_project(p_project uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $cw$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and p.owner_id = p_user
  ) or exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = p_user and m.role = 'editor'
  );
$cw$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.projects        enable row level security;
alter table public.tasks           enable row level security;
alter table public.friends         enable row level security;
alter table public.project_members enable row level security;

-- projects ------------------------------------------------------------------
drop policy if exists "own projects"                  on public.projects;
drop policy if exists "read own or member projects"   on public.projects;
drop policy if exists "insert own projects"           on public.projects;
drop policy if exists "update own or member projects" on public.projects;
drop policy if exists "delete own projects"           on public.projects;

create policy "read own or member projects" on public.projects
  for select using (
    auth.uid() = owner_id or public.is_project_member(id, auth.uid())
  );
create policy "insert own projects" on public.projects
  for insert with check (auth.uid() = owner_id);
create policy "update own or member projects" on public.projects
  for update using (
    auth.uid() = owner_id or public.is_project_member(id, auth.uid())
  ) with check (
    auth.uid() = owner_id or public.is_project_member(id, auth.uid())
  );
create policy "delete own projects" on public.projects
  for delete using (auth.uid() = owner_id);

-- tasks ---------------------------------------------------------------------
drop policy if exists "own tasks"                  on public.tasks;
drop policy if exists "read own or shared tasks"   on public.tasks;
drop policy if exists "insert own or shared tasks" on public.tasks;
drop policy if exists "update own or shared tasks" on public.tasks;
drop policy if exists "delete own or shared tasks" on public.tasks;

create policy "read own or shared tasks" on public.tasks
  for select using (
    auth.uid() = owner_id
    or (project_id is not null and public.is_project_member(project_id, auth.uid()))
  );
-- Запись в задачу общего проекта требует роль editor (или владельца проекта).
-- Личные задачи (project_id is null) — только сам владелец строки.
create policy "insert own or shared tasks" on public.tasks
  for insert with check (
    (project_id is null and auth.uid() = owner_id)
    or (project_id is not null and public.can_write_project(project_id, auth.uid()) and auth.uid() = owner_id)
  );
create policy "update own or shared tasks" on public.tasks
  for update using (
    (project_id is null and auth.uid() = owner_id)
    or (project_id is not null and public.can_write_project(project_id, auth.uid()))
  ) with check (
    (project_id is null and auth.uid() = owner_id)
    or (project_id is not null and public.can_write_project(project_id, auth.uid()))
  );
create policy "delete own or shared tasks" on public.tasks
  for delete using (
    (project_id is null and auth.uid() = owner_id)
    or (project_id is not null and public.can_write_project(project_id, auth.uid()))
  );

-- friends -------------------------------------------------------------------
drop policy if exists "own friends" on public.friends;

create policy "own friends" on public.friends
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- project_members -----------------------------------------------------------
drop policy if exists "read members of my projects" on public.project_members;
drop policy if exists "leave or manage members"     on public.project_members;

create policy "read members of my projects" on public.project_members
  for select using (
    user_id = auth.uid()
    or public.is_project_member(project_id, auth.uid())
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );
create policy "leave or manage members" on public.project_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- publish / join RPC (security definer — сами проверяют пароль и владельца)
-- ---------------------------------------------------------------------------
-- Владелец публикует проект в лобби: код + хеш пароля.
create or replace function public.publish_project(p_project uuid, p_code text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $publish$
begin
  update public.projects
     set join_code = p_code,
         join_password = crypt(p_password, gen_salt('bf')),
         shared = true
   where id = p_project and owner_id = auth.uid();
  if not found then
    raise exception 'not owner or project missing';
  end if;
end;
$publish$;

-- Владелец закрывает доступ: очищает код, новые входы невозможны.
create or replace function public.unpublish_project(p_project uuid)
returns void
language plpgsql
security definer
set search_path = public
as $unpublish$
begin
  update public.projects
     set join_code = null, join_password = null
   where id = p_project and owner_id = auth.uid();
end;
$unpublish$;

-- Любой вошедший пользователь входит по коду + паролю. Проверяет bcrypt-хеш,
-- затем добавляет строку участника (definer обходит members-insert RLS).
create or replace function public.join_project(
  p_code text, p_password text, p_name text default null, p_avatar text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $join$
declare
  v_project public.projects%rowtype;
begin
  select * into v_project from public.projects
   where join_code = p_code and join_password is not null;
  if not found or v_project.join_password <> crypt(p_password, v_project.join_password) then
    raise exception 'invalid code or password';
  end if;
  if v_project.owner_id = auth.uid() then
    return v_project.id; -- владелец «входит» в свой проект: no-op
  end if;
  insert into public.project_members (project_id, user_id, role, name, avatar)
  values (v_project.id, auth.uid(), 'editor', p_name, p_avatar)
  on conflict (project_id, user_id)
    do update set name = excluded.name, avatar = excluded.avatar;
  return v_project.id;
end;
$join$;

-- Владелец проекта меняет роль участника лобби. Доступные роли: editor, viewer.
-- SECURITY DEFINER позволяет обновлять project_members без отдельной UPDATE
-- политики; проверка владения встроена в запрос.
create or replace function public.update_member_role(
  p_project uuid, p_user uuid, p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $role_upd$
begin
  if p_role not in ('editor','viewer') then
    raise exception 'invalid role: %', p_role;
  end if;
  update public.project_members m
     set role = p_role
   where m.project_id = p_project
     and m.user_id    = p_user
     and exists (
       select 1 from public.projects p
        where p.id = p_project and p.owner_id = auth.uid()
     );
  if not found then
    raise exception 'not owner or member missing';
  end if;
end;
$role_upd$;

-- ---------------------------------------------------------------------------
-- Realtime: live-обновления для совместной работы.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projects'
  ) then
    alter publication supabase_realtime add table public.projects;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_members'
  ) then
    alter publication supabase_realtime add table public.project_members;
  end if;
end $$;

-- ============================================================================
-- Готово. Перезапустите приложение (или войдите заново) — лобби, удаление и
-- синхронизация будут работать.
-- ============================================================================
