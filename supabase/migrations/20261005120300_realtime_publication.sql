-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 004 · Tabelas no Realtime
--
-- Garante que as tabelas que o app escuta estão na publicação
-- supabase_realtime. Só adiciona; nunca remove. Em banco sem Supabase
-- (sem a publicação), não faz nada.
-- ══════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publicação supabase_realtime não existe; nada a fazer.';
    return;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    raise notice 'supabase_realtime já publica todas as tabelas.';
    return;
  end if;
  foreach t in array array['tasks','task_completions','dogs','dog_routines','dog_completions',
                           'weekly_settings','weekly_meetings','profiles','xp_history','puppy_accidents'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
