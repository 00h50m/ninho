# Mapa do Ninho · Entrega 4c (Fase 5): useNinhoApp dividido por assunto

Branch: `mapa-5c`, feita a partir da `main` (f37f6b2, com a entrega 4b). **Sem merge automático. Sem migration. Nada muda para quem usa o app.**

## O que mudou
O `components/app/useNinhoApp.tsx` tinha cerca de 1100 linhas. Agora ele só junta 8 partes, cada uma num arquivo de `components/app/`:

| Parte | Linhas | O que tem |
|---|---|---|
| `useAppCore` | ~340 | Navegação, preferências do aparelho, dados carregados, fila sem internet, avisos (toasts) e auxiliares |
| `useDia` | ~80 | O dia de hoje: plano, energia, nível, XP e o que o Início mostra |
| `useTarefas` | ~240 | Concluir (tarefas e cães), editar, passar só hoje, pular, pausar, formulários, sugestões e estações |
| `useRotinasSprint` | ~75 | Rotinas com passos, hábitos e o Sprint |
| `useCaesAcoes` | ~70 | Cadastro, rotinas, saúde, perfil, filhote e ração dos cães |
| `useNosAcoes` | ~125 | Semana, nomes, reunião, desafios, linha do tempo e equilíbrio da carga |
| `useCasaAcoes` | ~95 | Divisão, compras, manutenção e agenda |
| `useTelas` | ~245 | Ações rápidas, linhas de item, linha do tempo por pessoa e filtros das tarefas |

- **Como as partes se juntam:**
  - Cada parte recebe o que as anteriores devolveram e pega no começo só os nomes que usa. Assim dá para ver de cara do que ela depende.
  - O TypeScript confere tudo.
  - A ordem importa: o dia vem antes das tarefas, porque as tarefas usam o plano de hoje; e Nós vem antes de Casa, porque a divisão automática usa a carga de cada uma.
  - As telas continuam recebendo tudo como `a` (tipo `App`).
- **Como foi feito:** a divisão foi automática, por um script que lê o código pelo compilador do TypeScript. O conteúdo de cada parte é o mesmo de antes; só mudou de arquivo.
  - O script confere que nenhuma parte usa algo de uma parte que roda depois.
  - Confere também que nenhum nome é declarado em duas partes.
- **Testes:** os testes que leem o código, para garantir que a chave service_role não está no app e que a janela antiga de sugestões saiu, agora leem todos os arquivos de `components/app/` e das telas.

## Testes
- **TypeScript:** sem erros.
- **Unitários:** 451 de 451 passando.
- **Ponta a ponta:** regressão completa (r1–r44), sem nenhum teste alterado.
