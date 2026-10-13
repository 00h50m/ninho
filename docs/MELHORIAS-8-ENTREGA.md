# Melhorias 8: atalhos no ícone, relatório do mês, trocar refeição, modo marmita e hora de dormir

Branch: `melhorias-8`, feita a partir da `main` (fdb9c99). **Sem migration. Sem merge automático.**

## 1. Atalhos no ícone do app
- **Como abrir:** segure o ícone do Ninho na tela inicial. Funciona com o app instalado; no Android aparece o menu completo, e no iPhone o suporte é parcial.
- **💧 +1 copo:** registra um copo (o tamanho do seu copo) assim que o app abre e mostra o pop-up de água, onde dá para desfazer.
- **🍽️ Refeição:** abre o registro de refeição com o cursor no campo.
- **🗓️ Cardápio:** abre a Alimentação no cardápio da semana.
- **🏷️ Rótulo:** abre Meus alimentos com o botão "📷 Foto do rótulo" em foco. A câmera só abre com um toque, por regra do navegador.
- **Depois de publicar:** o celular pode levar um tempo para buscar os atalhos novos. Se não aparecerem, remova o app da tela inicial e instale de novo.

## 2. Relatório do mês para a nutricionista (Meu dia › Metas › 📄 Relatório do mês)
- **Conteúdo:**
  - peso no período, variação e gráfico, mais as medidas (início, fim e diferença);
  - alimentação: dias registrados, média de kcal e de proteína, dias dentro da meta, alimentos mais frequentes e o **% das refeições do plano marcadas**;
  - água, sono, treinos e humor que mais apareceu.
- **Mês:** o atual ou um dos 5 anteriores. O mês atual vai até hoje.
- **🖨️ Salvar em PDF:** usa a impressão do próprio aparelho ("Salvar como PDF"). Ao imprimir, só o relatório sai, sem botões nem o resto do app.
- **Compartilhar resumo:** manda um resumo em texto (ex.: WhatsApp), onde o aparelho permitir.
- **Privacidade:** só os dados de quem gera, lidos com a permissão normal da pessoa.

## 3. Trocar uma refeição do cardápio
- **Como usar:** toque em "↻ trocar" na refeição. Se quiser, diga o que mudar (ex.: "sem frango", "algo mais rápido").
- **O que a IA recebe:**
  - a refeição atual, com kcal e proteína parecidas;
  - o plano, Meus alimentos e as preferências da semana.
  - O motivo vai marcado como dado, não como instrução.
- **O que muda:** só aquela refeição, no mesmo cardápio. O cardápio é lido do banco, não do aparelho.
- **Limite:** 30 trocas por dia (`ai_log` kind `cardapio_troca`), separado do limite de montar cardápio.

## 4. 🥡 Modo marmita (no cardápio)
- **Escolhas:** o dia de começar (hoje ou um dos próximos), por 3, 4 ou 5 dias, e quais refeições (almoço, jantar, lanche).
- **Cozinhe tudo de uma vez:**
  - proteínas, carboidratos e legumes somados, com o peso **pronto**;
  - a estimativa **cru** (carnes perdem ~30%; arroz, feijão e massas ganham água);
  - o número de porções.
- **Ordem de preparo:** forno ou air fryer → panelas → vapor → montar os N potes → geladeira até 3 dias. Os potes depois disso vão para o congelador, com a data.
- **Potes:** a lista de cada pote. O que não vai no pote (frutas, pães, laticínios…) aparece como "na hora".
- **Sem IA:** é tudo calculado pelo app.

## 5. 🌙 Hora de dormir
- **Cartão do Sono:** "Você costuma acordar às 06:30: para dormir 8 h, deite até 22:15". O horário de acordar é a mediana das últimas 14 noites, com pelo menos 3 registros.
- **Lembrete:** Ajustes › Notificações › 🌙 Hora de dormir (desligado por padrão).
  - Sai 30 min antes da hora de deitar.
  - Vale mesmo no horário de silêncio, porque foi pedido pela própria pessoa.

## Testes
- **Unitários:** `tests/melhorias8.test.ts` (10), com dados fictícios. Cobrem marmita (somas, cru, potes, congelador, na hora), troca (pedido e só aquela refeição), hora de dormir (mediana, virada da meia-noite, lembrete no silêncio, opção desligada), relatório (mês atual e fechado, só da pessoa) e os atalhos do manifest.
- **Ponta a ponta:** r31. Cobre atalhos (+1 copo, cardápio, refeição, rótulo), trocar com IA falsa, modo marmita, hora de dormir, relatório (seções, só ele ao imprimir, PDF gerado, trocar mês, fechar), celular, Noturno e axe.
- **Regressão (r1–r31): 31/31 OK.** Ajuste só no teste r11: 10 tipos de lembrete (com a hora de dormir).
