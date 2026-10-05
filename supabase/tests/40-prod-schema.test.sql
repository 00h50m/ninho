-- Testes no schema REAL de produção (fixtures-prod-2026-10.sql), depois das migrations 001–006.
\set ON_ERROR_STOP on

create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

select pg_temp.ok((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'task_completions' and column_name = 'completed_by') = 'text',
  'task_completions.completed_by agora é texto (g/s)');
select pg_temp.ok((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'task_completions' and column_name = 'completed_by_legacy') = 'uuid',
  'coluna uuid antiga preservada como completed_by_legacy');
select pg_temp.ok((select count(*) from public.task_completions where created_at = completed_at) = (select count(*) from public.task_completions),
  'created_at das conclusões antigas = completed_at original');
select pg_temp.ok((select count(*) from public.xp_history where created_at = earned_at) = (select count(*) from public.xp_history),
  'created_at do XP antigo = earned_at original');
select pg_temp.ok((select count(*) from public.task_completions) = 2 and (select count(*) from public.xp_history where voided_at is null) = 2,
  'nenhuma conclusão ou XP perdido');
select pg_temp.ok(public.ninho_household_xp('99999999-0000-0000-0000-000000000001') = 3, 'XP total da casa mantido (3)');

set role authenticated;

do $$
declare r jsonb; t date := public.ninho_today();
begin
  -- scheduled_time do tipo time
  r := public.ninho_complete_task('99999999-aaaa-0000-0000-000000000003', t, 's');
  perform pg_temp.ok((r->>'created')::boolean and (r->>'on_time')::boolean and (r->>'xp')::int = 3,
    'tarefa com horário (tipo time) concluída no horário: 3 XP (2 ×1,5)');
  r := public.ninho_complete_task('99999999-aaaa-0000-0000-000000000001', t, 'g');
  perform pg_temp.ok((r->>'created')::boolean and not (r->>'on_time')::boolean, 'tarefa sem horário: sem bônus');
  perform pg_temp.ok((select completed_at is not null and completed_by = 'g' from public.task_completions
                      where task_id = '99999999-aaaa-0000-0000-000000000001' and date = t), 'nova conclusão: completed_at preenchido e completed_by = g');
  r := public.ninho_complete_dog_routines(array['99999999-eeee-0000-0000-000000000001','99999999-eeee-0000-0000-000000000002']::uuid[], t, 'g');
  perform pg_temp.ok(jsonb_array_length(r->'completions') = 2, 'rotinas dos dois cães (tipo time) concluídas juntas');
  perform pg_temp.ok((select count(*) from public.xp_history where earned_by = 'g' and activity_date = t and on_time) = 2,
    'XP das rotinas no horário, com autoria');
  r := public.ninho_uncomplete_task('99999999-aaaa-0000-0000-000000000001', t);
  perform pg_temp.ok(not exists (select 1 from public.task_completions where task_id = '99999999-aaaa-0000-0000-000000000001' and date = t),
    'desfazer funciona');
  perform pg_temp.ok(public.ninho_streaks('99999999-0000-0000-0000-000000000001', t) is not null, 'sequências calculam');
  perform pg_temp.ok(public.ninho_weekly_scores('99999999-0000-0000-0000-000000000001', t) is not null, 'placar calcula');
  perform pg_temp.ok(public.ninho_achievement_stats('99999999-0000-0000-0000-000000000001') is not null, 'conquistas calculam');
end $$;

reset role;

-- App antigo (ainda em cache no celular) gravando do jeito antigo
insert into public.task_completions (task_id, household_id, date) values ('99999999-aaaa-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', public.ninho_today());
select pg_temp.ok(true, 'app antigo continua conseguindo marcar tarefa');
