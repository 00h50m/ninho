# Casa › 💡 Sugestões

Branch: `sugestoes`, feita a partir da `escala-caes`. **Sem merge automático.** Sem migration.

## Como funciona
Uma aba nova em **Casa** com mais de 60 ideias para manter a casa organizada e limpa e os cães bem cuidados:
- **Áreas:** Cozinha, Banheiro, Roupas, Casa e organização, Aparelhos (robôs, ar-condicionado, purificador), Compras e planejamento, Plantas e Pets.
- **Cada sugestão** traz a frequência ("toda semana", "a cada 15 dias"…) e uma frase do porquê.
- **"Só o que falta" (ligado por padrão):** esconde o que vocês já têm, pelo nome. Nomes parecidos também contam: "Louça da manhã" cobre "Louça diária"; "Aspirador Klebin" cobre "Varrer / aspirar"; "Limpar banheiro 1" cobre as tarefas de banheiro. Desligado, mostra tudo com "✓ já tem".
- **+ Adicionar:** cria na hora, **alternando** entre vocês. Depois dá para mudar dias e quem faz na própria tarefa.
- **✎:** abre o formulário da tarefa já preenchido, para escolher dias e dona antes de criar.
- **Pets:** entram como **rotina dos cães** (aba Cães), uma para cada cão, sem horário. Por isso continuam alternando mesmo com a escala fixa. Vacina, vermífugo e antipulgas continuam em Cães › Saúde.
- **Janela antiga:** a de sugestões (cerca de 25 itens) saiu. Os botões "✦ Sugestões" agora levam para a aba.

## Testes
- **Unitários:** `tests/sugestoes.test.ts` (4). Cobrem:
  - catálogo com nomes únicos e valores válidos;
  - "já tem" por nome e por nome parecido;
  - pets olhando só as rotinas;
  - vista do que falta;
  - botões antigos.
- **Ponta a ponta:** r37. Cobre:
  - abrir a aba;
  - "já tem" e "só o que falta";
  - adicionar tarefa alternando;
  - adicionar cuidado de pet em cada cão;
  - ajustar antes de criar;
  - botão antigo;
  - axe.
- **Regressão (r1–r37):** 37/37 OK. O r37 rodou nesta branch; o r1–r36 rodou na `melhorias-12`, que inclui esta entrega por inteiro.
