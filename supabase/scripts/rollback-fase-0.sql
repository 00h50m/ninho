-- ══════════════════════════════════════════════════════════════════════
-- Ninho · Desfazer a Fase 0 no banco (OPCIONAL — normalmente não é preciso)
--
-- As migrations da Fase 0 só acrescentam coisas, e o app ANTIGO funciona
-- com o banco migrado. Para voltar atrás, o normal é só republicar a
-- versão anterior do app na Vercel. Use este script apenas se quiser tirar
-- do banco as funções, gatilhos e o índice criados na Fase 0.
--
-- ⚠ Antes: volte o app para a versão anterior (o app novo depende das funções).
-- ⚠ NÃO apaga dados nem colunas: completed_by, household_id, voided_at,
--   updated_at e as tabelas continuam, com os dados.
-- ⚠ Sem o índice único, cliques duplos voltam a duplicar XP.
-- ══════════════════════════════════════════════════════════════════════

begin;

drop function if exists public.ninho_complete_task(uuid, date, text);
drop function if exists public.ninho_uncomplete_task(uuid, date);
drop function if exists public.ninho_complete_dog_routines(uuid[], date, text);
drop function if exists public.ninho_uncomplete_dog_routines(uuid[], date);
drop function if exists public.ninho_household_xp(uuid);
drop function if exists public.ninho_streak(uuid, date);
drop function if exists public.ninho_check_completion_input(date, text, boolean);

drop trigger if exists ninho_fill_household on public.dog_completions;
drop trigger if exists ninho_fill_household on public.task_completions;
drop function if exists public.ninho_fill_dog_completion_household();
drop function if exists public.ninho_fill_task_completion_household();

drop index if exists public.xp_history_one_valid_per_reason;

-- Os XP anulados voltariam a contar na função antiga get_household_xp.
-- Para mantê-los fora da soma antiga, NÃO os reative. Para reativá-los:
--   update public.xp_history set voided_at = null, void_reason = null where void_reason like 'duplicado anulado%';

commit;
