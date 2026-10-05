-- Testes da migration 006 (notificações). Rodam nos dois cenários.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

insert into public.households (id, name) values ('77777777-0000-0000-0000-000000000001', 'Casa push');
set role authenticated;

do $$
declare id1 uuid; id2 uuid;
begin
  id1 := public.ninho_save_push_subscription('77777777-0000-0000-0000-000000000001', 'g', 'https://push.example/abc', 'p256', 'auth', 'Teste', true, true);
  id2 := public.ninho_save_push_subscription('77777777-0000-0000-0000-000000000001', 's', 'https://push.example/abc', 'p256b', 'authb', 'Teste', true, false);
  perform pg_temp.ok(id1 = id2, 'mesmo aparelho (endpoint) não duplica a inscrição');
  perform pg_temp.ok((select who || '|' || weekly from public.push_subscriptions where id = id1) = 's|false', 'trocar a pessoa do aparelho atualiza a inscrição');
  begin perform public.ninho_save_push_subscription('77777777-0000-0000-0000-000000000001', 'x', 'https://push.example/z', 'p', 'a', null); raise exception 'FALHOU: aceitou pessoa inválida';
  exception when others then if sqlerrm like 'NINHO_INVALID_PERSON%' then raise notice 'ok - pessoa inválida é recusada'; else raise; end if; end;
  begin perform public.ninho_save_push_subscription('77777777-0000-0000-0000-000000000001', 'g', 'http://inseguro', 'p', 'a', null); raise exception 'FALHOU: aceitou endpoint inválido';
  exception when others then if sqlerrm like 'NINHO_INVALID_ENDPOINT%' then raise notice 'ok - endereço sem https é recusado'; else raise; end if; end;
end $$;

reset role;
do $$
declare sid uuid := (select id from public.push_subscriptions where endpoint = 'https://push.example/abc');
begin
  insert into public.push_log (subscription_id, kind, day) values (sid, 'morning', '2026-10-07');
  begin
    insert into public.push_log (subscription_id, kind, day) values (sid, 'morning', '2026-10-07');
    raise exception 'FALHOU: permitiu dois "bom dia" no mesmo dia';
  exception when unique_violation then raise notice 'ok - no máximo um bom dia por aparelho por dia';
  end;
  insert into public.push_log (subscription_id, kind, day) values (sid, 'morning', '2026-10-08');
  insert into public.push_log (subscription_id, kind, day) values (sid, 'test', '2026-10-07'), (sid, 'test', '2026-10-07');
  perform pg_temp.ok((select count(*) from public.push_log where subscription_id = sid) = 4, 'outro dia e testes são permitidos');
  perform pg_temp.ok((select count(*) from public.push_log where subscription_id = sid and status = 'pending') = 4, 'envio começa como pendente');
end $$;

set role anon;
do $$ begin
  begin perform public.ninho_save_push_subscription('77777777-0000-0000-0000-000000000001', 'g', 'https://push.example/anon', 'p', 'a', null); raise exception 'FALHOU: anon inscreveu';
  exception when insufficient_privilege then raise notice 'ok - papel anon não inscreve aparelho'; end;
end $$;
reset role;

-- O servidor (service_role) lê o placar e as sequências para o resumo de domingo
set role service_role;
select pg_temp.ok((public.ninho_weekly_scores('77777777-0000-0000-0000-000000000001', public.ninho_today()) ->'g'->>'xp')::int = 0, 'servidor consegue ler o placar');
select pg_temp.ok((public.ninho_streaks('77777777-0000-0000-0000-000000000001', public.ninho_today())->>'house')::int = 0, 'servidor consegue ler as sequências');
reset role;
