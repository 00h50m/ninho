# Botão voltar do celular

Branch: `voltar-celular`, feita a partir da `main` (418f42c). **Sem merge automático.** Sem migration.

## O problema
O Ninho troca de tela sem criar entradas no histórico do navegador. Por isso, no Android (e no app instalado), o botão voltar fechava o app direto, em qualquer tela, até com uma janela aberta.

## Como fica
O voltar agora segue esta ordem:
1. **Janela aberta:** fecha a folha de cima (tarefa, evento, busca, sprint, relatório do mês etc.) e fica na mesma tela. Folhas uma sobre a outra fecham uma por vez.
2. **Telas e abas:** volta para a anterior, na ordem em que você navegou (ex.: Cães → Casa › Compras → Casa › Tarefas → Início). Vale também para as abas de Casa, Nós, Rotinas e Meu dia.
3. **No Início:** aparece "Toque em voltar de novo para sair do Ninho". Só o segundo voltar seguido sai do app. Se você tocar na tela antes, o aviso recomeça.

**Casos especiais:**
- **Assistente de configuração:** o voltar vai para o passo anterior; no primeiro passo, pausa e fecha (guardando o progresso, como o ✕).
- **App aberto direto numa tela** (pelo link de uma notificação, por exemplo): o voltar leva ao Início antes de sair.
- **Escolha obrigatória** (quem está usando o aparelho): a folha não fecha com o voltar.
- **Janela fechada pelo ✕:** o voltar seguinte já muda de tela, sem "toque perdido".
- **Trocar de janela** (menu da tarefa → Editar): um voltar fecha tudo, sem reabrir o menu.

**Onde está no código:**
- `lib/backNav.ts` (pilha de telas e janelas);
- `hooks/useBack.ts`;
- `components/ui/Sheet.tsx` (todas as folhas);
- Sprint, Relatório do mês e Assistente;
- `NinhoApp.tsx` (tela e abas).

## Testes
- **Unitários:** `tests/voltar.test.ts` (7), com um histórico de navegador simulado. Cobrem:
  - ordem das telas;
  - aviso e saída no Início;
  - folha fecha antes de mudar de tela;
  - folha fechada no ✕;
  - troca de folha;
  - folhas empilhadas;
  - assistente passo a passo;
  - app aberto direto numa tela.
- **Ponta a ponta:** r35, no navegador emulando o celular e apertando o voltar de verdade. Cobre:
  - telas e abas (Casa, Compras, Cães, Meu dia › Alimentação);
  - folha da tarefa;
  - menu → editar;
  - busca fechada no ✕ e pelo voltar;
  - aviso no Início e saída no segundo voltar.
- **Regressão (r1–r35):** 35/35 OK.
