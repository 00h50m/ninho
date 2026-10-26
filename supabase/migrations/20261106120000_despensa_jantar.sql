-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 038 · Despensa com validade e jantar das duas
--
-- pantry_items: o que tem em casa (onde fica, quantidade, validade). Acabou → vai para a
--   lista de compras. Da casa: as duas veem e editam.
-- house_meals: o cardápio da casa (jantar de cada dia), quem cozinha e os ingredientes
--   (uma cópia, para a outra ver mesmo que a receita seja privada). Um por dia e refeição.
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.pantry_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 80),
  place        text not null default 'despensa' check (place in ('despensa','geladeira','freezer','banheiro','limpeza','outros')),
  qty          text check (qty is null or length(qty) <= 30),
  expires_on   date,
  active       boolean not null default true,
  created_by   text check (created_by is null or created_by in ('g','s')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists pantry_items_household on public.pantry_items (household_id, expires_on) where active;

create table if not exists public.house_meals (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null,
  meal         text not null default 'jantar' check (meal in ('almoco','jantar')),
  title        text not null check (length(btrim(title)) between 1 and 80),
  cook         text check (cook is null or cook in ('g','s','both')),
  recipe_id    uuid,
  ingredients  jsonb not null default '[]' check (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) <= 40 and length(ingredients::text) <= 8000),
  notes        text check (notes is null or length(notes) <= 300),
  created_by   text check (created_by is null or created_by in ('g','s')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, date, meal)
);

do $$
declare strict_rls boolean; t text;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  foreach t in array array['pantry_items','house_meals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "allow_all_auth" on public.%I', t);
    execute format('drop policy if exists "household_member" on public.%I', t);
    if strict_rls then
      execute format('create policy "household_member" on public.%I for all to authenticated using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id))', t);
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
