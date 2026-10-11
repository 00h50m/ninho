# Linha do tempo do dia

Branch: `linha-do-tempo`, feita a partir da `organizar-dia` (os itens criados pelo "Organizar meu dia" aparecem na linha do tempo). **Sem merge automático.** **Sem migration.**

## Como usar
No **Início › Para agora**, o novo seletor **Lista | Linha do tempo** troca a forma de ver o dia. A escolha fica lembrada neste aparelho. A lista de sempre continua igual.

A linha do tempo mostra o dia de cada pessoa em ordem de horário, separado em **🌅 Manhã, ☀️ Tarde e 🌙 Noite**:
- ✓ **tarefas** e 🐾 **rotinas dos cães** que são dela hoje;
- 📅 **compromissos da agenda** dela e das duas, com hora de fim (1 h). Os da outra pessoa e os vencimentos ficam fora;
- 🔁 **rotinas com passos**, com o fim pela duração e o andamento ("0/2 passos");
- 💊 **remédios**, só de quem está usando o aparelho. Os da outra nunca aparecem.

Além disso:
- **▷ agora** destaca o que está acontecendo ou o próximo item. Uma **linha vermelha com a hora atual** mostra onde você está no dia.
- **Atrasados** ficam em vermelho. Compromisso que já começou não conta como atraso.
- O que não tem horário fica em **"Quando der"**.
- **Dá para marcar daqui:** tarefas, cães e remédios têm o ✓. Tocar numa rotina abre **Rotinas**; tocar num compromisso abre a **Agenda**.
- **No computador**, as duas linhas do tempo ficam lado a lado. **No celular**, o seletor de pessoa continua valendo.

## Ajuste: teste r3 perto da meia-noite
- **Não era defeito do app.** Com o relógio do navegador às 23:40 o teste passa, e nem o banco nem o servidor usam data em UTC.
- **A causa:** o teste fixava "hoje" no começo e, quando rodava perto da meia-noite, o dia virava no meio.
- **A correção:** agora o teste espera a virada se começar entre 23:50 e 23:59.

## Testes
- **Unitários:** `tests/timeline.test.ts` (3), cobrindo:
  - ordem e períodos;
  - "agora" num compromisso em andamento e quando o item anterior está atrasado;
  - linha da hora;
  - agenda da outra pessoa e vencimentos fora;
  - "Quando der" e contagem.
- **Ponta a ponta** (`r21`), com o relógio às 14:10:
  - **seletor:** começa na lista, troca para a linha do tempo e lembra depois de recarregar;
  - **conteúdo:** ordem de horário e os três períodos; agenda (a minha e a das duas); atrasados; "▷ agora" no Dentista (14:00–15:00); fim do compromisso e da rotina com passos; linha 14:10 no lugar certo; "Quando der";
  - **marcar daqui:** tarefa (concluída pela Giovanna) e remédio das 08:00; tocar na rotina abre Rotinas;
  - **privacidade:** no computador, os dois dias lado a lado, sem os remédios da outra;
  - **celular:** abre na escolha guardada, a Sabrina vê o próprio remédio, sem rolagem lateral com texto maior;
  - **acessibilidade (axe):** zero problemas no computador, no celular e no Noturno. O axe achou contraste baixo no destaque do "agora"; virou um contorno verde.
- **Regressão (r1–r21):** veja o resultado na mensagem de entrega.

## Como desfazer
Não mesclar, ou `git revert`. Não há nada no banco.
