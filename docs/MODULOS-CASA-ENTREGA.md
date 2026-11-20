# E1: módulos por casa (para abrir o Ninho a outras casas)

## O que mudou

Cada casa tem os seus **módulos** (`households.features`, migration 046):

| Módulo | Quem liga | Casa nova | Casa de vocês |
|---|---|---|---|
| **🐾 Pets** (aba Cães, rotinas e saúde dos pets) | a própria casa (configuração inicial ou Ajustes › Módulos da casa) | pergunta na configuração | ligado |
| **✨ IA** (Faxinão, Perguntar, planejar o dia, fotos e plano no Meu dia, Telegram em texto livre e áudio, sugestões da reunião) | só quem administra o banco (SQL Editor) | desligada | ligada |
| **💰 Sobrou** (cartão, passo a passo, atalho na Agenda e avisos do bom dia) | só quem administra o banco | desligado | ligado |

### No app

- **Configuração inicial:** na etapa "Quem faz parte", a pergunta **"Vocês têm pet?"**. Com "Não", não aparecem campos de cão e nenhum cão é criado.
- **Sem pets:**
  - some a aba Cães: a barra fica com 4 abas, sem buraco;
  - somem o cartão "Cães hoje", o atalho dos cães no + e na busca, e a "Escala dos cães" em Ajustes.
- **Sem IA:** somem os chips "Planejar o dia" e "Faxinão" do Início, o Faxinão em Casa › Mais e os atalhos de IA do + e da busca. No Meu dia, os botões de foto, plano, rótulo e bioimpedância viram um aviso curto.
- **Sem Sobrou:** somem o cartão do Início, a opção no "O que aparece no Início", o passo a passo em Ajustes e o atalho e o link da Agenda.
- **Ajustes › Módulos da casa:** a chave dos pets e a situação da IA (só informação).
- **Aba Cães:** o subtítulo agora é o nome dos pets de cada casa. Antes, "Penélope e Zelda" estava fixo no código.

### Segurança (o que mudou de verdade)

- **Os avisos do Sobrou no bom dia do Telegram iam para todas as casas ligadas ao bot.** Agora vão só para a casa com o Sobrou ligado. As chaves do Sobrou são de uma casa só.
- **Servidor:** `/api/sobrou` e todas as rotas `/api/ai/*` conferem o módulo da casa e respondem **403** quando está desligado. O Telegram faz o mesmo antes de usar a IA (texto livre, áudio, perguntas, "organizar o dia", "faxinão:" e `/dicas`).
- **Banco:** uma **trava** (gatilho) impede que o app (papéis anon e authenticated) ligue IA ou Sobrou, ou crie uma casa com eles ligados.
  - `ninho_set_feature` só aceita `pets` e só para a casa de quem pede.
  - Fora disso, responde 403.

## Migration 046 (rodar no Supabase)

- **Arquivo:** `supabase/migrations/20261114120000_modulos_casa.sql`.
  - **Não destrutiva:** cria a coluna `features`, a trava e a função.
  - **Casas que já existem:** na primeira execução, ficam com IA e Sobrou ligados, e pets ligado se já há cão.
  - **Pode rodar de novo:** o preenchimento só acontece quando a coluna é criada.
- **Antes de rodar:** o app funciona como sempre, com tudo ligado.
- **Arquivo único** para o SQL Editor, com 044 + 045 + 046 e conferência (**9**).

## Testes

- **Unitários:** `tests/modulos.test.ts`.
- **Banco:** `supabase/tests/99zzz-modulos.test.sql`, nos 3 cenários. Confere:
  - casa nova sem IA e sem Sobrou;
  - o app não liga;
  - a casa escolhe os pets;
  - a casa antiga continua com tudo.
- **Ponta a ponta r58:**
  - configuração com "têm pet?";
  - o que some na casa nova;
  - 403 no servidor;
  - o banco recusando;
  - os pets em Ajustes;
  - a casa de teste igual;
  - Telegram sem IA e o bom dia com o Sobrou só na casa certa.
- **Servidor de teste reconstruído e versionado em `e2e/`** (ver `e2e/README.md`).
  - O anterior ficava numa pasta temporária e foi apagado quando o ambiente reiniciou.
  - Os testes r53–r57 foram recuperados. Os r1–r52 se perderam e as próximas entregas repõem a cobertura aos poucos.
