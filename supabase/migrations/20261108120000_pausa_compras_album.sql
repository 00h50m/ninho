-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 040 · Pausar tarefa, compras por lugar com preço e álbum do Ninho
--
-- tasks.paused_until: pausada até este dia (inclusive). Volta sozinha no dia seguinte.
--   Pausada: não aparece em Hoje e não conta para a "Casa em dia".
-- shopping_items.store: onde comprar (mercado, feira, pet shop…). null = o app deduz
--   pelo corredor. shopping_items.price: quanto custou (fica no histórico e vira o
--   "última vez R$ …" da próxima compra).
-- album_photos: fotos da casa e dos cães, com legenda e data. Da casa: as duas veem e
--   editam. Reduzidas no celular antes de sair (~200 KB), com miniatura.
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

alter table public.tasks add column if not exists paused_until date;
comment on column public.tasks.paused_until is 'Pausada até este dia (inclusive). null = não está pausada.';

alter table public.shopping_items add column if not exists store text;
alter table public.shopping_items add column if not exists price numeric(10,2);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'shopping_items_store_check') then
    alter table public.shopping_items add constraint shopping_items_store_check
      check (store is null or store in ('mercado','feira','acougue','padaria','petshop','farmacia','atacado','online','outro')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shopping_items_price_check') then
    alter table public.shopping_items add constraint shopping_items_price_check check (price is null or (price >= 0 and price < 100000)) not valid;
  end if;
end $$;

create table if not exists public.album_photos (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null default public.ninho_today(),
  tag          text not null default 'casa' check (tag in ('casa','caes','nos','passeio','outro')),
  caption      text check (caption is null or length(caption) <= 200),
  thumb        text not null check (length(thumb) between 100 and 80000),
  data         text not null check (length(data) between 100 and 2000000),
  added_by     text check (added_by is null or added_by in ('g','s')),
  created_at   timestamptz not null default now()
);
create index if not exists album_photos_household on public.album_photos (household_id, date desc);

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.album_photos enable row level security;
  drop policy if exists "allow_all_auth" on public.album_photos;
  drop policy if exists "household_member" on public.album_photos;
  if strict_rls then
    create policy "household_member" on public.album_photos for all to authenticated using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id));
  else
    create policy "allow_all_auth" on public.album_photos for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.album_photos to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.album_photos to service_role; end if;
end $$;

-- "Casa em dia": como na 039, mas sem as diárias essenciais pausadas no dia.
create or replace function public.ninho_day_on_track(p_household_id uuid, p_day date)
returns boolean language plpgsql stable security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.tasks t
                 where t.household_id = p_household_id and t.active and t.essential and t.frequency = 'daily'
                   and public.ninho_local_date(t.created_at) <= p_day
                   and public.ninho_task_on_day(t.weekdays, p_day)
                   and (t.starts_on is null or t.starts_on <= p_day) and (t.ends_on is null or t.ends_on >= p_day)
                   and (t.paused_until is null or t.paused_until < p_day)) then
    return public.ninho_day_active(p_household_id, p_day, null);
  end if;
  return not exists (
    select 1 from public.tasks t
    where t.household_id = p_household_id and t.active and t.essential and t.frequency = 'daily'
      and public.ninho_local_date(t.created_at) <= p_day
      and public.ninho_task_on_day(t.weekdays, p_day)
      and (t.starts_on is null or t.starts_on <= p_day) and (t.ends_on is null or t.ends_on >= p_day)
      and (t.paused_until is null or t.paused_until < p_day)
      and not exists (select 1 from public.task_completions c where c.task_id = t.id and c.date = p_day)
      and not exists (select 1 from public.task_skips s where s.task_id = t.id and s.date = p_day));
end $$;

notify pgrst, 'reload schema';
