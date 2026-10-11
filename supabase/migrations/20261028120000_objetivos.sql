-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 029 · Objetivos (Meu dia)
--
-- personal_goals: objetivos de cada pessoa com meta, prazo e progresso
--   ("perder 12 kg até 24/12", "40 treinos até o fim do ano", "30 dias
--   batendo a água", ou qualquer número). Peso, treinos e água calculam o
--   progresso sozinhos; o tipo "outro" soma o que a pessoa registra
--   (registros em personal_logs com kind = 'objetivo').
-- Mesma privacidade do Meu dia: só a dona grava; a outra só vê se a dona
-- compartilhar "objetivo".
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.personal_goals (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  title        text not null check (length(btrim(title)) between 1 and 80),
  kind         text not null check (kind in ('peso','treinos','agua','manual')),
  unit         text check (unit is null or length(unit) <= 20),
  start_value  numeric(8,2),
  target       numeric(8,2) not null check (target > 0 and target < 100000),
  start_date   date not null default public.ninho_today(),
  due_date     date,
  status       text not null default 'ativo' check (status in ('ativo','concluido','arquivado')),
  created_at   timestamptz not null default now(),
  check (due_date is null or due_date >= start_date)
);
create index if not exists personal_goals_who on public.personal_goals (household_id, who) where status <> 'arquivado';

-- personal_logs aceita o tipo 'objetivo' (progresso somado à mão). Troca só a regra; nenhum dado muda.
do $$
declare c text;
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.personal_logs'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%kind%' and pg_get_constraintdef(oid) like '%''objetivo''%') then return; end if;
  for c in select conname from pg_constraint
           where conrelid = 'public.personal_logs'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%kind%' and pg_get_constraintdef(oid) like '%agua%'
             and conname <> 'personal_logs_kind_check4' loop
    execute format('alter table public.personal_logs drop constraint %I', c);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'personal_logs_kind_check4') then
    alter table public.personal_logs add constraint personal_logs_kind_check4
      check (kind in ('agua','sono','autocuidado','remedio','treino','corpo','parar','refeicao','objetivo'));
  end if;
end $$;

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.personal_goals enable row level security;
  drop policy if exists "allow_all_auth" on public.personal_goals;
  drop policy if exists "personal_read" on public.personal_goals;
  drop policy if exists "personal_write" on public.personal_goals;
  if strict_rls then
    create policy "personal_read" on public.personal_goals for select to authenticated
      using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, 'objetivo')));
    create policy "personal_write" on public.personal_goals for all to authenticated
      using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
  else
    create policy "allow_all_auth" on public.personal_goals for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.personal_goals to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.personal_goals to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'personal_goals') then
    alter publication supabase_realtime add table public.personal_goals;
  end if;
end $$;

notify pgrst, 'reload schema';
