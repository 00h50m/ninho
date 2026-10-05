-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 007 · Casa: lista de compras, manutenção recorrente e divisão
--
-- · households.split_mode: como dividir as tarefas sem dona fixa
--   ('smart' = divisão inteligente, 'rotation' = rodízio fixo antigo).
-- · shopping_items: lista de compras compartilhada (ao vivo pelo Realtime).
--   Itens finalizados ficam guardados (done_at) e alimentam o "comprar de novo".
-- · maintenance_items + maintenance_log: manutenções de meses em meses
--   (filtro do ar, vacina, revisão do carro), com XP ao concluir.
--
-- Só acrescenta tabelas, colunas e funções. Não altera nem apaga dados.
-- Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

-- ── Divisão das tarefas ────────────────────────────────────────────────
alter table public.households add column if not exists split_mode text not null default 'smart';
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.households'::regclass and conname = 'households_split_mode_check') then
    alter table public.households add constraint households_split_mode_check check (split_mode in ('smart','rotation'));
  end if;
end $$;
comment on column public.households.split_mode is
  'Divisão das tarefas sem dona fixa: smart (quem fez por último passa a vez + equilíbrio) ou rotation (rodízio fixo).';

-- ── Lista de compras ───────────────────────────────────────────────────
create table if not exists public.shopping_items (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null check (length(btrim(title)) between 1 and 80),
  qty          text check (qty is null or length(qty) <= 30),
  category     text not null default 'outros',
  note         text check (note is null or length(note) <= 200),
  added_by     text check (added_by is null or added_by in ('g','s')),
  checked_at   timestamptz,
  checked_by   text check (checked_by is null or checked_by in ('g','s')),
  done_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz default now()
);
comment on table public.shopping_items is
  'Lista de compras. checked_at = riscado no mercado; done_at = compra finalizada (sai da lista e vira histórico).';

-- O mesmo item não aparece duas vezes na lista aberta
create unique index if not exists shopping_items_open_title
  on public.shopping_items (household_id, lower(btrim(title))) where done_at is null;
create index if not exists shopping_items_household_done_idx on public.shopping_items (household_id, done_at desc);

drop trigger if exists ninho_set_updated_at on public.shopping_items;
create trigger ninho_set_updated_at before update on public.shopping_items
  for each row execute function public.ninho_set_updated_at();

-- Adiciona um item. Se ele já está na lista, não duplica: devolve o existente
-- (e, se estava riscado, volta para "a comprar").
-- ninho_add_shopping_item(...) → { id, created, reopened }
create or replace function public.ninho_add_shopping_item(
  p_household_id uuid, p_title text, p_qty text default null, p_category text default 'outros', p_by text default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_row   public.shopping_items%rowtype;
begin
  if length(v_title) = 0 or length(v_title) > 80 then
    raise exception 'NINHO_INVALID_INPUT: nome do item vazio ou longo demais' using errcode = '22023';
  end if;
  if p_by is not null and p_by not in ('g','s') then
    raise exception 'NINHO_INVALID_PERSON: quem adicionou deve ser g ou s (recebido: %)', p_by using errcode = '22023';
  end if;

  select * into v_row from public.shopping_items
  where household_id = p_household_id and lower(btrim(title)) = lower(v_title) and done_at is null
  for update;

  if found then
    if v_row.checked_at is not null or (nullif(btrim(coalesce(p_qty, '')), '') is not null and v_row.qty is distinct from btrim(p_qty)) then
      update public.shopping_items
      set checked_at = null, checked_by = null,
          qty = coalesce(nullif(btrim(coalesce(p_qty, '')), ''), qty)
      where id = v_row.id;
    end if;
    return jsonb_build_object('id', v_row.id, 'created', false, 'reopened', v_row.checked_at is not null);
  end if;

  insert into public.shopping_items (household_id, title, qty, category, added_by)
  values (p_household_id, v_title, nullif(btrim(coalesce(p_qty, '')), ''), coalesce(nullif(p_category, ''), 'outros'), p_by)
  on conflict (household_id, lower(btrim(title))) where done_at is null do nothing
  returning * into v_row;

  if not found then -- outro aparelho adicionou no mesmo instante
    select * into v_row from public.shopping_items
    where household_id = p_household_id and lower(btrim(title)) = lower(v_title) and done_at is null;
    return jsonb_build_object('id', v_row.id, 'created', false, 'reopened', false);
  end if;
  return jsonb_build_object('id', v_row.id, 'created', true, 'reopened', false);
end $$;

-- ── Manutenção recorrente ──────────────────────────────────────────────
create table if not exists public.maintenance_items (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null check (length(btrim(title)) between 1 and 80),
  category     text not null default 'casa' check (category in ('casa','carro','caes','saude','outros')),
  every_months integer check (every_months is null or every_months between 1 and 120),
  every_days   integer check (every_days is null or every_days between 1 and 3650),
  last_done    date,
  next_due     date not null default public.ninho_today(),
  assigned_to  text check (assigned_to is null or assigned_to in ('g','s')),
  notes        text check (notes is null or length(notes) <= 300),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz default now(),
  constraint maintenance_items_interval check (every_months is not null or every_days is not null)
);
comment on table public.maintenance_items is
  'Manutenções de tempos em tempos. next_due = próxima data; ao concluir, vira data + intervalo.';

create index if not exists maintenance_items_household_due_idx on public.maintenance_items (household_id, next_due) where active;

drop trigger if exists ninho_set_updated_at on public.maintenance_items;
create trigger ninho_set_updated_at before update on public.maintenance_items
  for each row execute function public.ninho_set_updated_at();

create table if not exists public.maintenance_log (
  id             uuid primary key default uuid_generate_v4(),
  item_id        uuid not null references public.maintenance_items(id) on delete cascade,
  household_id   uuid not null references public.households(id) on delete cascade,
  done_on        date not null default public.ninho_today(),
  done_by        text check (done_by is null or done_by in ('g','s')),
  prev_last_done date,
  prev_next_due  date,
  created_at     timestamptz not null default now(),
  unique (item_id, done_on)
);
comment on table public.maintenance_log is 'Histórico das manutenções feitas (guarda as datas anteriores para poder desfazer).';
create index if not exists maintenance_log_household_idx on public.maintenance_log (household_id, done_on desc);

-- Próxima data: meses do calendário (31/01 + 1 mês = 28/02) ou dias corridos.
create or replace function public.ninho_next_due(p_from date, p_months integer, p_days integer)
returns date language sql immutable as $$
  select case when p_months is not null then (p_from + make_interval(months => p_months))::date
              else p_from + coalesce(p_days, 30) end
$$;

-- XP de uma manutenção concluída (mais trabalhosa que uma tarefa comum).
create or replace function public.ninho_maintenance_xp() returns integer language sql immutable as $$ select 3 $$;

-- ninho_complete_maintenance(p_item_id, p_date, p_by) → { created, log_id, next_due, xp }
-- Registra que foi feita, recalcula a próxima data e lança o XP (sem duplicar).
create or replace function public.ninho_complete_maintenance(p_item_id uuid, p_date date, p_by text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_item public.maintenance_items%rowtype;
  v_log  uuid;
  v_next date;
  v_xp   integer := 0;
begin
  perform public.ninho_check_completion_input(p_date, p_by, true);

  select * into v_item from public.maintenance_items where id = p_item_id for update;
  if not found then
    raise exception 'NINHO_NOT_FOUND: manutenção % não encontrada', p_item_id using errcode = 'P0002';
  end if;

  insert into public.maintenance_log (item_id, household_id, done_on, done_by, prev_last_done, prev_next_due)
  values (p_item_id, v_item.household_id, p_date, p_by, v_item.last_done, v_item.next_due)
  on conflict (item_id, done_on) do nothing
  returning id into v_log;

  if v_log is null then
    select id into v_log from public.maintenance_log where item_id = p_item_id and done_on = p_date;
    return jsonb_build_object('created', false, 'log_id', v_log, 'next_due', v_item.next_due, 'xp', 0);
  end if;

  v_next := public.ninho_next_due(p_date, v_item.every_months, v_item.every_days);
  update public.maintenance_items set last_done = p_date, next_due = v_next where id = p_item_id;

  insert into public.xp_history (household_id, amount, reason, earned_by, activity_date, on_time)
  values (v_item.household_id, public.ninho_maintenance_xp(), public.ninho_xp_reason('maint', p_item_id, p_date), p_by, p_date, false)
  on conflict (household_id, reason) where reason is not null and voided_at is null do nothing;
  get diagnostics v_xp = row_count;

  return jsonb_build_object('created', true, 'log_id', v_log, 'next_due', v_next,
                            'xp', case when v_xp > 0 then public.ninho_maintenance_xp() else 0 end);
end $$;

-- ninho_undo_maintenance(p_log_id) → { removed }
-- Desfaz uma conclusão: volta as datas anteriores (se ainda for a mais recente) e tira o XP.
create or replace function public.ninho_undo_maintenance(p_log_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_log  public.maintenance_log%rowtype;
  v_item public.maintenance_items%rowtype;
begin
  select * into v_log from public.maintenance_log where id = p_log_id;
  if not found then
    return jsonb_build_object('removed', false);
  end if;
  select * into v_item from public.maintenance_items where id = v_log.item_id for update;

  if v_item.last_done is not distinct from v_log.done_on
     and not exists (select 1 from public.maintenance_log where item_id = v_log.item_id and done_on > v_log.done_on) then
    update public.maintenance_items
    set last_done = v_log.prev_last_done, next_due = coalesce(v_log.prev_next_due, next_due)
    where id = v_log.item_id;
  end if;

  delete from public.maintenance_log where id = p_log_id;
  delete from public.xp_history
  where household_id = v_log.household_id
    and reason = public.ninho_xp_reason('maint', v_log.item_id, v_log.done_on)
    and voided_at is null;
  return jsonb_build_object('removed', true);
end $$;

-- ── RLS (modelo atual: qualquer usuário autenticado, inclusive o login anônimo) ──
alter table public.shopping_items enable row level security;
alter table public.maintenance_items enable row level security;
alter table public.maintenance_log enable row level security;
do $$
declare t text;
begin
  foreach t in array array['shopping_items','maintenance_items','maintenance_log'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'allow_all_auth') then
      execute format('create policy "allow_all_auth" on public.%I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- ── Permissões das funções ─────────────────────────────────────────────
revoke all on function public.ninho_add_shopping_item(uuid, text, text, text, text) from public;
revoke all on function public.ninho_complete_maintenance(uuid, date, text) from public;
revoke all on function public.ninho_undo_maintenance(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.ninho_add_shopping_item(uuid, text, text, text, text) from anon;
    revoke all on function public.ninho_complete_maintenance(uuid, date, text) from anon;
    revoke all on function public.ninho_undo_maintenance(uuid) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.ninho_add_shopping_item(uuid, text, text, text, text) to authenticated;
    grant execute on function public.ninho_complete_maintenance(uuid, date, text) to authenticated;
    grant execute on function public.ninho_undo_maintenance(uuid) to authenticated;
  end if;
end $$;

-- ── Realtime ───────────────────────────────────────────────────────────
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    foreach t in array array['shopping_items','maintenance_items','maintenance_log','households'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
