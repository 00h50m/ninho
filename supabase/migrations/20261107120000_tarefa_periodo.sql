-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 039 · Tarefas da casa com período (De … até …)
--
-- tasks.starts_on / tasks.ends_on: a tarefa só vale nesses dias (as duas pontas contam).
--   null = sem limite daquele lado. Fora do período ela não aparece em Hoje, não entra
--   no rodízio nem nos avisos, e não conta para a "Casa em dia".
-- ninho_day_on_track: passa a ignorar as diárias essenciais fora do período.
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

alter table public.tasks add column if not exists starts_on date;
alter table public.tasks add column if not exists ends_on date;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.tasks'::regclass and conname = 'tasks_period_check') then
    alter table public.tasks add constraint tasks_period_check
      check (starts_on is null or ends_on is null or ends_on >= starts_on) not valid;
  end if;
end $$;

comment on column public.tasks.starts_on is 'Período: a tarefa vale a partir deste dia. null = desde sempre.';
comment on column public.tasks.ends_on is 'Período: a tarefa vale até este dia (inclusive). null = sem fim.';

-- "Casa em dia": como na 009, mas sem as diárias essenciais que estão fora do período.
create or replace function public.ninho_day_on_track(p_household_id uuid, p_day date)
returns boolean language plpgsql stable security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.tasks t
                 where t.household_id = p_household_id and t.active and t.essential and t.frequency = 'daily'
                   and public.ninho_local_date(t.created_at) <= p_day
                   and public.ninho_task_on_day(t.weekdays, p_day)
                   and (t.starts_on is null or t.starts_on <= p_day) and (t.ends_on is null or t.ends_on >= p_day)) then
    return public.ninho_day_active(p_household_id, p_day, null);
  end if;
  return not exists (
    select 1 from public.tasks t
    where t.household_id = p_household_id and t.active and t.essential and t.frequency = 'daily'
      and public.ninho_local_date(t.created_at) <= p_day
      and public.ninho_task_on_day(t.weekdays, p_day)
      and (t.starts_on is null or t.starts_on <= p_day) and (t.ends_on is null or t.ends_on >= p_day)
      and not exists (select 1 from public.task_completions c where c.task_id = t.id and c.date = p_day)
      and not exists (select 1 from public.task_skips s where s.task_id = t.id and s.date = p_day));
end $$;
