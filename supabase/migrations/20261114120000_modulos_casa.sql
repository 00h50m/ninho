-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 046 · Módulos por casa (para abrir o Ninho a outras casas)
--
-- households.features (jsonb): o que cada casa usa.
--   · pets   (true/false; ausente = ainda não respondeu): mostra a aba Cães e as rotinas dos pets.
--            A própria casa escolhe (configuração inicial ou Ajustes), por ninho_set_feature().
--   · ia     (true/false): IA (Faxinão, Perguntar, organizar o dia, Meu dia com foto, Telegram em
--            texto livre e áudio). Desligada para casa nova; SÓ quem administra o banco liga.
--   · sobrou (true/false): cartão e avisos do Sobrou! (as chaves do Sobrou são de uma casa só).
--            Desligado para casa nova; SÓ quem administra o banco liga.
-- As casas que já existem ficam como estavam: IA e Sobrou ligados; pets ligado se já há cão.
-- Uma trava (gatilho) impede que o app (papéis anon/authenticated) mude ia/sobrou ou crie casa
-- com eles ligados; o servidor também confere antes de usar a IA ou o Sobrou.
--
-- Não destrutiva: só acrescenta uma coluna, uma função e um gatilho. Pode rodar mais de uma vez:
-- o preenchimento das casas existentes só acontece na primeira vez (quando a coluna é criada).
-- ══════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'households' and column_name = 'features') then
    alter table public.households add column features jsonb not null default '{}'::jsonb;
    -- casas existentes: tudo como já funcionava
    update public.households h set features = jsonb_build_object(
      'ia', true, 'sobrou', true,
      'pets', exists (select 1 from public.dogs d where d.household_id = h.id and coalesce(d.active, true)));
  end if;
end $$;
comment on column public.households.features is
  'Módulos da casa: pets (a casa escolhe), ia e sobrou (só quem administra o banco liga). Ver migration 046.';

-- Trava: pelo app (anon/authenticated) ninguém liga/desliga ia ou sobrou, nem cria casa com eles
create or replace function public.ninho_guard_features() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.features := coalesce(new.features, '{}'::jsonb) - 'ia' - 'sobrou';
    elsif (new.features -> 'ia') is distinct from (old.features -> 'ia')
       or (new.features -> 'sobrou') is distinct from (old.features -> 'sobrou') then
      raise exception 'NINHO_FORBIDDEN: IA e Sobrou só são ligados por quem administra o Ninho' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists ninho_guard_features on public.households;
create trigger ninho_guard_features before insert or update on public.households
  for each row execute function public.ninho_guard_features();

-- O que a casa pode mudar sozinha (hoje: pets). Quem não é da casa não muda nada.
create or replace function public.ninho_set_feature(p_household_id uuid, p_key text, p_on boolean)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v jsonb;
begin
  if p_key is distinct from 'pets' then
    raise exception 'NINHO_FORBIDDEN: a casa só escolhe os pets; IA e Sobrou são ligados por quem administra o Ninho' using errcode = '42501';
  end if;
  update public.households set features = coalesce(features, '{}'::jsonb) || jsonb_build_object(p_key, coalesce(p_on, false))
  where id = p_household_id returning features into v;
  if v is null then raise exception 'NINHO_FORBIDDEN: casa não encontrada ou não é sua' using errcode = '42501'; end if;
  return v;
end $$;
revoke all on function public.ninho_set_feature(uuid, text, boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.ninho_set_feature(uuid, text, boolean) from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.ninho_set_feature(uuid, text, boolean) to authenticated; end if;
end $$;

notify pgrst, 'reload schema';
