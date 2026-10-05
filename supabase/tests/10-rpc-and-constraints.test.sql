-- Testes do banco (rodam nos dois cenários: banco novo e banco legado migrado).
-- Cria a própria casa de teste; cada bloco levanta exceção se algo falhar.
\set ON_ERROR_STOP on

create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create or replace function pg_temp.raises(sql text, expected text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if position(expected in sqlerrm) > 0 then raise notice 'ok - %', msg; return; end if;
    raise exception 'FALHOU: % (erro inesperado: %)', msg, sqlerrm;
  end;
  raise exception 'FALHOU: % (não levantou erro)', msg;
end $$;

-- ── Fixtures da casa de teste (como superusuário) ──
insert into public.households (id, name) values ('99999999-0000-0000-0000-000000000001', 'Casa teste'), ('99999999-0000-0000-0000-000000000002', 'Vizinha');
insert into public.tasks (id, household_id, title, weight, frequency) values
  ('99999999-aaaa-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'Leve', 'light', 'daily'),
  ('99999999-aaaa-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'Pesada', 'heavy', 'weekly'),
  ('99999999-aaaa-0000-0000-000000000003', '99999999-0000-0000-0000-000000000002', 'Da vizinha', 'medium', 'daily');
insert into public.dogs (id, household_id, name) values
  ('99999999-dddd-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'Cão 1'),
  ('99999999-dddd-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'Cão 2');
insert into public.dog_routines (id, dog_id, household_id, title, frequency) values
  ('99999999-eeee-0000-0000-000000000001', '99999999-dddd-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'Ração', 'daily'),
  ('99999999-eeee-0000-0000-000000000002', '99999999-dddd-0000-0000-000000000002', null, 'Ração', 'daily');

-- Daqui em diante, como o app: papel authenticated (login anônimo)
set role authenticated;

-- ── Datas ──
select pg_temp.ok(public.ninho_local_date('2026-10-05 02:30:00+00') = '2026-10-04', '02:30 UTC ainda é dia 04 em São Paulo (23:30)');
select pg_temp.ok(public.ninho_local_date('2026-10-05 03:00:00+00') = '2026-10-05', '03:00 UTC já é dia 05 em São Paulo (00:00)');
select pg_temp.ok(public.ninho_local_date('2027-01-01 02:59:00+00') = '2026-12-31', 'virada do ano: 23:59 de 31/12 em São Paulo');
select pg_temp.ok(public.ninho_today() = (now() at time zone 'America/Sao_Paulo')::date, 'ninho_today usa São Paulo');

-- ── Concluir tarefa: idempotente ──
do $$
declare r1 jsonb; r2 jsonb; t date := public.ninho_today();
begin
  r1 := public.ninho_complete_task('99999999-aaaa-0000-0000-000000000001', t, 'g');
  r2 := public.ninho_complete_task('99999999-aaaa-0000-0000-000000000001', t, 's');
  perform pg_temp.ok((r1->>'created')::boolean, '1ª conclusão cria o registro');
  perform pg_temp.ok(not (r2->>'created')::boolean, '2ª conclusão (clique duplo) não cria outro');
  perform pg_temp.ok(r2->>'completed_by' = 'g', 'quem concluiu primeiro é mantido');
  perform pg_temp.ok((select count(*) from public.task_completions where task_id = '99999999-aaaa-0000-0000-000000000001' and date = t) = 1, 'uma conclusão por tarefa/dia');
  perform pg_temp.ok((select count(*) from public.xp_history where reason = public.ninho_xp_reason('task','99999999-aaaa-0000-0000-000000000001', t) and voided_at is null) = 1, 'um XP por conclusão');
  perform pg_temp.ok((select completed_by from public.task_completions where task_id = '99999999-aaaa-0000-0000-000000000001' and date = t) = 'g', 'completed_by gravado');
  perform pg_temp.ok((select household_id from public.task_completions where task_id = '99999999-aaaa-0000-0000-000000000001' and date = t) = '99999999-0000-0000-0000-000000000001', 'conclusão com household_id');
end $$;

-- XP pelo peso
do $$
declare r jsonb; t date := public.ninho_today();
begin
  r := public.ninho_complete_task('99999999-aaaa-0000-0000-000000000002', t, 's');
  perform pg_temp.ok((r->>'xp')::int = 3, 'tarefa pesada vale 3 XP');
  perform pg_temp.ok(public.ninho_household_xp('99999999-0000-0000-0000-000000000001') = 4, 'XP da casa = 1 + 3');
end $$;

-- Desfazer remove só o XP daquela conclusão; repetir não faz nada
do $$
declare r jsonb; t date := public.ninho_today();
begin
  r := public.ninho_uncomplete_task('99999999-aaaa-0000-0000-000000000001', t);
  perform pg_temp.ok((r->>'removed')::boolean, 'desfazer remove a conclusão');
  r := public.ninho_uncomplete_task('99999999-aaaa-0000-0000-000000000001', t);
  perform pg_temp.ok(not (r->>'removed')::boolean, 'desfazer de novo não quebra');
  perform pg_temp.ok(public.ninho_household_xp('99999999-0000-0000-0000-000000000001') = 3, 'XP da outra tarefa continua (3)');
  perform pg_temp.ok((select count(*) from public.task_completions where task_id = '99999999-aaaa-0000-0000-000000000001') = 0, 'conclusão apagada');
  r := public.ninho_complete_task('99999999-aaaa-0000-0000-000000000001', t, 's');
  perform pg_temp.ok((r->>'created')::boolean and r->>'completed_by' = 's', 'concluir de novo depois de desfazer funciona');
  perform pg_temp.ok(public.ninho_household_xp('99999999-0000-0000-0000-000000000001') = 4, 'XP volta a 4');
end $$;

-- Entradas inválidas não gravam nada
select pg_temp.raises($$select public.ninho_complete_task('99999999-aaaa-0000-0000-000000000001', public.ninho_today(), 'x')$$, 'NINHO_INVALID_PERSON', 'pessoa inválida é recusada');
select pg_temp.raises($$select public.ninho_complete_task('99999999-aaaa-0000-0000-000000000001', public.ninho_today(), null)$$, 'NINHO_INVALID_PERSON', 'pessoa vazia é recusada');
select pg_temp.raises($$select public.ninho_complete_task('99999999-aaaa-0000-0000-000000000001', public.ninho_today() - 5, 'g')$$, 'NINHO_INVALID_DATE', 'data antiga é recusada');
select pg_temp.raises($$select public.ninho_complete_task('99999999-aaaa-0000-0000-0000000000ff', public.ninho_today(), 'g')$$, 'NINHO_NOT_FOUND', 'tarefa inexistente é recusada');
select pg_temp.ok((select count(*) from public.xp_history where reason like 'task:99999999-aaaa-0000-0000-0000000000ff%') = 0, 'falha ao concluir não concede XP');

-- Índice único impede XP duplicado mesmo fora das funções
select pg_temp.raises(format($$insert into public.xp_history (household_id, amount, reason) values ('99999999-0000-0000-0000-000000000001', 1, %L)$$,
  public.ninho_xp_reason('task','99999999-aaaa-0000-0000-000000000001', public.ninho_today())), 'xp_history_one_valid_per_reason', 'insert direto de XP duplicado é bloqueado');
select pg_temp.raises($$insert into public.task_completions (task_id, date, completed_by) values ('99999999-aaaa-0000-0000-000000000002', public.ninho_today(), 'x')$$, 'completed_by_check', 'completed_by fora de g/s é bloqueado');

-- ── Rotinas dos cães em lote ──
do $$
declare r jsonb; t date := public.ninho_today();
  ids uuid[] := array['99999999-eeee-0000-0000-000000000001','99999999-eeee-0000-0000-000000000002']::uuid[];
begin
  r := public.ninho_complete_dog_routines(ids, t, 's');
  perform pg_temp.ok((r->>'created')::int = 2 and (r->>'xp_added')::int = 2, 'lote conclui 2 rotinas com 2 XP');
  r := public.ninho_complete_dog_routines(ids || ids, t, 'g');
  perform pg_temp.ok((r->>'created')::int = 0 and (r->>'xp_added')::int = 0, 'repetir o lote (ids repetidos) não duplica');
  perform pg_temp.ok((select count(*) from public.dog_completions where date = t and routine_id = any (ids)) = 2, 'duas conclusões de rotina');
  perform pg_temp.ok((select bool_and(completed_by = 's') from public.dog_completions where date = t and routine_id = any (ids)), 'completed_by das rotinas gravado');
  perform pg_temp.ok((select bool_and(household_id = '99999999-0000-0000-0000-000000000001') from public.dog_completions where date = t and routine_id = any (ids)), 'household_id preenchido (inclusive rotina sem household_id)');
  r := public.ninho_uncomplete_dog_routines(ids, t);
  perform pg_temp.ok((r->>'removed')::int = 2, 'desfazer o lote remove 2');
  perform pg_temp.ok(public.ninho_household_xp('99999999-0000-0000-0000-000000000001') = 4, 'XP das rotinas removido, das tarefas mantido');
end $$;

select pg_temp.raises($$select public.ninho_complete_dog_routines(array['99999999-eeee-0000-0000-000000000001','99999999-eeee-0000-0000-0000000000ff']::uuid[], public.ninho_today(), 'g')$$, 'NINHO_NOT_FOUND', 'lote com rotina inexistente é recusado');
select pg_temp.ok((select count(*) from public.dog_completions where routine_id = '99999999-eeee-0000-0000-000000000001' and date = public.ninho_today()) = 0, 'lote recusado não grava nenhuma rotina (tudo ou nada)');

-- App antigo em cache inserindo sem household_id: o gatilho completa
insert into public.dog_completions (routine_id, date) values ('99999999-eeee-0000-0000-000000000001', public.ninho_today() - 1);
select pg_temp.ok((select household_id from public.dog_completions where routine_id = '99999999-eeee-0000-0000-000000000001' and date = public.ninho_today() - 1) = '99999999-0000-0000-0000-000000000001', 'gatilho preenche household_id em insert antigo');
select pg_temp.ok((select completed_by from public.dog_completions where routine_id = '99999999-eeee-0000-0000-000000000001' and date = public.ninho_today() - 1) is null, 'insert antigo fica como não identificado (null)');

-- ── Sequência ──
do $$
declare t date := public.ninho_today();
begin
  -- hoje: tarefa 1 (s); ontem: rotina (insert acima); anteontem: tarefa 2
  insert into public.task_completions (task_id, date, completed_by) values ('99999999-aaaa-0000-0000-000000000002', t - 2, 'g');
  perform pg_temp.ok(public.ninho_streak('99999999-0000-0000-0000-000000000001', t) = 3, 'sequência de 3 dias (tarefas e rotinas)');
  perform pg_temp.ok(public.ninho_streak('99999999-0000-0000-0000-000000000001', t + 1) = 3, 'dia sem conclusão ainda: conta até ontem');
  perform pg_temp.ok(public.ninho_streak('99999999-0000-0000-0000-000000000001', t + 2) = 0, 'um dia inteiro sem nada zera');
  perform pg_temp.ok(public.ninho_streak('99999999-0000-0000-0000-000000000002', t) = 0, 'outra casa não herda a sequência');
end $$;

-- ── Isolamento por casa ──
do $$
declare t date := public.ninho_today();
begin
  perform public.ninho_complete_task('99999999-aaaa-0000-0000-000000000003', t, 'g');
  perform pg_temp.ok(public.ninho_household_xp('99999999-0000-0000-0000-000000000002') = 2, 'XP vai para a casa da tarefa');
  perform pg_temp.ok(public.ninho_household_xp('99999999-0000-0000-0000-000000000001') = 4, 'XP da casa de teste não muda');
  perform pg_temp.ok((select household_id from public.task_completions where task_id = '99999999-aaaa-0000-0000-000000000003') = '99999999-0000-0000-0000-000000000002', 'conclusão gravada na casa certa');
end $$;

-- ── Defaults de data no fuso da casa ──
insert into public.puppy_accidents (dog_id, household_id, location) values ('99999999-dddd-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'Sala');
select pg_temp.ok((select date from public.puppy_accidents where household_id = '99999999-0000-0000-0000-000000000001') = public.ninho_today(), 'acidente sem data usa o dia de São Paulo');

reset role;
set role anon;
select pg_temp.raises($$select public.ninho_complete_task('99999999-aaaa-0000-0000-000000000001', public.ninho_today(), 'g')$$, 'permission denied', 'papel anon (sem login) não executa as funções de conclusão');
select pg_temp.raises($$select public.ninho_household_xp('99999999-0000-0000-0000-000000000001')$$, 'permission denied', 'papel anon não lê o XP');
reset role;
select pg_temp.ok(true, 'testes do banco concluídos');
