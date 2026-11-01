# Ninho · Guia novo, "O que mudou", Telegram com ✓/Não deu e resumo da noite curto

Branch: `mapa-12`, feita a partir da `main` (0031188). **Sem migration.**

## O que muda
- **Guia do Ninho reescrito** (Ajustes › Ajuda):
  - começa com **🧭 Onde fica cada coisa** (as 5 abas, o + e a busca);
  - explica o app como ele está agora: Rotinas em Casa, Hábitos no Meu dia, Nós em 3 abas, "Não deu", "Como está a semana", Faxinão, Telegram…
  - Os caminhos antigos saíram.
- **✨ O que mudou no Ninho:**
  - um cartão no Início, logo depois da lista do dia, com as novidades;
  - aparece uma vez em cada aparelho: "Entendi" esconde, e "Ver o guia completo" abre a Ajuda.
- **Lembrete de tarefa no Telegram com botões:**
  - O lembrete no horário e o aviso de essencial atrasada chegam com **✓ Feito** e **⤼ Não deu**, além de **📋 Ver hoje**.
  - Um toque resolve. A mensagem passa a mostrar o que aconteceu ("✓ Remédio · +2 XP" ou "⤼ Não deu hoje · Regar") e os botões somem.
  - Quem toca fica registrada.
- **Resumo da noite mais curto** (notificação e Telegram):
  - **dia fechado:** "Dia fechado: 5 de 5 feitas. 🎉";
  - **faltou pouco** (até 2): só o que faltou;
  - **faltou mais:** só quantas, "sem pressa";
  - **nada no dia nem nos próximos:** não manda.

## Testes
- **Unitários:** 464, todos passando. O resumo da noite tem testes para dia fechado, pouco, muito e nada.
- **Ponta a ponta:**
  - o r50 cobre o aviso (posição, "Entendi", não volta), o guia novo sem os caminhos antigos, o lembrete com botões (Não deu e Feito, por quem tocou), o resumo do dia fechado e o axe;
  - o r42 foi ajustado ao texto novo do resumo da noite.
