-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 034 · Lembrete de água pelo Telegram (com botão "+1 copo")
--
-- telegram_links.agua: liga/desliga o lembrete de água naquela conversa (desligado por padrão).
-- telegram_log: passa a aceitar o tipo 'agua' e ganha "ref" (o horário do lembrete), para
--   mandar cada lembrete uma vez só, mesmo com o agendador chamando de 5 em 5 minutos.
--   O "uma vez por dia" do bom dia e do resumo de domingo continua igual.
--
-- Só acrescenta (coluna, valores aceitos e um índice); nenhum dado muda.
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

alter table public.telegram_links add column if not exists agua boolean not null default false;
alter table public.telegram_log add column if not exists ref text;

do $$
declare c text;
begin
  -- aceita 'agua' além dos tipos de antes (troca só a regra do tipo)
  if not exists (select 1 from pg_constraint where conname = 'telegram_log_kind_check2') then
    for c in select conname from pg_constraint where conrelid = 'public.telegram_log'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%kind%' loop
      execute format('alter table public.telegram_log drop constraint %I', c);
    end loop;
    alter table public.telegram_log add constraint telegram_log_kind_check2 check (kind in ('morning','weekly','test','agua'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'telegram_log_ref_len') then
    alter table public.telegram_log add constraint telegram_log_ref_len check (ref is null or length(ref) <= 40);
  end if;
end $$;

-- "uma vez por dia" vale só para bom dia e domingo; a água é uma vez por horário
drop index if exists public.telegram_log_once_per_day;
create unique index if not exists telegram_log_once_per_day2 on public.telegram_log (link_id, kind, day) where kind in ('morning', 'weekly');
create unique index if not exists telegram_log_agua_once on public.telegram_log (link_id, day, ref) where kind = 'agua';

notify pgrst, 'reload schema';
