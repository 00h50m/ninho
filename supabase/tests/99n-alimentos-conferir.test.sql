-- Testes da migration 032 (alimentos "para conferir"): coluna opcional, limite de tamanho, privacidade igual. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

select pg_temp.ok((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'personal_foods' and column_name = 'review' and is_nullable = 'YES') = 1, 'personal_foods.review existe e é opcional');
select pg_temp.ok((select count(*) from pg_constraint where conrelid = 'public.personal_foods'::regclass and conname = 'personal_foods_review_len') = 1, 'limite de tamanho do motivo (uma regra só, mesmo rodando 2x)');

insert into public.households (id, name) values ('adadadad-0000-0000-0000-000000000001', 'Casa rótulo');
insert into auth.users (id, email) values ('adadadad-eeee-0000-0000-00000000000a', 'gio-rot@teste.com'), ('adadadad-eeee-0000-0000-00000000000b', 'sabi-rot@teste.com');
select public.ninho_link_member('gio-rot@teste.com', 'g', 'adadadad-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-rot@teste.com', 's', 'adadadad-0000-0000-0000-000000000001');

set role authenticated;
select pg_temp.as_user('adadadad-eeee-0000-0000-00000000000a');
insert into public.personal_foods (household_id, who, name, portion, portion_g, kcal, protein) values ('adadadad-0000-0000-0000-000000000001', 'g', 'Antigo', '1 un', 50, 100, 5);
insert into public.personal_foods (household_id, who, name, portion, portion_g, kcal, protein, review) values ('adadadad-0000-0000-0000-000000000001', 'g', 'Iogurte teste', '1 pote', 120, 60, 6, 'Marca e sabor variam');
select pg_temp.ok((select review is null from public.personal_foods where name = 'Antigo'), 'alimento sem motivo = conferido (como os de antes)');
select pg_temp.ok((select review from public.personal_foods where name = 'Iogurte teste') = 'Marca e sabor variam', 'importado com o motivo de conferir');
do $$ begin
  begin update public.personal_foods set review = repeat('x', 201) where name = 'Iogurte teste';
    raise exception 'FALHOU: aceitou motivo com mais de 200 letras';
  exception when check_violation then raise notice 'ok - motivo até 200 letras'; end;
  begin update public.personal_foods set review = '' where name = 'Iogurte teste';
    raise exception 'FALHOU: aceitou motivo vazio';
  exception when check_violation then raise notice 'ok - motivo vazio não vale (conferido é null)'; end;
end $$;
update public.personal_foods set review = null, kcal = 58 where name = 'Iogurte teste';
select pg_temp.ok((select review is null and kcal = 58 from public.personal_foods where name = 'Iogurte teste'), 'conferir: some o aviso e fica o valor do rótulo');

select pg_temp.as_user('adadadad-eeee-0000-0000-00000000000b');
update public.personal_foods set review = 'mexi' where name = 'Antigo';
select pg_temp.as_user('adadadad-eeee-0000-0000-00000000000a');
select pg_temp.ok((select review is null from public.personal_foods where name = 'Antigo'), 'a outra não marca nem desmarca os alimentos dela');
reset role;
