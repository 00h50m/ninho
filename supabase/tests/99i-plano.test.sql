-- Testes da migration 027 (plano alimentar): privado por padrão, um ativo por pessoa. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('a9a9a9a9-0000-0000-0000-000000000001', 'Casa plano'), ('a9a9a9a9-0000-0000-0000-000000000002', 'Vizinha plano');
insert into auth.users (id, email) values ('a9a9a9a9-eeee-0000-0000-00000000000a', 'gio-plano@teste.com'), ('a9a9a9a9-eeee-0000-0000-00000000000b', 'sabi-plano@teste.com'), ('a9a9a9a9-eeee-0000-0000-00000000000c', 'viz-plano@teste.com');
select public.ninho_link_member('gio-plano@teste.com', 'g', 'a9a9a9a9-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-plano@teste.com', 's', 'a9a9a9a9-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-plano@teste.com', 'g', 'a9a9a9a9-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from pg_policies where tablename = 'personal_diet_plans' and policyname in ('personal_read','personal_write')) = 2, 'plano com as regras privadas do Meu dia');

set role authenticated;
select pg_temp.as_user('a9a9a9a9-eeee-0000-0000-00000000000a');
insert into public.personal_diet_plans (household_id, who, title, plan, source) values ('a9a9a9a9-0000-0000-0000-000000000001', 'g', 'Plano 1', '{"meals":[{"id":"m1","name":"Café"}]}', 'dieta.pdf');
select pg_temp.ok((select count(*) from public.personal_diet_plans) = 1, 'a dona salva o plano');
do $$ begin
  begin insert into public.personal_diet_plans (household_id, who, title, plan) values ('a9a9a9a9-0000-0000-0000-000000000001', 'g', 'Plano 2', '{"meals":[]}');
    raise exception 'FALHOU: dois planos ativos';
  exception when unique_violation then raise notice 'ok - um plano ativo por pessoa'; end;
  begin insert into public.personal_diet_plans (household_id, who, title, plan) values ('a9a9a9a9-0000-0000-0000-000000000001', 'g', 'Sem refeições', '{"x":1}');
    raise exception 'FALHOU: aceitou plano sem refeições';
  exception when check_violation then raise notice 'ok - formato do plano conferido'; end;
end $$;
update public.personal_diet_plans set active = false;
insert into public.personal_diet_plans (household_id, who, title, plan) values ('a9a9a9a9-0000-0000-0000-000000000001', 'g', 'Plano 2', '{"meals":[]}');
select pg_temp.ok((select count(*) from public.personal_diet_plans) = 2 and (select count(*) from public.personal_diet_plans where active) = 1, 'trocar de plano guarda o antigo como inativo');

select pg_temp.as_user('a9a9a9a9-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_diet_plans) = 0, 'a outra não vê (não compartilhado)');
do $$ begin
  begin insert into public.personal_diet_plans (household_id, who, title, plan) values ('a9a9a9a9-0000-0000-0000-000000000001', 'g', 'Intrusa', '{"meals":[]}');
    raise exception 'FALHOU: criou no Meu dia da outra';
  exception when insufficient_privilege then raise notice 'ok - ninguém cria no Meu dia da outra'; end;
end $$;
select pg_temp.as_user('a9a9a9a9-eeee-0000-0000-00000000000a');
insert into public.personal_settings (household_id, who, share) values ('a9a9a9a9-0000-0000-0000-000000000001', 'g', '{"refeicao":true}')
  on conflict (household_id, who) do update set share = '{"refeicao":true}';
select pg_temp.as_user('a9a9a9a9-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_diet_plans) = 2, 'compartilhar "refeicao" libera a leitura');
update public.personal_diet_plans set remind = true;
select pg_temp.as_user('a9a9a9a9-eeee-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.personal_diet_plans where remind) = 0, 'a outra não altera');
select pg_temp.as_user('a9a9a9a9-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.personal_diet_plans) = 0, 'outra casa não vê nada');
reset role;
set role anon;
do $$ begin
  begin
    if (select count(*) from public.personal_diet_plans) > 0 then raise exception 'FALHOU: sem login viu'; end if;
    raise notice 'ok - sem login não vê';
  exception when insufficient_privilege then raise notice 'ok - sem login não vê'; end;
end $$;
reset role;
