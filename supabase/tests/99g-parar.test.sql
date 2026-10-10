-- Testes da migration 025 ("Parar de…"): privado por padrão, recaída como registro. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('a7a7a7a7-0000-0000-0000-000000000001', 'Casa parar'), ('a7a7a7a7-0000-0000-0000-000000000002', 'Vizinha parar');
insert into auth.users (id, email) values ('a7a7a7a7-eeee-0000-0000-00000000000a', 'gio-parar@teste.com'), ('a7a7a7a7-eeee-0000-0000-00000000000b', 'sabi-parar@teste.com'), ('a7a7a7a7-eeee-0000-0000-00000000000c', 'viz-parar@teste.com');
select public.ninho_link_member('gio-parar@teste.com', 'g', 'a7a7a7a7-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-parar@teste.com', 's', 'a7a7a7a7-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-parar@teste.com', 'g', 'a7a7a7a7-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from pg_policies where tablename = 'personal_quits' and policyname in ('personal_read','personal_write')) = 2, '"Parar de…" com as regras privadas do Meu dia');

set role authenticated;
select pg_temp.as_user('a7a7a7a7-eeee-0000-0000-00000000000a');
insert into public.personal_quits (id, household_id, who, title, reason, started_on) values ('a7a7a7a7-9999-0000-0000-000000000001', 'a7a7a7a7-0000-0000-0000-000000000001', 'g', 'Refrigerante', 'Dormir melhor', public.ninho_today() - 10);
insert into public.personal_logs (household_id, who, date, kind, data) values ('a7a7a7a7-0000-0000-0000-000000000001', 'g', public.ninho_today() - 3, 'parar', '{"quit_id":"a7a7a7a7-9999-0000-0000-000000000001","note":"festa"}');
select pg_temp.ok((select count(*) from public.personal_quits) = 1 and (select count(*) from public.personal_logs where kind = 'parar') = 1, 'a dona cria e registra recaída');
do $$ begin
  begin insert into public.personal_logs (household_id, who, date, kind) values ('a7a7a7a7-0000-0000-0000-000000000001', 'g', public.ninho_today(), 'dieta');
    raise exception 'FALHOU: aceitou tipo desconhecido';
  exception when check_violation then raise notice 'ok - tipos de registro continuam limitados'; end;
end $$;

select pg_temp.as_user('a7a7a7a7-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_quits) = 0 and (select count(*) from public.personal_logs where kind = 'parar') = 0, 'a outra não vê (não compartilhado)');
do $$ begin
  begin insert into public.personal_quits (household_id, who, title) values ('a7a7a7a7-0000-0000-0000-000000000001', 'g', 'Intrusa');
    raise exception 'FALHOU: criou no Meu dia da outra';
  exception when insufficient_privilege then raise notice 'ok - ninguém cria no Meu dia da outra'; end;
end $$;

select pg_temp.as_user('a7a7a7a7-eeee-0000-0000-00000000000a');
insert into public.personal_settings (household_id, who, share) values ('a7a7a7a7-0000-0000-0000-000000000001', 'g', '{"parar":true}')
  on conflict (household_id, who) do update set share = '{"parar":true}';
select pg_temp.as_user('a7a7a7a7-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_quits) = 1 and (select count(*) from public.personal_logs where kind = 'parar') = 1, 'compartilhar "parar" libera na hora');
update public.personal_quits set active = false;
select pg_temp.as_user('a7a7a7a7-eeee-0000-0000-00000000000a');
select pg_temp.ok((select active from public.personal_quits) = true, 'a outra não altera');

select pg_temp.as_user('a7a7a7a7-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.personal_quits) = 0, 'outra casa não vê nada');
reset role;
set role anon;
do $$ begin
  begin
    if (select count(*) from public.personal_quits) > 0 then raise exception 'FALHOU: sem login viu'; end if;
    raise notice 'ok - sem login não vê';
  exception when insufficient_privilege then raise notice 'ok - sem login não vê'; end;
end $$;
reset role;
