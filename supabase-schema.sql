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
  v_out      jsonb := '[]'::jsonb;
  v_row      public.dog_completions%rowtype;
begin
  perform public.ninho_check_completion_input(p_date, p_by, true);
  v_ids := array(select distinct unnest(coalesce(p_routine_ids, '{}')));

  for v_r in
    select r.id, coalesce(r.household_id, d.household_id) as household_id
    from public.dog_routines r left join public.dogs d on d.id = r.dog_id
    where r.id = any (v_ids)
    order by r.id
  loop
    v_found := v_found + 1;

    insert into public.dog_completions (routine_id, household_id, date, completed_by)
    values (v_r.id, v_r.household_id, p_date, p_by)
    on conflict (routine_id, date) do nothing;
    if found then v_created := v_created + 1; end if;

    insert into public.xp_history (household_id, amount, reason)
    values (v_r.household_id, 1, public.ninho_xp_reason('dog', v_r.id, p_date))
    on conflict (household_id, reason) where reason is not null and voided_at is null do nothing;
    if found then v_xp := v_xp + 1; end if;

    select * into v_row from public.dog_completions where routine_id = v_r.id and date = p_date;
    v_out := v_out || jsonb_build_object('routine_id', v_r.id, 'completion_id', v_row.id, 'completed_by', v_row.completed_by);
  end loop;

  if v_found <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'NINHO_NOT_FOUND: % de % rotinas não encontradas', coalesce(array_length(v_ids, 1), 0) - v_found, coalesce(array_length(v_ids, 1), 0)
      using errcode = 'P0002';
  end if;

  return jsonb_build_object('date', p_date, 'routines', v_found, 'created', v_created, 'xp_added', v_xp, 'completions', v_out);
end $$;


--
-- Name: ninho_complete_task(uuid, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ninho_complete_task(p_task_id uuid, p_date date, p_by text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_household uuid;
  v_weight    text;
  v_xp        integer;
  v_created   boolean;
  v_row       public.task_completions%rowtype;
begin
  perform public.ninho_check_completion_input(p_date, p_by, true);

  select household_id, weight into v_household, v_weight from public.tasks where id = p_task_id;
  if not found then
    raise exception 'NINHO_NOT_FOUND: tarefa % não encontrada', p_task_id using errcode = 'P0002';
  end if;

  insert into public.task_completions (task_id, household_id, date, completed_by)
  values (p_task_id, v_household, p_date, p_by)
  on conflict (task_id, date) do nothing;
  v_created := found;

  select * into v_row from public.task_completions where task_id = p_task_id and date = p_date;

  v_xp := public.ninho_xp_for_weight(v_weight);
  insert into public.xp_history (household_id, amount, reason)
  values (v_household, v_xp, public.ninho_xp_reason('task', p_task_id, p_date))
  on conflict (household_id, reason) where reason is not null and voided_at is null do nothing;

  return jsonb_build_object('task_id', p_task_id, 'date', p_date, 'created', v_created,
                            'completed_by', v_row.completed_by, 'completion_id', v_row.id, 'xp', v_xp);
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
    updated_at timestamp with time zone DEFAULT now()
);


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
    void_reason text
);


--
-- Name: COLUMN xp_history.voided_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.xp_history.voided_at IS 'Preenchido quando o lançamento foi anulado (ex.: duplicado encontrado na migração 002). Lançamentos anulados não contam no XP.';


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
-- Name: task_completions_household_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_completions_household_date_idx ON public.task_completions USING btree (household_id, date);


--
-- Name: tasks_household_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_household_active_idx ON public.tasks USING btree (household_id) WHERE active;


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


