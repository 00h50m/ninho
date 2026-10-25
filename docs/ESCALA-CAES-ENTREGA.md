# Escala fixa dos cães

Branch: `escala-caes`, feita a partir da `main` (47d7c25). **Sem merge automático.**

## Como funciona (Cães › 📅 Quem cuida dos cães)
Há duas formas de dividir as rotinas dos cães, e vocês escolhem com um toque:
- **↻ Alternada:** como sempre. As rotinas alternam sozinhas entre vocês, equilibrando com o resto da semana.
- **📅 Escala fixa:** uma grade de 7 dias × 3 períodos.
  - **Períodos:** manhã até 11h59, tarde das 12h às 17h59, noite a partir das 18h.
  - **Toque no turno para trocar:** ↻ alternando → Giovanna → Sabrina → ↻.
  - **Turno em branco** continua alternando.
  - **O cartão mostra:** quantos turnos cada uma tem na semana e quais rotinas caem em cada período.

**Regras:**
- **A escala fica guardada** mesmo na alternada. Dá para trocar de uma para a outra quando quiserem.
- **O período vem do horário da rotina.** Rotina sem horário (água, enriquecimento) e rotinas que não são diárias (banho, escovação) continuam alternando.
- **Os dois cães no mesmo turno** ficam com a mesma pessoa.
- **Compromisso da Agenda no turno da escala** só **avisa** (⚠). A dona da escala não muda sozinha, como uma tarefa fixa.
- **O "por que é minha vez?"** explica: "Escala dos cães: segunda de manhã é da Giovanna".
- **Mesma conta em todo lugar:** app, Telegram (/hoje, bom dia, IA) e notificações.

## Migration 037: `supabase/migrations/20261105120000_escala_caes.sql`
- **`households.dog_mode`:** `rodizio` (padrão) ou `escala`.
- **`dog_schedule`:** dia (0 = domingo … 6 = sábado) × período (`manha`, `tarde`, `noite`) → `g` ou `s`.
  - Um por turno.
  - Regra de acesso da casa (`household_member`): as duas veem e editam.
  - Tempo real.
  - Já registrada na 011, no rollback e na pós-checagem.
- **Não destrutiva. Pode rodar mais de uma vez.**
- **Sem a migration** (testado): o cartão avisa "migration 037" e tudo segue no rodízio.

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run.
3. **Conferência:**
   ```sql
   select (select count(*) from information_schema.columns where table_name = 'households' and column_name = 'dog_mode') as modo,
          (select count(*) from pg_policies where tablename = 'dog_schedule') as escala;
   ```
   O esperado é `1 | 1`.

## Testes
- **Unitários:** `tests/escala.test.ts` (6), com dados fictícios. Cobrem:
  - período pelo horário;
  - dona só no modo escala e no turno marcado;
  - contagem, toque e leitura do banco;
  - os dois cães no mesmo turno;
  - motivo da vez;
  - compromisso avisa e não troca;
  - alternada igual a antes.
- **Banco:** `supabase/tests/99s-escala-caes.test.sql`, nos 3 cenários. Cobre:
  - rodízio por padrão;
  - um turno por dia e período;
  - dia, período e modo conferidos;
  - a outra da casa vê e edita;
  - outra casa não vê nem grava.
- **Ponta a ponta:** r36. Cobre:
  - montar a escala na tela;
  - Telegram seguindo a escala;
  - voltar para a alternada com a escala guardada;
  - axe;
  - funcionamento sem a migration.
- **Regressão (r1–r36):** 36/36 OK.
