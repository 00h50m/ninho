# Revisão de UX, funcionalidades e responsivo

Branch: `revisao-ux`, feita a partir da `melhorias-13`. **Sem merge automático.**

## Como foi revisado
Uma varredura automática (r-audit) entrou com as duas contas e passou por todas as telas e abas:
- **Telas:** Início (lista e linha do tempo), as 5 partes do Meu dia, Rotinas e Hábitos, as 8 abas da Casa, Cães, as 6 abas de Nós, Ajustes, a janela de nova tarefa e a busca.
- **Tamanhos:** 360 (celular pequeno), 390 (celular), 768 (tablet) e 1280 (computador).
- **O que conferiu em cada tela:**
  - vazamento para os lados;
  - alvos de toque menores que 24×24 px (WCAG 2.5.8);
  - texto cortado sem reticências;
  - axe (WCAG 2.1 AA);
  - erros de JavaScript.
- **Capturas:** depois, cada tela foi olhada pelas capturas.

**Resultado antes das correções:**
- **Nenhuma falha:** de axe, de erro de JavaScript ou de texto cortado.
- **Encontrado e corrigido:** os itens abaixo.

## Correções
1. **Meu dia › Evolução, em 360 px:** o botão "📄 Ler bioimpedância ou avaliação (PDF ou foto)" não quebrava a linha. Isso alargava a página em 21 px e empurrava a barra de baixo para fora da tela. Agora botão com texto longo quebra a linha.
2. **Início no computador e no tablet:**
   - **O problema:** na coluna de cada pessoa, os 3 botões fixos (⇄ ✎ ⏭) deixavam ~90 px para o nome da tarefa ("Louça da …", "Regar pl…").
   - **A correção:** quando a coluna é estreita, as ações viram o "⋯", que já abre o menu com tudo (passar, editar, pular, ajuda, pausar). O nome quebra em até 2 linhas, como no celular.
3. **Abas da Casa (8) e de Nós (6) no celular:**
   - **Antes:** viravam uma grade de 2 colunas com 3 ou 4 linhas, cerca de 180 px no topo de toda tela.
   - **Agora:** com 5 abas ou mais, é uma linha só que rola de lado, e a aba aberta rola sozinha para ficar à vista.
   - **Rotinas (2 abas) e telas com até 4 abas:** continuam como estavam.
4. **Compras no celular:** o campo "Adicionar item" ficava espremido, com o exemplo cortado e o corredor como "🛒 Outros…". Agora o campo ocupa a linha toda e o corredor e o + ficam embaixo.
5. **Balanço da semana (Nós):**
   - **O erro:** a porcentagem contava o jantar cozinhado, mas a coluna "Esforço" não. Aparecia "Sabrina 100% do esforço" com Esforço 0.
   - **Agora:** a coluna soma o jantar (2 pontos), como a explicação do cartão diz.
6. **Cartão do jantar no Início:** "🍳 Sabrina" e "Despensa →" apareciam com a borda padrão do navegador. Agora todo link de texto (`.lnk`) tem o mesmo estilo em qualquer lugar.
7. **Alvos de toque de pelo menos 24×24 px, sem mudar o desenho:**
   - os selos que são botões ("○ essencial", "+ horário");
   - o horário rápido e o ✕ dele;
   - os links "Abrir →", "Como dormiu?" e "+ Observação";
   - o logo no celular;
   - os dias do calendário do Histórico;
   - os ✓ das rotinas dos cães;
   - o "Casa › Tarefas →" do Equilíbrio, que tinha estilo próprio e agora usa o de link.
8. **✕ de fechar** das janelas menores (menu da tarefa, pausar): com título longo, ficava espremido em 14 px. Agora não encolhe.
9. **Ação rápida:** o subtítulo do item em destaque ficava fraco sobre o fundo da cor principal. Agora usa a cor do texto.
10. **Formulário da tarefa no tema escuro:** o texto pequeno do botão escolhido ("+2 XP", "Pode ser adiada") tinha pouco contraste. Agora acompanha a cor do botão.

## Segunda rodada (depois das correções)
- **As mesmas telas, mais janelas:** busca, ação rápida, menu da tarefa, pausar, item das compras e jantar.
- **Os 5 temas:** Aconchego, Noturno, Aurora, Natureza e Minimal, com axe em cada um.
- **A conta da Sabrina:** no celular pequeno e no tablet.
- **Resultado:** zero avisos em todos. Nenhum vazamento, nenhum alvo menor que 24 px, nenhuma falha de axe, nenhum texto cortado e nenhum erro de JavaScript.

## Testes
- **Unitários:** 434, todos passando.
- **Varreduras:** nos 4 tamanhos, nos 5 temas e com as duas contas, todas sem avisos.
- **Ponta a ponta:** r1–r40, 40/40 OK no código final. Três testes antigos foram ajustados por mudanças feitas de propósito: r7 (no computador as ações estão no "⋯"), r31 (6 atalhos no ícone) e r39 (toca no nome da tarefa, não no meio do cartão).
