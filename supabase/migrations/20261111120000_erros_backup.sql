-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 043 · Erros visíveis e backup automático
--
-- app_errors: erros que acontecem no app (no celular de vocês) e nos agendadores do
--   servidor, para aparecerem em Ajustes › Sistema. household_id nulo = erro do servidor.
-- household_backups: cópia dos dados da casa (um JSON por backup). O agendador de
--   domingo guarda uma e mantém as 8 últimas; dá para fazer uma na hora pelo app.
--   O Meu dia (tabelas personal_*), as inscrições de notificação, os vínculos do
--   Telegram e os registros de envio ficam de fora (são pessoais ou técnicos).
-- ninho_household_backup / ninho_save_backup: montam e guardam a cópia. Só o servidor
--   (service_role) chama.
--
-- Não destrutiva: só cria tabelas e funções novas. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.app_errors (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references public.households(id) on delete cascade,
  who          text check (who is null or who in ('g','s')),
  context      text not null check (length(context) between 1 and 120),
  message      text not null check (length(message) between 1 and 600),
  code         text check (code is null or length(code) <= 40),
  path         text check (path is null or length(path) <= 200),
  created_at   timestamptz not null default now()
);
comment on table public.app_errors is 'Erros do app (celular) e dos agendadores (household_id nulo), para Ajustes › Sistema.';
create index if not exists app_errors_household_created_idx on public.app_errors (household_id, created_at desc);

alter table public.app_errors enable row level security;
drop policy if exists "household_member" on public.app_errors;
create policy "household_member" on public.app_errors for all to authenticated
  using (household_id is null or public.ninho_is_member(household_id))
  with check (public.ninho_is_member(household_id));

create table if not exists public.household_backups (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind         text not null default 'auto' check (kind in ('auto','manual')),
  size_bytes   integer not null default 0,
  data         jsonb not null,
  created_at   timestamptz not null default now()
);
comment on table public.household_backups is 'Cópias dos dados da casa (JSON). As 8 últimas ficam guardadas.';
create index if not exists household_backups_household_created_idx on public.household_backups (household_id, created_at desc);

alter table public.household_backups enable row level security;
drop policy if exists "household_member_read" on public.household_backups;
create policy "household_member_read" on public.household_backups for select to authenticated
  using (public.ninho_is_member(household_id));

-- Todos os dados da casa: cada tabela do public com household_id, menos as pessoais e técnicas.
create or replace function public.ninho_household_backup(p_household_id uuid)
returns jsonb language plpgsql stable set search_path = public as $$
declare t text; rows jsonb; out jsonb := '{}'::jsonb;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'household_id'
      and c.table_name not like 'personal\_%'
      and c.table_name not in ('household_backups','app_errors','push_subscriptions','push_log','telegram_links','telegram_log','telegram_pending','ai_log')
    order by c.table_name
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.household_id = $1', t) into rows using p_household_id;
    out := out || jsonb_build_object(t, rows);
  end loop;
  return jsonb_build_object(
    'ninho_backup', 'v2',
    'exported_at', now(),
    'household', (select to_jsonb(h) from public.households h where h.id = p_household_id),
    'profiles', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.profiles p where p.household_id = p_household_id),
    'tables', out);
end $$;

-- Guarda uma cópia e mantém só as 8 últimas da casa.
create or replace function public.ninho_save_backup(p_household_id uuid, p_kind text default 'auto')
returns uuid language plpgsql set search_path = public as $$
declare d jsonb; new_id uuid;
begin
  d := public.ninho_household_backup(p_household_id);
  -- clock_timestamp: cada cópia com o próprio horário (a limpeza dos 8 últimos não empata)
  insert into public.household_backups (household_id, kind, size_bytes, data, created_at)
    values (p_household_id, case when p_kind = 'manual' then 'manual' else 'auto' end, octet_length(d::text), d, clock_timestamp())
    returning id into new_id;
  delete from public.household_backups b where b.household_id = p_household_id
    and b.id not in (select id from public.household_backups where household_id = p_household_id order by created_at desc, id desc limit 8);
  return new_id;
end $$;

revoke all on function public.ninho_household_backup(uuid) from public, anon, authenticated;
revoke all on function public.ninho_save_backup(uuid, text) from public, anon, authenticated;
grant execute on function public.ninho_household_backup(uuid) to service_role;
grant execute on function public.ninho_save_backup(uuid, text) to service_role;

notify pgrst, 'reload schema';
