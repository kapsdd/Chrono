-- CHRONO — фикс одностороннего «не синхронизируется» в общих проектах.
-- Запускать после 0005. Идемпотентно.
--
-- Корень бага: SELECT-политика на public.tasks использовала is_project_member,
-- а владелец проекта в project_members не сидит. Поэтому владелец не видел
-- задачи, созданные присоединившимися пользователями, и наоборот всё работало.
-- Заводим can_access_project (владелец ИЛИ любой участник, включая viewer) и
-- переключаем SELECT на него.
--
-- ВАЖНО: setup.sql (полная версия) уже содержит эти изменения; повторный
-- прогон ничего не сломает.

-- ---------------------------------------------------------------------------
-- helper: read-capability (владелец проекта + любой участник)
-- ---------------------------------------------------------------------------
create or replace function public.can_access_project(p_project uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $access$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and p.owner_id = p_user
  ) or exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = p_user
  );
$access$;

-- ---------------------------------------------------------------------------
-- tasks SELECT: владелец общего проекта теперь видит задачи всех участников.
-- ---------------------------------------------------------------------------
drop policy if exists "read own or shared tasks" on public.tasks;

create policy "read own or shared tasks" on public.tasks
  for select using (
    auth.uid() = owner_id
    or (project_id is not null and public.can_access_project(project_id, auth.uid()))
  );
