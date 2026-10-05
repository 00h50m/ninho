-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 005 · Gamificação
--
-- · Bônus de pontualidade: diária com horário concluída até o horário vale
--   XP ×1,5 (arredondado para cima). Atrasada no mesmo dia vale o XP normal.
--   Nunca tira pontos. Decidido no banco (pelo relógio de São Paulo), não no app.
-- · XP passa a guardar quem ganhou (earned_by), o dia (activity_date) e se foi
--   no horário (on_time) — base do placar semanal entre as duas.
-- · Sequências: da casa, "casa em dia" (essenciais diárias todas feitas),
--   por pessoa, e recordes.
-- · Estatísticas para conquistas (por categoria, pontualidade, madrugada,
--   faxina relâmpago, tarefas pesadas).
-- · Aposta da semana (weekly_settings.bet).
--
-- Só acrescenta: colunas opcionais, backfill, funções novas. Sem DROP de dados.
-- Requer as migrations 001–004. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

-- ── Colunas novas ───────────────────────────────────────────────────────
alter table public.xp_history add column if not exists earned_by text;
alter table public.xp_history add column if not exists activity_date date;
alter table public.xp_history add column if not exists on_time boolean not null default false;
alter table public.weekly_settings add column if not exists bet text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.xp_history'::regclass and conname = 'xp_history_earned_by_check') then
    alter table public.xp_history add constraint xp_history_earned_by_check
      check (earned_by is null or earned_by in ('g','s')) not valid;
  end if;
end $$;

comment on column public.xp_history.earned_by is 'Quem ganhou o XP (g|s). null = lançamento anterior à Fase 1 sem autoria.';
comment on column public.xp_history.activity_date is 'Dia doméstico (São Paulo) da conclusão que gerou o XP.';
comment on column public.xp_history.on_time is 'true quando a conclusão foi até o horário marcado (bônus ×1,5).';
comment on column public.weekly_settings.bet is 'Aposta simbólica da semana (ex.: quem perde escolhe o jantar).';

-- ── Backfill: dia e autoria dos lançamentos existentes ─────────────────
update public.xp_history
set activity_date = substring(reason from '(\d{4}-\d{2}-\d{2})$')::date
where activity_date is null and reason ~ ':\d{4}-\d{2}-\d{2}$';

update public.xp_history x
set earned_by = tc.completed_by
from public.task_completions tc
where x.earned_by is null and tc.completed_by is not null
  and x.reason ~ '^task:[0-9a-f-]{36}:\d{4}-\d{2}-\d{2}$'
  and tc.task_id = split_part(x.reason, ':', 2)::uuid
  and tc.date = split_part(x.reason, ':', 3)::date;

update public.xp_history x
set earned_by = dc.completed_by
from public.dog_completions dc
where x.earned_by is null and dc.completed_by is not null
  and x.reason ~ '^dog:[0-9a-f-]{36}:\d{4}-\d{2}-\d{2}$'
  and dc.routine_id = split_part(x.reason, ':', 2)::uuid
  and dc.date = split_part(x.reason, ':', 3)::date;

create index if not exists xp_history_household_activity_idx on public.xp_history (household_id, activity_date) where voided_at is null;

-- ── Pontualidade ────────────────────────────────────────────────────────
-- Diária com horário, concluída no próprio dia até o horário (relógio de São Paulo).
create or replace function public.ninho_is_on_time(p_frequency text, p_scheduled text, p_date date, p_now timestamptz)
returns boolean language sql immutable as $$
  select p_frequency = 'daily'
     and coalesce(p_scheduled, '') ~ '^\d{2}:\d{2}'
     and p_date = public.ninho_local_date(p_now)
     and to_char(p_now at time zone 'America/Sao_Paulo', 'HH24:MI') <= left(p_scheduled, 5)
$$;

create or replace function public.ninho_xp_with_bonus(p_base integer, p_on_time boolean)
returns integer language sql immutable as $$
  select case when p_on_time then ceil(p_base * 1.5)::integer else p_base end
$$;

-- ── Concluir tarefa (substitui a versão da 003, mesma assinatura) ──────
-- Retorno: { task_id, date, created, completed_by, completion_id, xp, base_xp, on_time }
create or replace function public.ninho_complete_task(p_task_id uuid, p_date date, p_by text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_task    public.tasks%rowtype;
  v_base    integer;
  v_on_time boolean;
  v_xp      integer;
  v_created boolean;
  v_row     public.task_completions%rowtype;
begin
  perform public.ninho_check_completion_input(p_date, p_by, true);

  select * into v_task from public.tasks where id = p_task_id;
  if not found then
    raise exception 'NINHO_NOT_FOUND: tarefa % não encontrada', p_task_id using errcode = 'P0002';
  end if;

  insert into public.task_completions (task_id, household_id, date, completed_by)
  values (p_task_id, v_task.household_id, p_date, p_by)
  on conflict (task_id, date) do nothing;
  v_created := found;

  select * into v_row from public.task_completions where task_id = p_task_id and date = p_date;

  v_base := public.ninho_xp_for_weight(v_task.weight);
  -- Pontualidade conta só para a conclusão real (a primeira), pelo relógio do banco
  v_on_time := v_created and public.ninho_is_on_time(v_task.frequency, v_task.scheduled_time, p_date, now());
  v_xp := public.ninho_xp_with_bonus(v_base, v_on_time);

  insert into public.xp_history (household_id, amount, reason, earned_by, activity_date, on_time)
  values (v_task.household_id, v_xp, public.ninho_xp_reason('task', p_task_id, p_date), v_row.completed_by, p_date, v_on_time)
  on conflict (household_id, reason) where reason is not null and voided_at is null do nothing;

  select amount, on_time into v_xp, v_on_time from public.xp_history
  where household_id = v_task.household_id and reason = public.ninho_xp_reason('task', p_task_id, p_date) and voided_at is null;

  return jsonb_build_object('task_id', p_task_id, 'date', p_date, 'created', v_created,
                            'completed_by', v_row.completed_by, 'completion_id', v_row.id,
                            'xp', coalesce(v_xp, v_base), 'base_xp', v_base, 'on_time', coalesce(v_on_time, false));
end $$;

-- ── Concluir rotinas dos cães (substitui a versão da 003) ──────────────
-- Retorno: { date, routines, created, xp_added, on_time,
--            completions: [{ routine_id, completion_id, completed_by, on_time }] }
create or replace function public.ninho_complete_dog_routines(p_routine_ids uuid[], p_date date, p_by text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_ids      uuid[];
  v_r        record;
  v_found    integer := 0;
  v_created  integer := 0;
  v_xp       integer := 0;
  v_on_any   boolean := false;
  v_new      boolean;
  v_on_time  boolean;
  v_amount   integer;
  v_out      jsonb := '[]'::jsonb;
  v_row      public.dog_completions%rowtype;
begin
  perform public.ninho_check_completion_input(p_date, p_by, true);
  v_ids := array(select distinct unnest(coalesce(p_routine_ids, '{}')));

  for v_r in
    select r.id, r.frequency, r.scheduled_time, coalesce(r.household_id, d.household_id) as household_id
    from public.dog_routines r left join public.dogs d on d.id = r.dog_id
    where r.id = any (v_ids)
    order by r.id
  loop
    v_found := v_found + 1;

    insert into public.dog_completions (routine_id, household_id, date, completed_by)
    values (v_r.id, v_r.household_id, p_date, p_by)
    on conflict (routine_id, date) do nothing;
    v_new := found;
    if v_new then v_created := v_created + 1; end if;

    select * into v_row from public.dog_completions where routine_id = v_r.id and date = p_date;

    v_on_time := v_new and public.ninho_is_on_time(v_r.frequency, v_r.scheduled_time, p_date, now());
    v_amount := public.ninho_xp_with_bonus(1, v_on_time);
    insert into public.xp_history (household_id, amount, reason, earned_by, activity_date, on_time)
    values (v_r.household_id, v_amount, public.ninho_xp_reason('dog', v_r.id, p_date), v_row.completed_by, p_date, v_on_time)
    on conflict (household_id, reason) where reason is not null and voided_at is null do nothing;
    if found then
      v_xp := v_xp + v_amount;
      v_on_any := v_on_any or v_on_time;
    end if;

    v_out := v_out || jsonb_build_object('routine_id', v_r.id, 'completion_id', v_row.id, 'completed_by', v_row.completed_by, 'on_time', v_on_time);
  end loop;

  if v_found <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'NINHO_NOT_FOUND: % de % rotinas não encontradas', coalesce(array_length(v_ids, 1), 0) - v_found, coalesce(array_length(v_ids, 1), 0)
      using errcode = 'P0002';
  end if;

  return jsonb_build_object('date', p_date, 'routines', v_found, 'created', v_created, 'xp_added', v_xp, 'on_time', v_on_any, 'completions', v_out);
end $$;

-- ── Sequências ──────────────────────────────────────────────────────────
-- Dia com pelo menos uma conclusão (da casa, ou de uma pessoa).
create or replace function public.ninho_day_active(p_household_id uuid, p_day date, p_who text default null)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.task_completions where household_id = p_household_id and date = p_day and (p_who is null or completed_by = p_who))
      or exists (select 1 from public.dog_completions  where household_id = p_household_id and date = p_day and (p_who is null or completed_by = p_who))
$$;

-- "Casa em dia": todas as diárias essenciais (que já existiam no dia) foram feitas.
-- Sem nenhuma essencial diária, vale a regra de "pelo menos uma conclusão".
create or replace function public.ninho_day_on_track(p_household_id uuid, p_day date)
returns boolean language plpgsql stable security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.tasks t
                 where t.household_id = p_household_id and t.active and t.essential and t.frequency = 'daily'
                   and public.ninho_local_date(t.created_at) <= p_day) then
    return public.ninho_day_active(p_household_id, p_day, null);
  end if;
  return not exists (
    select 1 from public.tasks t
    where t.household_id = p_household_id and t.active and t.essential and t.frequency = 'daily'
      and public.ninho_local_date(t.created_at) <= p_day
      and not exists (select 1 from public.task_completions c where c.task_id = t.id and c.date = p_day));
end $$;

-- Sequência atual: se hoje ainda não conta, conta até ontem (não quebra durante o dia).
-- p_kind: 'house' | 'on_track' | 'person' (com p_who).
create or replace function public.ninho_streak_of(p_household_id uuid, p_today date, p_kind text, p_who text default null)
returns integer language plpgsql stable security invoker set search_path = public as $$
declare
  v_day date := p_today;
  v_n   integer := 0;
  ok    boolean;
begin
  for i in 0..3660 loop
    ok := case p_kind when 'on_track' then public.ninho_day_on_track(p_household_id, v_day)
                      else public.ninho_day_active(p_household_id, v_day, case when p_kind = 'person' then p_who end) end;
    if not ok then
      if i = 0 then v_day := v_day - 1; continue; end if;
      exit;
    end if;
    v_n := v_n + 1;
    v_day := v_day - 1;
  end loop;
  return v_n;
end $$;

-- Maior sequência dos últimos p_days dias (ilhas de dias consecutivos).
create or replace function public.ninho_best_streak_of(p_household_id uuid, p_today date, p_kind text, p_who text default null, p_days integer default 400)
returns integer language sql stable security invoker set search_path = public as $$
  with days as (
    select g::date as d
    from generate_series(p_today - p_days, p_today, interval '1 day') g
    where case p_kind when 'on_track' then public.ninho_day_on_track(p_household_id, g::date)
                      else public.ninho_day_active(p_household_id, g::date, case when p_kind = 'person' then p_who end) end
  ), islands as (
    select d - (row_number() over (order by d))::integer as grp from days
  )
  select coalesce(max(c), 0)::integer from (select count(*) as c from islands group by grp) x
$$;

-- ninho_streaks(p_household_id, p_today) →
--   { house, house_best, on_track, on_track_best, g, g_best, s, s_best }
create or replace function public.ninho_streaks(p_household_id uuid, p_today date default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare v_t date := coalesce(p_today, public.ninho_today());
begin
  return jsonb_build_object(
    'house',         public.ninho_streak_of(p_household_id, v_t, 'house'),
    'house_best',    public.ninho_best_streak_of(p_household_id, v_t, 'house'),
    'on_track',      public.ninho_streak_of(p_household_id, v_t, 'on_track'),
    'on_track_best', public.ninho_best_streak_of(p_household_id, v_t, 'on_track'),
    'g',             public.ninho_streak_of(p_household_id, v_t, 'person', 'g'),
    'g_best',        public.ninho_best_streak_of(p_household_id, v_t, 'person', 'g'),
    's',             public.ninho_streak_of(p_household_id, v_t, 'person', 's'),
    's_best',        public.ninho_best_streak_of(p_household_id, v_t, 'person', 's'));
end $$;

-- ── Placar semanal ──────────────────────────────────────────────────────
-- ninho_weekly_scores(p_household_id, p_week_start) →
--   { g: {xp, done, on_time}, s: {...}, unknown: {...} }  (semana de segunda a domingo)
create or replace function public.ninho_weekly_scores(p_household_id uuid, p_week_start date)
returns jsonb language sql stable security invoker set search_path = public as $$
  with w as (
    select coalesce(earned_by, 'unknown') as who, amount, on_time
    from public.xp_history
    where household_id = p_household_id and voided_at is null
      and activity_date between p_week_start and p_week_start + 6
  )
  select jsonb_build_object(
    'g',       jsonb_build_object('xp', coalesce(sum(amount) filter (where who = 'g'), 0), 'done', count(*) filter (where who = 'g'), 'on_time', count(*) filter (where who = 'g' and on_time)),
    's',       jsonb_build_object('xp', coalesce(sum(amount) filter (where who = 's'), 0), 'done', count(*) filter (where who = 's'), 'on_time', count(*) filter (where who = 's' and on_time)),
    'unknown', jsonb_build_object('xp', coalesce(sum(amount) filter (where who = 'unknown'), 0), 'done', count(*) filter (where who = 'unknown'), 'on_time', 0))
  from w
$$;

-- ── Estatísticas para conquistas ───────────────────────────────────────
-- Só conta conclusões com autoria (registros antigos "não identificados" não entram).
-- ninho_achievement_stats(p_household_id, p_today) → { g: {...}, s: {...} } com:
--   categories {kitchen: n, ...} (rotinas dos cães somam em "dogs"), heavy, on_time,
--   early (antes das 08:00), flash (máx. de tarefas numa janela de 60 min), best_streak
create or replace function public.ninho_achievement_stats(p_household_id uuid, p_today date default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_t   date := coalesce(p_today, public.ninho_today());
  v_out jsonb := '{}'::jsonb;
  w     text;
  v_cat jsonb;
begin
  foreach w in array array['g','s'] loop
    select coalesce(jsonb_object_agg(category, n), '{}'::jsonb) into v_cat from (
      select t.category, count(*) as n
      from public.task_completions c join public.tasks t on t.id = c.task_id
      where c.household_id = p_household_id and c.completed_by = w
      group by t.category
    ) x;
    v_cat := v_cat || jsonb_build_object('dogs', coalesce((v_cat->>'dogs')::int, 0) +
      (select count(*) from public.dog_completions where household_id = p_household_id and completed_by = w));

    v_out := v_out || jsonb_build_object(w, jsonb_build_object(
      'categories', v_cat,
      'heavy', (select count(*) from public.task_completions c join public.tasks t on t.id = c.task_id
                where c.household_id = p_household_id and c.completed_by = w and t.weight = 'heavy'),
      'on_time', (select count(*) from public.xp_history
                  where household_id = p_household_id and earned_by = w and on_time and voided_at is null),
      'early', (select count(*) from (
                  select created_at from public.task_completions where household_id = p_household_id and completed_by = w
                  union all
                  select created_at from public.dog_completions where household_id = p_household_id and completed_by = w) e
                where to_char(e.created_at at time zone 'America/Sao_Paulo', 'HH24:MI') < '08:00'),
      'flash', coalesce((select max(n) from (
                  select count(*) over (order by created_at range between current row and interval '60 minutes' following) as n
                  from public.task_completions where household_id = p_household_id and completed_by = w) f), 0),
      'best_streak', public.ninho_best_streak_of(p_household_id, v_t, 'person', w)
    ));
  end loop;
  return v_out;
end $$;

-- ── Permissões: só usuários autenticados (login anônimo do app) ─────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.ninho_complete_task(uuid, date, text)',
    'public.ninho_complete_dog_routines(uuid[], date, text)',
    'public.ninho_streaks(uuid, date)',
    'public.ninho_weekly_scores(uuid, date)',
    'public.ninho_achievement_stats(uuid, date)',
    'public.ninho_day_active(uuid, date, text)',
    'public.ninho_day_on_track(uuid, date)',
    'public.ninho_streak_of(uuid, date, text, text)',
    'public.ninho_best_streak_of(uuid, date, text, text, integer)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', f); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('grant execute on function %s to authenticated', f); end if;
  end loop;
end $$;
