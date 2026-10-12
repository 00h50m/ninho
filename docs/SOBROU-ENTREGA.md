# Sobrou! no Início do Ninho

Esta entrega tem duas partes:
- **Ninho:** branch `sobrou-resumo`, feita a partir da `main`.
- **Sobrou:** repositório `00h50m/financeiro`, branch `resumo-ninho`.

**Sem merge automático.** **Sem SQL** em nenhum dos dois.

## O que aparece
Um cartão **💰 Sobrou · mês** no Início (coluna da direita no computador; no celular, abaixo do dia). Ele mostra:
- **sobra projetada** em verde, ou **"Faltam no mês"** em vermelho;
- **comprometido**, com a barra e o % da renda;
- **o que ainda falta pagar**, ou "Tudo pago neste mês ✓";
- **o que vence nos próximos 7 dias**: hoje, amanhã ou o dia da semana, com o valor. Faturas ainda sem valor real aparecem como "estimada";
- **avisos de teto** do Orçamento (passou do teto ou está perto);
- **Abrir ↗:** abre o Sobrou em outra aba, pelo link salvo na Agenda.

Os números vêm do **mesmo motor do Dashboard do Sobrou**. Dá para esconder o cartão em **Ajustes › Cartões do Início › "Sobrou! (finanças do mês)"**.

## Segurança
- **Só números:** o Sobrou entrega só os totais do mês, os vencimentos e os avisos. Nenhuma compra, cartão ou pessoa sai de lá.
- **Nada é guardado no Ninho.**
- **O caminho dos dados:** o navegador pede ao servidor do Ninho (que exige login de alguém da casa). O servidor do Ninho pede ao Sobrou com um **segredo**, que só existe nas variáveis da Vercel dos dois apps. O segredo **nunca vai para o navegador**.
- **O endereço vem só da Vercel** (`SOBROU_API_URL`). O link salvo no app nunca é usado para buscar dados, para o segredo não ir para outro lugar. O pedido também não segue redirecionamentos.
- **A rota do Sobrou só lê:**
  - sem o segredo cadastrado, responde 503;
  - com o segredo errado, responde 401;
  - a resposta não fica guardada em cache.
- **Se o Sobrou estiver fora do ar,** o cartão mostra o aviso e "Tentar de novo". O resto do Início não é afetado.
- **Sem as variáveis,** o cartão simplesmente não aparece.

## Como ligar (uma vez)
1. Escolha um segredo: um texto longo e aleatório, com 24 caracteres ou mais (por exemplo, gerado num gerenciador de senhas). **Não mande o segredo aqui no chat.**
2. **Vercel do Sobrou** › Settings › Environment Variables: `NINHO_RESUMO_TOKEN` = o segredo (Production e Preview). Depois, **Redeploy**.
3. **Vercel do Ninho** › Settings › Environment Variables (Production e Preview):
   - `SOBROU_RESUMO_TOKEN` = o mesmo segredo;
   - `SOBROU_API_URL` = o endereço do Sobrou (ex.: `https://seu-sobrou.vercel.app`).

   Depois, **Redeploy**.

## Testes
- **Sobrou:**
  - `api/_lib/__tests__/resumoNinho.test.js` (5): números do mês, vencimentos dos próximos 7 dias (sem os pagos, virando o mês), avisos de teto, **nenhuma descrição de compra na resposta**, e a rota (503 sem segredo, 401 errado, 200 certo, sem cache, só GET);
  - `npm run check`: lint sem erros (os 9 avisos já existiam), 599 testes e build ok.
- **Ninho:**
  - `tests/sobrou.test.ts` (4): conferência da resposta, formatos, segredo e endereço só da Vercel (endereço inválido recusado, sem seguir redirecionamento) e falhas com mensagens amigáveis;
  - **ponta a ponta** (`r24`), com um Sobrou de teste:
    - cartão com sobra, comprometido e %, a pagar, vencimentos (hoje, amanhã, estimada, dia da semana), aviso de teto e link em outra aba;
    - **o segredo e o endereço do Sobrou não aparecem no navegador**;
    - rota sem login recusada;
    - mês no vermelho; Sobrou fora do ar com "tentar de novo";
    - Sabrina também vê;
    - celular com texto maior, sem rolagem lateral;
    - Noturno;
    - esconder em Ajustes;
    - **acessibilidade (axe):** sem problemas.
  - **Regressão (r1–r24):** veja o resultado na mensagem de entrega.

## Como desfazer
Não mesclar, ou `git revert` nos dois. Também dá para só apagar as variáveis na Vercel: o cartão some e a rota do Sobrou passa a responder 503.
