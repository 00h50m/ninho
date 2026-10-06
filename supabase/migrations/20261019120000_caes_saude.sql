-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 020 · Cães: perfil, saúde, alimentação e filhote
--
-- • dogs: nascimento, sexo, foto (pequena, guardada no próprio registro),
--   ração (marca, gramas por dia, refeições), estoque de ração e observações.
-- • dog_health: histórico de cuidados — vacina, vermífugo, antipulgas,
--   medicamento, consulta, banho, peso e outros — com a próxima aplicação.
--   Só registro e lembrete: o app não dá diagnóstico veterinário.
-- • puppy_accidents: observação (para corrigir e entender o registro).
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

alter table public.dogs add column if not exists birth_date date;
alter table public.dogs add column if not exists sex text;
alter table public.dogs add column if not exists photo text;
alter table public.dogs add column if not exists food_brand text;
alter table public.dogs add column if not exists food_g_day integer;
alter table public.dogs add column if not exists meals_day smallint;
alter table public.dogs add column if not exists food_stock_kg numeric(6,2);
alter table public.dogs add column if not exists food_stock_on date;
alter table public.dogs add column if not exists notes text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dogs_sex_check') then
    alter table public.dogs add constraint dogs_sex_check check (sex is null or sex in ('f','m'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dogs_photo_check') then
    alter table public.dogs add constraint dogs_photo_check check (photo is null or (photo like 'data:image/%' and length(photo) <= 250000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dogs_food_check') then
    alter table public.dogs add constraint dogs_food_check check (
      (food_brand is null or length(food_brand) <= 60) and (food_g_day is null or food_g_day between 1 and 3000)
      and (meals_day is null or meals_day between 1 and 6) and (food_stock_kg is null or food_stock_kg >= 0)
      and (notes is null or length(notes) <= 500));
  end if;
end $$;

create table if not exists public.dog_health (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  dog_id       uuid not null references public.dogs(id) on delete cascade,
  kind         text not null check (kind in ('vacina','vermifugo','antipulgas','medicamento','consulta','banho','peso','outro')),
  title        text not null check (length(btrim(title)) between 1 and 80),
  date         date not null,
  -- próxima aplicação (lembrete); repetir a cada N dias ajuda a calcular
  next_date    date,
  every_days   integer check (every_days is null or every_days between 1 and 730),
  dose         text check (dose is null or length(dose) <= 60),
  vet          text check (vet is null or length(vet) <= 80),
  weight_kg    numeric(5,2) check (weight_kg is null or (weight_kg > 0 and weight_kg < 200)),
  notes        text check (notes is null or length(notes) <= 300),
  link         text check (link is null or (length(link) <= 500 and link ~* '^https?://')),
  done_by      text check (done_by is null or done_by in ('g','s')),
  created_at   timestamptz not null default now()
);
create index if not exists dog_health_dog on public.dog_health (dog_id, date desc);
create index if not exists dog_health_next on public.dog_health (household_id, next_date) where next_date is not null;

alter table public.puppy_accidents add column if not exists notes text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'puppy_accidents_notes_check') then
    alter table public.puppy_accidents add constraint puppy_accidents_notes_check check (notes is null or length(notes) <= 200);
  end if;
end $$;

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.dog_health enable row level security;
  if strict_rls then
    drop policy if exists "allow_all_auth" on public.dog_health;
    drop policy if exists "household_member" on public.dog_health;
    create policy "household_member" on public.dog_health for all to authenticated using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id));
  elsif not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dog_health') then
    create policy "allow_all_auth" on public.dog_health for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.dog_health to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.dog_health to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dog_health') then
    alter publication supabase_realtime add table public.dog_health;
  end if;
end $$;
