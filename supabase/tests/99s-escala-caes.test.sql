-- Testes da migration 037 (escala fixa dos cães): rodízio por padrão, um turno por dia e período,
-- valores conferidos, a casa vê e edita, outra casa não. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

select pg_temp.ok((select column_default from information_schema.columns where table_name = 'households' and column_name = 'dog_mode') like '''rodizio''%', 'casas começam no rodízio');
select pg_temp.ok((select count(*) from pg_constraint where conname = 'households_dog_mode_check') = 1, 'modo conferido (uma regra só, mesmo rodando 2x)');

insert into public.households (id, name) values ('d7d7d7d7-0000-0000-0000-0000000000a1', 'Casa escala'), ('d7d7d7d7-0000-0000-0000-0000000000a2', 'Vizinha escala') on conflict (id) do nothing;
insert into auth.users (id, email) values ('d7d7d7d7-eeee-0000-0000-00000000000a', 'gio-esc@teste.com'), ('d7d7d7d7-eeee-0000-0000-00000000000b', 'sabi-esc@teste.com'), ('d7d7d7d7-eeee-0000-0000-00000000000c', 'viz-esc@teste.com') on conflict (id) do nothing;
select public.ninho_link_member('gio-esc@teste.com', 'g', 'd7d7d7d7-0000-0000-0000-0000000000a1');
select public.ninho_link_member('sabi-esc@teste.com', 's', 'd7d7d7d7-0000-0000-0000-0000000000a1');
select public.ninho_link_member('viz-esc@teste.com', 'g', 'd7d7d7d7-0000-0000-0000-0000000000a2');

set role authenticated;
select pg_temp.as_user('d7d7d7d7-eeee-0000-0000-00000000000a');
update public.households set dog_mode = 'escala' where id = 'd7d7d7d7-0000-0000-0000-0000000000a1';
insert into public.dog_schedule (household_id, dow, period, who) values ('d7d7d7d7-0000-0000-0000-0000000000a1', 1, 'manha', 'g'), ('d7d7d7d7-0000-0000-0000-0000000000a1', 1, 'noite', 's');
select pg_temp.ok((select count(*) from public.dog_schedule) = 2, 'a casa monta a escala');
do $$ begin
  begin insert into public.dog_schedule (household_id, dow, period, who) values ('d7d7d7d7-0000-0000-0000-0000000000a1', 1, 'manha', 's');
    raise exception 'FALHOU: dois donos no mesmo turno';
  exception when unique_violation then raise notice 'ok - um turno por dia e período'; end;
  begin insert into public.dog_schedule (household_id, dow, period, who) values ('d7d7d7d7-0000-0000-0000-0000000000a1', 7, 'manha', 'g');
    raise exception 'FALHOU: aceitou dia 7';
  exception when check_violation then raise notice 'ok - dia da semana de 0 a 6'; end;
  begin insert into public.dog_schedule (household_id, dow, period, who) values ('d7d7d7d7-0000-0000-0000-0000000000a1', 2, 'madrugada', 'g');
    raise exception 'FALHOU: aceitou período desconhecido';
  exception when check_violation then raise notice 'ok - período só manhã, tarde ou noite'; end;
  begin update public.households set dog_mode = 'outro' where id = 'd7d7d7d7-0000-0000-0000-0000000000a1';
    raise exception 'FALHOU: aceitou modo desconhecido';
  exception when check_violation then raise notice 'ok - modo só rodízio ou escala'; end;
end $$;
select pg_temp.as_user('d7d7d7d7-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.dog_schedule) = 2, 'a outra da casa vê a escala');
update public.dog_schedule set who = 's' where dow = 1 and period = 'manha';
select pg_temp.ok((select who from public.dog_schedule where dow = 1 and period = 'manha') = 's', 'a outra da casa edita a escala');
select pg_temp.as_user('d7d7d7d7-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.dog_schedule) = 0, 'outra casa não vê a escala');
do $$ begin
  begin insert into public.dog_schedule (household_id, dow, period, who) values ('d7d7d7d7-0000-0000-0000-0000000000a1', 3, 'tarde', 'g');
    raise exception 'FALHOU: outra casa gravou';
  exception when insufficient_privilege then raise notice 'ok - outra casa não grava'; end;
end $$;
reset role;
