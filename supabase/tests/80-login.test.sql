-- Testes das migrations 010 (login) e 011 (segurança por casa). Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

-- Duas casas, três contas (uma sem casa)
insert into public.households (id, name) values
  ('33333333-0000-0000-0000-000000000001', 'Casa A'), ('33333333-0000-0000-0000-000000000002', 'Casa B');
insert into auth.users (id, email) values
  ('33333333-eeee-0000-0000-00000000000a', 'giovanna@teste.com'),
  ('33333333-eeee-0000-0000-00000000000b', 'Sabrina@Teste.com'),
  ('33333333-eeee-0000-0000-00000000000c', 'visita@teste.com'),
  ('33333333-eeee-0000-0000-00000000000d', 'outra@teste.com'),
  ('33333333-eeee-0000-0000-0000000000f1', 'antigo-anonimo@teste.com');
insert into public.tasks (id, household_id, title, category, weight, frequency) values
  ('33333333-aaaa-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Louça A', 'kitchen', 'light', 'daily'),
  ('33333333-aaaa-0000-0000-000000000002', '33333333-0000-0000-0000-000000000002', 'Louça B', 'kitchen', 'light', 'daily');
insert into public.profiles (id, household_id, name, role, display_name) values
  ('33333333-eeee-0000-0000-0000000000f1', '33333333-0000-0000-0000-000000000001', 'Antigo', 'g', 'Gio');

-- Ligar contas (só o dono do banco consegue)
select pg_temp.ok(public.ninho_link_member('giovanna@teste.com', 'g', '33333333-0000-0000-0000-000000000001') like 'ok:%', 'liga a conta da Giovanna');
select pg_temp.ok(public.ninho_link_member(' sabrina@teste.com ', 's', '33333333-0000-0000-0000-000000000001') like 'ok:%', 'e-mail sem diferenciar maiúsculas e espaços');
select public.ninho_link_member('outra@teste.com', 'g', '33333333-0000-0000-0000-000000000002');
select pg_temp.ok((select display_name from public.profiles where id = '33333333-eeee-0000-0000-00000000000a') = 'Gio', 'perfil novo herda o nome já usado no app');
do $$ begin
  begin perform public.ninho_link_member('ninguem@teste.com', 'g', '33333333-0000-0000-0000-000000000001'); raise exception 'FALHOU: achou e-mail inexistente';
  exception when others then if sqlerrm like 'NINHO_NOT_FOUND%' then raise notice 'ok - e-mail sem conta: avisa'; else raise; end if; end;
  begin perform public.ninho_link_member('giovanna@teste.com', 'x', '33333333-0000-0000-0000-000000000001'); raise exception 'FALHOU: aceitou pessoa x';
  exception when others then if sqlerrm like 'NINHO_INVALID_PERSON%' then raise notice 'ok - pessoa inválida: recusa'; else raise; end if; end;
end $$;

set role authenticated;
do $$ begin
  begin perform public.ninho_link_member('visita@teste.com', 'g', '33333333-0000-0000-0000-000000000001'); raise exception 'FALHOU: app conseguiu ligar conta';
  exception when insufficient_privilege then raise notice 'ok - o app não consegue se ligar a uma casa sozinho'; end;
end $$;

-- Giovanna: só a casa A
select pg_temp.as_user('33333333-eeee-0000-0000-00000000000a');
select pg_temp.ok((select who from public.household_members) = 'g', 'conta vê só a própria ligação (g)');
select pg_temp.ok((select string_agg(title, ',') from public.tasks where title like 'Louça _') = 'Louça A', 'vê só as tarefas da própria casa');
select pg_temp.ok((select count(*) from public.households where name like 'Casa _') = 1, 'vê só a própria casa');
do $$ declare r jsonb; begin
  r := public.ninho_complete_task('33333333-aaaa-0000-0000-000000000001', public.ninho_today(), 'g');
  perform pg_temp.ok((r->>'created')::boolean, 'conclui tarefa da própria casa');
  begin perform public.ninho_complete_task('33333333-aaaa-0000-0000-000000000002', public.ninho_today(), 'g'); raise exception 'FALHOU: concluiu tarefa de outra casa';
  exception when others then if sqlerrm like 'NINHO_NOT_FOUND%' then raise notice 'ok - tarefa de outra casa: não encontrada'; else raise; end if; end;
  begin insert into public.tasks (household_id, title, category, weight, frequency) values ('33333333-0000-0000-0000-000000000002', 'Invasão', 'general', 'light', 'daily'); raise exception 'FALHOU: criou tarefa em outra casa';
  exception when insufficient_privilege then raise notice 'ok - não cria nada em outra casa'; end;
  update public.tasks set title = 'Mudou' where id = '33333333-aaaa-0000-0000-000000000002';
  perform pg_temp.ok(true, 'update em outra casa não afeta nada (0 linhas)');
end $$;
select pg_temp.ok((select count(*) from public.profiles where household_id = '33333333-0000-0000-0000-000000000001') >= 2, 'vê os nomes da casa');
-- Sabrina: mesma casa
select pg_temp.as_user('33333333-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.task_completions where task_id = '33333333-aaaa-0000-0000-000000000001') = 1, 'Sabrina vê o que a Giovanna fez');
-- Conta sem casa e login anônimo antigo: nada
select pg_temp.as_user('33333333-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.tasks) = 0 and (select count(*) from public.households) = 0 and (select count(*) from public.household_members) = 0, 'conta sem casa não vê nada');
select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.tasks) = 0, 'sessão sem conta (anônimo antigo) não vê nada');
reset role;
select pg_temp.as_user(null);
select pg_temp.ok((select title from public.tasks where id = '33333333-aaaa-0000-0000-000000000002') = 'Louça B', 'outra casa intacta');

-- Servidor (bom dia, Telegram, IA) continua lendo tudo
set role service_role;
select pg_temp.ok((select count(*) from public.tasks where title like 'Louça _') = 2, 'servidor (service_role) continua com acesso');
reset role;

-- Trocar a conta de uma pessoa: a ligação antiga sai
select public.ninho_link_member('visita@teste.com', 's', '33333333-0000-0000-0000-000000000001');
select pg_temp.ok((select user_id from public.household_members where household_id = '33333333-0000-0000-0000-000000000001' and who = 's') = '33333333-eeee-0000-0000-00000000000c',
  'nova conta da Sabrina substitui a antiga');
select pg_temp.ok((select count(*) from pg_policies where schemaname = 'public' and policyname = 'allow_all_auth') = 0, 'nenhuma regra "qualquer um acessa" sobrou');
