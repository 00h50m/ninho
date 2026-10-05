# Redesign · Fase 1: design system, temas e navegação em 5 áreas

Branch: `redesign-fase-1` (a partir da `main` b776ca4). **Sem merge automático.**

## Estado antes (Fase 0 concluída)
- Fases 0–6 do Ninho entregues e mescladas. Migrations 001–013 aplicadas em produção e checadas.
- O app tinha 6 abas: Hoje, Tarefas, Compras, Semana, Cães, Ajustes. Havia um único tema escuro.
- As cores estavam espalhadas num bloco `CSS` de ~440 linhas dentro de `NinhoApp.tsx`, com hex soltos também nos componentes.

## Divergências entre o pedido e o que já existe
| Pedido | O que existe | O que foi feito |
|---|---|---|
| Não implementar login/senha/recuperação | O login por e-mail e senha já existe (Fase 6) | Mantido como está ("não alterar o acesso atual") |
| Não implementar IA/Telegram | Bot do Telegram e IA já existem (Fase 5) | Mantidos, sem nenhuma mudança |
| Sem ranking competitivo entre Giovanna e Sabrina | Já existe o **Placar da semana** com **aposta** ("quem perder…") | Mantido nesta fase para não perder nada. **Proposta:** na Fase 8 (Nós), trocar por uma meta conjunta do casal. Preciso da sua decisão. |
| Vencimentos simples com link para o Sobrou! | Ainda não existe | Fica para a Fase 6 (Casa) |

## O que foi criado
- `styles/tokens.css`: a única fonte de cores, sombras, espaços, raios e tipografia. Tem dois temas:
  - **Ninho Aconchego** (claro, padrão): creme, terracota/vinho, verde natural, coral nos alertas, texto grafite.
  - **Ninho Noturno**: exatamente as cores escuras originais.
- `styles/app.css`: o CSS que estava dentro do `NinhoApp`, agora só com variáveis, mais o CSS da moldura nova.
- `lib/theme.ts`: escolhe, lembra e aplica o tema.
  - Sem escolha salva, segue o celular: claro → Aconchego, escuro → Noturno.
  - Um script aplica o tema antes de pintar a tela, para não piscar.
  - A barra do sistema muda de cor junto com o tema.
- `lib/nav.ts`: define as 5 áreas e converte as abas antigas para as telas novas.
- `components/shell/Shell.tsx`: a moldura do app.
  - Menu lateral no desktop.
  - Menu inferior de 5 itens no celular.
  - Folha de "Ação rápida" com 6 atalhos: tarefa, compra, manutenção, reunião, energia e modo sobrevivência.
  - Abas internas e ícones próprios em SVG.
- `tests/design.test.ts` (7 testes):
  - nenhuma cor solta fora dos tokens;
  - os dois temas têm as mesmas variáveis;
  - toda variável usada existe;
  - o tema padrão e o salvo são respeitados;
  - as 5 áreas estão definidas;
  - as abas antigas levam às telas novas.

## O que foi alterado
- **Navegação:**
  - Hoje → **Início**.
  - Tarefas, Compras e Manutenção → **Casa**, com abas internas.
  - Semana (placar, sequências, conquistas, divisão, energia, histórico) → **Nós**.
  - **Cães** continua igual.
  - **Ajustes** abre pelo avatar do perfil ou pelo botão em Nós.
- **Rotinas (nova área):**
  - mostra as rotinas dos cães que já existem, com horário, frequência e quem cuida;
  - a aba "Hábitos" está reservada para a Fase 4.
- **Ajustes:** ganhou o seletor de tema. A escolha vale só para o aparelho.
- **Arquivos ajustados:**
  - `app/layout.tsx`: carrega os tokens e define a cor do sistema para claro e escuro;
  - `LoginScreen`, `app/page.tsx`, `Maintenance`: cores trocadas por variáveis;
  - `ShoppingTab`: margem acertada para caber dentro de Casa.

## Banco de dados
**Nenhuma migration nesta fase.** Não há nenhuma mudança no Supabase e nenhum SQL manual a rodar.

## Validação
- Typecheck: ok.
- Testes unitários: 145/145 ok (eram 138; 7 são novos).
- Testes do banco: os 3 cenários ok (novo, legado e schema real de produção).
- Build de produção: ok.
- Teste ponta a ponta em modo produção, com login real e segurança por casa (011) ativa: **45 verificações, todas ok**:
  - abre em Aconchego; 5 itens no menu do celular; menu lateral no desktop;
  - as tarefas do dia aparecem;
  - a Ação rápida abre Compras;
  - aparecem a lista de compras, as tarefas, a manutenção, os cães, o placar, as sequências e a divisão;
  - Ajustes mostra a conta e o Telegram;
  - trocar para Noturno muda na hora, a escolha fica lembrada e a barra do sistema acompanha;
  - concluir uma tarefa grava no banco;
  - sem rolagem lateral a 390px, 820px e 1440px em todas as áreas;
  - nenhum erro de página.
- Capturas a 390px, 820px e 1440px nos dois temas (enviadas no chat).

## Riscos
- **Visual claro por padrão:** quem usa o celular no modo claro passa a ver o Aconchego. Para voltar ao visual antigo: Ajustes → Tema → Noturno.
- **Aba lembrada:** o app ainda abre sempre em Início, como antes. Atalhos antigos (`today`, `tasks`, `shop`, `week`, `pets`, `settings`) continuam funcionando.

## Pendências (próximas fases)
- Fase 2: onboarding.
- Fase 4: Hábitos de verdade, com migration.
- Fase 8: decidir o futuro do placar e da aposta.
- Fase 9: os temas Natureza, Aurora e Minimal.

## Como desfazer
- Antes do merge: basta não mesclar a branch.
- Depois do merge: `git revert <commit>`. Como não há migration, não existe nada a desfazer no banco.
