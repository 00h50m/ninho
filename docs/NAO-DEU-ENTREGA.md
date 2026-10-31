# Ninho · "Não deu": pular tarefa ou rotina atrasada

Branch: `mapa-10`, feita a partir da `main` (949a823, com a navegação nova). **Tem migration: 042.**

## O que muda
- **Botão "⤼ Não deu" na tarefa atrasada:**
  - Uma tarefa diária com horário que já passou (por exemplo, a da manhã quando já é tarde) ganha esse botão ao lado do check.
  - Um toque e ela sai da lista de hoje: **sem XP** e **sem quebrar a sequência**.
  - O aviso tem "Desfazer".
- **Rotinas dos cães também:**
  - "Passeio manhã" atrasado ganha o mesmo botão.
  - Se a rotina é dos dois cães, sai dos dois de uma vez.
  - Essa parte precisa da **migration 042**. Sem ela, o botão avisa que não deu para pular.
- **No menu ⋯ da tarefa,** "Pular hoje" virou **"Não deu hoje (pular)"**. Nas semanais e mensais continua "Pular esta semana" ou "Pular este mês".
- **"Não deu ou para amanhã" no fim da coluna** mostra as tarefas e as rotinas dos cães puladas, cada uma com **↺ Voltar**.
- **Fora da lista em todo lugar:** o que foi pulado também sai do resumo da noite e dos lembretes. Antes, as rotinas dos cães puladas continuavam aparecendo no servidor.

## Migration 042 (vocês rodam no Supabase)
- **Arquivo:** `supabase/migrations/20261110120000_pular_rotina_caes.sql`.
- **O que faz:** cria a tabela `dog_skips`, com um pulo por rotina por dia, a mesma regra de segurança por casa das outras tabelas e o tempo real.
- **Segurança:** não é destrutiva e pode rodar mais de uma vez.
- **Conferência** (deve dar **2**):
  ```sql
  select (select count(*) from pg_tables where schemaname = 'public' and tablename = 'dog_skips')
       + (select count(*) from pg_policies where tablename = 'dog_skips' and policyname = 'household_member');
  ```

## Testes
- **Unitários:** `tests/nao-deu.test.ts` cobre:
  - a rotina pulada sai de hoje;
  - um pulo de ontem não vale mais;
  - pular um cão não esconde o outro.
- **Banco:** `supabase/tests/99x-pular-rotina-caes.test.sql`, nos 3 cenários. Confere:
  - um pulo por rotina por dia;
  - quem pulou é g ou s;
  - a segurança por casa;
  - apagar a rotina apaga os pulos.
- **Ponta a ponta:** r48 cobre:
  - "Não deu" na tarefa e na rotina dos dois cães;
  - que não dá XP;
  - "↺ Voltar";
  - que continua pulada depois de recarregar;
  - o menu;
  - o axe.
