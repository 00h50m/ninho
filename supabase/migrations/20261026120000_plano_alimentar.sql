-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 027 · Plano alimentar (Meu dia › Alimentação)
--
-- personal_diet_plans: o plano da nutricionista já organizado (refeições,
--   opções, regras, suplementos, água), lido pela IA a partir do PDF ou da
--   foto. O ARQUIVO não fica guardado: só o plano organizado, que a pessoa
--   confere antes de salvar. Um plano ativo por pessoa.
-- Mesma privacidade do Meu dia: só a dona grava; a outra só vê se a dona
-- compartilhar "refeicao".
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.personal_diet_plans (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  title        text not null check (length(btrim(title)) between 1 and 80),
  plan         jsonb not null check (jsonb_typeof(plan) = 'object' and coalesce(jsonb_typeof(plan -> 'meals'), '') = 'array' and length(plan::text) <= 60000),
  source       text check (source is null or length(source) <= 120),
  remind       boolean not null default false,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create unique index if not exists personal_diet_plans_one_active on public.personal_diet_plans (household_id, who) where active;

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.personal_diet_plans enable row level security;
  drop policy if exists "allow_all_auth" on public.personal_diet_plans;
  drop policy if exists "personal_read" on public.personal_diet_plans;
  drop policy if exists "personal_write" on public.personal_diet_plans;
  if strict_rls then
    create policy "personal_read" on public.personal_diet_plans for select to authenticated
      using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, 'refeicao')));
    create policy "personal_write" on public.personal_diet_plans for all to authenticated
      using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
  else
    create policy "allow_all_auth" on public.personal_diet_plans for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.personal_diet_plans to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.personal_diet_plans to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'personal_diet_plans') then
    alter publication supabase_realtime add table public.personal_diet_plans;
  end if;
end $$;

notify pgrst, 'reload schema';
