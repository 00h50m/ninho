#!/usr/bin/env bash
# Roda testes de ponta a ponta no servidor de teste (subir antes com: bash e2e/stack/up.sh).
# Uso: bash e2e/run.sh            → todos (do mais novo ao mais antigo)
#      bash e2e/run.sh r55 r57    → só esses
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -d "$HERE/node_modules/axe-core" ] || (cd "$HERE" && npm install --no-audit --no-fund --silent >/dev/null)
TESTS=${*:-$(ls "$HERE/tests" | grep -E '^e2e-r[0-9]+\.js$' | sed -E 's/e2e-(r[0-9]+)\.js/\1/' | sort -t r -k2 -n -r | tr '\n' ' ')}
ok=0; bad=()
for t in $TESTS; do
  bash "$HERE/stack/reset.sh" >/dev/null 2>&1
  out=$(cd "$HERE/tests" && timeout 1200 node "e2e-$t.js" 2>&1); last=$(echo "$out" | tail -1)
  echo "== $t: $last"
  if echo "$last" | grep -q "TUDO OK"; then ok=$((ok+1)); else bad+=("$t"); echo "$out" | grep -E "FALHOU|Error" | head -6; mkdir -p /tmp/ninho-e2e; echo "$out" > "/tmp/ninho-e2e/falha-$t.log"; fi
done
echo "resultado: $ok ok · ${#bad[@]} com falha ${bad[*]}"
[ ${#bad[@]} -eq 0 ]
