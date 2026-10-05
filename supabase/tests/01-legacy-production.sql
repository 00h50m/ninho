-- SOMENTE PARA TESTE LOCAL. Simula o banco de produção ANTES da Fase 0:
-- o supabase-schema.sql antigo (fixtures-legacy-schema.sql, carregado antes deste arquivo)
-- + o que foi criado direto no Supabase e não estava versionado
-- + dados com os problemas conhecidos (XP duplicado, rotina sem household_id, completed_by vazio).

alter table public.profiles add column if not exists display_name text;

create table public.weekly_meetings (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references public.households(id) on delete cascade,
  week_start date not null,
  what_worked text, what_overloaded text, adjustments text, priorities text,
  mood_g text, mood_s text, wins text, next_mode text, reward text,
  created_at timestamptz default now(),
  unique (household_id, week_start)
);

-- Sem PK de propósito (cenário pior: tabela criada à mão)
create table public.xp_history (
  household_id uuid,
  amount integer,
  reason text,
  created_at timestamptz default now()
);

create table public.puppy_accidents (
  id uuid primary key default uuid_generate_v4(),
  dog_id uuid,
  household_id uuid,
  location text,
  date date default current_date,
  occurred_at timestamptz default now()
);

-- Funções antigas (definição real desconhecida; esta é uma aproximação)
create function public.get_household_xp(hid uuid) returns bigint language sql stable as
  $$ select coalesce(sum(amount),0) from public.xp_history where household_id = hid $$;
create function public.get_streak(hid uuid) returns integer language sql stable as $$ select 0 $$;

-- ── Dados ──
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'), ('00000000-0000-0000-0000-0000000000b1');
insert into public.households (id, name) values ('11111111-1111-1111-1111-111111111111', 'Ninho'), ('22222222-2222-2222-2222-222222222222', 'Outra casa');
insert into public.profiles (id, household_id, name, role, display_name) values
  ('00000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'Integrante', 'g', 'Giovanna'),
  ('00000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'Integrante', 's', 'Sabrina'),
  ('00000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'Integrante', 'g', null);

insert into public.tasks (id, household_id, title, category, weight, frequency, assigned_to, essential) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Louça diária', 'kitchen', 'light', 'daily', 'g', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Faxina geral', 'general', 'heavy', 'monthly', null, false),
  ('aaaaaaaa-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Tarefa da outra casa', 'general', 'medium', 'daily', null, false);

-- Conclusões antigas: completed_by vazio
insert into public.task_completions (task_id, household_id, date) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', current_date - 1),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', current_date - 2);

-- XP duplicado (clique duplo antigo) e XP normal
insert into public.xp_history (household_id, amount, reason) values
  ('11111111-1111-1111-1111-111111111111', 1, 'task:aaaaaaaa-0000-0000-0000-000000000001:' || to_char(current_date - 1, 'YYYY-MM-DD')),
  ('11111111-1111-1111-1111-111111111111', 1, 'task:aaaaaaaa-0000-0000-0000-000000000001:' || to_char(current_date - 1, 'YYYY-MM-DD')),
  ('11111111-1111-1111-1111-111111111111', 1, 'task:aaaaaaaa-0000-0000-0000-000000000001:' || to_char(current_date - 2, 'YYYY-MM-DD')),
  ('11111111-1111-1111-1111-111111111111', 5, null);

insert into public.dogs (id, household_id, name, is_puppy) values
  ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Penélope', false),
  ('dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Zelda', true);
-- Rotina antiga SEM household_id (backfill pelo cão)
insert into public.dog_routines (id, dog_id, household_id, title, frequency, scheduled_time) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', null, 'Ração manhã', 'daily', '07:00'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Ração manhã', 'daily', '07:00');
insert into public.dog_completions (routine_id, date) values
  ('eeeeeeee-0000-0000-0000-000000000001', current_date - 1),
  ('eeeeeeee-0000-0000-0000-000000000002', current_date - 1);

insert into public.weekly_settings (household_id, week_start, energy, survival) values
  ('11111111-1111-1111-1111-111111111111', date_trunc('week', current_date)::date, 'low', false);
insert into public.weekly_meetings (household_id, week_start, wins) values
  ('11111111-1111-1111-1111-111111111111', date_trunc('week', current_date)::date - 7, 'Semana leve');
insert into public.puppy_accidents (dog_id, household_id, location, date) values
  ('dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Sala', current_date);
