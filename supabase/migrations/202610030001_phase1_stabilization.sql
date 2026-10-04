-- Ninho — Fase 1: estabilização técnica e alinhamento do schema
-- Migration incremental e idempotente. Não apaga registros existentes.

begin;

create extension if not exists "uuid-ossp";

create or replace function public.ninho_today()
returns date
language sql
stable
as $$
  select timezone('America/Sao_Paulo', now())::date;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.households (
  id uuid primary key default uuid_generate_v4(),
  name text not null default 'Ninho',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  name text not null default 'Integrante',
  display_name text not null default 'Integrante',
  role text not null default 'g',
  avatar_color text not null default '#5dcaa5',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references public.households(id) on delete cascade,
  title text not null,
  category text not null default 'general',
  weight text not null default 'medium' check (weight in ('light', 'medium', 'heavy')),
  frequency text not null default 'weekly' check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'once')),
  assigned_to text check (assigned_to is null or assigned_to in ('g', 's')),
  scheduled_time time,
  essential boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_completions (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  completed_by text check (completed_by is null or completed_by in ('g', 's')),
  date date not null default public.ninho_today(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, date)
);

create table if not exists public.dogs (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references public.households(id) on delete cascade,
  name text not null,
  breed text,
  is_puppy boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dog_routines (
  id uuid primary key default uuid_generate_v4(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  title text not null,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'once')),
  scheduled_time time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dog_completions (
  id uuid primary key default uuid_generate_v4(),
  routine_id uuid not null references public.dog_routines(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  completed_by text check (completed_by is null or completed_by in ('g', 's')),
  date date not null default public.ninho_today(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_id, date)
);

create table if not exists public.weekly_settings (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  energy text not null default 'medium' check (energy in ('high', 'medium', 'low')),
  survival boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, week_start)
);

create table if not exists public.weekly_meetings (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  what_worked text not null default '',
  what_overloaded text not null default '',
  adjustments text not null default '',
  priorities text not null default '',
  mood_g text not null default 'ok',
  mood_s text not null default 'ok',
  wins text not null default '',
  next_mode text not null default 'normal',
  reward text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, week_start)
);

create table if not exists public.xp_history (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references public.households(id) on delete cascade,
  amount integer not null,
  reason text not null,
  idempotency_key text not null,
  duplicate_of uuid references public.xp_history(id),
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.puppy_accidents (
  id uuid primary key default uuid_generate_v4(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  location text not null,
  date date not null default public.ninho_today(),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Evolução não destrutiva para instalações existentes.
alter table public.households add column if not exists updated_at timestamptz not null default now();

alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
update public.profiles
set name = coalesce(nullif(name, ''), nullif(display_name, ''), 'Integrante'),
    display_name = coalesce(nullif(display_name, ''), nullif(name, ''), 'Integrante')
where name is null or display_name is null or name = '' or display_name = '';
alter table public.profiles alter column name set default 'Integrante';
alter table public.profiles alter column display_name set default 'Integrante';
alter table public.profiles alter column name set not null;
alter table public.profiles alter column display_name set not null;

alter table public.tasks add column if not exists updated_at timestamptz not null default now();
alter table public.task_completions add column if not exists created_at timestamptz not null default now();
alter table public.task_completions add column if not exists completed_by text;
alter table public.task_completions add column if not exists updated_at timestamptz not null default now();
alter table public.dogs add column if not exists updated_at timestamptz not null default now();
alter table public.dog_routines add column if not exists created_at timestamptz not null default now();
alter table public.dog_routines add column if not exists updated_at timestamptz not null default now();
alter table public.dog_completions add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.dog_completions add column if not exists completed_by text;
alter table public.dog_completions add column if not exists created_at timestamptz not null default now();
alter table public.dog_completions add column if not exists updated_at timestamptz not null default now();
update public.dog_completions completion
set household_id = routine.household_id
from public.dog_routines routine
where completion.routine_id = routine.id
  and completion.household_id is null;
alter table public.weekly_settings add column if not exists created_at timestamptz not null default now();

alter table public.weekly_meetings add column if not exists what_worked text not null default '';
alter table public.weekly_meetings add column if not exists what_overloaded text not null default '';
alter table public.weekly_meetings add column if not exists adjustments text not null default '';
alter table public.weekly_meetings add column if not exists priorities text not null default '';
alter table public.weekly_meetings add column if not exists mood_g text not null default 'ok';
alter table public.weekly_meetings add column if not exists mood_s text not null default 'ok';
alter table public.weekly_meetings add column if not exists wins text not null default '';
alter table public.weekly_meetings add column if not exists next_mode text not null default 'normal';
alter table public.weekly_meetings add column if not exists reward text not null default '';
alter table public.weekly_meetings add column if not exists created_at timestamptz not null default now();
alter table public.weekly_meetings add column if not exists updated_at timestamptz not null default now();

alter table public.xp_history add column if not exists reason text;
alter table public.xp_history add column if not exists idempotency_key text;
alter table public.xp_history add column if not exists duplicate_of uuid;
alter table public.xp_history add column if not exists voided_at timestamptz;
alter table public.xp_history add column if not exists created_at timestamptz not null default now();
alter table public.xp_history add column if not exists updated_at timestamptz not null default now();
update public.xp_history
set idempotency_key = coalesce(nullif(reason, ''), 'legacy:' || id::text),
    reason = coalesce(nullif(reason, ''), 'legacy:' || id::text)
where idempotency_key is null or reason is null or reason = '';
alter table public.xp_history alter column reason set not null;
alter table public.xp_history alter column idempotency_key set not null;

alter table public.puppy_accidents add column if not exists date date not null default public.ninho_today();
alter table public.puppy_accidents add column if not exists occurred_at timestamptz not null default now();
alter table public.puppy_accidents add column if not exists created_at timestamptz not null default now();
alter table public.puppy_accidents add column if not exists updated_at timestamptz not null default now();

with ranked as (
  select
    id,
    first_value(id) over (
      partition by household_id, idempotency_key
      order by created_at, id
    ) as original_id,
    row_number() over (
      partition by household_id, idempotency_key
      order by created_at, id
    ) as occurrence_number
  from public.xp_history
  where duplicate_of is null
)
update public.xp_history history
set duplicate_of = ranked.original_id,
    updated_at = now()
from ranked
where history.id = ranked.id
  and ranked.occurrence_number > 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'xp_history_duplicate_of_fkey'
      and conrelid = 'public.xp_history'::regclass
  ) then
    alter table public.xp_history
      add constraint xp_history_duplicate_of_fkey
      foreign key (duplicate_of) references public.xp_history(id);
  end if;
end;
$$;

-- Constraints não validadas preservam dados legados e passam a proteger novos registros.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_role_check check (role in ('g', 's')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_frequency_check_v2' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_frequency_check_v2 check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'once')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_assigned_to_check' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_assigned_to_check check (assigned_to is null or assigned_to in ('g', 's')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'task_completions_completed_by_check' and conrelid = 'public.task_completions'::regclass) then
    alter table public.task_completions add constraint task_completions_completed_by_check check (completed_by is null or completed_by in ('g', 's')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dog_completions_household_required' and conrelid = 'public.dog_completions'::regclass) then
    alter table public.dog_completions add constraint dog_completions_household_required check (household_id is not null) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dog_routines_frequency_check_v2' and conrelid = 'public.dog_routines'::regclass) then
    alter table public.dog_routines add constraint dog_routines_frequency_check_v2 check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'once')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'weekly_settings_energy_check_v2' and conrelid = 'public.weekly_settings'::regclass) then
    alter table public.weekly_settings add constraint weekly_settings_energy_check_v2 check (energy in ('high', 'medium', 'low')) not valid;
  end if;
end;
$$;

create unique index if not exists idx_task_completions_task_date
  on public.task_completions(task_id, date);
create unique index if not exists idx_dog_completions_routine_date
  on public.dog_completions(routine_id, date);
create unique index if not exists idx_xp_history_idempotency
  on public.xp_history(household_id, idempotency_key)
  where duplicate_of is null and idempotency_key is not null;

create index if not exists idx_profiles_household on public.profiles(household_id);
create index if not exists idx_tasks_household_active on public.tasks(household_id, active);
create index if not exists idx_task_completions_household_date on public.task_completions(household_id, date desc);
create index if not exists idx_dogs_household_active on public.dogs(household_id, active);
create index if not exists idx_dog_routines_household_active on public.dog_routines(household_id, active);
create index if not exists idx_dog_completions_household_date on public.dog_completions(household_id, date desc);
create index if not exists idx_weekly_settings_household_week on public.weekly_settings(household_id, week_start desc);
create index if not exists idx_weekly_meetings_household_week on public.weekly_meetings(household_id, week_start desc);
create index if not exists idx_xp_history_household_created on public.xp_history(household_id, created_at desc);
create index if not exists idx_puppy_accidents_household_date on public.puppy_accidents(household_id, date desc);
create index if not exists idx_puppy_accidents_dog_occurred on public.puppy_accidents(dog_id, occurred_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'households', 'profiles', 'tasks', 'task_completions', 'dogs',
    'dog_routines', 'dog_completions', 'weekly_settings', 'weekly_meetings',
    'xp_history', 'puppy_accidents'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

drop function if exists public.get_household_xp(uuid);
create function public.get_household_xp(hid uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(amount), 0)::integer
  from public.xp_history
  where household_id = hid
    and duplicate_of is null
    and voided_at is null;
$$;

drop function if exists public.get_streak(uuid);
create function public.get_streak(hid uuid)
returns integer
language plpgsql
stable
as $$
declare
  anchor_date date := public.ninho_today();
  result integer := 0;
begin
  if not exists (
    select 1 from public.task_completions
    where household_id = hid and date = anchor_date
  ) then
    anchor_date := anchor_date - 1;
  end if;

  select count(*)::integer
  into result
  from (
    select date, row_number() over (order by date desc) as position
    from (
      select distinct date
      from public.task_completions
      where household_id = hid and date <= anchor_date
    ) completed_days
  ) ordered_days
  where date = anchor_date - (position::integer - 1);

  return coalesce(result, 0);
end;
$$;

create or replace function public.set_task_completion(
  p_household_id uuid,
  p_task_id uuid,
  p_date date,
  p_completed boolean,
  p_completed_by text default null
)
returns jsonb
language plpgsql
as $$
declare
  task_weight text;
  xp_amount integer;
  xp_key text := 'task:' || p_task_id::text || ':' || p_date::text;
begin
  select weight into task_weight
  from public.tasks
  where id = p_task_id and household_id = p_household_id and active = true
  for update;

  if task_weight is null then
    raise exception 'Tarefa não encontrada para a casa informada.' using errcode = 'P0002';
  end if;

  if p_completed_by is not null and p_completed_by not in ('g', 's') then
    raise exception 'Integrante inválida.' using errcode = '22023';
  end if;

  xp_amount := case task_weight when 'light' then 1 when 'medium' then 2 when 'heavy' then 3 else 0 end;

  if p_completed then
    insert into public.task_completions(task_id, household_id, completed_by, date)
    values (p_task_id, p_household_id, p_completed_by, p_date)
    on conflict (task_id, date) do update
      set completed_by = coalesce(excluded.completed_by, public.task_completions.completed_by),
          updated_at = now();

    insert into public.xp_history(household_id, amount, reason, idempotency_key)
    values (p_household_id, xp_amount, xp_key, xp_key)
    on conflict (household_id, idempotency_key)
      where duplicate_of is null and idempotency_key is not null
    do update set
      amount = excluded.amount,
      reason = excluded.reason,
      voided_at = null,
      updated_at = now();
  else
    delete from public.task_completions
    where task_id = p_task_id and household_id = p_household_id and date = p_date;

    update public.xp_history
    set voided_at = now(), updated_at = now()
    where household_id = p_household_id
      and idempotency_key = xp_key
      and duplicate_of is null
      and voided_at is null;
  end if;

  return jsonb_build_object('completed', p_completed, 'xp', public.get_household_xp(p_household_id));
end;
$$;

create or replace function public.set_dog_completion(
  p_household_id uuid,
  p_routine_id uuid,
  p_date date,
  p_completed boolean,
  p_completed_by text default null
)
returns jsonb
language plpgsql
as $$
declare
  routine_exists boolean;
  xp_key text := 'dog:' || p_routine_id::text || ':' || p_date::text;
begin
  select true into routine_exists
  from public.dog_routines
  where id = p_routine_id and household_id = p_household_id and active = true
  for update;

  if coalesce(routine_exists, false) is false then
    raise exception 'Rotina não encontrada para a casa informada.' using errcode = 'P0002';
  end if;

  if p_completed_by is not null and p_completed_by not in ('g', 's') then
    raise exception 'Integrante inválida.' using errcode = '22023';
  end if;

  if p_completed then
    insert into public.dog_completions(routine_id, household_id, completed_by, date)
    values (p_routine_id, p_household_id, p_completed_by, p_date)
    on conflict (routine_id, date) do update
      set household_id = excluded.household_id,
          completed_by = coalesce(excluded.completed_by, public.dog_completions.completed_by),
          updated_at = now();

    insert into public.xp_history(household_id, amount, reason, idempotency_key)
    values (p_household_id, 1, xp_key, xp_key)
    on conflict (household_id, idempotency_key)
      where duplicate_of is null and idempotency_key is not null
    do update set
      amount = excluded.amount,
      reason = excluded.reason,
      voided_at = null,
      updated_at = now();
  else
    delete from public.dog_completions
    where routine_id = p_routine_id and household_id = p_household_id and date = p_date;

    update public.xp_history
    set voided_at = now(), updated_at = now()
    where household_id = p_household_id
      and idempotency_key = xp_key
      and duplicate_of is null
      and voided_at is null;
  end if;

  return jsonb_build_object('completed', p_completed, 'xp', public.get_household_xp(p_household_id));
end;
$$;

create or replace function public.apply_task_assignments(
  p_household_id uuid,
  p_assignments jsonb
)
returns integer
language plpgsql
as $$
declare
  assignment jsonb;
  changed integer := 0;
  target_id uuid;
  target_assignee text;
begin
  if jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'A distribuição deve ser uma lista.' using errcode = '22023';
  end if;

  for assignment in select * from jsonb_array_elements(p_assignments)
  loop
    target_id := (assignment ->> 'id')::uuid;
    target_assignee := assignment ->> 'assigned_to';

    if target_assignee not in ('g', 's') then
      raise exception 'Responsável inválida na distribuição.' using errcode = '22023';
    end if;

    update public.tasks
    set assigned_to = target_assignee
    where id = target_id and household_id = p_household_id and active = true;

    if not found then
      raise exception 'Tarefa inválida na distribuição.' using errcode = 'P0002';
    end if;

    changed := changed + 1;
  end loop;

  return changed;
end;
$$;

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.dogs enable row level security;
alter table public.dog_routines enable row level security;
alter table public.dog_completions enable row level security;
alter table public.weekly_settings enable row level security;
alter table public.weekly_meetings enable row level security;
alter table public.xp_history enable row level security;
alter table public.puppy_accidents enable row level security;

-- Política deliberadamente temporária: o isolamento definitivo será aplicado na Fase 9.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'households', 'profiles', 'tasks', 'task_completions', 'dogs',
    'dog_routines', 'dog_completions', 'weekly_settings', 'weekly_meetings',
    'xp_history', 'puppy_accidents'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'allow_all_auth'
    ) then
      execute format(
        'create policy allow_all_auth on public.%I for all to authenticated using (true) with check (true)',
        table_name
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.ninho_today() to authenticated;
grant execute on function public.get_household_xp(uuid) to authenticated;
grant execute on function public.get_streak(uuid) to authenticated;
grant execute on function public.set_task_completion(uuid, uuid, date, boolean, text) to authenticated;
grant execute on function public.set_dog_completion(uuid, uuid, date, boolean, text) to authenticated;
grant execute on function public.apply_task_assignments(uuid, jsonb) to authenticated;

commit;
