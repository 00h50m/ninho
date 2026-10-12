-- Testes da migration 031 (refeições salvas): privado por padrão, formato conferido. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('acacacac-0000-0000-0000-000000000001', 'Casa fav'), ('acacacac-0000-0000-0000-000000000002', 'Vizinha fav');
insert into auth.users (id, email) values ('acacacac-eeee-0000-0000-00000000000a', 'gio-fav@teste.com'), ('acacacac-eeee-0000-0000-00000000000b', 'sabi-fav@teste.com'), ('acacacac-eeee-0000-0000-00000000000c', 'viz-fav@teste.com');
select public.ninho_link_member('gio-fav@teste.com', 'g', 'acacacac-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-fav@teste.com', 's', 'acacacac-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-fav@teste.com', 'g', 'acacacac-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from pg_policies where tablename = 'personal_saved_meals' and policyname in ('personal_read','personal_write')) = 2, 'refeições salvas com as regras privadas do Meu dia');

set role authenticated;
select pg_temp.as_user('acacacac-eeee-0000-0000-00000000000a');
insert into public.personal_saved_meals (household_id, who, name, items, kcal) values ('acacacac-0000-0000-0000-000000000001', 'g', 'Café de sempre', '[{"name":"Pão francês","kcal":150},{"name":"Ovo","kcal":143}]', 293);
select pg_temp.ok((select count(*) from public.personal_saved_meals) = 1, 'a dona salva a refeição');
do $$ begin
  begin insert into public.personal_saved_meals (household_id, who, name, items, kcal) values ('acacacac-0000-0000-0000-000000000001', 'g', 'Vazia', '[]', 0);
    raise exception 'FALHOU: aceitou refeição sem itens';
  exception when check_violation then raise notice 'ok - refeição precisa de itens'; end;
  begin insert into public.personal_saved_meals (household_id, who, name, items, kcal) values ('acacacac-0000-0000-0000-000000000001', 'g', 'Objeto', '{"a":1}', 10);
    raise exception 'FALHOU: aceitou itens fora de lista';
  exception when check_violation then raise notice 'ok - itens precisam ser uma lista'; end;
end $$;
update public.personal_saved_meals set uses = uses + 1;
select pg_temp.ok((select uses from public.personal_saved_meals) = 1, 'contar os usos');

select pg_temp.as_user('acacacac-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_saved_meals) = 0, 'a outra não vê (não compartilhado)');
do $$ begin
  begin insert into public.personal_saved_meals (household_id, who, name, items, kcal) values ('acacacac-0000-0000-0000-000000000001', 'g', 'Intrusa', '[{"name":"x"}]', 1);
    raise exception 'FALHOU: criou no Meu dia da outra';
  exception when insufficient_privilege then raise notice 'ok - ninguém cria no Meu dia da outra'; end;
end $$;
select pg_temp.as_user('acacacac-eeee-0000-0000-00000000000a');
insert into public.personal_settings (household_id, who, share) values ('acacacac-0000-0000-0000-000000000001', 'g', '{"refeicao":true}')
  on conflict (household_id, who) do update set share = '{"refeicao":true}';
select pg_temp.as_user('acacacac-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_saved_meals) = 1, 'compartilhar "refeicao" libera a leitura');
update public.personal_saved_meals set name = 'Mudei';
select pg_temp.as_user('acacacac-eeee-0000-0000-00000000000a');
select pg_temp.ok((select name from public.personal_saved_meals) = 'Café de sempre', 'a outra não altera');
select pg_temp.as_user('acacacac-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.personal_saved_meals) = 0, 'outra casa não vê nada');
reset role;
set role anon;
do $$ begin
  begin
    if (select count(*) from public.personal_saved_meals) > 0 then raise exception 'FALHOU: sem login viu'; end if;
    raise notice 'ok - sem login não vê';
  exception when insufficient_privilege then raise notice 'ok - sem login não vê'; end;
end $$;
reset role;
