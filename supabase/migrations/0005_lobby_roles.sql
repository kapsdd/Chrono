-- CHRONO — роли участников лобби (#19 продолжение). Запускать после 0004.
-- Идемпотентно (create or replace / drop policy if exists / create policy).
--
-- Добавляет:
--   * хелпер can_write_project — true для владельца проекта и для editor;
--     viewer проходит чтение, но не запись.
--   * RPC update_member_role — владелец меняет роль участника лобби
--     (editor / viewer).
--   * ужесточённые RLS на public.tasks: viewer становится read-only, editor и
--     владелец проекта пишут, личные задачи (project_id is null) — только сам
--     владелец строки.
--
-- ВАЖНО: если вы запускаете setup.sql целиком, эта миграция уже включена в
-- него; повторный прогон ничего не сломает.

-- ---------------------------------------------------------------------------
-- helper: write-capability
-- ---------------------------------------------------------------------------
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
-- tasks RLS — viewer становится read-only
-- ---------------------------------------------------------------------------
drop policy if exists "insert own or shared tasks" on public.tasks;
drop policy if exists "update own or shared tasks" on public.tasks;
drop policy if exists "delete own or shared tasks" on public.tasks;

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

-- ---------------------------------------------------------------------------
-- RPC: владелец меняет роль участника
-- ---------------------------------------------------------------------------
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
