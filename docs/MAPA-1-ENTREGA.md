# Mapa do Ninho · Entrega 1 (Fases 1 e 2): reunião que vira ação e o Ninho que fala

Branch: `mapa-1`, feita a partir da `main` (862aa5f). **Sem merge automático.**

Fecha o que faltava das Fases 1 e 2 do "Mapa do Ninho" (outubro).

## Fase 1 · A reunião vira ação
- **O modo combinado liga sozinho na segunda:** ao salvar a reunião com "🛡 Sobrevivência", "⚡ Boss Mode" ou "🌿 Normal", a semana seguinte já começa com esse modo e a energia correspondente (baixa, alta ou média). A semana atual não muda. Dá para trocar depois em Energia da semana.
- **🎯 Prioridades da semana no Início:** as 3 prioridades da última reunião aparecem no topo do Início a semana inteira, com o link "Reunião →".
  - A numeração e os marcadores ("1.", "2)", "-", "•") são limpos.
  - Dá para esconder o cartão em Ajustes › Início, como os outros.

## Fase 2 · O Ninho fala com vocês
Três lembretes novos. Na notificação do app, já vêm **ligados** e dá para desligar em Ajustes › Notificações. Respeitam o horário de silêncio.
- **✅ Tarefas no horário:** na hora marcada da tarefa ou da rotina dos cães, **só para quem é a vez** (a mesma conta do Início: rodízio, escala, compromissos, "só hoje com a outra"). Se já foi feita, não avisa.
- **⏰ Essencial atrasada:** 1 hora depois do horário de uma essencial ainda não feita, **para as duas**, dizendo com quem estava.
- **🌆 Resumo da noite, às 21h:**
  - quanto do dia cada uma fez ("Hoje: 3 de 5 feitas");
  - o que fica para amanhã, com as essenciais primeiro (mostra 3 e "e mais N");
  - o que vence nos próximos 3 dias: contas não pagas e compromissos.

**Pelo Telegram** (Ajustes › Telegram, em cada conversa):
- **🌆 Resumo da noite:** ligado.
- **✅ Tarefas no horário** (e essencial atrasada): desligado, para não receber em dobro quem já tem a notificação do app.

**/semana no Telegram** (e o botão "📅 Semana" no menu do bot):
- quem fez o quê na semana (feitas, pontos, quem cozinhou);
- o balanço;
- o que ainda falta do período (semana, quinzena, mês), com a dona de cada uma;
- as prioridades da reunião.

## Migration 041: `supabase/migrations/20261109120000_telegram_noite_tarefas.sql`
- **`telegram_links.evening`** (ligado) e **`telegram_links.tasks`** (desligado).
- **`telegram_log`** aceita `noite`, `tarefa` e `atraso`, uma vez por dia e referência.
- **Não destrutiva. Pode rodar mais de uma vez.** Já registrada na pós-checagem.
- **Sem a migration** (testado): as notificações do app funcionam todas. Só o Telegram fica sem o resumo da noite e as tarefas, e os dois botões não aparecem.

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run.
3. **Conferência:**
   ```sql
   select count(*) as colunas from information_schema.columns
    where table_schema = 'public' and table_name = 'telegram_links' and column_name in ('evening', 'tasks');
   ```
   O esperado é `2`.
4. **Opcional:** para o "/semana" aparecer na lista de comandos do bot, rode de novo a configuração do bot (`/api/telegram/setup`), como na instalação. Digitado, ele já funciona.

## Testes
- **Unitários:** `tests/mapa1.test.ts` (7), com dados fictícios. Cobrem:
  - as prioridades: limpeza, até 3 e a semana certa;
  - o modo virando os ajustes;
  - a tarefa no horário só para a dona;
  - a feita e a sem horário, que não avisam;
  - o atraso só da essencial e sem virar o dia à meia-noite;
  - o texto do resumo da noite;
  - os padrões e o horário de silêncio.
- **Banco:** `supabase/tests/99w-telegram-noite.test.sql`, nos 3 cenários. Cobre os padrões, os tipos novos, o "não repete no dia" e o tipo desconhecido.
  - O teste antigo da 034 passou a aceitar a regra nova do tipo.
- **Ponta a ponta:** r42. Cobre:
  - o agendador às 07:02, 08:03 e 21:02, nas notificações das duas e no Telegram (ligado e desligado);
  - não repetir;
  - /semana;
  - as prioridades no Início, com axe;
  - salvar a reunião com Sobrevivência e ela ligar na semana seguinte, sem mexer na atual;
  - os botões novos do Telegram.
- **Regressão (r1–r42):** 42/42 OK no código final, e a varredura sem avisos. O r11 foi ajustado: agora são 14 tipos de lembrete com chave.
