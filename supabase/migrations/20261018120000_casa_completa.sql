-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 019 · Casa completa
--
-- • Tarefas: prioridade, observações, checklist e "pedir ajuda".
--   Ao concluir, o pedido de ajuda é atendido e o checklist de tarefa
--   recorrente volta a ficar em branco para a próxima vez.
-- • Compras: unidade, prioridade, quem compra, "está acabando" e recorrência
--   (item comprado volta sozinho para a lista depois de N dias).
-- • Manutenção: prestador, garantia, custo (opcional) e comprovante/link.
-- • Agenda da casa (house_events): consultas dos cães, visitas, entregas,
--   serviços, compromissos e vencimentos simples (pago/pendente + link do Sobrou!).
--   Não é módulo financeiro: só nome, data, responsável e situação.
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

-- ── Tarefas ──────────────────────────────────────────────────────────
alter table public.tasks add column if not exists priority text not null default 'normal';
alter table public.tasks add column if not exists notes text;
alter table public.tasks add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.tasks add column if not exists help_by text;
alter table public.tasks add column if not exists help_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_priority_check') then
    alter table public.tasks add constraint tasks_priority_check check (priority in ('alta','normal','baixa'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_notes_check') then
    alter table public.tasks add constraint tasks_notes_check check (notes is null or length(notes) <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_checklist_check') then
    alter table public.tasks add constraint tasks_checklist_check check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 30);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_help_by_check') then
    alter table public.tasks add constraint tasks_help_by_check check (help_by is null or help_by in ('g','s'));
  end if;
end $$;

-- Concluir: atende o pedido de ajuda e zera o checklist das recorrentes
create or replace function public.ninho_task_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.tasks t set
    help_by = null, help_at = null,
    checklist = case when t.frequency <> 'once' and jsonb_array_length(t.checklist) > 0
      then (select coalesce(jsonb_agg(e || '{"d":false}'::jsonb), '[]'::jsonb) from jsonb_array_elements(t.checklist) e)
      else t.checklist end
  where t.id = new.task_id and (t.help_by is not null or (t.frequency <> 'once' and jsonb_array_length(t.checklist) > 0));
  return new;
end $$;
revoke all on function public.ninho_task_completed() from public;
drop trigger if exists ninho_task_completed on public.task_completions;
create trigger ninho_task_completed after insert on public.task_completions for each row execute function public.ninho_task_completed();

-- ── Compras ──────────────────────────────────────────────────────────
alter table public.shopping_items add column if not exists unit text;
alter table public.shopping_items add column if not exists priority text not null default 'normal';
alter table public.shopping_items add column if not exists assigned_to text;
alter table public.shopping_items add column if not exists running_low boolean not null default false;
alter table public.shopping_items add column if not exists recur_days smallint;
alter table public.shopping_items add column if not exists back_on date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'shopping_items_unit_check') then
    alter table public.shopping_items add constraint shopping_items_unit_check check (unit is null or length(unit) <= 15);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shopping_items_priority_check') then
    alter table public.shopping_items add constraint shopping_items_priority_check check (priority in ('alta','normal'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shopping_items_assigned_to_check') then
    alter table public.shopping_items add constraint shopping_items_assigned_to_check check (assigned_to is null or assigned_to in ('g','s'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shopping_items_recur_days_check') then
    alter table public.shopping_items add constraint shopping_items_recur_days_check check (recur_days is null or recur_days between 1 and 365);
  end if;
end $$;

-- Item recorrente comprado: marca quando volta para a lista
create or replace function public.ninho_shopping_done()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.done_at is not null and old.done_at is null and new.recur_days is not null then
    new.back_on := (new.done_at at time zone 'America/Sao_Paulo')::date + new.recur_days;
  elsif new.done_at is null and old.done_at is not null then
    new.back_on := null;  -- "desfazer finalizar compra"
  end if;
  return new;
end $$;
drop trigger if exists ninho_shopping_done on public.shopping_items;
create trigger ninho_shopping_done before update on public.shopping_items for each row execute function public.ninho_shopping_done();

-- Devolve à lista os recorrentes que já chegaram na data (sem duplicar: se já
-- está na lista, só limpa a data). Retorna quantos voltaram.
create or replace function public.ninho_shopping_recur(p_household_id uuid)
returns integer language plpgsql security invoker set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select * from public.shopping_items
           where household_id = p_household_id and done_at is not null and back_on is not null and back_on <= public.ninho_today()
           for update loop
    if not exists (select 1 from public.shopping_items o where o.household_id = p_household_id and o.done_at is null and lower(btrim(o.title)) = lower(btrim(r.title))) then
      insert into public.shopping_items (household_id, title, qty, unit, category, priority, assigned_to, recur_days, note)
      values (p_household_id, r.title, r.qty, r.unit, r.category, r.priority, r.assigned_to, r.recur_days, r.note);
      n := n + 1;
    end if;
    update public.shopping_items set back_on = null where id = r.id;
  end loop;
  return n;
end $$;

-- ── Manutenção ───────────────────────────────────────────────────────
alter table public.maintenance_items add column if not exists provider text;
alter table public.maintenance_items add column if not exists warranty_until date;
alter table public.maintenance_items add column if not exists cost numeric(10,2);
alter table public.maintenance_items add column if not exists link text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'maintenance_items_provider_check') then
    alter table public.maintenance_items add constraint maintenance_items_provider_check check (provider is null or length(provider) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maintenance_items_cost_check') then
    alter table public.maintenance_items add constraint maintenance_items_cost_check check (cost is null or cost >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maintenance_items_link_check') then
    alter table public.maintenance_items add constraint maintenance_items_link_check check (link is null or (length(link) <= 500 and link ~* '^https?://'));
  end if;
end $$;

-- ── Agenda da casa e vencimentos simples ─────────────────────────────
create table if not exists public.house_events (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind         text not null default 'compromisso' check (kind in ('consulta_caes','visita','entrega','servico','compromisso','vencimento')),
  title        text not null check (length(btrim(title)) between 1 and 80),
  date         date not null,
  time         text check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  who          text check (who is null or who in ('g','s','both')),
  notes        text check (notes is null or length(notes) <= 300),
  link         text check (link is null or (length(link) <= 500 and link ~* '^https?://')),
  -- só vencimentos: pago ou pendente
  paid         boolean,
  done_at      timestamptz,
  created_by   text check (created_by is null or created_by in ('g','s')),
  created_at   timestamptz not null default now()
);
create index if not exists house_events_date on public.house_events (household_id, date);

-- Link do Sobrou! da casa (abre o app de finanças a partir de um vencimento)
alter table public.households add column if not exists sobrou_url text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'households_sobrou_url_check') then
    alter table public.households add constraint households_sobrou_url_check check (sobrou_url is null or (length(sobrou_url) <= 500 and sobrou_url ~* '^https?://'));
  end if;
end $$;

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.house_events enable row level security;
  if strict_rls then
    drop policy if exists "allow_all_auth" on public.house_events;
    drop policy if exists "household_member" on public.house_events;
    create policy "household_member" on public.house_events for all to authenticated using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id));
  elsif not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'house_events') then
    create policy "allow_all_auth" on public.house_events for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.house_events to authenticated;
    grant execute on function public.ninho_shopping_recur(uuid) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.ninho_shopping_recur(uuid) from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.house_events to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'house_events') then
    alter publication supabase_realtime add table public.house_events;
  end if;
end $$;
revoke all on function public.ninho_shopping_recur(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.ninho_shopping_recur(uuid) to authenticated; end if;
end $$;
