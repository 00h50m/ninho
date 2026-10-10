-- Testes da migration 024 (Telegram em texto livre): pendências só para o servidor.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

insert into public.households (id, name) values ('f4f4f4f4-0000-0000-0000-000000000001', 'Casa telegram');
insert into public.telegram_links (id, household_id, who, chat_id, active) values ('f4f4f4f4-1111-0000-0000-000000000001', 'f4f4f4f4-0000-0000-0000-000000000001', 'g', 777001, true);
set role service_role;
insert into public.telegram_pending (id, link_id, household_id, actions)
values ('f4f4f4f4-2222-0000-0000-000000000001', 'f4f4f4f4-1111-0000-0000-000000000001', 'f4f4f4f4-0000-0000-0000-000000000001', '[{"type":"agua","ml":300}]');
select pg_temp.ok((select status from public.telegram_pending) = 'open', 'o servidor guarda a pendência');
do $$ begin
  begin insert into public.telegram_pending (link_id, household_id, actions) values ('f4f4f4f4-1111-0000-0000-000000000001', 'f4f4f4f4-0000-0000-0000-000000000001', '[]');
    raise exception 'FALHOU: aceitou lista vazia';
  exception when check_violation then raise notice 'ok - pendência precisa ter de 1 a 12 ações'; end;
end $$;
reset role;
set role authenticated;
do $$ begin
  begin perform count(*) from public.telegram_pending; raise exception 'FALHOU: o app leu as pendências';
  exception when insufficient_privilege then raise notice 'ok - o app (logado) não lê as pendências'; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin insert into public.telegram_pending (link_id, household_id, actions) values ('f4f4f4f4-1111-0000-0000-000000000001', 'f4f4f4f4-0000-0000-0000-000000000001', '[{"type":"agua","ml":1}]');
    raise exception 'FALHOU: sem login gravou pendência';
  exception when insufficient_privilege then raise notice 'ok - sem login não grava'; end;
end $$;
reset role;
delete from public.telegram_links where id = 'f4f4f4f4-1111-0000-0000-000000000001';
select pg_temp.ok((select count(*) from public.telegram_pending) = 0, 'desligar a conversa apaga as pendências');
