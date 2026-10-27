# Estabilizar: Faxinão, Casa mais limpa e varredura estendida

Branch: `estabilizar`, feita a partir da `main` (fd096c8). **Sem merge automático. Sem migration.**

## Faxinão
- **Cancelar faxinão:** o que está em andamento some e não vai para o histórico. Como o Faxinão não dá XP, ninguém perde pontos.
- **✕ em cada faxinão de "Últimos faxinões":** apaga um do histórico.
- **Zerar Faxinão:** apaga o histórico e os rascunhos. Os modelos ficam.

## Aba Casa
- **4 abas no topo:** Tarefas · Compras · 🍲 Comida · ☰ Mais.
  - **Comida:** Jantar e Despensa.
  - **Mais:** Manutenção, Agenda, Faxinão e Sugestões.
  - Os grupos com mais de uma aba mostram uma segunda linha pequena.
  - Cada grupo lembra a última aba aberta.
  - O número de cada grupo é a soma das abas dele.
  - Sem a migration 038, o grupo Comida não aparece.
- **Cartão de tarefa mais limpo:** saíram os atalhos tracejados "○ essencial" e "+ horário". Ficam só "● essencial" (toque para tirar) e o horário marcado. Para marcar essencial ou pôr horário, use o ✎ da tarefa.
- **Botão + flutuante:**
  - não aparece em Compras, que já têm o campo de adicionar;
  - nas outras telas, some enquanto você rola para baixo e volta ao rolar para cima, para não cobrir os botões dos itens;
  - com "menos animação", não tem transição.

## Varredura estendida
Além das telas e janelas da revisão anterior, entraram mais 11 janelas: manutenção, agenda, reunião, novo pet, saúde do cão, nova rotina, treino, objetivo, receita e as do Faxinão. Elas foram passadas nestas condições:
- **casa cheia:** 60 tarefas, 40 compras, um mês de histórico e nomes enormes;
- **letra "Maior"** (360 e 1280);
- **alto contraste;**
- **celular deitado** (844×390);
- **sem internet.**

**Encontrado e corrigido:**
1. **Letra "Maior" em celular pequeno:** a tabela do Balanço da semana alargava a página em 84 px. A barra de baixo e os botões saíam do lugar, e as janelas seguintes não abriam. Agora a tabela rola dentro do cartão.
2. **Reunião semanal:** as caixinhas de marcar tinham 13 px. Agora têm 20 px e a linha toda tem pelo menos 32 px.
3. **Nova manutenção:** "Última vez" e "Próxima vez" não tinham rótulo ligado ao campo (leitor de tela). Agora têm.
4. **Aviso (toast):** o ✕ tinha 19 px. Agora tem 24.

**Sem problemas:**
- casa cheia;
- alto contraste;
- celular deitado;
- sem internet (o app abre e navega com o que está guardado).

## Testes
- **Unitários:** 436, incluindo `tests/estabilizar.test.ts` (grupos da Casa).
- **Varreduras:** depois das correções, a base nos 4 tamanhos e a letra "Maior" estão sem avisos.
- **Ponta a ponta:** r41 (novo) cobre:
  - os grupos e a volta para a última aba;
  - o cartão limpo;
  - o + flutuante fora das Compras e escondido ao rolar;
  - cancelar, apagar e zerar o Faxinão;
  - axe.
- **Testes antigos:** os que entravam direto em Agenda, Despensa etc. agora abrem o grupo antes.
- **Regressão (r1–r41):** 41/41 OK no código final. Testes antigos ajustados à Casa em grupos (abrir "Comida" ou "Mais" antes da aba): r1, r7, r8, r11, r12, r19, r33, r34, r37, r38 e r40.
