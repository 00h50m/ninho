# Ninho · Navegação nova (UX, entrega 1)

Branch: `mapa-9`, feita a partir da `main` (130b620). **Sem migration.**

## O que mudou
- **Barra de baixo com 5 abas:** Início · Meu dia · Casa · Cães · Nós. A aba Rotinas saiu da barra:
  - **rotinas com passos** (como "fechar a cozinha") → **Casa › Tarefas › 🔁 Rotinas**;
  - **hábitos** → **Meu dia › ✅ Hábitos**.
- **Casa em 4 grupos:**
  - **Tarefas:** Tarefas e Rotinas;
  - **Compras:** Lista, Despensa e Jantar;
  - **Agenda:** sai do "Mais" e ganha lugar próprio;
  - **Mais:** Manutenção, Faxinão e Sugestões.
- **Nós em 3 abas:**
  - **Semana:** Resumo e Equilíbrio;
  - **Juntas:** Desafios, Álbum e Presentes;
  - **Histórico.**
- **Nome mais claro:** "Organizar meu dia" virou **"Planejar o dia"** (com IA).
- **Links antigos continuam funcionando:**
  - o lembrete de rotina (`?ir=rotinas`) abre Casa › Rotinas;
  - novo `?ir=habitos`, que abre Meu dia › Hábitos;
  - atalhos e busca que levavam a "Rotinas" levam para Casa › Rotinas.
- Cada grupo continua lembrando a última sub-aba aberta.

## Testes
- **Unitários:** 457, todos passando. O menu tem 5 áreas, "rotinas" leva para Casa e os grupos da Casa estão na ordem nova.
- **Ponta a ponta:**
  - o r47 é novo e cobre a barra com 5 abas, Casa › Rotinas, Meu dia › Hábitos, Nós com 3 abas, os links antigos, o nome novo, o computador e o axe;
  - os testes antigos foram ajustados para navegar pelo caminho novo;
  - regressão completa r1–r47.
