-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 033 · Cardápio da semana e meta de proteína (Meu dia › Alimentação)
--
-- personal_menus: o cardápio da semana montado pela IA com o plano e os
--   alimentos da pessoa. menu = {days:[{date, meals:[{meal, name, items}]}], note}.
--   Fica só o último de cada pessoa ativo (o anterior vira inativo).
-- personal_food_profile.protein_g_kg: meta de proteína em g por kg
--   (opcional; vazio = o app sugere pelo objetivo).
-- Mesma privacidade do Meu dia: só a dona grava; a outra só vê se a dona
-- compartilhar "refeicao".
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.personal_menus (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  week_start   date not null,
  menu         jsonb not null check (jsonb_typeof(menu) = 'object' and length(menu::text) <= 120000),
  prefs        text check (prefs is null or length(prefs) <= 300),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists personal_menus_who on public.personal_menus (household_id, who) where active;

alter table public.personal_food_profile add column if not exists protein_g_kg numeric(3,1);
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.personal_food_profile'::regclass and conname = 'personal_food_profile_protein_g_kg') then
    alter table public.personal_food_profile add constraint personal_food_profile_protein_g_kg check (protein_g_kg is null or protein_g_kg between 0.5 and 3.0);
  end if;
end $$;

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.personal_menus enable row level security;
  drop policy if exists "allow_all_auth" on public.personal_menus;
  drop policy if exists "personal_read" on public.personal_menus;
  drop policy if exists "personal_write" on public.personal_menus;
  if strict_rls then
    create policy "personal_read" on public.personal_menus for select to authenticated
      using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, 'refeicao')));
    create policy "personal_write" on public.personal_menus for all to authenticated
      using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
  else
    create policy "allow_all_auth" on public.personal_menus for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.personal_menus to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.personal_menus to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'personal_menus') then
    alter publication supabase_realtime add table public.personal_menus;
  end if;
end $$;

notify pgrst, 'reload schema';
