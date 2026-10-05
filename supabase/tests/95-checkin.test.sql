-- Testes da migration 015 (check-in e registro do dia). Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('6b6b6b6b-0000-0000-0000-000000000001', 'Casa check-in'), ('6b6b6b6b-0000-0000-0000-000000000002', 'Vizinha');
insert into auth.users (id, email) values
  ('6b6b6b6b-eeee-0000-0000-00000000000a', 'gio-ck@teste.com'),
  ('6b6b6b6b-eeee-0000-0000-00000000000b', 'sabi-ck@teste.com'),
  ('6b6b6b6b-eeee-0000-0000-00000000000c', 'vizinha-ck@teste.com');
select public.ninho_link_member('gio-ck@teste.com', 'g', '6b6b6b6b-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-ck@teste.com', 's', '6b6b6b6b-0000-0000-0000-000000000001');
select public.ninho_link_member('vizinha-ck@teste.com', 'g', '6b6b6b6b-0000-0000-0000-000000000002');

set role authenticated;
select pg_temp.as_user('6b6b6b6b-eeee-0000-0000-00000000000a');
select pg_temp.ok((public.ninho_checkin('6b6b6b6b-0000-0000-0000-000000000001', public.ninho_today(), 's', 'bem', 'medium', 'Dia corrido')->>'who') = 'g',
  'check-in grava para quem está logada (não pela outra)');
select public.ninho_checkin('6b6b6b6b-0000-0000-0000-000000000001', public.ninho_today(), 'g', 'cansaco', null, null);
select pg_temp.ok((select mood = 'cansaco' and energy = 'medium' and note = 'Dia corrido' from public.daily_checkins where household_id = '6b6b6b6b-0000-0000-0000-000000000001' and who = 'g'),
  'registrar de novo atualiza só o que veio (energia e texto mantidos)');
select public.ninho_checkin('6b6b6b6b-0000-0000-0000-000000000001', public.ninho_today(), 'g', null, null, '');
select pg_temp.ok((select note is null from public.daily_checkins where household_id = '6b6b6b6b-0000-0000-0000-000000000001' and who = 'g'), 'texto vazio apaga a observação');
select pg_temp.ok((select count(*) from public.daily_checkins where household_id = '6b6b6b6b-0000-0000-0000-000000000001') = 1, 'uma linha por pessoa por dia');
select public.ninho_checkin('6b6b6b6b-0000-0000-0000-000000000001', public.ninho_today() - 1, 'g', 'otimo', 'high', null);
do $$ begin
  begin perform public.ninho_checkin('6b6b6b6b-0000-0000-0000-000000000001', public.ninho_today() - 30, 'g', 'bem', null, null); raise exception 'FALHOU: aceitou data antiga';
  exception when others then if sqlerrm like 'NINHO_INVALID_DATE%' then raise notice 'ok - data fora dos últimos 7 dias é recusada'; else raise; end if; end;
  begin perform public.ninho_checkin('6b6b6b6b-0000-0000-0000-000000000001', public.ninho_today(), 'g', 'feliz', null, null); raise exception 'FALHOU: aceitou humor inválido';
  exception when check_violation then raise notice 'ok - humor fora da lista é recusado'; end;
end $$;
insert into public.household_days (household_id, date, survival) values ('6b6b6b6b-0000-0000-0000-000000000001', public.ninho_today(), true)
  on conflict (household_id, date) do update set survival = true;
select pg_temp.ok((select survival from public.household_days where household_id = '6b6b6b6b-0000-0000-0000-000000000001'), 'dia marcado como sobrevivência');

select pg_temp.as_user('6b6b6b6b-eeee-0000-0000-00000000000b');
select public.ninho_checkin('6b6b6b6b-0000-0000-0000-000000000001', public.ninho_today(), null, 'normal', 'low', null);
select pg_temp.ok((select count(*) from public.daily_checkins where household_id = '6b6b6b6b-0000-0000-0000-000000000001' and date = public.ninho_today()) = 2, 'cada uma tem o seu check-in; as duas veem os dois');

select pg_temp.as_user('6b6b6b6b-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.daily_checkins where household_id = '6b6b6b6b-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.household_days where household_id = '6b6b6b6b-0000-0000-0000-000000000001') = 0, 'outra casa não vê os check-ins nem os dias');
do $$ begin
  begin perform public.ninho_checkin('6b6b6b6b-0000-0000-0000-000000000001', public.ninho_today(), 'g', 'bem', null, null); raise exception 'FALHOU: registrou na casa dos outros';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok - não registra na casa dos outros'; end;
end $$;
reset role;
select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.daily_checkins where household_id = '6b6b6b6b-0000-0000-0000-000000000001') = 3, 'nada gravado pela outra casa');

set role anon;
do $$ begin
  begin perform public.ninho_checkin('6b6b6b6b-0000-0000-0000-000000000001', current_date, 'g', 'bem', null, null); raise exception 'FALHOU: anon registrou';
  exception when insufficient_privilege then raise notice 'ok - sem login não registra'; end;
end $$;
reset role;
