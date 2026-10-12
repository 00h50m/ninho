# Meus alimentos: importar planilha, "⚠ conferir" e foto do rótulo

Branch: `alimentos-rotulo`, feita a partir da `meudia-ux` (usa o cartão "Meus alimentos" visível). **Sem merge automático.**

## Como usar (Meu dia › Alimentação › Meus alimentos)
- **📄 Importar planilha:**
  - aceita CSV com vírgula ou ponto e vírgula, e decimal com ponto ou vírgula;
  - reconhece o catálogo da dieta (`nome`, `porcao`, `quantidade_por_porcao`, `unidade_medida`, `kcal_por_porcao`, `proteina_g_por_porcao`, `precisa_revisar`, `motivo_revisao`) e planilhas simples (nome, porção, gramas, kcal, proteína);
  - o arquivo é lido **no próprio aparelho**: não vai para servidor nem para a IA;
  - antes de gravar, mostra uma prévia: quantos são novos, quantos estão para conferir, quantos já existem (mesmo nome) e quais linhas têm problema (sem kcal, sem gramas), com o motivo;
  - nada é inventado: linha incompleta fica de fora e é explicada.
- **⚠ conferir:**
  - quem veio com `precisa_revisar = SIM` entra com os valores da planilha, o selo e o motivo;
  - o filtro **⚠ Para conferir (N)** mostra só esses;
  - em cada um, **📷 rótulo** (foto), **editar** ou **✓ conferido** (quando o valor já está certo);
  - ao salvar uma edição, o item fica conferido.
- **📷 Foto do rótulo:**
  - a IA copia só o que está escrito na tabela nutricional: porção, gramas, kcal, proteína, carboidrato e gordura;
  - o resultado preenche o formulário para conferir. **Nada é gravado sem tocar em Salvar.**
  - Num item "para conferir", o nome do item é mantido. Num alimento novo, o nome vem do rótulo.
  - Foto que não é de rótulo, ou que não dá para ler, é explicada e não preenche nada.
  - Se proteína + carboidrato + gordura passam do peso da porção, os macros são descartados e aparece o pedido de conferir à mão.
  - **A foto não fica guardada.** Limite de 40 fotos de rótulo por casa a cada 24 h (`ai_log`, kind `rotulo`).
- **Privacidade:** igual ao resto do Meu dia. A outra pessoa não vê nem marca os alimentos da dona.

## Migration 032: `supabase/migrations/20261031120000_alimentos_conferir.sql`
- **`personal_foods.review`:** texto opcional (1 a 200 caracteres). Vazio (`null`) significa conferido.
- **Só acrescenta uma coluna.** Os alimentos que já existem ficam como conferidos e nenhum dado muda.
- **Não destrutiva. Pode rodar mais de uma vez.**
- **Sem a migration:** Meus alimentos carrega e grava normalmente (importar, editar, foto do rótulo), só sem os selos "⚠ conferir". Testado.

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run.
3. **Conferência:**
   ```sql
   select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'personal_foods' and column_name = 'review') as coluna,
          (select count(*) from pg_constraint where conname = 'personal_foods_review_len') as regra;
   ```
   O esperado é `1 | 1`.

## Testes
- **Unitários:** `tests/foodCatalog.test.ts` (9), com planilhas e rótulos fictícios. Cobrem CSV com aspas e CRLF, catálogo da dieta, repetidos, ponto e vírgula com decimal em vírgula, colunas faltando e a validação do rótulo.
- **Banco:** `supabase/tests/99n-alimentos-conferir.test.sql`, nos 3 cenários (novo, legado e produção). Cobre coluna opcional, regra única, limite de tamanho, conferir, e a outra pessoa não marca.
- **Ponta a ponta:** r28 (importar com prévia, filtro, foto do rótulo de item para conferir, ✓ conferido, foto que não é rótulo, rótulo de alimento novo, celular com texto maior, Noturno, axe, privacidade e funcionamento sem a migration).
- **Regressão (r1–r28): 28/28 OK.**
