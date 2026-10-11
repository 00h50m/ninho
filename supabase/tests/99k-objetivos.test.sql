-- Testes da migration 029 (Objetivos): privados, compartilhamento próprio, progresso manual em personal_logs. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('bbbb0000-0000-0000-0000-000000000001', 'Casa obj'), ('bbbb0000-0000-0000-0000-000000000002', 'Vizinha obj');
insert into auth.users (id, email) values ('bbbb0000-eeee-0000-0000-00000000000a', 'gio-obj@teste.com'), ('bbbb0000-eeee-0000-0000-00000000000b', 'sabi-obj@teste.com'), ('bbbb0000-eeee-0000-0000-00000000000c', 'viz-obj@teste.com');
select public.ninho_link_member('gio-obj@teste.com', 'g', 'bbbb0000-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-obj@teste.com', 's', 'bbbb0000-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-obj@teste.com', 'g', 'bbbb0000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from pg_policies where tablename = 'personal_goals' and policyname in ('personal_read','personal_write')) = 2, 'objetivos com as regras privadas do Meu dia');

set role authenticated;
select pg_temp.as_user('bbbb0000-eeee-0000-0000-00000000000a');
insert into public.personal_goals (id, household_id, who, title, kind, start_value, target, due_date) values ('bbbb0000-9999-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 'g', 'Emagrecer', 'peso', 72, 60, public.ninho_today() + 90);
insert into public.personal_goals (id, household_id, who, title, kind, unit, target) values ('bbbb0000-9999-0000-0000-000000000002', 'bbbb0000-0000-0000-0000-000000000001', 'g', 'Ler livros', 'manual', 'livros', 12);
insert into public.personal_logs (household_id, who, date, kind, value, data) values ('bbbb0000-0000-0000-0000-000000000001', 'g', public.ninho_today(), 'objetivo', 1, '{"goal_id":"bbbb0000-9999-0000-0000-000000000002"}');
insert into public.personal_logs (household_id, who, date, kind, value, data) values ('bbbb0000-0000-0000-0000-000000000001', 'g', public.ninho_today(), 'refeicao', 300, '{}');
select pg_temp.ok((select count(*) from public.personal_goals) = 2 and (select count(*) from public.personal_logs where kind = 'objetivo') = 1, 'a dona cria objetivos e soma progresso (e refeição continua aceita)');
do $$ begin
  begin insert into public.personal_goals (household_id, who, title, kind, target) values ('bbbb0000-0000-0000-0000-000000000001', 'g', 'X', 'dinheiro', 10);
    raise exception 'FALHOU: aceitou tipo desconhecido';
  exception when check_violation then raise notice 'ok - tipo de objetivo conferido'; end;
  begin insert into public.personal_goals (household_id, who, title, kind, target, start_date, due_date) values ('bbbb0000-0000-0000-0000-000000000001', 'g', 'X', 'treinos', 10, public.ninho_today(), public.ninho_today() - 1);
    raise exception 'FALHOU: aceitou prazo antes do começo';
  exception when check_violation then raise notice 'ok - prazo depois do começo'; end;
end $$;

select pg_temp.as_user('bbbb0000-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_goals) = 0 and (select count(*) from public.personal_logs where kind = 'objetivo') = 0, 'a outra não vê (não compartilhado)');
select pg_temp.as_user('bbbb0000-eeee-0000-0000-00000000000a');
insert into public.personal_settings (household_id, who, share) values ('bbbb0000-0000-0000-0000-000000000001', 'g', '{"corpo":true}')
  on conflict (household_id, who) do update set share = '{"corpo":true}';
select pg_temp.as_user('bbbb0000-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_goals) = 0, 'compartilhar "Evolução física" não libera os objetivos');
select pg_temp.as_user('bbbb0000-eeee-0000-0000-00000000000a');
update public.personal_settings set share = '{"objetivo":true}' where household_id = 'bbbb0000-0000-0000-0000-000000000001' and who = 'g';
select pg_temp.as_user('bbbb0000-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_goals) = 2 and (select count(*) from public.personal_logs where kind = 'objetivo') = 1, 'compartilhar "objetivo" libera objetivos e progresso');
update public.personal_goals set status = 'arquivado';
do $$ begin
  begin insert into public.personal_goals (household_id, who, title, kind, target) values ('bbbb0000-0000-0000-0000-000000000001', 'g', 'Intrusa', 'manual', 1);
    raise exception 'FALHOU: criou no Meu dia da outra';
  exception when insufficient_privilege then raise notice 'ok - ninguém cria no Meu dia da outra'; end;
end $$;
select pg_temp.as_user('bbbb0000-eeee-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.personal_goals where status = 'ativo') = 2, 'a outra não altera');
select pg_temp.as_user('bbbb0000-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.personal_goals) = 0, 'outra casa não vê nada');
reset role;
set role anon;
do $$ begin
  begin
    if (select count(*) from public.personal_goals) > 0 then raise exception 'FALHOU: sem login viu'; end if;
    raise notice 'ok - sem login não vê';
  exception when insufficient_privilege then raise notice 'ok - sem login não vê'; end;
end $$;
reset role;
