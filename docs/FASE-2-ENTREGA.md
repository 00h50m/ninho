# Fase 2 — Engajamento diário: entrega

Branch: `fase-2-engajamento`, criada a partir de `fase-1-gamificacao`. Contém as Fases 0, 1 e 2. Sem merge na `main` e sem deploy.

## O que foi feito

| Item | Como funciona |
|---|---|
| **App instalável** | Manifesto completo e ícones (inclusive para o iPhone). Em Ajustes → App e notificações: botão **Instalar** no Android/Chrome e instruções para o iPhone (Safari → Compartilhar → Adicionar à Tela de Início). |
| **Sem internet** | O service worker (`public/sw.js`) guarda a casca do app. O app guarda no aparelho o último carregamento da casa. Sem internet, abre com esses dados e mostra o aviso "Sem internet. Mostrando os dados de HH:MM". Marcar ou editar mostra "Sem conexão" e nada muda. Quando a internet volta, recarrega sozinho. O service worker nunca guarda as chamadas ao Supabase. |
| **Abre em Hoje** | O app sempre abre na tela Hoje (antes, voltava na última aba usada). |
| **☀️ Bom dia** | Todo dia, por volta das 7h, cada aparelho recebe só o que é da pessoa dele. Exemplo: *"Hoje: 3 tarefas (1 essencial) e 1 rotina dos cães. Primeira: Ração manhã às 07:00. ⚡ 2 itens valem ×1,5 se feitos no horário."* A conta é a mesma da tela Hoje (`planToday`, compartilhada entre app e servidor), incluindo rodízio, frequência, modo sobrevivência e rotinas agrupadas. |
| **🏆 Resumo de domingo** | Domingo, por volta das 19h. Exemplo: *"Vocês fizeram 57 conclusões. Placar: Giovanna 58 × 51 Sabrina — Giovanna venceu! Sabrina paga: …. 🔥 12 dias seguidos. Ficou para trás: Limpar banheiro (semanal)."* |
| **Ajustes → App e notificações** | Ativar ou desativar neste aparelho, ligar ou desligar o bom dia e o resumo, e "Enviar notificação de teste". As notificações seguem "Este aparelho": se trocar a pessoa, passam a ser dela. |
| **Inicialização mais segura** | Se o banco falhar ao abrir, o app não cria mais uma casa nova por engano. Sem internet, usa a casa lembrada no aparelho. |

**Mudança em relação à sugestão original:** o envio é feito por rotas do próprio app na Vercel (`/api/cron/morning`, `/api/cron/weekly`), agendadas pela Vercel, em vez de Supabase Edge Functions. Assim a mensagem usa exatamente o mesmo código das regras do app, sem reescrever nada em outra linguagem. O protocolo continua Web Push com VAPID.

## Banco (migration 006)

`supabase/migrations/20261007120000_push_notifications.sql` só acrescenta:

- **`push_subscriptions`:** aparelho, pessoa (g/s), chaves e preferências.
- **`push_log`:** um registro por envio. O índice único impede mandar dois "bom dia" no mesmo dia para o mesmo aparelho, mesmo que o agendador repita a chamada.
- **`ninho_save_push_subscription`:** inscreve ou atualiza o aparelho. Recusa pessoa inválida e endereço sem https.
- **Permissão:** o servidor (`service_role`) pode ler o placar e as sequências.

## O que você precisa fazer

1. **Fases anteriores:** aplicar as Fases 0 e 1 no banco (migrations 001–005) e depois a `20261007120000_push_notifications.sql`, com backup antes (`docs/BACKUP-RESTORE.md`).
2. **Gerar as chaves VAPID** no seu computador (não cole no chat):
   ```bash
   npx web-push generate-vapid-keys
   ```
3. **Vercel → Settings → Environment Variables** (Production):

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public Key do passo 2 |
   | `VAPID_PRIVATE_KEY` | Private Key do passo 2 (**secreta**) |
   | `VAPID_SUBJECT` | `mailto:seu-email` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (**secreta**; ignora a RLS; nunca com prefixo `NEXT_PUBLIC_`) |
   | `CRON_SECRET` | um texto longo e aleatório (ex.: `openssl rand -hex 32`) |

4. **Merge e deploy.** O `vercel.json` já agenda:
   - bom dia: `0 10 * * *` (10h UTC = 7h em São Paulo);
   - resumo: `0 22 * * 0` (domingo 22h UTC = 19h).

   No plano gratuito da Vercel, o horário pode variar dentro da hora (7h–7h59).
5. **Em cada celular:** instalar o app → Ajustes → Este aparelho (escolher a pessoa) → App e notificações → **Ativar** → **Enviar notificação de teste**.
   - **iPhone:** só funciona com o app instalado pela tela inicial e iOS 16.4 ou mais novo.
6. **Conferência opcional**, sem esperar o horário:
   ```bash
   curl -H "Authorization: Bearer SEU_CRON_SECRET" https://ninho-ten.vercel.app/api/cron/morning
   ```
   Responde quantos foram enviados e não repete no mesmo dia.

## Resultados

- `npm run typecheck`: sem erros.
- `npm test`: 91 testes passando (16 novos: mensagens, sem internet, segurança da configuração).
- `npm run test:db`: tudo passando no banco novo e no legado. Inscrição sem duplicar, troca de pessoa, recusa de dados inválidos, no máximo um envio por dia, bloqueio para `anon` e leitura pelo servidor.
- `npm run build`: sem erros (rota `/` 106 kB, First Load 193 kB; três rotas de servidor novas).
- **Ponta a ponta em modo produção**, com envio real de Web Push para um receptor local com HTTPS (as mensagens foram descriptografadas e conferidas):
  - agendador sem o segredo ou com segredo errado: 401;
  - cada uma recebe o próprio bom dia;
  - conteúdo criptografado (aes128gcm) e assinado com VAPID;
  - aparelho que respondeu 410 foi desativado;
  - repetir no mesmo dia não reenvia;
  - resumo de domingo enviado;
  - teste limitado a 1 por minuto;
  - app abre em Hoje;
  - service worker ativo e manifesto instalável;
  - sem internet o app abre com os dados guardados e avisa ao tentar marcar;
  - ao reconectar, o aviso some;
  - nenhum erro de página.
- **Bug achado e corrigido no teste:** o Next.js 14 guardava em cache as consultas do servidor, e um agendamento repetido via dados velhos. As rotas agora desligam esse cache, nas duas camadas.

## Riscos e observações

- **Não testado em celular de verdade.** O push foi validado com um receptor local que imita o serviço de push. A entrega real depende dos serviços do Google, da Apple e da Mozilla, e só pode ser confirmada depois do deploy, pelo botão "Enviar notificação de teste".
- **iPhone:** exige app instalado e iOS 16.4+. Sem isso, Ajustes explica como fazer.
- **Horário aproximado:** no plano gratuito da Vercel, o agendamento roda dentro da hora marcada.
- **Chave secreta no servidor:** a `SUPABASE_SERVICE_ROLE_KEY` fica só no servidor da Vercel. Um teste automático confere que ela não aparece no código do navegador.
- **Endereços dos aparelhos visíveis:** com o login anônimo atual, qualquer usuário do app pode ler `push_subscriptions`. Sem a chave VAPID privada, isso não permite mandar notificações. Fica resolvido com o login (fase final).
- **Dados guardados no aparelho:** o cache sem internet fica no navegador do aparelho. Limpar os dados do site apaga o cache, não a casa.
- **Herdado da Fase 0:** os alertas do Next 14 continuam valendo.

## Como desfazer

- **App:** não fazer o merge, ou promover o deploy anterior na Vercel. Para desligar só as notificações, remova os crons do `vercel.json` ou a variável `CRON_SECRET` (as rotas passam a recusar).
- **Service worker:** a versão seguinte do `sw.js` substitui a anterior sozinha. Para remover de vez, publique um `sw.js` que chame `self.registration.unregister()`.
- **Banco:** as tabelas novas não são usadas pelas versões anteriores do app e podem ficar.

## Não implementado (próximas fases)

Lista de compras, regras novas de divisão, manutenção, cofre e login.
