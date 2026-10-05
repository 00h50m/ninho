# Fase 0 — Auditoria do repositório

Base auditada: `main` em `81b63e2` (o commit mais recente na data da auditoria, igual à referência informada).

Arquivos lidos: `app/page.tsx`, `app/layout.tsx`, `components/NinhoApp.tsx` (1.599 linhas), `lib/supabase.ts`,
`supabase-schema.sql`, `package.json`, `tsconfig.json`, `next.config.js`, `.env.local.example`, `public/manifest.json`.
Não havia migrations, lockfile, testes nem lint configurados.

## 1. O que o app usa do banco

| Tabela / função | Uso no código | No `supabase-schema.sql`? |
|---|---|---|
| `households` | `select id limit 1`, `insert {name}` (page.tsx) | sim |
| `profiles` | `upsert {id, household_id, name, role}`, `select display_name, role`, `update display_name` | **parcial** — falta `display_name` |
| `tasks` | `select *`, insert, update (`assigned_to`, `essential`, `scheduled_time`, `active`…) | sim |
| `task_completions` | `select task_id, date`, `upsert … onConflict task_id,date`, delete | sim; `completed_by` existe mas **nunca é preenchido** |
| `dogs` | select com `dog_routines(*)`, insert, update | sim |
| `dog_routines` | insert, update, soft delete (`active=false`) | sim |
| `dog_completions` | `select routine_id, date`, `upsert … onConflict routine_id,date`, delete | sim; **sem `household_id` e sem `completed_by`** |
| `weekly_settings` | select, `upsert … onConflict household_id,week_start` | sim |
| `weekly_meetings` | select, `upsert … onConflict household_id,week_start` (11 colunas) | **não existe** |
| `xp_history` | insert `{household_id, amount, reason}`, delete por `reason` | **não existe** |
| `puppy_accidents` | select ordenado por `occurred_at`, insert `{dog_id, household_id, location, date}` | **não existe** |
| `get_household_xp(hid)` | RPC, retorna número | **não existe** |
| `get_streak(hid)` | RPC, retorna número | **não existe** |
| Publicação Realtime | escuta 6 tabelas | **não versionada** |

Tipos TypeScript (`Task`, `Dog`, `DogRoutine`, `Meeting`) batem com as colunas lidas, mas não existem tipos para
`xp_history`, `puppy_accidents` e as linhas de conclusão (o código usa `any`).

## 2. Divergências e riscos

**Perda de dados / recriação**
- Recriar o banco a partir de `supabase-schema.sql` quebra o app (3 tabelas, 2 funções, 1 coluna faltando) e perde a definição real das funções de XP e sequência, que só existem em produção.
- Não há backup documentado. No plano gratuito do Supabase não há backup automático.

**Duplicidade**
- Concluir tarefa = 2 chamadas independentes (`upsert` da conclusão + `insert` do XP). Clique duplo, repetição de rede ou duas pessoas ao mesmo tempo geram **dois lançamentos de XP** (não há restrição única em `xp_history`). O `upsert` da conclusão não duplica, mas o XP sim.
- Desfazer apaga *todos* os XP com o mesmo `reason`, inclusive duplicatas — mascara o problema.
- Falha parcial: se a conclusão grava e o XP falha (ou o contrário), o estado fica inconsistente e a tela mostra “feito” mesmo assim.

**Erros silenciosos**
- Nenhuma operação verifica `error`. A tela mostra “feito”, “salvo” ou “removido” mesmo quando o banco recusa; não há rollback das atualizações otimistas.

**Isolamento por casa (Realtime e consultas)**
- O canal Realtime escuta 6 tabelas **sem filtro**: qualquer mudança de qualquer casa recarrega tudo (`loadAll`, ~10 consultas) em todos os aparelhos.
- `dog_completions` não tem `household_id`, então não pode ser filtrada por casa (a consulta usa `routine_id in (...)`).
- `weekly_settings`, `profiles`, `puppy_accidents` e `weekly_meetings` não são ouvidos: mudanças da outra pessoa só aparecem ao recarregar.

**Identidade**
- Todo aparelho novo é gravado em `profiles` com `role='g'`. O app não sabe quem está usando o aparelho, e `completed_by` nunca é preenchido.

**Fuso horário**
- O app usa o fuso do aparelho (correto no Brasil, errado em aparelho com outro fuso). Os padrões do banco (`date default current_date`) usam o fuso do servidor (UTC): entre 21h e 0h em São Paulo, gravariam o dia seguinte. As funções de sequência de produção são desconhecidas.

**Dependências**
- `next@14.2.29` tem vulnerabilidades corrigidas em versões 14.2.x posteriores. Não há lockfile versionado, então cada deploy pode resolver versões diferentes.

## 3. Plano executado

1. Documentar backup/restauração antes de qualquer SQL (`docs/BACKUP-RESTORE.md`).
2. Migrations não destrutivas em `supabase/migrations/` que (a) criam o que falta num banco novo e (b) só acrescentam ao banco atual: colunas, índices, gatilhos, funções novas. Nenhum `drop`, nenhuma recriação de tabela. Funções antigas (`get_household_xp`, `get_streak`) ficam intocadas; o app passa a usar funções novas com nome próprio.
3. Funções transacionais e idempotentes para concluir/desfazer tarefa e rotina, com XP no mesmo passo e índice único que impede XP duplicado.
4. `completed_by` em tarefas e rotinas, com identificação local do aparelho (Giovanna/Sabrina), sem login.
5. Datas sempre em `America/Sao_Paulo`, no app e no banco.
6. Tratamento de erro com rollback, loading, bloqueio de envio duplo e “Tentar novamente”.
7. Realtime filtrado por casa e com atualização localizada.
8. Next.js 14.2.35 + lockfile + `npm audit`.
9. Modularização inicial (`lib/`, `hooks/`, `components/`) sem mudar a aparência.
10. Testes unitários (Vitest) e testes do banco num PostgreSQL local.
