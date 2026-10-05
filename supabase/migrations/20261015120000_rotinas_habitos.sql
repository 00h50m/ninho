-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 016 · Rotinas com checklist e hábitos
--
-- Três conceitos com comportamentos diferentes:
-- • Tarefa (tasks): tem começo e fim, pode atrasar. (já existia)
-- • Rotina (routines): passos num momento do dia. Gera UMA ocorrência por dia
--   (routine_runs); cada passo marcado guarda quem fez (routine_step_checks).
--   Conclusão parcial é permitida; no modo sobrevivência valem só os passos 🛡.
-- • Hábito (habits): comportamento para ganhar constância. Tem meta de
--   frequência; dia não feito fica só sem registro — NUNCA vira atraso.
--   Pausar e abandonar não apagam o histórico (ninho_habit_logs).
--
-- As tabelas de hábito usam o prefixo ninho_ porque o projeto do Supabase já tem
-- uma tabela "habits" de outro app, que não é tocada.
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

-- ── Rotinas: campos do construtor ────────────────────────────────────
alter table public.routines add column if not exists start_date date;
alter table public.routines add column if not exists paused_until date;
-- Lembrete futuro: minutos antes do horário (guardado agora, usado quando houver notificação de rotina)
alter table public.routines add column if not exists reminder_min smallint;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'routines_reminder_min_check') then
    alter table public.routines add constraint routines_reminder_min_check check (reminder_min is null or reminder_min between 0 and 240);
  end if;
end $$;

-- Passo removido no construtor fica arquivado (o histórico das marcas continua)
alter table public.routine_steps add column if not exists active boolean not null default true;

-- Uma ocorrência por rotina por dia
create table if not exists public.routine_runs (
  id           uuid primary key default gen_random_uuid(),
  routine_id   uuid not null references public.routines(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null,
  status       text not null default 'open' check (status in ('open','done')),
  survival     boolean not null default false,
  completed_at timestamptz,
  completed_by text check (completed_by is null or completed_by in ('g','s')),
  created_at   timestamptz not null default now(),
  unique (routine_id, date)
);
create index if not exists routine_runs_recent on public.routine_runs (household_id, date desc);

-- Passo marcado numa ocorrência (desfazer = apagar a marca; a ocorrência fica)
create table if not exists public.routine_step_checks (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.routine_runs(id) on delete cascade,
  step_id      uuid not null references public.routine_steps(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  done_by      text check (done_by is null or done_by in ('g','s')),
  done_at      timestamptz not null default now(),
  unique (run_id, step_id)
);
create index if not exists routine_step_checks_run on public.routine_step_checks (run_id);

-- ── Hábitos ──────────────────────────────────────────────────────────
create table if not exists public.ninho_habits (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  title         text not null check (length(btrim(title)) between 1 and 60),
  description   text check (description is null or length(description) <= 200),
  -- de quem é: g, s ou shared (as duas; vale o registro de qualquer uma)
  owner         text not null default 'shared' check (owner in ('g','s','shared')),
  -- dias certos (0 = domingo … 6 = sábado) OU só meta semanal (weekdays nulo)
  weekdays      smallint[] check (weekdays is null or (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[])),
  weekly_target smallint not null default 7 check (weekly_target between 1 and 7),
  paused_until  date,
  archived_at   timestamptz,
  created_by    text check (created_by is null or created_by in ('g','s')),
  created_at    timestamptz not null default now()
);
create index if not exists ninho_habits_household on public.ninho_habits (household_id) where archived_at is null;

create table if not exists public.ninho_habit_logs (
  id           uuid primary key default gen_random_uuid(),
  habit_id     uuid not null references public.ninho_habits(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null,
  who          text check (who is null or who in ('g','s')),
  created_at   timestamptz not null default now(),
  unique (habit_id, date)
);
create index if not exists ninho_habit_logs_recent on public.ninho_habit_logs (household_id, date desc);

-- ── Acesso: só quem é da casa (mesma regra da 011) ───────────────────
do $$
declare t text; strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  foreach t in array array['routine_runs','routine_step_checks','ninho_habits','ninho_habit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    if strict_rls then
      execute format('drop policy if exists "allow_all_auth" on public.%I', t);
      execute format('drop policy if exists "household_member" on public.%I', t);
      execute format('create policy "household_member" on public.%I for all to authenticated using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id))', t);
    elsif not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      execute format('create policy "allow_all_auth" on public.%I for all to authenticated using (true) with check (true)', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant all on public.%I to service_role', t);
    end if;
  end loop;
end $$;

-- ── Funções do checklist ─────────────────────────────────────────────
-- Quem faz: a conta logada; sem login, o que o aparelho informou.
create or replace function public.ninho_actor(p_household_id uuid, p_who text)
returns text language plpgsql stable security invoker set search_path = public as $$
declare v text;
begin
  select m.who into v from public.household_members m where m.user_id = auth.uid() and m.household_id = p_household_id;
  v := coalesce(v, p_who);
  if v is null or v not in ('g','s') then
    raise exception 'NINHO_INVALID_PERSON: quem fez deve ser g ou s (recebido: %)', p_who using errcode = '22023';
  end if;
  return v;
end $$;

-- Recalcula o estado da ocorrência: concluída quando todos os passos que valem estão marcados.
-- No modo sobrevivência valem só os passos 🛡 (se a rotina tiver algum).
create or replace function public.ninho_routine_refresh(p_run_id uuid, p_who text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_run public.routine_runs%rowtype; v_need int; v_have int; v_surv_steps int;
begin
  select * into v_run from public.routine_runs where id = p_run_id for update;
  select count(*) filter (where survival) into v_surv_steps from public.routine_steps where routine_id = v_run.routine_id and active;
  select count(*) into v_need from public.routine_steps s
    where s.routine_id = v_run.routine_id and s.active and (not v_run.survival or v_surv_steps = 0 or s.survival);
  select count(*) into v_have from public.routine_step_checks c join public.routine_steps s on s.id = c.step_id
    where c.run_id = p_run_id and s.active and (not v_run.survival or v_surv_steps = 0 or s.survival);
  if v_need > 0 and v_have >= v_need then
    if v_run.status <> 'done' then
      update public.routine_runs set status = 'done', completed_at = now(), completed_by = p_who where id = p_run_id;
    end if;
  elsif v_run.status = 'done' then
    update public.routine_runs set status = 'open', completed_at = null, completed_by = null where id = p_run_id;
  end if;
  return (select jsonb_build_object('run_id', r.id, 'status', r.status, 'completed_by', r.completed_by, 'need', v_need, 'have', v_have)
          from public.routine_runs r where r.id = p_run_id);
end $$;

-- Marca ou desmarca um passo (cria a ocorrência do dia se preciso)
create or replace function public.ninho_routine_step(
  p_routine_id uuid, p_step_id uuid, p_date date, p_who text, p_done boolean, p_survival boolean default false)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_hh uuid; v_who text; v_run uuid;
begin
  select household_id into v_hh from public.routines where id = p_routine_id;
  if v_hh is null then raise exception 'NINHO_NOT_FOUND: rotina não encontrada' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.routine_steps where id = p_step_id and routine_id = p_routine_id and active) then
    raise exception 'NINHO_NOT_FOUND: passo não é desta rotina' using errcode = 'P0002';
  end if;
  if p_date is null or p_date > public.ninho_today() + 1 or p_date < public.ninho_today() - 7 then
    raise exception 'NINHO_INVALID_DATE: data fora dos últimos 7 dias (recebido: %)', p_date using errcode = '22023';
  end if;
  v_who := public.ninho_actor(v_hh, p_who);
  insert into public.routine_runs (routine_id, household_id, date, survival)
  values (p_routine_id, v_hh, p_date, coalesce(p_survival, false))
  on conflict (routine_id, date) do update set survival = excluded.survival
  returning id into v_run;
  if p_done then
    insert into public.routine_step_checks (run_id, step_id, household_id, done_by)
    values (v_run, p_step_id, v_hh, v_who) on conflict (run_id, step_id) do nothing;
  else
    delete from public.routine_step_checks where run_id = v_run and step_id = p_step_id;
  end if;
  return public.ninho_routine_refresh(v_run, v_who);
end $$;

-- Concluir a rotina inteira (marca os passos que valem) ou reabrir (mantém as marcas)
create or replace function public.ninho_routine_finish(
  p_routine_id uuid, p_date date, p_who text, p_done boolean, p_survival boolean default false)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_hh uuid; v_who text; v_run uuid; v_surv_steps int;
begin
  select household_id into v_hh from public.routines where id = p_routine_id;
  if v_hh is null then raise exception 'NINHO_NOT_FOUND: rotina não encontrada' using errcode = 'P0002'; end if;
  if p_date is null or p_date > public.ninho_today() + 1 or p_date < public.ninho_today() - 7 then
    raise exception 'NINHO_INVALID_DATE: data fora dos últimos 7 dias (recebido: %)', p_date using errcode = '22023';
  end if;
  v_who := public.ninho_actor(v_hh, p_who);
  insert into public.routine_runs (routine_id, household_id, date, survival)
  values (p_routine_id, v_hh, p_date, coalesce(p_survival, false))
  on conflict (routine_id, date) do update set survival = excluded.survival
  returning id into v_run;
  if p_done then
    select count(*) filter (where survival) into v_surv_steps from public.routine_steps where routine_id = p_routine_id and active;
    insert into public.routine_step_checks (run_id, step_id, household_id, done_by)
    select v_run, s.id, v_hh, v_who from public.routine_steps s
    where s.routine_id = p_routine_id and s.active and (not coalesce(p_survival, false) or v_surv_steps = 0 or s.survival)
    on conflict (run_id, step_id) do nothing;
    -- rotina sem passos: conclui direto
    if not exists (select 1 from public.routine_steps where routine_id = p_routine_id and active) then
      update public.routine_runs set status = 'done', completed_at = now(), completed_by = v_who where id = v_run and status <> 'done';
      return (select jsonb_build_object('run_id', id, 'status', status, 'completed_by', completed_by, 'need', 0, 'have', 0) from public.routine_runs where id = v_run);
    end if;
    return public.ninho_routine_refresh(v_run, v_who);
  else
    update public.routine_runs set status = 'open', completed_at = null, completed_by = null where id = v_run;
    return (select jsonb_build_object('run_id', id, 'status', status, 'completed_by', null) from public.routine_runs where id = v_run);
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.ninho_actor(uuid, text)', 'public.ninho_routine_refresh(uuid, text)',
                           'public.ninho_routine_step(uuid, uuid, date, text, boolean, boolean)', 'public.ninho_routine_finish(uuid, date, text, boolean, boolean)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', f); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('grant execute on function %s to authenticated', f); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end $$;

-- ── Tempo real ───────────────────────────────────────────────────────
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    foreach t in array array['routine_runs','routine_step_checks','ninho_habits','ninho_habit_logs'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
