-- Testes da migration 020 (Cães: perfil, saúde e filhote). Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('afafafaf-0000-0000-0000-000000000001', 'Casa cães'), ('afafafaf-0000-0000-0000-000000000002', 'Vizinha');
insert into auth.users (id, email) values ('afafafaf-eeee-0000-0000-00000000000a', 'gio-dg@teste.com'), ('afafafaf-eeee-0000-0000-00000000000c', 'viz-dg@teste.com');
select public.ninho_link_member('gio-dg@teste.com', 'g', 'afafafaf-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-dg@teste.com', 'g', 'afafafaf-0000-0000-0000-000000000002');
insert into public.dogs (id, household_id, name, is_puppy, active) values ('afafafaf-dddd-0000-0000-000000000001', 'afafafaf-0000-0000-0000-000000000001', 'Zelda', true, true);
insert into public.dog_routines (id, dog_id, household_id, title, frequency) values ('afafafaf-cccc-0000-0000-000000000001', 'afafafaf-dddd-0000-0000-000000000001', 'afafafaf-0000-0000-0000-000000000001', 'Ração manhã', 'daily');

set role authenticated;
select pg_temp.as_user('afafafaf-eeee-0000-0000-00000000000a');
update public.dogs set birth_date = '2026-03-10', sex = 'f', food_brand = 'Premier', food_g_day = 180, meals_day = 3, food_stock_kg = 7.5, food_stock_on = public.ninho_today(),
  photo = 'data:image/jpeg;base64,AAAA', notes = 'Medo de trovão' where id = 'afafafaf-dddd-0000-0000-000000000001';
select pg_temp.ok((select food_g_day = 180 and sex = 'f' and photo like 'data:image/%' from public.dogs where id = 'afafafaf-dddd-0000-0000-000000000001'), 'perfil, foto e alimentação gravados');
do $$ begin
  begin update public.dogs set photo = 'https://exemplo.com/x.jpg' where id = 'afafafaf-dddd-0000-0000-000000000001'; raise exception 'FALHOU: foto externa';
  exception when check_violation then raise notice 'ok - foto só como imagem guardada no registro'; end;
  begin update public.dogs set meals_day = 9 where id = 'afafafaf-dddd-0000-0000-000000000001'; raise exception 'FALHOU: 9 refeições';
  exception when check_violation then raise notice 'ok - refeições por dia entre 1 e 6'; end;
end $$;
insert into public.dog_health (household_id, dog_id, kind, title, date, next_date, every_days, vet, done_by) values
  ('afafafaf-0000-0000-0000-000000000001', 'afafafaf-dddd-0000-0000-000000000001', 'vacina', 'V10', public.ninho_today() - 300, public.ninho_today() + 65, 365, 'Dra. Ana', 'g'),
  ('afafafaf-0000-0000-0000-000000000001', 'afafafaf-dddd-0000-0000-000000000001', 'peso', 'Peso', public.ninho_today(), null, null, null, 'g');
update public.dog_health set weight_kg = 8.4 where kind = 'peso';
do $$ begin
  begin insert into public.dog_health (household_id, dog_id, kind, title, date) values ('afafafaf-0000-0000-0000-000000000001', 'afafafaf-dddd-0000-0000-000000000001', 'diagnostico', 'X', current_date); raise exception 'FALHOU: tipo inválido';
  exception when check_violation then raise notice 'ok - só tipos de cuidado (sem diagnóstico)'; end;
end $$;
select pg_temp.ok((select count(*) from public.dog_health where dog_id = 'afafafaf-dddd-0000-0000-000000000001') = 2, 'histórico de cuidados');
insert into public.puppy_accidents (id, dog_id, household_id, location, date, notes) values ('afafafaf-aaaa-0000-0000-000000000001', 'afafafaf-dddd-0000-0000-000000000001', 'afafafaf-0000-0000-0000-000000000001', 'Sala', public.ninho_today(), 'Depois de beber água');
update public.puppy_accidents set location = 'Cozinha' where id = 'afafafaf-aaaa-0000-0000-000000000001';
select pg_temp.ok((select location = 'Cozinha' and notes is not null from public.puppy_accidents where id = 'afafafaf-aaaa-0000-0000-000000000001'), 'acidente corrigido, com observação');
select pg_temp.ok((select count(*) from public.dog_routines where dog_id = 'afafafaf-dddd-0000-0000-000000000001') = 1, 'rotinas dos cães preservadas');

select pg_temp.as_user('afafafaf-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.dog_health) = 0, 'outra casa não vê a saúde dos cães');
reset role;
select pg_temp.as_user(null);
