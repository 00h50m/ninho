-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 017 · Modelos de rotina da casa
--
-- "Salvar como modelo" no construtor de rotina: o modelo fica guardado na casa
-- e aparece em Rotinas › Modelos para as duas. Um modelo por nome (salvar de
-- novo com o mesmo nome atualiza).
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.routine_templates (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  title          text not null check (length(btrim(title)) between 1 and 60),
  title_key      text generated always as (lower(btrim(title))) stored,
  description    text check (description is null or length(description) <= 200),
  category       text not null default 'casa' check (category in ('casa','cozinha','caes','manha','noite','semana','outros')),
  weekdays       smallint[] check (weekdays is null or (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[])),
  scheduled_time text check (scheduled_time is null or scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_min   smallint check (duration_min is null or duration_min between 1 and 240),
  assign_mode    text not null default 'shared' check (assign_mode in ('g','s','shared','rotation')),
  essential      boolean not null default false,
  -- passos: [{"title": "...", "survival": true}]
  steps          jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 30),
  created_by     text check (created_by is null or created_by in ('g','s')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (household_id, title_key)
);

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.routine_templates enable row level security;
  if strict_rls then
    drop policy if exists "allow_all_auth" on public.routine_templates;
    drop policy if exists "household_member" on public.routine_templates;
    create policy "household_member" on public.routine_templates for all to authenticated using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id));
  elsif not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'routine_templates') then
    create policy "allow_all_auth" on public.routine_templates for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.routine_templates to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.routine_templates to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'routine_templates') then
    alter publication supabase_realtime add table public.routine_templates;
  end if;
end $$;
