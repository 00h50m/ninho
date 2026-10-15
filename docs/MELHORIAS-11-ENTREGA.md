# Melhorias 11: ideias de presente e compromissos que mexem no dia

Branch: `melhorias-11`, feita a partir da `melhorias-10`. **Sem merge automático.**

## 🎁 Ideias de presente (Nós › 🎁 Presentes)
- **Privacidade:** só a dona vê a própria lista. A outra não enxerga nada, nem com o compartilhamento do Meu dia ligado, nem pelo Telegram. Quem garante é o banco, não só a tela.
- **Ideias:** o que ela comentou que queria, com detalhes (tamanho, cor, onde viu), link, faixa de preço e, se quiser, para qual data.
  - **Andamento:** 💡 ideia → 🛍️ **Comprei** → 🎁 **Dei**.
  - **Já dei:** o que já foi dado fica guardado com a data, para não repetir presente.
  - **Ordem:** as ideias da data mais perto vêm primeiro.
- **Datas especiais:** sugestões com um toque (aniversário dela, aniversário de namoro, Dia dos Namorados, Natal), ou qualquer outra.
  - Cada data mostra a contagem ("em 14 dias") e quantas ideias tem.
  - 29/02 vira 28/02 nos anos que não são bissextos.
- **Lembrete no celular:** às 9h, 14 e 3 dias antes e no dia, só no aparelho da dona. A mensagem diz quantas ideias já estão anotadas. Em Ajustes › Notificações fica o tipo **🎁 Datas especiais**, ligado por padrão.
  - O lembrete aparece na tela de bloqueio. Se o celular costuma ficar à vista da outra, dá para desligar ali.
- **Pelo Telegram:**
  - `/presente fone sem fio azul https://… até R$ 200` anota na hora, separando o link e a faixa de preço.
  - `/presentes` mostra a sua lista e as próximas datas.

## 📅 Compromissos que mexem no dia (Casa › Agenda → tarefas)
- **Hora de fim:** o compromisso ganha o campo **Até** (ex.: Dentista 14:00–16:00). Sem fim marcado, conta 1 hora. A Agenda e o calendário do celular mostram o intervalo.
- **Com horário e "quem vai", o dia se ajusta sozinho:**
  1. **Passa para a outra:** a tarefa ou rotina dos cães sem dona fixa que cai no horário (ela ocupa uns 30 min) vai para a outra pessoa. Na lista aparece "↪ hoje com Sabrina", e o "por que é minha vez?" explica: "Giovanna tem Dentista (14:00–16:00)".
  2. **Avisa e sugere:** tarefa com dona fixa, ou com as duas ocupadas, não muda sozinha. Aparece "⚠ Dentista 14:00–16:00" na tarefa, e o menu ⋯ explica e oferece:
     - **↪ Só hoje com a Sabrina** (amanhã volta ao normal; a responsável de sempre não muda);
     - **⏭ Deixar para amanhã**;
     - **✎ Editar** para mudar o horário.
     O antigo "Passar para" virou **"Passar para … de vez"**.
  3. **Dia cheio = menos tarefas:** com 4 h ou mais de compromissos no dia, as tarefas sem hora marcada e sem dona fixa vão para a outra (se ela não estiver com o dia cheio também).
- **O que não conta:** vencimentos, compromissos feitos e os sem "quem vai".
- **Mesma conta em todo lugar:** app, Telegram (/hoje, bom dia, IA) e notificações.

## Migration 036: `supabase/migrations/20261104120000_presentes_compromissos.sql`
- **`gift_dates`:** nome, dia e mês (não aceita dia que não existe), de quem é a data.
- **`gift_ideas`:** o quê, detalhes, link (só http/https), faixa de preço, data, andamento e quando foi dada.
- **`house_events.end_time`:** "HH:MM", depois do começo.
- **`task_handoffs`:** "só hoje com a outra", um por tarefa e dia; regra de acesso da casa (`household_member`) e tempo real.
- **Regra de acesso `owner_only`:** só a dona lê e grava. Já registrada na 011, no rollback e na pós-checagem.
- **Não destrutiva. Pode rodar mais de uma vez.**
- **Sem a migration** (testado): a aba de presentes avisa "migration 036", o Telegram também, e os lembretes seguem normalmente. A Agenda carrega e salva sem a hora de fim (conta 1 hora), o "Hoje" funciona sem o "só hoje".

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run.
3. **Conferência:**
   ```sql
   select (select count(*) from pg_policies where tablename in ('gift_ideas', 'gift_dates') and policyname = 'owner_only') as presentes,
          (select count(*) from information_schema.columns where table_name = 'house_events' and column_name = 'end_time') as fim,
          (select count(*) from pg_policies where tablename = 'task_handoffs') as so_hoje;
   ```
   O esperado é `2 | 1 | 1`.

## Testes
- **Unitários:** `tests/melhorias11.test.ts` (18), com dados fictícios. Cobrem:
  - próxima data, incluindo virada de ano e 29/02;
  - contagem e ideias por data;
  - sugestões de datas;
  - leitura do `/presente`;
  - link só http(s);
  - ordem das ideias;
  - lembretes de 14 e 3 dias e do dia, só para a dona e só às 9h;
  - janelas ocupadas, conflito de 30 min, minutos somando sobreposições, dia cheio;
  - troca da dona (sem dona fixa passa, fixa avisa, as duas ocupadas avisa, só hoje), no modo inteligente e no rodízio;
  - hora de fim no calendário do celular.
- **Banco:** `supabase/tests/99r-presentes.test.sql`, nos 3 cenários. Cobre:
  - só a regra `owner_only`;
  - a outra não vê nem com tudo compartilhado, não escreve e não altera;
  - outra casa e sem login não veem;
  - dia inexistente, link estranho e andamento desconhecido recusados;
  - fim antes do começo recusado, um "só hoje" por tarefa e dia, a outra da casa vê e outra casa não vê.
- **Ponta a ponta:** r34.
- **Regressão (r1–r34):** 34/34 OK (r11 ajustado só no teste: 11 tipos de lembrete).
