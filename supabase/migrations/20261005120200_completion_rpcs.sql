-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 003 · Funções de conclusão (transacionais e idempotentes) e totais
--
-- Cada função roda numa única transação: a conclusão e o XP entram juntos
-- ou nenhum dos dois entra. Repetir a mesma chamada dá o mesmo resultado.
--
-- As funções antigas get_household_xp(uuid) e get_streak(uuid), criadas
-- direto em produção, NÃO são alteradas nem removidas. O app passa a usar
-- ninho_household_xp e ninho_streak.
--
-- Erros têm mensagem com prefixo estável, lido pelo app:
--   NINHO_INVALID_PERSON  completed_by diferente de 'g' ou 's'
--   NINHO_INVALID_DATE    data fora de ontem/hoje/amanhã no fuso de São Paulo
--   NINHO_NOT_FOUND       tarefa ou rotina não existe
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.ninho_xp_for_weight(p_weight text)
returns integer language sql immutable as $$
  select case p_weight when 'light' then 1 when 'medium' then 2 when 'heavy' then 3 else 1 end
$$;

create or replace function public.ninho_xp_reason(p_kind text, p_id uuid, p_date date)
returns text language sql immutable as $$
  select p_kind || ':' || p_id::text || ':' || to_char(p_date, 'YYYY-MM-DD')
$$;

comment on function public.ninho_xp_reason(text, uuid, date) is
  'Origem do XP: task:<id>:<data> ou dog:<id>:<data>. Igual ao formato já usado pelo app.';

-- Validação comum
create or replace function public.ninho_check_completion_input(p_date date, p_by text, p_need_by boolean)
returns void language plpgsql stable set search_path = public as $$
begin
  if p_date is null or p_date < public.ninho_today() - 1 or p_date > public.ninho_today() + 1 then
    raise exception 'NINHO_INVALID_DATE: a data % está fora do dia atual em São Paulo', p_date
      using errcode = '22023';
  end if;
  if p_need_by and (p_by is null or p_by not in ('g','s')) then
    raise exception 'NINHO_INVALID_PERSON: quem concluiu deve ser g ou s (recebido: %)', coalesce(p_by, 'vazio')
      using errcode = '22023';
  end if;
end $$;

-- ── Tarefas ─────────────────────────────────────────────────────────────
-- ninho_complete_task(p_task_id, p_date, p_by)
--   Conclui a tarefa no dia p_date por p_by ('g'|'s') e lança o XP.
--   Se já estava concluída, não duplica nada e mantém quem concluiu primeiro.
--   Retorna: { task_id, date, created (bool: esta chamada criou a conclusão),
--              completed_by, completion_id, xp }
create or replace function public.ninho_complete_task(p_task_id uuid, p_date date, p_by text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_household uuid;
  v_weight    text;
  v_xp        integer;
  v_created   boolean;
  v_row       public.task_completions%rowtype;
begin
  perform public.ninho_check_completion_input(p_date, p_by, true);

  select household_id, weight into v_household, v_weight from public.tasks where id = p_task_id;
  if not found then
    raise exception 'NINHO_NOT_FOUND: tarefa % não encontrada', p_task_id using errcode = 'P0002';
  end if;

  insert into public.task_completions (task_id, household_id, date, completed_by)
  values (p_task_id, v_household, p_date, p_by)
  on conflict (task_id, date) do nothing;
  v_created := found;

  select * into v_row from public.task_completions where task_id = p_task_id and date = p_date;

  v_xp := public.ninho_xp_for_weight(v_weight);
  insert into public.xp_history (household_id, amount, reason)
  values (v_household, v_xp, public.ninho_xp_reason('task', p_task_id, p_date))
  on conflict (household_id, reason) where reason is not null and voided_at is null do nothing;

  return jsonb_build_object('task_id', p_task_id, 'date', p_date, 'created', v_created,
                            'completed_by', v_row.completed_by, 'completion_id', v_row.id, 'xp', v_xp);
end $$;

-- ninho_uncomplete_task(p_task_id, p_date)
--   Desfaz a conclusão do dia e remove somente o XP dessa conclusão.
--   Chamar de novo não faz nada. Retorna: { task_id, date, removed (bool) }
create or replace function public.ninho_uncomplete_task(p_task_id uuid, p_date date)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_household uuid;
  v_removed   integer;
begin
  perform public.ninho_check_completion_input(p_date, null, false);

  select household_id into v_household from public.tasks where id = p_task_id;
  if not found then
    raise exception 'NINHO_NOT_FOUND: tarefa % não encontrada', p_task_id using errcode = 'P0002';
  end if;

  delete from public.task_completions where task_id = p_task_id and date = p_date;
  get diagnostics v_removed = row_count;

  delete from public.xp_history
  where household_id = v_household
    and reason = public.ninho_xp_reason('task', p_task_id, p_date)
    and voided_at is null;

  return jsonb_build_object('task_id', p_task_id, 'date', p_date, 'removed', v_removed > 0);
end $$;

-- ── Rotinas dos cães (em lote: "Ração manhã" dos dois cães num toque só) ─
-- ninho_complete_dog_routines(p_routine_ids, p_date, p_by)
--   Tudo ou nada: se uma rotina não existir, nenhuma é concluída.
--   Retorna: { date, routines, created (quantas esta chamada criou), xp_added,
--              completions: [{ routine_id, completion_id, completed_by }] }
create or replace function public.ninho_complete_dog_routines(p_routine_ids uuid[], p_date date, p_by text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_ids      uuid[];
  v_r        record;
  v_found    integer := 0;
  v_created  integer := 0;
  v_xp       integer := 0;
  v_out      jsonb := '[]'::jsonb;
  v_row      public.dog_completions%rowtype;
begin
  perform public.ninho_check_completion_input(p_date, p_by, true);
  v_ids := array(select distinct unnest(coalesce(p_routine_ids, '{}')));

  for v_r in
    select r.id, coalesce(r.household_id, d.household_id) as household_id
    from public.dog_routines r left join public.dogs d on d.id = r.dog_id
    where r.id = any (v_ids)
    order by r.id
  loop
    v_found := v_found + 1;

    insert into public.dog_completions (routine_id, household_id, date, completed_by)
    values (v_r.id, v_r.household_id, p_date, p_by)
    on conflict (routine_id, date) do nothing;
    if found then v_created := v_created + 1; end if;

    insert into public.xp_history (household_id, amount, reason)
    values (v_r.household_id, 1, public.ninho_xp_reason('dog', v_r.id, p_date))
    on conflict (household_id, reason) where reason is not null and voided_at is null do nothing;
    if found then v_xp := v_xp + 1; end if;

    select * into v_row from public.dog_completions where routine_id = v_r.id and date = p_date;
    v_out := v_out || jsonb_build_object('routine_id', v_r.id, 'completion_id', v_row.id, 'completed_by', v_row.completed_by);
  end loop;

  if v_found <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'NINHO_NOT_FOUND: % de % rotinas não encontradas', coalesce(array_length(v_ids, 1), 0) - v_found, coalesce(array_length(v_ids, 1), 0)
      using errcode = 'P0002';
  end if;

  return jsonb_build_object('date', p_date, 'routines', v_found, 'created', v_created, 'xp_added', v_xp, 'completions', v_out);
end $$;

-- ninho_uncomplete_dog_routines(p_routine_ids, p_date)
--   Desfaz as conclusões do dia e remove só o XP delas. Retorna: { date, removed }
create or replace function public.ninho_uncomplete_dog_routines(p_routine_ids uuid[], p_date date)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_r       record;
  v_removed integer := 0;
  v_n       integer;
begin
  perform public.ninho_check_completion_input(p_date, null, false);

  for v_r in
    select r.id, coalesce(r.household_id, d.household_id) as household_id
    from public.dog_routines r left join public.dogs d on d.id = r.dog_id
    where r.id = any (coalesce(p_routine_ids, '{}'))
  loop
    delete from public.dog_completions where routine_id = v_r.id and date = p_date;
    get diagnostics v_n = row_count;
    v_removed := v_removed + v_n;
    delete from public.xp_history
    where household_id = v_r.household_id
      and reason = public.ninho_xp_reason('dog', v_r.id, p_date)
      and voided_at is null;
  end loop;

  return jsonb_build_object('date', p_date, 'removed', v_removed);
end $$;

-- ── Totais ──────────────────────────────────────────────────────────────
-- ninho_household_xp(p_household_id) → XP total válido da casa (ignora lançamentos anulados).
create or replace function public.ninho_household_xp(p_household_id uuid)
returns integer language sql stable security invoker set search_path = public as $$
  select coalesce(sum(amount), 0)::integer
  from public.xp_history
  where household_id = p_household_id and voided_at is null
$$;

-- ninho_streak(p_household_id, p_today) → dias seguidos com pelo menos uma conclusão
-- (tarefa ou rotina de cão), contando no dia doméstico de São Paulo.
-- Se hoje ainda não tem conclusão, a sequência conta até ontem (não quebra durante o dia).
-- p_today é opcional; sem ele, usa ninho_today().
create or replace function public.ninho_streak(p_household_id uuid, p_today date default null)
returns integer language plpgsql stable security invoker set search_path = public as $$
declare
  v_day   date := coalesce(p_today, public.ninho_today());
  v_count integer := 0;
begin
  if not exists (select 1 from public.task_completions where household_id = p_household_id and date = v_day)
     and not exists (select 1 from public.dog_completions where household_id = p_household_id and date = v_day) then
    v_day := v_day - 1;
  end if;

  while v_count < 3660 and (
        exists (select 1 from public.task_completions where household_id = p_household_id and date = v_day)
     or exists (select 1 from public.dog_completions where household_id = p_household_id and date = v_day)) loop
    v_count := v_count + 1;
    v_day := v_day - 1;
  end loop;

  return v_count;
end $$;

-- ── Permissões: só usuários autenticados (inclui o login anônimo atual) ──
revoke all on function public.ninho_complete_task(uuid, date, text) from public;
revoke all on function public.ninho_uncomplete_task(uuid, date) from public;
revoke all on function public.ninho_complete_dog_routines(uuid[], date, text) from public;
revoke all on function public.ninho_uncomplete_dog_routines(uuid[], date) from public;
revoke all on function public.ninho_household_xp(uuid) from public;
revoke all on function public.ninho_streak(uuid, date) from public;

-- O Supabase concede EXECUTE ao papel anon por padrão; estas funções exigem o login anônimo do app.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.ninho_complete_task(uuid, date, text) from anon;
    revoke all on function public.ninho_uncomplete_task(uuid, date) from anon;
    revoke all on function public.ninho_complete_dog_routines(uuid[], date, text) from anon;
    revoke all on function public.ninho_uncomplete_dog_routines(uuid[], date) from anon;
    revoke all on function public.ninho_household_xp(uuid) from anon;
    revoke all on function public.ninho_streak(uuid, date) from anon;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.ninho_complete_task(uuid, date, text) to authenticated;
    grant execute on function public.ninho_uncomplete_task(uuid, date) to authenticated;
    grant execute on function public.ninho_complete_dog_routines(uuid[], date, text) to authenticated;
    grant execute on function public.ninho_uncomplete_dog_routines(uuid[], date) to authenticated;
    grant execute on function public.ninho_household_xp(uuid) to authenticated;
    grant execute on function public.ninho_streak(uuid, date) to authenticated;
  end if;
end $$;
