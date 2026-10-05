-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 002 · Conclusões com autoria, XP sem duplicidade, datas no fuso da casa
--
-- Não apaga dados. Lançamentos de XP duplicados já existentes NÃO são
-- apagados: recebem voided_at (anulados) e deixam de contar no total.
-- Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

-- ── Quem concluiu ───────────────────────────────────────────────────────
-- 'g' = Giovanna, 's' = Sabrina (identificação local do aparelho, sem login).
-- null = registro anterior a esta migração ("não identificado").
--
-- Em produção, task_completions.completed_by foi criada como uuid e nunca foi
-- usada pelo app. Para guardar 'g'/'s', a coluna antiga é RENOMEADA para
-- completed_by_legacy (valores e vínculos preservados) e uma nova completed_by
-- text é criada no lugar.
do $$
declare t text; v_type text; v_legacy text;
begin
  foreach t in array array['task_completions','dog_completions'] loop
    -- Lido do catálogo (não do information_schema, que depende de privilégios).
    select format_type(a.atttypid, a.atttypmod) into v_type
    from pg_attribute a
    where a.attrelid = ('public.' || t)::regclass and a.attname = 'completed_by' and a.attnum > 0 and not a.attisdropped;
    if v_type is null or v_type = 'text' then
      continue;
    end if;
    v_legacy := 'completed_by_legacy';
    if exists (select 1 from pg_attribute where attrelid = ('public.' || t)::regclass and attname = v_legacy and not attisdropped) then
      v_legacy := 'completed_by_legacy_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');
    end if;
    raise notice 'Ninho: %.completed_by é % → renomeada para % (preservada) e recriada como text', t, v_type, v_legacy;
    execute format('alter table public.%I rename column completed_by to %I', t, v_legacy);
    execute format('alter table public.%I add column completed_by text', t);
  end loop;
end $$;

alter table public.dog_completions add column if not exists completed_by text;
alter table public.dog_completions add column if not exists household_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.task_completions'::regclass and conname = 'task_completions_completed_by_check') then
    alter table public.task_completions add constraint task_completions_completed_by_check
      check (completed_by is null or completed_by in ('g','s')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.dog_completions'::regclass and conname = 'dog_completions_completed_by_check') then
    alter table public.dog_completions add constraint dog_completions_completed_by_check
      check (completed_by is null or completed_by in ('g','s')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.dog_completions'::regclass and conname = 'dog_completions_household_id_fkey') then
    alter table public.dog_completions add constraint dog_completions_household_id_fkey
      foreign key (household_id) references public.households(id) on delete cascade not valid;
  end if;
end $$;

-- ── household_id em dog_completions: backfill a partir da rotina (ou do cão) ──
update public.dog_completions dc
set household_id = coalesce(r.household_id, d.household_id)
from public.dog_routines r
left join public.dogs d on d.id = r.dog_id
where r.id = dc.routine_id
  and dc.household_id is null
  and coalesce(r.household_id, d.household_id) is not null;

-- Mesma coisa para rotinas antigas sem household_id
update public.dog_routines r
set household_id = d.household_id
from public.dogs d
where d.id = r.dog_id and r.household_id is null and d.household_id is not null;

-- E para conclusões de tarefa antigas sem household_id
update public.task_completions tc
set household_id = t.household_id
from public.tasks t
where t.id = tc.task_id and tc.household_id is null and t.household_id is not null;

-- Gatilhos: preenchem household_id quando um aparelho com versão antiga do app
-- insere sem esse campo (o app em cache no celular pode demorar a atualizar).
create or replace function public.ninho_fill_dog_completion_household()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.household_id is null then
    select coalesce(r.household_id, d.household_id) into new.household_id
    from public.dog_routines r left join public.dogs d on d.id = r.dog_id
    where r.id = new.routine_id;
  end if;
  return new;
end $$;

drop trigger if exists ninho_fill_household on public.dog_completions;
create trigger ninho_fill_household before insert on public.dog_completions
  for each row execute function public.ninho_fill_dog_completion_household();

create or replace function public.ninho_fill_task_completion_household()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.household_id is null then
    select t.household_id into new.household_id from public.tasks t where t.id = new.task_id;
  end if;
  return new;
end $$;

drop trigger if exists ninho_fill_household on public.task_completions;
create trigger ninho_fill_household before insert on public.task_completions
  for each row execute function public.ninho_fill_task_completion_household();

-- NOT NULL só depois do backfill, e só se não sobrou nenhuma linha órfã.
do $$
begin
  if not exists (select 1 from public.dog_completions where household_id is null) then
    alter table public.dog_completions alter column household_id set not null;
  else
    raise notice 'dog_completions: há linhas sem household_id (rotina apagada?). NOT NULL não aplicado; veja supabase/scripts/pre-migration-check.sql';
  end if;
  if not exists (select 1 from public.task_completions where household_id is null) then
    alter table public.task_completions alter column household_id set not null;
  else
    raise notice 'task_completions: há linhas sem household_id. NOT NULL não aplicado.';
  end if;
end $$;

-- ── Datas domésticas no fuso de São Paulo ───────────────────────────────
-- O app sempre envia a data explicitamente; o default só vale para quem não enviar.
alter table public.task_completions alter column date set default public.ninho_today();
alter table public.dog_completions  alter column date set default public.ninho_today();
alter table public.puppy_accidents  alter column date set default public.ninho_today();

-- ── XP: no máximo um lançamento válido por origem ──────────────────────
alter table public.xp_history add column if not exists voided_at timestamptz;
alter table public.xp_history add column if not exists void_reason text;

comment on column public.xp_history.voided_at is
  'Preenchido quando o lançamento foi anulado (ex.: duplicado encontrado na migração 002). Lançamentos anulados não contam no XP.';

-- Em produção, o horário original está em task_completions.completed_at e
-- xp_history.earned_at; a 001 criou created_at preenchido com o horário da
-- migração. Copia o horário original e garante default nas colunas antigas
-- (as funções novas só preenchem created_at).
do $$
declare r record;
begin
  for r in select * from (values ('task_completions','completed_at'), ('dog_completions','completed_at'),
                                 ('xp_history','earned_at')) v(t, c) loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = r.t and column_name = r.c)
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = r.t and column_name = 'created_at') then
      execute format('update public.%I set created_at = %I where %I is not null and created_at is distinct from %I', r.t, r.c, r.c, r.c);
      execute format('alter table public.%I alter column %I set default now()', r.t, r.c);
    end if;
  end loop;
end $$;

-- Duplicados antigos (mesma casa + mesma origem): mantém o mais antigo, anula os demais.
with ranked as (
  select ctid,
         row_number() over (partition by household_id, reason order by created_at nulls last, ctid) as rn
  from public.xp_history
  where reason is not null and voided_at is null
)
update public.xp_history x
set voided_at = now(), void_reason = 'duplicado anulado na migração 002 (fase 0)'
from ranked
where x.ctid = ranked.ctid and ranked.rn > 1;

create unique index if not exists xp_history_one_valid_per_reason
  on public.xp_history (household_id, reason)
  where reason is not null and voided_at is null;

-- ── Índices de leitura ──────────────────────────────────────────────────
create index if not exists task_completions_household_date_idx on public.task_completions (household_id, date);
create index if not exists dog_completions_household_date_idx  on public.dog_completions (household_id, date);
create index if not exists tasks_household_active_idx          on public.tasks (household_id) where active;
create index if not exists dogs_household_idx                  on public.dogs (household_id);
create index if not exists dog_routines_dog_idx                on public.dog_routines (dog_id);
create index if not exists dog_routines_household_idx          on public.dog_routines (household_id);
create index if not exists xp_history_household_idx            on public.xp_history (household_id);
create index if not exists puppy_accidents_household_idx       on public.puppy_accidents (household_id, occurred_at desc);
create index if not exists profiles_household_idx              on public.profiles (household_id);

-- ── updated_at ──────────────────────────────────────────────────────────
create or replace function public.ninho_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['households','profiles','tasks','dogs','dog_routines','weekly_settings','weekly_meetings'] loop
    execute format('alter table public.%I add column if not exists updated_at timestamptz default now()', t);
    execute format('drop trigger if exists ninho_set_updated_at on public.%I', t);
    execute format('create trigger ninho_set_updated_at before update on public.%I for each row execute function public.ninho_set_updated_at()', t);
  end loop;
end $$;
