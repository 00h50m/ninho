-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 001 · Baseline do schema
--
-- Num banco NOVO: cria tudo o que o app usa.
-- Num banco EXISTENTE (produção): só acrescenta o que falta.
--   · nenhuma tabela é recriada, nenhum dado é apagado, nenhum DROP;
--   · colunas novas são opcionais (sem NOT NULL) ou têm default;
--   · restrições novas em tabelas existentes entram como NOT VALID
--     (valem para linhas novas; as antigas não são reprovadas).
-- Pode ser executada mais de uma vez sem efeito colateral.
-- ══════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- Data doméstica: o "hoje" da casa é sempre o de São Paulo, nunca o UTC do servidor.
create or replace function public.ninho_local_date(p_ts timestamptz)
returns date
language sql
immutable
as $$ select (p_ts at time zone 'America/Sao_Paulo')::date $$;

comment on function public.ninho_local_date(timestamptz) is
  'Converte um instante para a data doméstica em America/Sao_Paulo.';

create or replace function public.ninho_today()
returns date
language sql
stable
set search_path = public
as $$ select public.ninho_local_date(now()) $$;

comment on function public.ninho_today() is
  'Data de hoje no fuso da casa (America/Sao_Paulo). Usada como default de datas domésticas.';

-- Utilitários da própria migração (vivem só nesta sessão, no schema pg_temp)
create or replace function pg_temp.has_pk(tbl regclass) returns boolean language sql as $$
  select exists (select 1 from pg_constraint where conrelid = tbl and contype = 'p') $$;

-- Existe índice único (ou PK/unique) exatamente nestas colunas, em qualquer ordem?
create or replace function pg_temp.has_unique(tbl regclass, cols text[]) returns boolean language sql as $$
  select exists (
    select 1
    from pg_index i
    where i.indrelid = tbl and i.indisunique and i.indpred is null
      and (select array_agg(a.attname::text order by a.attname)
           from unnest(i.indkey::int2[]) k join pg_attribute a on a.attrelid = tbl and a.attnum = k)
          = (select array_agg(c order by c) from unnest(cols) c)
  ) $$;

-- Existe FK nesta coluna?
create or replace function pg_temp.has_fk(tbl regclass, col text) returns boolean language sql as $$
  select exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = tbl and c.contype = 'f' and a.attname = col
  ) $$;

create or replace function pg_temp.has_constraint(tbl regclass, cname text) returns boolean language sql as $$
  select exists (select 1 from pg_constraint where conrelid = tbl and conname = cname) $$;

-- ── HOUSEHOLDS ──────────────────────────────────────────────────────────
create table if not exists public.households (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null default 'Ninho',
  created_at timestamptz not null default now()
);
alter table public.households add column if not exists name text default 'Ninho';
alter table public.households add column if not exists created_at timestamptz default now();

-- ── PROFILES ────────────────────────────────────────────────────────────
-- Uma linha por usuário anônimo do Supabase Auth. role = 'g' | 's'.
-- display_name é o nome mostrado no app (editável em Ajustes).
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  name         text not null default 'Integrante',
  display_name text,
  role         text default 'g',
  avatar_color text default '#5dcaa5',
  created_at   timestamptz not null default now()
);
alter table public.profiles add column if not exists household_id uuid;
alter table public.profiles add column if not exists name text default 'Integrante';
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists role text default 'g';
alter table public.profiles add column if not exists avatar_color text default '#5dcaa5';
alter table public.profiles add column if not exists created_at timestamptz default now();

-- ── TASKS ───────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id             uuid primary key default uuid_generate_v4(),
  household_id   uuid references public.households(id) on delete cascade,
  title          text not null,
  category       text not null default 'general',
  weight         text not null default 'medium' check (weight in ('light','medium','heavy')),
  frequency      text not null default 'weekly',
  assigned_to    text,
  scheduled_time text,
  essential      boolean default false,
  active         boolean default true,
  created_at     timestamptz not null default now()
);
alter table public.tasks add column if not exists category text default 'general';
alter table public.tasks add column if not exists weight text default 'medium';
alter table public.tasks add column if not exists frequency text default 'weekly';
alter table public.tasks add column if not exists assigned_to text;
alter table public.tasks add column if not exists scheduled_time text;
alter table public.tasks add column if not exists essential boolean default false;
alter table public.tasks add column if not exists active boolean default true;
alter table public.tasks add column if not exists created_at timestamptz default now();

-- ── TASK COMPLETIONS ────────────────────────────────────────────────────
-- Uma conclusão por tarefa por dia doméstico. completed_by = 'g' | 's' (null = registro antigo, "não identificado").
create table if not exists public.task_completions (
  id           uuid primary key default uuid_generate_v4(),
  task_id      uuid references public.tasks(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  completed_by text,
  date         date default public.ninho_today(),
  created_at   timestamptz not null default now(),
  unique (task_id, date)
);
alter table public.task_completions add column if not exists household_id uuid;
alter table public.task_completions add column if not exists completed_by text;
alter table public.task_completions add column if not exists created_at timestamptz default now();

-- ── DOGS ────────────────────────────────────────────────────────────────
create table if not exists public.dogs (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references public.households(id) on delete cascade,
  name         text not null,
  breed        text,
  is_puppy     boolean default false,
  active       boolean default true,
  created_at   timestamptz not null default now()
);
alter table public.dogs add column if not exists breed text;
alter table public.dogs add column if not exists is_puppy boolean default false;
alter table public.dogs add column if not exists active boolean default true;
alter table public.dogs add column if not exists created_at timestamptz default now();

-- ── DOG ROUTINES ────────────────────────────────────────────────────────
create table if not exists public.dog_routines (
  id             uuid primary key default uuid_generate_v4(),
  dog_id         uuid references public.dogs(id) on delete cascade,
  household_id   uuid references public.households(id) on delete cascade,
  title          text not null,
  frequency      text default 'daily',
  scheduled_time text,
  active         boolean default true
);
alter table public.dog_routines add column if not exists household_id uuid;
alter table public.dog_routines add column if not exists frequency text default 'daily';
alter table public.dog_routines add column if not exists scheduled_time text;
alter table public.dog_routines add column if not exists active boolean default true;
alter table public.dog_routines add column if not exists created_at timestamptz default now();

-- ── DOG ROUTINE COMPLETIONS ─────────────────────────────────────────────
create table if not exists public.dog_completions (
  id         uuid primary key default uuid_generate_v4(),
  routine_id uuid references public.dog_routines(id) on delete cascade,
  date       date default public.ninho_today(),
  created_at timestamptz not null default now(),
  unique (routine_id, date)
);
alter table public.dog_completions add column if not exists created_at timestamptz default now();

-- ── WEEKLY SETTINGS ─────────────────────────────────────────────────────
create table if not exists public.weekly_settings (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references public.households(id) on delete cascade,
  week_start   date not null,
  energy       text default 'medium',
  survival     boolean default false,
  updated_at   timestamptz default now(),
  unique (household_id, week_start)
);
alter table public.weekly_settings add column if not exists energy text default 'medium';
alter table public.weekly_settings add column if not exists survival boolean default false;
alter table public.weekly_settings add column if not exists updated_at timestamptz default now();

-- ── WEEKLY MEETINGS (existia só em produção) ───────────────────────────
create table if not exists public.weekly_meetings (
  id              uuid primary key default uuid_generate_v4(),
  household_id    uuid references public.households(id) on delete cascade,
  week_start      date not null,
  what_worked     text,
  what_overloaded text,
  adjustments     text,
  priorities      text,
  mood_g          text,
  mood_s          text,
  wins            text,
  next_mode       text,
  reward          text,
  created_at      timestamptz not null default now(),
  unique (household_id, week_start)
);
alter table public.weekly_meetings add column if not exists household_id uuid;
alter table public.weekly_meetings add column if not exists week_start date;
alter table public.weekly_meetings add column if not exists what_worked text;
alter table public.weekly_meetings add column if not exists what_overloaded text;
alter table public.weekly_meetings add column if not exists adjustments text;
alter table public.weekly_meetings add column if not exists priorities text;
alter table public.weekly_meetings add column if not exists mood_g text;
alter table public.weekly_meetings add column if not exists mood_s text;
alter table public.weekly_meetings add column if not exists wins text;
alter table public.weekly_meetings add column if not exists next_mode text;
alter table public.weekly_meetings add column if not exists reward text;
alter table public.weekly_meetings add column if not exists created_at timestamptz default now();

-- ── XP HISTORY (existia só em produção) ────────────────────────────────
-- reason identifica a origem: 'task:<task_id>:<YYYY-MM-DD>' ou 'dog:<routine_id>:<YYYY-MM-DD>'.
create table if not exists public.xp_history (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references public.households(id) on delete cascade,
  amount       integer not null default 0,
  reason       text,
  created_at   timestamptz not null default now()
);
alter table public.xp_history add column if not exists household_id uuid;
alter table public.xp_history add column if not exists amount integer default 0;
alter table public.xp_history add column if not exists reason text;
alter table public.xp_history add column if not exists created_at timestamptz default now();

-- ── PUPPY ACCIDENTS (existia só em produção) ───────────────────────────
create table if not exists public.puppy_accidents (
  id           uuid primary key default uuid_generate_v4(),
  dog_id       uuid references public.dogs(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  location     text not null,
  date         date not null default public.ninho_today(),
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
alter table public.puppy_accidents add column if not exists dog_id uuid;
alter table public.puppy_accidents add column if not exists household_id uuid;
alter table public.puppy_accidents add column if not exists location text;
alter table public.puppy_accidents add column if not exists date date default public.ninho_today();
alter table public.puppy_accidents add column if not exists occurred_at timestamptz default now();
alter table public.puppy_accidents add column if not exists created_at timestamptz default now();

-- ── Chaves primárias nas tabelas que nasceram fora do schema versionado ──
-- (Realtime precisa da PK para avisar exclusões.)
do $$
declare t text;
begin
  foreach t in array array['weekly_meetings','xp_history','puppy_accidents'] loop
    if not pg_temp.has_pk(format('public.%I', t)::regclass) then
      execute format('alter table public.%I add column if not exists id uuid default uuid_generate_v4()', t);
      execute format('update public.%I set id = uuid_generate_v4() where id is null', t);
      execute format('alter table public.%I alter column id set not null', t);
      execute format('alter table public.%I add primary key (id)', t);
    end if;
  end loop;
end $$;

-- ── Unicidades que o app usa em upsert (onConflict) ────────────────────
do $$
begin
  if not pg_temp.has_unique('public.task_completions', array['task_id','date']) then
    create unique index task_completions_task_id_date_key on public.task_completions (task_id, date);
  end if;
  if not pg_temp.has_unique('public.dog_completions', array['routine_id','date']) then
    create unique index dog_completions_routine_id_date_key on public.dog_completions (routine_id, date);
  end if;
  if not pg_temp.has_unique('public.weekly_settings', array['household_id','week_start']) then
    create unique index weekly_settings_household_week_key on public.weekly_settings (household_id, week_start);
  end if;
  if not pg_temp.has_unique('public.weekly_meetings', array['household_id','week_start']) then
    create unique index weekly_meetings_household_week_key on public.weekly_meetings (household_id, week_start);
  end if;
end $$;

-- ── Chaves estrangeiras que podem faltar em produção (NOT VALID: não reprova dados antigos) ──
do $$
declare r record;
begin
  for r in select * from (values
    ('profiles','household_id','households','cascade'),
    ('task_completions','household_id','households','cascade'),
    ('task_completions','task_id','tasks','cascade'),
    ('dog_routines','dog_id','dogs','cascade'),
    ('dog_routines','household_id','households','cascade'),
    ('dog_completions','routine_id','dog_routines','cascade'),
    ('weekly_settings','household_id','households','cascade'),
    ('weekly_meetings','household_id','households','cascade'),
    ('xp_history','household_id','households','cascade'),
    ('puppy_accidents','household_id','households','cascade'),
    ('puppy_accidents','dog_id','dogs','cascade')
  ) as v(tbl, col, ref, act) loop
    if not pg_temp.has_fk(format('public.%I', r.tbl)::regclass, r.col) then
      execute format('alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete %s not valid',
                     r.tbl, r.tbl || '_' || r.col || '_fkey', r.col, r.ref, r.act);
    end if;
  end loop;
end $$;

-- ── Valores válidos (NOT VALID: linhas antigas não são reprovadas) ──────
do $$
begin
  if not pg_temp.has_constraint('public.tasks', 'tasks_frequency_check') then
    alter table public.tasks add constraint tasks_frequency_check
      check (frequency in ('daily','weekly','biweekly','monthly','once')) not valid;
  end if;
  if not pg_temp.has_constraint('public.tasks', 'tasks_assigned_to_check') then
    alter table public.tasks add constraint tasks_assigned_to_check
      check (assigned_to is null or assigned_to in ('g','s')) not valid;
  end if;
  if not pg_temp.has_constraint('public.weekly_settings', 'weekly_settings_energy_check') then
    alter table public.weekly_settings add constraint weekly_settings_energy_check
      check (energy in ('high','medium','low')) not valid;
  end if;
end $$;

-- ── RLS: mantém o modelo atual (qualquer usuário autenticado, inclusive anônimo) ──
-- A RLS por membro da casa fica para a fase de login.
do $$
declare t text;
begin
  foreach t in array array['households','profiles','tasks','task_completions','dogs','dog_routines',
                           'dog_completions','weekly_settings','weekly_meetings','xp_history','puppy_accidents'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'allow_all_auth') then
      execute format('create policy "allow_all_auth" on public.%I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;
