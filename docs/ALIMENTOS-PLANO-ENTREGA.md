# Alimentos do plano em "Meus alimentos" e Montar refeição

Branch: `alimentos-plano`, feita a partir da `main`. **Sem merge automático.** **Sem SQL.**

## O que muda
- **Cada alimento do plano entra em Meus alimentos, um por um**, com a **porção do plano** e as **calorias dessa porção**. Entram:
  - todas as refeições, opções e alternativas;
  - as listas de substituição (ex.: "Frutas");
  - quando a tabela do Ninho reconhece o alimento, também proteína, carboidrato e gordura.

  As calorias escritas pela nutricionista valem mais que a tabela: se a tabela diverge mais de 25%, ficam as calorias do plano, sem macros inventados.
- **Ao salvar um plano novo, isso acontece sozinho.** O aviso diz quantos entraram (ex.: "Plano salvo · 23 alimento(s) em Meus alimentos").
- **Para o plano que já está salvo:** em **Meu dia › Alimentação**, no cartão do plano, aparece **"🥗 N alimento(s) do plano ainda não estão em Meus alimentos"**, com a lista (porção, kcal e de onde vem) e o botão **Lançar N alimento(s)**.
- **Nada se repete:** um alimento com o mesmo nome entra uma vez só, e o que já estava em Meus alimentos não é duplicado nem alterado.
- **🧩 Montar com meus alimentos** (em Registrar refeição):
  - busque e toque nos alimentos;
  - ajuste a quantidade de **½ em ½ porção** (− / +);
  - veja o **total de calorias e macros** enquanto monta;
  - salve. O nome da refeição é a lista dos alimentos, se você não escrever nada.
- **Meus alimentos** ganhou **busca** quando há mais de 8.
- **Privacidade:** é tudo pessoal, como antes. A Sabrina não vê os alimentos da Giovanna, e vice-versa.

## Testes
- **Unitários:** `tests/planFoods.test.ts` (2), cobrindo:
  - cada alimento uma vez, com a porção e as calorias do plano;
  - calorias do plano valem mais que a tabela;
  - sem calorias, fica de fora;
  - listas de substituição entram;
  - o que já existe não repete.

  Total: 304/304.
- **Ponta a ponta** (`r25`), com plano fictício:
  - **plano já salvo:**
    - aviso com 7 alimentos (o ovo já existia; o pão repetido conta uma vez; as frutas da lista entram);
    - lista com porção, kcal e origem;
    - lançar: 7 em Meus alimentos, com macros quando a tabela reconhece;
  - **montar:**
    - busca;
    - 2 pães + 1 iogurte = total certo;
    - refeição salva com os itens;
  - **plano novo:** só o alimento novo entra, com o aviso;
  - **a Sabrina não vê** os alimentos da Giovanna;
  - **celular com texto maior:** sem rolagem lateral;
  - **acessibilidade (axe):** sem problemas no computador, no celular e no Noturno.
- **Regressão (r1–r25):**
  - **r16** mudou de número de propósito: com as calorias do plano valendo, o café do plano de teste dá 300 kcal (antes 296, pela tabela) e a troca pelo frango, 250 (antes 248).
  - **r3 e r11** falhavam entre 21h e meia-noite, já na `main`. Não era defeito do app:
    - o arquivo de dados de teste (`supabase/tests/01-legacy-production.sql`) usava a data em UTC. Agora usa a de São Paulo, e os testes do banco continuam passando;
    - o r11 marca uma visita "daqui a 50 minutos", e passou a esperar a virada do dia.

## Como desfazer
Não mesclar, ou `git revert`. Os alimentos lançados podem ser removidos um a um em Meus alimentos.
