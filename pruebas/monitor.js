// Registra CPU, memoria y retraso del event loop del servidor cada segundo (CSV).
// Uso:  node monitor.js <nombre> [intervaloMs]     (Ctrl+C para detener)
// Requiere Node 18+ (usa fetch nativo). Lee el endpoint /api/v1/health del servidor.
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:4000';
const nombre = process.argv[2] || 'prueba';
const intervalo = Number(process.argv[3] || 1000);
const dir = path.join(__dirname, 'resultados');
fs.mkdirSync(dir, { recursive: true });
const archivo = path.join(dir, `recursos-${nombre}.csv`);
fs.writeFileSync(archivo, 'hora,segundos,cpu_pct,event_loop_lag_ms,rss_mb,heap_mb,respuesta_ms\n');

const t0 = Date.now();
async function muestrear() {
  const ini = Date.now();
  let fila;
  try {
    const r = await fetch(`${BASE}/api/v1/health`, { signal: AbortSignal.timeout(5000) });
    const h = await r.json();
    fila = [h.cpuPct, h.eventLoopLagMs, h.memoria.rssMB, h.memoria.heapUsadoMB, Date.now() - ini];
  } catch (e) {
    fila = ['', '', '', '', 'TIMEOUT'];   // el servidor no respondió en 5 s (saturado)
  }
  fs.appendFileSync(archivo, [new Date().toISOString(), Math.round((Date.now() - t0) / 1000), ...fila].join(',') + '\n');
}
console.log(`Monitor activo -> ${archivo}  (Ctrl+C para detener)`);
setInterval(muestrear, intervalo);
process.on('SIGINT', () => { console.log('\nMonitor detenido.'); process.exit(0); });
process.on('SIGTERM', () => process.exit(0));
