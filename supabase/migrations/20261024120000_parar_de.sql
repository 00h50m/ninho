-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 025 · "Parar de…" (Meu dia)
--
-- personal_quits: hábitos que a pessoa quer largar ("fumar", "rede social
-- depois das 23h", "refrigerante"), com o motivo e desde quando.
-- Recaídas viram registros em personal_logs com kind = 'parar' (o contador
-- recomeça; o recorde fica). Mesma privacidade do Meu dia: só a dona grava;
-- a outra só vê se a dona compartilhar "parar".
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.personal_quits (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  title        text not null check (length(btrim(title)) between 1 and 60),
  reason       text check (reason is null or length(reason) <= 200),
  started_on   date not null default public.ninho_today(),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists personal_quits_who on public.personal_quits (household_id, who) where active;

-- personal_logs aceita o tipo 'parar' (recaída). Troca só a regra; nenhum dado muda.
do $$
declare c text;
begin
  -- já aceita 'parar' (esta ou uma migration mais nova)? nada a fazer
  if exists (select 1 from pg_constraint where conrelid = 'public.personal_logs'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%kind%' and pg_get_constraintdef(oid) like '%''parar''%') then return; end if;
  for c in select conname from pg_constraint
           where conrelid = 'public.personal_logs'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%kind%' and pg_get_constraintdef(oid) like '%agua%'
             and conname <> 'personal_logs_kind_check2' loop
    execute format('alter table public.personal_logs drop constraint %I', c);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'personal_logs_kind_check2') then
    alter table public.personal_logs add constraint personal_logs_kind_check2
      check (kind in ('agua','sono','autocuidado','remedio','treino','corpo','parar'));
  end if;
end $$;

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.personal_quits enable row level security;
  drop policy if exists "allow_all_auth" on public.personal_quits;
  drop policy if exists "personal_read" on public.personal_quits;
  drop policy if exists "personal_write" on public.personal_quits;
  if strict_rls then
    create policy "personal_read" on public.personal_quits for select to authenticated
      using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, 'parar')));
    create policy "personal_write" on public.personal_quits for all to authenticated
      using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
  else
    create policy "allow_all_auth" on public.personal_quits for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.personal_quits to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.personal_quits to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'personal_quits') then
    alter publication supabase_realtime add table public.personal_quits;
  end if;
end $$;

notify pgrst, 'reload schema';
