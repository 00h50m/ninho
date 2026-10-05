-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 009 · Telegram e IA
--
-- · telegram_links: liga uma conversa do Telegram a uma pessoa (g|s) da casa.
--   O app gera um código de uso único (válido por 30 min); a pessoa abre o bot
--   com esse código e a conversa fica ligada. Sem login: o código é o vínculo.
-- · telegram_log: no máximo um bom dia/resumo por conversa por dia.
-- · ai_log: registro de uso da IA (limite diário por casa, sem guardar texto).
-- · O servidor (service_role) pode concluir tarefas e mexer na lista de compras
--   em nome da pessoa ligada ao Telegram.
--
-- Só acrescenta tabelas e permissões. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.telegram_links (
  id              uuid primary key default uuid_generate_v4(),
  household_id    uuid not null references public.households(id) on delete cascade,
  who             text not null check (who in ('g','s')),
  chat_id         bigint unique,
  link_code       text unique,
  code_expires_at timestamptz,
  linked_at       timestamptz,
  morning         boolean not null default true,
  weekly          boolean not null default true,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz default now()
);
comment on table public.telegram_links is
  'Conversas do Telegram ligadas a uma pessoa da casa. link_code vale 30 minutos e é apagado ao ligar.';
create index if not exists telegram_links_household_idx on public.telegram_links (household_id) where active;

drop trigger if exists ninho_set_updated_at on public.telegram_links;
create trigger ninho_set_updated_at before update on public.telegram_links
  for each row execute function public.ninho_set_updated_at();

create table if not exists public.telegram_log (
  id         uuid primary key default uuid_generate_v4(),
  link_id    uuid not null references public.telegram_links(id) on delete cascade,
  kind       text not null check (kind in ('morning','weekly','test')),
  day        date not null default public.ninho_today(),
  status     text not null default 'pending' check (status in ('pending','sent','failed')),
  detail     text,
  created_at timestamptz not null default now()
);
create unique index if not exists telegram_log_once_per_day on public.telegram_log (link_id, kind, day) where kind <> 'test';

create table if not exists public.ai_log (
  id            uuid primary key default uuid_generate_v4(),
  household_id  uuid not null references public.households(id) on delete cascade,
  kind          text not null,
  input_tokens  integer,
  output_tokens integer,
  created_at    timestamptz not null default now()
);
create index if not exists ai_log_household_idx on public.ai_log (household_id, created_at desc);

-- RLS: o app lê/gera o próprio vínculo; os logs são só do servidor (service_role ignora RLS).
alter table public.telegram_links enable row level security;
alter table public.telegram_log enable row level security;
alter table public.ai_log enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_links' and policyname = 'allow_all_auth') then
    create policy "allow_all_auth" on public.telegram_links for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Gera (ou renova) o código de ligação da pessoa. Devolve o código de 8 caracteres.
-- ninho_telegram_link_code(p_household_id, p_who) → text
create or replace function public.ninho_telegram_link_code(p_household_id uuid, p_who text)
returns text language plpgsql security invoker set search_path = public as $$
declare v_code text;
begin
  if p_who is null or p_who not in ('g','s') then
    raise exception 'NINHO_INVALID_PERSON: pessoa deve ser g ou s (recebido: %)', coalesce(p_who, 'vazio') using errcode = '22023';
  end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  -- Um código pendente por pessoa: renova o que ainda não foi usado
  update public.telegram_links set link_code = v_code, code_expires_at = now() + interval '30 minutes'
  where household_id = p_household_id and who = p_who and chat_id is null;
  if not found then
    insert into public.telegram_links (household_id, who, link_code, code_expires_at)
    values (p_household_id, p_who, v_code, now() + interval '30 minutes');
  end if;
  return v_code;
end $$;

revoke all on function public.ninho_telegram_link_code(uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.ninho_telegram_link_code(uuid, text) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.ninho_telegram_link_code(uuid, text) to authenticated;
  end if;
  -- O bot (servidor) conclui tarefas/rotinas e mexe na lista em nome da pessoa ligada
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.ninho_complete_task(uuid, date, text) to service_role;
    grant execute on function public.ninho_complete_dog_routines(uuid[], date, text) to service_role;
    grant execute on function public.ninho_add_shopping_item(uuid, text, text, text, text) to service_role;
    grant execute on function public.ninho_complete_maintenance(uuid, date, text) to service_role;
  end if;
end $$;

-- Realtime: o app mostra "conectado" assim que a pessoa abre o bot
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'telegram_links') then
    alter publication supabase_realtime add table public.telegram_links;
  end if;
end $$;
