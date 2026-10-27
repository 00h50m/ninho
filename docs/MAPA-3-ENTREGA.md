# Mapa do Ninho · Entrega 3 (Fase 4): perguntar ao Ninho e áudio no Telegram

Branch: `mapa-3`, feita a partir da `main` (09d4170, com a entrega 1). **Sem merge automático. Sem migration.**

(A entrega 2, contas da casa, ficou de fora por decisão de vocês: as finanças continuam no Sobrou!.)

## 💬 Perguntar ao Ninho
Ajuda no dia a dia: manchas e limpeza, organização, roupa, cozinha, plantas, pequenos consertos e cuidados com as cachorras. A resposta leva em conta a casa: o nome de quem pergunta e das cachorras, com raça, idade, sexo e ração quando estão no cadastro.
- **Telegram:** antes, uma pergunta recebia "isso eu não faço". Agora, se a mensagem é uma pergunta ("…?", "como…", "quanto…", "qual…", "posso…", "dá pra…", "é normal…"), o bot responde com "💬 …". O que não é pergunta ("comprei leite") continua indo para registrar com Confirmar, como antes.
- **App:** Ação rápida › **💬 Perguntar ao Ninho**.
  - Escrevendo ou pelo 🎤.
  - Tem sugestões de perguntas para começar.
  - Guarda as últimas 5 respostas enquanto a janela está aberta.
- **Cuidados nas respostas:**
  - Produtos de limpeza: avisa de misturas perigosas e manda testar num cantinho.
  - Saúde das cachorras: dá cuidados gerais e diz quando ir ao veterinário. Não diagnostica nem indica dose de remédio.
  - Saúde de pessoas: não indica remédio.
  - Finanças: lembra que ficam no Sobrou!.
- **Limite:** 40 perguntas por casa a cada 24 h (registradas no uso da IA como "pergunta").

## 🎙️ Áudio no Telegram (Groq)
- **Como funciona:** mande um áudio no Telegram. O Ninho transcreve com o Whisper (Groq), mostra o que entendeu (🎙️ "…") e segue como se a mensagem tivesse sido escrita:
  - pergunta → resposta;
  - "comprei leite e café" → compras com Confirmar;
  - "compras" → a lista;
  - "organiza meu dia: …" → o dia em ordem.
- **Limites:** até 3 minutos e 10 MB. O áudio fica só na memória durante a transcrição e nada é guardado.
- **Sem a chave do Groq:** o bot responde "o áudio ainda não está ligado" e pede para escrever.

### Para ligar o áudio (vocês)
1. Criem uma conta em **console.groq.com**. Tem cota grátis.
2. **API Keys › Create API Key** e copiem a chave (começa com `gsk_`).
3. Na **Vercel**: projeto ninho › Settings › Environment Variables › nova variável **`GROQ_API_KEY`** com a chave, em Production. **Não mandem a chave no chat.**
4. **Redeploy** do último deploy, ou esperem a próxima publicação.

## Testes
- **Unitários:** `tests/mapa3.test.ts`: reconhecer pergunta (cumprimento curto como "oi, tudo bem?" não conta) e a idade das cachorras. 446 no total, todos passando.
- **Ponta a ponta:** r43, com Telegram, IA e Groq simulados. Cobre:
  - pergunta pelo Telegram, com a casa no contexto e o uso registrado;
  - o que não é pergunta seguindo como antes;
  - áudio virando pergunta e áudio "compras" abrindo a lista;
  - o Groq com whisper, português e a chave;
  - áudio longo demais;
  - falha na transcrição;
  - Perguntar ao Ninho no app, com axe.
- **Regressão (r1–r43):** 43/43 OK no código final. O r1 foi ajustado: agora são 19 atalhos na Ação rápida.
