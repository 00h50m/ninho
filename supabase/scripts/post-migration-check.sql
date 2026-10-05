-- ══════════════════════════════════════════════════════════════════════
-- Ninho · Validação DEPOIS das migrations 001–006 (somente leitura)
--
-- Cole no SQL Editor do Supabase e clique em Run. Não altera nada.
-- Tudo deve sair "ok". Qualquer "FALHA" → não publique o app novo e me
-- mande o resultado.
-- ══════════════════════════════════════════════════════════════════════

create temp table if not exists ninho_check (ordem serial, "check" text, status text, detalhe text);
truncate ninho_check;

do $$
declare
  r record; n bigint;
begin
  -- Colunas que o app novo lê ou grava
  for r in select * from (values
    ('profiles','display_name'), ('tasks','updated_at'),
    ('task_completions','completed_by'), ('task_completions','household_id'),
    ('dog_completions','completed_by'), ('dog_completions','household_id'),
    ('weekly_meetings','reward'), ('xp_history','voided_at'), ('xp_history','id'),
    ('puppy_accidents','occurred_at'),
    -- Fase 1 (migration 005)
    ('xp_history','earned_by'), ('xp_history','activity_date'), ('xp_history','on_time'), ('weekly_settings','bet'),
    -- Fase 2 (migration 006)
    ('push_subscriptions','endpoint'), ('push_log','kind')
  ) v(t, c) loop
    insert into ninho_check("check", status, detalhe)
    select 'coluna ' || r.t || '.' || r.c,
           case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = r.t and column_name = r.c) then 'ok' else 'FALHA' end, '';
  end loop;

  -- Funções novas
  for r in select unnest(array['ninho_today','ninho_local_date','ninho_complete_task','ninho_uncomplete_task',
                               'ninho_complete_dog_routines','ninho_uncomplete_dog_routines',
                               'ninho_household_xp','ninho_streak',
                               -- Fase 1 (migration 005)
                               'ninho_is_on_time','ninho_xp_with_bonus','ninho_streaks','ninho_weekly_scores','ninho_achievement_stats',
                               -- Fase 2 (migration 006)
                               'ninho_save_push_subscription']) as f loop
    insert into ninho_check("check", status, detalhe)
    select 'função ' || r.f,
           case when exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = r.f) then 'ok' else 'FALHA' end, '';
  end loop;

  -- Índice que impede XP duplicado
  insert into ninho_check("check", status, detalhe)
  select 'índice único de XP', case when to_regclass('public.xp_history_one_valid_per_reason') is not null then 'ok' else 'FALHA' end, '';

  -- Sem as colunas e funções acima, as conferências abaixo não têm como rodar.
  if exists (select 1 from ninho_check where status = 'FALHA') then
    insert into ninho_check("check", status, detalhe) values ('migrations', 'FALHA',
      'migrations ainda não aplicadas (ou aplicadas pela metade). Rode as 6 migrations em ordem e depois este script de novo.');
    return;
  end if;

  -- Nenhum XP válido duplicado
  select count(*) into n from (select 1 from public.xp_history where reason is not null and voided_at is null group by household_id, reason having count(*) > 1) x;
  insert into ninho_check("check", status, detalhe) values ('XP válido duplicado', case when n = 0 then 'ok' else 'FALHA' end, n || ' caso(s)');

  select count(*) into n from public.xp_history where voided_at is not null;
  insert into ninho_check("check", status, detalhe) values ('XP anulado (duplicados antigos)', 'ok', n || ' lançamento(s) preservados com voided_at');

  -- Conclusões de rotina com casa
  select count(*) into n from public.dog_completions where household_id is null;
  insert into ninho_check("check", status, detalhe) values ('rotinas concluídas sem casa', case when n = 0 then 'ok' else 'AVISO' end, n || ' linha(s)');

  -- Data doméstica
  insert into ninho_check("check", status, detalhe)
  values ('data de hoje em São Paulo', 'ok', public.ninho_today()::text || ' (UTC agora: ' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ')');

  -- Totais por casa (compare com o que o app mostrava)
  for r in select h.id, h.name from public.households h order by h.created_at nulls last loop
    insert into ninho_check("check", status, detalhe)
    values ('casa ' || coalesce(r.name, '?'), 'ok',
            'XP ' || public.ninho_household_xp(r.id) || ' · sequência ' || public.ninho_streak(r.id) ||
            ' · tarefas ' || (select count(*) from public.tasks where household_id = r.id) ||
            ' · conclusões ' || (select count(*) from public.task_completions where household_id = r.id));
  end loop;

  -- Realtime
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    for r in select unnest(array['tasks','task_completions','dogs','dog_routines','dog_completions','weekly_settings',
                                 'weekly_meetings','profiles','xp_history','puppy_accidents']) as t loop
      insert into ninho_check("check", status, detalhe)
      select 'realtime ' || r.t,
             case when exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = r.t) then 'ok' else 'FALHA' end, '';
    end loop;
  end if;
end $$;

select "check", status, detalhe from ninho_check order by ordem;
