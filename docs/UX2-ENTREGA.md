# Ninho · UX, entrega 2: atalhos, semana, Ajustes e busca

Branch: `mapa-11`, feita a partir da `mapa-10` (com o "Não deu"). **Sem migration.**

## O que muda
- **Botão + (Ação rápida) em seções:**
  - Os 4 mais usados ficam no topo: Nova tarefa, Adicionar compra, Planejar o dia com IA e Meu dia.
  - O resto fica agrupado em **Registrar**, **Organizar**, **Casa e cães** e **Semana**.
  - Continuam as 19 ações.
- **"Como está a semana", num lugar só:**
  - Energia e modo sobrevivência viraram um único chip no Início ("🌤 Energia média" ou "🛡 Sobrevivência").
  - O chip abre uma janela com as energias e a chave do modo sobrevivência.
  - O chip "Modo normal" saiu, e os Atalhos têm um botão só para a semana.
- **Ajustes num lugar só:**
  - **Índice no topo:** Aparência · Início · Notificações · Telegram · Conta · Casa · Ajuda.
  - **"O que aparece no Início"** ganhou uma seção própria.
  - **"Ajustes da casa"** reúne:
    - a **Divisão da carga** (abre Nós › Semana › Equilíbrio);
    - a **Escala dos cães**;
    - **Meu dia: metas e privacidade**.
  - Ajustes não acende mais a aba Nós, e o "voltar" leva ao Início.
- **Busca que abre funções:**
  - Digitar "faxinão", "telegram", "escala", "reunião", "vacina", "cansada"… mostra **⚡ Abrir no app**.
  - O resultado leva direto ao lugar: Casa › Faxinão, Ajustes › Telegram, Cães, a reunião, "Como está a semana"…

## Testes
- **Unitários:** `tests/ux2.test.ts` cobre:
  - a busca acha as funções pelo nome e por palavras parecidas;
  - não há id repetido;
  - Ajustes sem aba acesa.
- **Ponta a ponta:**
  - o r49 cobre as seções do botão +, a semana (ligar e desligar o modo sobrevivência), o índice dos Ajustes, os ajustes da casa, a busca abrindo o Faxinão e o Telegram, e o axe;
  - r1, r3 e r22 foram ajustados ao chip único da semana e a Ajustes sem aba acesa.
