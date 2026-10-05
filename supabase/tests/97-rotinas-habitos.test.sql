-- Testes da migration 016 (rotinas com checklist e hábitos). Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('7c7c7c7c-0000-0000-0000-000000000001', 'Casa rotinas'), ('7c7c7c7c-0000-0000-0000-000000000002', 'Vizinha');
insert into auth.users (id, email) values
  ('7c7c7c7c-eeee-0000-0000-00000000000a', 'gio-rt@teste.com'),
  ('7c7c7c7c-eeee-0000-0000-00000000000b', 'sabi-rt@teste.com'),
  ('7c7c7c7c-eeee-0000-0000-00000000000c', 'vizinha-rt@teste.com');
select public.ninho_link_member('gio-rt@teste.com', 'g', '7c7c7c7c-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-rt@teste.com', 's', '7c7c7c7c-0000-0000-0000-000000000001');
select public.ninho_link_member('vizinha-rt@teste.com', 'g', '7c7c7c7c-0000-0000-0000-000000000002');
insert into public.routines (id, household_id, title, assign_mode) values ('7c7c7c7c-1111-0000-0000-000000000001', '7c7c7c7c-0000-0000-0000-000000000001', 'Fechar a cozinha', 'rotation');
insert into public.routine_steps (id, routine_id, household_id, position, title, survival) values
  ('7c7c7c7c-2222-0000-0000-000000000001', '7c7c7c7c-1111-0000-0000-000000000001', '7c7c7c7c-0000-0000-0000-000000000001', 0, 'Louça', true),
  ('7c7c7c7c-2222-0000-0000-000000000002', '7c7c7c7c-1111-0000-0000-000000000001', '7c7c7c7c-0000-0000-0000-000000000001', 1, 'Pia', false),
  ('7c7c7c7c-2222-0000-0000-000000000003', '7c7c7c7c-1111-0000-0000-000000000001', '7c7c7c7c-0000-0000-0000-000000000001', 2, 'Lixo', true);
insert into public.tasks (id, household_id, title, category, weight, frequency) values
  ('7c7c7c7c-3333-0000-0000-000000000001', '7c7c7c7c-0000-0000-0000-000000000001', 'Comprar lâmpada', 'general', 'light', 'once');

set role authenticated;
select pg_temp.as_user('7c7c7c7c-eeee-0000-0000-00000000000a');
do $$
declare r jsonb; rt uuid := '7c7c7c7c-1111-0000-0000-000000000001'; d date := public.ninho_today();
begin
  r := public.ninho_routine_step(rt, '7c7c7c7c-2222-0000-0000-000000000001', d, 's', true);
  perform pg_temp.ok(r->>'status' = 'open' and (r->>'have')::int = 1 and (r->>'need')::int = 3, 'marcar um passo: conclusão parcial (1 de 3)');
  perform pg_temp.ok((select done_by from public.routine_step_checks where step_id = '7c7c7c7c-2222-0000-0000-000000000001') = 'g', 'passo registra quem fez (a conta, não o informado)');
  r := public.ninho_routine_step(rt, '7c7c7c7c-2222-0000-0000-000000000001', d, 'g', true);
  perform pg_temp.ok((select count(*) from public.routine_step_checks) = 1 and (select count(*) from public.routine_runs where routine_id = rt) = 1, 'marcar de novo não duplica; uma ocorrência por dia');
  r := public.ninho_routine_step(rt, '7c7c7c7c-2222-0000-0000-000000000001', d, 'g', false);
  perform pg_temp.ok((r->>'have')::int = 0 and (select count(*) from public.routine_runs where routine_id = rt) = 1, 'desfazer o passo mantém a ocorrência');
  r := public.ninho_routine_finish(rt, d, 'g', true);
  perform pg_temp.ok(r->>'status' = 'done' and r->>'completed_by' = 'g' and (r->>'have')::int = 3, 'concluir a rotina inteira marca todos os passos');
  r := public.ninho_routine_finish(rt, d, 'g', false);
  perform pg_temp.ok(r->>'status' = 'open' and (select count(*) from public.routine_step_checks) = 3, 'reabrir mantém o histórico dos passos');
  r := public.ninho_routine_step(rt, '7c7c7c7c-2222-0000-0000-000000000002', d, 'g', false);
  perform pg_temp.ok(r->>'status' = 'open', 'desmarcar um passo deixa aberta');
  -- modo sobrevivência: só os passos 🛡 (Louça e Lixo) contam
  r := public.ninho_routine_step(rt, '7c7c7c7c-2222-0000-0000-000000000003', d, 'g', true, true);
  perform pg_temp.ok(r->>'status' = 'done' and (r->>'need')::int = 2, 'modo sobrevivência: versão reduzida conclui com os passos 🛡');
  -- ontem: outra ocorrência, histórico separado
  r := public.ninho_routine_finish(rt, d - 1, 'g', true);
  perform pg_temp.ok((select count(*) from public.routine_runs where routine_id = rt) = 2, 'cada dia tem sua ocorrência (histórico)');
  begin perform public.ninho_routine_finish(rt, d - 30, 'g', true); raise exception 'FALHOU: aceitou data antiga';
  exception when others then if sqlerrm like 'NINHO_INVALID_DATE%' then raise notice 'ok - data antiga é recusada'; else raise; end if; end;
  begin perform public.ninho_routine_step(rt, '7c7c7c7c-3333-0000-0000-000000000001', d, 'g', true); raise exception 'FALHOU: aceitou passo de outra coisa';
  exception when others then if sqlerrm like 'NINHO_NOT_FOUND%' then raise notice 'ok - passo de outra rotina é recusado'; else raise; end if; end;
end $$;
-- passo arquivado sai da conta, mas a marca antiga continua no histórico
update public.routine_steps set active = false where id = '7c7c7c7c-2222-0000-0000-000000000002';
select pg_temp.ok((public.ninho_routine_finish('7c7c7c7c-1111-0000-0000-000000000001', public.ninho_today() - 2, 'g', true)->>'need')::int = 2, 'passo arquivado não conta mais');
select pg_temp.ok((select count(*) from public.routine_step_checks where step_id = '7c7c7c7c-2222-0000-0000-000000000002') = 1, 'marca antiga do passo arquivado continua no histórico');
select pg_temp.ok((select count(*) from public.task_completions where task_id = '7c7c7c7c-3333-0000-0000-000000000001') = 0, 'rotina não mexe em tarefas');

-- Hábitos: registro do dia, sem fila de atraso, pausa e abandono sem perder histórico
insert into public.ninho_habits (id, household_id, title, owner, weekly_target) values ('7c7c7c7c-4444-0000-0000-000000000001', '7c7c7c7c-0000-0000-0000-000000000001', 'Preparar o dia seguinte', 'shared', 5);
insert into public.ninho_habit_logs (habit_id, household_id, date, who) values ('7c7c7c7c-4444-0000-0000-000000000001', '7c7c7c7c-0000-0000-0000-000000000001', public.ninho_today(), 'g');
do $$ begin
  begin insert into public.ninho_habit_logs (habit_id, household_id, date, who) values ('7c7c7c7c-4444-0000-0000-000000000001', '7c7c7c7c-0000-0000-0000-000000000001', public.ninho_today(), 's');
    raise exception 'FALHOU: dois registros no mesmo dia';
  exception when unique_violation then raise notice 'ok - um registro por hábito por dia'; end;
  begin insert into public.ninho_habits (household_id, title, weekly_target) values ('7c7c7c7c-0000-0000-0000-000000000001', 'X', 9); raise exception 'FALHOU: meta 9';
  exception when check_violation then raise notice 'ok - meta semanal entre 1 e 7'; end;
end $$;
update public.ninho_habits set archived_at = now() where id = '7c7c7c7c-4444-0000-0000-000000000001';
select pg_temp.ok((select count(*) from public.ninho_habit_logs where habit_id = '7c7c7c7c-4444-0000-0000-000000000001') = 1, 'abandonar o hábito mantém o histórico');

-- Outra casa
select pg_temp.as_user('7c7c7c7c-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.routine_runs) = 0 and (select count(*) from public.ninho_habits) = 0 and (select count(*) from public.ninho_habit_logs) = 0, 'outra casa não vê ocorrências nem hábitos');
do $$ begin
  begin perform public.ninho_routine_finish('7c7c7c7c-1111-0000-0000-000000000001', public.ninho_today(), 'g', true); raise exception 'FALHOU: concluiu rotina dos outros';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok - não conclui rotina de outra casa'; end;
end $$;
reset role;
select pg_temp.as_user(null);

set role anon;
do $$ begin
  begin perform public.ninho_routine_finish('7c7c7c7c-1111-0000-0000-000000000001', current_date, 'g', true); raise exception 'FALHOU: anon concluiu';
  exception when insufficient_privilege then raise notice 'ok - sem login não conclui rotina'; end;
end $$;
reset role;

-- A tabela "habits" de outro app (produção) continua intocada
do $$ declare n int; begin
  if to_regclass('public.habits') is null then raise notice 'ok - (sem tabela habits de outro app neste cenário)'; return; end if;
  execute 'select count(*) from public.habits' into n;
  perform pg_temp.ok(n = 2
      and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'habits' and column_name = 'archived_at')
      and not exists (select 1 from pg_policies where tablename = 'habits'),
    'tabela habits de outro app não foi alterada');
end $$;
