-- CHRONO — Supabase schema. Run this once in the Supabase SQL editor.
--
-- Every row is owned by the signed-in (Discord) user via owner_id = auth.uid().
-- Row-Level Security guarantees a profile only ever sees its own data, so the
-- same Discord account shows the same projects on any device.

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
  created_at    timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects (owner_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  is_completed boolean not null default false,
  priority     int not null default 0,
  parent_id    uuid references public.tasks (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete cascade,
  tags         jsonb not null default '[]'::jsonb,
  "order"      double precision,
  due          timestamptz,
  collapsed    boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists tasks_owner_idx on public.tasks (owner_id);
create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists tasks_parent_idx on public.tasks (parent_id);

-- ---------------------------------------------------------------------------
-- friends (per-user contact list)
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
-- Row-Level Security: a user can only touch their own rows.
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.tasks    enable row level security;
alter table public.friends  enable row level security;

create policy "own projects" on public.projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "own tasks" on public.tasks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "own friends" on public.friends
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
