# Notificações e modo sem internet

Branch: `notificacoes`, feita a partir da `redesign-fase-8`. **Sem merge automático.**

## Lembretes com o app fechado
Cada aparelho escolhe o que quer receber, em **Ajustes › App e notificações**. Cada lembrete vai só para a pessoa certa.

| Lembrete | Quando | Para quem |
|---|---|---|
| 💊 Remédios e vitaminas | No horário de cada dose, se ainda não marcou | A dona do remédio |
| 🔁 Rotinas | No horário da rotina, se ainda não foi feita | Quem é responsável (dividida → as duas) |
| ⏱ Fim do sprint | Quando o tempo acaba | Quem está no sprint |
| 🐾 Saúde dos cães | Véspera e dia, às 9h (vacina, vermífugo, consulta…) | As duas |
| 📅 Agenda da casa | 1 hora antes (sem horário: 8h30); vencimento pendente na véspera (19h) e no dia (9h) | Quem foi marcada |
| 🤝 Desafio em dupla | Às 21h, se o dia ainda não foi marcado | As duas |
| 💧 Água (começa desligado) | 11h, 15h e 19h, se estiver abaixo do esperado | Cada uma |
| 💬 Check-in (começa desligado) | 21h30, se ainda não fez | Quem falta |

- **Horário de silêncio:** começa em 22h–7h e cada aparelho pode mudar. Nesse intervalo nenhum lembrete é enviado. O bom dia e o resumo de domingo seguem no horário deles.
- **Sem repetir:** cada lembrete sai uma vez só. Chamar o agendador de novo não manda nada repetido.
- **Abre a tela certa:** tocar na notificação leva ao Meu dia, às Rotinas, ao sprint aberto, aos Cães, à Agenda, aos Desafios ou ao check-in.
- **Resumo de domingo sem placar e sem aposta:** agora é "Juntas, vocês fizeram N conclusões…" e termina com o convite para a reunião, combinando com a Fase 8.

### O agendador (precisa ser ligado uma vez)
O plano gratuito da Vercel só agenda tarefas uma vez por dia. Por isso o relógio dos lembretes fica no **Supabase**: o `pg_cron` chama o app a cada 5 minutos.
- **Script:** `supabase/scripts/agendar-lembretes.sql`. Antes de rodar, troque o endereço do app e o `CRON_SECRET` (o mesmo da Vercel).
- **Segredo:** fica guardado no cofre do Supabase (Vault). Não vai para o repositório.
- **Atraso:** um lembrete pode chegar até 5 minutos depois do horário.
- **Só em produção:** os lembretes funcionam no app publicado (produção), porque o agendador chama o endereço de produção.
- **Para parar:** `select cron.unschedule('ninho-lembretes');`

## Sem internet: fila de ações
Antes, sem internet o app mostrava os últimos dados, mas marcar dava erro. Agora estas ações ficam **guardadas no aparelho** e são enviadas sozinhas quando a conexão volta:
- concluir ou desmarcar **tarefa**;
- **rotina dos cães** (ração, passeio…);
- **+1 copo**, autocuidado e dose de remédio do Meu dia.

Um aviso mostra quantas ações estão guardadas, com o botão "Enviar agora". Marcar e desmarcar a mesma coisa sem internet se anulam. Nada é enviado duas vezes: tarefa e rotina são por dia, e a água tem um identificador fixo.

## Migration 023 — `supabase/migrations/20261022120000_lembretes.sql`
- **`push_subscriptions`:** `reminders` (o que o aparelho quer receber), `quiet_start` e `quiet_end`.
- **`push_log`:** aceita o tipo `reminder`, com uma referência (ex.: remédio X às 08:00). Um lembrete sai uma vez por dia por referência. O bom dia e o domingo continuam uma vez por dia, como antes.
- **Termina com `notify pgrst, 'reload schema'`.**
- **Não apaga nada:** troca só a regra de tipos e o índice de "uma vez por dia", e pode rodar mais de uma vez.

### Procedimento (Supabase de produção)
1. **Backup:** como nas fases anteriores.
2. **Migration 023:** SQL Editor → aba nova → cole o arquivo inteiro (a primeira linha começa com `-- ═══`) → Run.
3. **Conferência:**
   ```sql
   select (select count(*) from information_schema.columns where table_name = 'push_subscriptions' and column_name in ('reminders','quiet_start','quiet_end')) as colunas,
          (select count(*) from pg_indexes where indexname = 'push_log_reminder_once') as indice;
   ```
   O esperado é `3 | 1`.
4. **Depois do merge** (o app novo publicado), rode `agendar-lembretes.sql` uma vez, com o endereço e o `CRON_SECRET` trocados. A última linha deve mostrar `ninho-lembretes | */5 * * * * | true`.

Sem a 023, nada muda: o bom dia e o domingo continuam como antes, e a rota de lembretes responde "migration 023 ainda não aplicada".

## Testes
- **Unitários:** 226/226. Novos:
  - `tests/reminders.test.ts` (11): janela de horário, silêncio atravessando a meia-noite, e cada tipo de lembrete (para quem e quando) por aparelho;
  - `tests/outbox.test.ts` (4): fila, anulação, ordem, parar sem internet e descartar o que o banco recusa.
- **Banco** (`supabase/tests/99e-lembretes.test.sql`), nos 3 cenários:
  - padrões;
  - horário válido;
  - vários lembretes por dia, mas o mesmo não repete;
  - lembrete precisa de referência;
  - bom dia continua um por dia.
- **Ponta a ponta** (Web Push real, criptografado, para um receptor local): **todas ok**:
  - 5 lembretes certos (remédio, rotina, fim do sprint, visita 1 h antes), cada um para a pessoa certa;
  - remédio já tomado não avisa;
  - chamar de novo não repete;
  - preferência desligada e silêncio bloqueiam;
  - Ajustes com as 8 chaves e o silêncio gravando;
  - links `?ir=` abrindo Meu dia, Desafios, sprint, Agenda e Cães;
  - sem internet: tarefa e +1 copo na fila, enviados uma vez quando a conexão volta.
- **Regressão das Fases 1 a 8 e do Meu dia (r1–r10):** todas ok.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Agendador:** `select cron.unschedule('ninho-lembretes');`
- **Banco:** as colunas novas podem ficar, porque não atrapalham nada.
