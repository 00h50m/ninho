-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 006 · Notificações push
--
-- · push_subscriptions: um registro por aparelho que ativou notificações,
--   ligado à pessoa do aparelho (g|s) e às preferências (manhã, domingo).
-- · push_log: uma linha por envio (aparelho + tipo + dia). Impede mandar a
--   mesma notificação duas vezes se o agendador repetir a chamada.
--
-- Os envios são feitos pela rota /api/cron/* do app (servidor, com a chave
-- service_role, que nunca vai para o navegador). Só acrescenta tabelas.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.push_subscriptions (
  id              uuid primary key default uuid_generate_v4(),
  household_id    uuid not null references public.households(id) on delete cascade,
  who             text not null check (who in ('g','s')),
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  morning         boolean not null default true,
  weekly          boolean not null default true,
  active          boolean not null default true,
  failures        integer not null default 0,
  last_success_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz default now()
);

comment on table public.push_subscriptions is 'Aparelhos com notificação ativada. who = pessoa do aparelho (identificação local, sem login).';

create index if not exists push_subscriptions_household_idx on public.push_subscriptions (household_id) where active;

drop trigger if exists ninho_set_updated_at on public.push_subscriptions;
create trigger ninho_set_updated_at before update on public.push_subscriptions
  for each row execute function public.ninho_set_updated_at();

create table if not exists public.push_log (
  id              uuid primary key default uuid_generate_v4(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  kind            text not null check (kind in ('morning','weekly','test')),
  day             date not null default public.ninho_today(),
  status          text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  detail          text,
  created_at      timestamptz not null default now()
);

-- Manhã e domingo: no máximo um envio por aparelho por dia. Teste: livre (limitado pela rota).
create unique index if not exists push_log_once_per_day on public.push_log (subscription_id, kind, day) where kind <> 'test';
create index if not exists push_log_subscription_idx on public.push_log (subscription_id, created_at desc);

-- RLS no modelo atual (qualquer usuário autenticado, inclusive o login anônimo).
-- O log só é lido/gravado pelo servidor (service_role ignora RLS); o app não precisa dele.
alter table public.push_subscriptions enable row level security;
alter table public.push_log enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'allow_all_auth') then
    create policy "allow_all_auth" on public.push_subscriptions for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Registrar/atualizar a inscrição do aparelho (o mesmo endpoint pode trocar de pessoa).
-- ninho_save_push_subscription(...) → id da inscrição
create or replace function public.ninho_save_push_subscription(
  p_household_id uuid, p_who text, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text,
  p_morning boolean default true, p_weekly boolean default true)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  if p_who is null or p_who not in ('g','s') then
    raise exception 'NINHO_INVALID_PERSON: quem usa o aparelho deve ser g ou s' using errcode = '22023';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' then
    raise exception 'NINHO_INVALID_ENDPOINT: endereço de notificação inválido' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (household_id, who, endpoint, p256dh, auth, user_agent, morning, weekly, active, failures)
  values (p_household_id, p_who, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300), p_morning, p_weekly, true, 0)
  on conflict (endpoint) do update set
    household_id = excluded.household_id, who = excluded.who, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, morning = excluded.morning, weekly = excluded.weekly, active = true, failures = 0
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.ninho_save_push_subscription(uuid, text, text, text, text, text, boolean, boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.ninho_save_push_subscription(uuid, text, text, text, text, text, boolean, boolean) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.ninho_save_push_subscription(uuid, text, text, text, text, text, boolean, boolean) to authenticated;
  end if;
end $$;

-- O servidor (service_role) chama o placar e as sequências para o resumo de domingo
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.ninho_weekly_scores(uuid, date) to service_role;
    grant execute on function public.ninho_streaks(uuid, date) to service_role;
    grant execute on function public.ninho_streak_of(uuid, date, text, text) to service_role;
    grant execute on function public.ninho_best_streak_of(uuid, date, text, text, integer) to service_role;
    grant execute on function public.ninho_day_active(uuid, date, text) to service_role;
    grant execute on function public.ninho_day_on_track(uuid, date) to service_role;
  end if;
end $$;
