# Nino, o mascote do Ninho

Branch: `mascote`, feita a partir da `linha-do-tempo`. **Sem merge automático.** **Sem migration.**

## O que é
O **Nino** é um passarinho que mora no topo do **Início** e acompanha o dia da casa. Ele não cobra nada: comenta o dia com carinho e dá dicas.

- **Humor pelo dia.** Vale a primeira regra que se aplicar:
  1. 🎉 **festa:** tudo feito hoje;
  2. 😴 **sono:** depois das 23h, com "o que faltou pode ficar para amanhã";
  3. 💛 **calma:** modo sobrevivência;
  4. 🎉 **sequência:** 3, 7, 14, 21, 30, 50 ou 100 dias seguidos;
  5. 🐾 **cães:** quando uma rotina dos cães da pessoa passou do horário ("Penélope e Zelda estão de olho no relógio…");
  6. 😟 **preocupado:** casa em alerta, ou 3 coisas ou mais atrasadas, com a sugestão de 10 minutos juntas;
  7. 💛 **calma:** semana de energia baixa, um passo de cada vez;
  8. 💪 **animado:** mais da metade do dia feita;
  9. 😊 **feliz:** "Bom dia, Giovanna! Para começar: …" ou "Próximo: …".
- **Cresce com o nível do casal:**
  - nível 1: filhote;
  - nível 2: penas na cabeça;
  - nível 3: cachecol;
  - nível 4: flor;
  - nível 5: coroa.
- **Tocar no Nino** dá um pulinho e mostra uma dica; cada toque traz a próxima.
- **Dá para esconder** em **Ajustes › Cartões do Início › "Nino, o mascote"**. A escolha vale para este aparelho.

## Detalhes
- **Visual:** é desenhado em SVG com as **cores do tema** (Aconchego, Noturno e os outros), sem cores soltas, por isso o teste de design continua passando. A barriga e os olhos se ajustam sozinhos ao tema claro ou escuro.
- **Animações:** respiração leve, pulinho e confete. Desligam com **reduzir animações** (do celular ou do app).
- **Acessibilidade:** a fala é anunciada (`role="status"`) e o botão tem nome, com o estágio.

## Testes
- **Unitários:** `tests/mascote.test.ts` (2), cobrindo:
  - a ordem das regras de humor e cada fala;
  - o estágio pelo nível;
  - as dicas girando a cada toque.
- **Ponta a ponta** (`r22`):
  - **de manhã:** bom dia com por onde começar; fala anunciada; nome com o estágio;
  - **tocar:** dicas diferentes a cada toque;
  - **modo sobrevivência:** Nino calmo;
  - **nível 4:** cachecol e flor;
  - **às 23:30:** Nino dormindo;
  - **celular com texto maior:** sem rolagem lateral;
  - **esconder em Ajustes:** some do Início;
  - **acessibilidade (axe):** sem problemas no computador, no celular e no Noturno.
- **Regressão:** veja o resultado na mensagem de entrega.

## Como desfazer
Não mesclar, ou `git revert`. Também dá para só esconder em Ajustes.
