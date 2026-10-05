-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 015 · Check-in do dia e registro de cada dia
--
-- • daily_checkins: humor e energia de cada uma por dia (texto opcional).
--   Uma linha por pessoa por dia; registrar de novo atualiza.
-- • household_days: o que vale para a casa no dia (por enquanto, se o modo
--   sobrevivência esteve ativo). Usado na visão da semana do Início.
-- • ninho_checkin: grava o check-in de quem está logada (não dá para
--   registrar pela outra).
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.daily_checkins (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null,
  who          text not null check (who in ('g','s')),
  mood         text check (mood is null or mood in ('otimo','bem','normal','cansaco','pesado')),
  energy       text check (energy is null or energy in ('high','medium','low')),
  note         text check (note is null or length(note) <= 280),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, date, who)
);
create index if not exists daily_checkins_recent on public.daily_checkins (household_id, date desc);

create table if not exists public.household_days (
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null,
  survival     boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (household_id, date)
);

-- ── Acesso: só quem é da casa (mesma regra da 011) ───────────────────
do $$
declare t text; strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  foreach t in array array['daily_checkins','household_days'] loop
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

-- ── Check-in de quem está usando ─────────────────────────────────────
-- Campos nulos mantêm o que já foi registrado no dia (dá para mandar só o humor).
create or replace function public.ninho_checkin(
  p_household_id uuid, p_date date, p_who text, p_mood text default null, p_energy text default null, p_note text default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_who text; v_row public.daily_checkins%rowtype;
begin
  if p_date is null or p_date > public.ninho_today() + 1 or p_date < public.ninho_today() - 7 then
    raise exception 'NINHO_INVALID_DATE: check-in só para os últimos 7 dias (recebido: %)', p_date using errcode = '22023';
  end if;
  select m.who into v_who from public.household_members m where m.user_id = auth.uid() and m.household_id = p_household_id;
  v_who := coalesce(v_who, p_who);
  if v_who is null or v_who not in ('g','s') then
    raise exception 'NINHO_INVALID_PERSON: quem registra deve ser g ou s (recebido: %)', p_who using errcode = '22023';
  end if;
  insert into public.daily_checkins (household_id, date, who, mood, energy, note)
  values (p_household_id, p_date, v_who, p_mood, p_energy, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (household_id, date, who) do update set
    mood = coalesce(excluded.mood, daily_checkins.mood),
    energy = coalesce(excluded.energy, daily_checkins.energy),
    note = case when p_note is null then daily_checkins.note else excluded.note end,
    updated_at = now()
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

revoke all on function public.ninho_checkin(uuid, date, text, text, text, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.ninho_checkin(uuid, date, text, text, text, text) from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.ninho_checkin(uuid, date, text, text, text, text) to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.ninho_checkin(uuid, date, text, text, text, text) to service_role; end if;
end $$;

-- ── Tempo real ───────────────────────────────────────────────────────
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    foreach t in array array['daily_checkins','household_days'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
