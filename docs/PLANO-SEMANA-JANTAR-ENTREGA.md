# D3: plano da semana e jantar → lista de compras

## Plano da semana

**O que entra:**
- tarefas semanais e quinzenais ainda não feitas no período;
- tarefas mensais, só quando o mês acaba até a semana seguinte, para não empurrar a mensal toda semana.

Diárias e pontuais ficam de fora.

**Como distribui:** das mais pesadas para as mais leves, cada tarefa vai para o dia permitido de menor custo. O custo soma:
- compromissos da agenda no dia (×2);
- o que a mesma pessoa já tem planejado no dia (×3);
- +6 se já houver uma tarefa pesada dela no dia.

Também respeita os dias da semana de cada tarefa e nunca volta no tempo.

**Que semana:** no domingo, o plano é da próxima semana. Nos outros dias, vai de hoje até domingo.

**Onde aparece:**
- **Início:** cartão "🗓 Plano desta semana" de domingo a terça, enquanto não houver plano aprovado. Tem "Agora não", que vale por semana e por aparelho.
- **Casa › Tarefas:** botão "🗓 Planejar a semana" sempre que há o que planejar. Depois de aprovado, dá para trocar o dia e salvar de novo.
- **Telegram:** o resumo de domingo traz o plano por dia e o botão **✓ Aprovar plano**.

**Depois de aprovado:**
- A tarefa continua valendo a semana toda e mostra "📅 qua" na linha.
- No dia planejado, ela sobe para **"Hoje, a qualquer hora"**.

## Jantar → lista de compras

- **Ao salvar um jantar** de hoje até 7 dias, o que falta vai sozinho para a lista de compras.
- **O que fica de fora:** o que já está na despensa (mesma comida e sem vencer antes do jantar).
- **No editor:** a opção "🛒 Mandar o que falta para a lista de compras" vem marcada e mostra "2 para comprar · já na despensa: Peito de frango".
- **O aviso** traz **Desfazer**, que tira da lista só o que foi criado agora e ainda não foi riscado.
- **"Ingredientes da semana"** também deixa de fora o que já tem na despensa.

## Migration 045 (rodar no Supabase)

- **Tabela:** `supabase/migrations/20261113120000_plano_semana.sql` cria `week_plan`, com um dia por tarefa por semana. A semana começa na segunda, e o dia precisa cair dentro dela.
- **Segurança:** regra por casa, tempo real e backup automático.
- **É segura:** não destrutiva e pode rodar mais de uma vez.
- **Sem a migration:** o app continua funcionando, mas o plano não é salvo.
- **Arquivo único** para o SQL Editor: 044 + 045 juntas, com conferência (deve mostrar **6**).

## Arquivos

- **Lógica pura:** `lib/planoSemana.ts` (testado em `tests/planoSemana.test.ts`). Em `lib/jantar.ts`, `splitByPantry` e `shopsNow` (testados em `tests/jantarCompras.test.ts`).
- **Servidor:** `lib/server/planoSemana.ts`, usado pelo Telegram para montar e aprovar o plano.
- **Tela:** `components/inicio/PlanoSemana.tsx`.
- **Dados:** `lib/build.ts` (`planned_on` e `plans`), `lib/today.ts` (tarefa no dia planejado entra em "hoje"), `lib/services/ninho.ts` (`loadWeekPlans` e `saveWeekPlan`).
- **Compras:** `lib/services/despensaJantar.ts` (`addToShopping` e `undoShopping`).
- **Guia e "O que mudou":** versão `2026-11c`, com as novidades da D1, D2 e D3.

## Testes

- **Unitários:** `npm test`.
- **Banco:** `supabase/tests/99zz-plano-semana.test.sql`, nos 3 cenários.
- **Ponta a ponta r57:**
  - plano: no Início, em Casa, ajustar e aprovar, 📅 e "Hoje", Telegram e axe;
  - jantar: a opção marcada, o que comprar e o que já tem, só o que falta na lista e Desfazer.
- **Regressão completa:** r1–r57.
