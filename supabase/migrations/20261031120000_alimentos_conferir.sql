-- ══════════════════════════════════════════════════════════════════════
-- Ninho · 032 · Alimentos "para conferir" (Meu dia › Alimentação)
--
-- personal_foods.review: o que falta conferir num alimento importado de uma
--   planilha (ex.: "Marca e sabor alteram calorias"). Vazio = conferido.
--   Some quando a pessoa confere o rótulo (foto ou à mão) e salva.
--
-- Só acrescenta uma coluna opcional; nenhum dado muda.
-- Não destrutiva. Pode ser executada mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

alter table public.personal_foods add column if not exists review text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.personal_foods'::regclass and conname = 'personal_foods_review_len') then
    alter table public.personal_foods add constraint personal_foods_review_len check (review is null or length(review) between 1 and 200);
  end if;
end $$;

notify pgrst, 'reload schema';
