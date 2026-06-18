-- CHRONO — feature migration. Run AFTER schema.sql, once, in the Supabase SQL
-- editor. Everything here is additive/idempotent, so re-running is safe.
--
-- Covers: per-task time tracking (#11), recurring tasks & habits (#14), and the
-- password-join "lobby" for shared projects (#19).

-- ---------------------------------------------------------------------------
-- tasks: time tracking + recurrence / habit streaks
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists time_spent        integer     not null default 0, -- seconds
  add column if not exists recurrence        text,        -- null | daily | weekly | monthly
  add column if not exists streak            integer     not null default 0,
  add column if not exists last_completed_at timestamptz;

-- ---------------------------------------------------------------------------
-- lobby: projects others join with a code + password
-- ---------------------------------------------------------------------------
-- pgcrypto gives crypt()/gen_salt() so the join password is stored hashed.
create extension if not exists pgcrypto;

alter table public.projects
  add column if not exists join_code     text,
  add column if not exists join_password text; -- bcrypt hash, never the plaintext

create unique index if not exists projects_join_code_idx
  on public.projects (join_code) where join_code is not null;

-- Membership of a shared project. The owner is implicit (projects.owner_id) and
-- is not listed here.
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

-- SECURITY DEFINER membership check: bypasses RLS so policies referencing
-- project_members don't recurse on themselves (a classic Supabase pitfall).
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

-- ---------------------------------------------------------------------------
-- RLS: extend project/task visibility to members (was owner-only)
-- ---------------------------------------------------------------------------
drop policy if exists "own projects" on public.projects;

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

drop policy if exists "own tasks" on public.tasks;

create policy "read own or shared tasks" on public.tasks
  for select using (
    auth.uid() = owner_id
    or (project_id is not null and public.is_project_member(project_id, auth.uid()))
  );
create policy "insert own or shared tasks" on public.tasks
  for insert with check (
    auth.uid() = owner_id
    or (project_id is not null and public.is_project_member(project_id, auth.uid()))
  );
create policy "update own or shared tasks" on public.tasks
  for update using (
    auth.uid() = owner_id
    or (project_id is not null and public.is_project_member(project_id, auth.uid()))
  ) with check (
    auth.uid() = owner_id
    or (project_id is not null and public.is_project_member(project_id, auth.uid()))
  );
create policy "delete own or shared tasks" on public.tasks
  for delete using (
    auth.uid() = owner_id
    or (project_id is not null and public.is_project_member(project_id, auth.uid()))
  );

alter table public.project_members enable row level security;

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
-- publish / join RPCs (security definer — they enforce the password themselves)
-- ---------------------------------------------------------------------------
-- Owner publishes a project to the lobby with a join code + hashed password.
create or replace function public.publish_project(p_project uuid, p_code text, p_password text)
returns void
language plpgsql
security definer
-- include `extensions` so pgcrypto's crypt()/gen_salt() resolve on Supabase.
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

-- Owner stops sharing: clears the code so no new joins are possible.
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

-- Any signed-in user joins by code + password. Verifies the bcrypt hash, then
-- adds a membership row (definer bypasses the members-insert RLS).
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
    return v_project.id; -- owner "joining" their own project: no-op
  end if;
  insert into public.project_members (project_id, user_id, role, name, avatar)
  values (v_project.id, auth.uid(), 'editor', p_name, p_avatar)
  on conflict (project_id, user_id)
    do update set name = excluded.name, avatar = excluded.avatar;
  return v_project.id;
end;
$join$;
