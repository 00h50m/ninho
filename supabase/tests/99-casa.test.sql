-- Testes da migration 019 (Casa completa). Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('9e9e9e9e-0000-0000-0000-000000000001', 'Casa completa'), ('9e9e9e9e-0000-0000-0000-000000000002', 'Vizinha');
insert into auth.users (id, email) values ('9e9e9e9e-eeee-0000-0000-00000000000a', 'gio-cc@teste.com'), ('9e9e9e9e-eeee-0000-0000-00000000000c', 'viz-cc@teste.com');
select public.ninho_link_member('gio-cc@teste.com', 'g', '9e9e9e9e-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-cc@teste.com', 'g', '9e9e9e9e-0000-0000-0000-000000000002');

set role authenticated;
select pg_temp.as_user('9e9e9e9e-eeee-0000-0000-00000000000a');
-- Tarefas: prioridade, checklist, ajuda
insert into public.tasks (id, household_id, title, category, weight, frequency, priority, notes, checklist, help_by, help_at) values
  ('9e9e9e9e-aaaa-0000-0000-000000000001', '9e9e9e9e-0000-0000-0000-000000000001', 'Faxina do banheiro', 'bathroom', 'heavy', 'weekly', 'alta', 'Usar o produto novo',
   '[{"t":"Box","d":true},{"t":"Vaso","d":false}]', 's', now()),
  ('9e9e9e9e-aaaa-0000-0000-000000000002', '9e9e9e9e-0000-0000-0000-000000000001', 'Agendar veterinário', 'dogs', 'light', 'once', 'normal', null,
   '[{"t":"Ligar","d":true}]', null, null);
do $$ begin
  begin update public.tasks set priority = 'urgentíssima' where id = '9e9e9e9e-aaaa-0000-0000-000000000001'; raise exception 'FALHOU: prioridade inválida';
  exception when check_violation then raise notice 'ok - prioridade só alta, normal ou baixa'; end;
end $$;
select public.ninho_complete_task('9e9e9e9e-aaaa-0000-0000-000000000001', public.ninho_today(), 'g');
select pg_temp.ok((select help_by is null and help_at is null from public.tasks where id = '9e9e9e9e-aaaa-0000-0000-000000000001'), 'concluir atende o pedido de ajuda');
select pg_temp.ok((select checklist = '[{"t":"Box","d":false},{"t":"Vaso","d":false}]'::jsonb and notes = 'Usar o produto novo' and priority = 'alta' from public.tasks where id = '9e9e9e9e-aaaa-0000-0000-000000000001'),
  'tarefa recorrente: checklist volta em branco para a próxima vez; observação e prioridade ficam');
select public.ninho_complete_task('9e9e9e9e-aaaa-0000-0000-000000000002', public.ninho_today(), 'g');
select pg_temp.ok((select checklist = '[{"t":"Ligar","d":true}]'::jsonb from public.tasks where id = '9e9e9e9e-aaaa-0000-0000-000000000002'), 'tarefa pontual: checklist fica como foi feito');

-- Compras: recorrência sem duplicar
insert into public.shopping_items (id, household_id, title, qty, unit, category, priority, assigned_to, running_low, recur_days) values
  ('9e9e9e9e-bbbb-0000-0000-000000000001', '9e9e9e9e-0000-0000-0000-000000000001', 'Ração', '2', 'pct', 'pets', 'alta', 's', true, 15),
  ('9e9e9e9e-bbbb-0000-0000-000000000002', '9e9e9e9e-0000-0000-0000-000000000001', 'Detergente', null, null, 'limpeza', 'normal', null, false, 7);
update public.shopping_items set done_at = now() where id in ('9e9e9e9e-bbbb-0000-0000-000000000001', '9e9e9e9e-bbbb-0000-0000-000000000002');
select pg_temp.ok((select back_on = public.ninho_today() + 15 from public.shopping_items where id = '9e9e9e9e-bbbb-0000-0000-000000000001'), 'comprado: marca quando volta (15 dias)');
select pg_temp.ok(public.ninho_shopping_recur('9e9e9e9e-0000-0000-0000-000000000001') = 0, 'antes da data não volta nada');
update public.shopping_items set back_on = public.ninho_today() where household_id = '9e9e9e9e-0000-0000-0000-000000000001';
insert into public.shopping_items (household_id, title, category) values ('9e9e9e9e-0000-0000-0000-000000000001', 'detergente', 'limpeza');
select pg_temp.ok(public.ninho_shopping_recur('9e9e9e9e-0000-0000-0000-000000000001') = 1, 'na data volta para a lista (o que já está na lista não duplica)');
select pg_temp.ok((select count(*) from public.shopping_items where done_at is null and lower(title) = 'ração' and qty = '2' and unit = 'pct' and priority = 'alta' and assigned_to = 's' and recur_days = 15 and not running_low) = 1
  and (select count(*) from public.shopping_items where done_at is null and lower(title) = 'detergente') = 1, 'item volta com quantidade, unidade, prioridade e quem compra; sem duplicar');
select pg_temp.ok(public.ninho_shopping_recur('9e9e9e9e-0000-0000-0000-000000000001') = 0, 'rodar de novo não duplica');

-- Manutenção: prestador, garantia, custo, link
insert into public.maintenance_items (household_id, title, category, every_months, next_due, provider, warranty_until, cost, link) values
  ('9e9e9e9e-0000-0000-0000-000000000001', 'Ar-condicionado', 'casa', 6, public.ninho_today(), 'Clima Frio', '2027-01-01', 180.50, 'https://exemplo.com/nota.pdf');
do $$ begin
  begin insert into public.maintenance_items (household_id, title, category, every_months, next_due, link) values ('9e9e9e9e-0000-0000-0000-000000000001', 'X', 'casa', 1, current_date, 'javascript:alert(1)');
    raise exception 'FALHOU: link inválido';
  exception when check_violation then raise notice 'ok - link de comprovante só http(s)'; end;
  begin insert into public.maintenance_items (household_id, title, category, every_months, next_due, cost) values ('9e9e9e9e-0000-0000-0000-000000000001', 'X', 'casa', 1, current_date, -1);
    raise exception 'FALHOU: custo negativo';
  exception when check_violation then raise notice 'ok - custo não pode ser negativo'; end;
end $$;

-- Agenda e vencimentos
insert into public.house_events (household_id, kind, title, date, time, who) values ('9e9e9e9e-0000-0000-0000-000000000001', 'consulta_caes', 'Vacina da Zelda', public.ninho_today() + 3, '10:30', 'both');
insert into public.house_events (household_id, kind, title, date, who, paid) values ('9e9e9e9e-0000-0000-0000-000000000001', 'vencimento', 'Conta de luz', public.ninho_today() + 5, 'g', false);
update public.house_events set paid = true where title = 'Conta de luz';
select pg_temp.ok((select paid from public.house_events where title = 'Conta de luz'), 'vencimento: pago ou pendente');
do $$ begin
  begin insert into public.house_events (household_id, kind, title, date) values ('9e9e9e9e-0000-0000-0000-000000000001', 'fatura_cartao', 'X', current_date); raise exception 'FALHOU: tipo inválido';
  exception when check_violation then raise notice 'ok - agenda só com tipos da casa (sem módulo financeiro)'; end;
end $$;
update public.households set sobrou_url = 'https://sobrou.app' where id = '9e9e9e9e-0000-0000-0000-000000000001';

-- Outra casa
select pg_temp.as_user('9e9e9e9e-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.house_events) = 0, 'outra casa não vê a agenda');
select pg_temp.ok(public.ninho_shopping_recur('9e9e9e9e-0000-0000-0000-000000000001') = 0, 'outra casa não mexe na lista');
reset role;
select pg_temp.as_user(null);
set role anon;
do $$ begin
  begin perform public.ninho_shopping_recur('9e9e9e9e-0000-0000-0000-000000000001'); raise exception 'FALHOU: anon';
  exception when insufficient_privilege then raise notice 'ok - sem login não usa a recorrência'; end;
end $$;
reset role;
