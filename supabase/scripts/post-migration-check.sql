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
    ('push_subscriptions','endpoint'), ('push_log','kind'),
    -- Fase 3 (migration 007)
    ('households','split_mode'), ('shopping_items','title'), ('maintenance_items','next_due'), ('maintenance_log','done_on'),
    -- Fase 4 (migration 008)
    ('tasks','weekdays'), ('tasks','due_date'), ('task_skips','kind'),
    -- Fase 5 (migration 009)
    ('telegram_links','chat_id'), ('telegram_log','kind'), ('ai_log','kind'),
    -- Fase 6 (migration 010)
    ('household_members','who'),
    -- Telegram sem duplicar (migration 013)
    ('telegram_updates','update_id'),
    -- Redesign F2: configuração inicial e rotinas (migration 014)
    ('household_setup','answers'), ('onboarding_progress','step'), ('routines','assign_mode'), ('routine_steps','survival'),
    -- Redesign F3: check-in e dia (migration 015)
    ('daily_checkins','mood'), ('household_days','survival'),
    -- Redesign F4: rotinas com checklist e hábitos (migration 016)
    ('routines','paused_until'), ('routine_runs','status'), ('routine_step_checks','done_by'), ('ninho_habits','weekly_target'), ('ninho_habit_logs','who'),
    -- Modelos da casa (migration 017)
    ('routine_templates','steps'),
    -- Sprint do Ninho (migration 018)
    ('sprints','paused_ms')
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
                               'ninho_save_push_subscription',
                               -- Fase 3 (migration 007)
                               'ninho_add_shopping_item','ninho_next_due','ninho_complete_maintenance','ninho_undo_maintenance',
                               -- Fase 4 (migration 008)
                               'ninho_task_on_day',
                               -- Fase 5 (migration 009)
                               'ninho_telegram_link_code',
                               -- Fase 6 (migration 010)
                               'ninho_link_member','ninho_is_member',
                               -- Redesign F2 (migration 014)
                               'ninho_finish_onboarding',
                               -- Redesign F3 (migration 015)
                               'ninho_checkin',
                               -- Redesign F4 (migration 016)
                               'ninho_routine_step','ninho_routine_finish',
                               -- Sprint (migration 018)
                               'ninho_finish_sprint','ninho_sprint_pause']) as f loop
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

  -- Versões atuais das migrations (schema real: scheduled_time do tipo time, horários em completed_at/earned_at)
  insert into ninho_check("check", status, detalhe)
  select 'migration 005 atualizada (horário tipo time)',
         case when pg_get_functiondef('public.ninho_complete_task(uuid,date,text)'::regprocedure) like '%scheduled_time::text%'
                and pg_get_functiondef('public.ninho_complete_dog_routines(uuid[],date,text)'::regprocedure) like '%scheduled_time::text%'
              then 'ok' else 'FALHA' end,
         case when pg_get_functiondef('public.ninho_complete_task(uuid,date,text)'::regprocedure) like '%scheduled_time::text%' then ''
              else 'versão antiga: rode de novo a versão atual de 20261006120000_gamification.sql' end;
  if exists (select 1 from pg_attribute where attrelid = 'public.task_completions'::regclass and attname = 'completed_at' and not attisdropped) then
    execute 'select count(*) from public.task_completions where completed_at is not null and created_at is distinct from completed_at' into n;
    insert into ninho_check("check", status, detalhe) values ('horário original das conclusões', case when n = 0 then 'ok' else 'FALHA' end,
      case when n = 0 then 'created_at = completed_at' else n || ' linha(s) com horário da migração; rode de novo a versão atual da 002' end);
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.xp_history'::regclass and attname = 'earned_at' and not attisdropped) then
    execute 'select count(*) from public.xp_history where earned_at is not null and created_at is distinct from earned_at' into n;
    insert into ninho_check("check", status, detalhe) values ('horário original do XP', case when n = 0 then 'ok' else 'FALHA' end,
      case when n = 0 then 'created_at = earned_at' else n || ' linha(s) com horário da migração; rode de novo a versão atual da 002' end);
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

  -- Correção 012: código do Telegram não depende do schema "extensions"
  insert into ninho_check("check", status, detalhe)
  select 'código do Telegram (012)',
         case when pg_get_functiondef('public.ninho_telegram_link_code(uuid,text)'::regprocedure) like '%gen_random_uuid%' then 'ok' else 'FALHA' end,
         case when pg_get_functiondef('public.ninho_telegram_link_code(uuid,text)'::regprocedure) like '%gen_random_uuid%' then ''
              else 'rode a migration 20261011120200_fix_telegram_codigo.sql' end;

  -- Login (010) e segurança por casa (011)
  for r in select h.id, h.name from public.households h order by h.created_at nulls last loop
    insert into ninho_check("check", status, detalhe)
    select 'contas da casa ' || coalesce(r.name, '?'),
           case when count(*) = 2 then 'ok' else 'AVISO' end,
           coalesce(string_agg(case m.who when 'g' then 'Giovanna' else 'Sabrina' end, ' e ' order by m.who), 'nenhuma')
             || case when count(*) = 2 then ' ligadas' else ' — ligue com ninho_link_member(e-mail, g|s) antes da migration 011' end
    from public.household_members m where m.household_id = r.id;
  end loop;
  insert into ninho_check("check", status, detalhe)
  select 'segurança por casa (011)',
         case when exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'allow_all_auth') then 'AVISO' else 'ok' end,
         case when exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'allow_all_auth')
              then 'ainda não aplicada: qualquer usuário do app acessa os dados (rode a 011 depois que as duas entrarem)'
              else 'só quem é da casa acessa os dados' end;

  -- Realtime
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    for r in select unnest(array['tasks','task_completions','dogs','dog_routines','dog_completions','weekly_settings',
                                 'weekly_meetings','profiles','xp_history','puppy_accidents',
                                 'shopping_items','maintenance_items','maintenance_log','households','task_skips',
                                 'household_setup','routines','routine_steps','daily_checkins','household_days','routine_runs','routine_step_checks','ninho_habits','ninho_habit_logs']) as t loop
      insert into ninho_check("check", status, detalhe)
      select 'realtime ' || r.t,
             case when exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = r.t) then 'ok' else 'FALHA' end, '';
    end loop;
  end if;
end $$;

select "check", status, detalhe from ninho_check order by ordem;
