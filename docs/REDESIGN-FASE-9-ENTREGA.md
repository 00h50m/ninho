# Redesign · Fase 9: Temas e acessibilidade

Branch: `redesign-fase-9`, feita a partir da `main` 4ed73ea. **Sem merge automático.** **Sem migration.**

## O que mudou
Em **Ajustes › Aparência** há opções novas. **Valem só para o aparelho**, então cada uma ajusta o próprio celular:
- **🌗 Tema automático:** segue o claro/escuro do celular, com um tema para o dia (Aconchego, Natureza ou Minimal) e outro para a noite (Noturno ou Aurora). Troca sozinho quando o celular muda. Escolher um tema fixo desliga o automático.
- **🔠 Tamanho do texto:** normal, grande (+12%) ou maior (+25%). Aumenta textos, botões e áreas de toque juntos, e nenhuma tela passa da largura do celular.
- **◐ Alto contraste:** textos secundários quase da cor do texto, bordas visíveis, links sublinhados e foco mais grosso. Funciona nos 5 temas.
- **🐢 Menos animação:** desliga transições e animações. O app também respeita quando o próprio celular pede menos movimento.
- **🏠 O que aparece no Início:** dá para esconder resumo, semana, check-in, Meu dia, rotina agora, cães hoje, agenda, manutenção, lista de compras e atalhos. Nada some do app: só sai da tela inicial.
- **Configuração:** o aviso "Configurar o Ninho" ganhou um **"Agora não"**, que esconde por 2 semanas. Dá para configurar a qualquer hora em Ajustes.

Tudo isso é aplicado **antes da página aparecer**, sem piscar o tamanho, o contraste ou o tema errado.

## Revisão de acessibilidade
- **Contraste medido, não no olho**, pela regra WCAG AA: 4,5:1 para texto.
  - **Os 5 temas** foram ajustados: o tom de texto auxiliar (`--faint`) ficou mais forte em todos.
  - **Noturno:** os botões principais passaram a ter **texto escuro sobre o verde**. O branco ficava em 3,4:1.
  - **Pontuais:** selo de prioridade alta, dias futuros da semana, contadores e subtítulos do menu ativo.
  - **Teste permanente:** um teste novo confere o contraste de todos os temas, para nenhum tema futuro ficar abaixo do mínimo.
- **Auditoria automática (axe-core):**
  - **Cobertura:** todas as telas e abas (Início, Rotinas, Hábitos, Meu dia e suas abas, Casa e suas abas, Cães, Nós e suas abas, Ajustes, Ação rápida), celular e computador, nos 5 temas e também com alto contraste.
  - **Resultado:** **0 problemas** em todas essas combinações. Antes dos ajustes eram 39 pares de cor abaixo do mínimo.
  - **O que mais apareceu:** só problemas de contraste. A auditoria não encontrou botão sem nome, campo sem rótulo nem papel errado.
- **Pinça para ampliar** continua liberada no celular.

## Testes
- **Unitários:** 238/238. Novo: `tests/a11y.test.ts` (12), cobrindo:
  - preferências, com valores estranhos voltando ao padrão;
  - tema automático;
  - "agora não";
  - script de abertura;
  - **contraste dos 5 temas**.
- **Ponta a ponta** (`r12`), **todas ok**:
  - "Agora não" esconde o aviso, e ele continua escondido ao recarregar;
  - tamanho maior, alto contraste e menos animação aplicados e lembrados;
  - tamanho maior sem rolagem lateral em nenhuma tela do celular (também conferido em 360px);
  - axe sem problemas no Início com tamanho maior e alto contraste, e no Noturno;
  - tema automático muda sozinho do escuro para o claro e é lembrado;
  - escolher um tema desliga o automático;
  - esconder Atalhos e Check-in do Início;
  - nenhum erro de página.
- **Regressão (Fases 1 a 8, Meu dia e notificações, r1–r11):** todas ok.
  - Três testes antigos foram ajustados: o aviso de configuração agora tem dois botões, e um teste que dependia da data fixa 06/10 passou a usar a data do dia.

## Como desfazer
Não mesclar, ou `git revert`. Não há nada no banco.
