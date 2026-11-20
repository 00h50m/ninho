-- Testes da migration 047 (cadastro e convite): criar a casa (uma por conta, sem IA/Sobrou, de 1 pessoa),
-- convidar (só quem é da casa, só com vaga), ver o convite antes de entrar, aceitar (uma vez, no prazo).
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.como(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false) $$;

insert into auth.users (id, email) values
  ('c9c9c9c9-7777-0000-0000-000000000001', 'ana@cadastro.test'),
  ('c9c9c9c9-7777-0000-0000-000000000002', 'bia@cadastro.test'),
  ('c9c9c9c9-7777-0000-0000-000000000003', 'caio@cadastro.test')
on conflict do nothing;

-- Ana cria a casa
select pg_temp.como('c9c9c9c9-7777-0000-0000-000000000001');
set role authenticated;
create temp table if not exists t_casa (id uuid);
grant all on t_casa to authenticated;
insert into t_casa select public.ninho_create_household('Casa da Ana', 'Ana');
reset role;
select pg_temp.ok((select who from public.household_members where user_id = 'c9c9c9c9-7777-0000-0000-000000000001') = 'g', 'quem cria entra como a primeira pessoa');
select pg_temp.ok((select features from public.households where id = (select id from t_casa)) = '{"solo": true}', 'casa nova: de 1 pessoa, sem IA e sem Sobrou');
select pg_temp.ok((select display_name from public.profiles where id = 'c9c9c9c9-7777-0000-0000-000000000001') = 'Ana', 'o nome dela já fica no perfil');
set role authenticated;
do $$ begin
  perform public.ninho_create_household('Outra', 'Ana');
  raise exception 'FALHOU: criou duas casas para a mesma conta';
exception when invalid_parameter_value then raise notice 'ok - uma casa por conta'; end $$;

-- Caio (sem casa) não convida para a casa da Ana
reset role; select pg_temp.como('c9c9c9c9-7777-0000-0000-000000000003'); set role authenticated;
do $$ begin
  perform public.ninho_create_invite((select id from t_casa));
  raise exception 'FALHOU: quem não é da casa convidou';
exception when insufficient_privilege then raise notice 'ok - só quem é da casa convida'; end $$;

-- Ana convida; o convite mostra só o nome da casa e de quem convidou
reset role; select pg_temp.como('c9c9c9c9-7777-0000-0000-000000000001'); set role authenticated;
create temp table if not exists t_conv (code text);
grant all on t_conv to authenticated, anon;
insert into t_conv select public.ninho_create_invite((select id from t_casa));
select pg_temp.ok(length((select code from t_conv)) = 32, 'convite com código de 32 caracteres');
do $$ begin
  perform 1 from public.household_invites;
  raise exception 'FALHOU: o app leu a tabela de convites';
exception when insufficient_privilege then raise notice 'ok - o app não lê a tabela de convites'; end $$;
reset role; set role anon;
select pg_temp.ok(public.ninho_invite_info((select code from t_conv)) = '{"house": "Casa da Ana", "from": "Ana"}', 'antes de entrar: só o nome da casa e de quem convidou');
select pg_temp.ok(public.ninho_invite_info('codigoqualquer123456') is null, 'código errado: nada');
reset role;

-- Bia aceita
select pg_temp.como('c9c9c9c9-7777-0000-0000-000000000002'); set role authenticated;
select pg_temp.ok(public.ninho_accept_invite((select code from t_conv), 'Bia') = (select id from t_casa), 'Bia entra na casa da Ana');
reset role;
select pg_temp.ok((select who from public.household_members where user_id = 'c9c9c9c9-7777-0000-0000-000000000002') = 's', 'como a segunda pessoa');
select pg_temp.ok((select features->>'solo' from public.households where id = (select id from t_casa)) = 'false', 'a casa deixa de ser de 1 pessoa');

-- o convite não vale de novo; casa cheia não convida
select pg_temp.como('c9c9c9c9-7777-0000-0000-000000000003'); set role authenticated;
do $$ begin
  perform public.ninho_accept_invite((select code from t_conv), 'Caio');
  raise exception 'FALHOU: convite usado duas vezes';
exception when no_data_found then raise notice 'ok - convite vale uma vez'; end $$;
reset role; select pg_temp.como('c9c9c9c9-7777-0000-0000-000000000001'); set role authenticated;
do $$ begin
  perform public.ninho_create_invite((select id from t_casa));
  raise exception 'FALHOU: convidou com a casa cheia';
exception when invalid_parameter_value then raise notice 'ok - casa com duas pessoas não convida'; end $$;
reset role;

-- convite vencido não vale
delete from public.household_members where user_id = 'c9c9c9c9-7777-0000-0000-000000000002';
select pg_temp.como('c9c9c9c9-7777-0000-0000-000000000001'); set role authenticated;
delete from t_conv; insert into t_conv select public.ninho_create_invite((select id from t_casa));
reset role;
update public.household_invites set expires_at = now() - interval '1 minute' where code = (select code from t_conv);
select pg_temp.como('c9c9c9c9-7777-0000-0000-000000000003'); set role authenticated;
do $$ begin
  perform public.ninho_accept_invite((select code from t_conv), 'Caio');
  raise exception 'FALHOU: aceitou convite vencido';
exception when no_data_found then raise notice 'ok - convite vencido não vale'; end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false);
delete from public.profiles where household_id = (select id from t_casa);
delete from public.households where id = (select id from t_casa);
delete from auth.users where id::text like 'c9c9c9c9-7777-%';
