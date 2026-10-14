-- Testes da migration 034 (água pelo Telegram): coluna desligada por padrão, registro uma vez por horário,
-- e o "uma vez por dia" do bom dia e do domingo continua valendo. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

select pg_temp.ok((select column_default from information_schema.columns where table_name = 'telegram_links' and column_name = 'agua') = 'false', 'telegram_links.agua existe e começa desligada');
select pg_temp.ok((select count(*) from pg_constraint where conname = 'telegram_log_kind_check2') = 1, 'tipo do registro aceita agua (uma regra só, mesmo rodando 2x)');

insert into public.households (id, name) values ('afafafaf-0000-0000-0000-000000000001', 'Casa água tg') on conflict (id) do nothing;
insert into public.telegram_links (id, household_id, who, chat_id, linked_at) values ('afafafaf-1111-0000-0000-000000000001', 'afafafaf-0000-0000-0000-000000000001', 'g', 4242424242, now()) on conflict (id) do nothing;
delete from public.telegram_log where link_id = 'afafafaf-1111-0000-0000-000000000001';
select pg_temp.ok((select agua from public.telegram_links where chat_id = 4242424242) = false, 'conversa já existente: água desligada');

insert into public.telegram_log (link_id, kind, day, ref) values ('afafafaf-1111-0000-0000-000000000001', 'agua', '2026-11-02', 'agua:11:00');
insert into public.telegram_log (link_id, kind, day, ref) values ('afafafaf-1111-0000-0000-000000000001', 'agua', '2026-11-02', 'agua:14:00');
select pg_temp.ok((select count(*) from public.telegram_log where kind = 'agua') = 2, 'água: vários horários no mesmo dia');
do $$ begin
  begin insert into public.telegram_log (link_id, kind, day, ref) values ('afafafaf-1111-0000-0000-000000000001', 'agua', '2026-11-02', 'agua:11:00');
    raise exception 'FALHOU: mandou o mesmo lembrete duas vezes';
  exception when unique_violation then raise notice 'ok - o mesmo horário só uma vez'; end;
end $$;
insert into public.telegram_log (link_id, kind, day) values ('afafafaf-1111-0000-0000-000000000001', 'morning', '2026-11-02');
do $$ begin
  begin insert into public.telegram_log (link_id, kind, day) values ('afafafaf-1111-0000-0000-000000000001', 'morning', '2026-11-02');
    raise exception 'FALHOU: dois bons dias no mesmo dia';
  exception when unique_violation then raise notice 'ok - bom dia continua uma vez por dia'; end;
  begin insert into public.telegram_log (link_id, kind, day) values ('afafafaf-1111-0000-0000-000000000001', 'outro', '2026-11-02');
    raise exception 'FALHOU: aceitou tipo desconhecido';
  exception when check_violation then raise notice 'ok - tipo desconhecido recusado'; end;
end $$;
