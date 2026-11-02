# D1: "Mais tarde" e o horário de costume no ⋯

## O que mudou

- **⏰ Mais tarde** (no ⋯ da tarefa): +1 h, +2 h ou à noite (19h, só se ainda faltam mais de 2 h).
  - A tarefa **continua na lista de hoje**, com o horário novo só neste dia: muda a ordem, a linha do tempo, o lembrete "Está na hora" e o aviso de essencial atrasada.
  - A linha mostra "⏰ 10:30 · mais tarde". Amanhã a tarefa volta ao horário de sempre, ou a nenhum.
  - **↩ Voltar para as 08:00** (ou "para sem horário") desfaz.
  - **Editar tarefa** continua mostrando e gravando o horário de sempre, nunca o de hoje.
- **Telegram:** o lembrete de tarefa ganhou o botão **⏰ +1 h**, ao lado de ✓ Feito e ⤼ Não deu.
  - No horário novo, o Ninho lembra de novo ("Você pediu para lembrar agora").
  - Perto da meia-noite, avisa que já é tarde para hoje.
- **🕰 Horário de costume no ⋯:** para tarefa sem horário, mostra "Você costuma fazer por volta das 08:10", com o botão **Fixar às 08:10**, que vira o horário da tarefa. É a mesma conta do lembrete de costume (`lib/horario.ts`).
- **Guia** atualizado.

## Migration 044 (rodar no Supabase)

- **Arquivo:** `supabase/migrations/20261112120000_mais_tarde.sql`. Ela cria a tabela `task_later` (um horário por tarefa por dia), com a regra de segurança por casa e o tempo real.
- **É segura:** não destrutiva e pode rodar mais de uma vez.
- **Backup:** a tabela entra sozinha no backup da casa.
- **Conferência:** a consulta do arquivo único deve mostrar **3**.
- **Antes de rodar a migration:** o app segue funcionando sem o "Mais tarde". No Telegram, o botão responde "precisa da atualização do banco (044)".

## Arquivos

- `lib/maisTarde.ts`: opções de horário (puro).
- `lib/build.ts`: `buildTasks` aplica o horário de hoje e guarda o de sempre em `later.orig`.
- `lib/services/ninho.ts`: `loadLaters`, `laterTask`, `unlaterTask` e `completionStamps`.
- `components/MaisTarde.tsx`: os botões do ⋯ e o aviso de costume.
- `components/app/useTarefas.tsx`: `laterToday`, `undoLater` e `fixTime`.
- `lib/reminders.ts`: a referência do lembrete leva o horário novo (`tarefa:<id>:1030`), para avisar de novo no mesmo dia.
- `lib/server/telegram.ts`: o botão `lt:` no Telegram.
- `lib/server/tgExtras.ts`: o botão ⏰ +1 h e `tgRef`. As referências de sempre não mudam; as de "mais tarde" são compactadas para caber em 40 caracteres.

## Testes

- Testes unitários: `tests/maisTarde.test.ts`.
- Banco: `supabase/tests/99z-mais-tarde.test.sql`, nos 3 cenários.
- Ponta a ponta: r55, que cobre:
  - app: opções, axe, gravação, linha, edição, voltar, costume e fixar;
  - Telegram: ⏰ +1 h e o novo lembrete.
- Regressão completa: r1–r55.
