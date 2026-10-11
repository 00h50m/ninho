-- Testes da migration 028: fotos privadas (compartilhamento próprio) e partes de arquivo só do servidor. Rodam depois da 011.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

insert into public.households (id, name) values ('aaaa0000-0000-0000-0000-000000000001', 'Casa fotos'), ('aaaa0000-0000-0000-0000-000000000002', 'Vizinha fotos');
insert into auth.users (id, email) values ('aaaa0000-eeee-0000-0000-00000000000a', 'gio-fotos@teste.com'), ('aaaa0000-eeee-0000-0000-00000000000b', 'sabi-fotos@teste.com'), ('aaaa0000-eeee-0000-0000-00000000000c', 'viz-fotos@teste.com');
select public.ninho_link_member('gio-fotos@teste.com', 'g', 'aaaa0000-0000-0000-0000-000000000001');
select public.ninho_link_member('sabi-fotos@teste.com', 's', 'aaaa0000-0000-0000-0000-000000000001');
select public.ninho_link_member('viz-fotos@teste.com', 'g', 'aaaa0000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from pg_policies where tablename = 'personal_photos' and policyname in ('personal_read','personal_write')) = 2, 'fotos com as regras privadas do Meu dia');
select pg_temp.ok((select count(*) from pg_policies where tablename = 'ai_upload_parts') = 0 and (select relrowsecurity from pg_class where oid = 'public.ai_upload_parts'::regclass), 'partes de arquivo: RLS sem regras (só o servidor)');

set role authenticated;
select pg_temp.as_user('aaaa0000-eeee-0000-0000-00000000000a');
insert into public.personal_photos (household_id, who, pose, thumb, data) values ('aaaa0000-0000-0000-0000-000000000001', 'g', 'frente', repeat('a', 200), repeat('b', 5000));
select pg_temp.ok((select count(*) from public.personal_photos) = 1, 'a dona guarda a foto');
do $$ begin
  begin insert into public.personal_photos (household_id, who, pose, thumb, data) values ('aaaa0000-0000-0000-0000-000000000001', 'g', 'deitada', repeat('a', 200), repeat('b', 5000));
    raise exception 'FALHOU: aceitou pose desconhecida';
  exception when check_violation then raise notice 'ok - pose conferida'; end;
  begin insert into public.personal_photos (household_id, who, pose, thumb, data) values ('aaaa0000-0000-0000-0000-000000000001', 'g', 'frente', repeat('a', 200), repeat('b', 2000001));
    raise exception 'FALHOU: aceitou foto grande demais';
  exception when check_violation then raise notice 'ok - tamanho da foto conferido'; end;
  begin insert into public.ai_upload_parts (upload_id, idx, household_id, user_id, data) values (gen_random_uuid(), 0, 'aaaa0000-0000-0000-0000-000000000001', 'aaaa0000-eeee-0000-0000-00000000000a', 'x');
    raise exception 'FALHOU: o app gravou parte de arquivo';
  exception when insufficient_privilege then raise notice 'ok - o app não grava partes de arquivo'; end;
end $$;

select pg_temp.as_user('aaaa0000-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_photos) = 0, 'a outra não vê (não compartilhado)');
select pg_temp.as_user('aaaa0000-eeee-0000-0000-00000000000a');
insert into public.personal_settings (household_id, who, share) values ('aaaa0000-0000-0000-0000-000000000001', 'g', '{"corpo":true}')
  on conflict (household_id, who) do update set share = '{"corpo":true}';
select pg_temp.as_user('aaaa0000-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_photos) = 0, 'compartilhar "Evolução física" NÃO libera as fotos');
select pg_temp.as_user('aaaa0000-eeee-0000-0000-00000000000a');
update public.personal_settings set share = '{"fotos":true}' where household_id = 'aaaa0000-0000-0000-0000-000000000001' and who = 'g';
select pg_temp.as_user('aaaa0000-eeee-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.personal_photos) = 1, 'compartilhar "fotos" libera');
delete from public.personal_photos;
select pg_temp.as_user('aaaa0000-eeee-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.personal_photos) = 1, 'a outra não apaga');
select pg_temp.as_user('aaaa0000-eeee-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.personal_photos) = 0, 'outra casa não vê nada');
reset role;
set role anon;
do $$ begin
  begin
    if (select count(*) from public.personal_photos) > 0 then raise exception 'FALHOU: sem login viu'; end if;
    raise notice 'ok - sem login não vê';
  exception when insufficient_privilege then raise notice 'ok - sem login não vê'; end;
end $$;
reset role;
