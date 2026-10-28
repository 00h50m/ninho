# Mapa do Ninho · Entrega 4a (Fase 5): Retrospectiva com gráficos

Branch: `mapa-5a`, feita a partir da `main` (80db78c, com a entrega 3). **Sem merge automático. Sem migration.**

## 📊 Retrospectiva (Nós › Histórico)
Um cartão novo, acima das Sequências. Usa o histórico que o app já carrega (62 dias), então não faz nenhuma consulta nova ao banco.

- **Semana a semana:**
  - Barras das duas, lado a lado, nas últimas 8 semanas (tarefas e rotinas dos cães).
  - Cada uma tem sua cor do tema e a Sabrina também tem listras, para dar para diferenciar sem depender da cor (daltonismo, tema Aurora, impressão).
  - Toque numa semana para ver os números dela. A semana atual já começa mostrando os seus.
  - **Ver em tabela** mostra todos os números; conclusões antigas sem autoria aparecem numa coluna à parte.
- **Por cômodo (últimos 28 dias):** do que mais teve ao que menos. As rotinas dos cães contam em 🐾 Cães.
- **Mais esquecidas (últimos 28 dias):** até 5 tarefas, da mais esquecida para a menos. Por exemplo, "feita 2 de 27 dias · última em 23/10".
  - Diária conta em dias e semanal em semanas (quinzenal e mensal também).
  - Respeita os dias da semana, o período De…até, a pausa e a data em que a tarefa foi criada.
  - Hoje e a semana/mês em andamento só contam se já foram feitos, porque ainda há tempo.
  - Pontuais ficam de fora.
- **Casa sem histórico:** o cartão explica que os gráficos aparecem conforme as tarefas forem marcadas.

## Testes
- **Unitários:** `tests/retro.test.ts` cobre semanas por pessoa, por cômodo e esquecidas (diária, semanal, criação, pausa, período, pontual, limite de 5).
- **Ponta a ponta:** r44. Confere:
  - a tabela somando exatamente o que está no banco;
  - o toque numa semana;
  - a ordem por cômodo e das esquecidas;
  - os temas Aconchego, Aurora, Noturno, Minimal e Natureza, em 320, 390, 1024 e 1440 px, sem rolagem lateral e com axe;
  - a casa sem histórico.
