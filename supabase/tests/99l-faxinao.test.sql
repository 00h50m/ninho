-- Testes da migration 030 (Faxinão): da casa (as duas veem e marcam), passo marcado numa gravação só. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('cccc0000-0000-0000-0000-000000000001', 'Casa faxina'), ('cccc0000-0000-0000-0000-000000000002', 'Vizinha faxina');
insert into auth.users (id, email) values ('cccc0000-eeee-0000-0000-00000000000a', 'gio-fax@teste.com'), ('cccc0000-eeee-0000-0000-00000000000b', 'sabi-fax@teste.com'), ('cccc0000-eeee-0000-0000-00000000000c', 'viz-fax@teste.com');
select public.ninho_link_member('gio-fax@teste.com', 'g', 'cccc0000-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-fax@teste.com', 's', 'cccc0000-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-fax@teste.com', 'g', 'cccc0000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from pg_policies where tablename = 'faxinoes' and policyname = 'household_member') = 1, 'faxinão com a regra da casa');

set role authenticated;
select pg_temp.as_user('cccc0000-eeee-0000-0000-00000000000a');
insert into public.faxinoes (id, household_id, title, steps, status, created_by) values ('cccc0000-9999-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', 'Faxinão de sábado',
  '[{"id":"a","title":"Máquina de lavar","who":"g","min":5},{"id":"b","title":"Box com produto","who":"s","min":10},{"id":"c","title":"Pano no chão","who":"both","min":15}]', 'andamento', 'g');
select public.ninho_faxinao_step('cccc0000-9999-0000-0000-000000000001', 'a', 'done', 'g');
select pg_temp.as_user('cccc0000-eeee-0000-0000-00000000000b');
select public.ninho_faxinao_step('cccc0000-9999-0000-0000-000000000001', 'b', 'done', 's');
select pg_temp.ok((select steps -> 0 ->> 'done_by' from public.faxinoes) = 'g' and (select steps -> 1 ->> 'done_by' from public.faxinoes) = 's', 'as duas marcam passos diferentes sem apagar a outra');
select public.ninho_faxinao_step('cccc0000-9999-0000-0000-000000000001', 'a', 'later', 's');
select pg_temp.ok((select steps -> 2 ->> 'id' from public.faxinoes) = 'a' and jsonb_array_length((select steps from public.faxinoes)) = 3, '"depois" manda o passo para o fim');
select public.ninho_faxinao_step('cccc0000-9999-0000-0000-000000000001', 'b', 'undo', 's');
select pg_temp.ok((select steps -> 0 ->> 'done_at' from public.faxinoes) is null, 'desfazer');
do $$ begin
  begin perform public.ninho_faxinao_step('cccc0000-9999-0000-0000-000000000001', 'b', 'apagar', 's');
    raise exception 'FALHOU: aceitou ação inválida';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok - ação inválida recusada'; end;
end $$;
update public.faxinoes set status = 'feito', finished_at = now();
do $$ begin
  begin perform public.ninho_faxinao_step('cccc0000-9999-0000-0000-000000000001', 'b', 'done', 's');
    raise exception 'FALHOU: marcou faxinão encerrado';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok - faxinão encerrado não muda'; end;
end $$;

select pg_temp.as_user('cccc0000-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.faxinoes) = 0, 'outra casa não vê');
do $$ begin
  begin perform public.ninho_faxinao_step('cccc0000-9999-0000-0000-000000000001', 'b', 'done', 'g');
    raise exception 'FALHOU: outra casa marcou';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok - outra casa não marca'; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    if (select count(*) from public.faxinoes) > 0 then raise exception 'FALHOU: sem login viu'; end if;
    raise notice 'ok - sem login não vê';
  exception when insufficient_privilege then raise notice 'ok - sem login não vê'; end;
end $$;
reset role;
