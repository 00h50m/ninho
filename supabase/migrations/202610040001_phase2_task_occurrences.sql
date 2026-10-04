-- NINHO — Fase 2: tarefas-modelo, recorrência real e ocorrências
-- Migração aditiva: preserva tarefas, conclusões e XP existentes.

begin;

alter table public.tasks add column if not exists recurrence_type text;
alter table public.tasks add column if not exists recurrence_interval integer not null default 1;
alter table public.tasks add column if not exists recurrence_weekdays smallint[] not null default '{}'::smallint[];
alter table public.tasks add column if not exists recurrence_day_of_month smallint;
alter table public.tasks add column if not exists starts_on date;
alter table public.tasks add column if not exists ends_on date;
alter table public.tasks add column if not exists paused_until date;
alter table public.tasks add column if not exists occurrences_generated_through date;

update public.tasks
set recurrence_type = case frequency
  when 'daily' then 'daily'
  when 'weekly' then 'weekly'
  when 'biweekly' then 'biweekly'
  when 'monthly' then 'monthly'
  when 'once' then 'once'
  else 'weekly'
end
where recurrence_type is null;

update public.tasks
set starts_on = public.ninho_today()
where starts_on is null;

update public.tasks
set recurrence_day_of_month = extract(day from starts_on)::smallint
where recurrence_type = 'monthly'
  and recurrence_day_of_month is null;

alter table public.tasks alter column recurrence_type set not null;
alter table public.tasks alter column starts_on set not null;

alter table public.tasks drop constraint if exists tasks_frequency_check;
alter table public.tasks drop constraint if exists tasks_frequency_check_v2;
alter table public.tasks drop constraint if exists tasks_recurrence_type_check;
alter table public.tasks drop constraint if exists tasks_recurrence_interval_check;
alter table public.tasks drop constraint if exists tasks_recurrence_weekdays_check;
alter table public.tasks drop constraint if exists tasks_recurrence_weekdays_required_check;
alter table public.tasks drop constraint if exists tasks_recurrence_day_check;
alter table public.tasks drop constraint if exists tasks_recurrence_dates_check;

alter table public.tasks add constraint tasks_frequency_check
  check (frequency in ('daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'interval_days', 'after_completion', 'once')) not valid;
alter table public.tasks add constraint tasks_recurrence_type_check
  check (recurrence_type in ('daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'interval_days', 'after_completion', 'once')) not valid;
alter table public.tasks add constraint tasks_recurrence_interval_check
  check (recurrence_interval between 1 and 365) not valid;
alter table public.tasks add constraint tasks_recurrence_weekdays_check
  check (recurrence_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]) not valid;
alter table public.tasks add constraint tasks_recurrence_weekdays_required_check
  check (recurrence_type <> 'weekdays' or cardinality(recurrence_weekdays) > 0) not valid;
alter table public.tasks add constraint tasks_recurrence_day_check
  check (recurrence_day_of_month is null or recurrence_day_of_month between 1 and 31) not valid;
alter table public.tasks add constraint tasks_recurrence_dates_check
  check (ends_on is null or ends_on >= starts_on) not valid;

create or replace function public.sync_task_recurrence()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.recurrence_type := coalesce(new.recurrence_type, new.frequency, 'weekly');
    new.frequency := new.recurrence_type;
  elsif new.recurrence_type is distinct from old.recurrence_type then
    new.frequency := new.recurrence_type;
  elsif new.frequency is distinct from old.frequency then
    new.recurrence_type := new.frequency;
  end if;

  new.starts_on := coalesce(new.starts_on, public.ninho_today());
  new.recurrence_interval := greatest(1, coalesce(new.recurrence_interval, 1));
  new.recurrence_weekdays := coalesce(new.recurrence_weekdays, '{}'::smallint[]);

  if new.recurrence_type = 'weekdays' and cardinality(new.recurrence_weekdays) = 0 then
    new.recurrence_weekdays := array[extract(isodow from new.starts_on)::smallint];
  end if;

  if new.recurrence_type = 'monthly' and new.recurrence_day_of_month is null then
    new.recurrence_day_of_month := extract(day from new.starts_on)::smallint;
  end if;

  if tg_op = 'UPDATE' and row(
    new.recurrence_type,
    new.recurrence_interval,
    new.recurrence_weekdays,
    new.recurrence_day_of_month,
    new.starts_on,
    new.ends_on,
    new.paused_until,
    new.scheduled_time
  ) is distinct from row(
    old.recurrence_type,
    old.recurrence_interval,
    old.recurrence_weekdays,
    old.recurrence_day_of_month,
    old.starts_on,
    old.ends_on,
    old.paused_until,
    old.scheduled_time
  ) then
    new.occurrences_generated_through := least(
      coalesce(new.occurrences_generated_through, public.ninho_today() - 1),
      public.ninho_today() - 1
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sync_task_recurrence on public.tasks;
create trigger sync_task_recurrence
before insert or update on public.tasks
for each row execute function public.sync_task_recurrence();

create table if not exists public.task_occurrences (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  original_scheduled_date date not null,
  scheduled_date date not null,
  scheduled_time time,
  planned_assignee text check (planned_assignee is null or planned_assignee in ('g', 's')),
  completed_by text check (completed_by is null or completed_by in ('g', 's')),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'postponed', 'skipped', 'cancelled')),
  completed_at timestamptz,
  resolution_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, original_scheduled_date)
);

alter table public.task_completions add column if not exists occurrence_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'task_completions_occurrence_id_fkey'
      and conrelid = 'public.task_completions'::regclass
  ) then
    alter table public.task_completions
      add constraint task_completions_occurrence_id_fkey
      foreign key (occurrence_id) references public.task_occurrences(id) on delete cascade;
  end if;
end;
$$;

insert into public.task_occurrences (
  task_id,
  household_id,
  original_scheduled_date,
  scheduled_date,
  scheduled_time,
  planned_assignee,
  completed_by,
  status,
  completed_at,
  created_at,
  updated_at
)
select
  completion.task_id,
  completion.household_id,
  completion.date,
  completion.date,
  task.scheduled_time,
  task.assigned_to,
  completion.completed_by,
  'completed',
  coalesce(completion.updated_at, completion.created_at),
  completion.created_at,
  completion.updated_at
from public.task_completions completion
join public.tasks task on task.id = completion.task_id
on conflict (task_id, original_scheduled_date) do update
set completed_by = coalesce(excluded.completed_by, public.task_occurrences.completed_by),
    status = 'completed',
    completed_at = coalesce(public.task_occurrences.completed_at, excluded.completed_at),
    updated_at = greatest(public.task_occurrences.updated_at, excluded.updated_at);

update public.task_completions completion
set occurrence_id = occurrence.id
from public.task_occurrences occurrence
where occurrence.task_id = completion.task_id
  and occurrence.original_scheduled_date = completion.date
  and completion.occurrence_id is distinct from occurrence.id;

create unique index if not exists idx_task_completions_occurrence
  on public.task_completions(occurrence_id)
  where occurrence_id is not null;
create index if not exists idx_task_occurrences_household_due
  on public.task_occurrences(household_id, status, scheduled_date);
create index if not exists idx_task_occurrences_task_due
  on public.task_occurrences(task_id, scheduled_date);
create index if not exists idx_tasks_household_generation
  on public.tasks(household_id, active, occurrences_generated_through);

create or replace function public.task_recurrence_matches(
  p_recurrence_type text,
  p_starts_on date,
  p_candidate date,
  p_interval integer,
  p_weekdays smallint[],
  p_day_of_month smallint,
  p_ends_on date
)
returns boolean
language plpgsql
immutable
as $$
declare
  elapsed integer := p_candidate - p_starts_on;
  month_last_day integer;
  target_day integer;
begin
  if p_candidate < p_starts_on or (p_ends_on is not null and p_candidate > p_ends_on) then
    return false;
  end if;

  case p_recurrence_type
    when 'daily' then return true;
    when 'weekdays' then return extract(isodow from p_candidate)::smallint = any(coalesce(p_weekdays, '{}'::smallint[]));
    when 'weekly' then return mod(elapsed, 7) = 0;
    when 'biweekly' then return mod(elapsed, 14) = 0;
    when 'monthly' then
      month_last_day := extract(day from (date_trunc('month', p_candidate::timestamp) + interval '1 month - 1 day'))::integer;
      target_day := least(coalesce(p_day_of_month, extract(day from p_starts_on)::integer), month_last_day);
      return extract(day from p_candidate)::integer = target_day;
    when 'interval_days' then return mod(elapsed, greatest(1, coalesce(p_interval, 1))) = 0;
    when 'once' then return p_candidate = p_starts_on;
    else return false;
  end case;
end;
$$;

create or replace function public.generate_task_occurrences(
  p_household_id uuid,
  p_until date default (public.ninho_today() + 62),
  p_task_id uuid default null
)
returns integer
language plpgsql
as $$
declare
  task_record public.tasks%rowtype;
  cursor_date date;
  final_date date;
  next_date date;
  last_completed_on date;
  generated integer := 0;
  affected integer := 0;
  has_open_occurrence boolean;
begin
  if p_until is null then
    p_until := public.ninho_today() + 62;
  end if;

  for task_record in
    select *
    from public.tasks
    where household_id = p_household_id
      and active = true
      and (p_task_id is null or id = p_task_id)
    order by id
    for update
  loop
    if task_record.paused_until is not null and task_record.paused_until >= public.ninho_today() then
      update public.task_occurrences
      set status = 'cancelled',
          resolution_reason = coalesce(resolution_reason, 'Pausa temporária'),
          updated_at = now()
      where task_id = task_record.id
        and status in ('pending', 'postponed')
        and scheduled_date between public.ninho_today() and task_record.paused_until;
    end if;

    if task_record.recurrence_type = 'after_completion' then
      select exists (
        select 1 from public.task_occurrences
        where task_id = task_record.id
          and status in ('pending', 'postponed')
      ) into has_open_occurrence;

      if not has_open_occurrence then
        select max(timezone('America/Sao_Paulo', completed_at)::date)
        into last_completed_on
        from public.task_occurrences
        where task_id = task_record.id
          and status = 'completed'
          and completed_at is not null;

        next_date := case
          when last_completed_on is null then task_record.starts_on
          else last_completed_on + greatest(1, task_record.recurrence_interval)
        end;

        if next_date <= p_until
          and (task_record.ends_on is null or next_date <= task_record.ends_on)
          and (task_record.paused_until is null or next_date > task_record.paused_until)
        then
          insert into public.task_occurrences (
            task_id, household_id, original_scheduled_date, scheduled_date,
            scheduled_time, planned_assignee
          ) values (
            task_record.id, task_record.household_id, next_date, next_date,
            task_record.scheduled_time, task_record.assigned_to
          ) on conflict (task_id, original_scheduled_date) do nothing;
          get diagnostics affected = row_count;
          generated := generated + affected;
        end if;
      end if;
      continue;
    end if;

    cursor_date := greatest(
      task_record.starts_on,
      coalesce(task_record.occurrences_generated_through + 1, task_record.starts_on)
    );
    final_date := least(p_until, coalesce(task_record.ends_on, p_until));

    while cursor_date <= final_date loop
      if (task_record.paused_until is null or cursor_date > task_record.paused_until)
        and public.task_recurrence_matches(
          task_record.recurrence_type,
          task_record.starts_on,
          cursor_date,
          task_record.recurrence_interval,
          task_record.recurrence_weekdays,
          task_record.recurrence_day_of_month,
          task_record.ends_on
        )
      then
        insert into public.task_occurrences (
          task_id, household_id, original_scheduled_date, scheduled_date,
          scheduled_time, planned_assignee
        ) values (
          task_record.id, task_record.household_id, cursor_date, cursor_date,
          task_record.scheduled_time, task_record.assigned_to
        ) on conflict (task_id, original_scheduled_date) do nothing;
        get diagnostics affected = row_count;
        generated := generated + affected;
      end if;
      cursor_date := cursor_date + 1;
    end loop;

    update public.tasks
    set occurrences_generated_through = greatest(
      coalesce(occurrences_generated_through, p_until),
      p_until
    )
    where id = task_record.id
      and (occurrences_generated_through is null or occurrences_generated_through < p_until);
  end loop;

  return generated;
end;
$$;

create or replace function public.save_task_template(
  p_household_id uuid,
  p_payload jsonb,
  p_task_id uuid default null,
  p_generate_until date default (public.ninho_today() + 62)
)
returns uuid
language plpgsql
as $$
declare
  saved_id uuid;
  rule_type text := coalesce(nullif(p_payload ->> 'recurrence_type', ''), nullif(p_payload ->> 'frequency', ''), 'weekly');
  rule_interval integer := greatest(1, coalesce(nullif(p_payload ->> 'recurrence_interval', '')::integer, 1));
  rule_weekdays smallint[];
  rule_day smallint := nullif(p_payload ->> 'recurrence_day_of_month', '')::smallint;
  start_date date := coalesce(nullif(p_payload ->> 'starts_on', '')::date, public.ninho_today());
  end_date date := nullif(p_payload ->> 'ends_on', '')::date;
  pause_date date := nullif(p_payload ->> 'paused_until', '')::date;
begin
  select coalesce(array_agg(value::smallint order by ordinal), '{}'::smallint[])
  into rule_weekdays
  from jsonb_array_elements_text(coalesce(p_payload -> 'recurrence_weekdays', '[]'::jsonb))
    with ordinality as weekday(value, ordinal);

  if nullif(trim(p_payload ->> 'title'), '') is null then
    raise exception 'O nome da tarefa é obrigatório.' using errcode = '22023';
  end if;

  if p_task_id is null then
    insert into public.tasks (
      household_id, title, category, weight, frequency, recurrence_type,
      recurrence_interval, recurrence_weekdays, recurrence_day_of_month,
      starts_on, ends_on, paused_until, assigned_to, scheduled_time,
      essential, active
    ) values (
      p_household_id,
      trim(p_payload ->> 'title'),
      coalesce(nullif(p_payload ->> 'category', ''), 'general'),
      coalesce(nullif(p_payload ->> 'weight', ''), 'medium'),
      rule_type,
      rule_type,
      rule_interval,
      rule_weekdays,
      rule_day,
      start_date,
      end_date,
      pause_date,
      nullif(p_payload ->> 'assigned_to', ''),
      nullif(p_payload ->> 'scheduled_time', '')::time,
      coalesce((p_payload ->> 'essential')::boolean, false),
      true
    ) returning id into saved_id;
  else
    update public.tasks
    set title = trim(p_payload ->> 'title'),
        category = coalesce(nullif(p_payload ->> 'category', ''), 'general'),
        weight = coalesce(nullif(p_payload ->> 'weight', ''), 'medium'),
        frequency = rule_type,
        recurrence_type = rule_type,
        recurrence_interval = rule_interval,
        recurrence_weekdays = rule_weekdays,
        recurrence_day_of_month = rule_day,
        starts_on = start_date,
        ends_on = end_date,
        paused_until = pause_date,
        assigned_to = nullif(p_payload ->> 'assigned_to', ''),
        scheduled_time = nullif(p_payload ->> 'scheduled_time', '')::time,
        essential = coalesce((p_payload ->> 'essential')::boolean, false),
        active = true
    where id = p_task_id and household_id = p_household_id
    returning id into saved_id;

    if saved_id is null then
      raise exception 'Tarefa não encontrada para a casa informada.' using errcode = 'P0002';
    end if;

    delete from public.task_occurrences
    where task_id = saved_id
      and scheduled_date >= public.ninho_today()
      and status in ('pending', 'postponed');

    update public.tasks
    set occurrences_generated_through = public.ninho_today() - 1
    where id = saved_id;
  end if;

  perform public.generate_task_occurrences(p_household_id, p_generate_until, saved_id);
  return saved_id;
end;
$$;

create or replace function public.set_task_occurrence_completion(
  p_household_id uuid,
  p_occurrence_id uuid,
  p_completed boolean,
  p_completed_by text default null
)
returns jsonb
language plpgsql
as $$
declare
  occurrence_record public.task_occurrences%rowtype;
  task_record public.tasks%rowtype;
  xp_amount integer;
  xp_key text;
  next_date date;
begin
  select * into occurrence_record
  from public.task_occurrences
  where id = p_occurrence_id and household_id = p_household_id
  for update;

  if occurrence_record.id is null then
    raise exception 'Ocorrência não encontrada para a casa informada.' using errcode = 'P0002';
  end if;

  select * into task_record
  from public.tasks
  where id = occurrence_record.task_id and household_id = p_household_id
  for update;

  if p_completed_by is not null and p_completed_by not in ('g', 's') then
    raise exception 'Integrante inválida.' using errcode = '22023';
  end if;

  if p_completed and occurrence_record.status in ('skipped', 'cancelled') then
    raise exception 'Uma ocorrência ignorada ou cancelada não pode ser concluída.' using errcode = '22023';
  end if;

  xp_amount := case task_record.weight when 'light' then 1 when 'medium' then 2 when 'heavy' then 3 else 0 end;
  xp_key := 'task:' || task_record.id::text || ':' || occurrence_record.original_scheduled_date::text;

  if p_completed then
    update public.task_occurrences
    set status = 'completed',
        completed_by = p_completed_by,
        completed_at = coalesce(completed_at, now()),
        resolution_reason = null,
        updated_at = now()
    where id = p_occurrence_id;

    insert into public.task_completions (
      task_id, household_id, completed_by, date, occurrence_id
    ) values (
      task_record.id, p_household_id, p_completed_by,
      occurrence_record.original_scheduled_date, occurrence_record.id
    )
    on conflict (task_id, date) do update
    set completed_by = coalesce(excluded.completed_by, public.task_completions.completed_by),
        occurrence_id = excluded.occurrence_id,
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

    if task_record.recurrence_type = 'once' then
      update public.tasks set active = false where id = task_record.id;
    elsif task_record.recurrence_type = 'after_completion' then
      next_date := public.ninho_today() + greatest(1, task_record.recurrence_interval);
      if (task_record.ends_on is null or next_date <= task_record.ends_on)
        and (task_record.paused_until is null or next_date > task_record.paused_until)
      then
        insert into public.task_occurrences (
          task_id, household_id, original_scheduled_date, scheduled_date,
          scheduled_time, planned_assignee
        ) values (
          task_record.id, p_household_id, next_date, next_date,
          task_record.scheduled_time, task_record.assigned_to
        ) on conflict (task_id, original_scheduled_date) do nothing;
      end if;
    end if;
  else
    update public.task_occurrences
    set status = case
          when original_scheduled_date <> scheduled_date then 'postponed'
          else 'pending'
        end,
        completed_by = null,
        completed_at = null,
        updated_at = now()
    where id = p_occurrence_id;

    delete from public.task_completions
    where occurrence_id = p_occurrence_id
       or (task_id = task_record.id and date = occurrence_record.original_scheduled_date);

    update public.xp_history
    set voided_at = now(), updated_at = now()
    where household_id = p_household_id
      and idempotency_key = xp_key
      and duplicate_of is null
      and voided_at is null;

    if task_record.recurrence_type = 'once' then
      update public.tasks set active = true where id = task_record.id;
    elsif task_record.recurrence_type = 'after_completion' then
      delete from public.task_occurrences
      where task_id = task_record.id
        and id <> p_occurrence_id
        and original_scheduled_date > occurrence_record.original_scheduled_date
        and status in ('pending', 'postponed');
    end if;
  end if;

  return jsonb_build_object(
    'completed', p_completed,
    'occurrence_id', p_occurrence_id,
    'xp', public.get_household_xp(p_household_id)
  );
end;
$$;

create or replace function public.postpone_task_occurrence(
  p_household_id uuid,
  p_occurrence_id uuid,
  p_new_date date,
  p_reason text default null
)
returns public.task_occurrences
language plpgsql
as $$
declare
  result public.task_occurrences;
begin
  if p_new_date < public.ninho_today() then
    raise exception 'A nova data não pode estar no passado.' using errcode = '22023';
  end if;

  update public.task_occurrences
  set scheduled_date = p_new_date,
      status = 'postponed',
      resolution_reason = nullif(trim(p_reason), ''),
      updated_at = now()
  where id = p_occurrence_id
    and household_id = p_household_id
    and status in ('pending', 'postponed')
  returning * into result;

  if result.id is null then
    raise exception 'Ocorrência pendente não encontrada.' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

create or replace function public.resolve_task_occurrence(
  p_household_id uuid,
  p_occurrence_id uuid,
  p_status text,
  p_reason text default null
)
returns public.task_occurrences
language plpgsql
as $$
declare
  result public.task_occurrences;
  task_record public.tasks%rowtype;
  xp_key text;
begin
  if p_status not in ('skipped', 'cancelled') then
    raise exception 'Estado de resolução inválido.' using errcode = '22023';
  end if;

  select task.* into task_record
  from public.tasks task
  join public.task_occurrences occurrence on occurrence.task_id = task.id
  where occurrence.id = p_occurrence_id
    and occurrence.household_id = p_household_id
  for update of task;

  if task_record.id is null then
    raise exception 'Ocorrência não encontrada.' using errcode = 'P0002';
  end if;

  update public.task_occurrences
  set status = p_status,
      completed_by = null,
      completed_at = null,
      resolution_reason = nullif(trim(p_reason), ''),
      updated_at = now()
  where id = p_occurrence_id and household_id = p_household_id
  returning * into result;

  delete from public.task_completions where occurrence_id = p_occurrence_id;
  xp_key := 'task:' || task_record.id::text || ':' || result.original_scheduled_date::text;
  update public.xp_history
  set voided_at = now(), updated_at = now()
  where household_id = p_household_id
    and idempotency_key = xp_key
    and duplicate_of is null
    and voided_at is null;

  if task_record.recurrence_type = 'once' then
    update public.tasks set active = false where id = task_record.id;
  end if;

  return result;
end;
$$;

create or replace function public.set_task_assignment(
  p_household_id uuid,
  p_task_id uuid,
  p_assigned_to text
)
returns integer
language plpgsql
as $$
declare
  changed integer;
begin
  if p_assigned_to is not null and p_assigned_to not in ('g', 's') then
    raise exception 'Responsável inválida.' using errcode = '22023';
  end if;

  update public.tasks
  set assigned_to = p_assigned_to
  where id = p_task_id and household_id = p_household_id and active = true;

  if not found then
    raise exception 'Tarefa não encontrada para a casa informada.' using errcode = 'P0002';
  end if;

  update public.task_occurrences
  set planned_assignee = p_assigned_to, updated_at = now()
  where task_id = p_task_id
    and household_id = p_household_id
    and status in ('pending', 'postponed');
  get diagnostics changed = row_count;
  return changed;
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
  occurrence_id uuid;
  task_record public.tasks%rowtype;
begin
  select id into occurrence_id
  from public.task_occurrences
  where task_id = p_task_id
    and household_id = p_household_id
    and (original_scheduled_date = p_date or scheduled_date = p_date)
  order by (original_scheduled_date = p_date) desc
  limit 1;

  if occurrence_id is null then
    select * into task_record
    from public.tasks
    where id = p_task_id and household_id = p_household_id;

    if task_record.id is null then
      raise exception 'Tarefa não encontrada para a casa informada.' using errcode = 'P0002';
    end if;

    if not p_completed then
      return jsonb_build_object('completed', false, 'xp', public.get_household_xp(p_household_id));
    end if;

    insert into public.task_occurrences (
      task_id, household_id, original_scheduled_date, scheduled_date,
      scheduled_time, planned_assignee
    ) values (
      task_record.id, p_household_id, p_date, p_date,
      task_record.scheduled_time, task_record.assigned_to
    )
    on conflict (task_id, original_scheduled_date) do update
      set updated_at = now()
    returning id into occurrence_id;
  end if;

  return public.set_task_occurrence_completion(
    p_household_id,
    occurrence_id,
    p_completed,
    p_completed_by
  );
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

    perform public.set_task_assignment(p_household_id, target_id, target_assignee);
    changed := changed + 1;
  end loop;

  return changed;
end;
$$;

drop trigger if exists set_task_occurrences_updated_at on public.task_occurrences;
create trigger set_task_occurrences_updated_at
before update on public.task_occurrences
for each row execute function public.set_updated_at();

alter table public.task_occurrences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_occurrences'
      and policyname = 'allow_all_auth'
  ) then
    create policy allow_all_auth on public.task_occurrences
      for all to authenticated using (true) with check (true);
  end if;
end;
$$;

grant execute on function public.task_recurrence_matches(text, date, date, integer, smallint[], smallint, date) to authenticated;
grant execute on function public.generate_task_occurrences(uuid, date, uuid) to authenticated;
grant execute on function public.save_task_template(uuid, jsonb, uuid, date) to authenticated;
grant execute on function public.set_task_occurrence_completion(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.postpone_task_occurrence(uuid, uuid, date, text) to authenticated;
grant execute on function public.resolve_task_occurrence(uuid, uuid, text, text) to authenticated;
grant execute on function public.set_task_assignment(uuid, uuid, text) to authenticated;

select public.generate_task_occurrences(id, public.ninho_today() + 62, null)
from public.households;

commit;
