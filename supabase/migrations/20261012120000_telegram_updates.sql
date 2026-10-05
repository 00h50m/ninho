-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 013 · Telegram: cada atualização é processada uma vez só
--
-- O Telegram reenvia a mesma atualização (mensagem ou toque num botão) quando
-- a resposta demora. telegram_updates guarda o update_id já processado, para o
-- bot não registrar nem responder duas vezes. Só o servidor usa (service_role).
-- Só acrescenta. Pode rodar mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.telegram_updates (
  update_id  bigint primary key,
  created_at timestamptz not null default now()
);
comment on table public.telegram_updates is 'update_id do Telegram já processados (evita respostas e conclusões em dobro). Linhas antigas são apagadas pelo bot.';
create index if not exists telegram_updates_created_idx on public.telegram_updates (created_at);
alter table public.telegram_updates enable row level security;
