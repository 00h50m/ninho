-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 031 · Refeições salvas (Meu dia › Alimentação)
--
-- personal_saved_meals: combinações de alimentos que a pessoa salva com um
--   nome ("Meu café de sempre") para lançar depois com um toque.
--   items = [{name, food_id, qty, unit, g, kcal, p, c, f, text}] (até 30).
-- Mesma privacidade do Meu dia: só a dona grava; a outra só vê se a dona
-- compartilhar "refeicao".
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.personal_saved_meals (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  name         text not null check (length(btrim(name)) between 1 and 60),
  items        jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30 and length(items::text) <= 20000),
  kcal         numeric(6,1) not null check (kcal >= 0 and kcal <= 9000),
  uses         integer not null default 0 check (uses >= 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists personal_saved_meals_who on public.personal_saved_meals (household_id, who) where active;

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.personal_saved_meals enable row level security;
  drop policy if exists "allow_all_auth" on public.personal_saved_meals;
  drop policy if exists "personal_read" on public.personal_saved_meals;
  drop policy if exists "personal_write" on public.personal_saved_meals;
  if strict_rls then
    create policy "personal_read" on public.personal_saved_meals for select to authenticated
      using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, 'refeicao')));
    create policy "personal_write" on public.personal_saved_meals for all to authenticated
      using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
  else
    create policy "allow_all_auth" on public.personal_saved_meals for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.personal_saved_meals to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.personal_saved_meals to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'personal_saved_meals') then
    alter publication supabase_realtime add table public.personal_saved_meals;
  end if;
end $$;

notify pgrst, 'reload schema';
