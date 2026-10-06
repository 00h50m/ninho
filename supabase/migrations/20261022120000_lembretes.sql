-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 023 · Lembretes (notificações com o app fechado)
--
-- • push_subscriptions: o que cada aparelho quer receber (remédio, água,
--   rotinas, sprint, cães, agenda, desafio, check-in) e o horário de silêncio.
-- • push_log: novo tipo "reminder", com uma referência (ex.: remédio X às
--   08:00 de hoje) para nunca mandar o mesmo lembrete duas vezes.
--
-- O envio é feito pela rota /api/cron/reminders, chamada a cada poucos
-- minutos por um agendador (ver supabase/scripts/agendar-lembretes.sql).
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

alter table public.push_subscriptions add column if not exists reminders jsonb not null
  default '{"remedio":true,"rotina":true,"sprint":true,"caes":true,"agenda":true,"desafio":true,"agua":false,"checkin":false}'::jsonb;
alter table public.push_subscriptions add column if not exists quiet_start text not null default '22:00';
alter table public.push_subscriptions add column if not exists quiet_end text not null default '07:00';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_reminders_check') then
    alter table public.push_subscriptions add constraint push_subscriptions_reminders_check check (
      jsonb_typeof(reminders) = 'object'
      and quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
end $$;

-- push_log: aceita "reminder" (troca a regra de tipos; nenhum dado muda)
alter table public.push_log add column if not exists ref text;
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.push_log'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%kind%'
             and conname <> 'push_log_kind_reminder_check' loop
    execute format('alter table public.push_log drop constraint %I', c);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'push_log_kind_reminder_check') then
    alter table public.push_log add constraint push_log_kind_reminder_check check (
      kind in ('morning','weekly','test','reminder') and (kind <> 'reminder' or (ref is not null and length(ref) <= 120)));
  end if;
end $$;
-- uma vez por dia para manhã/domingo (como antes); lembrete: uma vez por referência
drop index if exists public.push_log_once_per_day;
create unique index if not exists push_log_once_per_day on public.push_log (subscription_id, kind, day) where kind in ('morning','weekly');
create unique index if not exists push_log_reminder_once on public.push_log (subscription_id, day, ref) where kind = 'reminder';

notify pgrst, 'reload schema';
