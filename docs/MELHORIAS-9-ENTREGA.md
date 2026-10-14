# Melhorias 9: água pelo Telegram, cardápio no bom dia, progressão de carga e busca em tudo

Branch: `melhorias-9`, feita a partir da `main` (904adf7). **Sem merge automático.**

## 1. 💧 Água pelo Telegram (com "+1 copo")
- **Como ligar:** Ajustes › Telegram › **💧 Lembretes de água**, uma chave por pessoa (desligada por padrão).
- **Quando chega:** nos mesmos horários do lembrete do app (de 9h30 às 20h) e **só quando está atrás do ritmo**. Cada horário vale uma vez, mesmo com o agendador rodando de 5 em 5 minutos.
- **Botão "💧 +1 copo (250 ml)":**
  - usa o tamanho do seu copo e registra na hora;
  - a mensagem passa a mostrar o novo total e o botão "Mais um copo" (cada toque é um copo).
- **/agua:** mostra a água de hoje, com o botão, a qualquer hora.
- **Privacidade:** cada conversa registra só para a pessoa daquela conversa.

## 2. 🗓️ Cardápio de hoje no bom dia (Telegram)
- **O que chega:** se há cardápio para hoje, a mensagem da manhã traz cada refeição com os itens e as kcal (sem kcal para quem esconde as calorias).
- **Botões:** um **"✓ Lançar <refeição>"** por refeição.
  - Lança com os itens do cardápio, uma vez por dia e refeição; tocar de novo avisa "já estava lançado".
  - O botão lançado some da mensagem.
  - Botão de outro dia não lança.
- **Privacidade:** só o cardápio da pessoa da conversa.

## 3. 📈 Progressão de carga (Meu dia › Treinos)
- **Próxima carga:** a sugestão para cada exercício com carga (dos últimos 60 dias), com as de subir primeiro. É dupla progressão, na faixa de 8 a 12 repetições:
  - fez 12 repetições em 2 treinos seguidos com a mesma carga: **suba** (1 kg até 10 kg; 2 kg até 40 kg; 2,5 kg acima) e comece com 8;
  - fez 12 uma vez: repita mais uma vez;
  - abaixo de 12: tente uma repetição a mais;
  - parou há mais de 3 semanas: retome uns 10% mais leve.
- **Folha "Registrar treino":** ao escrever o exercício aparece "📈 Última: … · sugestão", e **usar** preenche a carga e as repetições.

## 4. 🔍 Busca em tudo
- **Como abrir:** a lupa no topo (celular e computador) ou **Ctrl/⌘ + K**.
- **Onde procura:** tarefas, compras, agenda, rotinas, cães, Meus alimentos e refeições salvas. Só o que já está carregado no app; os alimentos e as refeições salvas são só os seus.
- **Como procura:**
  - sem acento e sem maiúscula, com todas as palavras;
  - o começo da palavra vale mais;
  - até 6 por tipo.
- **Abrir o resultado:** tocar leva à tela certa (tarefa e compromisso abrem para editar). **Enter** abre o primeiro.

## Migration 034: `supabase/migrations/20261102120000_agua_telegram.sql`
- **`telegram_links.agua`:** booleana, padrão desligada.
- **`telegram_log.ref`:** o horário do lembrete, até 40 caracteres.
- **Tipo do registro:** passa a aceitar `agua`.
- **Índices:** "uma vez por dia" continua valendo para o bom dia e o domingo; a água vale uma vez por horário.
- **Não destrutiva. Pode rodar mais de uma vez.**
- **Sem a migration** (testado): o agendador avisa "migration 034 ainda não aplicada" e o resto segue; Ajustes › Telegram carrega sem a chave da água. O cardápio no bom dia, a progressão de carga e a busca não dependem dela.

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run.
3. **Conferência:**
   ```sql
   select (select count(*) from information_schema.columns where table_name = 'telegram_links' and column_name = 'agua') as agua,
          (select count(*) from pg_indexes where indexname in ('telegram_log_once_per_day2', 'telegram_log_agua_once')) as indices;
   ```
   O esperado é `1 | 2`.

## Testes
- **Unitários:** `tests/melhorias9.test.ts` (8), com dados fictícios. Cobrem progressão (degraus, subir, repetir, +1 repetição, retomar, só da pessoa, últimos 60 dias), busca (acentos, relevância, todas as palavras, limite por tipo) e os botões do Telegram.
- **Banco:** `supabase/tests/99p-agua-telegram.test.sql`, nos 3 cenários. Cobre água desligada por padrão, vários horários no dia, mesmo horário uma vez, bom dia ainda uma vez por dia e tipo desconhecido recusado.
- **Ponta a ponta:** r32, com Telegram falso e o relógio de teste do agendador (só existe com `NINHO_TEST_CLOCK=1`, no ambiente local). Cobre água pelo Telegram, cardápio no bom dia, a chave no app, progressão de carga, busca (lupa, Ctrl+K, resultado abre a tela), axe e funcionamento sem a migration.
- **Regressão (r1–r32):** 32/32 OK.
