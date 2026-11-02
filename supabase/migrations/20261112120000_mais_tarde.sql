-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 044 · "Mais tarde"
--
-- task_later: a tarefa continua na lista de hoje, mas com outro horário só neste dia
--   ("⏰ Mais tarde": +1 h, +2 h ou à noite). O lembrete e o aviso de atrasada passam a
--   usar esse horário. Amanhã a tarefa volta ao horário de sempre (ou a nenhum).
--
-- Não destrutiva: só cria a tabela. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.task_later (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  date         date not null,
  at           time not null,
  by_who       text check (by_who is null or by_who in ('g','s')),
  created_at   timestamptz not null default now(),
  unique (task_id, date)
);
comment on table public.task_later is 'Mais tarde: horário só deste dia para a tarefa (a tarefa continua na lista).';
create index if not exists task_later_household_date on public.task_later (household_id, date desc);

do $$
declare strict_rls boolean;
begin
  -- como a 042: regra por casa sempre que a função de membro existe (011 em diante)
  strict_rls := to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.task_later enable row level security;
  drop policy if exists "allow_all_auth" on public.task_later;
  drop policy if exists "household_member" on public.task_later;
  if strict_rls then
    create policy "household_member" on public.task_later for all to authenticated
      using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id));
  else
    create policy "allow_all_auth" on public.task_later for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.task_later to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.task_later to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_later') then
    alter publication supabase_realtime add table public.task_later;
  end if;
end $$;

notify pgrst, 'reload schema';
