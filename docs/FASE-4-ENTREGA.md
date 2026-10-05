# Fase 4 — Rotina flexível: entrega

Branch: `fase-4-rotina`, criada a partir da `main` (Fases 0–3). Sem merge na `main` e sem deploy.

## O que foi feito

| Item | Como funciona |
|---|---|
| **📆 Dias da semana** | No formulário da tarefa: Seg … Dom. **Diária:** aparece só nesses dias (ex.: lixo seg, qua e sex). **Semanal/quinzenal:** aparece a partir do primeiro dia escolhido e fica até ser feita (ex.: faxina a partir de sábado). Nenhum dia marcado = qualquer dia, como antes. A lista de Tarefas mostra “📆 seg, qua, sex”, “dias úteis” ou “fim de semana”. |
| **⤼ Pular** | No ⋯ da tarefa (no computador, ⏭): “Pular hoje / esta semana / esta quinzena / este mês”. Resolve o período sem XP e **não quebra a sequência “casa em dia”**. |
| **⏭ Deixar para amanhã** | Nas semanais, quinzenais e mensais, some só hoje e volta amanhã. Na pontual, muda a data para amanhã. Na diária, “pular hoje” já faz esse papel. |
| **Puladas ou para amanhã** | Aparecem no fim da coluna de cada uma, com “↺ Voltar”. Também tem Desfazer no aviso. |
| **Pontual com data** | Aparece em Hoje a partir da data e vai para ⚠ Atrasadas se a data passar. |
| **Bom dia e resumo** | Seguem as mesmas regras: o que foi pulado ou é de outro dia não entra. |

## Banco (migration 008)

`supabase/migrations/20261009120000_rotina_flexivel.sql`:

- `tasks.weekdays` (0 = domingo … 6 = sábado; valida os valores) e `tasks.due_date`.
- `task_skips`: um registro por tarefa por dia (`snooze` ou `skip`, com quem fez). Tem RLS e entra no Realtime.
- `ninho_day_on_track` foi atualizada para ignorar tarefas fora do dia da semana e as puladas ou adiadas.

## O que você precisa fazer

1. **SQL Editor:**
   1. Rode a `supabase/migrations/20261009120000_rotina_flexivel.sql`.
   2. Rode `supabase/scripts/post-migration-check.sql` e confira se tudo sai `ok`.
2. **Merge** da `fase-4-rotina`, só depois do passo 1. Não há variável nova.

Se o app for publicado antes da migration, tudo continua funcionando como antes. Só pular, adiar e salvar dias ou data mostram o aviso de que o banco precisa ser atualizado.

## Resultados

- `npm run typecheck`: sem erros.
- `npm test`: 127 testes passando (12 novos):
  - dias da semana na diária e na semanal;
  - pular hoje e pular a semana;
  - deixar para amanhã;
  - a pausa mais recente vale;
  - Hoje e bom dia sem as pausadas;
  - pontual com data e atrasada.
- `npm run test:db`: tudo passando nos 3 cenários (novo, legado e schema real de produção), com as migrations aplicadas duas vezes:
  - pular e adiar não quebram a sequência;
  - tarefa fora do dia não conta;
  - dados inválidos são recusados.
- `npm run build`: sem erros.
- **Ponta a ponta** (Playwright, modo produção): 18 verificações ok e nenhum erro de página.
  - Dias da semana: tarefa fora do dia não aparece; formulário grava os dias; com o dia de hoje marcado, aparece.
  - Pular e voltar.
  - Semanal: deixar para amanhã e desfazer.
  - Pontual com data: só aparece a partir da data, fica atrasada depois dela e "para amanhã" muda a data.
  - Botão ⏭ no computador.
  - Celular sem rolagem lateral.

## Observações

- Tarefas sem dias definidos continuam iguais. Nada muda até alguém escolher os dias.
- Pular não dá XP e não conta como feita no placar. Serve para semana de viagem, doença ou imprevisto.
- Rotinas dos cães não têm pular nem dias da semana nesta fase.

## Como desfazer

Não fazer o merge, ou promover o deploy anterior na Vercel. A coluna e a tabela novas podem ficar no banco: as versões anteriores do app as ignoram.
