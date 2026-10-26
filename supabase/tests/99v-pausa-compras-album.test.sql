-- Testes da migration 040 (pausar tarefa, compras por lugar com preço, álbum): colunas conferidas,
-- "Casa em dia" sem a pausada, álbum da casa (a outra vê e edita, outra casa não). Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

select pg_temp.ok((select count(*) from information_schema.columns where table_schema = 'public' and ((table_name = 'tasks' and column_name = 'paused_until') or (table_name = 'shopping_items' and column_name in ('store', 'price')))) = 3, 'colunas novas: pausa, lugar e preço');
select pg_temp.ok((select count(*) from pg_constraint where conname in ('shopping_items_store_check', 'shopping_items_price_check')) = 2, 'lugar e preço conferidos (uma regra cada, mesmo rodando 2x)');
select pg_temp.ok((select count(*) from pg_policies where tablename = 'album_photos' and policyname = 'household_member') = 1, 'álbum com a regra da casa');

insert into public.households (id, name) values ('b9b9b9b9-0000-0000-0000-0000000000a1', 'Casa álbum'), ('b9b9b9b9-0000-0000-0000-0000000000a2', 'Vizinha álbum') on conflict (id) do nothing;
insert into auth.users (id, email) values ('b9b9b9b9-eeee-0000-0000-00000000000a', 'gio-al@teste.com'), ('b9b9b9b9-eeee-0000-0000-00000000000b', 'sabi-al@teste.com'), ('b9b9b9b9-eeee-0000-0000-00000000000c', 'viz-al@teste.com') on conflict (id) do nothing;
select public.ninho_link_member('gio-al@teste.com', 'g', 'b9b9b9b9-0000-0000-0000-0000000000a1');
select public.ninho_link_member('sabi-al@teste.com', 's', 'b9b9b9b9-0000-0000-0000-0000000000a1');
select public.ninho_link_member('viz-al@teste.com', 'g', 'b9b9b9b9-0000-0000-0000-0000000000a2');

-- Pausa e "Casa em dia"
insert into public.tasks (id, household_id, title, category, weight, frequency, essential, active, created_at)
values ('b9b9b9b9-1111-0000-0000-000000000001', 'b9b9b9b9-0000-0000-0000-0000000000a1', 'Lavar a louça', 'kitchen', 'medium', 'daily', true, true, '2026-01-01T12:00:00Z') on conflict (id) do nothing;
select pg_temp.ok(not public.ninho_day_on_track('b9b9b9b9-0000-0000-0000-0000000000a1', '2026-12-05'), 'sem pausa: essencial pendente segura o dia');
update public.tasks set paused_until = '2026-12-05' where id = 'b9b9b9b9-1111-0000-0000-000000000001';
select pg_temp.ok(public.ninho_day_on_track('b9b9b9b9-0000-0000-0000-0000000000a1', '2026-12-05') = public.ninho_day_active('b9b9b9b9-0000-0000-0000-0000000000a1', '2026-12-05', null), 'pausada (até o dia, inclusive): o dia não depende dela');
select pg_temp.ok(not public.ninho_day_on_track('b9b9b9b9-0000-0000-0000-0000000000a1', '2026-12-06'), 'no dia seguinte ela volta a contar');

-- Compras: lugar e preço
set role authenticated;
select pg_temp.as_user('b9b9b9b9-eeee-0000-0000-00000000000a');
insert into public.shopping_items (id, household_id, title, category, store, price) values ('b9b9b9b9-2222-0000-0000-000000000001', 'b9b9b9b9-0000-0000-0000-0000000000a1', 'Banana', 'hortifruti', 'feira', 7.5);
select pg_temp.ok((select store || ' ' || price from public.shopping_items where id = 'b9b9b9b9-2222-0000-0000-000000000001') = 'feira 7.50', 'item com lugar e preço');
do $$ begin
  begin update public.shopping_items set store = 'shopping' where id = 'b9b9b9b9-2222-0000-0000-000000000001';
    raise exception 'FALHOU: aceitou lugar desconhecido';
  exception when check_violation then raise notice 'ok - lugar só da lista'; end;
  begin update public.shopping_items set price = -1 where id = 'b9b9b9b9-2222-0000-0000-000000000001';
    raise exception 'FALHOU: aceitou preço negativo';
  exception when check_violation then raise notice 'ok - preço não negativo'; end;
end $$;

-- Álbum
insert into public.album_photos (household_id, tag, caption, thumb, data, added_by) values ('b9b9b9b9-0000-0000-0000-0000000000a1', 'caes', 'Primeiro banho', repeat('a', 200), repeat('b', 300), 'g');
do $$ begin
  begin insert into public.album_photos (household_id, tag, thumb, data) values ('b9b9b9b9-0000-0000-0000-0000000000a1', 'festa', repeat('a', 200), repeat('b', 300));
    raise exception 'FALHOU: aceitou tag desconhecida';
  exception when check_violation then raise notice 'ok - tag só da lista'; end;
  begin insert into public.album_photos (household_id, thumb, data) values ('b9b9b9b9-0000-0000-0000-0000000000a1', 'x', repeat('b', 300));
    raise exception 'FALHOU: aceitou miniatura vazia';
  exception when check_violation then raise notice 'ok - foto precisa de miniatura'; end;
end $$;
select pg_temp.as_user('b9b9b9b9-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.album_photos) = 1, 'a outra da casa vê o álbum');
update public.album_photos set caption = 'Primeiro banho da Zelda';
select pg_temp.ok((select caption from public.album_photos) = 'Primeiro banho da Zelda', 'a outra da casa edita a legenda');
select pg_temp.as_user('b9b9b9b9-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.album_photos) = 0, 'outra casa não vê o álbum');
do $$ begin
  begin insert into public.album_photos (household_id, thumb, data) values ('b9b9b9b9-0000-0000-0000-0000000000a1', repeat('a', 200), repeat('b', 300));
    raise exception 'FALHOU: outra casa gravou';
  exception when insufficient_privilege then raise notice 'ok - outra casa não grava no álbum'; end;
end $$;
reset role;
