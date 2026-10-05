-- Testes da migration 014 (configuração inicial e rotinas). Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values
  ('5a5a5a5a-0000-0000-0000-000000000001', 'Casa onboarding'), ('5a5a5a5a-0000-0000-0000-000000000002', 'Outra casa');
insert into auth.users (id, email) values
  ('5a5a5a5a-eeee-0000-0000-00000000000a', 'gio-onb@teste.com'),
  ('5a5a5a5a-eeee-0000-0000-00000000000b', 'outra-onb@teste.com'),
  ('5a5a5a5a-eeee-0000-0000-0000000000f2', 'sabi-onb@teste.com');
select public.ninho_link_member('gio-onb@teste.com', 'g', '5a5a5a5a-0000-0000-0000-000000000001');
select public.ninho_link_member('outra-onb@teste.com', 's', '5a5a5a5a-0000-0000-0000-000000000002');
insert into public.profiles (id, household_id, name, role, display_name) values
  ('5a5a5a5a-eeee-0000-0000-0000000000f2', '5a5a5a5a-0000-0000-0000-000000000001', 'Sabrina', 's', 'Sabrina')
on conflict (id) do nothing;
insert into public.dogs (id, household_id, name, active) values
  ('5a5a5a5a-dddd-0000-0000-000000000001', '5a5a5a5a-0000-0000-0000-000000000001', 'Penelope', true);
insert into public.tasks (id, household_id, title, category, weight, frequency) values
  ('5a5a5a5a-aaaa-0000-0000-000000000001', '5a5a5a5a-0000-0000-0000-000000000001', 'Louça', 'kitchen', 'light', 'daily'),
  ('5a5a5a5a-aaaa-0000-0000-000000000002', '5a5a5a5a-0000-0000-0000-000000000002', 'Louça da outra casa', 'kitchen', 'light', 'daily');

\set payload '{"names":{"g":"Giovanna","s":" Sabi "},"dogs":[{"id":"5a5a5a5a-dddd-0000-0000-000000000001","name":"Penélope"},{"id":null,"name":"Zelda"},{"id":null,"name":"zelda"}],"routines":[{"key":"cozinha_fechada","title":"Fechar a cozinha","category":"cozinha","weekdays":[0,1,2,3,4,5,6],"time":"21:30","duration":15,"assign":"rotation","essential":true,"steps":[{"title":"Louça","survival":true},{"title":"Pia limpa"},{"title":"  "}]},{"key":"reset_domingo","title":"Reset de domingo","category":"semana","weekdays":[0],"assign":"shared","steps":[{"title":"Roupa de cama"}]}],"essential_task_ids":["5a5a5a5a-aaaa-0000-0000-000000000001","5a5a5a5a-aaaa-0000-0000-000000000002"],"answers":{"pains":["divisao","rotina"],"theme":"aconchego"}}'

set role authenticated;
select pg_temp.as_user('5a5a5a5a-eeee-0000-0000-00000000000a');
do $$ begin
  insert into public.onboarding_progress (household_id, who, step, answers) values ('5a5a5a5a-0000-0000-0000-000000000001', 'g', 4, '{"pains":["divisao"]}');
  update public.onboarding_progress set step = 5 where household_id = '5a5a5a5a-0000-0000-0000-000000000001' and who = 'g';
  perform pg_temp.ok((select step from public.onboarding_progress where household_id = '5a5a5a5a-0000-0000-0000-000000000001' and who = 'g') = 5, 'progresso guardado para continuar depois');
end $$;

create temp table r1 as select public.ninho_finish_onboarding('5a5a5a5a-0000-0000-0000-000000000001', 's', :'payload'::jsonb) as r;
select pg_temp.ok((select (r->>'routines_created')::int = 2 and (r->>'routines_existing')::int = 0 from r1), 'cria as rotinas escolhidas');
select pg_temp.ok((select count(*) from public.routine_steps s join public.routines r on r.id = s.routine_id where r.template_key = 'cozinha_fechada') = 2, 'passos criados (passo em branco ignorado)');
select pg_temp.ok((select survival from public.routine_steps where title = 'Louça'), 'passo marcado para o modo sobrevivência');
select pg_temp.ok((select weekdays is null and assign_mode = 'rotation' and essential and scheduled_time = '21:30' from public.routines where template_key = 'cozinha_fechada'), 'todos os dias = sem restrição; rodízio; essencial; horário');
select pg_temp.ok((select weekdays = array[0]::smallint[] from public.routines where template_key = 'reset_domingo'), 'dias da semana guardados');
select pg_temp.ok((select display_name from public.profiles where household_id = '5a5a5a5a-0000-0000-0000-000000000001' and role = 's') = 'Sabi', 'nome editado (sem espaços)');
select pg_temp.ok((select name from public.dogs where id = '5a5a5a5a-dddd-0000-0000-000000000001') = 'Penélope', 'nome do cão corrigido');
select pg_temp.ok((select count(*) from public.dogs where household_id = '5a5a5a5a-0000-0000-0000-000000000001') = 2 and (select (r->>'dogs_created')::int from r1) = 1, 'cão novo criado uma vez só (nome repetido ignorado)');
select pg_temp.ok((select essential from public.tasks where id = '5a5a5a5a-aaaa-0000-0000-000000000001') and (select (r->>'essentials_marked')::int from r1) = 1, 'tarefa existente vira essencial');
select pg_temp.ok((select completed_by = 'g' and completed_at is not null and answers->'pains' ? 'divisao' from public.household_setup where household_id = '5a5a5a5a-0000-0000-0000-000000000001'),
  'configuração salva; quem concluiu vem da conta (não do que o aparelho mandou)');

-- Concluir de novo: nada duplica
create temp table r2 as select public.ninho_finish_onboarding('5a5a5a5a-0000-0000-0000-000000000001', 'g', :'payload'::jsonb) as r;
select pg_temp.ok((select (r->>'routines_created')::int = 0 and (r->>'routines_existing')::int = 2 and (r->>'dogs_created')::int = 0 from r2), 'concluir duas vezes não duplica rotinas nem cães');
select pg_temp.ok((select count(*) from public.routines where household_id = '5a5a5a5a-0000-0000-0000-000000000001') = 2
  and (select count(*) from public.routine_steps where household_id = '5a5a5a5a-0000-0000-0000-000000000001') = 3, 'mesma quantidade de rotinas e passos');
select pg_temp.ok((select count(*) from public.tasks where household_id = '5a5a5a5a-0000-0000-0000-000000000001') = 1, 'nenhuma tarefa apagada ou criada');

do $$ begin
  begin
    perform public.ninho_finish_onboarding('5a5a5a5a-0000-0000-0000-000000000001', 'g', '{"routines":[{"title":"X","assign":"todo mundo"}]}');
    raise exception 'FALHOU: aceitou responsável inválido';
  exception when check_violation then raise notice 'ok - responsável inválido é recusado'; end;
end $$;

-- A outra casa não vê nem altera
select pg_temp.as_user('5a5a5a5a-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.household_setup where household_id = '5a5a5a5a-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.routines where household_id = '5a5a5a5a-0000-0000-0000-000000000001') = 0, 'outra casa não enxerga a configuração nem as rotinas');
select pg_temp.ok((select essential from public.tasks where id = '5a5a5a5a-aaaa-0000-0000-000000000002') = false, 'tarefa de outra casa não foi alterada');
do $$ begin
  begin
    perform public.ninho_finish_onboarding('5a5a5a5a-0000-0000-0000-000000000001', 's', '{"routines":[{"key":"invasao","title":"Invasão"}]}');
    raise exception 'FALHOU: configurou a casa dos outros';
  exception when insufficient_privilege or others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    raise notice 'ok - não configura a casa dos outros (%)', left(sqlerrm, 60);
  end;
end $$;
reset role;
select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.routines where template_key = 'invasao') = 0, 'nada gravado na tentativa da outra casa');

set role anon;
do $$ begin
  begin perform public.ninho_finish_onboarding('5a5a5a5a-0000-0000-0000-000000000001', 'g', '{}'); raise exception 'FALHOU: anon configurou';
  exception when insufficient_privilege then raise notice 'ok - sem login não configura'; end;
end $$;
reset role;
