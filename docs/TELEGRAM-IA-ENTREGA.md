# Telegram em texto livre (IA)

Branch: `telegram-ia`, feita a partir da `main` cfd1b38. **Sem merge automático.**

## Como funciona
Escreva para o bot do jeito que falaria:
- "comprei leite e 2 kg de arroz";
- "a Zelda tomou a V10 hoje";
- "lembra a Sabrina de pagar a internet sexta";
- "bebi um copo de água";
- "fiz o reset da sala";
- "tomei a vitamina D".

O bot responde com **o que entendeu**:

> Entendi assim:
> • 🛒 Lista de compras: leite, arroz (2 kg)
> • 💉 Zelda: V10 · hoje
>
> Posso registrar?  **[✅ Confirmar] [✖ Cancelar]**

**Nada é gravado antes do "Confirmar".** Depois, a mesma mensagem mostra o resultado ("✅ Feito: …").

### O que ele sabe fazer
| Você escreve | Vira |
|---|---|
| compras ("acabou o café", "comprar 2 kg de arroz") | itens na lista de compras |
| cuidado com as cachorras (vacina, vermífugo, antipulgas, remédio, consulta, banho, peso) | registro de saúde do cão. "As duas" registra nas duas |
| compromissos e "lembra a X de…" | evento na Agenda da casa (consulta, visita, entrega, serviço, compromisso ou vencimento) para quem foi citada |
| "fiz / lavei / passeei…" | conclui uma tarefa ou rotina dos cães **pendente hoje** (com XP, como no app) |
| "bebi um copo / uma garrafa" | água no seu Meu dia (usa o tamanho do seu copo) |
| "tomei o remédio X" | marca a dose no seu Meu dia |

Se for só conversa, ou algo que o app não faz (dieta, finanças, diagnóstico), ele responde explicando o que sabe fazer, sem botões.

Os comandos de antes continuam iguais e **não usam a IA**: /hoje, /feito, /compras, "+item", menu.

## Segurança e privacidade
- **A IA só propõe; quem grava é o servidor**, depois da confirmação:
  - sempre na casa da conversa e em nome de quem está nela;
  - cachorras, tarefas e remédios precisam existir na casa;
  - datas e valores são conferidos (sem datas absurdas, sem vacina no futuro);
  - o que não passa na conferência é descartado.
- **Confirmar só vale na própria conversa e por 30 minutos.** Dois toques não gravam duas vezes.
- **A mensagem vai para a IA marcada como dado**, não como instrução.
- **O contexto enviado à IA:** só nomes, cachorras, pendentes de hoje e os **seus** remédios e tamanho do copo. Nada do Meu dia da outra pessoa.
- **O texto da mensagem não fica guardado** no banco: só as ações propostas, enquanto esperam a confirmação, e o uso de tokens.
- **Limite de 80 mensagens com IA por casa a cada 24 h.**

## Detalhes técnicos
- **Modelo:** uma chamada ao Claude (`claude-opus-5-5`), esforço `low`, com **saída estruturada**: a resposta vem sempre num JSON com formato fixo.
- **Recusa por segurança:** se a IA recusar, o próprio servidor tenta de novo no modelo recomendado (`fallbacks: "default"`), igual às sugestões da semana.
- **Tempo da rota:** a rota do webhook passou a ter até 60 s.
- **Custo:** cada mensagem custa cerca de 1 a 2 mil tokens de entrada e poucas centenas de saída, na ordem de 1 centavo de dólar.

## Migration 024 — `supabase/migrations/20261023120000_telegram_texto_livre.sql`
- **`telegram_pending`:** o que foi entendido, esperando confirmação.
- **Acesso:** a RLS fica ligada e sem regras. O app não vê nem grava; só o servidor.
- **Termina recarregando a lista de tabelas.**
- **Não apaga nada.**

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro (a primeira linha começa com `-- ═══`) → Run.
3. **Conferência:**
   ```sql
   select to_regclass('public.telegram_pending') is not null as tabela,
          (select relrowsecurity from pg_class where oid = 'public.telegram_pending'::regclass) as rls;
   ```
   O esperado é `true | true`.
4. **Chave:** nada novo. Usa a `ANTHROPIC_API_KEY` que já está na Vercel (a mesma das sugestões da semana). Sem a chave, o bot continua entendendo só os comandos.

## Testes
- **Unitários:** 246/246. Novo: `tests/telegramAi.test.ts` (8), cobrindo:
  - conferência de cada tipo de ação;
  - ids inventados descartados;
  - nomes sem acento;
  - "as duas";
  - datas no passado e no futuro;
  - lixo sem quebrar;
  - textos do resumo e do contexto.
- **Banco** (`supabase/tests/99f-telegram-texto.test.sql`), nos 3 cenários:
  - só o servidor lê e grava;
  - de 1 a 12 ações;
  - desligar a conversa apaga as pendências.
- **Ponta a ponta** (`r13`), com webhook real e API da IA imitada localmente. **Todas ok**:
  - **o pedido à IA:** modelo, esforço baixo, saída estruturada, fallback automático e contexto sem dados da outra pessoa;
  - **antes de confirmar:** resumo com botões, nada gravado e id inventado descartado;
  - **confirmar:** compras e vacina gravadas, a outra conversa não consegue confirmar e o segundo toque não duplica;
  - **cancelar** não grava nada;
  - **agenda, água, tarefa e remédio** gravados certinho;
  - **conversa sem ação, recusa e limite diário:** cada um com seu aviso;
  - **comandos e "+item"** sem usar a IA;
  - **pedido antigo** (mais de 30 min) não grava;
  - **o texto da mensagem** não fica guardado.
- **Regressão (r1–r12):** todas ok.
  - O r12 achou um problema de contraste no chip "Modo sobrevivência" com alto contraste: o texto coral sobre fundo coral passou para o tom escuro, e o teste foi rodado de novo.
  - O teste antigo f5 (de antes do login) ficou desatualizado. O Telegram está coberto pelo r13.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco (opcional):** `drop table if exists public.telegram_pending;`
