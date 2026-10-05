-- Testes da migration 005 (gamificação). Rodam nos dois cenários.
\set ON_ERROR_STOP on

create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- ── Pontualidade (função pura, com relógio controlado) ──
-- 2026-10-07 09:59 em São Paulo = 12:59 UTC
select pg_temp.ok(public.ninho_is_on_time('daily', '10:00', '2026-10-07', '2026-10-07 12:59:00+00'), 'diária 10:00 feita às 09:59: no horário');
select pg_temp.ok(public.ninho_is_on_time('daily', '10:00:00', '2026-10-07', '2026-10-07 13:00:00+00'), 'feita exatamente às 10:00: no horário');
select pg_temp.ok(not public.ninho_is_on_time('daily', '10:00', '2026-10-07', '2026-10-07 13:01:00+00'), 'feita às 10:01: atrasada (sem bônus)');
select pg_temp.ok(not public.ninho_is_on_time('weekly', '10:00', '2026-10-07', '2026-10-07 12:00:00+00'), 'semanal não tem bônus de horário');
select pg_temp.ok(not public.ninho_is_on_time('daily', null, '2026-10-07', '2026-10-07 12:00:00+00'), 'sem horário: sem bônus');
select pg_temp.ok(not public.ninho_is_on_time('daily', '23:00', '2026-10-06', '2026-10-07 12:00:00+00'), 'marcar o dia de ontem hoje: sem bônus');
select pg_temp.ok(public.ninho_is_on_time('daily', '23:30', '2026-10-04', '2026-10-05 02:29:00+00'), 'domingo 23:29 em SP (02:29 UTC de segunda): ainda no horário de domingo');
select pg_temp.ok(public.ninho_xp_with_bonus(1, true) = 2 and public.ninho_xp_with_bonus(2, true) = 3 and public.ninho_xp_with_bonus(3, true) = 5, 'bônus ×1,5 arredondado para cima: 1→2, 2→3, 3→5');
select pg_temp.ok(public.ninho_xp_with_bonus(3, false) = 3, 'atrasada no mesmo dia: XP normal, sem perder pontos');

-- ── Fixtures ──
insert into public.households (id, name) values ('88888888-0000-0000-0000-000000000001', 'Casa gamificação');
insert into public.tasks (id, household_id, title, category, weight, frequency, scheduled_time, essential, created_at) values
  ('88888888-aaaa-0000-0000-000000000001', '88888888-0000-0000-0000-000000000001', 'Até 23:59', 'laundry', 'heavy', 'daily', '23:59', true, now() - interval '10 days'),
  ('88888888-aaaa-0000-0000-000000000002', '88888888-0000-0000-0000-000000000001', 'Sem horário', 'kitchen', 'medium', 'daily', null, false, now() - interval '10 days'),
  ('88888888-aaaa-0000-0000-000000000003', '88888888-0000-0000-0000-000000000001', 'Semanal', 'bathroom', 'light', 'weekly', '23:59', false, now() - interval '10 days');
insert into public.dogs (id, household_id, name) values ('88888888-dddd-0000-0000-000000000001', '88888888-0000-0000-0000-000000000001', 'Cão');
insert into public.dog_routines (id, dog_id, household_id, title, frequency, scheduled_time) values
  ('88888888-eeee-0000-0000-000000000001', '88888888-dddd-0000-0000-000000000001', '88888888-0000-0000-0000-000000000001', 'Ração', 'daily', '23:59');

set role authenticated;

do $$
declare r jsonb; t date := public.ninho_today();
begin
  r := public.ninho_complete_task('88888888-aaaa-0000-0000-000000000001', t, 'g');
  perform pg_temp.ok((r->>'on_time')::boolean and (r->>'xp')::int = 5 and (r->>'base_xp')::int = 3, 'pesada até o horário: 5 XP (3 ×1,5)');
  r := public.ninho_complete_task('88888888-aaaa-0000-0000-000000000001', t, 's');
  perform pg_temp.ok(not (r->>'created')::boolean and (r->>'xp')::int = 5, 'repetir não dá bônus de novo nem duplica');
  r := public.ninho_complete_task('88888888-aaaa-0000-0000-000000000002', t, 's');
  perform pg_temp.ok(not (r->>'on_time')::boolean and (r->>'xp')::int = 2, 'sem horário: XP normal');
  r := public.ninho_complete_task('88888888-aaaa-0000-0000-000000000003', t, 's');
  perform pg_temp.ok(not (r->>'on_time')::boolean and (r->>'xp')::int = 1, 'semanal com horário: XP normal');
  r := public.ninho_complete_dog_routines(array['88888888-eeee-0000-0000-000000000001']::uuid[], t, 's');
  perform pg_temp.ok((r->>'on_time')::boolean and (r->>'xp_added')::int = 2, 'rotina de cão até o horário: 2 XP');
  perform pg_temp.ok((select earned_by from public.xp_history where reason = public.ninho_xp_reason('task','88888888-aaaa-0000-0000-000000000001', t)) = 'g', 'XP registra quem ganhou');
  perform pg_temp.ok((select activity_date from public.xp_history where reason = public.ninho_xp_reason('task','88888888-aaaa-0000-0000-000000000002', t)) = t, 'XP registra o dia');
  perform pg_temp.ok(public.ninho_household_xp('88888888-0000-0000-0000-000000000001') = 10, 'XP total da casa = 5 + 2 + 1 + 2');

  -- desfazer tira o bônus junto
  perform public.ninho_uncomplete_task('88888888-aaaa-0000-0000-000000000001', t);
  perform pg_temp.ok(public.ninho_household_xp('88888888-0000-0000-0000-000000000001') = 5, 'desfazer remove o XP com bônus');
  perform public.ninho_complete_task('88888888-aaaa-0000-0000-000000000001', t, 'g');
end $$;

-- ── Placar semanal ──
do $$
declare r jsonb; ws date := date_trunc('week', public.ninho_today())::date;
begin
  r := public.ninho_weekly_scores('88888888-0000-0000-0000-000000000001', ws);
  perform pg_temp.ok((r->'g'->>'xp')::int = 5 and (r->'g'->>'done')::int = 1 and (r->'g'->>'on_time')::int = 1, 'placar: Giovanna 5 XP, 1 feita, 1 no horário');
  perform pg_temp.ok((r->'s'->>'xp')::int = 5 and (r->'s'->>'done')::int = 3, 'placar: Sabrina 5 XP em 3 conclusões');
  r := public.ninho_weekly_scores('88888888-0000-0000-0000-000000000001', ws - 7);
  perform pg_temp.ok((r->'g'->>'xp')::int = 0 and (r->'s'->>'xp')::int = 0, 'semana anterior vazia');
end $$;

-- ── Sequências ──
reset role;
insert into public.task_completions (task_id, household_id, date, completed_by) values
  ('88888888-aaaa-0000-0000-000000000001', '88888888-0000-0000-0000-000000000001', public.ninho_today() - 1, 's'),
  ('88888888-aaaa-0000-0000-000000000002', '88888888-0000-0000-0000-000000000001', public.ninho_today() - 2, 'g'),
  ('88888888-aaaa-0000-0000-000000000001', '88888888-0000-0000-0000-000000000001', public.ninho_today() - 5, 'g');
set role authenticated;
do $$
declare r jsonb;
begin
  r := public.ninho_streaks('88888888-0000-0000-0000-000000000001', public.ninho_today());
  perform pg_temp.ok((r->>'house')::int = 3, 'sequência da casa: hoje, ontem e anteontem');
  perform pg_temp.ok((r->>'house_best')::int = 3, 'recorde da casa = 3');
  perform pg_temp.ok((r->>'on_track')::int = 2, 'casa em dia (essencial feita): hoje e ontem');
  perform pg_temp.ok((r->>'g')::int = 1, 'Giovanna: só hoje (anteontem é dia isolado depois de um buraco)');
  perform pg_temp.ok((r->>'s')::int = 2, 'Sabrina: hoje e ontem');
  r := public.ninho_streaks('88888888-0000-0000-0000-000000000001', public.ninho_today() + 1);
  perform pg_temp.ok((r->>'house')::int = 3, 'dia seguinte sem nada ainda: a sequência não quebra durante o dia');
end $$;

-- ── Conquistas ──
do $$
declare r jsonb;
begin
  r := public.ninho_achievement_stats('88888888-0000-0000-0000-000000000001', public.ninho_today());
  perform pg_temp.ok((r->'g'->'categories'->>'laundry')::int = 2, 'Giovanna: 2 conclusões de lavanderia');
  perform pg_temp.ok((r->'s'->'categories'->>'dogs')::int = 1, 'rotina de cão conta em "dogs"');
  perform pg_temp.ok((r->'g'->>'heavy')::int = 2, 'tarefas pesadas contadas');
  perform pg_temp.ok((r->'g'->>'on_time')::int = 1, 'conclusões no horário contadas');
  perform pg_temp.ok((r->'s'->>'flash')::int >= 3, 'faxina relâmpago: 3 tarefas da Sabrina na mesma hora');
  perform pg_temp.ok((r->'s'->>'best_streak')::int = 2, 'recorde pessoal da Sabrina = 2');
end $$;

-- ── Aposta ──
insert into public.weekly_settings (household_id, week_start, bet) values ('88888888-0000-0000-0000-000000000001', date_trunc('week', public.ninho_today())::date, 'Quem perde escolhe o jantar')
on conflict (household_id, week_start) do update set bet = excluded.bet;
select pg_temp.ok((select bet from public.weekly_settings where household_id = '88888888-0000-0000-0000-000000000001') = 'Quem perde escolhe o jantar', 'aposta da semana salva');
select pg_temp.ok((select energy from public.weekly_settings where household_id = '88888888-0000-0000-0000-000000000001') = 'medium', 'salvar a aposta não mexe na energia');

reset role;
set role anon;
do $$ begin
  begin perform public.ninho_weekly_scores('88888888-0000-0000-0000-000000000001', public.ninho_today()); raise exception 'FALHOU: anon executou';
  exception when insufficient_privilege then raise notice 'ok - papel anon não lê o placar'; end;
end $$;
reset role;
