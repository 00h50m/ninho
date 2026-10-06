# Redesign · Fase 8: Nós (a área do casal)

Branch: `redesign-fase-8`, feita a partir da `meu-dia`, que ainda não foi mesclada. **Sem merge automático.**

## O que mudou
A tela Nós agora tem quatro abas.

### Semana
- **Juntas nesta semana:** tarefas, rotinas, hábitos e sprints da casa, o XP do casal e quantos dias seguidos as duas fizeram check-in. Tem um botão para a reunião.
- **Registro do dia:**
  - cada uma escreve "o que foi bom hoje", "do que eu precisei" e "agradeço à…";
  - vê o que a outra escreveu hoje;
  - o registro fica junto do check-in, sem apagar humor nem energia.
- **Combinados:** os da semana atual, ou os da passada se ainda não houver reunião, com ✓ de cumprido.
- **Desafios em dupla:** os que estão em andamento, com "Fizemos hoje".
- **Pauta da reunião:** um resumo do que aconteceu na semana.

### Desafios em dupla
Substituem o placar e a aposta. Ninguém ganha da outra: ou vocês conseguem juntas, ou tentam de novo.
- **Como o dia conta:**
  - **marcado no app** ("Fizemos hoje", e dá para marcar ontem até o fim do dia);
  - **rotina concluída** (ex.: fechar a cozinha);
  - **hábito registrado**;
  - **check-in das duas**;
  - **N tarefas no dia**;
  - **Sprint do Ninho**.
- **Configuração:** duração, meta (ex.: 5 de 7 dias), data de início e recompensa opcional (ex.: "pizza no sábado").
- **Resultado:** o app registra sozinho "Conseguimos juntas!" quando a meta é batida, ou "Não deu desta vez" quando não dá mais. Dá para encerrar ou apagar.
- **Sugestões prontas:** cozinha fechada, check-in das duas, 3 tarefas por dia, dois sprints, passeio dos cães e noite sem telas. O desafio sugerido na configuração também aparece.
- **No Início:** o quadro "Desafio" mostra o desafio em andamento (ex.: 3/7 dias · hoje ✓).

### Histórico
- **Como chegamos:** grade dos últimos 28 dias de cada uma, com o emoji do humor. Tocar num dia mostra humor, energia, observação e registro.
- **Registros:** a lista do que cada uma escreveu.
- **Mantidos:** as últimas 4 semanas, as sequências e as conquistas.
- **Linha do tempo do casal:** desafios conquistados, reuniões e sprints.

### Equilíbrio
Reúne a divisão da carga, a energia da semana, o modo sobrevivência e o nível do casal, que já existiam.

## Reunião semanal
- **Abre preenchida:** antes ela abria em branco mesmo com a reunião salva.
- **Pauta com os dados reais da semana:**
  - tarefas, rotinas, hábitos, sprints e pedidos de ajuda;
  - desafios em dupla;
  - como cada uma chegou (contagem de humores), do que precisou e o que agradeceu;
  - o que cada uma compartilha do Meu dia (água na meta, treinos);
  - o que vem por aí (agenda da casa e cuidados dos cães nas próximas 2 semanas);
  - combinados da semana passada, cumpridos ou não.
- **Combinados:** texto curto, para as duas ou para uma. Opcionalmente **viram tarefa** em Casa › Tarefas (pontual, para quem foi combinado).
- **Sugestões da IA:** continuam no mesmo lugar.

## O que saiu
- **Placar e aposta:** saíram da tela Nós, porque eram ranking competitivo. Os dados continuam no banco e nada foi apagado.
- **Componentes:** os do placar e da aposta foram removidos do app.

## Migration 022 — `supabase/migrations/20261021120000_nos.sql`
- **`daily_checkins`:** colunas `good`, `need` e `thanks` (até 280 caracteres).
- **`ninho_day_note`:** grava o registro sempre em nome da pessoa logada.
- **`weekly_meetings.agreements`:** lista de combinados (até 20).
- **`couple_challenges` e `challenge_marks`:** desafios e marcações. Um dia conta uma vez só.
- **Segurança e tempo real:** segurança por casa (já incluída na lista da 011) e Realtime.
- **Termina com `notify pgrst, 'reload schema'`:** o Supabase enxerga as tabelas novas na hora. Foi o que faltou no Meu dia.
- **Não apaga nada** e pode rodar mais de uma vez.

### Procedimento (Supabase de produção)
1. **Backup:** como nas fases anteriores.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro (a primeira linha começa com `-- ═══`) → Run, sem nada selecionado.
3. **Conferência:**
   ```sql
   select to_regclass('public.couple_challenges') is not null as desafios,
          (select count(*) from information_schema.columns where table_name = 'daily_checkins' and column_name in ('good','need','thanks')) as registro,
          to_regprocedure('public.ninho_day_note(uuid,date,text,text,text,text)') is not null as funcao,
          (select count(*) from pg_policies where tablename in ('couple_challenges','challenge_marks') and policyname = 'household_member') as seguranca;
   ```
   O esperado é `true | 3 | true | 2`.

Sem a 022, a tela Nós funciona com o que já existia e mostra um aviso no lugar das novidades.

## Testes
- **Unitários:** 211/211. Novo: `tests/nos.test.ts` (9), cobrindo:
  - como cada tipo de desafio conta o dia;
  - em andamento, conseguimos e não deu;
  - dá para marcar ontem;
  - grade de humor;
  - registros;
  - dias seguidos de check-in das duas;
  - pauta, com um teste que garante que não aparece "ganhou", "venceu" nem "placar";
  - linha do tempo.
- **Banco** (`supabase/tests/99d-nos.test.sql`), nos 3 cenários:
  - o registro grava na pessoa logada e não apaga o humor;
  - mudar o humor não apaga o registro;
  - limites de data e tamanho;
  - combinados só como lista;
  - um dia conta uma vez;
  - a meta não passa da duração;
  - as duas veem e encerram;
  - outra casa não vê nem cria;
  - sem login não vê.
- **Build:** ok.
- **Ponta a ponta** (login real, 011 ativa, Giovanna no computador e Sabrina no celular): **todas ok**:
  - desafio automático "check-in das duas" conseguido, e o de sprint sem sprint fica como "não deu";
  - registro do dia das duas;
  - combinado da semana passada marcado como cumprido;
  - criar desafio livre com recompensa, "Fizemos hoje" e 1/7;
  - desafio pela sugestão (3 tarefas por dia, 5 de 7);
  - pauta com casa, desafios, registros e combinados;
  - reunião com 2 combinados, um virando tarefa para a Sabrina, e reabrir preenchida;
  - Início com o desafio;
  - Sabrina vê o registro e os combinados, marca ontem, vê o histórico de humor e a linha do tempo;
  - nenhuma tela do celular com rolagem lateral;
  - nenhum erro de página.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco (opcional):** apaga só o que a 022 criou.
  ```sql
  drop table if exists public.challenge_marks, public.couple_challenges;
  drop function if exists public.ninho_day_note(uuid,date,text,text,text,text);
  alter table public.weekly_meetings drop column if exists agreements;
  alter table public.daily_checkins drop column if exists good, drop column if exists need, drop column if exists thanks;
  ```
