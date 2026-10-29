# Ejecuta los 3 escenarios en orden (Windows PowerShell).
# Requisitos: servidor corriendo (npm start en /backend), k6 instalado y Node 18+.
# Uso:   .\correr-todo.ps1            (duración completa, ~10 min)
#        .\correr-todo.ps1 -Factor 0.3   (ensayo rápido: duraciones al 30 %)
param([double]$Factor = 1)
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force resultados | Out-Null

foreach ($e in 'baja', 'objetivo', 'estres') {
  Write-Host "`n=== Escenario: $e ===" -ForegroundColor Cyan
  $mon = Start-Process node -ArgumentList "monitor.js $e" -PassThru -NoNewWindow
  $env:ESCENARIO = $e
  $env:DUR_FACTOR = "$Factor"
  $env:K6_WEB_DASHBOARD = 'true'
  $env:K6_WEB_DASHBOARD_EXPORT = "resultados/$e.html"
  k6 run --summary-export="resultados/$e.json" tienda.js
  Stop-Process -Id $mon.Id -ErrorAction SilentlyContinue
  Write-Host "Enfriando 20 s antes del siguiente escenario..."
  Start-Sleep -Seconds 20
}
Write-Host "`nListo. Revise la carpeta 'resultados' (reportes .html, resúmenes .json y CSV de recursos)." -ForegroundColor Green
