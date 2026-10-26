-- Testes da migration 039 (tarefa com período): colunas vazias por padrão, "até" depois do "de",
-- e a "Casa em dia" ignora a diária essencial fora do período. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

select pg_temp.ok((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name in ('starts_on', 'ends_on') and data_type = 'date') = 2, 'tarefas têm "de" e "até" (date)');
select pg_temp.ok((select count(*) from pg_constraint where conname = 'tasks_period_check') = 1, 'período conferido (uma regra só, mesmo rodando 2x)');

insert into public.households (id, name) values ('f7f7f7f7-0000-0000-0000-0000000000a1', 'Casa período') on conflict (id) do nothing;
insert into public.tasks (id, household_id, title, category, weight, frequency, essential, active, created_at)
values ('f7f7f7f7-1111-0000-0000-000000000001', 'f7f7f7f7-0000-0000-0000-0000000000a1', 'Regar a horta', 'general', 'light', 'daily', true, true, '2026-01-01T12:00:00Z')
on conflict (id) do nothing;
select pg_temp.ok((select starts_on is null and ends_on is null from public.tasks where id = 'f7f7f7f7-1111-0000-0000-000000000001'), 'tarefa antiga fica sem período (vale sempre)');

do $$ begin
  begin update public.tasks set starts_on = '2026-12-10', ends_on = '2026-12-01' where id = 'f7f7f7f7-1111-0000-0000-000000000001';
    raise exception 'FALHOU: aceitou "até" antes do "de"';
  exception when check_violation then raise notice 'ok - "até" precisa ser depois do "de"'; end;
end $$;
update public.tasks set starts_on = '2026-12-01', ends_on = '2026-12-01' where id = 'f7f7f7f7-1111-0000-0000-000000000001';
select pg_temp.ok((select ends_on from public.tasks where id = 'f7f7f7f7-1111-0000-0000-000000000001') = '2026-12-01', 'período de um dia só vale');

-- Casa em dia: no período a essencial pendente segura o dia; fora dele, não
update public.tasks set starts_on = '2026-12-01', ends_on = '2026-12-15' where id = 'f7f7f7f7-1111-0000-0000-000000000001';
select pg_temp.ok(not public.ninho_day_on_track('f7f7f7f7-0000-0000-0000-0000000000a1', '2026-12-05'), 'dentro do período: essencial pendente segura a "Casa em dia"');
select pg_temp.ok(public.ninho_day_on_track('f7f7f7f7-0000-0000-0000-0000000000a1', '2026-11-30') = public.ninho_day_active('f7f7f7f7-0000-0000-0000-0000000000a1', '2026-11-30', null),
  'antes do período: o dia não depende dela');
select pg_temp.ok(public.ninho_day_on_track('f7f7f7f7-0000-0000-0000-0000000000a1', '2026-12-16') = public.ninho_day_active('f7f7f7f7-0000-0000-0000-0000000000a1', '2026-12-16', null),
  'depois do período: o dia não depende dela');
insert into public.task_completions (task_id, household_id, date, completed_by) values ('f7f7f7f7-1111-0000-0000-000000000001', 'f7f7f7f7-0000-0000-0000-0000000000a1', '2026-12-05', 'g');
select pg_temp.ok(public.ninho_day_on_track('f7f7f7f7-0000-0000-0000-0000000000a1', '2026-12-05'), 'feita no período: Casa em dia');
