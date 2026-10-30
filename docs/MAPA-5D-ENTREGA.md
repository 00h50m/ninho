# Mapa do Ninho · Entrega 4d (Fase 5): useAppCore dividido

Branch: `mapa-5d`, feita a partir da `mapa-5c` (c6e76c6). **Sem merge automático. Sem migration. Nada muda para quem usa o app.**

## O que mudou
A `components/app/useAppCore.tsx` era a maior parte da entrega 4c, com cerca de 340 linhas. Agora ela só junta 6 partes:

| Parte | Linhas | O que tem |
|---|---|---|
| `useAvisos` | ~40 | Avisos (toasts), janelas (modais), "salvando" e itens com gravação em andamento |
| `usePreferencias` | ~55 | Tema, conforto (tamanho, contraste, movimento), cartões e filtros, guardados neste aparelho |
| `useNavegacao` | ~70 | Tela e abas atuais, ir para uma tela, voltar do celular, busca, organizar o dia, perguntar e o botão + |
| `useDados` | ~95 | Relógio, quem está usando, tarefas, cães, Meu dia, rotinas, agenda, Nós, sprint e histórico |
| `useFilaOffline` | ~65 | O que foi feito sem internet fica guardado e é enviado quando a conexão volta |
| `useEntradas` | ~120 | Organizar o dia, configuração inicial, conquistas novas, links das notificações e a busca |

- **Tipos comuns:** `Account`, `ToastState` e `AppBase` (a casa e a conta) ficam em `components/app/tipos.ts`.
- **Ordem em que as partes rodam:**
  1. Os avisos vêm primeiro, porque quase tudo os usa.
  2. Depois vêm as preferências e a navegação.
  3. Em seguida, os dados.
  4. Por último, a fila sem internet e as entradas, porque usam os dados.
- **Como foi feito:** como nas entregas 4b e 4c, a divisão foi automática, com o compilador do TypeScript. O script confere que nenhuma parte usa algo de uma parte que roda depois e que nenhum nome é declarado em duas partes.

Agora o maior arquivo de `components/app/` tem cerca de 245 linhas (`useTelas`).

## Testes
- **TypeScript:** sem erros.
- **Unitários:** 451 de 451 passando.
- **Ponta a ponta:** regressão completa (r1–r44), sem nenhum teste alterado.
