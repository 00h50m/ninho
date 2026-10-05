-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 014 · Configuração inicial (onboarding) e rotinas com passos
--
-- • household_setup: a configuração da casa (respostas confirmadas no resumo).
-- • onboarding_progress: rascunho de cada pessoa (continuar depois, pular).
-- • routines + routine_steps: rotina = conjunto de passos num momento do dia.
--   É diferente de tarefa (tem começo e fim) e de hábito (fase seguinte).
--   O checklist do dia a dia chega na fase de Rotinas; aqui só o cadastro.
-- • ninho_finish_onboarding: aplica tudo de uma vez, sem duplicar rotinas
--   (uma por modelo por casa) e sem apagar nada.
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.household_setup (
  household_id uuid primary key references public.households(id) on delete cascade,
  answers      jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  completed_by text check (completed_by is null or completed_by in ('g','s')),
  updated_at   timestamptz not null default now()
);

create table if not exists public.onboarding_progress (
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  step         smallint not null default 1 check (step between 1 and 9),
  answers      jsonb not null default '{}'::jsonb,
  skipped_at   timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (household_id, who)
);

create table if not exists public.routines (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  template_key  text check (template_key is null or template_key ~ '^[a-z0-9_]{1,40}$'),
  title         text not null check (length(btrim(title)) between 1 and 60),
  description   text check (description is null or length(description) <= 200),
  category      text not null default 'casa' check (category in ('casa','cozinha','caes','manha','noite','semana','outros')),
  weekdays      smallint[] check (weekdays is null or (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[])),
  scheduled_time text check (scheduled_time is null or scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_min  smallint check (duration_min is null or duration_min between 1 and 240),
  -- quem faz: g ou s (fixa), shared (as duas juntas) ou rotation (rodízio)
  assign_mode   text not null default 'shared' check (assign_mode in ('g','s','shared','rotation')),
  essential     boolean not null default false,
  active        boolean not null default true,
  created_by    text check (created_by is null or created_by in ('g','s')),
  created_at    timestamptz not null default now()
);
-- Um modelo vira no máximo uma rotina por casa (concluir o onboarding duas vezes não duplica)
create unique index if not exists routines_template_once on public.routines (household_id, template_key) where template_key is not null;
create index if not exists routines_household on public.routines (household_id) where active;

create table if not exists public.routine_steps (
  id           uuid primary key default gen_random_uuid(),
  routine_id   uuid not null references public.routines(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  position     smallint not null default 0,
  title        text not null check (length(btrim(title)) between 1 and 80),
  -- entra na versão reduzida do modo sobrevivência
  survival     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists routine_steps_routine on public.routine_steps (routine_id, position);

-- ── Acesso: só quem é da casa (mesma regra da 011) ───────────────────
do $$
declare t text; strict_rls boolean;
begin
  -- A 011 já foi aplicada? (então as tabelas novas nascem com a regra por casa)
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  foreach t in array array['household_setup','onboarding_progress','routines','routine_steps'] loop
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

-- ── Concluir a configuração ──────────────────────────────────────────
-- p_payload:
--   names:      {"g": "Giovanna", "s": "Sabrina"}
--   dogs:       [{"id": uuid|null, "name": "Penélope"}]   (sem id = cão novo)
--   routines:   [{"key","title","category","weekdays","time","duration","assign","essential","steps":[{"title","survival"}]}]
--   essential_task_ids: [uuid]   (tarefas existentes que passam a ser essenciais)
--   answers:    respostas guardadas como configuração da casa
create or replace function public.ninho_finish_onboarding(p_household_id uuid, p_who text, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_who text;
  v_name text;
  v_r jsonb; v_s jsonb; v_d jsonb;
  v_id uuid; v_pos int;
  v_created int := 0; v_existing int := 0; v_ess int := 0; v_dogs int := 0;
begin
  if p_household_id is null or not exists (select 1 from public.households where id = p_household_id) then
    raise exception 'NINHO_NOT_FOUND: casa não encontrada' using errcode = 'P0002';
  end if;
  -- Quem conclui: a conta ligada (login); sem login, o que o aparelho informou
  select m.who into v_who from public.household_members m where m.user_id = auth.uid() and m.household_id = p_household_id;
  v_who := coalesce(v_who, p_who);
  if v_who is null or v_who not in ('g','s') then
    raise exception 'NINHO_INVALID_PERSON: quem configurou deve ser g ou s (recebido: %)', p_who using errcode = '22023';
  end if;

  -- Nomes (só os preenchidos; perfis com o papel certo)
  foreach v_name in array array['g','s'] loop
    if nullif(btrim(coalesce(p_payload->'names'->>v_name, '')), '') is not null then
      update public.profiles set display_name = left(btrim(p_payload->'names'->>v_name), 40)
      where household_id = p_household_id and role = v_name;
    end if;
  end loop;

  -- Cães: renomeia os existentes, cria os novos sem repetir nome
  for v_d in select * from jsonb_array_elements(coalesce(p_payload->'dogs', '[]'::jsonb)) loop
    v_name := left(nullif(btrim(coalesce(v_d->>'name', '')), ''), 40);
    continue when v_name is null;
    if nullif(v_d->>'id', '') is not null then
      update public.dogs set name = v_name where id = (v_d->>'id')::uuid and household_id = p_household_id;
    elsif not exists (select 1 from public.dogs where household_id = p_household_id and active and lower(name) = lower(v_name)) then
      insert into public.dogs (household_id, name, active) values (p_household_id, v_name, true);
      v_dogs := v_dogs + 1;
    end if;
  end loop;

  -- Rotinas: uma por modelo; a que já existe fica como está
  for v_r in select * from jsonb_array_elements(coalesce(p_payload->'routines', '[]'::jsonb)) loop
    v_id := null;
    insert into public.routines (household_id, template_key, title, description, category, weekdays, scheduled_time, duration_min, assign_mode, essential, created_by)
    values (
      p_household_id,
      nullif(v_r->>'key', ''),
      btrim(v_r->>'title'),
      nullif(btrim(coalesce(v_r->>'description', '')), ''),
      coalesce(nullif(v_r->>'category', ''), 'casa'),
      case when jsonb_typeof(v_r->'weekdays') = 'array' and jsonb_array_length(v_r->'weekdays') between 1 and 6
           then array(select (x)::smallint from jsonb_array_elements_text(v_r->'weekdays') x order by 1) end,
      nullif(v_r->>'time', ''),
      nullif(v_r->>'duration', '')::smallint,
      coalesce(nullif(v_r->>'assign', ''), 'shared'),
      coalesce((v_r->>'essential')::boolean, false),
      v_who)
    on conflict (household_id, template_key) where template_key is not null do nothing
    returning id into v_id;
    if v_id is null then v_existing := v_existing + 1; continue; end if;
    v_created := v_created + 1;
    v_pos := 0;
    for v_s in select * from jsonb_array_elements(coalesce(v_r->'steps', '[]'::jsonb)) loop
      continue when nullif(btrim(coalesce(v_s->>'title', '')), '') is null;
      insert into public.routine_steps (routine_id, household_id, position, title, survival)
      values (v_id, p_household_id, v_pos, left(btrim(v_s->>'title'), 80), coalesce((v_s->>'survival')::boolean, false));
      v_pos := v_pos + 1;
    end loop;
  end loop;

  -- Essenciais escolhidas entre as tarefas que já existem (só desta casa)
  update public.tasks set essential = true
  where household_id = p_household_id and not essential
    and id in (select (x)::uuid from jsonb_array_elements_text(coalesce(p_payload->'essential_task_ids', '[]'::jsonb)) x);
  get diagnostics v_ess = row_count;

  insert into public.household_setup (household_id, answers, completed_at, completed_by, updated_at)
  values (p_household_id, coalesce(p_payload->'answers', '{}'::jsonb), now(), v_who, now())
  on conflict (household_id) do update set answers = excluded.answers, completed_at = now(), completed_by = v_who, updated_at = now();

  update public.onboarding_progress set step = 9, skipped_at = null, updated_at = now()
  where household_id = p_household_id and who = v_who;

  return jsonb_build_object('routines_created', v_created, 'routines_existing', v_existing, 'essentials_marked', v_ess, 'dogs_created', v_dogs);
end $$;

revoke all on function public.ninho_finish_onboarding(uuid, text, jsonb) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.ninho_finish_onboarding(uuid, text, jsonb) from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.ninho_finish_onboarding(uuid, text, jsonb) to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.ninho_finish_onboarding(uuid, text, jsonb) to service_role; end if;
end $$;

-- ── Tempo real: a outra pessoa vê a configuração e as rotinas novas ──
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    foreach t in array array['household_setup','routines','routine_steps'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
