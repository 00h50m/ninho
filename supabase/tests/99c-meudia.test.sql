-- Testes da migration 021 (Meu dia): privacidade item por item. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('b1b1b1b1-0000-0000-0000-000000000001', 'Casa meu dia'), ('b1b1b1b1-0000-0000-0000-000000000002', 'Vizinha');
insert into auth.users (id, email) values ('b1b1b1b1-eeee-0000-0000-00000000000a', 'gio-md@teste.com'), ('b1b1b1b1-eeee-0000-0000-00000000000b', 'sabi-md@teste.com'), ('b1b1b1b1-eeee-0000-0000-00000000000c', 'viz-md@teste.com');
select public.ninho_link_member('gio-md@teste.com', 'g', 'b1b1b1b1-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-md@teste.com', 's', 'b1b1b1b1-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-md@teste.com', 'g', 'b1b1b1b1-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from pg_policies where tablename = 'personal_logs' and policyname = 'allow_all_auth') = 0, 'nenhuma regra "todo mundo vê" no Meu dia');

set role authenticated;
select pg_temp.as_user('b1b1b1b1-eeee-0000-0000-00000000000a');
insert into public.personal_settings (household_id, who, water_goal_ml, share) values ('b1b1b1b1-0000-0000-0000-000000000001', 'g', 2500, '{"agua":true}');
insert into public.personal_logs (household_id, who, date, kind, value, data) values
  ('b1b1b1b1-0000-0000-0000-000000000001', 'g', current_date, 'agua', 500, '{}'),
  ('b1b1b1b1-0000-0000-0000-000000000001', 'g', current_date, 'sono', 6.5, '{"bed":"23:30","wake":"06:00","quality":"ok"}'),
  ('b1b1b1b1-0000-0000-0000-000000000001', 'g', current_date, 'treino', 45, '{"type":"musculacao","exercises":[{"name":"Agachamento","sets":3,"reps":10,"kg":40}]}'),
  ('b1b1b1b1-0000-0000-0000-000000000001', 'g', current_date, 'corpo', 64.2, '{"waist":72}');
insert into public.personal_meds (household_id, who, name, dose, times) values ('b1b1b1b1-0000-0000-0000-000000000001', 'g', 'Vitamina D', '1 cápsula', array['08:00']);
select pg_temp.ok((select count(*) from public.personal_logs) = 4 and (select count(*) from public.personal_meds) = 1, 'a dona vê tudo do próprio Meu dia');

select pg_temp.as_user('b1b1b1b1-eeee-0000-0000-00000000000b');
select pg_temp.ok((select string_agg(kind, ',') from public.personal_logs) = 'agua', 'a outra só vê o que foi compartilhado (água)');
select pg_temp.ok((select count(*) from public.personal_meds) = 0, 'remédio não compartilhado fica privado');
select pg_temp.ok((select water_goal_ml from public.personal_settings where who = 'g') = 2500, 'metas e escolhas de compartilhamento são visíveis para a casa');
do $$ begin
  begin insert into public.personal_logs (household_id, who, date, kind, value) values ('b1b1b1b1-0000-0000-0000-000000000001', 'g', current_date, 'agua', 9999);
    raise exception 'FALHOU: gravou no Meu dia da outra';
  exception when insufficient_privilege then raise notice 'ok - ninguém grava no Meu dia da outra'; end;
end $$;
update public.personal_settings set share = '{"agua":true,"sono":true,"treino":true,"corpo":true,"remedio":true}' where who = 'g';
select pg_temp.as_user('b1b1b1b1-eeee-0000-0000-00000000000a');
select pg_temp.ok((select share ->> 'sono' from public.personal_settings where who = 'g') is null, 'a outra não muda o que eu compartilho');
update public.personal_settings set share = '{"agua":true,"treino":true,"remedio":true}' where who = 'g';
select pg_temp.as_user('b1b1b1b1-eeee-0000-0000-00000000000b');
select pg_temp.ok((select string_agg(kind, ',' order by kind) from public.personal_logs) = 'agua,treino' and (select count(*) from public.personal_meds) = 1, 'compartilhar libera na hora (treino e remédio)');
delete from public.personal_logs where who = 'g';
select pg_temp.as_user('b1b1b1b1-eeee-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.personal_logs) = 4, 'a outra não apaga meus registros');
insert into public.personal_logs (household_id, who, date, kind, value) values ('b1b1b1b1-0000-0000-0000-000000000001', 'g', current_date, 'agua', 250);
do $$ begin
  begin insert into public.personal_logs (household_id, who, date, kind, value) values ('b1b1b1b1-0000-0000-0000-000000000001', 'g', current_date, 'dieta', 1); raise exception 'FALHOU: dieta';
  exception when check_violation then raise notice 'ok - sem dieta e sem calorias'; end;
end $$;

select pg_temp.as_user('b1b1b1b1-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.personal_logs) = 0 and (select count(*) from public.personal_settings) = 0, 'outra casa não vê nada');
reset role;
select pg_temp.as_user(null);
set role anon;
select pg_temp.ok((select count(*) from public.personal_logs) = 0 and (select count(*) from public.personal_meds) = 0, 'sem login não lê nada');
reset role;
