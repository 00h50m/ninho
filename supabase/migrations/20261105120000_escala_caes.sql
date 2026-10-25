-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 037 · Escala fixa dos cães
--
-- households.dog_mode: 'rodizio' (como sempre: as rotinas dos cães alternam sozinhas)
--   ou 'escala' (cada dia e período tem dona fixa).
-- dog_schedule: a escala — dia da semana (0 = domingo … 6 = sábado) × período
--   (manhã até 11h59, tarde até 17h59, noite a partir das 18h) → quem cuida.
--   Período sem linha = continua no rodízio. As duas da casa veem e editam.
--
-- Não destrutiva. Pode ser executada mais de uma vez. Sem a migration: tudo no rodízio.
-- ══════════════════════════════════════════════════════════════════════

alter table public.households add column if not exists dog_mode text not null default 'rodizio';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'households_dog_mode_check') then
    alter table public.households add constraint households_dog_mode_check check (dog_mode in ('rodizio','escala'));
  end if;
end $$;

create table if not exists public.dog_schedule (
  household_id uuid not null references public.households(id) on delete cascade,
  dow          smallint not null check (dow between 0 and 6),
  period       text not null check (period in ('manha','tarde','noite')),
  who          text not null check (who in ('g','s')),
  updated_at   timestamptz not null default now(),
  primary key (household_id, dow, period)
);

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.dog_schedule enable row level security;
  drop policy if exists "allow_all_auth" on public.dog_schedule;
  drop policy if exists "household_member" on public.dog_schedule;
  if strict_rls then
    create policy "household_member" on public.dog_schedule for all to authenticated
      using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id));
  else
    create policy "allow_all_auth" on public.dog_schedule for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.dog_schedule to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.dog_schedule to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dog_schedule') then
    alter publication supabase_realtime add table public.dog_schedule;
  end if;
end $$;

notify pgrst, 'reload schema';
