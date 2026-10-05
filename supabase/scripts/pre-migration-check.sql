-- ══════════════════════════════════════════════════════════════════════
-- Ninho · Diagnóstico ANTES das migrations da Fase 0 (somente leitura)
--
-- Cole no SQL Editor do Supabase e clique em Run. Não altera nada.
-- O resultado é uma tabela: check | status | detalhe.
--   ok       → tudo certo
--   AVISO    → a migration trata sozinha (ex.: XP duplicado é anulado)
--   BLOQUEIO → a migration vai falhar; me mande o resultado antes de rodar
-- ══════════════════════════════════════════════════════════════════════

create temp table if not exists ninho_check (ordem serial, "check" text, status text, detalhe text);
truncate ninho_check;

do $$
declare
  t text; n bigint;
  expected text[] := array['households','profiles','tasks','task_completions','dogs','dog_routines',
                           'dog_completions','weekly_settings','weekly_meetings','xp_history','puppy_accidents'];
begin
  -- Tabelas
  foreach t in array expected loop
    if to_regclass('public.' || t) is null then
      insert into ninho_check("check", status, detalhe) values ('tabela ' || t, 'AVISO', 'não existe; será criada');
    else
      execute format('select count(*) from public.%I', t) into n;
      insert into ninho_check("check", status, detalhe) values ('tabela ' || t, 'ok', n || ' linhas');
    end if;
  end loop;

  -- XP duplicado (mesma casa + mesma origem)
  if to_regclass('public.xp_history') is not null then
    execute $q$select coalesce(sum(c - 1), 0) from (
      select count(*) c from public.xp_history where reason is not null group by household_id, reason having count(*) > 1) x$q$ into n;
    insert into ninho_check("check", status, detalhe) values ('XP duplicado', case when n = 0 then 'ok' else 'AVISO' end,
      case when n = 0 then 'nenhum' else n || ' lançamento(s) a mais; serão ANULADOS (voided_at), não apagados' end);
  end if;

  -- Conclusões de rotina que não acham a casa (rotina/cão apagados de verdade)
  if to_regclass('public.dog_completions') is not null then
    execute $q$select count(*) from public.dog_completions dc
      left join public.dog_routines r on r.id = dc.routine_id
      left join public.dogs d on d.id = r.dog_id
      where coalesce(r.household_id, d.household_id) is null$q$ into n;
    insert into ninho_check("check", status, detalhe) values ('rotinas concluídas sem casa', case when n = 0 then 'ok' else 'AVISO' end,
      case when n = 0 then 'nenhuma' else n || ' linha(s); household_id ficará opcional nessa tabela' end);
  end if;

  -- Duplicidades que impediriam índices únicos
  if to_regclass('public.weekly_meetings') is not null then
    execute 'select count(*) from (select 1 from public.weekly_meetings group by household_id, week_start having count(*) > 1) x' into n;
    insert into ninho_check("check", status, detalhe) values ('reuniões repetidas na mesma semana', case when n = 0 then 'ok' else 'BLOQUEIO' end, n || ' semana(s)');
  end if;
  if to_regclass('public.weekly_settings') is not null then
    execute 'select count(*) from (select 1 from public.weekly_settings group by household_id, week_start having count(*) > 1) x' into n;
    insert into ninho_check("check", status, detalhe) values ('ajustes repetidos na mesma semana', case when n = 0 then 'ok' else 'BLOQUEIO' end, n || ' semana(s)');
  end if;
  if to_regclass('public.task_completions') is not null then
    execute 'select count(*) from (select 1 from public.task_completions group by task_id, date having count(*) > 1) x' into n;
    insert into ninho_check("check", status, detalhe) values ('conclusões repetidas no mesmo dia', case when n = 0 then 'ok' else 'BLOQUEIO' end, n || ' caso(s)');
  end if;

  -- profiles.display_name
  insert into ninho_check("check", status, detalhe)
  select 'coluna profiles.display_name',
         case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='display_name') then 'ok' else 'AVISO' end,
         'usada pelo app para os nomes';

  -- Funções antigas (serão mantidas; guarde a definição)
  insert into ninho_check("check", status, detalhe)
  select 'função ' || p.proname, 'ok', 'existe (será mantida). Definição: ' || replace(pg_get_functiondef(p.oid), E'\n', ' ')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('get_household_xp', 'get_streak');

  -- Realtime
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    insert into ninho_check("check", status, detalhe)
    select 'realtime', 'ok', 'publicadas: ' || coalesce(string_agg(tablename, ', ' order by tablename), 'nenhuma')
    from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public';
  end if;
end $$;

select "check", status, detalhe from ninho_check order by ordem;
