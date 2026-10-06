-- ══════════════════════════════════════════════════════════════════════
-- Ninho · Agendador dos lembretes (rodar UMA vez, depois da migration 023)
--
-- Chama https://<seu app>/api/cron/reminders a cada 5 minutos, pelo próprio
-- Supabase (pg_cron + pg_net). O plano gratuito da Vercel só agenda 1 vez por
-- dia; por isso o relógio fica no Supabase.
--
-- ANTES DE RODAR, troque os DOIS valores marcados com <<< >>>:
--   1. o endereço do app em produção (ex.: https://ninho-ten.vercel.app)
--   2. o CRON_SECRET (o mesmo das variáveis de ambiente da Vercel)
-- O segredo fica guardado no cofre do Supabase (Vault), não em texto nas
-- tarefas agendadas. NÃO salve este arquivo com o segredo no repositório.
--
-- Pode rodar de novo (atualiza o endereço/segredo). Para parar os lembretes:
--   select cron.unschedule('ninho-lembretes');
-- ══════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_url    text := '<<<https://ninho-ten.vercel.app>>>';
  v_secret text := '<<<COLE_AQUI_O_CRON_SECRET>>>';
begin
  v_url := replace(replace(v_url, '<<<', ''), '>>>', '');
  if v_secret like '<<<%' or length(v_secret) < 8 then
    raise exception 'Troque <<<COLE_AQUI_O_CRON_SECRET>>> pelo CRON_SECRET da Vercel antes de rodar.';
  end if;
  if v_url !~ '^https://' then raise exception 'O endereço do app precisa começar com https://'; end if;
  -- endereço e segredo no cofre (cria ou atualiza)
  if exists (select 1 from vault.secrets where name = 'ninho_cron_secret') then
    perform vault.update_secret((select id from vault.secrets where name = 'ninho_cron_secret'), v_secret);
  else
    perform vault.create_secret(v_secret, 'ninho_cron_secret', 'CRON_SECRET do Ninho (lembretes)');
  end if;
  if exists (select 1 from vault.secrets where name = 'ninho_app_url') then
    perform vault.update_secret((select id from vault.secrets where name = 'ninho_app_url'), rtrim(v_url, '/'));
  else
    perform vault.create_secret(rtrim(v_url, '/'), 'ninho_app_url', 'Endereço do Ninho em produção');
  end if;
end $$;

-- a cada 5 minutos (mesmo nome = atualiza a tarefa existente)
select cron.schedule('ninho-lembretes', '*/5 * * * *', $job$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'ninho_app_url') || '/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ninho_cron_secret')),
    timeout_milliseconds := 30000
  )
$job$);

-- Conferência: a tarefa existe e está ativa
select jobname, schedule, active from cron.job where jobname = 'ninho-lembretes';
