'use strict';

// Si se abre el HTML directamente (file://) se conecta al backend en el puerto 4000.
const API = location.protocol === 'file:' ? 'http://localhost:4000' : '';
const IMG = (tipo) => (location.protocol === 'file:' ? 'img/' : '/img/') + tipo + '.svg';
const CLAVE_CARRITO = 'magochix_carrito_v2';

const IVA = 0.13;
const ENVIO = 2500;
const ENVIO_GRATIS_DESDE = 60000;

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const colones = (n) => '₡' + Number(n).toLocaleString('es-CR');

const estado = { productos: [], categoria: 'todos', busqueda: '', orden: 'relevancia', carrito: [], detalleId: null };
let ultimoFoco = null;

// ------------------------------------------------------------------
// Arranque
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  cargarCarrito();
  actualizarContador();
  obtenerProductos();
});

async function obtenerProductos() {
  const grid = $('#gridProductos');
  grid.innerHTML = '<p class="empty">Cargando catálogo…</p>';
  try {
    const res = await fetch(`${API}/api/v1/productos`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    estado.productos = data.data;
    // Quita del carrito productos que ya no existen
    estado.carrito = estado.carrito.filter(l => estado.productos.some(p => p.id === l.id));
    guardarCarrito();
    actualizarContador();
    renderGrid();
  } catch (e) {
    console.error('Error al conectar con la tienda:', e);
    grid.innerHTML = '<p class="empty">No se pudo conectar con la tienda. ¿Está corriendo el servidor (npm start)?</p>';
  }
}

// ------------------------------------------------------------------
// Catálogo
// ------------------------------------------------------------------
function productosFiltrados() {
  let lista = estado.productos.slice();
  if (estado.categoria !== 'todos') lista = lista.filter(p => p.categoria === estado.categoria);
  const q = estado.busqueda.trim().toLowerCase();
  if (q) lista = lista.filter(p => (p.nombre + ' ' + p.marca + ' ' + p.categoria).toLowerCase().includes(q));
  switch (estado.orden) {
    case 'precio-asc': lista.sort((a, b) => a.precio - b.precio); break;
    case 'precio-desc': lista.sort((a, b) => b.precio - a.precio); break;
    case 'nombre': lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); break;
  }
  return lista;
}

function renderGrid() {
  const grid = $('#gridProductos');
  const lista = productosFiltrados();
  $('#resultadosInfo').textContent = `${lista.length} producto${lista.length === 1 ? '' : 's'}`;
  if (lista.length === 0) {
    grid.innerHTML = '<p class="empty">No encontramos productos con ese criterio.</p>';
    return;
  }
  grid.innerHTML = lista.map(p => `
    <article class="card">
      <div class="card-media" data-action="detalle" data-id="${p.id}" tabindex="0" role="button" aria-label="Ver detalles de ${esc(p.nombre)}">
        <img src="${IMG(esc(p.tipo))}" alt="${esc(p.nombre)}" width="400" height="400" loading="lazy">
        <span class="badge-marca">${esc(p.marca)}</span>
        <div class="card-features">
          <strong>Características</strong>
          <ul>${p.caracteristicas.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="card-body">
        <h3 data-action="detalle" data-id="${p.id}">${esc(p.nombre)}</h3>
        <span class="price">${colones(p.precio)}</span>
        <div class="card-actions">
          <button class="btn btn-ghost" data-action="detalle" data-id="${p.id}">Ver detalles</button>
          <button class="btn btn-primary" data-action="agregar-rapido" data-id="${p.id}">Agregar</button>
        </div>
      </div>
    </article>`).join('');
}

// ------------------------------------------------------------------
// Modales
// ------------------------------------------------------------------
function abrirModal(id, html) {
  cerrarModales(false);
  const m = $('#' + id);
  $('.modal-body', m).innerHTML = html;
  ultimoFoco = document.activeElement;
  m.hidden = false;
  document.body.style.overflow = 'hidden';
  const cerrar = $('.modal-close', m);
  if (cerrar) cerrar.focus({ preventScroll: true });
  return m;
}

function cerrarModales(restaurarFoco = true) {
  document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
  document.body.style.overflow = '';
  if (restaurarFoco && ultimoFoco && document.contains(ultimoFoco)) ultimoFoco.focus({ preventScroll: true });
}

function modalAbierto() { return document.querySelector('.modal:not([hidden])'); }

// ------------------------------------------------------------------
// Detalle del producto
// ------------------------------------------------------------------
function abrirDetalle(id) {
  const p = estado.productos.find(x => x.id === id);
  if (!p) return;
  estado.detalleId = id;
  const unica = p.tallas.length === 1;
  abrirModal('modalDetalle', `
    <div class="detail">
      <div class="detail-img"><img src="${IMG(esc(p.tipo))}" alt="${esc(p.nombre)}"></div>
      <div>
        <span class="tag">${esc(p.categoria)}</span><span class="tag">${esc(p.marca)}</span>
        <h2>${esc(p.nombre)}</h2>
        <div class="price">${colones(p.precio)}</div>
        <p>${esc(p.descripcion)}</p>
        <ul class="feat">${p.caracteristicas.map(c => `<li>${esc(c)}</li>`).join('')}</ul>

        <span class="field-label">${unica ? 'Talla' : 'Elige tu talla'}</span>
        <div class="tallas" id="detalleTallas" role="radiogroup" aria-label="Talla">
          ${p.tallas.map((t, i) => `
            <label class="talla"><input type="radio" name="talla" value="${esc(t)}" ${unica && i === 0 ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}
        </div>

        <span class="field-label">Cantidad</span>
        <div class="qty">
          <button type="button" data-action="detalle-menos" aria-label="Menos">−</button>
          <input id="detalleCantidad" type="number" min="1" max="10" value="1" aria-label="Cantidad">
          <button type="button" data-action="detalle-mas" aria-label="Más">+</button>
        </div>

        <div class="detail-actions">
          <button class="btn btn-primary" data-action="agregar-detalle">Agregar al carrito</button>
        </div>
      </div>
    </div>`);
}

function cantidadDetalle() {
  const n = parseInt($('#detalleCantidad').value, 10);
  return Number.isInteger(n) ? Math.min(10, Math.max(1, n)) : 1;
}

// ------------------------------------------------------------------
// Carrito
// ------------------------------------------------------------------
function cargarCarrito() {
  try {
    const raw = JSON.parse(localStorage.getItem(CLAVE_CARRITO) || '[]');
    estado.carrito = Array.isArray(raw) ? raw.filter(l => l && Number.isInteger(l.id) && l.talla && l.cantidad > 0) : [];
  } catch (e) { estado.carrito = []; }
}

function guardarCarrito() {
  try { localStorage.setItem(CLAVE_CARRITO, JSON.stringify(estado.carrito)); } catch (e) { /* almacenamiento no disponible */ }
}

function actualizarContador(animar = false) {
  const total = estado.carrito.reduce((s, l) => s + l.cantidad, 0);
  $('#cartCount').textContent = total;
  if (animar) {
    const b = $('#btnCarrito');
    b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  }
}

function agregarAlCarrito(id, talla, cantidad) {
  const p = estado.productos.find(x => x.id === id);
  if (!p) return false;
  const linea = estado.carrito.find(l => l.id === id && l.talla === talla);
  if (linea) linea.cantidad = Math.min(10, linea.cantidad + cantidad);
  else estado.carrito.push({ id, talla, cantidad });
  guardarCarrito();
  actualizarContador(true);
  toast(`✔ ${p.nombre} agregado al carrito`);
  return true;
}

function totales() {
  const subtotal = estado.carrito.reduce((s, l) => {
    const p = estado.productos.find(x => x.id === l.id);
    return s + (p ? p.precio * l.cantidad : 0);
  }, 0);
  const iva = Math.round(subtotal * IVA);
  const envio = subtotal === 0 || subtotal >= ENVIO_GRATIS_DESDE ? 0 : ENVIO;
  return { subtotal, iva, envio, total: subtotal + iva + envio };
}

function filasTotales(t) {
  return `
    <div><span>Subtotal</span><span>${colones(t.subtotal)}</span></div>
    <div><span>IVA (13%)</span><span>${colones(t.iva)}</span></div>
    <div><span>Envío</span><span class="${t.envio ? '' : 'free'}">${t.envio ? colones(t.envio) : 'Gratis'}</span></div>
    <div class="grand"><span>Total</span><span>${colones(t.total)}</span></div>`;
}

function abrirCarrito() {
  const t = totales();
  let html = '<h2 class="cart-title">Tu carrito</h2>';
  if (estado.carrito.length === 0) {
    html += `<div class="cart-empty"><div class="big">🛍️</div><p>Tu carrito está vacío.</p>
      <button class="btn btn-primary" data-action="cerrar">Ver productos</button></div>`;
  } else {
    html += '<div class="cart-items">' + estado.carrito.map((l, i) => {
      const p = estado.productos.find(x => x.id === l.id);
      return `
      <div class="cart-line">
        <img src="${IMG(esc(p.tipo))}" alt="">
        <div>
          <h4>${esc(p.nombre)}</h4>
          <small>Talla ${esc(l.talla)} · ${colones(p.precio)} c/u</small>
          <div class="qty" style="margin-top:6px">
            <button type="button" data-action="qty-menos" data-i="${i}" aria-label="Menos">−</button>
            <span>${l.cantidad}</span>
            <button type="button" data-action="qty-mas" data-i="${i}" aria-label="Más">+</button>
          </div>
        </div>
        <div style="text-align:right">
          <div class="line-price">${colones(p.precio * l.cantidad)}</div>
          <button class="link-btn" data-action="quitar" data-i="${i}">Quitar</button>
        </div>
      </div>`;
    }).join('') + '</div>';
    const falta = ENVIO_GRATIS_DESDE - t.subtotal;
    html += `<div class="totals">${filasTotales(t)}</div>
      <p class="hint">${falta > 0 ? `Te faltan ${colones(falta)} para envío gratis.` : '🎉 ¡Tienes envío gratis!'}</p>
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-action="ir-checkout">Continuar al pago</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" data-action="vaciar">Vaciar carrito</button>`;
  }
  abrirModal('modalCarrito', html);
}

// ------------------------------------------------------------------
// Pago
// ------------------------------------------------------------------
const PROVINCIAS = ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón'];

function abrirCheckout() {
  if (estado.carrito.length === 0) { toast('Tu carrito está vacío', 'error'); return; }
  const t = totales();
  const resumen = estado.carrito.map(l => {
    const p = estado.productos.find(x => x.id === l.id);
    return `<div class="summary-line"><span>${l.cantidad} × ${esc(p.nombre)} <small>(${esc(l.talla)})</small></span><span>${colones(p.precio * l.cantidad)}</span></div>`;
  }).join('');
  abrirModal('modalCheckout', `
    <form id="formCheckout" class="checkout" novalidate>
      <div>
        <h2>Finalizar compra</h2>
        <button type="button" class="link-btn" style="color:var(--brand)" data-action="datos-prueba">Rellenar con datos de prueba</button>

        <h3>1. Datos de entrega</h3>
        <div class="form-grid">
          <label class="full">Nombre completo<input name="nombre" autocomplete="name" required></label>
          <label>Correo electrónico<input name="correo" type="email" autocomplete="email" required></label>
          <label>Teléfono (8 dígitos)<input name="telefono" inputmode="numeric" maxlength="9" autocomplete="tel" required></label>
          <label>Provincia<select name="provincia" required><option value="">Selecciona…</option>${PROVINCIAS.map(p => `<option>${p}</option>`).join('')}</select></label>
          <label class="full">Dirección exacta<textarea name="direccion" rows="2" required></textarea></label>
        </div>

        <h3>2. Método de pago</h3>
        <div class="pay-methods">
          <label><input type="radio" name="metodo" value="tarjeta" checked><span>💳 Tarjeta</span></label>
          <label><input type="radio" name="metodo" value="sinpe"><span>📱 SINPE Móvil</span></label>
          <label><input type="radio" name="metodo" value="contraentrega"><span>📦 Contra entrega</span></label>
        </div>
        <div id="camposTarjeta" class="form-grid" style="margin-top:12px">
          <label class="full">Número de tarjeta<input name="numero" id="cardNum" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" maxlength="23"></label>
          <label>Vence (MM/AA)<input name="vence" id="cardExp" inputmode="numeric" autocomplete="cc-exp" placeholder="12/30" maxlength="5"></label>
          <label>CVV<input name="cvv" id="cardCvv" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4"></label>
        </div>
        <p id="notaMetodo" class="demo-note">Pago simulado: usa la tarjeta de prueba 4242 4242 4242 4242, una fecha futura y cualquier CVV. Los datos de la tarjeta no se guardan.</p>
        <div id="erroresCheckout" class="errors" hidden></div>
      </div>

      <aside class="summary">
        <h3>Resumen</h3>
        ${resumen}
        <div class="totals">${filasTotales(t)}</div>
        <button type="submit" id="btnPagar" class="btn btn-primary btn-block" style="margin-top:14px">Pagar ${colones(t.total)}</button>
        <button type="button" class="btn btn-ghost btn-block" style="margin-top:8px" data-action="abrir-carrito">Volver al carrito</button>
      </aside>
    </form>`);
}

function validarFormulario(d) {
  const e = [];
  if (d.nombre.trim().length < 3) e.push('Escribe tu nombre completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo.trim())) e.push('El correo no es válido.');
  if (d.telefono.replace(/\D/g, '').length !== 8) e.push('El teléfono debe tener 8 dígitos.');
  if (!d.provincia) e.push('Selecciona una provincia.');
  if (d.direccion.trim().length < 8) e.push('Escribe una dirección de entrega más completa.');
  if (d.metodo === 'tarjeta') {
    const n = d.numero.replace(/\D/g, '');
    if (n.length < 13 || n.length > 19) e.push('El número de tarjeta no es válido.');
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(d.vence)) e.push('La fecha de vencimiento debe tener el formato MM/AA.');
    if (!/^\d{3,4}$/.test(d.cvv)) e.push('El CVV debe tener 3 o 4 dígitos.');
  }
  return e;
}

function mostrarErrores(lista) {
  const box = $('#erroresCheckout');
  if (!box) return;
  if (!lista.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.innerHTML = `<strong>Revisa lo siguiente:</strong><ul>${lista.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  box.hidden = false;
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function enviarCheckout(form) {
  const f = new FormData(form);
  const d = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
  const errores = validarFormulario(d);
  if (errores.length) { mostrarErrores(errores); return; }
  mostrarErrores([]);

  const btn = $('#btnPagar');
  const textoOriginal = btn.textContent;
  btn.disabled = true; btn.textContent = 'Procesando pago…';

  const payload = {
    items: estado.carrito.map(l => ({ id: l.id, talla: l.talla, cantidad: l.cantidad })),
    cliente: { nombre: d.nombre, correo: d.correo, telefono: d.telefono, provincia: d.provincia, direccion: d.direccion },
    pago: d.metodo === 'tarjeta'
      ? { metodo: 'tarjeta', numero: d.numero.replace(/\D/g, ''), vence: d.vence, cvv: d.cvv }
      : { metodo: d.metodo }
  };

  try {
    const res = await fetch(`${API}/api/v1/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      mostrarErrores(data.errores || ['No se pudo procesar el pago. Intenta de nuevo.']);
      btn.disabled = false; btn.textContent = textoOriginal;
      return;
    }
    estado.carrito = [];
    guardarCarrito();
    actualizarContador();
    mostrarFactura(data.factura, data.mensaje);
  } catch (err) {
    console.error(err);
    mostrarErrores(['No hay conexión con el servidor. Intenta de nuevo.']);
    btn.disabled = false; btn.textContent = textoOriginal;
  }
}

// ------------------------------------------------------------------
// Factura
// ------------------------------------------------------------------
function mostrarFactura(f, mensaje) {
  const metodo = { tarjeta: 'Tarjeta' + (f.pago.ultimos4 ? ' •••• ' + f.pago.ultimos4 : ''), sinpe: 'SINPE Móvil', contraentrega: 'Contra entrega' }[f.pago.metodo];
  abrirModal('modalFactura', `
    <div class="invoice-ok">
      <div class="check">✓</div>
      <h2>¡Gracias por tu compra!</h2>
      <p class="hint">${esc(mensaje || '')}</p>
    </div>
    <div class="invoice-box">
      <div class="row"><strong>Factura ${esc(f.numero)}</strong><small>${new Date(f.fecha).toLocaleString('es-CR')}</small></div>
      <div class="row"><small>Cliente</small><span>${esc(f.cliente.nombre)}</span></div>
      <div class="row"><small>Pago</small><span>${esc(metodo)} · ${esc(f.estado)}</span></div>
      <hr>
      ${f.items.map(i => `<div class="row"><span>${i.cantidad} × ${esc(i.nombre)} <small>(${esc(i.talla)})</small></span><span>${colones(i.subtotal)}</span></div>`).join('')}
      <hr>
      <div class="totals" style="border:0;margin:0;padding:0">${filasTotales(f)}</div>
    </div>
    <div class="invoice-actions">
      <a class="btn btn-primary" href="${API}/factura/${encodeURIComponent(f.numero)}?imprimir=1" target="_blank" rel="noopener">Imprimir / Guardar PDF</a>
      <button class="btn btn-ghost" data-action="cerrar">Seguir comprando</button>
    </div>`);
}

// ------------------------------------------------------------------
// Avisos
// ------------------------------------------------------------------
function toast(msg, tipo = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast' + (tipo === 'error' ? ' error' : '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ------------------------------------------------------------------
// Eventos (delegación)
// ------------------------------------------------------------------
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const id = Number(el.dataset.id);
  const i = Number(el.dataset.i);

  switch (el.dataset.action) {
    case 'categoria':
      estado.categoria = el.dataset.cat;
      document.querySelectorAll('.chip').forEach(c => {
        const act = c === el;
        c.classList.toggle('active', act);
        c.setAttribute('aria-selected', act);
      });
      renderGrid();
      break;
    case 'detalle': abrirDetalle(id); break;
    case 'agregar-rapido': {
      const p = estado.productos.find(x => x.id === id);
      if (p.tallas.length === 1) agregarAlCarrito(id, p.tallas[0], 1);
      else { abrirDetalle(id); toast('Elige una talla para agregar', 'error'); }
      break;
    }
    case 'detalle-menos': { const inp = $('#detalleCantidad'); inp.value = Math.max(1, cantidadDetalle() - 1); break; }
    case 'detalle-mas': { const inp = $('#detalleCantidad'); inp.value = Math.min(10, cantidadDetalle() + 1); break; }
    case 'agregar-detalle': {
      const sel = document.querySelector('#detalleTallas input:checked');
      if (!sel) { toast('Selecciona una talla', 'error'); break; }
      agregarAlCarrito(estado.detalleId, sel.value, cantidadDetalle());
      cerrarModales();
      break;
    }
    case 'abrir-carrito': abrirCarrito(); break;
    case 'qty-mas': estado.carrito[i].cantidad = Math.min(10, estado.carrito[i].cantidad + 1); guardarCarrito(); actualizarContador(); abrirCarrito(); break;
    case 'qty-menos':
      estado.carrito[i].cantidad -= 1;
      if (estado.carrito[i].cantidad < 1) estado.carrito.splice(i, 1);
      guardarCarrito(); actualizarContador(); abrirCarrito(); break;
    case 'quitar': estado.carrito.splice(i, 1); guardarCarrito(); actualizarContador(); abrirCarrito(); break;
    case 'vaciar': estado.carrito = []; guardarCarrito(); actualizarContador(); abrirCarrito(); break;
    case 'ir-checkout': abrirCheckout(); break;
    case 'datos-prueba': rellenarDatosPrueba(); break;
    case 'cerrar': cerrarModales(); break;
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && modalAbierto()) cerrarModales();
  if (ev.key === 'Enter' && ev.target.matches && ev.target.matches('.card-media[data-action="detalle"]')) abrirDetalle(Number(ev.target.dataset.id));
});

document.addEventListener('submit', (ev) => {
  if (ev.target.id === 'formCheckout') { ev.preventDefault(); enviarCheckout(ev.target); }
});

document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id === 'buscar') { estado.busqueda = t.value; renderGrid(); }
  else if (t.id === 'cardNum') t.value = t.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  else if (t.id === 'cardExp') {
    let v = t.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
    t.value = v;
  }
  else if (t.id === 'cardCvv') t.value = t.value.replace(/\D/g, '').slice(0, 4);
  else if (t.name === 'telefono') t.value = t.value.replace(/[^\d-]/g, '').slice(0, 9);
});

document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.id === 'orden') { estado.orden = t.value; renderGrid(); }
  else if (t.name === 'metodo') {
    $('#camposTarjeta').hidden = t.value !== 'tarjeta';
    const nota = { tarjeta: 'Pago simulado: usa la tarjeta de prueba 4242 4242 4242 4242, una fecha futura y cualquier CVV. Los datos de la tarjeta no se guardan.',
      sinpe: 'Te enviaremos las instrucciones de SINPE Móvil al correo indicado. (Pago simulado)',
      contraentrega: 'Pagarás en efectivo o con tarjeta al recibir tu pedido.' };
    $('#notaMetodo').textContent = nota[t.value];
  }
});

function rellenarDatosPrueba() {
  const f = $('#formCheckout');
  if (!f) return;
  const set = (n, v) => { f.elements[n].value = v; };
  set('nombre', 'María Fernanda Rojas'); set('correo', 'maria@ejemplo.com'); set('telefono', '88881234');
  set('provincia', 'Guanacaste'); set('direccion', '200 m norte de la iglesia, Liberia');
  f.elements.metodo.value = 'tarjeta';
  $('#camposTarjeta').hidden = false;
  set('numero', '4242 4242 4242 4242'); set('vence', '12/30'); set('cvv', '123');
  mostrarErrores([]);
}
