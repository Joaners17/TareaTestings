'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const { productos, porId } = require('./productos');

const app = express();
const PORT = process.env.PORT || 4000;

// Milisegundos de CPU que consume cada pago (simula pasarela de pago / procesamiento).
// Es el "punto caliente" que se estresa en las pruebas. Se puede cambiar: CHECKOUT_CPU_MS=50 npm start
const CHECKOUT_CPU_MS = Number(process.env.CHECKOUT_CPU_MS ?? 35);

const IVA = 0.13;               // IVA Costa Rica
const ENVIO = 2500;             // costo de envío en colones
const ENVIO_GRATIS_DESDE = 60000;
const MAX_ORDENES = 5000;       // límite en memoria para que las pruebas de estrés no agoten la RAM
const MAX_LINEAS = 20;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// ------------------------------------------------------------------
// Muestreador de recursos (CPU del proceso y retraso del event loop)
// ------------------------------------------------------------------
const muestra = { cpuPct: 0, lagMs: 0 };
let cpuPrev = process.cpuUsage();
let tPrev = process.hrtime.bigint();
let esperado = Date.now() + 1000;
setInterval(() => {
  const ahora = Date.now();
  muestra.lagMs = Math.max(0, ahora - esperado);
  esperado = ahora + 1000;
  const cpu = process.cpuUsage();
  const t = process.hrtime.bigint();
  const usadoUs = (cpu.user - cpuPrev.user) + (cpu.system - cpuPrev.system);
  const transcurridoUs = Number(t - tPrev) / 1000;
  muestra.cpuPct = Math.round((usadoUs / transcurridoUs) * 1000) / 10;
  cpuPrev = cpu;
  tPrev = t;
}, 1000).unref();

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const colones = (n) => '₡' + Number(n).toLocaleString('es-CR');

function luhnValido(numero) {
  let suma = 0, alterna = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = Number(numero[i]);
    if (alterna) { d *= 2; if (d > 9) d -= 9; }
    suma += d;
    alterna = !alterna;
  }
  return suma % 10 === 0;
}

function vencimientoValido(vence) {
  const m = /^(\d{2})\/(\d{2})$/.exec(vence || '');
  if (!m) return false;
  const mes = Number(m[1]), anio = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) return false;
  return new Date(anio, mes, 1) > new Date();   // el mes de vencimiento aún es válido
}

const PROVINCIAS = ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón'];
const METODOS = ['tarjeta', 'sinpe', 'contraentrega'];

// Facturas en memoria (se pierden al reiniciar el servidor; suficiente para el proyecto)
const ordenes = new Map();
let consecutivo = 0;

// ------------------------------------------------------------------
// API
// ------------------------------------------------------------------

// Carga normal (Performance Testing)
app.get('/api/v1/productos', (req, res) => {
  let lista = productos;
  const { categoria, q } = req.query;
  if (categoria && categoria !== 'todos') lista = lista.filter(p => p.categoria === categoria);
  if (q) {
    const t = String(q).toLowerCase();
    lista = lista.filter(p => (p.nombre + ' ' + p.marca).toLowerCase().includes(t));
  }
  res.status(200).json({ estado: 'success', total: lista.length, data: lista });
});

app.get('/api/v1/productos/:id', (req, res) => {
  const p = porId.get(Number(req.params.id));
  if (!p) return res.status(404).json({ estado: 'error', mensaje: 'Producto no encontrado' });
  res.status(200).json({ estado: 'success', data: p });
});

// Ruta pesada (Stress Testing): valida, cobra y genera la factura
app.post('/api/v1/checkout', (req, res) => {
  const body = req.body || {};
  const errores = [];

  // --- Productos ---
  let items = body.items;
  let compatibilidad = false;
  if (!Array.isArray(items)) {
    if (body.productoId !== undefined) {         // formato antiguo { productoId, cantidad }
      items = [{ id: Number(body.productoId), cantidad: Number(body.cantidad || 1) }];
      compatibilidad = true;
    } else {
      items = [];
      errores.push('El carrito está vacío o tiene un formato inválido.');
    }
  }
  if (items.length === 0 && errores.length === 0) errores.push('El carrito está vacío.');
  if (items.length > MAX_LINEAS) errores.push(`Máximo ${MAX_LINEAS} líneas por compra.`);

  const lineas = [];
  for (const it of items.slice(0, MAX_LINEAS)) {
    const p = porId.get(Number(it.id));
    const cantidad = Number(it.cantidad);
    if (!p) { errores.push(`El producto ${esc(it.id)} no existe.`); continue; }
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 10) {
      errores.push(`Cantidad inválida para "${p.nombre}" (1 a 10).`); continue;
    }
    let talla = it.talla;
    if (compatibilidad && !talla) talla = p.tallas[0];
    if (!p.tallas.includes(talla)) { errores.push(`Selecciona una talla válida para "${p.nombre}".`); continue; }
    lineas.push({ id: p.id, nombre: p.nombre, marca: p.marca, talla, cantidad, precioUnit: p.precio, subtotal: p.precio * cantidad });
  }

  // --- Cliente ---
  const c = body.cliente || (compatibilidad ? {
    nombre: 'Cliente de prueba', correo: 'prueba@magochix.test', telefono: '88888888', provincia: 'Guanacaste', direccion: 'Dirección de prueba'
  } : {});
  const telefono = String(c.telefono || '').replace(/\D/g, '');
  if (!c.nombre || String(c.nombre).trim().length < 3) errores.push('Escribe tu nombre completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c.correo || ''))) errores.push('El correo no es válido.');
  if (telefono.length !== 8) errores.push('El teléfono debe tener 8 dígitos.');
  if (!PROVINCIAS.includes(c.provincia)) errores.push('Selecciona una provincia.');
  if (!c.direccion || String(c.direccion).trim().length < 8) errores.push('Escribe una dirección de entrega más completa.');

  // --- Pago ---
  const pago = body.pago || (compatibilidad ? { metodo: 'contraentrega' } : {});
  let ultimos4 = null;
  if (!METODOS.includes(pago.metodo)) {
    errores.push('Selecciona un método de pago.');
  } else if (pago.metodo === 'tarjeta') {
    const num = String(pago.numero || '').replace(/\D/g, '');
    if (num.length < 13 || num.length > 19 || !luhnValido(num)) errores.push('El número de tarjeta no es válido.');
    if (!vencimientoValido(pago.vence)) errores.push('La fecha de vencimiento no es válida (MM/AA).');
    if (!/^\d{3,4}$/.test(String(pago.cvv || ''))) errores.push('El código de seguridad (CVV) no es válido.');
    ultimos4 = num.slice(-4);   // NUNCA se guarda el número completo ni el CVV
  }

  if (errores.length) return res.status(400).json({ estado: 'error', errores });

  // --- Totales ---
  const subtotal = lineas.reduce((s, l) => s + l.subtotal, 0);
  const iva = Math.round(subtotal * IVA);
  const envio = subtotal >= ENVIO_GRATIS_DESDE ? 0 : ENVIO;
  const total = subtotal + iva + envio;

  // --- Simulación de procesamiento de pago (consume CPU) ---
  const inicio = Date.now();
  while (Date.now() - inicio < CHECKOUT_CPU_MS) { /* bloqueo simulado */ }

  // --- Factura ---
  consecutivo += 1;
  const numero = 'FAC-' + String(consecutivo).padStart(6, '0');
  const factura = {
    numero,
    fecha: new Date().toISOString(),
    cliente: {
      nombre: String(c.nombre).trim(), correo: String(c.correo).trim(), telefono,
      provincia: c.provincia, direccion: String(c.direccion).trim()
    },
    items: lineas,
    subtotal, iva, envio, total,
    pago: { metodo: pago.metodo, ultimos4 },
    estado: pago.metodo === 'contraentrega' ? 'Pendiente de pago (contra entrega)' : 'Pagada'
  };
  ordenes.set(numero, factura);
  if (ordenes.size > MAX_ORDENES) ordenes.delete(ordenes.keys().next().value);

  res.status(200).json({
    estado: 'success',
    mensaje: "¡Compra realizada con éxito! Gracias por preferir Magochix y la marca Mago'x.",
    ordenId: consecutivo,
    factura
  });
});

app.get('/api/v1/facturas/:numero', (req, res) => {
  const f = ordenes.get(String(req.params.numero).toUpperCase());
  if (!f) return res.status(404).json({ estado: 'error', mensaje: 'Factura no encontrada' });
  res.status(200).json({ estado: 'success', data: f });
});

// Salud y recursos del servidor (para evidenciar CPU y memoria en las pruebas)
app.get('/api/v1/health', (req, res) => {
  const m = process.memoryUsage();
  res.status(200).json({
    estado: 'ok',
    uptimeSeg: Math.round(process.uptime()),
    cpuPct: muestra.cpuPct,
    eventLoopLagMs: muestra.lagMs,
    memoria: { rssMB: +(m.rss / 1048576).toFixed(1), heapUsadoMB: +(m.heapUsed / 1048576).toFixed(1) },
    facturasEnMemoria: ordenes.size
  });
});

// Factura imprimible: /factura/FAC-000001  (agrega ?imprimir=1 para abrir el diálogo de impresión / PDF)
app.get('/factura/:numero', (req, res) => {
  const f = ordenes.get(String(req.params.numero).toUpperCase());
  if (!f) return res.status(404).send('<h1>Factura no encontrada</h1>');
  const filas = f.items.map(i => `
      <tr><td>${esc(i.nombre)}<br><small>${esc(i.marca)} · Talla ${esc(i.talla)}</small></td>
      <td class="r">${i.cantidad}</td><td class="r">${colones(i.precioUnit)}</td><td class="r">${colones(i.subtotal)}</td></tr>`).join('');
  const metodo = { tarjeta: 'Tarjeta' + (f.pago.ultimos4 ? ' terminada en ' + f.pago.ultimos4 : ''), sinpe: 'SINPE Móvil', contraentrega: 'Contra entrega' }[f.pago.metodo];
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Factura ${esc(f.numero)} - Magochix</title>
<style>
 body{font-family:'Segoe UI',Tahoma,sans-serif;color:#0f172a;max-width:780px;margin:30px auto;padding:0 20px}
 header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0284c7;padding-bottom:14px;margin-bottom:20px}
 h1{margin:0;color:#0284c7} .muted{color:#64748b;font-size:.9rem}
 .cols{display:flex;gap:30px;flex-wrap:wrap;margin-bottom:20px} .cols>div{flex:1;min-width:220px}
 table{width:100%;border-collapse:collapse} th{background:#f1f5f9;text-align:left;padding:8px;font-size:.85rem}
 td{padding:8px;border-bottom:1px solid #e2e8f0} .r{text-align:right} small{color:#64748b}
 .tot{margin-left:auto;width:280px;margin-top:16px} .tot div{display:flex;justify-content:space-between;padding:4px 0}
 .tot .g{font-weight:bold;font-size:1.2rem;border-top:2px solid #0f172a;margin-top:6px;padding-top:8px}
 .badge{display:inline-block;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:99px;font-size:.8rem;font-weight:600}
 button{background:#0284c7;color:#fff;border:0;padding:10px 18px;border-radius:6px;font-size:1rem;cursor:pointer;margin-top:24px}
 footer{margin-top:30px;font-size:.8rem;color:#64748b;border-top:1px solid #e2e8f0;padding-top:10px}
 @media print{button{display:none}}
</style></head><body>
<header><div><h1>Magochix</h1><div class="muted">Tienda oficial · Marca Mago'x</div></div>
<div style="text-align:right"><strong>Factura ${esc(f.numero)}</strong><br><span class="muted">${new Date(f.fecha).toLocaleString('es-CR')}</span><br><span class="badge">${esc(f.estado)}</span></div></header>
<div class="cols">
 <div><strong>Cliente</strong><br>${esc(f.cliente.nombre)}<br>${esc(f.cliente.correo)}<br>Tel. ${esc(f.cliente.telefono)}</div>
 <div><strong>Entrega</strong><br>${esc(f.cliente.provincia)}<br>${esc(f.cliente.direccion)}</div>
 <div><strong>Pago</strong><br>${esc(metodo)}</div>
</div>
<table><thead><tr><th>Descripción</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Subtotal</th></tr></thead><tbody>${filas}</tbody></table>
<div class="tot">
 <div><span>Subtotal</span><span>${colones(f.subtotal)}</span></div>
 <div><span>IVA (13%)</span><span>${colones(f.iva)}</span></div>
 <div><span>Envío</span><span>${f.envio ? colones(f.envio) : 'Gratis'}</span></div>
 <div class="g"><span>Total</span><span>${colones(f.total)}</span></div>
</div>
<button onclick="window.print()">Imprimir / Guardar como PDF</button>
<footer>Documento generado con fines académicos. No tiene validez tributaria.</footer>
${req.query.imprimir === '1' ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300))</script>' : ''}
</body></html>`);
});

// ------------------------------------------------------------------
// Rutas restantes
// ------------------------------------------------------------------
app.use('/api', (req, res) => res.status(404).json({ estado: 'error', mensaje: 'Ruta no encontrada' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ estado: 'error', errores: ['JSON inválido.'] });
  if (err.type === 'entity.too.large') return res.status(413).json({ estado: 'error', errores: ['Solicitud demasiado grande.'] });
  console.error(err);
  res.status(500).json({ estado: 'error', errores: ['Error interno del servidor.'] });
});

app.listen(PORT, () => {
  console.log(`🚀 Tienda Magochix corriendo en http://localhost:${PORT}  (CPU por pago: ${CHECKOUT_CPU_MS} ms)`);
});
