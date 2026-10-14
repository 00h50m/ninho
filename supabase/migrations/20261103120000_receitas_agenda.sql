-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 035 · Receitas e agenda no celular
--
-- personal_recipes: receitas da pessoa (ingredientes com gramas e kcal, rendimento em
--   porções e modo de preparo). Lança "1 porção" no Meu dia e manda os ingredientes
--   para a lista de compras. Mesma privacidade do Meu dia: só a dona grava; a outra só vê
--   se a dona compartilhar "refeicao".
-- households.ics_token: segredo do link para assinar a agenda da casa no Google Agenda /
--   calendário do iPhone. Gerado e trocado só pelo servidor; vazio = link desligado.
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.personal_recipes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  name         text not null check (length(btrim(name)) between 1 and 60),
  servings     numeric(4,1) not null default 1 check (servings > 0 and servings <= 50),
  items        jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 40 and length(items::text) <= 30000),
  steps        text check (steps is null or length(steps) <= 3000),
  kcal         numeric(7,1) not null check (kcal >= 0 and kcal <= 30000),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists personal_recipes_who on public.personal_recipes (household_id, who) where active;

alter table public.households add column if not exists ics_token text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'households_ics_token_len') then
    alter table public.households add constraint households_ics_token_len check (ics_token is null or length(ics_token) between 32 and 80);
  end if;
end $$;
create unique index if not exists households_ics_token on public.households (ics_token) where ics_token is not null;

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.personal_recipes enable row level security;
  drop policy if exists "allow_all_auth" on public.personal_recipes;
  drop policy if exists "personal_read" on public.personal_recipes;
  drop policy if exists "personal_write" on public.personal_recipes;
  if strict_rls then
    create policy "personal_read" on public.personal_recipes for select to authenticated
      using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, 'refeicao')));
    create policy "personal_write" on public.personal_recipes for all to authenticated
      using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
  else
    create policy "allow_all_auth" on public.personal_recipes for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.personal_recipes to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.personal_recipes to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'personal_recipes') then
    alter publication supabase_realtime add table public.personal_recipes;
  end if;
end $$;

notify pgrst, 'reload schema';
