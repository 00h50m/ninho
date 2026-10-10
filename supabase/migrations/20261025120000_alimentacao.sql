-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 026 · Alimentação (Meu dia)
--
-- personal_food_profile: dados para a estimativa de gasto (Mifflin-St Jeor),
--   objetivo, ritmo e a opção de esconder os números.
-- personal_foods: alimentos próprios de cada pessoa (rótulo, receita da casa).
-- Refeições viram registros em personal_logs com kind = 'refeicao'
--   (value = kcal; data = {meal, text, items:[{name,g,kcal,p,c,f}]}).
-- Mesma privacidade do Meu dia: só a dona grava; a outra só vê se a dona
-- compartilhar "refeicao".
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.personal_food_profile (
  household_id  uuid not null references public.households(id) on delete cascade,
  who           text not null check (who in ('g','s')),
  sex           text not null check (sex in ('f','m')),
  birth_year    integer not null check (birth_year between 1920 and 2015),
  height_cm     numeric(4,1) not null check (height_cm between 120 and 230),
  activity      text not null default 'leve' check (activity in ('sedentario','leve','moderado','alto','muito_alto')),
  goal          text not null default 'manter' check (goal in ('perder','manter','ganhar')),
  pace_kg_week  numeric(3,2) not null default 0.5 check (pace_kg_week between 0 and 1),
  target_kg     numeric(5,1) check (target_kg is null or target_kg between 30 and 300),
  kcal_override integer check (kcal_override is null or kcal_override between 1000 and 5000),
  hide_numbers  boolean not null default false,
  updated_at    timestamptz not null default now(),
  primary key (household_id, who)
);

create table if not exists public.personal_foods (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  name         text not null check (length(btrim(name)) between 1 and 60),
  portion      text not null default '1 porção' check (length(portion) between 1 and 30),
  portion_g    numeric(6,1) not null check (portion_g > 0 and portion_g <= 2000),
  kcal         numeric(6,1) not null check (kcal >= 0 and kcal <= 3000),
  protein      numeric(5,1) check (protein is null or protein between 0 and 500),
  carb         numeric(5,1) check (carb is null or carb between 0 and 500),
  fat          numeric(5,1) check (fat is null or fat between 0 and 500),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists personal_foods_who on public.personal_foods (household_id, who) where active;

-- personal_logs aceita o tipo 'refeicao'. Troca só a regra; nenhum dado muda.
do $$
declare c text;
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.personal_logs'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%kind%' and pg_get_constraintdef(oid) like '%''refeicao''%') then return; end if;
  for c in select conname from pg_constraint
           where conrelid = 'public.personal_logs'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%kind%' and pg_get_constraintdef(oid) like '%agua%'
             and conname <> 'personal_logs_kind_check3' loop
    execute format('alter table public.personal_logs drop constraint %I', c);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'personal_logs_kind_check3') then
    alter table public.personal_logs add constraint personal_logs_kind_check3
      check (kind in ('agua','sono','autocuidado','remedio','treino','corpo','parar','refeicao'));
  end if;
end $$;

do $$
declare strict_rls boolean; t text;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  foreach t in array array['personal_food_profile','personal_foods'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "allow_all_auth" on public.%I', t);
    execute format('drop policy if exists "personal_read" on public.%I', t);
    execute format('drop policy if exists "personal_write" on public.%I', t);
    if strict_rls then
      execute format('create policy "personal_read" on public.%I for select to authenticated using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, %L)))', t, 'refeicao');
      execute format('create policy "personal_write" on public.%I for all to authenticated using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id))', t);
    else
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

notify pgrst, 'reload schema';
