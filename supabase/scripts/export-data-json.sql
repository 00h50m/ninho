-- ══════════════════════════════════════════════════════════════════════
-- Ninho · Exportação rápida de TODOS os dados em JSON (somente leitura)
--
-- Backup de emergência sem instalar nada: cole no SQL Editor do Supabase,
-- clique em Run e baixe o resultado (botão de download do resultado → CSV/JSON).
-- Funciona antes e depois das migrations (tabelas que não existirem saem como null).
--
-- Não substitui o backup completo com pg_dump (docs/BACKUP-RESTORE.md):
-- não leva a estrutura, as funções nem os usuários do Auth.
-- ══════════════════════════════════════════════════════════════════════

create or replace function pg_temp.dump_table(t text) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  if to_regclass('public.' || t) is null then return null; end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t) into j;
  return j;
end $$;

select jsonb_pretty(jsonb_build_object(
  'exported_at',      now(),
  'ninho_backup',     'v1',
  'households',       pg_temp.dump_table('households'),
  'profiles',         pg_temp.dump_table('profiles'),
  'tasks',            pg_temp.dump_table('tasks'),
  'task_completions', pg_temp.dump_table('task_completions'),
  'dogs',             pg_temp.dump_table('dogs'),
  'dog_routines',     pg_temp.dump_table('dog_routines'),
  'dog_completions',  pg_temp.dump_table('dog_completions'),
  'weekly_settings',  pg_temp.dump_table('weekly_settings'),
  'weekly_meetings',  pg_temp.dump_table('weekly_meetings'),
  'xp_history',       pg_temp.dump_table('xp_history'),
  'puppy_accidents',  pg_temp.dump_table('puppy_accidents')
)) as ninho_backup;
