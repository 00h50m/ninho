-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 024 · Telegram em texto livre
--
-- telegram_pending: o que a IA entendeu de uma mensagem, esperando a pessoa
-- tocar em "Confirmar" (ou "Cancelar"). Só o servidor lê e grava (service_role);
-- nenhuma regra libera esta tabela para o app. Vale por 30 minutos.
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.telegram_pending (
  id           uuid primary key default gen_random_uuid(),
  link_id      uuid not null references public.telegram_links(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  actions      jsonb not null check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) between 1 and 12 and length(actions::text) <= 8000),
  status       text not null default 'open' check (status in ('open','done','cancelled')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
create index if not exists telegram_pending_recent on public.telegram_pending (household_id, created_at desc);

-- RLS ligada e sem regras: o app (anon/authenticated) não vê; o servidor ignora a RLS
alter table public.telegram_pending enable row level security;
revoke all on public.telegram_pending from anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.telegram_pending to service_role; end if;
end $$;

notify pgrst, 'reload schema';
