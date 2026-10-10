-- Testes da migration 026 (Alimentação): perfil, alimentos próprios e refeições privados por padrão. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('a8a8a8a8-0000-0000-0000-000000000001', 'Casa comida'), ('a8a8a8a8-0000-0000-0000-000000000002', 'Vizinha comida');
insert into auth.users (id, email) values ('a8a8a8a8-eeee-0000-0000-00000000000a', 'gio-comida@teste.com'), ('a8a8a8a8-eeee-0000-0000-00000000000b', 'sabi-comida@teste.com'), ('a8a8a8a8-eeee-0000-0000-00000000000c', 'viz-comida@teste.com');
select public.ninho_link_member('gio-comida@teste.com', 'g', 'a8a8a8a8-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-comida@teste.com', 's', 'a8a8a8a8-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-comida@teste.com', 'g', 'a8a8a8a8-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from pg_policies where tablename in ('personal_food_profile','personal_foods') and policyname in ('personal_read','personal_write')) = 4, 'perfil e alimentos com as regras privadas do Meu dia');

set role authenticated;
select pg_temp.as_user('a8a8a8a8-eeee-0000-0000-00000000000a');
insert into public.personal_food_profile (household_id, who, sex, birth_year, height_cm, activity, goal, pace_kg_week, target_kg)
  values ('a8a8a8a8-0000-0000-0000-000000000001', 'g', 'f', 1992, 165, 'leve', 'perder', 0.5, 60);
insert into public.personal_foods (household_id, who, name, portion, portion_g, kcal, protein) values ('a8a8a8a8-0000-0000-0000-000000000001', 'g', 'Barrinha X', '1 unidade', 30, 110, 10);
insert into public.personal_logs (household_id, who, date, kind, value, data) values ('a8a8a8a8-0000-0000-0000-000000000001', 'g', public.ninho_today(), 'refeicao', 350, '{"meal":"cafe","items":[{"name":"Ovo","g":100,"kcal":146}]}');
insert into public.personal_logs (household_id, who, date, kind, value, data) values ('a8a8a8a8-0000-0000-0000-000000000001', 'g', public.ninho_today(), 'parar', null, '{}');
select pg_temp.ok((select count(*) from public.personal_food_profile) = 1 and (select count(*) from public.personal_foods) = 1 and (select count(*) from public.personal_logs where kind = 'refeicao') = 1, 'a dona cria perfil, alimento e refeição (e "parar" continua aceito)');
do $$ begin
  begin update public.personal_food_profile set height_cm = 400;
    raise exception 'FALHOU: aceitou altura absurda';
  exception when check_violation then raise notice 'ok - valores do perfil conferidos'; end;
  begin insert into public.personal_logs (household_id, who, date, kind) values ('a8a8a8a8-0000-0000-0000-000000000001', 'g', public.ninho_today(), 'dieta');
    raise exception 'FALHOU: aceitou tipo desconhecido';
  exception when check_violation then raise notice 'ok - tipos de registro continuam limitados'; end;
end $$;

select pg_temp.as_user('a8a8a8a8-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_food_profile) = 0 and (select count(*) from public.personal_foods) = 0 and (select count(*) from public.personal_logs where kind = 'refeicao') = 0, 'a outra não vê (não compartilhado)');
do $$ begin
  begin insert into public.personal_foods (household_id, who, name, portion_g, kcal) values ('a8a8a8a8-0000-0000-0000-000000000001', 'g', 'Intrusa', 100, 1);
    raise exception 'FALHOU: criou no Meu dia da outra';
  exception when insufficient_privilege then raise notice 'ok - ninguém cria no Meu dia da outra'; end;
end $$;

select pg_temp.as_user('a8a8a8a8-eeee-0000-0000-00000000000a');
insert into public.personal_settings (household_id, who, share) values ('a8a8a8a8-0000-0000-0000-000000000001', 'g', '{"refeicao":true}')
  on conflict (household_id, who) do update set share = '{"refeicao":true}';
select pg_temp.as_user('a8a8a8a8-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_food_profile) = 1 and (select count(*) from public.personal_logs where kind = 'refeicao') = 1 and (select count(*) from public.personal_logs where kind = 'parar') = 0, 'compartilhar "refeicao" libera só a alimentação');
update public.personal_food_profile set hide_numbers = true;
select pg_temp.as_user('a8a8a8a8-eeee-0000-0000-00000000000a');
select pg_temp.ok((select hide_numbers from public.personal_food_profile) = false, 'a outra não altera');

select pg_temp.as_user('a8a8a8a8-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.personal_food_profile) + (select count(*) from public.personal_foods) = 0, 'outra casa não vê nada');
reset role;
set role anon;
do $$ begin
  begin
    if (select count(*) from public.personal_foods) > 0 then raise exception 'FALHOU: sem login viu'; end if;
    raise notice 'ok - sem login não vê';
  exception when insufficient_privilege then raise notice 'ok - sem login não vê'; end;
end $$;
reset role;
