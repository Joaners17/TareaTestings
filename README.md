# Magochix 🛍️ — Tienda en línea (v2)

Tienda de la marca **Mago'x** con catálogo, detalle de producto, carrito, pago simulado y facturas.
Además incluye las pruebas de **rendimiento y estrés** (carpeta `pruebas/`) que pide la asignación del Grupo 5.

## Cómo correrla

Requisitos: **Node.js 18 o superior**.

```bash
cd backend
npm install        # solo la primera vez
npm start
```

Abra **http://localhost:4000** en el navegador.

## Qué incluye

| Función | Cómo funciona |
|---|---|
| Catálogo | 18 productos en 3 categorías (ropa, pantalones, accesorios), con filtro, búsqueda y orden |
| Características | Al pasar el cursor sobre la imagen se despliegan **sobre la foto** (no tapan los botones). Al hacer clic se abre el detalle completo |
| Detalle | Imagen grande, descripción, características, selector de talla y cantidad |
| Carrito | Agregar, cambiar cantidad, quitar, vaciar. Se conserva al recargar la página (localStorage) |
| Pago | Datos de entrega + tarjeta, SINPE Móvil o contra entrega. Validaciones en el navegador **y** en el servidor |
| Factura | Número consecutivo (FAC-000001), IVA 13 %, envío (gratis desde ₡60.000). Se puede imprimir o guardar como PDF |
| Imágenes | Ilustraciones SVG en `frontend/img/` (una por tipo de prenda) |

**Tarjeta de prueba:** `4242 4242 4242 4242`, vencimiento futuro (ej. `12/30`) y cualquier CVV. También hay un botón *"Rellenar con datos de prueba"* en el formulario de pago.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/productos` | Lista de productos (acepta `?categoria=ropa&q=texto`) |
| GET | `/api/v1/productos/:id` | Un producto |
| POST | `/api/v1/checkout` | Valida, cobra (simulado) y genera la factura. **Endpoint pesado** (~35 ms de CPU) |
| GET | `/api/v1/facturas/:numero` | Factura en JSON |
| GET | `/factura/:numero` | Factura imprimible (agregue `?imprimir=1` para abrir el diálogo de impresión) |
| GET | `/api/v1/health` | CPU, memoria y retraso del event loop del servidor (para las pruebas) |

Variable opcional: `CHECKOUT_CPU_MS` cambia el costo simulado del pago (por defecto 35). Ej.: `CHECKOUT_CPU_MS=50 npm start`.

## Seguridad y buenas prácticas aplicadas

- Los **precios se toman siempre del servidor**; el navegador no puede modificarlos.
- Se valida cantidad, talla, correo, teléfono, tarjeta (algoritmo de Luhn) y vencimiento.
- **No se guarda el número de tarjeta ni el CVV**; la factura solo conserva los últimos 4 dígitos.
- Todo texto que viene del usuario se escapa antes de mostrarse (prevención de XSS).
- Las facturas viven **en memoria** (máx. 5000) y se pierden al reiniciar. En un sistema real se usaría una base de datos y una pasarela de pago externa (el sitio nunca tocaría los datos de la tarjeta).

## Estructura

```
backend/    server.js (API + sirve el frontend), productos.js (catálogo)
frontend/   index.html, style.css, app.js, img/
pruebas/    tienda.js (k6), monitor.js, correr-todo.ps1 / .sh, resultados/
GUIA_CUMPLIMIENTO.md   Cómo cumplir la asignación paso a paso
```
