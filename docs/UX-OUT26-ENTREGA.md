# Ninho · Revisão de UX (outubro/2026) e Faxinão de uma pessoa só

Branch: `mapa-8`, feita a partir da `main` (2424525). **Sem merge automático. Sem migration.**

## Bug corrigido
- **Faixa da próxima tarefa:** a faixa "▸ próxima tarefa às HH:MM" em "Para agora" não quebrava a linha. Com um nome comprido, a página do celular ficava mais larga que a tela (615 px num aparelho de 360). Agora quebra a linha.

## Início
1. **A lista do dia no topo.** "Para agora" e as listas das duas vêm logo depois da saudação. O Nino, a semana e a sugestão de ajuste vão para depois. No celular de 360 px, "Para agora" já aparece na primeira tela.
2. **Os números numa linha só:** Hoje, Nível, Sequência e o desafio (só quando há um).
3. **Sem o "Casa em alerta!" vermelho.** As atrasadas continuam em destaque em "Para agora".
4. **Cartões vazios somem:**
   - "Próxima rotina" só aparece quando há rotina no dia;
   - o Sobrou fora do ar vira uma linha discreta, com "Tentar de novo";
   - o desafio só aparece quando há um.
5. **Atalhos em uma linha de botões,** em vez de 5 linhas grandes.
6. **Atalho 🧹 Faxinão** no topo, junto de "Organizar meu dia". Enquanto um Faxinão está rolando, o botão vira "Faxinão em andamento".

## Outras telas
- **Balanço:** a Sabrina agora usa a cor dela (lilás) em todo o app; antes, no Balanço, aparecia em terracota.
- **Nós › Semana:**
  - "Juntas nesta semana" vira uma frase com o que aconteceu, por exemplo "Vocês já fizeram 12 tarefas e 2 sprints", sem a fileira de zeros;
  - sem combinados, o cartão some;
  - sem desafio, aparece um link discreto para escolher um.
- **Meu dia › Hoje:** o resumo fica com 3 blocos por linha no celular, mais enxuto.

## 🧹 Faxinão de uma pessoa só
- **Na criação,** os botões de "Quem participa" ficam: **As duas · Só eu · Só a outra**.
- **Na conferência,** de um rascunho ou de um modelo, entra a linha **"Quem faz: As duas dividem · Tudo comigo · Tudo com a outra"**.
  - Quando fica tudo com uma pessoa, some a escolha por passo e o resumo mostra "só Giovanna".
  - "As duas dividem" redistribui pelo tempo: o próximo passo vai para quem está com menos minutos.
- **No Telegram,** "faxinão só eu: pia e lixo" (ou "faxinão sozinha: …") monta tudo para quem mandou.

## Testes
- **Unitários:** 457, todos passando. Os 3 novos cobrem o Faxinão de uma pessoa só.
- **Ponta a ponta:** r46 é novo e cobre as mudanças de UX e o Faxinão de uma pessoa só (app e Telegram). Na regressão completa (r1–r46), passaram todos os 46.
  - r3, r10, r12, r24 e r27 foram ajustados porque procuravam o layout antigo: a grade de números e o cartão de erro do Sobrou.
  - r1, r12 e r46 rodaram de novo depois do último ajuste dos atalhos.
- **Varredura:** 9 variações e 648 telas, sem rolagem lateral, cortes, botões pequenos, problemas de acessibilidade (axe) ou erros.
