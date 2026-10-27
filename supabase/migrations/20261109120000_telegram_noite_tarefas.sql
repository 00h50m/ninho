-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 041 · Telegram: resumo da noite e lembrete de tarefa
--
-- telegram_links.evening: resumo da noite às 21h (ligado por padrão).
-- telegram_links.tasks: tarefa no horário e essencial atrasada (desligado por padrão;
--   quem já recebe a notificação do app não precisa receber duas vezes).
-- telegram_log: aceita os tipos 'noite', 'tarefa' e 'atraso', uma vez por dia e referência.
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

alter table public.telegram_links add column if not exists evening boolean not null default true;
alter table public.telegram_links add column if not exists tasks boolean not null default false;

do $$
declare c text;
begin
  if not exists (select 1 from pg_constraint where conname = 'telegram_log_kind_check3') then
    for c in select conname from pg_constraint where conrelid = 'public.telegram_log'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%kind%' loop
      execute format('alter table public.telegram_log drop constraint %I', c);
    end loop;
    alter table public.telegram_log add constraint telegram_log_kind_check3 check (kind in ('morning','weekly','test','agua','noite','tarefa','atraso'));
  end if;
end $$;

create unique index if not exists telegram_log_lembrete_once on public.telegram_log (link_id, day, ref) where kind in ('noite', 'tarefa', 'atraso');

notify pgrst, 'reload schema';
