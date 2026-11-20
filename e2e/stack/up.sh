#!/usr/bin/env bash
# SÓ PARA TESTE LOCAL. Sobe o servidor de teste completo a partir de uma worktree do Ninho:
#   Postgres (54330) com as migrations e os dados fictícios · PostgREST (3001) · gateway (54321)
#   · Telegram/Anthropic falsos (9555/9556) · app montado em modo produção (3124).
# Uso: bash e2e/stack/up.sh [pasta do app]   (padrão: a raiz deste repositório)
# Depois: bash e2e/stack/reset.sh antes de cada teste; bash e2e/stack/down.sh para parar.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "${1:-$HERE/../..}" && pwd)"
W="${E2E_WORK:-/tmp/ninho-e2e}"; PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"; BIN="$HERE/../.bin"
SECRET="segredo-jwt-de-teste-local-com-32-caracteres-ou-mais"
log(){ echo "[$(date +%T)] $*"; }
bash "$HERE/down.sh" >/dev/null 2>&1 || true
mkdir -p "$W" "$BIN"; chown postgres "$W"

# PostgREST (o mesmo motor da API do Supabase)
if [ ! -x "$BIN/postgrest" ]; then
  log "baixando o PostgREST"
  curl -sSL -o "$W/pgrst.tar.xz" https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz
  tar -xJf "$W/pgrst.tar.xz" -C "$BIN"
fi

log "Postgres"
rm -rf "$W/data"; runuser -u postgres -- "$PG_BIN/initdb" -D "$W/data" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
runuser -u postgres -- "$PG_BIN/pg_ctl" -D "$W/data" -o "-p 54330 -k $W -c listen_addresses=localhost" -l "$W/pg.log" -w start >/dev/null
PSQL=(runuser -u postgres -- psql -X -q -h localhost -p 54330 -U postgres -v ON_ERROR_STOP=1)
"${PSQL[@]}" -d postgres -c "create database ninho" >/dev/null
# cópia das migrations que o usuário postgres consegue ler (os testes também usam este caminho)
rm -rf /tmp/ninho-sql-ro; mkdir -p /tmp/ninho-sql-ro; cp -r "$ROOT/supabase/migrations" "$ROOT/supabase/tests" /tmp/ninho-sql-ro/; chmod -R a+rX /tmp/ninho-sql-ro
"${PSQL[@]}" -d ninho -f /tmp/ninho-sql-ro/tests/00-supabase-stubs.sql >/dev/null
"${PSQL[@]}" -d ninho -c "create role authenticator noinherit login; grant anon, authenticated, service_role to authenticator;" >/dev/null
for f in /tmp/ninho-sql-ro/migrations/*.sql; do [[ "$f" == *rls_por_casa* ]] || "${PSQL[@]}" -d ninho -f "$f" >/dev/null 2>&1 || { echo "falhou: $f"; "${PSQL[@]}" -d ninho -f "$f" | tail -5; exit 1; }; done
"${PSQL[@]}" -d ninho -f /tmp/ninho-sql-ro/migrations/20261011120100_rls_por_casa.sql >/dev/null 2>&1
cp "$HERE/seed.sql" /tmp/ninho-sql-ro/seed.sql; chmod a+r /tmp/ninho-sql-ro/seed.sql
"${PSQL[@]}" -d ninho -f /tmp/ninho-sql-ro/seed.sql >/dev/null
"${PSQL[@]}" -d postgres -c "create database ninho_tpl template ninho" >/dev/null

log "PostgREST, gateway e serviços falsos"
cat > "$W/postgrest.conf" <<EOF
db-uri = "postgres://authenticator@localhost:54330/ninho"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = 3001
db-pool = 10
EOF
nohup "$BIN/postgrest" "$W/postgrest.conf" > "$W/postgrest.log" 2>&1 &
nohup node "$HERE/gateway.js" > "$W/gateway.log" 2>&1 &
nohup node "$HERE/fakes.js" > "$W/fakes.log" 2>&1 &

log "app (montagem de produção)"
ANON=$(E2E_ROLE=anon node -e "process.stdout.write(require('$HERE/token.js')('anon'))")
SERVICE=$(node -e "process.stdout.write(require('$HERE/token.js')('service_role'))")
cat > "$W/app.env" <<EOF
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
CRON_SECRET=segredo-do-cron-local
TELEGRAM_BOT_TOKEN=123:teste
TELEGRAM_WEBHOOK_SECRET=segredo-webhook-local
TELEGRAM_API_BASE=http://localhost:9555
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=NinhoTesteBot
ANTHROPIC_API_KEY=chave-de-teste
ANTHROPIC_BASE_URL=http://localhost:9556
NINHO_TEST_CLOCK=1
SOBROU_API_URL=http://localhost:9557
SOBROU_RESUMO_TOKEN=token-de-teste-do-sobrou-local-123
EOF
cd "$ROOT"
set -a; . "$W/app.env"; set +a
npx next build > "$W/build.log" 2>&1 || { tail -30 "$W/build.log"; exit 1; }
nohup npx next start -p 3124 > "$W/app.log" 2>&1 &
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:3124 && break; sleep 1; done
curl -s -o /dev/null -w "app: %{http_code}\n" http://localhost:3124
log "pronto"
