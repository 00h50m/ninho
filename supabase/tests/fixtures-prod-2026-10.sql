-- SOMENTE PARA TESTE LOCAL. Reproduz o schema REAL de produção (out/2026),
-- reconstruído a partir do backup JSON e dos erros vistos no Supabase.
-- Diferenças em relação ao supabase-schema.sql do repositório:
--   task_completions.completed_by é uuid (não text) e o horário fica em completed_at
--   xp_history guarda o horário em earned_at (sem created_at)
--   scheduled_time é do tipo time em tasks e dog_routines
--   households.invite_code, dogs.birth_date, dog_routines.assigned_to, profiles.display_name
-- Dados sintéticos com o mesmo formato (nenhum dado real).
create extension if not exists "uuid-ossp";

create table households (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null default 'Ninho',
  created_at  timestamptz default now(),
  invite_code text default substr(md5(random()::text), 1, 8)
);
create table profiles (
  id           uuid primary key,
  household_id uuid references households(id),
  name         text not null default 'Integrante',
  role         text default 'member',
  avatar_color text default '#5dcaa5',
  created_at   timestamptz default now(),
  display_name text
);
create table tasks (
  id             uuid primary key default uuid_generate_v4(),
  household_id   uuid references households(id) on delete cascade,
  title          text not null,
  category       text not null default 'general',
  weight         text not null default 'medium',
  xp_value       integer default 2,
  frequency      text default 'weekly',
  assigned_to    text,
  scheduled_time time,
  essential      boolean default false,
  active         boolean default true,
  created_at     timestamptz default now()
);
create table task_completions (
  id           uuid primary key default uuid_generate_v4(),
  task_id      uuid references tasks(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  completed_by uuid references profiles(id),
  completed_at timestamptz not null default now(),
  date         date default current_date,
  unique(task_id, date)
);
create table dogs (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  name         text not null,
  breed        text,
  is_puppy     boolean default false,
  birth_date   date,
  active       boolean default true,
  created_at   timestamptz default now()
);
create table dog_routines (
  id             uuid primary key default uuid_generate_v4(),
  dog_id         uuid references dogs(id) on delete cascade,
  household_id   uuid references households(id) on delete cascade,
  title          text not null,
  frequency      text default 'daily',
  assigned_to    text,
  scheduled_time time,
  active         boolean default true
);
create table dog_completions (
  id         uuid primary key default uuid_generate_v4(),
  routine_id uuid references dog_routines(id) on delete cascade,
  date       date default current_date,
  created_at timestamptz default now(),
  unique(routine_id, date)
);
create table weekly_settings (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  week_start   date not null,
  energy       text default 'medium',
  survival     boolean default false,
  updated_at   timestamptz default now(),
  unique(household_id, week_start)
);
create table weekly_meetings (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  week_start   date not null,
  created_at   timestamptz default now()
);
create table xp_history (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  amount       integer not null default 0,
  reason       text,
  earned_at    timestamptz not null default now()
);
create table puppy_accidents (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  created_at   timestamptz default now()
);

do $$
declare t text;
begin
  foreach t in array array['households','profiles','tasks','task_completions','dogs','dog_routines','dog_completions',
                           'weekly_settings','weekly_meetings','xp_history','puppy_accidents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "allow_all_auth" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Funções antigas que existem em produção
create function public.get_household_xp(hid uuid) returns integer language sql security definer as $$
  select coalesce(sum(amount), 0)::int from xp_history where household_id = hid
$$;

-- ── Dados sintéticos no mesmo formato ──
insert into households (id, name) values ('99999999-0000-0000-0000-000000000001', 'Ninho');
insert into profiles (id, household_id, name) values
  ('99999999-ffff-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'Giovanna'),
  ('99999999-ffff-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'Sabrina');
insert into tasks (id, household_id, title, category, weight, frequency, assigned_to, scheduled_time, essential) values
  ('99999999-aaaa-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'Louça diária', 'kitchen', 'light', 'daily', 'g', null, true),
  ('99999999-aaaa-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'Teste', 'general', 'medium', 'weekly', 's', '21:00:00', false),
  ('99999999-aaaa-0000-0000-000000000003', '99999999-0000-0000-0000-000000000001', 'Até 23:59', 'general', 'medium', 'daily', 's', '23:59:00', false);
insert into dogs (id, household_id, name, is_puppy) values
  ('99999999-dddd-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'Penélope', false),
  ('99999999-dddd-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'Zelda', true);
insert into dog_routines (id, dog_id, household_id, title, frequency, scheduled_time) values
  ('99999999-eeee-0000-0000-000000000001', '99999999-dddd-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'Ração noite', 'daily', '23:59:00'),
  ('99999999-eeee-0000-0000-000000000002', '99999999-dddd-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'Ração noite', 'daily', '23:59:00'),
  ('99999999-eeee-0000-0000-000000000003', '99999999-dddd-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'Água fresca', 'daily', null);
-- Conclusões antigas: completed_by nulo, horário em completed_at
insert into task_completions (task_id, household_id, date, completed_at) values
  ('99999999-aaaa-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', '2026-05-19', '2026-05-19 21:04:04+00'),
  ('99999999-aaaa-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', '2026-05-22', '2026-05-22 18:19:28+00');
insert into dog_completions (routine_id, date, created_at) values
  ('99999999-eeee-0000-0000-000000000001', '2026-05-22', '2026-05-22 18:18:32+00');
insert into xp_history (household_id, amount, reason, earned_at) values
  ('99999999-0000-0000-0000-000000000001', 1, 'dog:99999999-eeee-0000-0000-000000000001:2026-05-22', '2026-05-22 18:18:32+00'),
  ('99999999-0000-0000-0000-000000000001', 2, 'task:99999999-aaaa-0000-0000-000000000001:2026-05-22', '2026-05-22 18:19:28+00');
insert into weekly_settings (household_id, week_start, energy) values
  ('99999999-0000-0000-0000-000000000001', '2026-05-18', 'low'),
  ('99999999-0000-0000-0000-000000000001', '2026-07-27', 'medium');
