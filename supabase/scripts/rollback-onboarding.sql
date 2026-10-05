-- ══════════════════════════════════════════════════════════════════════
-- Ninho · Desfaz a migration 014 (configuração inicial e rotinas com passos)
--
-- ATENÇÃO: apaga a configuração salva, os rascunhos e as rotinas com passos
-- criadas pelo onboarding. Não mexe em tarefas, cães, nomes nem XP.
-- (Os nomes editados e as tarefas marcadas como essenciais continuam como estão.)
-- O app funciona sem a 014: só deixa de mostrar a configuração e as rotinas novas.
-- Faça o backup (supabase/scripts/export-data-json.sql) antes.
-- ══════════════════════════════════════════════════════════════════════
drop function if exists public.ninho_finish_onboarding(uuid, text, jsonb);
drop table if exists public.routine_steps;
drop table if exists public.routines;
drop table if exists public.onboarding_progress;
drop table if exists public.household_setup;
select 'migration 014 desfeita' as resultado;
