# Melhorias 12: despensa com validade, jantar das duas e balanço da semana

Branch: `melhorias-12`, feita a partir da `sugestoes`. **Sem merge automático.**

## 1. 🥫 Despensa (Casa › Despensa)
- **Guardar um item:** o quê, onde fica e, se quiser, quantidade e validade.
  - **Onde fica:** Geladeira, Freezer, Despensa, Banheiro, Limpeza ou Outros. O app já sugere o lugar pelo nome (iogurte → geladeira, shampoo → banheiro).
- **⏰ Usar logo:** o que venceu, vence hoje ou em até 3 dias fica no topo. Aparece também no **Início** e no **bom dia do Telegram**.
- **📥 Da última compra:** o que vocês compraram nos últimos 3 dias (pela lista de compras finalizada) entra na despensa com um toque.
- **Acabou → 🛒:** tira da despensa e põe na lista de compras, sem duplicar. **✕** só tira (usou ou jogou fora).
- **Quem vê:** é da casa; as duas veem e editam, em tempo real.

## 2. 🍲 Jantar das duas (Casa › Jantar)
- **A semana:** de segunda a domingo, com ‹ › para as outras semanas. Cada dia tem o prato e **quem cozinha**: Gi, Sá, as duas, ou a combinar.
- **Com receita:** escolha uma das receitas (as suas e as que a outra compartilhou) e os ingredientes vêm juntos. Fica uma cópia, então a outra vê mesmo que a receita seja privada.
- **🛒 Ingredientes da semana:** junta os ingredientes dos jantares de hoje em diante, somando as quantidades (500 g + 600 g de frango = 1,1 kg), e manda para a lista de compras.
- **No dia:** o jantar de hoje e quem cozinha aparecem no **Início** e no **bom dia do Telegram**.

## 3. ⚖️ Balanço da semana (Nós › Semana)
- **O que mostra**, nesta semana (até hoje) e na passada, para cada uma:
  - **esforço:** tarefa leve 1, média 2, pesada 3; rotina dos cães 1; cozinhar o jantar 2;
  - quantas coisas fez;
  - quantas vezes cozinhou;
  - horas de compromisso.
- **A frase:** uma barra e uma frase sem placar, por exemplo "Giovanna 58% · Sabrina 42% do esforço. A Giovanna puxou mais (a Sabrina teve 6 h de compromissos)…".
- **Compensação automática:** quem fez mais na semana passada recebe um pouco menos do **rodízio** nesta. A semana passada conta 25%, além da semana atual, que já contava. Tarefas fixas e a escala dos cães não mudam.
- **Telegram:** o resumo de domingo traz a linha do balanço.

## 4. 📦 Tarefas que vocês já tiveram (Casa › 💡 Sugestões)
- **O que aparece:** as tarefas arquivadas que não têm outra ativa com o mesmo nome, na seção **📦 Vocês já tiveram**, com dias e quem fazia.
- **↩ Trazer de volta:** devolve a tarefa à rotina **como era**.
- **Se a arquivada também está no catálogo** (ex.: "Organizar geladeira"), o botão dela vira "↩ Trazer de volta" no lugar de "+ Adicionar", para não criar uma repetida.
- **"Repor ração dos cães"** entrou no catálogo (Compras e planejamento).

## Migration 038: `supabase/migrations/20261106120000_despensa_jantar.sql`
- **`pantry_items`:**
  - **Campos:** nome, lugar, quantidade, validade e ativo.
  - **Regra de acesso:** da casa (`household_member`).
  - **Tempo real:** ligado.
- **`house_meals`:**
  - **Campos:** data, refeição (jantar), prato, quem cozinha, receita e ingredientes (cópia, até 40).
  - **Unicidade:** um por dia.
  - **Regra de acesso:** da casa.
  - **Tempo real:** ligado.
- **Já registradas** na 011, no rollback e na pós-checagem.
- **Não destrutiva. Pode rodar mais de uma vez.**
- **Sem a migration** (testado): as abas Despensa e Jantar não aparecem, o bom dia segue normal e o balanço funciona (sem a cozinha).

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run.
3. **Conferência:**
   ```sql
   select count(*) as regras from pg_policies where tablename in ('pantry_items', 'house_meals') and policyname = 'household_member';
   ```
   O esperado é `2`.

## Testes
- **Unitários:** `tests/melhorias12.test.ts` (9). Cobrem:
  - validade e frases;
  - organização por lugar e "usar logo";
  - lugar pelo nome;
  - da última compra;
  - semana do jantar;
  - ingredientes somados;
  - quem cozinhou;
  - balanço com esforço, cozinha e compromissos;
  - semana passada;
  - frase;
  - compensação no rodízio.
- **Banco:** `supabase/tests/99t-despensa-jantar.test.sql`, nos 3 cenários. Cobre:
  - regra da casa;
  - um jantar por dia;
  - valores conferidos;
  - a outra da casa vê e edita;
  - outra casa não vê nem grava.
- **Ponta a ponta:** r38 (e r37 com o "trazer de volta").
- **Regressão (r1–r38):** 38/38 OK. Depois das últimas mudanças (tarefas arquivadas e contraste), rodaram de novo o r38, o r37, o r1, o r12 e o r27, todos OK.
