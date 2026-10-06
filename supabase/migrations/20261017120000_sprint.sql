-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 018 · Sprint do Ninho
--
-- Mutirão com cronômetro (10, 15, 25 min ou personalizado) num cômodo ou objetivo.
-- • O cronômetro é calculado pelo horário (started_at + pausas), então continua
--   certo se a pessoa sair da tela, bloquear o celular ou abrir no outro aparelho.
-- • Um sprint ativo por casa (as duas veem o mesmo).
-- • Iniciar NÃO dá XP. Ao encerrar, ninho_finish_sprint conta só as tarefas do
--   sprint concluídas de verdade e soma o XP que elas já geraram (sem duplicar).
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.sprints (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  date          date not null default public.ninho_today(),
  started_by    text check (started_by is null or started_by in ('g','s')),
  participants  text[] not null default array['g','s'] check (cardinality(participants) between 1 and 2 and participants <@ array['g','s']),
  duration_min  smallint not null check (duration_min between 1 and 120),
  area          text not null default 'casa' check (length(area) between 1 and 30),
  goal          text check (goal is null or length(goal) <= 80),
  task_ids      uuid[] not null default '{}',
  started_at    timestamptz not null default now(),
  paused_at     timestamptz,
  paused_ms     bigint not null default 0 check (paused_ms >= 0),
  ended_at      timestamptz,
  status        text not null default 'running' check (status in ('running','paused','done','cancelled')),
  done_task_ids uuid[] not null default '{}',
  xp            integer not null default 0,
  created_at    timestamptz not null default now()
);
-- No máximo um sprint em andamento por casa
create unique index if not exists sprints_one_active on public.sprints (household_id) where ended_at is null;
create index if not exists sprints_recent on public.sprints (household_id, started_at desc);

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.sprints enable row level security;
  if strict_rls then
    drop policy if exists "allow_all_auth" on public.sprints;
    drop policy if exists "household_member" on public.sprints;
    create policy "household_member" on public.sprints for all to authenticated using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id));
  elsif not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'sprints') then
    create policy "allow_all_auth" on public.sprints for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.sprints to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.sprints to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sprints') then
    alter publication supabase_realtime add table public.sprints;
  end if;
end $$;

-- Encerrar: conta as tarefas do sprint concluídas no dia e o XP que já foi registrado por elas.
-- p_cancel = true descarta o sprint (nada é contado). Encerrar de novo não muda o resultado.
create or replace function public.ninho_finish_sprint(p_sprint_id uuid, p_cancel boolean default false)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v public.sprints%rowtype; v_done uuid[]; v_xp int;
begin
  select * into v from public.sprints where id = p_sprint_id for update;
  if not found then raise exception 'NINHO_NOT_FOUND: sprint não encontrado' using errcode = 'P0002'; end if;
  if v.ended_at is not null then
    return jsonb_build_object('id', v.id, 'status', v.status, 'done', coalesce(cardinality(v.done_task_ids), 0), 'xp', v.xp, 'already', true);
  end if;
  if p_cancel then
    update public.sprints set ended_at = now(), status = 'cancelled',
      paused_ms = paused_ms + case when paused_at is not null then (extract(epoch from now() - paused_at) * 1000)::bigint else 0 end, paused_at = null
    where id = p_sprint_id;
    return jsonb_build_object('id', v.id, 'status', 'cancelled', 'done', 0, 'xp', 0);
  end if;
  select coalesce(array_agg(distinct c.task_id), '{}') into v_done
  from public.task_completions c
  where c.task_id = any(v.task_ids) and c.date = v.date and c.household_id = v.household_id;
  select coalesce(sum(x.amount), 0) into v_xp
  from public.xp_history x
  where x.household_id = v.household_id and x.voided_at is null
    and x.reason = any(array(select public.ninho_xp_reason('task', t, v.date) from unnest(v_done) t));
  update public.sprints set ended_at = now(), status = 'done', done_task_ids = v_done, xp = v_xp,
    paused_ms = paused_ms + case when paused_at is not null then (extract(epoch from now() - paused_at) * 1000)::bigint else 0 end, paused_at = null
  where id = p_sprint_id;
  return jsonb_build_object('id', v.id, 'status', 'done', 'done', cardinality(v_done), 'xp', v_xp);
end $$;

-- Pausar/continuar com o relógio do servidor (os dois aparelhos veem o mesmo tempo).
-- p_extra_min: soma minutos ao sprint (ex.: "+5 min" quando o tempo acaba).
create or replace function public.ninho_sprint_pause(p_sprint_id uuid, p_pause boolean, p_extra_min int default 0)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v public.sprints%rowtype;
begin
  select * into v from public.sprints where id = p_sprint_id for update;
  if not found then raise exception 'NINHO_NOT_FOUND: sprint não encontrado' using errcode = 'P0002'; end if;
  if v.ended_at is not null then return to_jsonb(v); end if;
  if p_pause and v.paused_at is null then
    update public.sprints set paused_at = now(), status = 'paused' where id = p_sprint_id;
  elsif not p_pause and v.paused_at is not null then
    update public.sprints set paused_ms = paused_ms + (extract(epoch from now() - paused_at) * 1000)::bigint, paused_at = null, status = 'running' where id = p_sprint_id;
  end if;
  if coalesce(p_extra_min, 0) between 1 and 60 then
    update public.sprints set duration_min = least(120, duration_min + p_extra_min) where id = p_sprint_id;
  end if;
  select * into v from public.sprints where id = p_sprint_id;
  return to_jsonb(v);
end $$;

revoke all on function public.ninho_sprint_pause(uuid, boolean, int) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.ninho_sprint_pause(uuid, boolean, int) from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.ninho_sprint_pause(uuid, boolean, int) to authenticated; end if;
end $$;

revoke all on function public.ninho_finish_sprint(uuid, boolean) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.ninho_finish_sprint(uuid, boolean) from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.ninho_finish_sprint(uuid, boolean) to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.ninho_finish_sprint(uuid, boolean) to service_role; end if;
end $$;
