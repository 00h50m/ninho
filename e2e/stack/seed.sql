-- SÓ PARA TESTE LOCAL. Dados fictícios da casa de teste (nada real).
-- Senhas em texto para o gateway de teste (gateway.js); a coluna só existe aqui.
alter table auth.users add column if not exists encrypted_password text;

insert into public.households (id, name) values ('11111111-1111-1111-1111-111111111111', 'Casa de teste') on conflict (id) do nothing;
insert into auth.users (id, email, encrypted_password) values
  ('00000000-0000-0000-0000-00000000c0c1', 'giovanna@ninho.test', 'senha-gio-123'),
  ('00000000-0000-0000-0000-00000000c0c2', 'sabrina@ninho.test', 'senha-sabi-123')
on conflict (id) do update set encrypted_password = excluded.encrypted_password;
select public.ninho_link_member('giovanna@ninho.test', 'g', '11111111-1111-1111-1111-111111111111');
select public.ninho_link_member('sabrina@ninho.test', 's', '11111111-1111-1111-1111-111111111111');
update public.profiles set display_name = case role when 'g' then 'Giovanna' else 'Sabrina' end where household_id = '11111111-1111-1111-1111-111111111111';

-- cães com a ração de manhã e de noite
insert into public.dogs (id, household_id, name) values
  ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Penélope'),
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Zelda')
on conflict (id) do nothing;
insert into public.dog_routines (dog_id, household_id, title, frequency, scheduled_time)
select d.id, d.household_id, r.title, 'daily', r.t from public.dogs d,
  (values ('Ração manhã', '07:00'), ('Ração noite', '23:59')) as r(title, t)
where d.household_id = '11111111-1111-1111-1111-111111111111'
  and not exists (select 1 from public.dog_routines x where x.dog_id = d.id and x.title = r.title);

-- algumas tarefas de casa
insert into public.tasks (household_id, title, category, frequency, assigned_to, essential, scheduled_time, weight)
select '11111111-1111-1111-1111-111111111111', t.title, t.cat, t.freq, t.who, t.ess, t.tm, t.w
from (values
  ('Louça diária', 'kitchen', 'daily', 'g', true, null, 'medium'),
  ('Reset da sala', 'general', 'daily', 'g', false, '23:30', 'light'),
  ('Regar plantas', 'general', 'daily', 's', false, '23:50', 'light'),
  ('Limpar banheiro', 'bathroom', 'weekly', null, false, null, 'heavy'),
  ('Aspirar a casa', 'general', 'weekly', null, false, null, 'medium')
) as t(title, cat, freq, who, ess, tm, w)
where not exists (select 1 from public.tasks x where x.household_id = '11111111-1111-1111-1111-111111111111' and x.title = t.title);

-- a casa de teste é como a de vocês: IA, Sobrou e pets ligados (046; só quem administra o banco liga)
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'households' and column_name = 'features') then
    update public.households set features = '{"ia": true, "sobrou": true, "pets": true}' where id = '11111111-1111-1111-1111-111111111111';
  end if;
end $$;
