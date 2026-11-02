-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 045 · Plano da semana
--
-- week_plan: o dia escolhido para cada tarefa da semana (semanal, quinzenal, mensal) no plano
--   aprovado no app ou no Telegram. A tarefa continua valendo a semana toda; no dia planejado ela
--   sobe para "Hoje". Um dia por tarefa por semana (week_start = segunda-feira).
--
-- Não destrutiva: só cria a tabela. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.week_plan (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  week_start   date not null check (extract(isodow from week_start) = 1),
  date         date not null,
  by_who       text check (by_who is null or by_who in ('g','s')),
  created_at   timestamptz not null default now(),
  unique (task_id, week_start),
  check (date between week_start and week_start + 6)
);
comment on table public.week_plan is 'Plano da semana: dia escolhido para cada tarefa não diária (week_start = segunda).';
create index if not exists week_plan_household_week on public.week_plan (household_id, week_start desc);

do $$
declare strict_rls boolean;
begin
  -- como a 042/044: regra por casa sempre que a função de membro existe (011 em diante)
  strict_rls := to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.week_plan enable row level security;
  drop policy if exists "allow_all_auth" on public.week_plan;
  drop policy if exists "household_member" on public.week_plan;
  if strict_rls then
    create policy "household_member" on public.week_plan for all to authenticated
      using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id));
  else
    create policy "allow_all_auth" on public.week_plan for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.week_plan to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.week_plan to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'week_plan') then
    alter publication supabase_realtime add table public.week_plan;
  end if;
end $$;

notify pgrst, 'reload schema';
