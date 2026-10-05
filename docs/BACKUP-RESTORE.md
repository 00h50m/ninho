# Backup e restauração do Ninho (Supabase)

Faça o backup **antes** de rodar qualquer migration. No plano gratuito do Supabase não há backup automático.

Nada deste documento precisa de chave secreta no repositório. A senha do banco fica só no seu computador, numa variável de ambiente que você cria no terminal e que não vai para o Git.

---

## 1. O que entra no backup

| Parte | O que é | Como |
|---|---|---|
| A. Dados em JSON | Todas as linhas das 11 tabelas do app | SQL Editor, sem instalar nada (seção 3) |
| B. Schema + dados do `public` | Tabelas, funções (inclusive `get_household_xp` e `get_streak`), gatilhos, políticas e dados | `pg_dump` (seção 4) |
| C. Usuários do Auth | `auth.users` e `auth.identities` (os logins anônimos) | `pg_dump` só de dados (seção 4) |
| D. Diagnóstico | Contagens e definição das funções antigas | `supabase/scripts/pre-migration-check.sql` |

A é o mínimo para não perder nada. B + C permitem restaurar o banco inteiro.

---

## 2. Dados de conexão (para as partes B e C)

1. No painel do Supabase, abra o projeto do Ninho e clique em **Connect** (no topo).
2. Escolha **Session pooler** e copie a URI. Ela tem a forma
   `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<região>.pooler.supabase.com:5432/postgres`.
3. Troque `[YOUR-PASSWORD]` pela senha do banco (Project Settings → Database → *Reset database password* se você não lembrar; trocar a senha não afeta o app, que usa a chave anon).
4. No terminal (não salve em arquivo do projeto):

```bash
export SUPABASE_DB_URL='postgresql://postgres.<ref>:SENHA@aws-0-<região>.pooler.supabase.com:5432/postgres'
```

O `pg_dump` precisa ser da mesma versão principal do servidor ou mais nova. Veja a versão do servidor em
Project Settings → Infrastructure. No Mac: `brew install postgresql@17` (ou `@15`). No Windows: instalador do PostgreSQL, só as *Command Line Tools*.

---

## 3. Backup A — dados em JSON (5 minutos, sem instalar nada)

1. Supabase → **SQL Editor** → New query.
2. Cole o conteúdo de `supabase/scripts/export-data-json.sql` e clique em **Run**.
3. No resultado, use o botão de download e salve como `ninho-AAAA-MM-DD.json` (ou copie a célula e salve num arquivo).
4. Rode também `supabase/scripts/pre-migration-check.sql` e salve o resultado (traz as contagens e a definição atual das funções antigas).

Guarde os arquivos fora do repositório (ex.: Google Drive pessoal). Eles contêm os dados da casa.

---

## 4. Backup B + C — banco completo com pg_dump

```bash
mkdir -p ~/ninho-backups && cd ~/ninho-backups
DIA=$(date +%F)

# B. Estrutura + dados do schema public (formato SQL legível)
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges \
  --file "ninho-public-$DIA.sql"

# C. Somente os dados dos usuários do Auth (a estrutura do auth é do Supabase)
pg_dump "$SUPABASE_DB_URL" --data-only --table=auth.users --table=auth.identities \
  --file "ninho-auth-$DIA.sql"

# Conferência rápida: os arquivos têm conteúdo?
ls -lh ninho-*-$DIA.sql
grep -c '^COPY public\.' "ninho-public-$DIA.sql"   # deve ser 11 (uma por tabela)
```

Alternativa com a CLI do Supabase (precisa de Docker rodando):

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql
supabase db dump --db-url "$SUPABASE_DB_URL" -f data.sql --use-copy --data-only
```

---

## 5. Cuidados com `auth.users`

- `profiles.id` aponta para `auth.users.id`. **Restaure os usuários do Auth antes do `public`**, senão os perfis falham por chave estrangeira.
- Não restaure a *estrutura* do schema `auth`: ela é criada e atualizada pelo Supabase. Restaure só os dados (por isso o `--data-only` no backup C).
- Cada aparelho tem um usuário anônimo. Se os usuários não forem restaurados, o app continua funcionando: cada aparelho cria um usuário novo e entra na casa existente (o fluxo atual pega a primeira casa do banco). Os perfis antigos ficam órfãos, mas tarefas, conclusões e XP são da casa, não do usuário.
- Ao restaurar num projeto **diferente**, a sessão salva no celular não vale lá; isso só importa se você trocar o app para o projeto novo.

---

## 6. Restaurar

### Ordem

1. Projeto Supabase vazio (para teste: crie um projeto novo gratuito, veja seção 8).
2. Usuários do Auth (backup C).
3. Schema + dados do `public` (backup B).
4. Validação (seção 7).

### Comandos

```bash
export RESTORE_DB_URL='postgresql://postgres.<ref-do-projeto-de-teste>:SENHA@...:5432/postgres'

# 2. Usuários do Auth
psql "$RESTORE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
  -c 'SET session_replication_role = replica' -f ninho-auth-AAAA-MM-DD.sql

# 3. Schema + dados do public
psql "$RESTORE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
  -c 'SET session_replication_role = replica' -f ninho-public-AAAA-MM-DD.sql
```

`session_replication_role = replica` desliga gatilhos e checagens de chave estrangeira durante a carga, para a ordem das tabelas não importar. Se o passo 3 reclamar que `schema "public" already exists`, apague a linha `CREATE SCHEMA public;` do arquivo e rode de novo.

### Restaurar só a partir do JSON (backup A)

Se só existir o JSON: aplique as migrations num projeto vazio (docs/MIGRATIONS.md) e importe os dados tabela por tabela. Esse caminho é manual; me mande o arquivo e eu gero o SQL de importação.

### Realtime e permissões depois de restaurar

Rode `supabase/migrations/20261005120300_realtime_publication.sql` no projeto restaurado (a publicação do Realtime não vem no dump). As permissões das tabelas são as padrão do Supabase.

---

## 7. Validação pós-restauração

1. Rode `supabase/scripts/post-migration-check.sql` (se o backup já tinha a Fase 0) ou `pre-migration-check.sql` (se é anterior). Compare as contagens com as do backup.
2. Compare as contagens por tabela:

```sql
select 'tasks' t, count(*) from tasks union all
select 'task_completions', count(*) from task_completions union all
select 'dogs', count(*) from dogs union all
select 'dog_routines', count(*) from dog_routines union all
select 'dog_completions', count(*) from dog_completions union all
select 'xp_history', count(*) from xp_history union all
select 'weekly_meetings', count(*) from weekly_meetings union all
select 'puppy_accidents', count(*) from puppy_accidents union all
select 'profiles', count(*) from profiles union all
select 'auth.users', count(*) from auth.users;
```

3. Abra o app apontando para o projeto restaurado (seção 8) e confira: tarefas, cães, XP, sequência e a reunião da última semana.

---

## 8. Testar o backup sem tocar na produção

1. Crie um projeto novo no Supabase (o plano gratuito permite 2 projetos ativos).
2. Restaure nele (seção 6) e valide (seção 7).
3. Para ver o app com esses dados, no seu computador:

```bash
cp .env.local.example .env.local
# edite .env.local com a URL e a chave anon DO PROJETO DE TESTE
npm install && npm run dev
```

Nunca troque as variáveis da Vercel para o projeto de teste. Ao terminar, pause ou apague o projeto de teste.

---

## 9. Rotina sugerida

- Antes de cada migration: backup A + B + C.
- Uma vez por mês: backup A (5 minutos).
- Guarde pelo menos os 3 últimos backups.
