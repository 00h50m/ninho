# Reunião semanal com IA: rascunho e resumo no Telegram

Branch: `reuniao-ia`, feita a partir da `mascote`. **Sem merge automático.** **Sem migration.**

## Como usar
Abra a **Reunião semanal** (Ação rápida, Atalhos ou Nós).

1. **✦ Rascunho da reunião com IA:** a IA lê a semana e preenche:
   - o que funcionou;
   - o que pesou;
   - **um** ajuste concreto;
   - até 3 prioridades;
   - as vitórias;
   - até 4 combinados (com quem faz);
   - o modo da próxima semana.

   A IA usa o placar, as tarefas, a energia, a reunião anterior e a pauta que o app já mostra (check-ins, registro do dia, desafios, combinados).
2. **Ela só preenche o que está vazio.**
   - O que vocês já tinham escrito **não muda**.
   - Um combinado igual a um que já existe não entra de novo.
   - O modo só muda se ainda estiver em "normal".

   O app mostra um resumo de 2–3 frases e quantos itens a IA preencheu. **Desfazer rascunho** volta tudo ao que era.
3. **Conferir, editar e salvar.** No rodapé, marque **📨 Mandar o resumo no Telegram das duas**.
   - O resumo leva: humor de cada uma, o que funcionou, o que pesou, o ajuste, as prioridades, as vitórias, os combinados (☑/☐ e quem faz), o modo da próxima semana e a recompensa.
   - Ele é montado **a partir da reunião salva no banco**, não do que o celular manda.
   - **Se ninguém ligou o Telegram,** a reunião é salva mesmo assim, e o aviso explica.

O botão antigo continua como **"✦ Só sugestões de ajuste"**.

## Segurança e uso
- **Login:** as rotas `/api/ai/reuniao` e `/api/reuniao/resumo` exigem login de alguém desta casa.
- **O que vai para a IA:**
  - os fatos da semana;
  - a pauta como texto, marcada como dado e limitada a 40 linhas.
- **A IA não grava nada.**
- **Limite:** 10 rascunhos por casa a cada 24 h (tipo `reuniao` no `ai_log`).
- **Modelo:** `claude-opus-5-5`, com saída estruturada, esforço baixo e fallback automático. Custo de cerca de 1 a 3 centavos de dólar por rascunho.

## Testes
- **Unitários:** `tests/reuniao.test.ts` (3), cobrindo:
  - conferência do rascunho;
  - preenche só o vazio, sem combinado repetido, e respeita o modo escolhido;
  - texto exato do resumo.
- **Ponta a ponta** (`r23`):
  - **rascunho:**
    - pedido à IA com saída estruturada;
    - contexto com os fatos e a pauta marcada como dado;
    - uso registrado;
    - o texto já escrito fica; campos vazios preenchidos; combinado repetido não entra; modo sobrevivência;
    - resumo da IA e "Preenchi 6 item(ns)";
    - desfazer;
  - **salvar e mandar no Telegram:**
    - a reunião é gravada com o rascunho;
    - as duas recebem o mesmo resumo, com os combinados e o modo;
    - aviso "enviado (2)";
  - **sem IA:** aviso;
  - **sem Telegram ligado:** a reunião é salva e o aviso explica;
  - **rota sem login:** recusada;
  - **celular com texto maior:** sem rolagem lateral;
  - **acessibilidade (axe):** no computador, no celular e no Noturno.
- **Regressão:** veja o resultado na mensagem de entrega.

## Como desfazer
Não mesclar, ou `git revert`. Não há nada no banco.
