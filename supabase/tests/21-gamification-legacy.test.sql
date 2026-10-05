-- Cenário legado: o backfill da 005 preencheu o dia dos lançamentos antigos.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
select pg_temp.ok((select count(*) from public.xp_history where household_id = '11111111-1111-1111-1111-111111111111' and reason like 'task:%' and activity_date is null) = 0, 'XP antigo recebeu activity_date pelo backfill');
select pg_temp.ok((select count(*) from public.xp_history where household_id = '11111111-1111-1111-1111-111111111111' and reason like 'task:%' and earned_by is not null) = 0, 'XP antigo sem autoria continua sem autoria (não identificado)');
select pg_temp.ok(((public.ninho_weekly_scores('11111111-1111-1111-1111-111111111111', date_trunc('week', public.ninho_today())::date))->'unknown'->>'done')::int >= 0, 'placar separa o XP não identificado');
