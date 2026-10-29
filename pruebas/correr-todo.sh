#!/usr/bin/env bash
# Ejecuta los 3 escenarios en orden (Linux / macOS / Git Bash).
# Uso:  ./correr-todo.sh          (duración completa)
#       ./correr-todo.sh 0.3      (ensayo rápido: duraciones al 30 %)
cd "$(dirname "$0")" && mkdir -p resultados
FACTOR="${1:-1}"
for e in baja objetivo estres; do
  echo; echo "=== Escenario: $e ==="
  node monitor.js "$e" & MON=$!
  ESCENARIO=$e DUR_FACTOR=$FACTOR K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT="resultados/$e.html" \
    k6 run --summary-export="resultados/$e.json" -e ESCENARIO=$e -e DUR_FACTOR=$FACTOR tienda.js
  kill $MON 2>/dev/null
  echo "Enfriando 20 s..."; sleep 20
done
echo "Listo. Revise la carpeta 'resultados'."
