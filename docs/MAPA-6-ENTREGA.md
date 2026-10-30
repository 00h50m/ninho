# Ninho · Entrega 6: a retrospectiva vira ajuste

Branch: `mapa-6`, feita a partir da `mapa-5d` (6b0d042). **Sem merge automático. Sem migration.**

## 🧺 Reunião: "Ficou para trás"
Na reunião semanal, logo depois da pauta, aparecem até 5 tarefas que ficaram para trás nas últimas 4 semanas. Cada uma mostra quantas vezes foi feita, por exemplo "feita 3 de 27 dias · última em 19/10", e tem os ajustes de um toque:
- **⇣ Frequência mais leve:**
  - diária vira 3 vezes por semana (seg, qua e sex); se já tem poucos dias, vira 1 vez por semana;
  - semanal vira a cada 2 semanas;
  - quinzenal vira 1 vez por mês.
- **⏸ Pausar 2 semanas.**
- **Trocar quem faz:** "⇄ Passar para…" quando a tarefa é fixa, ou "👤 Só…" quando é rodízio.

O ajuste já vale na hora e entra no item 03, "Ajuste para próxima semana", da reunião. A lista também vai para o rascunho da reunião feito pela IA.

## 💡 Sugestão de ajuste no Início
- **Quando aparece:** uma tarefa diária ou semanal foi esquecida 3 semanas seguidas, ou seja, feita menos da metade das vezes em cada uma. O Início mostra um cartão: "“Regar plantas” ficou para trás nas últimas 3 semanas. Que tal 3 vezes por semana (seg, qua e sex)?".
- **Ações:** os mesmos ajustes de um toque, mais **Agora não**, que esconde a sugestão daquela tarefa por 4 semanas neste aparelho.
- **Mais de uma tarefa:** aparece uma por vez, e o cartão avisa quantas outras estão na reunião.
- **Esconder:** dá para esconder o cartão em Ajustes › Cartões do Início.

## 📊 Domingo no Telegram
O resumo de domingo ganhou a retrospectiva:
```
📊 Retrospectiva da semana
• Giovanna: 23 (semana passada 18 ↑)
• Sabrina: 20 (semana passada 25 ↓)
🏠 Cômodo que mais andou: 🍳 Cozinha (31)
🧺 Mais esquecida: Regar plantas · feita 2 de 27 dias em 4 semanas
```

## Testes
- **Unitários:** `tests/retro.test.ts` agora cobre também o ajuste sugerido, a esquecida 3 semanas seguidas e o resumo de domingo. 454 no total.
- **Ponta a ponta:** r45 cobre o cartão do Início (aplicar, Agora não, recarregar), a reunião (pausar, só a Sabrina, item 03) e o domingo no Telegram, com axe.
