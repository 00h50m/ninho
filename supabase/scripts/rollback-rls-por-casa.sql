-- ══════════════════════════════════════════════════════════════════════
-- Ninho · Desfaz a migration 011 (segurança por casa)
--
-- Volta à regra antiga: qualquer usuário autenticado acessa os dados.
-- Use só se o app novo travar depois da 011 (ex.: alguém sem conta ligada).
-- Não apaga dados.
-- ══════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array[
    'households','profiles','tasks','task_completions','dogs','dog_routines','dog_completions','weekly_settings',
    'weekly_meetings','xp_history','puppy_accidents','push_subscriptions','shopping_items','maintenance_items',
    'maintenance_log','task_skips','telegram_links','household_setup','onboarding_progress','routines','routine_steps','daily_checkins','household_days','routine_runs','routine_step_checks','ninho_habits','ninho_habit_logs','routine_templates','sprints','house_events'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists "household_member" on public.%I', t);
    execute format('drop policy if exists "household_member_update" on public.%I', t);
    execute format('drop policy if exists "allow_all_auth" on public.%I', t);
    execute format('create policy "allow_all_auth" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

select 'segurança por casa desfeita: voltou a regra antiga' as resultado;
