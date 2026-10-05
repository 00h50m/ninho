# Fase 5 — Telegram e IA: entrega

Branch: `fase-5-telegram-ia`, criada a partir da `main` (Fases 0–4). Sem merge na `main` e sem deploy.

## O que foi feito

| Item | Como funciona |
|---|---|
| **💬 Bot do Telegram** | Em **Ajustes › Telegram › Conectar**, o app gera um código de uso único (vale 30 min) e abre o bot. A conversa fica ligada a quem usa o aparelho. Cada uma conecta no próprio celular. |
| **/hoje** | O que é seu hoje, já com a divisão inteligente, os dias da semana e as puladas, mais a manutenção do dia. Cada item tem um botão **✓**: tocar conclui (com XP e ⚡ no horário) e a lista se atualiza na mesma mensagem. |
| **/feito louça** | Conclui pelo nome, procurando primeiro nas suas tarefas. Se o nome bater com mais de uma, pergunta qual com botões. |
| **/compras** | Mostra a lista. **/compras leite, 2 kg arroz** ou **+leite** adiciona, com categoria e quantidade automáticas, como no app. |
| **/dicas** | Sugestões da IA para a semana. |
| **/sair** | Desliga a conversa. |
| **Bom dia e resumo de domingo no Telegram** | Mesmo texto do celular. O bom dia vem com o botão “📋 Ver e concluir”. Cada uma liga e desliga os dois em Ajustes. No máximo um de cada por dia. Quem bloquear o bot é desligado sozinho. |
| **✦ IA na reunião semanal** | Botão “Sugestões da IA para a semana”: de 3 a 5 ajustes concretos, como passar uma tarefa, escolher dias, marcar como essencial ou pular algo numa semana pesada. Ela se baseia no placar, em quem fez o quê, nas puladas, no que está atrasado e no que pesou na reunião passada. “+ usar” copia a sugestão para o item 03. |

### Segurança e custo

- **Webhook do Telegram:** só aceita chamadas com o segredo combinado (`TELEGRAM_WEBHOOK_SECRET`). Só responde em conversas privadas.
- **Código de ligação:** uso único, vale 30 minutos. Uma conversa liga a uma pessoa só.
- **O bot só mexe na própria casa:** confere que a tarefa, a rotina ou a manutenção é da casa da conversa antes de concluir.
- **IA no app:** exige a sessão do app e confere que o usuário tem perfil na casa.
- **IA no Telegram:** só em conversa ligada.
- **Limite de uso:** **6 pedidos por dia** por casa, contando app e Telegram juntos.
- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`, esforço médio), com o retorno de segurança da Anthropic ligado (`fallbacks: "default"`). Se o modelo recusar o pedido, a própria Anthropic tenta de novo com o modelo recomendado.
- **Custo estimado:** cerca de US$ 0,03 a 0,06 por pedido (US$ 4 por milhão de tokens de entrada e US$ 20 por milhão de saída). Com o limite, fica no máximo em torno de US$ 0,36 por dia; no uso normal (uma reunião por semana mais algum /dicas), centavos por mês.
- **Privacidade:** a IA recebe só nomes de tarefas, frequências, quem fez, placar e as anotações da reunião passada. Não recebe ids, chaves nem a lista de compras. Esse resumo vai para a Anthropic.
- **Chaves secretas:** ficam só no servidor. Um teste automático confere que elas não aparecem no código do navegador.

## Banco (migration 009)

`supabase/migrations/20261010120000_telegram_ia.sql`:

- `telegram_links`: conversa ↔ pessoa, código de uso único, preferências.
- `telegram_log`: um envio por dia.
- `ai_log`: contagem de uso, sem guardar texto.
- `ninho_telegram_link_code`.
- Permissão para o servidor concluir tarefas, rotinas e manutenções e adicionar itens pelo bot.

## O que você precisa fazer

1. **Supabase › SQL Editor:**
   1. Rode a migration `20261010120000_telegram_ia.sql`.
   2. Rode a conferência (`supabase/scripts/post-migration-check.sql`).
2. **Criar o bot:** no Telegram, abra **@BotFather**, mande `/newbot`, escolha o nome (ex.: *Ninho*) e o usuário (ex.: *NinhoDaCasaBot*). Ele responde com o **token**. Não cole o token no chat.
3. **Criar a chave da IA:** em **console.anthropic.com**, adicione créditos (US$ 5 duram muito) e crie uma **API Key**.
4. **Vercel › Environment Variables (Production):**

   | Variável | Tipo | Valor |
   |---|---|---|
   | `TELEGRAM_BOT_TOKEN` | Secret | o token do BotFather |
   | `TELEGRAM_WEBHOOK_SECRET` | Secret | um texto longo aleatório (o mesmo jeito do `CRON_SECRET`) |
   | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Config | o usuário do bot, sem @ (ex.: `NinhoDaCasaBot`) |
   | `ANTHROPIC_API_KEY` | Secret | a chave da Anthropic |

5. **Merge e deploy.**
6. **Ligar o bot ao app:** com o deploy pronto, abra no navegador
   `https://ninho-ten.vercel.app/api/telegram/setup?key=SEU_CRON_SECRET`
   Deve aparecer `"ok": true` e o nome do bot.
7. **Em cada celular:** Ajustes › Telegram › **Conectar** → no Telegram, toque em **Iniciar**.

Tudo é opcional e independente: sem as variáveis do Telegram, o cartão avisa que o bot não está configurado; sem a chave da IA, o botão da reunião e o /dicas avisam o mesmo. O push continua funcionando como antes.

## Resultados

- `npm run typecheck`: sem erros.
- `npm test`: 135 testes passando (8 novos), cobrindo:
  - o texto enviado à IA (sem ids) e a leitura da resposta;
  - o webhook exigindo o segredo;
  - os segredos ausentes do código do navegador.
- `npm run test:db`: tudo passando nos 3 cenários, cobrindo:
  - código único que se renova sem acumular;
  - uma conversa por pessoa;
  - o servidor concluindo e adicionando pelo bot;
  - um bom dia por dia;
  - bloqueio para `anon`.
- `npm run build`: sem erros.
- **Ponta a ponta** em modo produção, com imitações locais das APIs do Telegram e da Anthropic: 32 verificações ok, nenhum erro de página.
  - **Ligação:** código no link; webhook com segredo errado dá 401; ligar e reusar o código; o app mostra "Conectado" sozinho.
  - **Comandos:** /hoje com botões que concluem e atualizam a lista; /feito; /compras; +café; /dicas (modelo, fallback e conteúdo conferidos); /sair.
  - **Bom dia no Telegram:** sem repetir no mesmo dia; quem bloqueou o bot é desligado.
  - **IA na reunião:** sugestões aparecem e "+ usar" copia para o item 03.
  - **Proteções:** sem sessão é recusado; limite diário.
  - **Configuração:** a rota de setup protegida.

## Riscos e observações

- **Não testado com o Telegram e a Anthropic de verdade.** Os testes usaram imitações locais das duas APIs, com os mesmos formatos de pedido e resposta. A confirmação vem nos passos 6 e 7 e no primeiro /dicas.
- **A qualidade das sugestões da IA depende dos dados.** No começo, com pouco histórico de quem fez o quê, elas tendem a ser mais genéricas.
- **Atualização de segurança pendente:** os alertas do Next 14 continuam. É a próxima fase (arrumação e segurança).

## Como desfazer

- **App:** promova o deploy anterior na Vercel.
- **Só o Telegram:** cada uma toca em **Desconectar** em Ajustes, ou manda `/sair` no bot. Para desligar de vez, apague `TELEGRAM_BOT_TOKEN` na Vercel.
- **Só a IA:** apague `ANTHROPIC_API_KEY` na Vercel.
- **Banco:** as tabelas novas podem ficar.
