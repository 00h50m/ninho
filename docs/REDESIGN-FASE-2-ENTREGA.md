# Redesign · Fase 2: configuração inicial (onboarding)

Branch: `redesign-fase-2` (a partir da `main` 69de102). **Sem merge automático.**

## O que já existia
- Os nomes das duas e dos cães (`profiles`, `dogs`).
- Tarefas com a marca "essencial".
- Rotinas dos cães (`dog_routines`).
- Dois temas (Aconchego e Noturno), escolhidos no aparelho.
- A pessoa do aparelho, definida pela conta (login da Fase 6).

## O que foi criado

### Configuração em 9 etapas (`components/onboarding/Onboarding.tsx`)
1. **Boas-vindas:** tarefas, rotinas, cães, energia, planejamento e divisão justa. Tem o botão "Pular por agora".
2. **Quem faz parte:** confirmar ou editar o nome das duas e dos cães, e adicionar cão. Não cria conta.
3. **Este aparelho:** mostra a pessoa da conta conectada e para que isso serve.
4. **O que pesa:** até 3 de 9 opções.
5. **A semana:** dias mais pesados e períodos livres de cada uma, dia do planejamento e energia típica.
6. **Essenciais:** mostra as tarefas que já existem e combinam com cada escolha. Medicação só aparece se houver algo cadastrado.
7. **Primeiras rotinas:** 8 modelos, já marcados conforme a etapa 4.
   - Dá para personalizar nome, horário, duração, dias, quem faz (as duas, rodízio, Giovanna ou Sabrina) e os passos.
   - 🛡 marca o passo que continua no modo sobrevivência.
8. **Aparência:** 5 temas com prévia real do painel.
9. **Resumo:** integrantes, rotinas, essenciais, disponibilidade, tema e primeiro desafio sugerido. Nada é criado antes de "Confirmar e criar".

### Comportamento
- **Quando abre sozinha:** só se a casa ainda não tem configuração e a pessoa não pausou nem pulou.
- **Rascunho:** fica guardado a cada mudança. "Continuar depois" fecha, e o Início mostra "você parou na etapa X". Voltar e avançar não perdem respostas.
- **Refazer:** em Ajustes, "Refazer configuração". Rotinas que já existem aparecem como "já existe" e não são duplicadas.
- **Depois de concluir:** a outra pessoa não vê a configuração abrir sozinha.

### Rotinas com passos e temas
- **Rotinas com passos (cadastro):** a área Rotinas mostra os cartões com horário, dias, duração, responsável, essencial e passos. Rotina é uma tabela própria, separada de tarefa. O checklist do dia a dia chega na fase 4.
- **Temas novos:** Ninho Natureza (claro, sálvia e musgo), Ninho Aurora (escuro, azul e lilás) e Ninho Minimal (claro, branco e grafite). São só variáveis em `styles/tokens.css`, sem CSS duplicado.

## O que foi alterado
- **`NinhoApp`:**
  - carrega a configuração e as rotinas;
  - abre a configuração quando é a primeira vez;
  - mostra o convite no Início;
  - mostra o cartão em Ajustes;
  - lista as rotinas em Rotinas.
- **`lib/theme.ts`:** 5 temas, e o script inicial conhece todos.
- **`lib/errors.ts`:** `isMissingTable`. Sem a migration aplicada, o app segue como antes, sem a configuração.
- **`011` e o rollback da 011:** passam a incluir as tabelas novas, caso sejam rodados de novo.
- **Pós-checagem:** confere as colunas, a função e o Realtime da 014.

## Migration 014 — `supabase/migrations/20261013120000_onboarding_rotinas.sql`
- **Tabelas novas:**
  - `household_setup`: a configuração da casa;
  - `onboarding_progress`: o rascunho de cada pessoa;
  - `routines`: as rotinas;
  - `routine_steps`: os passos de cada rotina.
- **Segurança por casa:** se a 011 já foi aplicada, as tabelas nascem com a regra "só quem é da casa".
- **`ninho_finish_onboarding`:** aplica tudo numa transação só.
  - Uma rotina por modelo por casa (índice único), então não duplica.
  - Cão novo com nome repetido é ignorado.
  - Só marca como essenciais tarefas desta casa.
  - Quem concluiu vem da conta, não do aparelho.
- **Realtime:** inclui `household_setup`, `routines` e `routine_steps`.
- **Não apaga nada** e pode rodar mais de uma vez.

### Procedimento (Supabase de produção)
1. **Backup:** SQL Editor → rode `supabase/scripts/export-data-json.sql` e salve o resultado (veja `docs/BACKUP-RESTORE.md`).
2. **Migration:** SQL Editor → cole e rode `supabase/migrations/20261013120000_onboarding_rotinas.sql`.
3. **Conferência:** rode `supabase/scripts/post-migration-check.sql`. Devem aparecer como ok:
   - `coluna household_setup.answers`
   - `função ninho_finish_onboarding`
   - `realtime routines`

A ordem entre app e migration não importa: sem a 014, o app novo funciona sem a configuração.

## Testes
- **Typecheck:** ok.
- **Unitários:** 156/156. Novos: `tests/onboarding.test.ts` (11) e `tests/design.test.ts`, agora com os 5 temas e o script inicial executado de verdade.
- **Banco** (`supabase/tests/90-onboarding.test.sql`), nos 3 cenários (novo, legado e schema real de produção), com a segurança por casa ativa:
  - cria as rotinas, os passos e o cão novo;
  - grava os nomes;
  - torna essencial só a tarefa da própria casa;
  - concluir duas vezes não duplica;
  - outra casa não vê nem configura;
  - sem login não executa.
- **Build:** ok.
- **Ponta a ponta** (modo produção, login real, 011 ativa): **todas as verificações ok**:
  - abre sozinha no primeiro uso;
  - validações de cada etapa;
  - "Continuar depois" guarda a etapa 7 no banco, não reabre sozinha e o Início oferece continuar;
  - retoma com a personalização;
  - voltar mantém as respostas;
  - o tema muda na hora com prévia;
  - o resumo está completo;
  - nada é criado antes de confirmar;
  - as rotinas são gravadas com a personalização;
  - o nome editado é gravado;
  - a tarefa vira essencial;
  - nenhuma tarefa é apagada;
  - refazer não duplica;
  - a Sabrina não vê a configuração abrir e vê as rotinas;
  - no celular, nenhuma etapa rola para o lado;
  - "Pular por agora" não reabre;
  - nenhum erro de página.
- **Regressão da Fase 1:** ok, com a casa já configurada.

## Divergências e decisões
- **Etapa 3:** com o login, a pessoa do aparelho é a da conta. A etapa mostra isso em vez de deixar trocar.
- **Temas Natureza, Aurora e Minimal:** entraram agora porque a etapa 8 pede os 5. A fase 9 continua com contraste, tamanho da interface e decisão de tema por casa ou aparelho.
- **Rotinas:** o banco de rotinas com passos foi criado agora, porque a etapa 7 precisa salvar. O checklist (concluir passos, histórico, rodízio do dia) fica para a fase 4.
- **Primeiro desafio:** só sugerido e guardado. Os desafios chegam na fase 8.

## Riscos
- **Abre para as duas:** depois da migration, a configuração abre sozinha uma vez para cada uma, porque a casa ainda não tem configuração. Basta tocar em "Pular por agora".
- **A prévia usa o banco de produção:** concluir a configuração na prévia cria as rotinas de verdade.

## Como desfazer
- **App:** não mesclar a branch, ou `git revert`.
- **Banco (opcional):** `supabase/scripts/rollback-onboarding.sql`.
  - Apaga só a configuração, os rascunhos e as rotinas com passos.
  - Não mexe em tarefas, cães, nomes nem XP.
  - Faça o backup antes.
