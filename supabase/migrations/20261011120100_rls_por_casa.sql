-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 011 · Segurança por casa (rodar SÓ depois que as duas entrarem
-- com e-mail e senha no app novo)
--
-- Antes: qualquer usuário autenticado (inclusive o login anônimo) podia ler
-- e alterar qualquer casa. Agora: só quem está em household_members da casa.
-- O servidor (service_role: bom dia, Telegram, IA) continua tendo acesso.
--
-- Não apaga dados: troca as regras de acesso ("policies").
-- Para desfazer: supabase/scripts/rollback-rls-por-casa.sql
-- Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array[
    'tasks','task_completions','dogs','dog_completions','weekly_settings','weekly_meetings',
    'xp_history','puppy_accidents','push_subscriptions','shopping_items','maintenance_items',
    'maintenance_log','task_skips','telegram_links',
    'household_setup','onboarding_progress','routines','routine_steps','daily_checkins','household_days',
    'routine_runs','routine_step_checks','ninho_habits','ninho_habit_logs','routine_templates','sprints','house_events','dog_health','couple_challenges','challenge_marks'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "allow_all_auth" on public.%I', t);
    execute format('drop policy if exists "household_member" on public.%I', t);
    execute format('create policy "household_member" on public.%I for all to authenticated using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id))', t);
  end loop;
end $$;

-- Rotinas antigas podem não ter household_id: vale a casa do cão
drop policy if exists "allow_all_auth" on public.dog_routines;
drop policy if exists "household_member" on public.dog_routines;
create policy "household_member" on public.dog_routines for all to authenticated
  using (public.ninho_is_member(coalesce(household_id, (select d.household_id from public.dogs d where d.id = dog_id))))
  with check (public.ninho_is_member(coalesce(household_id, (select d.household_id from public.dogs d where d.id = dog_id))));

-- A casa: só membros veem e editam (criar casa nova é pelo SQL Editor)
drop policy if exists "allow_all_auth" on public.households;
drop policy if exists "household_member" on public.households;
drop policy if exists "household_member_update" on public.households;
create policy "household_member" on public.households for select to authenticated using (public.ninho_is_member(id));
create policy "household_member_update" on public.households for update to authenticated using (public.ninho_is_member(id)) with check (public.ninho_is_member(id));

-- Perfis (nomes): membros da casa veem e editam os perfis da casa
drop policy if exists "allow_all_auth" on public.profiles;
drop policy if exists "household_member" on public.profiles;
create policy "household_member" on public.profiles for all to authenticated
  using (id = auth.uid() or public.ninho_is_member(household_id))
  with check (public.ninho_is_member(household_id));

-- "Meu dia" (021): regras próprias — a dona vê tudo, a outra só o que foi compartilhado
do $$
declare t text;
begin
  if to_regclass('public.personal_logs') is null or to_regprocedure('public.ninho_my_who(uuid)') is null then return; end if;
  foreach t in array array['personal_settings','personal_logs','personal_meds'] loop
    execute format('drop policy if exists "allow_all_auth" on public.%I', t);
    execute format('drop policy if exists "household_member" on public.%I', t);
    execute format('drop policy if exists "personal_read" on public.%I', t);
    execute format('drop policy if exists "personal_write" on public.%I', t);
  end loop;
  create policy "personal_read" on public.personal_settings for select to authenticated using (public.ninho_is_member(household_id));
  create policy "personal_write" on public.personal_settings for all to authenticated
    using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
  create policy "personal_read" on public.personal_logs for select to authenticated
    using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, kind)));
  create policy "personal_write" on public.personal_logs for all to authenticated
    using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
  create policy "personal_read" on public.personal_meds for select to authenticated
    using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, 'remedio')));
  create policy "personal_write" on public.personal_meds for all to authenticated
    using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
  -- "Parar de…" (025)
  if to_regclass('public.personal_quits') is not null then
    drop policy if exists "allow_all_auth" on public.personal_quits;
    drop policy if exists "household_member" on public.personal_quits;
    drop policy if exists "personal_read" on public.personal_quits;
    drop policy if exists "personal_write" on public.personal_quits;
    create policy "personal_read" on public.personal_quits for select to authenticated
      using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, 'parar')));
    create policy "personal_write" on public.personal_quits for all to authenticated
      using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
  end if;
end $$;
