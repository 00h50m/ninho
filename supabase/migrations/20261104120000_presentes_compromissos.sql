-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 036 · Ideias de presente e compromissos que mexem no dia
--
-- gift_ideas: o que a outra comentou que queria (o quê, observação, link, faixa de preço,
--   para qual data) e o andamento (ideia → comprado → dado).
-- gift_dates: datas especiais (aniversário, namoro, Natal…) com lembrete antes.
-- As duas tabelas são SÓ da dona: a outra pessoa não lê nem com compartilhamento
-- (é surpresa). Por isso a regra é "owner_only", e não a do Meu dia.
--
-- house_events.end_time: até que horas vai o compromisso (sem ela, conta 1 hora).
-- task_handoffs: "passar só hoje" — a tarefa vai para a outra naquele dia, sem mudar a
--   responsável de sempre (quando um compromisso cai no horário de uma tarefa fixa).
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.gift_dates (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  title        text not null check (length(btrim(title)) between 1 and 60),
  month        smallint not null check (month between 1 and 12),
  day          smallint not null check (day between 1 and 31),
  for_who      text check (for_who is null or for_who in ('g','s','both')),
  created_at   timestamptz not null default now(),
  check (day <= case month when 2 then 29 when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30 else 31 end)
);
create index if not exists gift_dates_who on public.gift_dates (household_id, who);

create table if not exists public.gift_ideas (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  for_who      text not null check (for_who in ('g','s')),
  title        text not null check (length(btrim(title)) between 1 and 120),
  note         text check (note is null or length(note) <= 500),
  link         text check (link is null or (length(link) <= 500 and link ~* '^https?://')),
  price        text check (price is null or length(price) <= 40),
  date_id      uuid references public.gift_dates(id) on delete set null,
  status       text not null default 'ideia' check (status in ('ideia','comprado','dado')),
  given_on     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists gift_ideas_who on public.gift_ideas (household_id, who, status);

do $$
declare strict_rls boolean; t text;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  foreach t in array array['gift_dates','gift_ideas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "allow_all_auth" on public.%I', t);
    execute format('drop policy if exists "owner_only" on public.%I', t);
    if strict_rls then
      execute format('create policy "owner_only" on public.%I for all to authenticated using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id))', t);
    else
      execute format('create policy "allow_all_auth" on public.%I for all to authenticated using (true) with check (true)', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('grant select, insert, update, delete on public.%I to authenticated', t); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant all on public.%I to service_role', t); end if;
  end loop;
end $$;

alter table public.house_events add column if not exists end_time text check (end_time is null or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'house_events_end_after_start') then
    alter table public.house_events add constraint house_events_end_after_start check (end_time is null or time is null or end_time > time);
  end if;
end $$;

create table if not exists public.task_handoffs (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  date         date not null,
  to_who       text not null check (to_who in ('g','s')),
  by_who       text check (by_who is null or by_who in ('g','s')),
  created_at   timestamptz not null default now(),
  unique (task_id, date)
);
create index if not exists task_handoffs_household_date on public.task_handoffs (household_id, date desc);

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.task_handoffs enable row level security;
  drop policy if exists "allow_all_auth" on public.task_handoffs;
  drop policy if exists "household_member" on public.task_handoffs;
  if strict_rls then
    create policy "household_member" on public.task_handoffs for all to authenticated
      using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id));
  else
    create policy "allow_all_auth" on public.task_handoffs for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.task_handoffs to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.task_handoffs to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_handoffs') then
    alter publication supabase_realtime add table public.task_handoffs;
  end if;
end $$;

notify pgrst, 'reload schema';
