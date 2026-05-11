-- =============================================
-- NINHO — Schema do banco de dados Supabase
-- Cole esse SQL no Supabase SQL Editor
-- =============================================

-- Extensão para UUIDs
create extension if not exists "uuid-ossp";

-- ── HOUSEHOLDS ──────────────────────────────
create table households (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null default 'Ninho',
  invite_code text unique default substring(md5(random()::text), 1, 8),
  created_at  timestamptz default now()
);

-- ── PROFILES ────────────────────────────────
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references households(id),
  name         text not null default 'Integrante',
  avatar_color text default '#5dcaa5',
  role         text default 'member',
  created_at   timestamptz default now()
);

-- ── TASKS ───────────────────────────────────
create table tasks (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  title        text not null,
  category     text not null default 'general',
  weight       text not null default 'medium' check (weight in ('light','medium','heavy')),
  frequency    text not null default 'weekly' check (frequency in ('daily','weekly','biweekly','monthly','once')),
  assigned_to  uuid references profiles(id) on delete set null,
  scheduled_time time,
  xp_value     int not null default 2,
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ── TASK COMPLETIONS ────────────────────────
create table task_completions (
  id           uuid primary key default uuid_generate_v4(),
  task_id      uuid references tasks(id) on delete cascade,
  completed_by uuid references profiles(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  completed_at timestamptz default now(),
  date         date default current_date
);

-- ── DOGS ────────────────────────────────────
create table dogs (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  name         text not null,
  breed        text,
  birth_date   date,
  is_puppy     boolean default false,
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ── DOG ROUTINES ────────────────────────────
create table dog_routines (
  id             uuid primary key default uuid_generate_v4(),
  dog_id         uuid references dogs(id) on delete cascade,
  household_id   uuid references households(id) on delete cascade,
  title          text not null,
  frequency      text default 'daily',
  scheduled_time time,
  assigned_to    uuid references profiles(id) on delete set null,
  active         boolean default true
);

-- ── DOG ROUTINE COMPLETIONS ─────────────────
create table dog_routine_completions (
  id           uuid primary key default uuid_generate_v4(),
  routine_id   uuid references dog_routines(id) on delete cascade,
  completed_by uuid references profiles(id) on delete cascade,
  completed_at timestamptz default now(),
  date         date default current_date
);

-- ── WEEKLY ENERGY ───────────────────────────
create table weekly_energy (
  id           uuid primary key default uuid_generate_v4(),
  profile_id   uuid references profiles(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  week_start   date not null,
  energy_level text not null default 'medium' check (energy_level in ('high','medium','low')),
  unique(profile_id, week_start)
);

-- ── SURVIVAL MODE ───────────────────────────
create table survival_weeks (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  week_start   date not null,
  activated_by uuid references profiles(id),
  activated_at timestamptz default now(),
  unique(household_id, week_start)
);

-- ── HABITS ──────────────────────────────────
create table habits (
  id           uuid primary key default uuid_generate_v4(),
  profile_id   uuid references profiles(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  title        text not null,
  icon         text default '✦',
  active       boolean default true,
  created_at   timestamptz default now()
);

create table habit_completions (
  id           uuid primary key default uuid_generate_v4(),
  habit_id     uuid references habits(id) on delete cascade,
  completed_at timestamptz default now(),
  date         date default current_date
);

-- ── ROW LEVEL SECURITY ──────────────────────
alter table households              enable row level security;
alter table profiles                enable row level security;
alter table tasks                   enable row level security;
alter table task_completions        enable row level security;
alter table dogs                    enable row level security;
alter table dog_routines            enable row level security;
alter table dog_routine_completions enable row level security;
alter table weekly_energy           enable row level security;
alter table survival_weeks          enable row level security;
alter table habits                  enable row level security;
alter table habit_completions       enable row level security;

-- Função helper: retorna o household_id do usuário atual
create or replace function my_household_id()
returns uuid language sql security definer as $$
  select household_id from profiles where id = auth.uid()
$$;

-- Policies: usuário só vê dados do próprio household
create policy "household members only" on households
  for all using (id = my_household_id());

create policy "household members only" on profiles
  for all using (household_id = my_household_id());

create policy "household members only" on tasks
  for all using (household_id = my_household_id());

create policy "household members only" on task_completions
  for all using (household_id = my_household_id());

create policy "household members only" on dogs
  for all using (household_id = my_household_id());

create policy "household members only" on dog_routines
  for all using (household_id = my_household_id());

create policy "household members only" on dog_routine_completions
  for all using (completed_by in (
    select id from profiles where household_id = my_household_id()
  ));

create policy "household members only" on weekly_energy
  for all using (household_id = my_household_id());

create policy "household members only" on survival_weeks
  for all using (household_id = my_household_id());

create policy "own habits" on habits
  for all using (profile_id = auth.uid());

create policy "own habit completions" on habit_completions
  for all using (habit_id in (
    select id from habits where profile_id = auth.uid()
  ));

-- ── FUNÇÃO: calcular XP total do household ──
create or replace function household_xp(hid uuid)
returns int language sql security definer as $$
  select coalesce(sum(t.xp_value), 0)::int
  from task_completions tc
  join tasks t on t.id = tc.task_id
  where tc.household_id = hid
$$;

-- ── FUNÇÃO: calcular barra de caos ──────────
-- (% de tarefas ativas não completadas hoje)
create or replace function household_chaos(hid uuid)
returns int language sql security definer as $$
  with active_tasks as (
    select count(*) as total
    from tasks
    where household_id = hid and active = true
    and frequency = 'daily'
  ),
  done_today as (
    select count(distinct task_id) as done
    from task_completions
    where household_id = hid and date = current_date
  )
  select case
    when (select total from active_tasks) = 0 then 0
    else greatest(0, 100 - round(
      ((select done from done_today)::numeric /
       (select total from active_tasks)::numeric) * 100
    ))::int
  end
$$;
