-- ══════════════════════════════════════════════════════
-- NINHO — Schema completo v2
-- Cole tudo no SQL Editor do Supabase e clique em Run
-- ══════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── HOUSEHOLDS ─────────────────────────────────────────
create table if not exists households (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null default 'Ninho',
  created_at timestamptz default now()
);

-- ── PROFILES ───────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references households(id),
  name         text not null default 'Integrante',
  role         text default 'g',
  avatar_color text default '#5dcaa5',
  created_at   timestamptz default now()
);

-- ── TASKS ──────────────────────────────────────────────
create table if not exists tasks (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  title        text not null,
  category     text not null default 'general',
  weight       text not null default 'medium' check (weight in ('light','medium','heavy')),
  frequency    text not null default 'weekly',
  assigned_to  text,
  scheduled_time text,
  essential    boolean default false,
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ── TASK COMPLETIONS ───────────────────────────────────
create table if not exists task_completions (
  id           uuid primary key default uuid_generate_v4(),
  task_id      uuid references tasks(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  completed_by text,
  date         date default current_date,
  created_at   timestamptz default now(),
  unique(task_id, date)
);

-- ── DOGS ───────────────────────────────────────────────
create table if not exists dogs (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  name         text not null,
  breed        text,
  is_puppy     boolean default false,
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ── DOG ROUTINES ───────────────────────────────────────
create table if not exists dog_routines (
  id           uuid primary key default uuid_generate_v4(),
  dog_id       uuid references dogs(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  title        text not null,
  frequency    text default 'daily',
  scheduled_time text,
  active       boolean default true
);

-- ── DOG ROUTINE COMPLETIONS ────────────────────────────
create table if not exists dog_completions (
  id         uuid primary key default uuid_generate_v4(),
  routine_id uuid references dog_routines(id) on delete cascade,
  date       date default current_date,
  created_at timestamptz default now(),
  unique(routine_id, date)
);

-- ── WEEKLY SETTINGS ────────────────────────────────────
create table if not exists weekly_settings (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  week_start   date not null,
  energy       text default 'medium',
  survival     boolean default false,
  updated_at   timestamptz default now(),
  unique(household_id, week_start)
);

-- ── RLS ────────────────────────────────────────────────
alter table households       enable row level security;
alter table profiles         enable row level security;
alter table tasks            enable row level security;
alter table task_completions enable row level security;
alter table dogs             enable row level security;
alter table dog_routines     enable row level security;
alter table dog_completions  enable row level security;
alter table weekly_settings  enable row level security;

-- Políticas permissivas para usuários autenticados (anônimo incluído)
create policy "allow_all_auth" on households       for all to authenticated using (true) with check (true);
create policy "allow_all_auth" on profiles         for all to authenticated using (true) with check (true);
create policy "allow_all_auth" on tasks            for all to authenticated using (true) with check (true);
create policy "allow_all_auth" on task_completions for all to authenticated using (true) with check (true);
create policy "allow_all_auth" on dogs             for all to authenticated using (true) with check (true);
create policy "allow_all_auth" on dog_routines     for all to authenticated using (true) with check (true);
create policy "allow_all_auth" on dog_completions  for all to authenticated using (true) with check (true);
create policy "allow_all_auth" on weekly_settings  for all to authenticated using (true) with check (true);
