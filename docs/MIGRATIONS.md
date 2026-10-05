# Migrations do banco

As migrations ficam em `supabase/migrations/` e são a fonte da verdade do schema.
`supabase-schema.sql` é só um retrato gerado a partir delas (não rode em produção).

| Arquivo | O que faz |
|---|---|
| `20261005120000_baseline_schema.sql` | Cria num banco novo as 11 tabelas que o app usa. No banco atual, só acrescenta o que falta: `profiles.display_name`, as tabelas que existiam só em produção (`weekly_meetings`, `xp_history`, `puppy_accidents`) caso não existam, colunas `created_at`, chaves primárias, índices únicos usados em `upsert`, chaves estrangeiras (`NOT VALID`), RLS no modelo atual e `ninho_today()` / `ninho_local_date()` (datas em São Paulo). |
| `20261005120100_completions_and_xp_integrity.sql` | `completed_by` e `household_id` nas conclusões de rotina (com backfill), gatilhos que preenchem `household_id`, padrões de data em São Paulo, anulação (sem apagar) de XP duplicado antigo, índice único de XP, índices de leitura, `updated_at`. |
| `20261005120200_completion_rpcs.sql` | Funções transacionais e idempotentes: concluir/desfazer tarefa e rotinas (com XP no mesmo passo), XP total e sequência. |
| `20261005120300_realtime_publication.sql` | Coloca as tabelas que o app escuta na publicação do Realtime. |

## Regras seguidas

- Nenhum `DROP` de tabela, coluna ou dado. Nenhuma tabela recriada.
- Colunas novas são opcionais ou têm valor padrão. `NOT NULL` só depois do backfill, e só se não sobrar linha vazia.
- Restrições novas em tabelas existentes entram como `NOT VALID`: valem para gravações novas e não reprovam dados antigos.
- XP duplicado antigo é **anulado** (`voided_at`), não apagado.
- As funções antigas `get_household_xp` e `get_streak` não são alteradas; o app novo usa `ninho_household_xp` e `ninho_streak`.
- Tudo pode ser executado mais de uma vez sem efeito colateral (testado aplicando duas vezes).

## Como aplicar na produção (passo a passo)

> Ordem obrigatória: **backup → diagnóstico → migrations → validação → publicar o app novo**.
> O app novo depende das funções criadas aqui. O app antigo continua funcionando com o banco migrado.

1. **Backup**: siga `docs/BACKUP-RESTORE.md` (no mínimo o backup A em JSON; de preferência A + B + C).
2. **Diagnóstico**: no SQL Editor, rode `supabase/scripts/pre-migration-check.sql`.
   - Se aparecer `BLOQUEIO`, pare e me mande o resultado.
   - `AVISO` é tratado pelas migrations.
3. **Migrations** — escolha uma opção:
   - **SQL Editor (sem instalar nada)**: abra cada arquivo de `supabase/migrations/` **na ordem do nome**, cole numa query nova e clique em Run. Espere “Success” antes de passar para o próximo.
   - **CLI do Supabase**:
     ```bash
     supabase link --project-ref <ref-do-projeto>
     supabase db push        # aplica as 4 migrations em ordem
     ```
     Como o banco atual não tem histórico de migrations, o `db push` aplica as quatro; elas são idempotentes.
4. **Validação**: rode `supabase/scripts/post-migration-check.sql`. Tudo deve estar `ok`. Confira se o XP e a sequência de cada casa batem com o que o app mostrava (o XP pode ficar menor se havia duplicados).
5. **Publicar o app**: só depois do passo 4, faça o merge/deploy da branch da Fase 0.

## Banco novo do zero

Aplique as 4 migrations em ordem num projeto Supabase vazio (SQL Editor ou `supabase db push`). Não é preciso rodar `supabase-schema.sql`.

## Testes locais

```bash
npm run test:db     # sobe um PostgreSQL temporário, aplica as migrations 2x em banco novo e em banco "legado", e roda os testes
```

Precisa dos binários do PostgreSQL (`initdb`, `pg_ctl`, `psql`). Não conecta ao Supabase.

Para regenerar o snapshot depois de mudar uma migration:

```bash
DUMP_SNAPSHOT=1 npm run test:db   # gera supabase/.snapshot-raw.sql; copie para supabase-schema.sql mantendo o cabeçalho
```

## Desfazer

- **App**: republique a versão anterior na Vercel (Deployments → versão anterior → *Promote to Production*). Funciona com o banco migrado.
- **Banco** (opcional): `supabase/scripts/rollback-fase-0.sql` remove funções, gatilhos e o índice da Fase 0, mantendo colunas e dados. Para voltar exatamente ao estado anterior, restaure o backup (docs/BACKUP-RESTORE.md).
