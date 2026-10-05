-- Testes da migration 009 (Telegram e IA). Rodam nos três cenários.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;

insert into public.households (id, name) values ('44444444-0000-0000-0000-000000000001', 'Casa telegram');
insert into public.tasks (id, household_id, title, category, weight, frequency) values
  ('44444444-aaaa-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 'Louça', 'kitchen', 'light', 'daily');

set role authenticated;
do $$
declare c1 text; c2 text; c3 text; h uuid := '44444444-0000-0000-0000-000000000001';
begin
  c1 := public.ninho_telegram_link_code(h, 'g');
  perform pg_temp.ok(length(c1) = 8 and c1 = upper(c1), 'código de 8 caracteres');
  c2 := public.ninho_telegram_link_code(h, 'g');
  perform pg_temp.ok(c2 <> c1 and (select count(*) from public.telegram_links where household_id = h and who = 'g') = 1,
    'gerar de novo renova o código (sem acumular vínculos pendentes)');
  c3 := public.ninho_telegram_link_code(h, 's');
  perform pg_temp.ok((select count(*) from public.telegram_links where household_id = h) = 2, 'cada pessoa tem o seu');
  begin perform public.ninho_telegram_link_code(h, 'x'); raise exception 'FALHOU: aceitou pessoa inválida';
  exception when others then if sqlerrm like 'NINHO_INVALID_PERSON%' then raise notice 'ok - pessoa inválida é recusada'; else raise; end if; end;
end $$;
reset role;

-- O bot (service_role) liga a conversa e conclui em nome da pessoa
set role service_role;
do $$
declare r jsonb; h uuid := '44444444-0000-0000-0000-000000000001';
begin
  update public.telegram_links set chat_id = 123456, linked_at = now(), link_code = null, code_expires_at = null where household_id = h and who = 'g';
  perform pg_temp.ok((select chat_id from public.telegram_links where household_id = h and who = 'g') = 123456, 'servidor liga a conversa');
  r := public.ninho_complete_task('44444444-aaaa-0000-0000-000000000001', public.ninho_today(), 'g');
  perform pg_temp.ok((r->>'created')::boolean, 'servidor conclui tarefa em nome da pessoa (bot)');
  r := public.ninho_add_shopping_item(h, 'Café', null, 'mercearia', 'g');
  perform pg_temp.ok((r->>'created')::boolean, 'servidor adiciona item na lista (bot)');
  insert into public.telegram_log (link_id, kind, day) select id, 'morning', '2026-10-07' from public.telegram_links where chat_id = 123456;
  begin
    insert into public.telegram_log (link_id, kind, day) select id, 'morning', '2026-10-07' from public.telegram_links where chat_id = 123456;
    raise exception 'FALHOU: dois bom dia no mesmo dia';
  exception when unique_violation then raise notice 'ok - no máximo um bom dia por conversa por dia'; end;
  insert into public.ai_log (household_id, kind, input_tokens, output_tokens) values (h, 'weekly', 1000, 300);
end $$;
reset role;

do $$ begin
  begin insert into public.telegram_links (household_id, who, chat_id) values ('44444444-0000-0000-0000-000000000001', 's', 123456); raise exception 'FALHOU: mesma conversa ligada duas vezes';
  exception when unique_violation then raise notice 'ok - uma conversa do Telegram liga a uma pessoa só'; end;
end $$;

set role anon;
do $$ begin
  begin perform public.ninho_telegram_link_code('44444444-0000-0000-0000-000000000001', 'g'); raise exception 'FALHOU: anon gerou código';
  exception when insufficient_privilege then raise notice 'ok - anon não gera código do Telegram'; end;
end $$;
reset role;
select pg_temp.ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'telegram_links'), 'vínculos do Telegram no Realtime');
