// =====================================================================
//  Pruebas de rendimiento y estrés de la tienda Magochix (k6)
//
//  Uso:  k6 run -e ESCENARIO=baja|objetivo|estres tienda.js
//
//  Flujo simulado por cada "iteración" (un cliente que compra):
//     1) GET  /api/v1/productos   -> ve el catálogo           (endpoint liviano)
//     2) POST /api/v1/checkout    -> paga su carrito           (endpoint pesado: ~35 ms de CPU)
//
//  Se usa un modelo de llegada ABIERTO (arrival-rate): k6 inicia N compras por segundo
//  sin importar cuánto tarde el servidor. Así, cuando el servidor se satura, vemos
//  cómo crece la latencia y los errores (con un modelo cerrado el propio cliente
//  se frenaría y ocultaría el problema).
// =====================================================================
import http from 'k6/http';
import { check } from 'k6';

const BASE = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const ESCENARIO = (__ENV.ESCENARIO || 'baja').toLowerCase();
const FACTOR = parseFloat(__ENV.DUR_FACTOR || '1');            // 0.3 = prueba "rápida" para ensayar
const MAX_VUS = parseInt(__ENV.MAX_VUS || '300', 10);          // LÍMITE DE CARGA: tope de usuarios virtuales
const seg = (n) => Math.max(1, Math.round(n * FACTOR)) + 's';

// Seguridad: solo se permite probar contra el equipo local (sistemas propios o autorizados).
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE) && __ENV.PERMITIR_REMOTO !== '1') {
  throw new Error('Por seguridad solo se permite probar contra localhost. ' +
    'Si el servidor es suyo y está autorizado, use -e PERMITIR_REMOTO=1');
}
if (!['baja', 'objetivo', 'estres'].includes(ESCENARIO)) {
  throw new Error('ESCENARIO debe ser: baja, objetivo o estres');
}

// ----------------------------- Escenarios -----------------------------
const ESCENARIOS = {
  // 1) Carga baja: 2 compras/s durante 1 min  (línea base)
  baja: {
    baja: {
      executor: 'constant-arrival-rate', rate: 2, timeUnit: '1s', duration: seg(60),
      preAllocatedVUs: 5, maxVUs: 20,
    },
  },
  // 2) Carga objetivo: 10 compras/s durante 3 min  (carga esperada en un día de promoción)
  objetivo: {
    objetivo: {
      executor: 'constant-arrival-rate', rate: 10, timeUnit: '1s', duration: seg(180),
      preAllocatedVUs: 20, maxVUs: 60,
    },
  },
  // 3) Estrés: sube de 10 a 60 compras/s por escalones (muy por encima de lo esperado),
  //    y luego baja a 5/s para observar si el sistema se recupera.
  estres: {
    estres: {
      executor: 'ramping-arrival-rate', startRate: 5, timeUnit: '1s',
      preAllocatedVUs: 50, maxVUs: MAX_VUS,
      stages: [
        { target: 10, duration: seg(30) },
        { target: 20, duration: seg(30) },
        { target: 30, duration: seg(30) },
        { target: 40, duration: seg(30) },
        { target: 60, duration: seg(30) },
      ],
    },
    recuperacion: {
      executor: 'constant-arrival-rate', rate: 5, timeUnit: '1s', duration: seg(90),
      preAllocatedVUs: 20, maxVUs: 100,
      startTime: seg(165),   // empieza al terminar el estrés (150 s) + 15 s para que la cola se drene
    },
  },
};

// ------------------ Criterios de aceptación (definidos ANTES de la prueba) ------------------
const UMBRALES = {
  baja: {
    http_req_failed: ['rate<0.01'],                                  // < 1 % de errores
    'http_req_duration{name:productos}': ['p(95)<100'],              // catálogo: p95 < 100 ms
    'http_req_duration{name:checkout}': ['p(50)<100', 'p(95)<200'],  // pago: p50 < 100 ms, p95 < 200 ms
    checks: ['rate>0.99'],
  },
  objetivo: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:productos}': ['p(95)<150'],
    'http_req_duration{name:checkout}': ['p(50)<150', 'p(95)<300'],  // pago: p50 < 150 ms, p95 < 300 ms
    dropped_iterations: ['count==0'],                                // k6 pudo generar toda la carga pedida
    checks: ['rate>0.99'],
  },
  estres: {
    // CONDICIONES DE PARADA (si se cumplen, k6 detiene la prueba para no dañar el equipo):
    http_req_failed: [{ threshold: 'rate<0.30', abortOnFail: true, delayAbortEval: '20s' }],
    'http_req_duration{name:checkout}': [
      { threshold: 'p(95)<8000', abortOnFail: true, delayAbortEval: '20s' },  // p95 > 8 s => detener
      'p(95)<1000',   // informativo: marca el límite donde el servicio deja de ser aceptable (se espera que falle)
    ],
    // RECUPERACIÓN: al bajar la carga, el sistema debe volver a la normalidad
    'http_req_failed{scenario:recuperacion}': ['rate<0.01'],
    'http_req_duration{scenario:recuperacion}': ['p(95)<300'],
  },
};

export const options = {
  scenarios: ESCENARIOS[ESCENARIO],
  thresholds: UMBRALES[ESCENARIO],
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],   // med = p50
};

// ------------------------------- Datos de prueba -------------------------------
const CABECERAS = { 'Content-Type': 'application/json' };
const CLIENTE = {
  nombre: 'Cliente de Prueba', correo: 'prueba@magochix.test', telefono: '88881234',
  provincia: 'Guanacaste', direccion: 'Direccion de prueba, Liberia',
};
const PAGO = { metodo: 'tarjeta', numero: '4242424242424242', vence: '12/30', cvv: '123' };  // tarjeta de prueba

export function setup() {
  const r = http.get(`${BASE}/api/v1/health`, { timeout: '5s' });
  if (r.status !== 200) {
    throw new Error(`No se pudo contactar al servidor en ${BASE}. ¿Ejecutó "npm start" en la carpeta backend?`);
  }
  console.log(`Servidor OK. Estado inicial: ${r.body}`);
}

// --------------------------- Flujo de un cliente ---------------------------
export default function () {
  const lista = http.get(`${BASE}/api/v1/productos`, { tags: { name: 'productos' }, timeout: '10s' });
  if (!check(lista, { 'GET productos devuelve 200': (r) => r.status === 200 })) return;

  const productos = lista.json('data');
  const items = [];
  const cuantos = 1 + Math.floor(Math.random() * 3);            // entre 1 y 3 productos
  for (let i = 0; i < cuantos; i++) {
    const p = productos[Math.floor(Math.random() * productos.length)];
    items.push({ id: p.id, talla: p.tallas[0], cantidad: 1 + Math.floor(Math.random() * 2) });
  }

  const pago = http.post(`${BASE}/api/v1/checkout`,
    JSON.stringify({ items, cliente: CLIENTE, pago: PAGO }),
    { headers: CABECERAS, tags: { name: 'checkout' }, timeout: '10s' });

  check(pago, {
    'POST checkout devuelve 200': (r) => r.status === 200,
    'checkout genera factura': (r) => r.status === 200 && r.body.indexOf('FAC-') !== -1,
  });
}
