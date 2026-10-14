-- Testes da migration 035 (receitas e agenda no celular): receitas privadas como o Meu dia, formato conferido,
-- e o segredo da agenda só visível para a casa. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

select pg_temp.ok((select count(*) from pg_policies where tablename = 'personal_recipes' and policyname in ('personal_read','personal_write')) = 2, 'receitas com as regras privadas do Meu dia');
select pg_temp.ok((select count(*) from pg_constraint where conname = 'households_ics_token_len') = 1, 'segredo da agenda com tamanho conferido (uma regra só, mesmo rodando 2x)');
select pg_temp.ok((select count(*) from public.households where ics_token is not null) = 0, 'agenda no celular começa desligada');

insert into public.households (id, name) values ('b7b7b7b7-0000-0000-0000-0000000000a1', 'Casa receitas'), ('b7b7b7b7-0000-0000-0000-0000000000a2', 'Vizinha receitas') on conflict (id) do nothing;
insert into auth.users (id, email) values ('b7b7b7b7-eeee-0000-0000-00000000000a', 'gio-rec@teste.com'), ('b7b7b7b7-eeee-0000-0000-00000000000b', 'sabi-rec@teste.com'), ('b7b7b7b7-eeee-0000-0000-00000000000c', 'viz-rec@teste.com') on conflict (id) do nothing;
select public.ninho_link_member('gio-rec@teste.com', 'g', 'b7b7b7b7-0000-0000-0000-0000000000a1');
select public.ninho_link_member('sabi-rec@teste.com', 's', 'b7b7b7b7-0000-0000-0000-0000000000a1');
select public.ninho_link_member('viz-rec@teste.com', 'g', 'b7b7b7b7-0000-0000-0000-0000000000a2');
update public.households set ics_token = repeat('a1', 20) where id = 'b7b7b7b7-0000-0000-0000-0000000000a1';

set role authenticated;
select pg_temp.as_user('b7b7b7b7-eeee-0000-0000-00000000000a');
insert into public.personal_recipes (household_id, who, name, servings, items, kcal) values ('b7b7b7b7-0000-0000-0000-0000000000a1', 'g', 'Escondidinho', 4, '[{"name":"Batata","g":600,"kcal":460}]', 1200);
select pg_temp.ok((select count(*) from public.personal_recipes) = 1, 'a dona salva a receita');
do $$ begin
  begin insert into public.personal_recipes (household_id, who, name, servings, items, kcal) values ('b7b7b7b7-0000-0000-0000-0000000000a1', 'g', 'Vazia', 1, '[]', 0);
    raise exception 'FALHOU: aceitou receita sem ingrediente';
  exception when check_violation then raise notice 'ok - receita precisa de ingrediente'; end;
  begin insert into public.personal_recipes (household_id, who, name, servings, items, kcal) values ('b7b7b7b7-0000-0000-0000-0000000000a1', 'g', 'Zero', 0, '[{"name":"x"}]', 0);
    raise exception 'FALHOU: aceitou 0 porções';
  exception when check_violation then raise notice 'ok - rende pelo menos uma fração de porção'; end;
end $$;
select pg_temp.ok((select ics_token from public.households where id = 'b7b7b7b7-0000-0000-0000-0000000000a1') = repeat('a1', 20), 'a casa vê o próprio link da agenda');
do $$ begin
  begin update public.households set ics_token = 'curto' where id = 'b7b7b7b7-0000-0000-0000-0000000000a1';
    raise exception 'FALHOU: aceitou segredo curto';
  exception when check_violation then raise notice 'ok - segredo curto recusado'; end;
end $$;

select pg_temp.as_user('b7b7b7b7-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_recipes) = 0, 'a outra não vê (não compartilhado)');
do $$ begin
  begin insert into public.personal_recipes (household_id, who, name, servings, items, kcal) values ('b7b7b7b7-0000-0000-0000-0000000000a1', 'g', 'Intrusa', 1, '[{"name":"x"}]', 1);
    raise exception 'FALHOU: criou receita da outra';
  exception when insufficient_privilege then raise notice 'ok - ninguém cria receita da outra'; end;
end $$;
select pg_temp.as_user('b7b7b7b7-eeee-0000-0000-00000000000a');
insert into public.personal_settings (household_id, who, share) values ('b7b7b7b7-0000-0000-0000-0000000000a1', 'g', '{"refeicao":true}')
  on conflict (household_id, who) do update set share = '{"refeicao":true}';
select pg_temp.as_user('b7b7b7b7-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_recipes) = 1, 'compartilhar "refeicao" libera a leitura');
update public.personal_recipes set name = 'Mudei';
select pg_temp.as_user('b7b7b7b7-eeee-0000-0000-00000000000a');
select pg_temp.ok((select name from public.personal_recipes) = 'Escondidinho', 'a outra não altera');
select pg_temp.as_user('b7b7b7b7-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.personal_recipes) = 0, 'outra casa não vê receitas');
select pg_temp.ok((select count(*) from public.households where ics_token is not null) = 0, 'outra casa não vê o link da agenda');
reset role;
set role anon;
do $$ begin
  begin
    if (select count(*) from public.personal_recipes) > 0 then raise exception 'FALHOU: sem login viu'; end if;
    raise notice 'ok - sem login não vê';
  exception when insufficient_privilege then raise notice 'ok - sem login não vê'; end;
end $$;
reset role;
