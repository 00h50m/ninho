-- Testes da migration 008 (rotina flexível). Rodam nos três cenários.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

insert into public.households (id, name) values ('55555555-0000-0000-0000-000000000001', 'Casa flexível');
-- Datas fixas: 2026-10-05 é segunda (dow 1), 2026-10-06 terça (dow 2)
insert into public.tasks (id, household_id, title, category, weight, frequency, essential, weekdays, created_at) values
  ('55555555-aaaa-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'Lixo seg/qua/sex', 'kitchen', 'light', 'daily', true, '{1,3,5}', '2026-09-01'),
  ('55555555-aaaa-0000-0000-000000000002', '55555555-0000-0000-0000-000000000001', 'Louça', 'kitchen', 'light', 'daily', true, null, '2026-09-01');

set role authenticated;
do $$
declare h uuid := '55555555-0000-0000-0000-000000000001';
begin
  -- Segunda: lixo e louça são do dia
  insert into public.task_completions (task_id, household_id, date, completed_by) values ('55555555-aaaa-0000-0000-000000000002', h, '2026-10-05', 'g');
  perform pg_temp.ok(not public.ninho_day_on_track(h, '2026-10-05'), 'segunda: lixo (seg/qua/sex) pendente → casa não está em dia');
  insert into public.task_skips (task_id, household_id, date, kind, skipped_by) values ('55555555-aaaa-0000-0000-000000000001', h, '2026-10-05', 'skip', 's');
  perform pg_temp.ok(public.ninho_day_on_track(h, '2026-10-05'), 'pular o lixo não quebra a sequência "casa em dia"');
  -- Terça: lixo não é do dia
  insert into public.task_completions (task_id, household_id, date, completed_by) values ('55555555-aaaa-0000-0000-000000000002', h, '2026-10-06', 's');
  perform pg_temp.ok(public.ninho_day_on_track(h, '2026-10-06'), 'terça: o lixo não conta (não é dia dele)');
  -- Adiar também não quebra
  insert into public.task_skips (task_id, household_id, date, kind, skipped_by) values ('55555555-aaaa-0000-0000-000000000002', h, '2026-10-07', 'snooze', 'g');
  insert into public.task_completions (task_id, household_id, date, completed_by) values ('55555555-aaaa-0000-0000-000000000001', h, '2026-10-07', 'g');
  perform pg_temp.ok(public.ninho_day_on_track(h, '2026-10-07'), 'deixar para amanhã também não quebra a sequência');

  begin insert into public.task_skips (task_id, household_id, date, kind) values ('55555555-aaaa-0000-0000-000000000002', h, '2026-10-07', 'skip'); raise exception 'FALHOU: dois registros no mesmo dia';
  exception when unique_violation then raise notice 'ok - um registro de pular/adiar por tarefa por dia'; end;
  begin insert into public.task_skips (task_id, household_id, date, kind) values ('55555555-aaaa-0000-0000-000000000002', h, '2026-10-08', 'sumir'); raise exception 'FALHOU: aceitou tipo inválido';
  exception when check_violation then raise notice 'ok - tipo inválido é recusado'; end;
  begin update public.tasks set weekdays = '{7}' where id = '55555555-aaaa-0000-0000-000000000002'; raise exception 'FALHOU: aceitou dia 7';
  exception when check_violation then raise notice 'ok - dia da semana inválido é recusado'; end;
  begin update public.tasks set weekdays = '{}' where id = '55555555-aaaa-0000-0000-000000000002'; raise exception 'FALHOU: aceitou lista vazia';
  exception when check_violation then raise notice 'ok - lista de dias vazia é recusada (use null = todos)'; end;
end $$;
reset role;

select pg_temp.ok(public.ninho_task_on_day('{1,3,5}', '2026-10-09') and not public.ninho_task_on_day('{1,3,5}', '2026-10-10') and public.ninho_task_on_day(null, '2026-10-10'),
  'dia da semana: sexta sim, sábado não, sem dias = todos');
select pg_temp.ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'task_skips'), 'pular/adiar no Realtime');
