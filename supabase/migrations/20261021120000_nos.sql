-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 022 · Nós (a área do casal)
--
-- • Registro do dia: no check-in, cada uma pode escrever "o que foi bom",
--   "do que precisei" e "agradeço" (curtos). ninho_day_note grava sempre em
--   nome da pessoa logada.
-- • Reunião semanal: combinados (lista) que podem virar tarefa.
-- • Desafios em dupla: metas das duas juntas (sem placar, sem vencedora).
--   O progresso vem do que já existe (rotina concluída, hábito, check-in das
--   duas, tarefas do dia, sprint) ou de marcação manual (desafio livre).
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

-- ── Registro do dia ──────────────────────────────────────────────────
alter table public.daily_checkins add column if not exists good text;
alter table public.daily_checkins add column if not exists need text;
alter table public.daily_checkins add column if not exists thanks text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_checkins_notes_check') then
    alter table public.daily_checkins add constraint daily_checkins_notes_check check (
      (good is null or length(good) <= 280) and (need is null or length(need) <= 280) and (thanks is null or length(thanks) <= 280));
  end if;
end $$;

create or replace function public.ninho_day_note(
  p_household_id uuid, p_date date, p_who text, p_good text default null, p_need text default null, p_thanks text default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_who text; v_row public.daily_checkins%rowtype;
begin
  if p_date is null or p_date > public.ninho_today() + 1 or p_date < public.ninho_today() - 7 then
    raise exception 'NINHO_INVALID_DATE: registro só para os últimos 7 dias (recebido: %)', p_date using errcode = '22023';
  end if;
  select m.who into v_who from public.household_members m where m.user_id = auth.uid() and m.household_id = p_household_id;
  v_who := coalesce(v_who, p_who);
  if v_who is null or v_who not in ('g','s') then
    raise exception 'NINHO_INVALID_PERSON: quem registra deve ser g ou s (recebido: %)', p_who using errcode = '22023';
  end if;
  insert into public.daily_checkins (household_id, date, who, good, need, thanks)
  values (p_household_id, p_date, v_who, nullif(btrim(coalesce(p_good, '')), ''), nullif(btrim(coalesce(p_need, '')), ''), nullif(btrim(coalesce(p_thanks, '')), ''))
  on conflict (household_id, date, who) do update set
    good = excluded.good, need = excluded.need, thanks = excluded.thanks, updated_at = now()
  returning * into v_row;
  return to_jsonb(v_row);
end $$;
revoke all on function public.ninho_day_note(uuid, date, text, text, text, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.ninho_day_note(uuid, date, text, text, text, text) from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.ninho_day_note(uuid, date, text, text, text, text) to authenticated; end if;
end $$;

-- ── Combinados da reunião ────────────────────────────────────────────
-- [{ "text": "...", "who": "g|s|both", "task_id": "uuid|null", "done": false }]
alter table public.weekly_meetings add column if not exists agreements jsonb not null default '[]'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'weekly_meetings_agreements_check') then
    alter table public.weekly_meetings add constraint weekly_meetings_agreements_check check (
      jsonb_typeof(agreements) = 'array' and jsonb_array_length(agreements) <= 20 and length(agreements::text) <= 6000);
  end if;
end $$;

-- ── Desafios em dupla ────────────────────────────────────────────────
create table if not exists public.couple_challenges (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null check (length(btrim(title)) between 1 and 60),
  -- de onde vem o progresso
  kind         text not null default 'livre' check (kind in ('livre','rotina','habito','checkin','tarefas','sprint')),
  ref_id       uuid,                 -- rotina ou hábito ligado
  per_day      smallint not null default 1 check (per_day between 1 and 20),  -- tarefas: quantas no dia
  days         smallint not null check (days between 1 and 60),
  goal         smallint not null check (goal between 1 and 60),
  start_date   date not null default public.ninho_today(),
  status       text not null default 'active' check (status in ('active','done','missed','cancelled')),
  reward       text check (reward is null or length(reward) <= 80),
  created_by   text check (created_by is null or created_by in ('g','s')),
  created_at   timestamptz not null default now(),
  ended_at     timestamptz,
  check (goal <= days)
);
create index if not exists couple_challenges_recent on public.couple_challenges (household_id, start_date desc);

-- Marcação manual do desafio livre (um dia vale quando uma das duas marca)
create table if not exists public.challenge_marks (
  challenge_id uuid not null references public.couple_challenges(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null,
  who          text check (who is null or who in ('g','s')),
  created_at   timestamptz not null default now(),
  primary key (challenge_id, date)
);

do $$
declare strict_rls boolean; t text;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  foreach t in array array['couple_challenges','challenge_marks'] loop
    execute format('alter table public.%I enable row level security', t);
    if strict_rls then
      execute format('drop policy if exists "allow_all_auth" on public.%I', t);
      execute format('drop policy if exists "household_member" on public.%I', t);
      execute format('create policy "household_member" on public.%I for all to authenticated using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id))', t);
    elsif not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      execute format('create policy "allow_all_auth" on public.%I for all to authenticated using (true) with check (true)', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('grant select, insert, update, delete on public.%I to authenticated', t); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant all on public.%I to service_role', t); end if;
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- A API do Supabase passa a enxergar as tabelas novas na hora
notify pgrst, 'reload schema';
