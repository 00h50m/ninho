-- ══════════════════════════════════════════════════════════════════════
-- NINHO — SNAPSHOT do schema public (gerado, somente referência)
--
-- Gerado com pg_dump --schema-only depois de aplicar supabase/migrations/
-- num banco novo (scripts/test-db.sh com DUMP_SNAPSHOT=1).
--
-- ⚠ NÃO rode este arquivo em produção e não edite à mão.
--   A fonte da verdade são as migrations em supabase/migrations/.
--   Para criar um banco novo ou atualizar o atual, aplique as migrations
--   em ordem (veja docs/MIGRATIONS.md).
--
-- Não inclui: schema auth (gerenciado pelo Supabase), a publicação
-- supabase_realtime e as permissões (gerenciadas pelo Supabase).
-- ══════════════════════════════════════════════════════════════════════

--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: ninho_achievement_stats(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_achievement_stats(p_household_id uuid, p_today date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
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


--
-- Name: ninho_best_streak_of(uuid, date, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_best_streak_of(p_household_id uuid, p_today date, p_kind text, p_who text DEFAULT NULL::text, p_days integer DEFAULT 400) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
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


--
-- Name: ninho_check_completion_input(date, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_check_completion_input(p_date date, p_by text, p_need_by boolean) RETURNS void
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
begin
  if p_date is null or p_date < public.ninho_today() - 1 or p_date > public.ninho_today() + 1 then
    raise exception 'NINHO_INVALID_DATE: a data % está fora do dia atual em São Paulo', p_date
      using errcode = '22023';
  end if;
  if p_need_by and (p_by is null or p_by not in ('g','s')) then
    raise exception 'NINHO_INVALID_PERSON: quem concluiu deve ser g ou s (recebido: %)', coalesce(p_by, 'vazio')
      using errcode = '22023';
  end if;
end $$;


--
-- Name: ninho_complete_dog_routines(uuid[], date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_complete_dog_routines(p_routine_ids uuid[], p_date date, p_by text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: ninho_complete_task(uuid, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_complete_task(p_task_id uuid, p_date date, p_by text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: ninho_day_active(uuid, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_day_active(p_household_id uuid, p_day date, p_who text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.task_completions where household_id = p_household_id and date = p_day and (p_who is null or completed_by = p_who))
      or exists (select 1 from public.dog_completions  where household_id = p_household_id and date = p_day and (p_who is null or completed_by = p_who))
$$;


--
-- Name: ninho_day_on_track(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_day_on_track(p_household_id uuid, p_day date) RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
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


--
-- Name: ninho_fill_dog_completion_household(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_fill_dog_completion_household() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.household_id is null then
    select coalesce(r.household_id, d.household_id) into new.household_id
    from public.dog_routines r left join public.dogs d on d.id = r.dog_id
    where r.id = new.routine_id;
  end if;
  return new;
end $$;


--
-- Name: ninho_fill_task_completion_household(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_fill_task_completion_household() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.household_id is null then
    select t.household_id into new.household_id from public.tasks t where t.id = new.task_id;
  end if;
  return new;
end $$;


--
-- Name: ninho_household_xp(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_household_xp(p_household_id uuid) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(amount), 0)::integer
  from public.xp_history
  where household_id = p_household_id and voided_at is null
$$;


--
-- Name: ninho_is_on_time(text, text, date, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_is_on_time(p_frequency text, p_scheduled text, p_date date, p_now timestamp with time zone) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select p_frequency = 'daily'
     and coalesce(p_scheduled, '') ~ '^\d{2}:\d{2}'
     and p_date = public.ninho_local_date(p_now)
     and to_char(p_now at time zone 'America/Sao_Paulo', 'HH24:MI') <= left(p_scheduled, 5)
$$;


--
-- Name: ninho_local_date(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_local_date(p_ts timestamp with time zone) RETURNS date
    LANGUAGE sql IMMUTABLE
    AS $$ select (p_ts at time zone 'America/Sao_Paulo')::date $$;


--
-- Name: FUNCTION ninho_local_date(p_ts timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ninho_local_date(p_ts timestamp with time zone) IS 'Converte um instante para a data doméstica em America/Sao_Paulo.';


--
-- Name: ninho_save_push_subscription(uuid, text, text, text, text, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_save_push_subscription(p_household_id uuid, p_who text, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text, p_morning boolean DEFAULT true, p_weekly boolean DEFAULT true) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  if p_who is null or p_who not in ('g','s') then
    raise exception 'NINHO_INVALID_PERSON: quem usa o aparelho deve ser g ou s' using errcode = '22023';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' then
    raise exception 'NINHO_INVALID_ENDPOINT: endereço de notificação inválido' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (household_id, who, endpoint, p256dh, auth, user_agent, morning, weekly, active, failures)
  values (p_household_id, p_who, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300), p_morning, p_weekly, true, 0)
  on conflict (endpoint) do update set
    household_id = excluded.household_id, who = excluded.who, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, morning = excluded.morning, weekly = excluded.weekly, active = true, failures = 0
  returning id into v_id;
  return v_id;
end $$;


--
-- Name: ninho_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


--
-- Name: ninho_streak(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_streak(p_household_id uuid, p_today date DEFAULT NULL::date) RETURNS integer
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_day   date := coalesce(p_today, public.ninho_today());
  v_count integer := 0;
begin
  if not exists (select 1 from public.task_completions where household_id = p_household_id and date = v_day)
     and not exists (select 1 from public.dog_completions where household_id = p_household_id and date = v_day) then
    v_day := v_day - 1;
  end if;

  while v_count < 3660 and (
        exists (select 1 from public.task_completions where household_id = p_household_id and date = v_day)
     or exists (select 1 from public.dog_completions where household_id = p_household_id and date = v_day)) loop
    v_count := v_count + 1;
    v_day := v_day - 1;
  end loop;

  return v_count;
end $$;


--
-- Name: ninho_streak_of(uuid, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_streak_of(p_household_id uuid, p_today date, p_kind text, p_who text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
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


--
-- Name: ninho_streaks(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_streaks(p_household_id uuid, p_today date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
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


--
-- Name: ninho_today(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_today() RETURNS date
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$ select public.ninho_local_date(now()) $$;


--
-- Name: FUNCTION ninho_today(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ninho_today() IS 'Data de hoje no fuso da casa (America/Sao_Paulo). Usada como default de datas domésticas.';


--
-- Name: ninho_uncomplete_dog_routines(uuid[], date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_uncomplete_dog_routines(p_routine_ids uuid[], p_date date) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_r       record;
  v_removed integer := 0;
  v_n       integer;
begin
  perform public.ninho_check_completion_input(p_date, null, false);

  for v_r in
    select r.id, coalesce(r.household_id, d.household_id) as household_id
    from public.dog_routines r left join public.dogs d on d.id = r.dog_id
    where r.id = any (coalesce(p_routine_ids, '{}'))
  loop
    delete from public.dog_completions where routine_id = v_r.id and date = p_date;
    get diagnostics v_n = row_count;
    v_removed := v_removed + v_n;
    delete from public.xp_history
    where household_id = v_r.household_id
      and reason = public.ninho_xp_reason('dog', v_r.id, p_date)
      and voided_at is null;
  end loop;

  return jsonb_build_object('date', p_date, 'removed', v_removed);
end $$;


--
-- Name: ninho_uncomplete_task(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_uncomplete_task(p_task_id uuid, p_date date) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_household uuid;
  v_removed   integer;
begin
  perform public.ninho_check_completion_input(p_date, null, false);

  select household_id into v_household from public.tasks where id = p_task_id;
  if not found then
    raise exception 'NINHO_NOT_FOUND: tarefa % não encontrada', p_task_id using errcode = 'P0002';
  end if;

  delete from public.task_completions where task_id = p_task_id and date = p_date;
  get diagnostics v_removed = row_count;

  delete from public.xp_history
  where household_id = v_household
    and reason = public.ninho_xp_reason('task', p_task_id, p_date)
    and voided_at is null;

  return jsonb_build_object('task_id', p_task_id, 'date', p_date, 'removed', v_removed > 0);
end $$;


--
-- Name: ninho_weekly_scores(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_weekly_scores(p_household_id uuid, p_week_start date) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
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


--
-- Name: ninho_xp_for_weight(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_xp_for_weight(p_weight text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  select case p_weight when 'light' then 1 when 'medium' then 2 when 'heavy' then 3 else 1 end
$$;


--
-- Name: ninho_xp_reason(text, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_xp_reason(p_kind text, p_id uuid, p_date date) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select p_kind || ':' || p_id::text || ':' || to_char(p_date, 'YYYY-MM-DD')
$$;


--
-- Name: FUNCTION ninho_xp_reason(p_kind text, p_id uuid, p_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ninho_xp_reason(p_kind text, p_id uuid, p_date date) IS 'Origem do XP: task:<id>:<data> ou dog:<id>:<data>. Igual ao formato já usado pelo app.';


--
-- Name: ninho_xp_with_bonus(integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_xp_with_bonus(p_base integer, p_on_time boolean) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  select case when p_on_time then ceil(p_base * 1.5)::integer else p_base end
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: dog_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dog_completions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    routine_id uuid,
    date date DEFAULT public.ninho_today(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_by text,
    household_id uuid NOT NULL
);


--
-- Name: dog_routines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dog_routines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dog_id uuid,
    household_id uuid,
    title text NOT NULL,
    frequency text DEFAULT 'daily'::text,
    scheduled_time text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: dogs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dogs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    household_id uuid,
    name text NOT NULL,
    breed text,
    is_puppy boolean DEFAULT false,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: households; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.households (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text DEFAULT 'Ninho'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    household_id uuid,
    name text DEFAULT 'Integrante'::text NOT NULL,
    display_name text,
    role text DEFAULT 'g'::text,
    avatar_color text DEFAULT '#5dcaa5'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: puppy_accidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puppy_accidents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dog_id uuid,
    household_id uuid,
    location text NOT NULL,
    date date DEFAULT public.ninho_today() NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: push_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    subscription_id uuid NOT NULL,
    kind text NOT NULL,
    day date DEFAULT public.ninho_today() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_log_kind_check CHECK ((kind = ANY (ARRAY['morning'::text, 'weekly'::text, 'test'::text]))),
    CONSTRAINT push_log_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    household_id uuid NOT NULL,
    who text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    morning boolean DEFAULT true NOT NULL,
    weekly boolean DEFAULT true NOT NULL,
    active boolean DEFAULT true NOT NULL,
    failures integer DEFAULT 0 NOT NULL,
    last_success_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT push_subscriptions_who_check CHECK ((who = ANY (ARRAY['g'::text, 's'::text])))
);


--
-- Name: TABLE push_subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.push_subscriptions IS 'Aparelhos com notificação ativada. who = pessoa do aparelho (identificação local, sem login).';


--
-- Name: task_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_completions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid,
    household_id uuid NOT NULL,
    completed_by text,
    date date DEFAULT public.ninho_today(),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    household_id uuid,
    title text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    weight text DEFAULT 'medium'::text NOT NULL,
    frequency text DEFAULT 'weekly'::text NOT NULL,
    assigned_to text,
    scheduled_time text,
    essential boolean DEFAULT false,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tasks_weight_check CHECK ((weight = ANY (ARRAY['light'::text, 'medium'::text, 'heavy'::text])))
);


--
-- Name: weekly_meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_meetings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    household_id uuid,
    week_start date NOT NULL,
    what_worked text,
    what_overloaded text,
    adjustments text,
    priorities text,
    mood_g text,
    mood_s text,
    wins text,
    next_mode text,
    reward text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: weekly_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    household_id uuid,
    week_start date NOT NULL,
    energy text DEFAULT 'medium'::text,
    survival boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now(),
    bet text
);


--
-- Name: COLUMN weekly_settings.bet; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.weekly_settings.bet IS 'Aposta simbólica da semana (ex.: quem perde escolhe o jantar).';


--
-- Name: xp_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    household_id uuid,
    amount integer DEFAULT 0 NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    voided_at timestamp with time zone,
    void_reason text,
    earned_by text,
    activity_date date,
    on_time boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN xp_history.voided_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.xp_history.voided_at IS 'Preenchido quando o lançamento foi anulado (ex.: duplicado encontrado na migração 002). Lançamentos anulados não contam no XP.';


--
-- Name: COLUMN xp_history.earned_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.xp_history.earned_by IS 'Quem ganhou o XP (g|s). null = lançamento anterior à Fase 1 sem autoria.';


--
-- Name: COLUMN xp_history.activity_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.xp_history.activity_date IS 'Dia doméstico (São Paulo) da conclusão que gerou o XP.';


--
-- Name: COLUMN xp_history.on_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.xp_history.on_time IS 'true quando a conclusão foi até o horário marcado (bônus ×1,5).';


--
-- Name: dog_completions dog_completions_completed_by_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.dog_completions
    ADD CONSTRAINT dog_completions_completed_by_check CHECK (((completed_by IS NULL) OR (completed_by = ANY (ARRAY['g'::text, 's'::text])))) NOT VALID;


--
-- Name: dog_completions dog_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dog_completions
    ADD CONSTRAINT dog_completions_pkey PRIMARY KEY (id);


--
-- Name: dog_completions dog_completions_routine_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dog_completions
    ADD CONSTRAINT dog_completions_routine_id_date_key UNIQUE (routine_id, date);


--
-- Name: dog_routines dog_routines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dog_routines
    ADD CONSTRAINT dog_routines_pkey PRIMARY KEY (id);


--
-- Name: dogs dogs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dogs
    ADD CONSTRAINT dogs_pkey PRIMARY KEY (id);


--
-- Name: households households_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.households
    ADD CONSTRAINT households_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: puppy_accidents puppy_accidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puppy_accidents
    ADD CONSTRAINT puppy_accidents_pkey PRIMARY KEY (id);


--
-- Name: push_log push_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_log
    ADD CONSTRAINT push_log_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: task_completions task_completions_completed_by_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.task_completions
    ADD CONSTRAINT task_completions_completed_by_check CHECK (((completed_by IS NULL) OR (completed_by = ANY (ARRAY['g'::text, 's'::text])))) NOT VALID;


--
-- Name: task_completions task_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completions
    ADD CONSTRAINT task_completions_pkey PRIMARY KEY (id);


--
-- Name: task_completions task_completions_task_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completions
    ADD CONSTRAINT task_completions_task_id_date_key UNIQUE (task_id, date);


--
-- Name: tasks tasks_assigned_to_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_assigned_to_check CHECK (((assigned_to IS NULL) OR (assigned_to = ANY (ARRAY['g'::text, 's'::text])))) NOT VALID;


--
-- Name: tasks tasks_frequency_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text, 'once'::text]))) NOT VALID;


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: weekly_meetings weekly_meetings_household_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_meetings
    ADD CONSTRAINT weekly_meetings_household_id_week_start_key UNIQUE (household_id, week_start);


--
-- Name: weekly_meetings weekly_meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_meetings
    ADD CONSTRAINT weekly_meetings_pkey PRIMARY KEY (id);


--
-- Name: weekly_settings weekly_settings_energy_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.weekly_settings
    ADD CONSTRAINT weekly_settings_energy_check CHECK ((energy = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))) NOT VALID;


--
-- Name: weekly_settings weekly_settings_household_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_settings
    ADD CONSTRAINT weekly_settings_household_id_week_start_key UNIQUE (household_id, week_start);


--
-- Name: weekly_settings weekly_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_settings
    ADD CONSTRAINT weekly_settings_pkey PRIMARY KEY (id);


--
-- Name: xp_history xp_history_earned_by_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.xp_history
    ADD CONSTRAINT xp_history_earned_by_check CHECK (((earned_by IS NULL) OR (earned_by = ANY (ARRAY['g'::text, 's'::text])))) NOT VALID;


--
-- Name: xp_history xp_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_history
    ADD CONSTRAINT xp_history_pkey PRIMARY KEY (id);


--
-- Name: dog_completions_household_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dog_completions_household_date_idx ON public.dog_completions USING btree (household_id, date);


--
-- Name: dog_routines_dog_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dog_routines_dog_idx ON public.dog_routines USING btree (dog_id);


--
-- Name: dog_routines_household_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dog_routines_household_idx ON public.dog_routines USING btree (household_id);


--
-- Name: dogs_household_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dogs_household_idx ON public.dogs USING btree (household_id);


--
-- Name: profiles_household_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_household_idx ON public.profiles USING btree (household_id);


--
-- Name: puppy_accidents_household_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX puppy_accidents_household_idx ON public.puppy_accidents USING btree (household_id, occurred_at DESC);


--
-- Name: push_log_once_per_day; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX push_log_once_per_day ON public.push_log USING btree (subscription_id, kind, day) WHERE (kind <> 'test'::text);


--
-- Name: push_log_subscription_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_log_subscription_idx ON public.push_log USING btree (subscription_id, created_at DESC);


--
-- Name: push_subscriptions_household_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_subscriptions_household_idx ON public.push_subscriptions USING btree (household_id) WHERE active;


--
-- Name: task_completions_household_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_completions_household_date_idx ON public.task_completions USING btree (household_id, date);


--
-- Name: tasks_household_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_household_active_idx ON public.tasks USING btree (household_id) WHERE active;


--
-- Name: xp_history_household_activity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX xp_history_household_activity_idx ON public.xp_history USING btree (household_id, activity_date) WHERE (voided_at IS NULL);


--
-- Name: xp_history_household_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX xp_history_household_idx ON public.xp_history USING btree (household_id);


--
-- Name: xp_history_one_valid_per_reason; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX xp_history_one_valid_per_reason ON public.xp_history USING btree (household_id, reason) WHERE ((reason IS NOT NULL) AND (voided_at IS NULL));


--
-- Name: dog_completions ninho_fill_household; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ninho_fill_household BEFORE INSERT ON public.dog_completions FOR EACH ROW EXECUTE FUNCTION public.ninho_fill_dog_completion_household();


--
-- Name: task_completions ninho_fill_household; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ninho_fill_household BEFORE INSERT ON public.task_completions FOR EACH ROW EXECUTE FUNCTION public.ninho_fill_task_completion_household();


--
-- Name: dog_routines ninho_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ninho_set_updated_at BEFORE UPDATE ON public.dog_routines FOR EACH ROW EXECUTE FUNCTION public.ninho_set_updated_at();


--
-- Name: dogs ninho_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ninho_set_updated_at BEFORE UPDATE ON public.dogs FOR EACH ROW EXECUTE FUNCTION public.ninho_set_updated_at();


--
-- Name: households ninho_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ninho_set_updated_at BEFORE UPDATE ON public.households FOR EACH ROW EXECUTE FUNCTION public.ninho_set_updated_at();


--
-- Name: profiles ninho_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ninho_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.ninho_set_updated_at();


--
-- Name: push_subscriptions ninho_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ninho_set_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.ninho_set_updated_at();


--
-- Name: tasks ninho_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ninho_set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.ninho_set_updated_at();


--
-- Name: weekly_meetings ninho_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ninho_set_updated_at BEFORE UPDATE ON public.weekly_meetings FOR EACH ROW EXECUTE FUNCTION public.ninho_set_updated_at();


--
-- Name: weekly_settings ninho_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ninho_set_updated_at BEFORE UPDATE ON public.weekly_settings FOR EACH ROW EXECUTE FUNCTION public.ninho_set_updated_at();


--
-- Name: dog_completions dog_completions_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dog_completions
    ADD CONSTRAINT dog_completions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE NOT VALID;


--
-- Name: dog_completions dog_completions_routine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dog_completions
    ADD CONSTRAINT dog_completions_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES public.dog_routines(id) ON DELETE CASCADE;


--
-- Name: dog_routines dog_routines_dog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dog_routines
    ADD CONSTRAINT dog_routines_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES public.dogs(id) ON DELETE CASCADE;


--
-- Name: dog_routines dog_routines_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dog_routines
    ADD CONSTRAINT dog_routines_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: dogs dogs_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dogs
    ADD CONSTRAINT dogs_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: puppy_accidents puppy_accidents_dog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puppy_accidents
    ADD CONSTRAINT puppy_accidents_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES public.dogs(id) ON DELETE CASCADE;


--
-- Name: puppy_accidents puppy_accidents_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puppy_accidents
    ADD CONSTRAINT puppy_accidents_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: push_log push_log_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_log
    ADD CONSTRAINT push_log_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.push_subscriptions(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: task_completions task_completions_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completions
    ADD CONSTRAINT task_completions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: task_completions task_completions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completions
    ADD CONSTRAINT task_completions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: weekly_meetings weekly_meetings_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_meetings
    ADD CONSTRAINT weekly_meetings_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: weekly_settings weekly_settings_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_settings
    ADD CONSTRAINT weekly_settings_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: xp_history xp_history_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_history
    ADD CONSTRAINT xp_history_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: dog_completions allow_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_auth ON public.dog_completions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: dog_routines allow_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_auth ON public.dog_routines TO authenticated USING (true) WITH CHECK (true);


--
-- Name: dogs allow_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_auth ON public.dogs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: households allow_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_auth ON public.households TO authenticated USING (true) WITH CHECK (true);


--
-- Name: profiles allow_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_auth ON public.profiles TO authenticated USING (true) WITH CHECK (true);


--
-- Name: puppy_accidents allow_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_auth ON public.puppy_accidents TO authenticated USING (true) WITH CHECK (true);


--
-- Name: push_subscriptions allow_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_auth ON public.push_subscriptions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: task_completions allow_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_auth ON public.task_completions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: tasks allow_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_auth ON public.tasks TO authenticated USING (true) WITH CHECK (true);


--
-- Name: weekly_meetings allow_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_auth ON public.weekly_meetings TO authenticated USING (true) WITH CHECK (true);


--
-- Name: weekly_settings allow_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_auth ON public.weekly_settings TO authenticated USING (true) WITH CHECK (true);


--
-- Name: xp_history allow_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_auth ON public.xp_history TO authenticated USING (true) WITH CHECK (true);


--
-- Name: dog_completions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dog_completions ENABLE ROW LEVEL SECURITY;

--
-- Name: dog_routines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dog_routines ENABLE ROW LEVEL SECURITY;

--
-- Name: dogs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;

--
-- Name: households; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: puppy_accidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.puppy_accidents ENABLE ROW LEVEL SECURITY;

--
-- Name: push_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: task_completions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_meetings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_meetings ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: xp_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.xp_history ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


