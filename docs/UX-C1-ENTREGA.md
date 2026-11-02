# UX C1: gestos, carregamento e o dia fechado

## O que mudou

- **Deslizar na tarefa (celular):**
  - para a direita conclui (ou desfaz);
  - para a esquerda abre o menu ⋯.
  - Na rotina dos cães, deslizar para a esquerda é "Não deu hoje".
  - Só vale para toque: mouse e teclado seguem como antes. Se o gesto é mais vertical que horizontal, conta como rolagem.
- **Puxar para atualizar:** no topo da tela, puxar para baixo recarrega:
  - tarefas;
  - Meu dia;
  - agenda;
  - compras;
  - Nós.
  Não age com uma janela aberta nem fora do topo.
- **Dia fechado:** quando a última tarefa sua de hoje é concluída, aparece "Dia fechado, <nome>!" com confetes:
  - fecha sozinho em 3 s;
  - aparece uma vez por dia em cada aparelho;
  - sem confetes com "menos animação" ligado.
- **Esqueleto:** enquanto a casa carrega, o Início mostra o formato dos cartões no lugar da tela de espera.
- **Início mais rápido:** agenda, "sobrou", manutenção e atalhos só são montados quando chegam perto da tela.

## Arquivos

- `lib/gestos.ts`: cálculos puros dos gestos (testados em `tests/gestos.test.ts`).
- `components/ui/Swipe.tsx`, `components/ui/Deferred.tsx`, `components/ui/Skeleton.tsx` e `components/ui/Festa.tsx`.
- `hooks/usePullRefresh.ts`.
- Ajustes em:
  - `components/app/useTelas.tsx` (linhas com deslizar);
  - `components/NinhoApp.tsx` (esqueleto e atualizar);
  - `components/screens/Inicio.tsx`.
- CSS no fim de `styles/app.css`: só tokens, com "menos animação" respeitado.

## Sem migration

Nada para rodar no Supabase.

## Testes

- Testes unitários: `npm test`.
- Ponta a ponta (r52) cobre:
  - deslizar nos dois sentidos;
  - clique depois do gesto ignorado;
  - puxar para atualizar;
  - esqueleto;
  - dia fechado uma vez por dia;
  - acessibilidade.
- Regressão completa r1–r52.
