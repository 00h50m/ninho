-- Testes da migration 044 ("mais tarde"): um horário por tarefa por dia, quem pediu g/s, apagar a
-- tarefa apaga o registro, a regra de segurança por casa existe e a tabela entra no backup.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

insert into public.households (id, name) values ('c9c9c9c9-0000-0000-0000-0000000000c4', 'Casa mais tarde') on conflict (id) do nothing;
insert into public.tasks (id, household_id, title, category, frequency) values ('c9c9c9c9-4444-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c4', 'Varal', 'general', 'daily') on conflict (id) do nothing;

insert into public.task_later (task_id, household_id, date, at, by_who) values ('c9c9c9c9-4444-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c4', '2026-11-02', '10:30', 'g');
select pg_temp.ok((select at from public.task_later where task_id = 'c9c9c9c9-4444-0000-0000-000000000001') = '10:30'::time, 'horário de hoje gravado');
-- mudar de ideia no mesmo dia: troca o horário (upsert)
insert into public.task_later (task_id, household_id, date, at, by_who) values ('c9c9c9c9-4444-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c4', '2026-11-02', '19:00', 's')
  on conflict (task_id, date) do update set at = excluded.at, by_who = excluded.by_who;
select pg_temp.ok((select at::text || '/' || by_who from public.task_later where task_id = 'c9c9c9c9-4444-0000-0000-000000000001') = '19:00:00/s', 'mudar de ideia troca o horário');
do $$ begin
  begin insert into public.task_later (task_id, household_id, date, at, by_who) values ('c9c9c9c9-4444-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c4', '2026-11-02', '20:00', 'g');
    raise exception 'FALHOU: dois horários da mesma tarefa no mesmo dia';
  exception when unique_violation then raise notice 'ok - um horário por tarefa por dia'; end;
  begin insert into public.task_later (task_id, household_id, date, at, by_who) values ('c9c9c9c9-4444-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c4', '2026-11-03', '20:00', 'x');
    raise exception 'FALHOU: aceitou quem pediu desconhecido';
  exception when check_violation then raise notice 'ok - quem pediu: g ou s'; end;
end $$;
select pg_temp.ok((select count(*) from pg_policies where tablename = 'task_later' and policyname = 'household_member') = 1, 'regra de segurança por casa');
select pg_temp.ok((select relrowsecurity from pg_class where oid = 'public.task_later'::regclass), 'segurança por linha ligada');
do $$ begin
  if to_regprocedure('public.ninho_household_backup(uuid)') is not null then
    perform pg_temp.ok((public.ninho_household_backup('c9c9c9c9-0000-0000-0000-0000000000c4')::jsonb -> 'tables') ? 'task_later', 'entra no backup da casa');
  end if;
end $$;
-- a tarefa continua na lista de hoje (não é pulo)
select pg_temp.ok(not exists (select 1 from public.task_skips where task_id = 'c9c9c9c9-4444-0000-0000-000000000001'), 'não vira pulo');
delete from public.tasks where id = 'c9c9c9c9-4444-0000-0000-000000000001';
select pg_temp.ok((select count(*) from public.task_later where task_id = 'c9c9c9c9-4444-0000-0000-000000000001') = 0, 'apagar a tarefa apaga o "mais tarde"');
delete from public.households where id = 'c9c9c9c9-0000-0000-0000-0000000000c4';
