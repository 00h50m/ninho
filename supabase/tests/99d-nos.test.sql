-- Testes da migration 022 (Nós): registro do dia, combinados e desafios em dupla. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('c2c2c2c2-0000-0000-0000-000000000001', 'Casa nós'), ('c2c2c2c2-0000-0000-0000-000000000002', 'Vizinha nós');
insert into auth.users (id, email) values ('c2c2c2c2-eeee-0000-0000-00000000000a', 'gio-nos@teste.com'), ('c2c2c2c2-eeee-0000-0000-00000000000b', 'sabi-nos@teste.com'), ('c2c2c2c2-eeee-0000-0000-00000000000c', 'viz-nos@teste.com');
select public.ninho_link_member('gio-nos@teste.com', 'g', 'c2c2c2c2-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-nos@teste.com', 's', 'c2c2c2c2-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-nos@teste.com', 'g', 'c2c2c2c2-0000-0000-0000-000000000002');

set role authenticated;
-- Registro do dia: grava em nome de quem está logada, mesmo pedindo outra pessoa
select pg_temp.as_user('c2c2c2c2-eeee-0000-0000-00000000000b');
select public.ninho_checkin('c2c2c2c2-0000-0000-0000-000000000001', public.ninho_today(), 's', 'bem', 'high', null);
select public.ninho_day_note('c2c2c2c2-0000-0000-0000-000000000001', public.ninho_today(), 'g', '  Jantar juntas ', 'Dormir cedo', 'Obrigada pelo café');
select pg_temp.ok((select who || '/' || good || '/' || need || '/' || thanks || '/' || mood from public.daily_checkins where household_id = 'c2c2c2c2-0000-0000-0000-000000000001') = 's/Jantar juntas/Dormir cedo/Obrigada pelo café/bem',
  'registro do dia grava na pessoa logada e não apaga o humor');
select public.ninho_checkin('c2c2c2c2-0000-0000-0000-000000000001', public.ninho_today(), 's', 'otimo', null, null);
select pg_temp.ok((select good from public.daily_checkins where household_id = 'c2c2c2c2-0000-0000-0000-000000000001') = 'Jantar juntas', 'mudar o humor não apaga o registro');
select public.ninho_day_note('c2c2c2c2-0000-0000-0000-000000000001', public.ninho_today(), 's', '', null, 'Obrigada');
select pg_temp.ok((select coalesce(good, '-') || '/' || coalesce(need, '-') || '/' || thanks from public.daily_checkins where household_id = 'c2c2c2c2-0000-0000-0000-000000000001') = '-/-/Obrigada', 'campos vazios ficam em branco');
do $$ begin
  begin perform public.ninho_day_note('c2c2c2c2-0000-0000-0000-000000000001', public.ninho_today() - 30, 's', 'x', null, null);
    raise exception 'FALHOU: aceitou registro de 30 dias atrás';
  exception when sqlstate '22023' then raise notice 'ok - registro só para os últimos 7 dias'; end;
  begin perform public.ninho_day_note('c2c2c2c2-0000-0000-0000-000000000001', public.ninho_today(), 's', repeat('x', 300), null, null);
    raise exception 'FALHOU: aceitou texto longo';
  exception when check_violation then raise notice 'ok - texto do registro limitado a 280'; end;
end $$;

-- Combinados da reunião
insert into public.weekly_meetings (household_id, week_start, what_worked, agreements)
values ('c2c2c2c2-0000-0000-0000-000000000001', public.ninho_today(), 'tudo', '[{"text":"Lavar a louça antes de dormir","who":"both","task_id":null,"done":false}]');
select pg_temp.ok((select agreements -> 0 ->> 'who' from public.weekly_meetings where household_id = 'c2c2c2c2-0000-0000-0000-000000000001') = 'both', 'combinados guardados na reunião');
do $$ begin
  begin update public.weekly_meetings set agreements = '{"x":1}' where household_id = 'c2c2c2c2-0000-0000-0000-000000000001';
    raise exception 'FALHOU: aceitou combinados que não são lista';
  exception when check_violation then raise notice 'ok - combinados precisam ser uma lista'; end;
end $$;

-- Desafios em dupla
insert into public.couple_challenges (id, household_id, title, kind, days, goal, created_by)
values ('c2c2c2c2-cccc-0000-0000-000000000001', 'c2c2c2c2-0000-0000-0000-000000000001', 'Cozinha fechada', 'livre', 7, 7, 's');
insert into public.challenge_marks (challenge_id, household_id, date, who) values ('c2c2c2c2-cccc-0000-0000-000000000001', 'c2c2c2c2-0000-0000-0000-000000000001', public.ninho_today(), 's');
do $$ begin
  begin insert into public.challenge_marks (challenge_id, household_id, date, who) values ('c2c2c2c2-cccc-0000-0000-000000000001', 'c2c2c2c2-0000-0000-0000-000000000001', public.ninho_today(), 'g');
    raise exception 'FALHOU: marcou o mesmo dia duas vezes';
  exception when unique_violation then raise notice 'ok - um dia conta uma vez só'; end;
  begin insert into public.couple_challenges (household_id, title, days, goal) values ('c2c2c2c2-0000-0000-0000-000000000001', 'Impossível', 5, 7);
    raise exception 'FALHOU: meta maior que a duração';
  exception when check_violation then raise notice 'ok - meta não passa da duração'; end;
end $$;
select pg_temp.as_user('c2c2c2c2-eeee-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.couple_challenges) = 1 and (select count(*) from public.challenge_marks) = 1, 'a outra vê o desafio e a marcação');
update public.couple_challenges set status = 'done', ended_at = now() where id = 'c2c2c2c2-cccc-0000-0000-000000000001';
select pg_temp.ok((select status from public.couple_challenges where id = 'c2c2c2c2-cccc-0000-0000-000000000001') = 'done', 'qualquer uma das duas encerra o desafio');

-- Outra casa e sem login
select pg_temp.as_user('c2c2c2c2-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.couple_challenges) = 0 and (select count(*) from public.challenge_marks) = 0
  and (select count(*) from public.daily_checkins where household_id = 'c2c2c2c2-0000-0000-0000-000000000001') = 0, 'outra casa não vê nada');
do $$ begin
  begin insert into public.couple_challenges (household_id, title, days, goal) values ('c2c2c2c2-0000-0000-0000-000000000001', 'Intrusa', 7, 7);
    raise exception 'FALHOU: outra casa criou desafio';
  exception when insufficient_privilege then raise notice 'ok - outra casa não cria desafio'; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform count(*) from public.couple_challenges;
    if (select count(*) from public.couple_challenges) > 0 then raise exception 'FALHOU: sem login viu desafios'; end if;
    raise notice 'ok - sem login não vê desafios';
  exception when insufficient_privilege then raise notice 'ok - sem login não vê desafios'; end;
end $$;
reset role;
