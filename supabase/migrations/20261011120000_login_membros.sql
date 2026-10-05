-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 010 · Login: quem é quem na casa
--
-- · household_members: liga cada conta (auth.users, e-mail e senha criados no
--   painel do Supabase) a uma casa e a uma pessoa (g = Giovanna, s = Sabrina).
-- · ninho_link_member(e-mail, 'g'|'s'): faz essa ligação. Só pelo SQL Editor
--   (dono do banco); o app não consegue chamar.
-- · ninho_is_member(casa): usada pela segurança por casa (migration 011).
--
-- Só acrescenta. O app antigo (login anônimo) continua funcionando até a 011.
-- Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.household_members (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  created_at   timestamptz not null default now(),
  unique (household_id, who)
);
comment on table public.household_members is
  'Conta de login → casa e pessoa (g|s). Uma conta por pessoa por casa. Preenchida com ninho_link_member().';

alter table public.household_members enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'household_members' and policyname = 'own_membership') then
    create policy "own_membership" on public.household_members for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- É membro da casa? (security definer: lê household_members sem depender da RLS dela)
create or replace function public.ninho_is_member(p_household_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members m where m.user_id = auth.uid() and m.household_id = p_household_id)
$$;
revoke all on function public.ninho_is_member(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.ninho_is_member(uuid) from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.ninho_is_member(uuid) to authenticated; end if;
end $$;

-- Liga uma conta (pelo e-mail) a uma pessoa da casa. Rodar no SQL Editor:
--   select public.ninho_link_member('giovanna@exemplo.com', 'g');
--   select public.ninho_link_member('sabrina@exemplo.com', 's');
-- Sem p_household_id, usa a única casa existente (erro se houver mais de uma).
create or replace function public.ninho_link_member(p_email text, p_who text, p_household_id uuid default null)
returns text language plpgsql security definer set search_path = public, auth as $$
declare
  v_user  uuid;
  v_house uuid := p_household_id;
  v_name  text;
  v_n     integer;
begin
  if p_who is null or p_who not in ('g','s') then
    raise exception 'NINHO_INVALID_PERSON: use ''g'' (Giovanna) ou ''s'' (Sabrina)';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'NINHO_NOT_FOUND: nenhuma conta com o e-mail %. Crie em Authentication › Users › Add user.', p_email;
  end if;
  if v_house is null then
    select count(*) into v_n from public.households;
    if v_n <> 1 then
      raise exception 'NINHO_INVALID_INPUT: existem % casas; informe o id da casa no 3º parâmetro', v_n;
    end if;
    select id into v_house from public.households limit 1;
  end if;

  -- A pessoa troca de conta: a ligação antiga daquela pessoa sai
  delete from public.household_members where household_id = v_house and who = p_who and user_id <> v_user;
  insert into public.household_members (user_id, household_id, who) values (v_user, v_house, p_who)
  on conflict (user_id) do update set household_id = excluded.household_id, who = excluded.who;

  -- Perfil com o mesmo nome já usado no app para essa pessoa
  select display_name into v_name from public.profiles
  where household_id = v_house and role = p_who and display_name is not null order by created_at limit 1;
  insert into public.profiles (id, household_id, name, role, display_name)
  values (v_user, v_house, coalesce(v_name, case p_who when 'g' then 'Giovanna' else 'Sabrina' end), p_who, v_name)
  on conflict (id) do update set household_id = excluded.household_id, role = excluded.role;

  return format('ok: %s ligada à casa como %s', p_email, case p_who when 'g' then 'Giovanna' else 'Sabrina' end);
end $$;
revoke all on function public.ninho_link_member(text, text, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.ninho_link_member(text, text, uuid) from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on function public.ninho_link_member(text, text, uuid) from authenticated; end if;
end $$;
