-- Testes da migration 033 (cardápio da semana e meta de proteína): privado por padrão, formato conferido. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

select pg_temp.ok((select count(*) from pg_policies where tablename = 'personal_menus' and policyname in ('personal_read','personal_write')) = 2, 'cardápio com as regras privadas do Meu dia');
select pg_temp.ok((select count(*) from pg_constraint where conname = 'personal_food_profile_protein_g_kg') = 1, 'meta de proteína com limite (uma regra só, mesmo rodando 2x)');

insert into public.households (id, name) values ('aeaeaeae-0000-0000-0000-000000000001', 'Casa cardápio'), ('aeaeaeae-0000-0000-0000-000000000002', 'Vizinha cardápio');
insert into auth.users (id, email) values ('aeaeaeae-eeee-0000-0000-00000000000a', 'gio-card@teste.com'), ('aeaeaeae-eeee-0000-0000-00000000000b', 'sabi-card@teste.com'), ('aeaeaeae-eeee-0000-0000-00000000000c', 'viz-card@teste.com');
select public.ninho_link_member('gio-card@teste.com', 'g', 'aeaeaeae-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-card@teste.com', 's', 'aeaeaeae-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-card@teste.com', 'g', 'aeaeaeae-0000-0000-0000-000000000002');

set role authenticated;
select pg_temp.as_user('aeaeaeae-eeee-0000-0000-00000000000a');
insert into public.personal_menus (household_id, who, week_start, menu) values ('aeaeaeae-0000-0000-0000-000000000001', 'g', '2026-11-02', '{"days":[],"note":null}');
select pg_temp.ok((select count(*) from public.personal_menus) = 1, 'a dona salva o cardápio');
do $$ begin
  begin insert into public.personal_menus (household_id, who, week_start, menu) values ('aeaeaeae-0000-0000-0000-000000000001', 'g', '2026-11-02', '[]');
    raise exception 'FALHOU: aceitou cardápio fora do formato';
  exception when check_violation then raise notice 'ok - cardápio precisa ser um objeto'; end;
end $$;
insert into public.personal_food_profile (household_id, who, sex, birth_year, height_cm, activity, goal, pace_kg_week, protein_g_kg) values ('aeaeaeae-0000-0000-0000-000000000001', 'g', 'f', 1994, 165, 'leve', 'perder', 0.5, 1.6);
select pg_temp.ok((select protein_g_kg from public.personal_food_profile where who = 'g') = 1.6, 'meta de proteína gravada');
do $$ begin
  begin update public.personal_food_profile set protein_g_kg = 5 where who = 'g';
    raise exception 'FALHOU: aceitou 5 g/kg';
  exception when check_violation then raise notice 'ok - proteína entre 0,5 e 3 g/kg'; end;
end $$;

select pg_temp.as_user('aeaeaeae-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_menus) = 0, 'a outra não vê (não compartilhado)');
do $$ begin
  begin insert into public.personal_menus (household_id, who, week_start, menu) values ('aeaeaeae-0000-0000-0000-000000000001', 'g', '2026-11-02', '{}');
    raise exception 'FALHOU: criou no Meu dia da outra';
  exception when insufficient_privilege then raise notice 'ok - ninguém cria no Meu dia da outra'; end;
end $$;
select pg_temp.as_user('aeaeaeae-eeee-0000-0000-00000000000a');
insert into public.personal_settings (household_id, who, share) values ('aeaeaeae-0000-0000-0000-000000000001', 'g', '{"refeicao":true}')
  on conflict (household_id, who) do update set share = '{"refeicao":true}';
select pg_temp.as_user('aeaeaeae-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_menus) = 1, 'compartilhar "refeicao" libera a leitura');
update public.personal_menus set active = false;
select pg_temp.as_user('aeaeaeae-eeee-0000-0000-00000000000a');
select pg_temp.ok((select active from public.personal_menus), 'a outra não altera');
select pg_temp.as_user('aeaeaeae-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.personal_menus) = 0, 'outra casa não vê nada');
reset role;
set role anon;
do $$ begin
  begin
    if (select count(*) from public.personal_menus) > 0 then raise exception 'FALHOU: sem login viu'; end if;
    raise notice 'ok - sem login não vê';
  exception when insufficient_privilege then raise notice 'ok - sem login não vê'; end;
end $$;
reset role;
