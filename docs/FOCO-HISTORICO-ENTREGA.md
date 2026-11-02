# D2: modo foco no Início e histórico visual em Nós

## O que mudou

- **🎯 Foco** (botão ao lado de "Para agora"): em tela cheia, só o que é **seu agora**.
  - **Ordem:** as atrasadas (da mais antiga), as essenciais e a próxima com horário, até 5.
  - **Cada item** mostra o porquê ("⚠ atrasada · 08:21", "● essencial", "▸ próxima · 15:00") e tem um **✓ grande** (52 px) que conclui ali mesmo. O ⋯ abre as opções da tarefa.
  - **Rodapé:** "+N no resto do dia" e **Sair do foco**. Sem nada urgente, aparece o Nino em festa.
- **Nós › Histórico**, dois cartões novos:
  - **🗓 Mapa do mês:** as últimas 5 semanas, de segunda a domingo, um quadro para cada uma, na cor dela, do claro (pouco) ao escuro (muito).
    - **Tocar num dia** mostra os números em texto ("dom 25/10 · Giovanna 0 · Sabrina 1").
    - **Legenda** menos → mais, em cinza, porque vale para as duas cores.
    - **Mais:** o dia mais cheio de cada uma e **Ver em tabela**. Assim nada depende só da cor.
  - **🔥 Sequências das tarefas:** "Regar plantas · 12 dias seguidos".
    - Conta os períodos da frequência (dias, semanas, quinzenas, meses) em que a tarefa devia ser feita. Dias fora da agenda dela não quebram a sequência.
    - O período de hoje ainda não feito também não quebra.
    - Aparecem as 5 maiores, a partir de 3.
- **Guia** atualizado.

## Sem migration

Usa o histórico que o app já carrega (62 dias). Nada para rodar no Supabase.

## Arquivos

- `lib/foco.ts`, `lib/historico.ts`: puros, testados em `tests/historico.test.ts`.
- `components/inicio/Foco.tsx`, `components/nos/Calor.tsx`.
- CSS no fim de `styles/app.css`, só com tokens.

## Testes

- Testes unitários: `npm test`.
- Ponta a ponta r56, no celular e no computador. Confere:
  - **foco:** a ordem, só o que é meu, o porquê, o ✓ grande que conclui e sair;
  - **mapa:** um quadro para cada uma, sem sobrepor, os dias coloridos, a leitura em texto e a tabela;
  - **sequências;**
  - **acessibilidade:** axe sem problemas e sem rolagem lateral.
- Regressão completa r1–r56.
