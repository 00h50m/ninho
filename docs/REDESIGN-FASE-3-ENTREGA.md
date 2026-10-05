# Redesign · Fase 3: novo Início

Branch: `redesign-fase-3` (a partir da `main` 469e65a). **Sem merge automático.**

## O que já existia
- Saudação e data.
- 4 cartões: Hoje, Casa, Nível e Sequência.
- Faixa de modo sobrevivência e de energia baixa.
- Colunas das duas, agrupadas em atrasadas, manhã, tarde, noite, qualquer hora e período.
- Cartão dos cães, com progresso, próxima rotina e acidentes da filhote.
- Manutenção, compras, placar e atalhos.

## O que foi criado
- **Cabeçalho:**
  - saudação com o nome de quem usa;
  - chips de conta, energia da semana (toque para mudar) e modo normal ou sobrevivência (toque para alternar).
- **5º cartão, desafio:** o primeiro desafio sugerido na configuração. Os desafios de verdade chegam na fase 8.
- **A semana** (`components/inicio/WeekStrip.tsx`), 7 dias com dados reais:
  - conclusões do dia (tarefas e rotinas dos cães, com a mesma rotina dos dois cães contando uma vez);
  - humor das duas;
  - energia do dia (a menor dos check-ins);
  - 🛡 nos dias em modo sobrevivência;
  - "—" nos dias sem registro, hoje destacado e dias futuros apagados.
- **Para agora:** resumo de quem usa o aparelho, com atrasadas, essenciais pendentes e a próxima com horário.
- **Check-in** (`components/inicio/CheckinCard.tsx`):
  - humor em 5 opções com nome (Ótimo, Bem, Normal, Cansaço, Pesado), energia e observação opcional;
  - cada uma registra o seu e vê o da outra, em tempo real;
  - nada é obrigatório.
- **Rotina agora / próxima** (`components/inicio/RoutineNowCard.tsx`): passos, duração, quem faz (no rodízio, de quem é a vez) e a seguinte.
- **Cães:** "cuidados próximos", que são as manutenções da categoria Cães nos próximos 14 dias.
- **Ações rápidas:** + Iniciar rotina, Cuidado dos cães e Check-in do dia, num total de 9.

## O que foi alterado
- **Placar:** saiu do Início e continua em Nós, como combinado. Na fase 8 vira meta conjunta.
- **Sequência:** passou a se chamar "Sequência do casal".

## Migration 015 — `supabase/migrations/20261014120000_checkin_dia.sql`
- **`daily_checkins`:** uma linha por pessoa por dia.
- **`household_days`:** marca o dia em que o modo sobrevivência esteve ativo.
- **`ninho_checkin`:**
  - grava sempre como a pessoa da conta, então não dá para registrar pela outra;
  - aceita só os últimos 7 dias;
  - campo vazio mantém o que já existia.
- **Segurança por casa** e **Realtime** nas duas tabelas.
- **Não apaga nada** e pode rodar mais de uma vez.

### Procedimento (Supabase de produção)
1. **Backup** (opcional, a migration só acrescenta): `supabase/scripts/export-data-json.sql`.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run, sem nada selecionado.
3. **Conferência:**
   ```sql
   select to_regclass('public.daily_checkins') is not null as checkin,
          to_regclass('public.household_days') is not null as dias,
          to_regprocedure('public.ninho_checkin(uuid,date,text,text,text,text)') is not null as funcao,
          (select count(*) from pg_policies where tablename in ('daily_checkins','household_days') and policyname = 'household_member') as regras;
   ```
   O esperado é `true | true | true | 2`.

Sem a 015, o Início funciona normalmente, só sem a semana e sem o check-in.

## Testes
- **Typecheck:** ok.
- **Unitários:** 163/163. Novo: `tests/week.test.ts` (7), cobrindo:
  - conclusões por dia;
  - semana com humor, energia, sobrevivência e dias sem registro;
  - rotina agora e próxima pelos dias da semana;
  - Para agora;
  - cuidados dos cães.
- **Banco** (`supabase/tests/95-checkin.test.sql`), nos 3 cenários:
  - grava como a conta;
  - atualiza só o que veio;
  - uma linha por dia;
  - recusa data antiga e humor inválido;
  - outra casa não vê;
  - sem login não executa.
- **Build:** ok.
- **Ponta a ponta** (relógio fixo na terça, login real, 011 ativa): **todas ok**:
  - cabeçalho e 5 cartões;
  - a semana com os dados de segunda (conclusões, humor da Sabrina, energia baixa e 🛡);
  - Para agora;
  - rotina agora, com passos e rodízio, e a seguinte;
  - cuidados dos cães;
  - check-in gravado e refletido na semana;
  - a Sabrina vê o check-in da Giovanna;
  - ativar o modo sobrevivência marca o dia;
  - concluir registra quem fez;
  - celular e tablet sem rolagem lateral;
  - nenhum erro de página.
- **Regressão das Fases 1 e 2:** ok.

## Riscos
- **Número de conclusões:** conta os registros reais. Por isso pode ser diferente do "x/y" de hoje, que conta só o que estava previsto.
- **Dias anteriores à 015:** antes da migration não há registro do modo sobrevivência por dia. Esses dias não mostram o 🛡.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco (opcional):**
  ```sql
  drop function if exists public.ninho_checkin(uuid,date,text,text,text,text);
  drop table if exists public.daily_checkins;
  drop table if exists public.household_days;
  ```
  Apaga só os check-ins.
