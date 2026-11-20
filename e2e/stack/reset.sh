#!/usr/bin/env bash
# SÓ PARA TESTE LOCAL. Volta o banco de teste ao estado inicial (cópia de ninho_tpl) e reinicia
# o PostgREST. Rodar antes de cada teste.
W="${E2E_WORK:-/tmp/ninho-e2e}"; HERE="$(cd "$(dirname "$0")" && pwd)"; BIN="$HERE/../.bin"
PSQL=(runuser -u postgres -- psql -X -q -h localhost -p 54330 -U postgres -v ON_ERROR_STOP=1 -d postgres)
pkill -f "postgrest $W/postgrest.conf" 2>/dev/null; sleep 0.5
"${PSQL[@]}" -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'ninho' and pid <> pg_backend_pid()" >/dev/null
"${PSQL[@]}" -c "drop database if exists ninho" >/dev/null
"${PSQL[@]}" -c "create database ninho template ninho_tpl" >/dev/null
nohup "$BIN/postgrest" "$W/postgrest.conf" > "$W/postgrest.log" 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:3001/ && break; sleep 0.3; done
curl -s -o /dev/null -X POST http://localhost:9555/__reset; curl -s -o /dev/null -X POST http://localhost:9556/__reset
