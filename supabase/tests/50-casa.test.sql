-- Testes da migration 007 (compras, manutenção, divisão). Rodam nos três cenários.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

insert into public.households (id, name) values ('66666666-0000-0000-0000-000000000001', 'Casa compras');
select pg_temp.ok((select split_mode from public.households where id = '66666666-0000-0000-0000-000000000001') = 'smart', 'casa nova começa com divisão inteligente');
select pg_temp.ok((select count(*) from public.households where split_mode is null) = 0, 'casas existentes ganharam o modo de divisão');

set role authenticated;

do $$
declare r jsonb; r2 jsonb; hid uuid := '66666666-0000-0000-0000-000000000001';
begin
  -- ── Compras ──
  r := public.ninho_add_shopping_item(hid, '  Leite ', '2 L', 'frios', 'g');
  perform pg_temp.ok((r->>'created')::boolean, 'item adicionado');
  r2 := public.ninho_add_shopping_item(hid, 'leite', null, 'frios', 's');
  perform pg_temp.ok(not (r2->>'created')::boolean and r2->>'id' = r->>'id', 'mesmo item (sem diferenciar maiúsculas) não duplica');
  perform pg_temp.ok((select count(*) from public.shopping_items where household_id = hid) = 1 and (select qty from public.shopping_items where household_id = hid) = '2 L',
    'quantidade mantida quando a outra adiciona sem quantidade');
  update public.shopping_items set checked_at = now(), checked_by = 's' where id = (r->>'id')::uuid;
  r2 := public.ninho_add_shopping_item(hid, 'Leite', '3 L', 'frios', 'g');
  perform pg_temp.ok((r2->>'reopened')::boolean and (select checked_at is null and qty = '3 L' from public.shopping_items where id = (r->>'id')::uuid),
    'adicionar item já riscado volta ele para a lista, com a nova quantidade');
  begin perform public.ninho_add_shopping_item(hid, '   ', null, null, 'g'); raise exception 'FALHOU: aceitou item vazio';
  exception when others then if sqlerrm like 'NINHO_INVALID_INPUT%' then raise notice 'ok - item vazio é recusado'; else raise; end if; end;
  begin perform public.ninho_add_shopping_item(hid, 'Pão', null, null, 'x'); raise exception 'FALHOU: aceitou pessoa inválida';
  exception when others then if sqlerrm like 'NINHO_INVALID_PERSON%' then raise notice 'ok - pessoa inválida é recusada'; else raise; end if; end;

  -- Finalizar compra: riscados saem da lista; o mesmo item pode voltar depois
  update public.shopping_items set checked_at = now() where household_id = hid;
  update public.shopping_items set done_at = now() where household_id = hid and checked_at is not null and done_at is null;
  r2 := public.ninho_add_shopping_item(hid, 'Leite', null, 'frios', 's');
  perform pg_temp.ok((r2->>'created')::boolean and (select count(*) from public.shopping_items where household_id = hid) = 2,
    'depois de finalizar, o item pode voltar à lista (histórico preservado)');
end $$;

do $$
declare
  hid uuid := '66666666-0000-0000-0000-000000000001'; mid uuid; mid2 uuid; r jsonb; r2 jsonb; t date := public.ninho_today();
begin
  -- ── Manutenção ──
  insert into public.maintenance_items (household_id, title, category, every_months, next_due)
  values (hid, 'Filtro do ar', 'casa', 3, t - 5) returning id into mid;
  insert into public.maintenance_items (household_id, title, category, every_days, last_done, next_due)
  values (hid, 'Antipulgas', 'caes', 30, t - 20, t + 10) returning id into mid2;

  r := public.ninho_complete_maintenance(mid, t, 'g');
  perform pg_temp.ok((r->>'created')::boolean and (r->>'xp')::int = 3, 'manutenção concluída: +3 XP');
  perform pg_temp.ok((select last_done = t and next_due = (t + interval '3 months')::date from public.maintenance_items where id = mid),
    'próxima data = hoje + 3 meses');
  perform pg_temp.ok((select earned_by = 'g' and activity_date = t from public.xp_history where reason = 'maint:' || mid || ':' || to_char(t, 'YYYY-MM-DD')),
    'XP com autoria e data');
  r2 := public.ninho_complete_maintenance(mid, t, 's');
  perform pg_temp.ok(not (r2->>'created')::boolean and (r2->>'xp')::int = 0
    and (select count(*) from public.xp_history where reason like 'maint:' || mid || ':%' and voided_at is null) = 1,
    'concluir de novo no mesmo dia não duplica XP nem histórico');

  r2 := public.ninho_undo_maintenance((r->>'log_id')::uuid);
  perform pg_temp.ok((r2->>'removed')::boolean
    and (select last_done is null and next_due = t - 5 from public.maintenance_items where id = mid)
    and not exists (select 1 from public.xp_history where reason like 'maint:' || mid || ':%' and voided_at is null),
    'desfazer volta as datas anteriores e tira o XP');

  r := public.ninho_complete_maintenance(mid2, t, 's');
  perform pg_temp.ok((select next_due = t + 30 from public.maintenance_items where id = mid2), 'intervalo em dias: hoje + 30');

  begin perform public.ninho_complete_maintenance(mid, t, null); raise exception 'FALHOU: concluiu sem pessoa';
  exception when others then if sqlerrm like 'NINHO_INVALID_PERSON%' then raise notice 'ok - concluir exige a pessoa do aparelho'; else raise; end if; end;
  begin perform public.ninho_complete_maintenance(mid, t - 10, 'g'); raise exception 'FALHOU: aceitou data antiga';
  exception when others then if sqlerrm like 'NINHO_INVALID_DATE%' then raise notice 'ok - data fora do dia atual é recusada'; else raise; end if; end;
  begin perform public.ninho_complete_maintenance('00000000-0000-0000-0000-00000000dead', t, 'g'); raise exception 'FALHOU: achou item inexistente';
  exception when others then if sqlerrm like 'NINHO_NOT_FOUND%' then raise notice 'ok - item inexistente: NINHO_NOT_FOUND'; else raise; end if; end;
  begin insert into public.maintenance_items (household_id, title) values (hid, 'Sem intervalo'); raise exception 'FALHOU: aceitou sem intervalo';
  exception when check_violation then raise notice 'ok - manutenção sem intervalo é recusada'; end;
end $$;

-- Meses do calendário: 31/01 + 1 mês = último dia de fevereiro
select pg_temp.ok(public.ninho_next_due('2027-01-31', 1, null) = '2027-02-28', '31/01 + 1 mês = 28/02');
select pg_temp.ok(public.ninho_next_due('2026-10-05', null, 45) = '2026-11-19', '05/10 + 45 dias = 19/11');

-- XP da manutenção conta no total da casa e no placar
select pg_temp.ok(public.ninho_household_xp('66666666-0000-0000-0000-000000000001') = 3, 'XP da manutenção entra no total da casa');

-- Divisão: só aceita os dois modos
do $$ begin
  update public.households set split_mode = 'rotation' where id = '66666666-0000-0000-0000-000000000001';
  begin update public.households set split_mode = 'ia' where id = '66666666-0000-0000-0000-000000000001'; raise exception 'FALHOU: aceitou modo inválido';
  exception when check_violation then raise notice 'ok - modo de divisão inválido é recusado'; end;
end $$;

reset role;
set role anon;
do $$ begin
  begin perform public.ninho_add_shopping_item('66666666-0000-0000-0000-000000000001', 'X', null, null, 'g'); raise exception 'FALHOU: anon adicionou';
  exception when insufficient_privilege then raise notice 'ok - anon não usa as funções de compras'; end;
  begin perform public.ninho_complete_maintenance('00000000-0000-0000-0000-000000000000', current_date, 'g'); raise exception 'FALHOU: anon concluiu';
  exception when insufficient_privilege then raise notice 'ok - anon não conclui manutenção'; end;
end $$;
reset role;

select pg_temp.ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'shopping_items')
               and exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'maintenance_items'),
  'compras e manutenção no Realtime');
