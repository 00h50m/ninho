#!/usr/bin/env bash
# SÓ PARA TESTE LOCAL. Para tudo o que up.sh subiu.
W="${E2E_WORK:-/tmp/ninho-e2e}"
pkill -f "next start -p 3124" 2>/dev/null; pkill -f "next-server" 2>/dev/null
pkill -f "e2e/stack/gateway.js" 2>/dev/null; pkill -f "e2e/stack/fakes.js" 2>/dev/null
pkill -f "postgrest $W/postgrest.conf" 2>/dev/null
[ -d "$W/data" ] && runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D "$W/data" -m immediate stop >/dev/null 2>&1
true
