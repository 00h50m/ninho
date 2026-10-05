-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 012 · Correção: gerar código do Telegram no Supabase
--
-- A 009 usava uuid_generate_v4(), que no Supabase fica no schema "extensions"
-- e não é encontrada por funções com search_path = public
-- ("function uuid_generate_v4() does not exist"). Agora usa gen_random_uuid(),
-- nativa do Postgres. Só substitui a função. Pode rodar mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.ninho_telegram_link_code(p_household_id uuid, p_who text)
returns text language plpgsql security invoker set search_path = public as $$
declare v_code text;
begin
  if p_who is null or p_who not in ('g','s') then
    raise exception 'NINHO_INVALID_PERSON: pessoa deve ser g ou s (recebido: %)', coalesce(p_who, 'vazio') using errcode = '22023';
  end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  -- Um código pendente por pessoa: renova o que ainda não foi usado
  update public.telegram_links set link_code = v_code, code_expires_at = now() + interval '30 minutes'
  where household_id = p_household_id and who = p_who and chat_id is null;
  if not found then
    insert into public.telegram_links (household_id, who, link_code, code_expires_at)
    values (p_household_id, p_who, v_code, now() + interval '30 minutes');
  end if;
  return v_code;
end $$;
