# Organizar meu dia

Branch: `organizar-dia`, feita a partir da `faxinao` (usa o mesmo motor de IA e o microfone). **Sem merge automático.** Mesclar depois da `faxinao`, ou junto com ela.

## Como usar
1. Abra pelo **Início › 🗓️ Organizar meu dia** (atalho no topo) ou por **Ação rápida › Organizar meu dia**.
2. **Despeje tudo o que precisa fazer**, do seu jeito. Pode escrever ou **🎤 falar**. Exemplo: "dentista 14h30, pagar o boleto da luz, responder a Ana, comprar ração, academia".
3. **✨ Organizar.** A IA monta o dia **em ordem**, encaixado no que **já está no app hoje** (tarefas, rotinas dos cães e compromissos da agenda), sem repetir nada:
   - o que tem **hora marcada** fica no horário dito;
   - o **mais importante e pesado** vai para quando costuma haver mais energia;
   - **coisas na rua** ficam em sequência;
   - **tarefas rápidas** ficam agrupadas;
   - há **folga** entre blocos, e nada passa das 22h;
   - **se não couber hoje,** o que pode esperar vai para **amanhã**, com uma dica explicando.
4. **Cada item vira o que faz sentido:**
   - ✓ **tarefa** avulsa (com hora, quem faz e "importante");
   - 📅 **compromisso** na agenda;
   - 🛒 **compra** na lista de compras.
5. **Confira:** dá para mudar o nome, a hora, o dia (Hoje/Amanhã) e quem faz (você, a outra ou as duas), ou tirar itens. Depois toque em **Criar no app (N)**. Tudo é criado de uma vez e aparece no Início, na agenda e nas compras.

## Extras
- **Sem IA:** se a IA não responder, ou não estiver configurada naquele endereço, **"Criar como tarefas de hoje, sem ordem"** transforma cada item do texto numa tarefa de hoje para quem escreveu.
- **Telegram:** "**organiza meu dia: dentista 14h30, boleto, mercado**" faz o bot responder com o dia em ordem (horário, ícone e título) e os botões **Confirmar / Cancelar**. Nada é criado antes de confirmar. O /ajuda foi atualizado.
- **Microfone:** o reconhecimento de voz do Faxinão virou um componente único (`hooks/useSpeech.ts`), usado nas duas telas.

## Segurança e uso
- **Quem pede:** a rota `/api/ai/dia` exige login de alguém desta casa.
- **O que vai para a IA:**
  - o texto, marcado como dado;
  - os primeiros nomes;
  - data e hora;
  - os títulos e horários do que já está no app hoje.
- **A IA não grava nada.** Quem cria os itens é o app (com o login de quem usa) ou o bot, depois do Confirmar.
- **Limite:** 20 dias organizados por casa a cada 24 h.
- **Modelo:** `claude-opus-5-5`, com saída estruturada, esforço baixo e fallback automático. Custo de cerca de 1 a 3 centavos de dólar por pedido.
- **Conferência da resposta:**
  - datas só de hoje até 7 dias;
  - horários válidos;
  - tipos e categorias conhecidos;
  - no máximo 25 itens;
  - item com data ou hora inválida cai em hoje, sem hora.

## Banco
**Sem migration.** Usa as tabelas que já existem:
- `tasks` (avulsa, `frequency = 'once'`);
- `house_events`;
- `shopping_items` (via `ninho_add_shopping_item`);
- `ai_log` (tipo `dia`).

## Testes
- **Unitários:** 290/290. Novo: `tests/organizar.test.ts` (3), cobrindo:
  - conferência da resposta (datas, horas, tipos, ordem);
  - sem IA;
  - como cada item vira tarefa ou compromisso;
  - fim estimado;
  - contexto.
- **Ponta a ponta** (`r20`):
  - **organizar:**
    - atalho no topo e ação rápida;
    - pedido à IA com as regras de ordem;
    - contexto com quem escreve, a reunião que já estava na agenda e o despejo marcado como dado;
    - uso registrado;
    - resumo, dica e ordem por hora;
    - item inválido corrigido;
  - **editar e criar:**
    - tirar um item; mudar título, hora, dia e quem faz;
    - as tarefas avulsas são gravadas com dia, hora, quem e "importante";
    - o compromisso vai para a agenda e a compra para a lista;
    - aviso e tarefa visível no Início;
  - **sem IA:** aviso e criação das tarefas na ordem escrita;
  - **Telegram:**
    - o dia volta em ordem, com Confirmar;
    - nada é criado antes de confirmar;
    - depois, tarefa, agenda e compra são criadas pela Sabrina;
    - o /ajuda cita o comando;
  - **celular com texto maior:** sem rolagem lateral;
  - **acessibilidade (axe):** no computador, no celular e no Noturno.
- **Regressão (r1–r19):** veja o resultado na mensagem de entrega.

## Como desfazer
Não mesclar, ou `git revert`. Não há nada no banco para desfazer.
