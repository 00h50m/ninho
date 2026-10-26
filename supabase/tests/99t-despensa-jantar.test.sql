-- Testes da migration 038 (despensa e jantar das duas): da casa (as duas veem e editam), um jantar
-- por dia, valores conferidos, outra casa não vê. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

select pg_temp.ok((select count(*) from pg_policies where tablename in ('pantry_items','house_meals') and policyname = 'household_member') = 2, 'despensa e jantar com a regra da casa');

insert into public.households (id, name) values ('e7e7e7e7-0000-0000-0000-0000000000a1', 'Casa despensa'), ('e7e7e7e7-0000-0000-0000-0000000000a2', 'Vizinha despensa') on conflict (id) do nothing;
insert into auth.users (id, email) values ('e7e7e7e7-eeee-0000-0000-00000000000a', 'gio-dsp@teste.com'), ('e7e7e7e7-eeee-0000-0000-00000000000b', 'sabi-dsp@teste.com'), ('e7e7e7e7-eeee-0000-0000-00000000000c', 'viz-dsp@teste.com') on conflict (id) do nothing;
select public.ninho_link_member('gio-dsp@teste.com', 'g', 'e7e7e7e7-0000-0000-0000-0000000000a1');
select public.ninho_link_member('sabi-dsp@teste.com', 's', 'e7e7e7e7-0000-0000-0000-0000000000a1');
select public.ninho_link_member('viz-dsp@teste.com', 'g', 'e7e7e7e7-0000-0000-0000-0000000000a2');

set role authenticated;
select pg_temp.as_user('e7e7e7e7-eeee-0000-0000-00000000000a');
insert into public.pantry_items (household_id, name, place, qty, expires_on, created_by) values ('e7e7e7e7-0000-0000-0000-0000000000a1', 'Iogurte', 'geladeira', '2 potes', '2026-11-01', 'g');
insert into public.house_meals (household_id, date, title, cook, ingredients) values ('e7e7e7e7-0000-0000-0000-0000000000a1', '2026-11-02', 'Escondidinho', 's', '[{"title":"Batata","qty":"1 kg"}]');
select pg_temp.ok((select count(*) from public.pantry_items) = 1 and (select meal from public.house_meals) = 'jantar', 'guarda item e planeja o jantar');
do $$ begin
  begin insert into public.house_meals (household_id, date, title) values ('e7e7e7e7-0000-0000-0000-0000000000a1', '2026-11-02', 'Outro');
    raise exception 'FALHOU: dois jantares no mesmo dia';
  exception when unique_violation then raise notice 'ok - um jantar por dia'; end;
  begin insert into public.pantry_items (household_id, name, place) values ('e7e7e7e7-0000-0000-0000-0000000000a1', 'X', 'porao');
    raise exception 'FALHOU: aceitou lugar desconhecido';
  exception when check_violation then raise notice 'ok - lugar conferido'; end;
  begin insert into public.house_meals (household_id, date, title, cook) values ('e7e7e7e7-0000-0000-0000-0000000000a1', '2026-11-03', 'Y', 'x');
    raise exception 'FALHOU: aceitou cozinheira desconhecida';
  exception when check_violation then raise notice 'ok - quem cozinha conferido'; end;
  begin insert into public.house_meals (household_id, date, title, ingredients) values ('e7e7e7e7-0000-0000-0000-0000000000a1', '2026-11-04', 'Z', '{}');
    raise exception 'FALHOU: aceitou ingredientes fora do formato';
  exception when check_violation then raise notice 'ok - ingredientes são uma lista'; end;
end $$;
select pg_temp.as_user('e7e7e7e7-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.pantry_items) = 1 and (select count(*) from public.house_meals) = 1, 'a outra da casa vê a despensa e o jantar');
update public.pantry_items set active = false;
select pg_temp.ok((select count(*) from public.pantry_items where active) = 0, 'a outra da casa edita (acabou)');
select pg_temp.as_user('e7e7e7e7-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.pantry_items) = 0 and (select count(*) from public.house_meals) = 0, 'outra casa não vê nada');
do $$ begin
  begin insert into public.house_meals (household_id, date, title) values ('e7e7e7e7-0000-0000-0000-0000000000a1', '2026-11-05', 'Intrusa');
    raise exception 'FALHOU: outra casa gravou';
  exception when insufficient_privilege then raise notice 'ok - outra casa não grava'; end;
end $$;
reset role;
