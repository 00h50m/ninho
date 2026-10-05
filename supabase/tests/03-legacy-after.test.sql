-- Cenário legado: depois das migrations (aplicadas duas vezes), nada foi perdido.
\set ON_ERROR_STOP on

create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

do $$
declare r record; n bigint;
begin
  for r in select * from test_meta.counts_before loop
    execute format('select count(*) from public.%I', r.t) into n;
    perform pg_temp.ok(n = r.n, format('%s preservada (%s linhas)', r.t, r.n));
  end loop;
end $$;

select pg_temp.ok((select count(*) from public.xp_history where voided_at is not null) = 1, 'XP duplicado antigo foi anulado, não apagado');
select pg_temp.ok(public.ninho_household_xp('11111111-1111-1111-1111-111111111111') = 7, 'XP válido da casa = 1 + 1 + 5 (sem o duplicado)');
select pg_temp.ok(public.get_household_xp('11111111-1111-1111-1111-111111111111') = 8, 'função antiga get_household_xp continua existindo, intocada');
select pg_temp.ok(public.get_streak('11111111-1111-1111-1111-111111111111') = 0, 'função antiga get_streak continua intocada');
select pg_temp.ok((select count(*) from public.dog_completions where household_id is null) = 0, 'dog_completions recebeu household_id em todas as linhas');
select pg_temp.ok((select is_nullable from information_schema.columns where table_name = 'dog_completions' and column_name = 'household_id') = 'NO', 'dog_completions.household_id virou NOT NULL depois do backfill');
select pg_temp.ok((select household_id from public.dog_routines where id = 'eeeeeeee-0000-0000-0000-000000000001') = '11111111-1111-1111-1111-111111111111', 'rotina antiga recebeu household_id do cão');
select pg_temp.ok((select count(*) from public.task_completions where completed_by is null) = 2, 'conclusões antigas continuam sem autoria (não identificado)');
select pg_temp.ok(exists (select 1 from pg_constraint where conrelid = 'public.xp_history'::regclass and contype = 'p'), 'xp_history ganhou chave primária');
select pg_temp.ok((select count(*) from public.xp_history where id is null) = 0, 'todas as linhas de XP têm id');
select pg_temp.ok(public.ninho_streak('11111111-1111-1111-1111-111111111111', public.ninho_today()) >= 1, 'sequência calculada a partir dos dados antigos');
select pg_temp.ok((select display_name from public.profiles where role = 's' and household_id = '11111111-1111-1111-1111-111111111111') = 'Sabrina', 'nomes preservados');
