-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 047 · Cadastro pelo app ("Criar minha casa") e convite por link
--
-- · ninho_create_household(nome da casa, seu nome): quem acabou de criar a conta e ainda não
--   tem casa cria a sua (uma casa por conta). A casa nasce com IA e Sobrou desligados (046) e
--   marcada como de 1 pessoa (features.solo = true).
-- · household_invites + ninho_create_invite(casa): quem é da casa gera um convite (vale 7 dias,
--   usa uma vez, só enquanto a segunda vaga estiver livre).
-- · ninho_invite_info(código): antes de entrar, mostra só o nome da casa e de quem convidou.
-- · ninho_accept_invite(código, seu nome): quem ainda não tem casa entra na casa do convite;
--   a casa deixa de ser de 1 pessoa (features.solo = false).
-- Tudo por funções que conferem quem está pedindo; a tabela de convites não é lida pelo app.
--
-- Não destrutiva: só cria uma tabela e funções. Pode rodar mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.household_invites (
  code         text primary key check (code ~ '^[A-Za-z0-9]{10,40}$'),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  used_at      timestamptz,
  used_by      uuid references auth.users(id) on delete set null
);
comment on table public.household_invites is 'Convites para a segunda pessoa da casa (047). Só lidos pelas funções ninho_*.';
create index if not exists household_invites_house on public.household_invites (household_id);
alter table public.household_invites enable row level security;
-- sem regras: o app não lê nem escreve direto (só pelas funções abaixo)
revoke all on public.household_invites from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.household_invites from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public.household_invites from authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant all on public.household_invites to service_role; end if;
end $$;

-- Criar a casa de quem acabou de chegar
create or replace function public.ninho_create_household(p_house_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid   uuid := auth.uid();
  v_house uuid;
  v_name  text := btrim(coalesce(p_display_name, ''));
  v_hname text := btrim(coalesce(p_house_name, ''));
begin
  if v_uid is null then raise exception 'NINHO_FORBIDDEN: entre na sua conta primeiro' using errcode = '42501'; end if;
  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'NINHO_INVALID_INPUT: esta conta já tem uma casa' using errcode = '22023';
  end if;
  if length(v_name) not between 1 and 40 then raise exception 'NINHO_INVALID_INPUT: escreva o seu nome (até 40 letras)' using errcode = '22023'; end if;
  if length(v_hname) > 40 then raise exception 'NINHO_INVALID_INPUT: nome da casa longo demais (até 40 letras)' using errcode = '22023'; end if;
  insert into public.households (name, features) values (coalesce(nullif(v_hname, ''), 'Ninho'), '{"solo": true}'::jsonb)
  returning id into v_house;
  insert into public.household_members (user_id, household_id, who) values (v_uid, v_house, 'g');
  insert into public.profiles (id, household_id, name, role, display_name) values (v_uid, v_house, v_name, 'g', v_name)
  on conflict (id) do update set household_id = excluded.household_id, role = excluded.role, name = excluded.name, display_name = excluded.display_name;
  return v_house;
end $$;

-- Gerar convite (quem é da casa; para a vaga livre)
create or replace function public.ninho_create_invite(p_household_id uuid)
returns text language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid  uuid := auth.uid();
  v_me   text;
  v_free text;
  v_code text;
begin
  select who into v_me from public.household_members where user_id = v_uid and household_id = p_household_id;
  if v_me is null then raise exception 'NINHO_FORBIDDEN: só quem é da casa convida' using errcode = '42501'; end if;
  v_free := case v_me when 'g' then 's' else 'g' end;
  if exists (select 1 from public.household_members where household_id = p_household_id and who = v_free) then
    raise exception 'NINHO_INVALID_INPUT: a casa já tem duas pessoas' using errcode = '22023';
  end if;
  -- o convite anterior ainda aberto deixa de valer
  update public.household_invites set expires_at = least(expires_at, now()) where household_id = p_household_id and used_at is null;
  v_code := replace(gen_random_uuid()::text, '-', '');  -- 32 caracteres aleatórios
  insert into public.household_invites (code, household_id, who, created_by) values (v_code, p_household_id, v_free, v_uid);
  return v_code;
end $$;

-- O que o convite mostra antes de entrar: só o nome da casa e de quem convidou
create or replace function public.ninho_invite_info(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('house', h.name, 'from', coalesce(p.display_name, p.name, ''))
  from public.household_invites i
  join public.households h on h.id = i.household_id
  left join public.profiles p on p.id = i.created_by
  where i.code = p_code and i.used_at is null and i.expires_at > now()
$$;

-- Aceitar o convite (quem ainda não tem casa)
create or replace function public.ninho_accept_invite(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid  uuid := auth.uid();
  v_inv  public.household_invites%rowtype;
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if v_uid is null then raise exception 'NINHO_FORBIDDEN: entre na sua conta primeiro' using errcode = '42501'; end if;
  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'NINHO_INVALID_INPUT: esta conta já tem uma casa' using errcode = '22023';
  end if;
  if length(v_name) not between 1 and 40 then raise exception 'NINHO_INVALID_INPUT: escreva o seu nome (até 40 letras)' using errcode = '22023'; end if;
  select * into v_inv from public.household_invites where code = btrim(coalesce(p_code, '')) for update;
  if v_inv.code is null or v_inv.used_at is not null or v_inv.expires_at <= now() then
    raise exception 'NINHO_NOT_FOUND: convite inválido, usado ou vencido. Peça um novo.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.household_members where household_id = v_inv.household_id and who = v_inv.who) then
    raise exception 'NINHO_INVALID_INPUT: a casa já tem duas pessoas' using errcode = '22023';
  end if;
  insert into public.household_members (user_id, household_id, who) values (v_uid, v_inv.household_id, v_inv.who);
  insert into public.profiles (id, household_id, name, role, display_name) values (v_uid, v_inv.household_id, v_name, v_inv.who, v_name)
  on conflict (id) do update set household_id = excluded.household_id, role = excluded.role, name = excluded.name, display_name = excluded.display_name;
  update public.household_invites set used_at = now(), used_by = v_uid where code = v_inv.code;
  update public.households set features = coalesce(features, '{}'::jsonb) || '{"solo": false}'::jsonb where id = v_inv.household_id;
  return v_inv.household_id;
end $$;

do $$
declare f text;
begin
  foreach f in array array['ninho_create_household(text, text)', 'ninho_create_invite(uuid)', 'ninho_invite_info(text)', 'ninho_accept_invite(text, text)'] loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('grant execute on function public.%s to authenticated', f); end if;
  end loop;
  -- o convite aparece antes de entrar (nome da casa e de quem convidou)
  if exists (select 1 from pg_roles where rolname = 'anon') then grant execute on function public.ninho_invite_info(text) to anon; end if;
end $$;

notify pgrst, 'reload schema';
