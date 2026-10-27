-- Testes da migration 041 (Telegram: resumo da noite e tarefas): colunas com os padrões certos,
-- registro aceita os tipos novos e não repete o mesmo lembrete no dia. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

insert into public.households (id, name) values ('c9c9c9c9-0000-0000-0000-0000000000a1', 'Casa noite') on conflict (id) do nothing;
insert into public.telegram_links (id, household_id, who, chat_id, linked_at) values ('c9c9c9c9-1111-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000a1', 'g', 990000001, now()) on conflict (id) do nothing;
select pg_temp.ok((select evening and not tasks from public.telegram_links where id = 'c9c9c9c9-1111-0000-0000-000000000001'), 'resumo da noite ligado e tarefas desligadas por padrão');

insert into public.telegram_log (link_id, kind, day, ref) values ('c9c9c9c9-1111-0000-0000-000000000001', 'noite', '2026-10-26', 'noite');
insert into public.telegram_log (link_id, kind, day, ref) values ('c9c9c9c9-1111-0000-0000-000000000001', 'tarefa', '2026-10-26', 'tarefa:abc');
insert into public.telegram_log (link_id, kind, day, ref) values ('c9c9c9c9-1111-0000-0000-000000000001', 'atraso', '2026-10-26', 'atraso:abc');
select pg_temp.ok((select count(*) from public.telegram_log where link_id = 'c9c9c9c9-1111-0000-0000-000000000001') = 3, 'registro aceita noite, tarefa e atraso');
do $$ begin
  begin insert into public.telegram_log (link_id, kind, day, ref) values ('c9c9c9c9-1111-0000-0000-000000000001', 'noite', '2026-10-26', 'noite');
    raise exception 'FALHOU: repetiu o resumo da noite no mesmo dia';
  exception when unique_violation then raise notice 'ok - mesmo lembrete não repete no dia'; end;
  begin insert into public.telegram_log (link_id, kind, day, ref) values ('c9c9c9c9-1111-0000-0000-000000000001', 'outro', '2026-10-26', 'x');
    raise exception 'FALHOU: aceitou tipo desconhecido';
  exception when check_violation then raise notice 'ok - tipo só da lista'; end;
end $$;
insert into public.telegram_log (link_id, kind, day, ref) values ('c9c9c9c9-1111-0000-0000-000000000001', 'noite', '2026-10-27', 'noite');
select pg_temp.ok(true, 'no dia seguinte o resumo vai de novo');
select pg_temp.ok((select count(*) from pg_constraint where conname = 'telegram_log_kind_check3') = 1, 'regra do tipo trocada uma vez só (mesmo rodando 2x)');
