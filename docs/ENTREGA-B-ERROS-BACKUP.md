# Ninho · Erros visíveis e backup automático

Branch: `mapa-13`, feita a partir da `mapa-12` (Entrega A). **Tem migration: 043.**

## 🧯 Erros do app (Ajustes › 🧰 Sistema)
- **De onde vêm:**
  - erros no celular de vocês: uma tela que falhou, uma gravação que o servidor recusou ou um erro sem tratamento;
  - erros dos agendadores do servidor: bom dia, lembretes e domingo, incluindo Telegram e notificações.
- **Onde aparecem:** em Ajustes › Sistema, com **quando, quem e onde**. Tem **"Limpar o registro"**.
- **Cuidados:**
  - falta de internet não conta como erro;
  - o mesmo erro só entra uma vez por minuto no celular, e a cada 6 horas no servidor;
  - entram no máximo 30 por sessão;
  - o que tem mais de 30 dias é apagado sozinho;
  - nada de chave, token ou dado da casa vai para o registro: só o lugar, a mensagem técnica e o código.

## 💾 Backup automático
- **Todo domingo** (no mesmo agendador do resumo de domingo), o Ninho guarda uma **cópia dos dados da casa** e mantém **as 8 últimas**.
  - Entram tarefas e histórico, cães, compras, agenda, despensa, Nós, rotinas e o que mais for da casa.
  - Ficam de fora o **Meu dia** (é pessoal), as inscrições de notificação, os vínculos do Telegram e os registros técnicos.
- **Em Ajustes › Sistema:**
  - lista dos backups, com **⬇ Baixar** (arquivo JSON);
  - **💾 Fazer backup agora**, no máximo um a cada 10 minutos;
  - **⬇ Baixar o meu Meu dia**: cada uma baixa só o seu.
- **Segurança:** só o servidor monta a cópia. Quem é da casa só lê os backups da própria casa.

## Migration 043 (vocês rodam no Supabase)
- **Arquivo:** `supabase/migrations/20261111120000_erros_backup.sql`.
- **O que cria:**
  - as tabelas `app_errors` e `household_backups`;
  - as funções `ninho_household_backup` e `ninho_save_backup`, que só o servidor pode chamar.
- **Segurança:** não é destrutiva e pode rodar mais de uma vez.
- **Conferência** (deve dar **4**):
  ```sql
  select (select count(*) from pg_tables where schemaname = 'public' and tablename in ('app_errors', 'household_backups'))
       + (select count(*) from pg_proc where proname in ('ninho_household_backup', 'ninho_save_backup'));
  ```

## Testes
- **Unitários:** `tests/sistema.test.ts` cobre:
  - o mesmo erro só uma vez por minuto;
  - o limite de 30 por sessão;
  - a busca acha "backup".
- **Banco:** `supabase/tests/99y-erros-backup.test.sql`, nos 3 cenários. Confere:
  - o backup leva as tarefas e deixa de fora o Meu dia e as notificações;
  - ficam só os 8 últimos;
  - o feito na hora fica marcado;
  - só o servidor monta;
  - erros da casa e do servidor;
  - apagar a casa apaga os backups.
- **Ponta a ponta:** o r51 cobre:
  - erro na tela gravado, com quem estava usando, e sem repetir;
  - backup na hora e o arquivo baixado (com tarefas e cães; sem Meu dia, notificações e Telegram);
  - o limite de 10 minutos;
  - "Baixar o meu Meu dia" só com o da própria pessoa;
  - limpar o registro;
  - o backup automático do domingo;
  - o axe.
