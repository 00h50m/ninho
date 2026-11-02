# UX C2: telas vazias com o Nino, tablet e computador

## O que mudou

- **Telas vazias com o Nino.** Quando ainda não há nada cadastrado, o Nino aparece com o emoji do assunto ao lado:
  - tarefas do Início e da Casa;
  - lista de compras ("Tudo no carrinho!" com o Nino em festa);
  - despensa, manutenção e agenda;
  - rotinas, hábitos e treinos;
  - cães, desafios em dupla e álbum.

  O desenho é decorativo (escondido do leitor de tela); o texto e o botão de cada tela continuam iguais. Os avisos de "falta atualizar o banco" ficaram como estavam.
- **Barra de baixo (celular e tablet):** as 5 abas ocupam a largura toda. Antes, a grade tinha 6 colunas e sobrava um buraco à direita.
- **Computador:** com o menu lateral aberto, o logo "Ninho" da barra de cima some, porque repetia o do menu.
- **Cães:** o cartão "Quem cuida dos cães" ganhou espaço em relação ao cartão do modo filhote.

## Revisão visual

- **Tamanhos varridos:** 768, 1024, 1280 e 1600 px, com a casa cheia (68 tarefas). Não houve rolagem lateral nem texto cortado nas telas principais.
- **Títulos de seção:** já usavam o mesmo estilo (`.slbl`) em todas as telas.

## Arquivos

- `components/ui/Empty.tsx` (`EmptyNino`): usado nas 14 telas vazias.
- CSS no fim de `styles/app.css`, com ajuste da grade de `.bnav`.

## Sem migration

Nada para rodar no Supabase.

## Testes

- Testes unitários: `npm test`.
- Ponta a ponta r53, no celular e no computador. Confere:
  - o Nino em 5 telas vazias;
  - a barra de baixo sem buraco;
  - um logo só no computador;
  - acessibilidade (axe).
- Regressão completa r1–r53.
