# Fase 0 — Estabilização técnica: entrega

Branch: `fase-0-estabilizacao` (a partir de `main` em `81b63e2`). **Não foi feito merge na `main` nem deploy em produção.**

## O que foi feito

| Item | Onde |
|---|---|
| Auditoria do repositório e do banco | `docs/FASE-0-AUDITORIA.md` |
| Backup e restauração | `docs/BACKUP-RESTORE.md`, `supabase/scripts/export-data-json.sql` |
| Schema completo e versionado | `supabase/migrations/` (4 arquivos), snapshot em `supabase-schema.sql` |
| Migrations seguras (sem DROP, sem recriar tabela, backfill antes de NOT NULL, idempotentes) | `docs/MIGRATIONS.md` |
| Conclusão + XP numa transação só, idempotente | `ninho_complete_task`, `ninho_uncomplete_task`, `ninho_complete_dog_routines`, `ninho_uncomplete_dog_routines` |
| XP sem duplicidade | índice único `xp_history_one_valid_per_reason`; duplicados antigos anulados (`voided_at`), não apagados |
| Quem concluiu | `task_completions.completed_by` e `dog_completions.completed_by` (+ `household_id`) |
| Identificação local do aparelho (sem login) | modal “Quem está usando este aparelho?”, Ajustes → Este aparelho |
| Datas em `America/Sao_Paulo` | `lib/dates.ts`, `ninho_today()`, `ninho_local_date()`, defaults das colunas `date` |
| Erros visíveis, rollback, loading, bloqueio de envio duplo, “Tentar novamente” | `lib/services/ninho.ts`, `lib/errors.ts`, `lib/pending.ts`, `components/NinhoApp.tsx` |
| Realtime filtrado por casa e localizado | `hooks/useNinhoData.ts`, `lib/realtime.ts`, migration 004 |
| Next.js 14.2.29 → 14.2.35 + lockfile + postcss corrigido | `package.json`, `package-lock.json` |
| Modularização inicial | `lib/`, `hooks/`, `components/ui/`, `components/DeviceIdentityModal.tsx` |
| Testes | `tests/` (Vitest, 65), `supabase/tests/` + `scripts/test-db.sh` (banco) |

## Funções novas no banco (RPC)

| Função | Parâmetros | Retorno |
|---|---|---|
| `ninho_complete_task` | `p_task_id uuid, p_date date, p_by text ('g'\|'s')` | `{task_id, date, created, completed_by, completion_id, xp}` — `created=false` se já estava concluída (não duplica; mantém quem concluiu primeiro) |
| `ninho_uncomplete_task` | `p_task_id uuid, p_date date` | `{task_id, date, removed}` — remove só o XP daquela conclusão |
| `ninho_complete_dog_routines` | `p_routine_ids uuid[], p_date date, p_by text` | `{date, routines, created, xp_added, completions:[{routine_id, completion_id, completed_by}]}` — tudo ou nada |
| `ninho_uncomplete_dog_routines` | `p_routine_ids uuid[], p_date date` | `{date, removed}` |
| `ninho_household_xp` | `p_household_id uuid` | XP válido (ignora anulados) |
| `ninho_streak` | `p_household_id uuid, p_today date` (opcional) | dias seguidos com conclusão (tarefa ou rotina) |
| `ninho_today()` / `ninho_local_date(ts)` | — | data doméstica em São Paulo |

Erros com prefixo estável: `NINHO_INVALID_PERSON`, `NINHO_INVALID_DATE` (fora de ontem/hoje/amanhã em SP), `NINHO_NOT_FOUND`. Executáveis só por `authenticated` (inclui o login anônimo atual); `anon` sem login não executa. Nenhum uso de `service_role`.

## O que você precisa fazer (nesta ordem)

1. **Backup** — `docs/BACKUP-RESTORE.md` (mínimo: backup A em JSON pelo SQL Editor; ideal: A + B + C).
2. **Diagnóstico** — rodar `supabase/scripts/pre-migration-check.sql` no SQL Editor. Se aparecer `BLOQUEIO`, parar e me mandar o resultado.
3. **Migrations** — no SQL Editor, colar e rodar, um por vez e nesta ordem:
   1. `supabase/migrations/20261005120000_baseline_schema.sql`
   2. `supabase/migrations/20261005120100_completions_and_xp_integrity.sql`
   3. `supabase/migrations/20261005120200_completion_rpcs.sql`
   4. `supabase/migrations/20261005120300_realtime_publication.sql`
4. **Validação** — rodar `supabase/scripts/post-migration-check.sql`; tudo `ok`.
5. **Publicar o app** — só depois disso, merge da branch na `main` (deploy automático da Vercel).

O app **antigo** continua funcionando com o banco já migrado (testado), então não há janela de quebra entre os passos 3 e 5.

## Variáveis de ambiente

Nenhuma nova. Continuam as mesmas na Vercel: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Para o backup com `pg_dump`, a URL do banco fica só no seu terminal (`SUPABASE_DB_URL`), nunca no repositório.

## Comandos de verificação

```bash
npm ci
npm run typecheck   # tsc --noEmit
npm test            # 65 testes (Vitest)
npm run test:db     # PostgreSQL local descartável: migrations 2x em banco novo e legado + testes
npm run build       # build de produção (precisa das 2 variáveis NEXT_PUBLIC_*)
```

## Resultados (nesta entrega)

- `npm run typecheck`: sem erros.
- `npm test`: 7 arquivos, 65 testes passando (o processo roda no fuso de Tóquio de propósito).
- `npm run test:db`: todos os testes do banco passando nos dois cenários, com migrations aplicadas duas vezes, exportação JSON, rollback e reaplicação.
- `npm run build`: compilado sem erros nem avisos (rota `/` 96,9 kB, First Load 184 kB; antes 91,1 kB / 178 kB).
- Ponta a ponta local (app real → PostgREST → PostgreSQL migrado a partir de uma cópia simulada da produção): 24 verificações passando — identificação do aparelho, conclusão/desfazer com autoria, clique duplo sem duplicar, rotina dos 2 cães num toque, “não identificado”, falha do banco com rollback e “Tentar novamente”, carregamento lento, erro ao carregar, histórico, sem rolagem horizontal no celular.
- Telas conferidas em 390 px e 1280 px: Hoje, Tarefas, Semana, Cães, Ajustes, modal de identificação, avisos de erro, carregamento, toasts, concluir/desfazer.

## Riscos conhecidos

- **Next.js 14 ainda tem alertas do `npm audit`** (1 crítico agregado). A 14.2.35 é a última da linha 14; as correções restantes só existem a partir da 15.5.24. A maioria afeta recursos que o Ninho não usa (otimização de imagem, middleware, rewrites, Server Actions, i18n, servidor próprio), mas alguns envolvem App Router/React Server Components. Recomendo a migração para Next 15 como etapa separada, logo depois desta fase.
- **Vitest 3.2** tem alerta moderado (só ambiente de teste, não vai para o app publicado). A versão corrigida (4.1.11) não instala com o npm 10.9 atual.
- **Funções antigas de produção** (`get_household_xp`, `get_streak`) não foram vistas: não tenho acesso ao banco. Foram mantidas intactas; o app usa as novas. A nova sequência conta tarefas **e** rotinas dos cães, então pode diferir da antiga.
- **XP pode diminuir** depois da migração, se havia duplicados antigos (eles passam a não contar). O pós-check mostra quantos foram anulados.
- **Realtime não foi testado contra o servidor do Supabase** (não há acesso daqui). A lógica de atualização localizada tem testes unitários e o app segue funcionando com o Realtime fora do ar (testado), mas o comportamento com dois celulares só será confirmado no ambiente real.
- **Aparelho sem armazenamento** (aba anônima): a escolha de quem usa o aparelho vale só até fechar o app; o app avisa em Ajustes.
- `household_id` em `dog_completions` só fica `NOT NULL` se não houver linha órfã; caso contrário o pós-check avisa.

## Pendências (fora desta fase ou dependentes de você)

- Aplicar backup + migrations no Supabase (passos acima) — **nada foi executado em produção**.
- Mandar o resultado do `pre-migration-check.sql` (traz a definição real das funções antigas) para eu registrar.
- Atualização para Next.js 15 (etapa própria).
- Lint não estava configurado e não foi adicionado nesta fase.
- Login, convite, RLS por membro e as funcionalidades das próximas fases: **não implementados**, como combinado.

## Como desfazer

- **App**: não fazer o merge; ou, se já publicado, Vercel → Deployments → versão anterior → *Promote to Production*. O app antigo funciona com o banco migrado.
- **Banco**: normalmente não precisa. Opcional: `supabase/scripts/rollback-fase-0.sql` (remove funções, gatilhos e o índice novo; mantém colunas e dados). Para voltar exatamente ao estado anterior: restaurar o backup.

## Confirmação

Não foram implementados: login (e-mail, senha, link mágico, convite, recuperação), associação usuário–casa, tela de autenticação, RLS por membro, nem qualquer item das próximas fases (compras, agenda, manutenção, contas, cardápio, Telegram, notificações, IA, novas recorrências, dias da semana, adiar/pular, gráficos, tema claro). O fluxo de login anônimo de `app/page.tsx` não foi alterado.
