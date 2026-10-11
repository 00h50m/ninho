-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 028 · Fotos de evolução e arquivos grandes para a IA
--
-- personal_photos: fotos do corpo (frente, lado, costas) para comparar a
--   evolução. Reduzidas no celular antes de sair (~200 KB) e guardadas com
--   uma miniatura. Privadas: só a dona vê e grava; a outra só vê se a dona
--   compartilhar "fotos" (compartilhamento separado de "Evolução física").
-- ai_upload_parts: PDF grande (até 15 MB) chega em partes, porque a Vercel
--   só aceita pedidos de até ~4,5 MB. O servidor junta, manda para a IA e
--   apaga na hora. Só o servidor lê e grava; sobra antiga (1 h) é apagada.
--
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.personal_photos (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  who          text not null check (who in ('g','s')),
  date         date not null default public.ninho_today(),
  pose         text not null default 'frente' check (pose in ('frente','lado','costas','outra')),
  note         text check (note is null or length(note) <= 200),
  thumb        text not null check (length(thumb) between 100 and 80000),
  data         text not null check (length(data) between 100 and 2000000),
  created_at   timestamptz not null default now()
);
create index if not exists personal_photos_who on public.personal_photos (household_id, who, date desc);

create table if not exists public.ai_upload_parts (
  upload_id    uuid not null,
  idx          integer not null check (idx between 0 and 9),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null,
  data         text not null check (length(data) <= 3600000),
  created_at   timestamptz not null default now(),
  primary key (upload_id, idx)
);
create index if not exists ai_upload_parts_old on public.ai_upload_parts (created_at);

do $$
declare strict_rls boolean;
begin
  strict_rls := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'household_member')
                and to_regprocedure('public.ninho_is_member(uuid)') is not null;
  alter table public.personal_photos enable row level security;
  drop policy if exists "allow_all_auth" on public.personal_photos;
  drop policy if exists "personal_read" on public.personal_photos;
  drop policy if exists "personal_write" on public.personal_photos;
  if strict_rls then
    create policy "personal_read" on public.personal_photos for select to authenticated
      using (who = public.ninho_my_who(household_id) or (public.ninho_is_member(household_id) and public.ninho_personal_shared(household_id, who, 'fotos')));
    create policy "personal_write" on public.personal_photos for all to authenticated
      using (who = public.ninho_my_who(household_id)) with check (who = public.ninho_my_who(household_id));
  else
    create policy "allow_all_auth" on public.personal_photos for all to authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.personal_photos to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.personal_photos to service_role;
    grant all on public.ai_upload_parts to service_role;
  end if;
  -- partes de arquivo: RLS ligada e sem regras (o app não vê; só o servidor)
  alter table public.ai_upload_parts enable row level security;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.ai_upload_parts from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public.ai_upload_parts from authenticated; end if;
end $$;

notify pgrst, 'reload schema';
