-- Testes da migration 043 (erros do app e backup): o backup leva os dados da casa e deixa de fora o
-- Meu dia e o que é técnico, guarda só os 8 últimos, só o servidor monta; o registro de erros aceita
-- erros da casa e do servidor (casa nula). Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

insert into public.households (id, name) values ('c9c9c9c9-0000-0000-0000-0000000000c1', 'Casa backup') on conflict (id) do nothing;
insert into public.tasks (id, household_id, title, category, frequency) values ('c9c9c9c9-4444-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c1', 'Tarefa do backup', 'general', 'daily') on conflict (id) do nothing;
do $$ begin
  if to_regclass('public.personal_logs') is not null then
    execute $q$insert into public.personal_logs (household_id, who, date, kind, value) values ('c9c9c9c9-0000-0000-0000-0000000000c1', 'g', '2026-11-01', 'agua', 250)$q$;
  end if;
end $$;

select pg_temp.ok((public.ninho_household_backup('c9c9c9c9-0000-0000-0000-0000000000c1')->'tables'->'tasks'->0->>'title') = 'Tarefa do backup', 'o backup leva as tarefas da casa');
select pg_temp.ok(not (public.ninho_household_backup('c9c9c9c9-0000-0000-0000-0000000000c1')->'tables' ? 'personal_logs'), 'o Meu dia (pessoal) fica de fora');
select pg_temp.ok(not (public.ninho_household_backup('c9c9c9c9-0000-0000-0000-0000000000c1')->'tables' ? 'push_subscriptions'), 'as inscrições de notificação ficam de fora');
select pg_temp.ok((public.ninho_household_backup('c9c9c9c9-0000-0000-0000-0000000000c1')->>'ninho_backup') = 'v2', 'formato v2');

do $$ begin for i in 1..10 loop perform public.ninho_save_backup('c9c9c9c9-0000-0000-0000-0000000000c1', case when i = 10 then 'manual' else 'auto' end); end loop; end $$;
select pg_temp.ok((select count(*) from public.household_backups where household_id = 'c9c9c9c9-0000-0000-0000-0000000000c1') = 8, 'guarda só os 8 últimos');
select pg_temp.ok((select count(*) from public.household_backups where household_id = 'c9c9c9c9-0000-0000-0000-0000000000c1' and kind = 'manual') = 1, 'o feito na hora fica marcado');
select pg_temp.ok((select size_bytes > 100 from public.household_backups where household_id = 'c9c9c9c9-0000-0000-0000-0000000000c1' limit 1), 'tamanho registrado');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.ninho_save_backup(uuid, text)', 'execute'), 'só o servidor monta o backup');
select pg_temp.ok((select count(*) from pg_policies where tablename = 'household_backups' and cmd = 'SELECT') = 1, 'quem é da casa só lê os backups');

insert into public.app_errors (household_id, who, context, message) values ('c9c9c9c9-0000-0000-0000-0000000000c1', 'g', 'carregar tarefas', 'falhou');
insert into public.app_errors (household_id, context, message) values (null, 'servidor: lembretes', 'telegram 500');
select pg_temp.ok((select count(*) from public.app_errors where context in ('carregar tarefas', 'servidor: lembretes')) = 2, 'erros da casa e do servidor');
do $$ begin
  begin insert into public.app_errors (household_id, context, message) values (null, '', 'x'); raise exception 'FALHOU: aceitou contexto vazio';
  exception when check_violation then raise notice 'ok - contexto obrigatório'; end;
end $$;
delete from public.app_errors where context in ('carregar tarefas', 'servidor: lembretes');
delete from public.households where id = 'c9c9c9c9-0000-0000-0000-0000000000c1';
select pg_temp.ok((select count(*) from public.household_backups where household_id = 'c9c9c9c9-0000-0000-0000-0000000000c1') = 0, 'apagar a casa apaga os backups');
