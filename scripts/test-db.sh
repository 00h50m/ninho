#!/usr/bin/env bash
# Testa as migrations num PostgreSQL LOCAL e descartável (nunca toca no Supabase).
#
# Cenário A — banco novo: stubs do Supabase + migrations (2x) + testes.
# Cenário B — banco de produção antigo simulado: schema antigo + tabelas que só
#             existiam em produção + dados com problemas conhecidos, depois
#             migrations (2x) e verificação de que nada foi perdido.
#
# Requer os binários do PostgreSQL (initdb, pg_ctl, psql). Use PG_BIN para apontar
# a pasta, ex.: PG_BIN=/usr/lib/postgresql/16/bin npm run test:db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(command -v pg_config >/dev/null && pg_config --bindir || echo /usr/lib/postgresql/16/bin)}"
PORT="${PGTEST_PORT:-54329}"
WORK="$(mktemp -d)"
RUN=()
if [ "$(id -u)" = "0" ]; then
  # o PostgreSQL não roda como root
  chown postgres "$WORK"
  RUN=(runuser -u postgres --)
fi
chmod 755 "$WORK"

cleanup() {
  "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "› Iniciando PostgreSQL temporário em $WORK (porta $PORT)"
"${RUN[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${RUN[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

psql_run() { # $1 = banco, demais = arquivos
  local db="$1"; shift
  local args=() status=0
  for f in "$@"; do args+=(-f "$f"); done
  "${RUN[@]}" "$PG_BIN/psql" -X -q -h "$WORK" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "${args[@]}" >"$WORK/out.txt" 2>&1 || status=$?
  grep -E "ok - |FALHOU" "$WORK/out.txt" | sed 's/^.*NOTICE:  /  /' || true
  if [ "$status" -ne 0 ]; then
    echo "✗ psql falhou ($status):"; grep -E "ERROR|ERRO|FALHOU" "$WORK/out.txt" | head -20
    exit "$status"
  fi
}

check_report() { # roda um script de checagem e falha se aparecer FALHA
  local db="$1" file="$2"
  "${RUN[@]}" "$PG_BIN/psql" -X -q -h "$WORK" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 -A -F ' | ' -f "$file" >"$WORK/report.txt" 2>&1
  sed 's/^/  /' "$WORK/report.txt"
  if grep -q "FALHA" "$WORK/report.txt"; then echo "✗ checagem com FALHA"; exit 1; fi
}

MIGRATIONS=("$ROOT"/supabase/migrations/*.sql)
T="$ROOT/supabase/tests"

for db in fresh legacy; do
  "${RUN[@]}" "$PG_BIN/createdb" -h "$WORK" -p "$PORT" -U postgres "$db"
done

echo
echo "══ Cenário A: banco novo ══"
psql_run fresh "$T/00-supabase-stubs.sql"
echo "› migrations (1ª vez)"; psql_run fresh "${MIGRATIONS[@]}"
echo "› migrations (2ª vez, devem ser idempotentes)"; psql_run fresh "${MIGRATIONS[@]}"
psql_run fresh "$T/10-rpc-and-constraints.test.sql" "$T/20-gamification.test.sql"

echo
echo "══ Cenário B: produção antiga simulada ══"
psql_run legacy "$T/00-supabase-stubs.sql" "$T/fixtures-legacy-schema.sql" "$T/01-legacy-production.sql" "$T/02-legacy-before.sql"
echo "› pré-checagem (o que o script de diagnóstico mostra antes das migrations)"
"${RUN[@]}" "$PG_BIN/psql" -X -q -h "$WORK" -p "$PORT" -U postgres -d legacy -v ON_ERROR_STOP=1 -A -F ' | ' -f "$ROOT/supabase/scripts/pre-migration-check.sql" | sed 's/^/  /'
echo "› exportação JSON (backup A) antes das migrations"
"${RUN[@]}" "$PG_BIN/psql" -X -q -h "$WORK" -p "$PORT" -U postgres -d legacy -v ON_ERROR_STOP=1 -At -f "$ROOT/supabase/scripts/export-data-json.sql" >"$WORK/backup.json"
grep -q '"ninho_backup": "v1"' "$WORK/backup.json" && grep -q '"Penélope"' "$WORK/backup.json" && echo "  ok - backup JSON gerado ($(wc -c <"$WORK/backup.json") bytes)" || { echo "✗ backup JSON vazio"; exit 1; }
echo "› migrations (1ª vez)"; psql_run legacy "${MIGRATIONS[@]}"
echo "› migrations (2ª vez)"; psql_run legacy "${MIGRATIONS[@]}"
psql_run legacy "$T/03-legacy-after.test.sql" "$T/10-rpc-and-constraints.test.sql" "$T/20-gamification.test.sql" "$T/21-gamification-legacy.test.sql"
echo "› pós-checagem"
check_report legacy "$ROOT/supabase/scripts/post-migration-check.sql"
check_report fresh "$ROOT/supabase/scripts/post-migration-check.sql" >/dev/null
echo "› rollback opcional + reaplicação das migrations"
psql_run legacy "$ROOT/supabase/scripts/rollback-fase-0.sql" "${MIGRATIONS[@]}"
check_report legacy "$ROOT/supabase/scripts/post-migration-check.sql" >/dev/null
echo "  ok - rollback e reaplicação sem erro"

if [ "${DUMP_SNAPSHOT:-}" = "1" ]; then
  echo "› Gerando snapshot do schema (banco novo)"
  "${RUN[@]}" "$PG_BIN/pg_dump" -h "$WORK" -p "$PORT" -U postgres -d fresh --schema-only --schema=public --no-owner --no-privileges \
    > "$WORK/snapshot.sql"
  cp "$WORK/snapshot.sql" "$ROOT/supabase/.snapshot-raw.sql"
fi

echo
echo "✓ Todos os testes do banco passaram"
