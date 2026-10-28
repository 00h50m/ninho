# Mapa do Ninho · Entrega 4b (Fase 5): organização do código

Branch: `mapa-5b`, feita a partir da `mapa-5a` (c02c4b5). **Sem merge automático. Sem migration. Nada muda para quem usa o app.**

## O que mudou
O `components/NinhoApp.tsx` tinha cerca de 2000 linhas, com toda a lógica e as 7 telas num arquivo só. Agora está dividido assim:

| Arquivo | O que tem |
|---|---|
| `components/NinhoApp.tsx` (177 linhas) | A casca: navegação, cabeçalho, avisos (sem internet, envios pendentes), modais e a escolha da tela |
| `components/app/useNinhoApp.tsx` | O estado e as ações (o que era o corpo do NinhoApp). `App` é o tipo do que ele devolve |
| `components/screens/Inicio.tsx` | Início |
| `components/screens/MeuDia.tsx` | Meu dia |
| `components/screens/Rotinas.tsx` | Rotinas e hábitos |
| `components/screens/Casa.tsx` | Casa (tarefas, compras, comida, mais) |
| `components/screens/Nos.tsx` | Nós |
| `components/screens/Caes.tsx` | Cães |
| `components/screens/Ajustes.tsx` | Ajustes |

- **Telas:** cada uma recebe `a` (o retorno de `useNinhoApp`) e pega no começo só o que usa. Assim dá para ver de cara do que cada tela depende, e o TypeScript confere tudo.
- **Como foi feito:** a divisão foi automática, por um script que lê o código pelo compilador do TypeScript. O conteúdo de cada tela é o mesmo de antes; só mudou de arquivo.
- **Testes:** dois testes que liam o texto do `NinhoApp.tsx` agora leem também os arquivos novos.

## Testes
- **TypeScript:** sem erros.
- **Unitários:** 451 de 451 passando.
- **Ponta a ponta:** regressão completa (r1–r44), sem nenhum teste alterado. Ela é a rede de segurança desta entrega.
