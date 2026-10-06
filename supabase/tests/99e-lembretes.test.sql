-- Testes da migration 023 (lembretes): preferências, silêncio e "uma vez por lembrete".
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

insert into public.households (id, name) values ('e3e3e3e3-0000-0000-0000-000000000001', 'Casa lembretes');
insert into public.push_subscriptions (id, household_id, who, endpoint, p256dh, auth)
values ('e3e3e3e3-5555-0000-0000-000000000001', 'e3e3e3e3-0000-0000-0000-000000000001', 'g', 'https://push.example/lembrete', 'p', 'a');
select pg_temp.ok((select (reminders ->> 'remedio')::boolean and not (reminders ->> 'agua')::boolean and quiet_start = '22:00' and quiet_end = '07:00'
  from public.push_subscriptions where id = 'e3e3e3e3-5555-0000-0000-000000000001'), 'padrão: remédio ligado, água desligada, silêncio 22h–7h');
do $$ begin
  begin update public.push_subscriptions set quiet_start = '25:00' where id = 'e3e3e3e3-5555-0000-0000-000000000001';
    raise exception 'FALHOU: aceitou horário inválido';
  exception when check_violation then raise notice 'ok - horário de silêncio precisa ser HH:MM'; end;
end $$;
insert into public.push_log (subscription_id, kind, day, ref) values ('e3e3e3e3-5555-0000-0000-000000000001', 'reminder', '2026-10-07', 'med:x:08:00');
insert into public.push_log (subscription_id, kind, day, ref) values ('e3e3e3e3-5555-0000-0000-000000000001', 'reminder', '2026-10-07', 'med:x:20:00');
select pg_temp.ok(true, 'vários lembretes diferentes no mesmo dia');
do $$ begin
  begin insert into public.push_log (subscription_id, kind, day, ref) values ('e3e3e3e3-5555-0000-0000-000000000001', 'reminder', '2026-10-07', 'med:x:08:00');
    raise exception 'FALHOU: repetiu o mesmo lembrete';
  exception when unique_violation then raise notice 'ok - o mesmo lembrete não sai duas vezes no dia'; end;
  begin insert into public.push_log (subscription_id, kind, day) values ('e3e3e3e3-5555-0000-0000-000000000001', 'reminder', '2026-10-07');
    raise exception 'FALHOU: lembrete sem referência';
  exception when check_violation then raise notice 'ok - lembrete precisa de referência'; end;
end $$;
insert into public.push_log (subscription_id, kind, day) values ('e3e3e3e3-5555-0000-0000-000000000001', 'morning', '2026-10-07');
do $$ begin
  begin insert into public.push_log (subscription_id, kind, day) values ('e3e3e3e3-5555-0000-0000-000000000001', 'morning', '2026-10-07');
    raise exception 'FALHOU: dois bom dia no mesmo dia';
  exception when unique_violation then raise notice 'ok - bom dia continua uma vez por dia'; end;
end $$;
insert into public.push_log (subscription_id, kind, day) values ('e3e3e3e3-5555-0000-0000-000000000001', 'test', '2026-10-07'), ('e3e3e3e3-5555-0000-0000-000000000001', 'test', '2026-10-07');
select pg_temp.ok(true, 'teste pode repetir');
