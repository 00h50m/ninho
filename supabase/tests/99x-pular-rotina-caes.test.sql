-- Testes da migration 042 (pular rotina dos cães): um pulo por rotina por dia, apagar a rotina
-- apaga os pulos, só valem quem fez g/s e a regra de segurança por casa existe. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

insert into public.households (id, name) values ('c9c9c9c9-0000-0000-0000-0000000000b1', 'Casa pulo') on conflict (id) do nothing;
insert into public.dogs (id, household_id, name) values ('c9c9c9c9-2222-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000b1', 'Cachorra teste') on conflict (id) do nothing;
insert into public.dog_routines (id, dog_id, household_id, title, frequency) values ('c9c9c9c9-3333-0000-0000-000000000001', 'c9c9c9c9-2222-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000b1', 'Passeio manhã', 'daily') on conflict (id) do nothing;

insert into public.dog_skips (routine_id, household_id, date, skipped_by) values ('c9c9c9c9-3333-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000b1', '2026-11-02', 'g');
select pg_temp.ok((select count(*) from public.dog_skips where routine_id = 'c9c9c9c9-3333-0000-0000-000000000001') = 1, 'pulo gravado');
do $$ begin
  begin insert into public.dog_skips (routine_id, household_id, date, skipped_by) values ('c9c9c9c9-3333-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000b1', '2026-11-02', 's');
    raise exception 'FALHOU: dois pulos da mesma rotina no mesmo dia';
  exception when unique_violation then raise notice 'ok - um pulo por rotina por dia'; end;
  begin insert into public.dog_skips (routine_id, household_id, date, skipped_by) values ('c9c9c9c9-3333-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000b1', '2026-11-03', 'x');
    raise exception 'FALHOU: aceitou quem fez desconhecido';
  exception when check_violation then raise notice 'ok - quem pulou: g ou s'; end;
end $$;
select pg_temp.ok((select count(*) from pg_policies where tablename = 'dog_skips' and policyname = 'household_member') = 1, 'regra de segurança por casa');
select pg_temp.ok((select relrowsecurity from pg_class where oid = 'public.dog_skips'::regclass), 'segurança por linha ligada');
delete from public.dog_routines where id = 'c9c9c9c9-3333-0000-0000-000000000001';
select pg_temp.ok((select count(*) from public.dog_skips where routine_id = 'c9c9c9c9-3333-0000-0000-000000000001') = 0, 'apagar a rotina apaga os pulos');
delete from public.dogs where id = 'c9c9c9c9-2222-0000-0000-000000000001';
delete from public.households where id = 'c9c9c9c9-0000-0000-0000-0000000000b1';
