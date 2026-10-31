-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 042 · Pular uma rotina dos cães ("não deu")
--
-- dog_skips: a rotina dos cães (ex.: "Passeio manhã") que não deu para fazer
--   naquele dia sai da lista de hoje, sem XP. Um registro por rotina por dia;
--   apagar o registro devolve a rotina para a lista.
-- Segurança: só quem é da casa lê e grava (mesma regra das outras tabelas).
--
-- Não destrutiva: só cria uma tabela nova. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.dog_skips (
  id           uuid primary key default uuid_generate_v4(),
  routine_id   uuid not null references public.dog_routines(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null default public.ninho_today(),
  skipped_by   text check (skipped_by is null or skipped_by in ('g','s')),
  created_at   timestamptz not null default now(),
  unique (routine_id, date)
);
comment on table public.dog_skips is 'Rotina dos cães pulada no dia ("não deu"): sai da lista de hoje, sem XP.';
create index if not exists dog_skips_household_date_idx on public.dog_skips (household_id, date desc);

alter table public.dog_skips enable row level security;
drop policy if exists "household_member" on public.dog_skips;
create policy "household_member" on public.dog_skips for all to authenticated
  using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id));

-- Realtime: a outra vê na hora
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dog_skips') then
    alter publication supabase_realtime add table public.dog_skips;
  end if;
end $$;

notify pgrst, 'reload schema';
