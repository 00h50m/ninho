-- Testes da migration 046 (módulos por casa): casas antigas ficam como estavam, casa nova começa
-- sem IA e sem Sobrou, o app não consegue ligá-los, a casa escolhe os pets e quem não é da casa não.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

select pg_temp.ok((select column_default from information_schema.columns where table_name = 'households' and column_name = 'features') like '''{}''%', 'casa nova começa sem módulos ligados (padrão vazio)');

-- cenário com o schema real: a casa que já existia antes da 046 continua com IA e Sobrou
do $$ begin
  -- (só no cenário do schema real: lá a tabela tem a coluna antiga invite_code e a casa veio antes das migrations)
  if exists (select 1 from information_schema.columns where table_name = 'households' and column_name = 'invite_code')
     and exists (select 1 from public.households where id = '99999999-0000-0000-0000-000000000001') then
    perform pg_temp.ok((select features->>'ia' = 'true' and features->>'sobrou' = 'true' and features ? 'pets' from public.households where id = '99999999-0000-0000-0000-000000000001'), 'a casa que já existia continua com IA, Sobrou e a escolha de pets');
  end if;
end $$;

-- casa nova criada pelo app (papel authenticated): ia/sobrou caem fora mesmo se vierem no pedido
set role authenticated;
do $$ begin
  insert into public.households (id, name, features) values ('c9c9c9c9-0000-0000-0000-0000000000c6', 'Casa nova', '{"ia":true,"sobrou":true,"pets":false}');
exception when insufficient_privilege then raise notice '(sem permissão de criar casa direto neste cenário)'; end $$;
reset role;
insert into public.households (id, name) values ('c9c9c9c9-0000-0000-0000-0000000000c6', 'Casa nova') on conflict (id) do nothing;
select pg_temp.ok(coalesce((select features->>'ia' from public.households where id = 'c9c9c9c9-0000-0000-0000-0000000000c6'), 'false') <> 'true', 'casa nova sem IA');
select pg_temp.ok(coalesce((select features->>'sobrou' from public.households where id = 'c9c9c9c9-0000-0000-0000-0000000000c6'), 'false') <> 'true', 'casa nova sem Sobrou');

-- uma pessoa da casa nova
insert into auth.users (id, email) values ('c9c9c9c9-6666-0000-0000-000000000001', 'nova@casa.test') on conflict do nothing;
do $$ begin
  if to_regclass('public.household_members') is not null then
    insert into public.household_members (user_id, household_id, who) values ('c9c9c9c9-6666-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-0000000000c6', 'g') on conflict do nothing;
  end if;
end $$;
select set_config('request.jwt.claim.sub', 'c9c9c9c9-6666-0000-0000-000000000001', false), set_config('request.jwt.claims', '{"sub":"c9c9c9c9-6666-0000-0000-000000000001","role":"authenticated"}', false);
set role authenticated;
select pg_temp.ok((public.ninho_set_feature('c9c9c9c9-0000-0000-0000-0000000000c6', 'pets', false) ->> 'pets') = 'false', 'a casa escolhe: sem pets');
select pg_temp.ok((public.ninho_set_feature('c9c9c9c9-0000-0000-0000-0000000000c6', 'pets', true) ->> 'pets') = 'true', 'e pode ligar de novo');
do $$ begin
  perform public.ninho_set_feature('c9c9c9c9-0000-0000-0000-0000000000c6', 'ia', true);
  raise exception 'FALHOU: a casa ligou a IA sozinha';
exception when insufficient_privilege then raise notice 'ok - a casa não liga a IA pela função';
end $$;
do $$ begin
  update public.households set features = features || '{"ia":true}' where id = 'c9c9c9c9-0000-0000-0000-0000000000c6';
  if exists (select 1 from public.households where id = 'c9c9c9c9-0000-0000-0000-0000000000c6' and features->>'ia' = 'true') then raise exception 'FALHOU: a casa ligou a IA pelo update'; end if;
  raise notice 'ok - (update sem efeito)';
exception when insufficient_privilege then raise notice 'ok - a casa não liga a IA mudando a linha';
end $$;
do $$ begin
  update public.households set features = features || '{"sobrou":true}' where id = 'c9c9c9c9-0000-0000-0000-0000000000c6';
  if exists (select 1 from public.households where id = 'c9c9c9c9-0000-0000-0000-0000000000c6' and features->>'sobrou' = 'true') then raise exception 'FALHOU: a casa ligou o Sobrou'; end if;
  raise notice 'ok - (update sem efeito)';
exception when insufficient_privilege then raise notice 'ok - a casa não liga o Sobrou';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false);

-- quem administra o banco liga a IA (SQL Editor)
update public.households set features = features || '{"ia":true}' where id = 'c9c9c9c9-0000-0000-0000-0000000000c6';
select pg_temp.ok((select features->>'ia' from public.households where id = 'c9c9c9c9-0000-0000-0000-0000000000c6') = 'true', 'quem administra o banco liga a IA');

delete from public.households where id = 'c9c9c9c9-0000-0000-0000-0000000000c6';
delete from auth.users where id = 'c9c9c9c9-6666-0000-0000-000000000001';
