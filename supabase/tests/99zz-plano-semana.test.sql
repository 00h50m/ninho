-- Testes da migration 045 (plano da semana): um dia por tarefa por semana, semana começa na
-- segunda, o dia cai dentro da semana, regra de segurança por casa, backup e apagar em cascata.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

insert into public.households (id, name) values ('c9c9c9c9-0000-0000-0000-0000000000c5', 'Casa plano') on conflict (id) do nothing;
insert into public.tasks (id, household_id, title, category, frequency) values ('c9c9c9c9-5555-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c5', 'Faxina', 'general', 'weekly') on conflict (id) do nothing;

insert into public.week_plan (task_id, household_id, week_start, date, by_who) values ('c9c9c9c9-5555-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c5', '2026-11-09', '2026-11-11', 'g');
select pg_temp.ok((select date from public.week_plan where task_id = 'c9c9c9c9-5555-0000-0000-000000000001') = '2026-11-11', 'dia do plano gravado');
insert into public.week_plan (task_id, household_id, week_start, date, by_who) values ('c9c9c9c9-5555-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c5', '2026-11-09', '2026-11-13', 's')
  on conflict (task_id, week_start) do update set date = excluded.date, by_who = excluded.by_who;
select pg_temp.ok((select date::text || '/' || by_who from public.week_plan where task_id = 'c9c9c9c9-5555-0000-0000-000000000001') = '2026-11-13/s', 'ajustar troca o dia');
do $$ begin
  begin insert into public.week_plan (task_id, household_id, week_start, date) values ('c9c9c9c9-5555-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c5', '2026-11-09', '2026-11-10');
    raise exception 'FALHOU: dois dias da mesma tarefa na mesma semana';
  exception when unique_violation then raise notice 'ok - um dia por tarefa por semana'; end;
  begin insert into public.week_plan (task_id, household_id, week_start, date) values ('c9c9c9c9-5555-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c5', '2026-11-10', '2026-11-11');
    raise exception 'FALHOU: semana que não começa na segunda';
  exception when check_violation then raise notice 'ok - a semana começa na segunda'; end;
  begin insert into public.week_plan (task_id, household_id, week_start, date) values ('c9c9c9c9-5555-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c5', '2026-11-16', '2026-11-23');
    raise exception 'FALHOU: dia fora da semana';
  exception when check_violation then raise notice 'ok - o dia cai dentro da semana'; end;
  begin insert into public.week_plan (task_id, household_id, week_start, date, by_who) values ('c9c9c9c9-5555-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c5', '2026-11-16', '2026-11-17', 'x');
    raise exception 'FALHOU: aceitou quem aprovou desconhecido';
  exception when check_violation then raise notice 'ok - quem aprovou: g ou s'; end;
end $$;
select pg_temp.ok((select count(*) from pg_policies where tablename = 'week_plan' and policyname = 'household_member') = 1, 'regra de segurança por casa');
select pg_temp.ok((select relrowsecurity from pg_class where oid = 'public.week_plan'::regclass), 'segurança por linha ligada');
do $$ begin
  if to_regprocedure('public.ninho_household_backup(uuid)') is not null then
    perform pg_temp.ok((public.ninho_household_backup('c9c9c9c9-0000-0000-0000-0000000000c5')::jsonb -> 'tables') ? 'week_plan', 'entra no backup da casa');
  end if;
end $$;
delete from public.tasks where id = 'c9c9c9c9-5555-0000-0000-000000000001';
select pg_temp.ok((select count(*) from public.week_plan where task_id = 'c9c9c9c9-5555-0000-0000-000000000001') = 0, 'apagar a tarefa apaga o plano dela');
delete from public.households where id = 'c9c9c9c9-0000-0000-0000-0000000000c5';
