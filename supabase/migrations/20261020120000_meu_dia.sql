-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 021 · Meu dia (parte individual de cada uma)
--
-- Água, sono, autocuidado, remédio pessoal, treinos (com cargas) e evolução
-- física. Cada uma escolhe, item por item, o que a outra pode ver — e o banco
-- garante isso (a outra só consegue LER o que foi compartilhado; ninguém
-- grava no "Meu dia" da outra).
-- Sem dieta e sem calorias.
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.personal_settings (
  household_id  uuid not null references public.households(id) on delete cascade,
  who           text not null check (who in ('g','s')),
  water_goal_ml integer not null default 2000 check (water_goal_ml between 250 and 8000),
  cup_ml        integer not null default 250 check (cup_ml between 50 and 1500),
  sleep_goal_h  numeric(3,1) not null default 8 check (sleep_goal_h between 3 and 14),
  -- o que a outra pode ver: {"agua":true,"sono":false,...}
  share         jsonb not null default '{}'::jsonb check (jsonb_typeof(share) = 'object'),
  selfcare      jsonb not null default '["Pausa de 5 minutos","Alongar","Tomar sol","Skincare","Ler 10 minutos"]'::jsonb
                check (jsonb_typeof(selfcare) = 'array' and jsonb_array_length(selfcare) <= 20),
  updated_at    timestamptz not null default now(),
  primary key (household_id, who)
);

create table if not exists public.personal_logs (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  date         date not null,
  kind         text not null check (kind in ('agua','sono','autocuidado','remedio','treino','corpo')),
  -- água: ml · sono: horas · treino: minutos · corpo: peso (kg)
  value        numeric(8,2),
  -- detalhes: sono {bed,wake,quality} · autocuidado {item} · remédio {med_id,name,time}
  --           treino {type,intensity,notes,exercises:[{name,sets,reps,kg}]} · corpo {waist,hip,arm,chest,fat,notes}
  data         jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and length(data::text) <= 6000),
  created_at   timestamptz not null default now()
);
create index if not exists personal_logs_day on public.personal_logs (household_id, who, date desc);
create index if not exists personal_logs_kind on public.personal_logs (household_id, who, kind, date desc);

create table if not exists public.personal_meds (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  name         text not null check (length(btrim(name)) between 1 and 60),
  dose         text check (dose is null or length(dose) <= 40),
  times        text[] not null default '{}' check (cardinality(times) <= 8),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Quem é a pessoa logada nesta casa (null = não é membro / sem login)
create or replace function public.ninho_my_who(p_household_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.who from public.household_members m where m.user_id = auth.uid() and m.household_id = p_household_id
$$;
revoke all on function public.ninho_my_who(uuid) from public;

-- A dona do registro compartilhou este tipo?
create or replace function public.ninho_personal_shared(p_household_id uuid, p_who text, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (s.share ->> p_kind)::boolean from public.personal_settings s where s.household_id = p_household_id and s.who = p_who), false)
$$;
revoke all on function public.ninho_personal_shared(uuid, text, text) from public;

do $$
declare strict_rls boolean; t text;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  foreach t in array array['personal_settings','personal_logs','personal_meds'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "allow_all_auth" on public.%I', t);
    execute format('drop policy if exists "personal_read" on public.%I', t);
    execute format('drop policy if exists "personal_write" on public.%I', t);
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant all on public.%I to service_role', t); end if;
  end loop;
  if strict_rls then
    -- Configurações (metas e o que é compartilhado): a casa lê; cada uma grava a sua
    create policy "personal_read" on public.personal_settings for select to authenticated using (public.ninho_is_member(household_id));
    create policy "personal_write" on public.personal_settings for all to authenticated
      using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
    -- Registros: a dona vê tudo; a outra só o que foi compartilhado. Só a dona grava.
    create policy "personal_read" on public.personal_logs for select to authenticated
      using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, kind)));
    create policy "personal_write" on public.personal_logs for all to authenticated
      using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
    create policy "personal_read" on public.personal_meds for select to authenticated
      using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, 'remedio')));
    create policy "personal_write" on public.personal_meds for all to authenticated
      using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
  else
    -- Antes da segurança por casa (011): mesma regra antiga do app
    foreach t in array array['personal_settings','personal_logs','personal_meds'] loop
      execute format('create policy "allow_all_auth" on public.%I for all to authenticated using (true) with check (true)', t);
    end loop;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.ninho_my_who(uuid) to authenticated;
    grant execute on function public.ninho_personal_shared(uuid, text, text) to authenticated;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    foreach t in array array['personal_settings','personal_logs'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
