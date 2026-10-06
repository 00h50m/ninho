-- Testes da migration 018 (Sprint do Ninho). Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('8d8d8d8d-0000-0000-0000-000000000001', 'Casa sprint'), ('8d8d8d8d-0000-0000-0000-000000000002', 'Vizinha');
insert into auth.users (id, email) values ('8d8d8d8d-eeee-0000-0000-00000000000a', 'gio-sp@teste.com'), ('8d8d8d8d-eeee-0000-0000-00000000000c', 'viz-sp@teste.com');
select public.ninho_link_member('gio-sp@teste.com', 'g', '8d8d8d8d-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-sp@teste.com', 'g', '8d8d8d8d-0000-0000-0000-000000000002');
insert into public.tasks (id, household_id, title, category, weight, frequency) values
  ('8d8d8d8d-aaaa-0000-0000-000000000001', '8d8d8d8d-0000-0000-0000-000000000001', 'Louça', 'kitchen', 'light', 'daily'),
  ('8d8d8d8d-aaaa-0000-0000-000000000002', '8d8d8d8d-0000-0000-0000-000000000001', 'Fogão', 'kitchen', 'heavy', 'weekly'),
  ('8d8d8d8d-aaaa-0000-0000-000000000003', '8d8d8d8d-0000-0000-0000-000000000001', 'Geladeira', 'kitchen', 'medium', 'weekly'),
  ('8d8d8d8d-aaaa-0000-0000-000000000004', '8d8d8d8d-0000-0000-0000-000000000001', 'Fora do sprint', 'general', 'light', 'daily');

set role authenticated;
select pg_temp.as_user('8d8d8d8d-eeee-0000-0000-00000000000a');
insert into public.sprints (id, household_id, started_by, duration_min, area, task_ids) values
  ('8d8d8d8d-5555-0000-0000-000000000001', '8d8d8d8d-0000-0000-0000-000000000001', 'g', 15, 'kitchen',
   array['8d8d8d8d-aaaa-0000-0000-000000000001','8d8d8d8d-aaaa-0000-0000-000000000002','8d8d8d8d-aaaa-0000-0000-000000000003']::uuid[]);
select pg_temp.ok((select coalesce(sum(amount), 0) from public.xp_history where household_id = '8d8d8d8d-0000-0000-0000-000000000001') = 0, 'iniciar o sprint não dá XP');
do $$ begin
  begin insert into public.sprints (household_id, duration_min) values ('8d8d8d8d-0000-0000-0000-000000000001', 10); raise exception 'FALHOU: dois sprints ativos';
  exception when unique_violation then raise notice 'ok - um sprint em andamento por casa'; end;
end $$;
-- conclui duas do sprint (uma delas duas vezes) e uma de fora
select public.ninho_complete_task('8d8d8d8d-aaaa-0000-0000-000000000001', public.ninho_today(), 'g');
select public.ninho_complete_task('8d8d8d8d-aaaa-0000-0000-000000000002', public.ninho_today(), 'g');
select public.ninho_complete_task('8d8d8d8d-aaaa-0000-0000-000000000002', public.ninho_today(), 'g');
select public.ninho_complete_task('8d8d8d8d-aaaa-0000-0000-000000000004', public.ninho_today(), 'g');
create temp table sp_r1 as select public.ninho_finish_sprint('8d8d8d8d-5555-0000-0000-000000000001') as r;
select pg_temp.ok((select (r->>'done')::int from sp_r1) = 2, 'conta só as tarefas do sprint concluídas (2), sem duplicar');
select pg_temp.ok((select (r->>'xp')::int from sp_r1) = (select coalesce(sum(amount), 0) from public.xp_history where reason in (public.ninho_xp_reason('task', '8d8d8d8d-aaaa-0000-0000-000000000001', public.ninho_today()), public.ninho_xp_reason('task', '8d8d8d8d-aaaa-0000-0000-000000000002', public.ninho_today())) and voided_at is null)
  and (select (r->>'xp')::int from sp_r1) > 0, 'XP do sprint = XP real das tarefas concluídas (a de fora não entra)');
create temp table sp_r2 as select public.ninho_finish_sprint('8d8d8d8d-5555-0000-0000-000000000001') as r;
select pg_temp.ok((select (r->>'already')::boolean and (r->>'xp')::int = (select (r->>'xp')::int from sp_r1) from sp_r2), 'encerrar de novo não muda o resultado');
insert into public.sprints (id, household_id, duration_min, paused_at) values ('8d8d8d8d-5555-0000-0000-000000000002', '8d8d8d8d-0000-0000-0000-000000000001', 10, now() - interval '2 minutes');
select pg_temp.ok((public.ninho_finish_sprint('8d8d8d8d-5555-0000-0000-000000000002', true)->>'status') = 'cancelled', 'cancelar fecha o sprint');
select pg_temp.ok((select paused_ms >= 119000 and status = 'cancelled' and xp = 0 from public.sprints where id = '8d8d8d8d-5555-0000-0000-000000000002'), 'cancelado: soma a pausa em andamento e não conta XP');

-- pausar e continuar com o relógio do servidor; +5 min
insert into public.sprints (id, household_id, duration_min) values ('8d8d8d8d-5555-0000-0000-000000000003', '8d8d8d8d-0000-0000-0000-000000000001', 10);
select pg_temp.ok((public.ninho_sprint_pause('8d8d8d8d-5555-0000-0000-000000000003', true)->>'status') = 'paused', 'pausar');
update public.sprints set paused_at = now() - interval '30 seconds' where id = '8d8d8d8d-5555-0000-0000-000000000003';
select pg_temp.ok((public.ninho_sprint_pause('8d8d8d8d-5555-0000-0000-000000000003', false, 5)->>'status') = 'running', 'continuar');
select pg_temp.ok((select paused_ms between 29000 and 40000 and duration_min = 15 and paused_at is null from public.sprints where id = '8d8d8d8d-5555-0000-0000-000000000003'), 'pausa somada pelo servidor e +5 min');
select public.ninho_finish_sprint('8d8d8d8d-5555-0000-0000-000000000003', true);

select pg_temp.as_user('8d8d8d8d-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.sprints) = 0, 'outra casa não vê os sprints');
do $$ begin
  begin perform public.ninho_finish_sprint('8d8d8d8d-5555-0000-0000-000000000001'); raise exception 'FALHOU: encerrou sprint dos outros';
  exception when others then if sqlerrm like 'NINHO_NOT_FOUND%' then raise notice 'ok - não encerra sprint de outra casa'; else raise; end if; end;
end $$;
reset role;
select pg_temp.as_user(null);
set role anon;
do $$ begin
  begin perform public.ninho_finish_sprint('8d8d8d8d-5555-0000-0000-000000000001'); raise exception 'FALHOU: anon encerrou';
  exception when insufficient_privilege then raise notice 'ok - sem login não encerra'; end;
end $$;
reset role;
