# C3: lembrete no horário de costume

## O que mudou

- **Tarefas sem horário** agora ganham lembrete na hora em que a dona costuma fazê-las.
  - O Ninho aprende sozinho, pela hora em que cada uma marcou a tarefa como feita nas últimas 4 semanas.
  - **Conta só o que a própria pessoa fez.** Se hoje a tarefa é da Giovanna, vale o horário da Giovanna.
  - **Precisa de pelo menos 3 vezes**, num horário parecido: as vezes do meio cabem em 3 horas. Uma vez fora da curva, entre 5 ou mais, não atrapalha.
  - **Madrugada (00h–4h59) não conta**, porque costuma ser "marquei depois".
  - **O horário** é a mediana das vezes, arredondada para 5 minutos.
- **Para quem e quando:** o lembrete vai só para quem é a vez, só se a tarefa ainda não foi feita e uma vez por dia.
  - **Push:** novo tipo "🕰 Tarefas sem horário" em Ajustes › Notificações, ligado por padrão.
  - **Telegram:** vale quando "lembretes de tarefa" está ligado, com ✓ Feito e ⤼ Não deu.
- **Guia e "O que mudou":** atualizados com as novidades da C1, da C2 e da C3. O aviso aparece de novo uma vez em cada aparelho (versão `2026-11b`).

## Arquivos

- `lib/horario.ts` (`usualTime`, `localHM`): puro, testado em `tests/horario.test.ts`.
- `lib/reminders.ts`: o tipo `costume` e o lembrete.
- `lib/server/reminders.ts`: lê as conclusões das últimas 4 semanas (`task_completions.created_at`), só das tarefas sem horário ainda abertas hoje.
- `lib/server/tgExtras.ts`: envio pelo Telegram. O registro usa o tipo `tarefa` (a tabela de 041 só aceita noite/tarefa/atraso); a referência `costume:<id>` garante uma vez por dia.
- `components/Guia.tsx`.

## Sem migration

Nada para rodar no Supabase: usa a hora que cada conclusão já guarda.

## Testes

- Testes unitários: `npm test`.
- Ponta a ponta r54 confere:
  - o lembrete na hora de costume, com os botões;
  - que não usa o costume da outra pessoa;
  - que com 2 vezes ainda não lembra;
  - uma vez por dia;
  - feita ou desligada: nada;
  - "O que mudou" e o guia.
- Regressão completa r1–r54.
