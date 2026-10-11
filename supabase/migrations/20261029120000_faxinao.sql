-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 030 · Faxinão (mutirão organizado pela IA)
--
-- faxinoes: o plano de um mutirão da casa — passos na ordem que rende mais,
--   com cômodo, quem faz, minutos e se é "espera" (máquina, produto agindo).
--   status: rascunho (conferindo) → andamento (ao vivo) → feito; "modelo"
--   guarda um plano para repetir. É da CASA: as duas veem e marcam.
-- ninho_faxinao_step: marca um passo (feito / pular / desfazer / depois)
--   numa única gravação, para as duas marcarem ao mesmo tempo sem uma
--   apagar o que a outra marcou.
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.faxinoes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null check (length(btrim(title)) between 1 and 80),
  steps        jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 60 and length(steps::text) <= 40000),
  tips         jsonb not null default '[]'::jsonb check (jsonb_typeof(tips) = 'array' and length(tips::text) <= 3000),
  status       text not null default 'rascunho' check (status in ('rascunho','andamento','feito','modelo')),
  created_by   text check (created_by is null or created_by in ('g','s')),
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists faxinoes_recent on public.faxinoes (household_id, created_at desc);

create or replace function public.ninho_faxinao_step(p_id uuid, p_step text, p_action text, p_who text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v jsonb; s jsonb; i int;
begin
  if p_action not in ('done','skip','undo','later') then raise exception 'ação inválida'; end if;
  if p_who is not null and p_who not in ('g','s') then raise exception 'pessoa inválida'; end if;
  select steps into v from public.faxinoes where id = p_id and status in ('rascunho','andamento') for update;
  if v is null then raise exception 'faxinão não encontrado ou já encerrado'; end if;
  for i in 0 .. jsonb_array_length(v) - 1 loop
    if v -> i ->> 'id' = p_step then
      s := v -> i;
      if p_action = 'done' then s := s || jsonb_build_object('done_at', now(), 'done_by', p_who, 'skipped', false);
      elsif p_action = 'skip' then s := s || jsonb_build_object('done_at', null, 'done_by', null, 'skipped', true);
      elsif p_action = 'undo' then s := s || jsonb_build_object('done_at', null, 'done_by', null, 'skipped', false);
      end if;
      if p_action = 'later' then v := (v - i) || jsonb_build_array(s);
      else v := jsonb_set(v, array[i::text], s); end if;
      update public.faxinoes set steps = v, updated_at = now() where id = p_id;
      return v;
    end if;
  end loop;
  raise exception 'passo não encontrado';
end $$;
revoke all on function public.ninho_faxinao_step(uuid, text, text, text) from public;

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.faxinoes enable row level security;
  drop policy if exists "allow_all_auth" on public.faxinoes;
  drop policy if exists "household_member" on public.faxinoes;
  if strict_rls then
    create policy "household_member" on public.faxinoes for all to authenticated using (public.ninho_is_member(household_id)) with check (public.ninho_is_member(household_id));
  else
    create policy "allow_all_auth" on public.faxinoes for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.faxinoes to authenticated;
    grant execute on function public.ninho_faxinao_step(uuid, text, text, text) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.faxinoes to service_role; end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'faxinoes') then
    alter publication supabase_realtime add table public.faxinoes;
  end if;
end $$;

notify pgrst, 'reload schema';
