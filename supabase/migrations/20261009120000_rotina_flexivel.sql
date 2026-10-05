-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 008 · Rotina flexível
--
-- · tasks.weekdays: dias da semana da tarefa (0 = domingo … 6 = sábado).
--   Diária: só nesses dias. Semanal/quinzenal: aparece a partir do primeiro
--   desses dias no período. null = qualquer dia (como antes).
-- · tasks.due_date: data de uma tarefa pontual (aparece a partir dela).
-- · task_skips: "deixar para amanhã" (snooze: some só naquele dia) e
--   "pular" (skip: resolve o período sem XP). Nenhum dos dois quebra a
--   sequência "casa em dia".
--
-- Só acrescenta colunas, uma tabela e substitui ninho_day_on_track.
-- Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

alter table public.tasks add column if not exists weekdays smallint[];
alter table public.tasks add column if not exists due_date date;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.tasks'::regclass and conname = 'tasks_weekdays_check') then
    alter table public.tasks add constraint tasks_weekdays_check
      check (weekdays is null or (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[])) not valid;
  end if;
end $$;
comment on column public.tasks.weekdays is 'Dias da semana (0 = domingo … 6 = sábado). null = qualquer dia.';
comment on column public.tasks.due_date is 'Tarefa pontual: data a partir da qual aparece em Hoje.';

create table if not exists public.task_skips (
  id           uuid primary key default uuid_generate_v4(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null default public.ninho_today(),
  kind         text not null check (kind in ('snooze','skip')),
  skipped_by   text check (skipped_by is null or skipped_by in ('g','s')),
  created_at   timestamptz not null default now(),
  unique (task_id, date)
);
comment on table public.task_skips is
  'snooze = deixar para amanhã (some só naquele dia); skip = pular (resolve o dia/semana/quinzena/mês sem XP).';
create index if not exists task_skips_household_date_idx on public.task_skips (household_id, date desc);

alter table public.task_skips enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'task_skips' and policyname = 'allow_all_auth') then
    create policy "allow_all_auth" on public.task_skips for all to authenticated using (true) with check (true);
  end if;
end $$;

-- A tarefa conta no dia p_day? (dias da semana da diária)
create or replace function public.ninho_task_on_day(p_weekdays smallint[], p_day date)
returns boolean language sql immutable as $$
  select p_weekdays is null or cardinality(p_weekdays) = 0 or extract(dow from p_day)::smallint = any(p_weekdays)
$$;

-- "Casa em dia": todas as essenciais diárias do dia feitas — agora ignorando
-- as que não são daquele dia da semana e as que foram puladas/adiadas.
create or replace function public.ninho_day_on_track(p_household_id uuid, p_day date)
returns boolean language plpgsql stable security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.tasks t
                 where t.household_id = p_household_id and t.active and t.essential and t.frequency = 'daily'
                   and public.ninho_local_date(t.created_at) <= p_day
                   and public.ninho_task_on_day(t.weekdays, p_day)) then
    return public.ninho_day_active(p_household_id, p_day, null);
  end if;
  return not exists (
    select 1 from public.tasks t
    where t.household_id = p_household_id and t.active and t.essential and t.frequency = 'daily'
      and public.ninho_local_date(t.created_at) <= p_day
      and public.ninho_task_on_day(t.weekdays, p_day)
      and not exists (select 1 from public.task_completions c where c.task_id = t.id and c.date = p_day)
      and not exists (select 1 from public.task_skips s where s.task_id = t.id and s.date = p_day));
end $$;

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_skips') then
    alter publication supabase_realtime add table public.task_skips;
  end if;
end $$;
