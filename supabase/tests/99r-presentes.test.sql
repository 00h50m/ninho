-- Testes da migration 036 (ideias de presente): só a dona lê e grava — a outra não vê nem com
-- compartilhamento ligado (é surpresa); formato conferido. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

select pg_temp.ok((select count(*) from pg_policies where tablename in ('gift_ideas','gift_dates') and policyname = 'owner_only') = 2, 'presentes só da dona (uma regra por tabela)');
select pg_temp.ok((select count(*) from pg_policies where tablename in ('gift_ideas','gift_dates')) = 2, 'nenhuma outra regra de leitura nos presentes');

insert into public.households (id, name) values ('c7c7c7c7-0000-0000-0000-0000000000a1', 'Casa presentes'), ('c7c7c7c7-0000-0000-0000-0000000000a2', 'Vizinha presentes') on conflict (id) do nothing;
insert into auth.users (id, email) values ('c7c7c7c7-eeee-0000-0000-00000000000a', 'gio-pres@teste.com'), ('c7c7c7c7-eeee-0000-0000-00000000000b', 'sabi-pres@teste.com'), ('c7c7c7c7-eeee-0000-0000-00000000000c', 'viz-pres@teste.com') on conflict (id) do nothing;
select public.ninho_link_member('gio-pres@teste.com', 'g', 'c7c7c7c7-0000-0000-0000-0000000000a1');
select public.ninho_link_member('sabi-pres@teste.com', 's', 'c7c7c7c7-0000-0000-0000-0000000000a1');
select public.ninho_link_member('viz-pres@teste.com', 'g', 'c7c7c7c7-0000-0000-0000-0000000000a2');

set role authenticated;
select pg_temp.as_user('c7c7c7c7-eeee-0000-0000-00000000000a');
insert into public.gift_dates (id, household_id, who, title, month, day, for_who) values ('c7c7c7c7-dddd-0000-0000-000000000001', 'c7c7c7c7-0000-0000-0000-0000000000a1', 'g', 'Aniversário da Sabrina', 3, 14, 's');
insert into public.gift_ideas (household_id, who, for_who, title, link, date_id) values ('c7c7c7c7-0000-0000-0000-0000000000a1', 'g', 's', 'Fone azul', 'https://loja.exemplo/fone', 'c7c7c7c7-dddd-0000-0000-000000000001');
select pg_temp.ok((select count(*) from public.gift_ideas) = 1 and (select status from public.gift_ideas) = 'ideia', 'a dona anota a ideia (começa como ideia)');
do $$ begin
  begin insert into public.gift_dates (household_id, who, title, month, day) values ('c7c7c7c7-0000-0000-0000-0000000000a1', 'g', 'Data errada', 2, 30);
    raise exception 'FALHOU: aceitou 30 de fevereiro';
  exception when check_violation then raise notice 'ok - dia que não existe recusado'; end;
  begin insert into public.gift_ideas (household_id, who, for_who, title, link) values ('c7c7c7c7-0000-0000-0000-0000000000a1', 'g', 's', 'X', 'javascript:alert(1)');
    raise exception 'FALHOU: aceitou link estranho';
  exception when check_violation then raise notice 'ok - link só http(s)'; end;
  begin update public.gift_ideas set status = 'perdido';
    raise exception 'FALHOU: aceitou andamento desconhecido';
  exception when check_violation then raise notice 'ok - andamento só ideia/comprado/dado'; end;
end $$;
insert into public.gift_dates (household_id, who, title, month, day) values ('c7c7c7c7-0000-0000-0000-0000000000a1', 'g', 'Ano bissexto', 2, 29);
select pg_temp.ok(true, '29 de fevereiro vale');
-- compartilhamento de tudo do Meu dia ligado: mesmo assim a outra não vê os presentes
insert into public.personal_settings (household_id, who, share) values ('c7c7c7c7-0000-0000-0000-0000000000a1', 'g', '{"refeicao":true,"fotos":true,"corpo":true,"agua":true,"sono":true}')
  on conflict (household_id, who) do update set share = excluded.share;

select pg_temp.as_user('c7c7c7c7-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.gift_ideas) = 0 and (select count(*) from public.gift_dates) = 0, 'a outra não vê as ideias nem as datas (mesmo com tudo compartilhado)');
update public.gift_ideas set status = 'dado';
do $$ begin
  begin insert into public.gift_ideas (household_id, who, for_who, title) values ('c7c7c7c7-0000-0000-0000-0000000000a1', 'g', 's', 'Intrusa');
    raise exception 'FALHOU: criou ideia na lista da outra';
  exception when insufficient_privilege then raise notice 'ok - ninguém escreve na lista da outra'; end;
end $$;
insert into public.gift_ideas (household_id, who, for_who, title) values ('c7c7c7c7-0000-0000-0000-0000000000a1', 's', 'g', 'Livro');
select pg_temp.ok((select count(*) from public.gift_ideas) = 1, 'a outra tem a própria lista');
select pg_temp.as_user('c7c7c7c7-eeee-0000-0000-00000000000a');
select pg_temp.ok((select string_agg(title || ':' || status, ',') from public.gift_ideas) = 'Fone azul:ideia', 'a dona só vê a dela, e a outra não alterou');
select pg_temp.as_user('c7c7c7c7-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.gift_ideas) = 0 and (select count(*) from public.gift_dates) = 0, 'outra casa não vê nada');
-- compromissos com hora de fim e "passar só hoje"
select pg_temp.as_user('c7c7c7c7-eeee-0000-0000-00000000000a');
insert into public.house_events (household_id, kind, title, date, time, end_time, who) values ('c7c7c7c7-0000-0000-0000-0000000000a1', 'compromisso', 'Dentista', '2026-11-10', '14:00', '16:00', 'g');
select pg_temp.ok((select end_time from public.house_events where title = 'Dentista') = '16:00', 'compromisso com hora de fim');
do $$ begin
  begin update public.house_events set end_time = '13:00' where title = 'Dentista';
    raise exception 'FALHOU: aceitou fim antes do começo';
  exception when check_violation then raise notice 'ok - fim precisa ser depois do começo'; end;
end $$;
insert into public.tasks (id, household_id, title, category, weight, frequency, assigned_to) values ('c7c7c7c7-7777-0000-0000-000000000001', 'c7c7c7c7-0000-0000-0000-0000000000a1', 'Lixo', 'general', 'light', 'daily', 'g');
insert into public.task_handoffs (household_id, task_id, date, to_who, by_who) values ('c7c7c7c7-0000-0000-0000-0000000000a1', 'c7c7c7c7-7777-0000-0000-000000000001', '2026-11-10', 's', 'g');
do $$ begin
  begin insert into public.task_handoffs (household_id, task_id, date, to_who) values ('c7c7c7c7-0000-0000-0000-0000000000a1', 'c7c7c7c7-7777-0000-0000-000000000001', '2026-11-10', 'g');
    raise exception 'FALHOU: dois "só hoje" no mesmo dia';
  exception when unique_violation then raise notice 'ok - um "só hoje" por tarefa e dia'; end;
end $$;
select pg_temp.as_user('c7c7c7c7-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.task_handoffs) = 1, 'a outra da casa vê o "só hoje" (é da casa)');
select pg_temp.as_user('c7c7c7c7-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.task_handoffs) = 0, 'outra casa não vê o "só hoje"');
reset role;
set role anon;
do $$ begin
  begin
    if (select count(*) from public.gift_ideas) > 0 then raise exception 'FALHOU: sem login viu'; end if;
    raise notice 'ok - sem login não vê';
  exception when insufficient_privilege then raise notice 'ok - sem login não vê'; end;
end $$;
reset role;
