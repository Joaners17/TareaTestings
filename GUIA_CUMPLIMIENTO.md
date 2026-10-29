# Guía para cumplir la asignación — Grupo 5: Stress Testing y Performance Testing

Esta guía lo lleva de principio a fin: qué entender, qué ejecutar, qué medir y cómo presentarlo.
El sistema bajo prueba es **la tienda Magochix** (propia, en su computadora → cumple la regla de "solo sistemas propios o autorizados").

---

## 1. Los conceptos (para el 15 % de "Comprensión conceptual")

| | **Performance Testing** | **Stress Testing** |
|---|---|---|
| Pregunta | ¿El sistema cumple los tiempos esperados con la carga **normal y esperada**? | ¿Qué pasa cuando la carga **supera** lo normal? ¿Dónde se rompe y cómo se recupera? |
| Carga | Baja y objetivo (la que se espera en producción) | Creciente, **por encima** del objetivo, hasta degradar el sistema |
| Resultado buscado | Verificar criterios de aceptación (p95 < X ms, errores < Y %) | Encontrar el **límite**, observar la degradación y la **recuperación** |
| Riesgo que mitiga | Mala experiencia de usuario en uso normal | Caídas en picos (Black Friday, promociones) y pérdida de ventas |

**Motivación:** una tienda en línea pierde ventas si el pago tarda o falla justo en el pico de demanda. Hay que conocer el límite *antes* de que lo descubran los clientes.

**Riesgos de hacer estas pruebas** (mencionarlos suma puntos): probar contra producción o servicios ajenos, saturar su propia máquina, y sacar conclusiones con el cliente de carga y el servidor compitiendo por la misma CPU.

---

## 2. El sistema y el entorno (anótelo en una diapositiva)

- **Sistema:** API Node.js + Express de la tienda. Dos endpoints bajo prueba:
  - `GET /api/v1/productos` — liviano (catálogo).
  - `POST /api/v1/checkout` — **pesado**: valida, simula el cobro con ~35 ms de CPU y genera la factura.
- **Herramienta:** [k6](https://k6.io) (Grafana). Más `monitor.js` (incluido) para CPU y memoria del servidor.
- **Entorno (complete con sus datos):** modelo de CPU y núcleos, RAM, sistema operativo, versión de Node (`node -v`) y de k6 (`k6 version`). Cliente y servidor corren en la **misma máquina** (una limitación que debe mencionar).

### Hipótesis (formúlela *antes* de medir)

> Cada pago bloquea el único hilo de Node durante ~35 ms. Por lo tanto, la capacidad máxima teórica es ≈ 1000 / 35 ≈ **28 pagos por segundo**. Esperamos: latencia estable con 2 y 10 pagos/s, y degradación fuerte (cola, latencia creciente, errores por tiempo de espera) a partir de ~25–30 pagos/s.

La prueba sirve para **confirmar o refutar** esa hipótesis con datos. Si los números salen distintos, explique por qué: eso también vale (ver "Criterio de calidad" del documento).

---

## 3. Diseño del experimento (20 % — "Diseño del experimento")

Cada "usuario" (iteración) hace: ver catálogo → pagar un carrito de 1 a 3 productos. Se usa un modelo de **llegada abierta** (`arrival-rate`): k6 inicia N compras por segundo aunque el servidor se atrase, que es lo que pasa en la vida real y evita que el cliente "se frene solo" y esconda el problema.

| # | Escenario | Carga | Duración | Propósito |
|---|---|---|---|---|
| 1 | **Carga baja** (`baja`) | 2 compras/s | 1 min | Línea base |
| 2 | **Carga objetivo** (`objetivo`) | 10 compras/s | 3 min | Carga esperada en un día de promoción |
| 3 | **Estrés controlado** (`estres`) | Sube 10 → 20 → 30 → 40 → 60 compras/s (30 s por escalón) | 2,5 min | Superar la capacidad y observar el límite |
| 3b | **Recuperación** (parte del estrés) | Baja a 5 compras/s | 1,5 min | ¿Vuelve a la normalidad al bajar la carga? |

### Criterios de aceptación (ya están definidos en `pruebas/tienda.js`, sección `UMBRALES`)

| Métrica | Carga baja | Carga objetivo | Recuperación |
|---|---|---|---|
| Latencia p50 de `checkout` | < 100 ms | < 150 ms | — |
| Latencia p95 de `checkout` | < 200 ms | < 300 ms | p95 global < 300 ms |
| Latencia p95 de `productos` | < 100 ms | < 150 ms | — |
| Tasa de errores | < 1 % | < 1 % | < 1 % |
| Iteraciones descartadas | — | 0 | — |

Para el **estrés** no hay "aprobado/reprobado": se busca el punto donde p95 de checkout supera 1 s (umbral informativo, **se espera que marque ✗**).

### Condiciones de parada y límites de carga (exigido por el documento)

- Si la tasa de errores supera **30 %** → k6 detiene la prueba (`abortOnFail`).
- Si el p95 del checkout supera **8 s** → k6 detiene la prueba.
- Tope de usuarios virtuales: **300** (`MAX_VUS`).
- Solo se permite apuntar a `localhost` (el script lo bloquea; no se puede probar un sitio ajeno por accidente).
- Además, siempre puede detener manualmente con `Ctrl + C`.

---

## 4. Cómo ejecutarlo (30 % — "POC funcional y seguro")

### Preparación (una sola vez)

1. Instalar **Node.js 18+** y **k6**:
   - Windows: `winget install k6 --source winget` (o `choco install k6`, o el instalador `.msi` desde k6.io).
   - macOS: `brew install k6`.
2. En `backend/`: `npm install`.

### Ejecución

**Terminal 1** — servidor:
```bash
cd backend
npm start
```

**Terminal 2** — pruebas. Opción A, todo automático (~10 min):
```powershell
cd pruebas
.\correr-todo.ps1          # Windows PowerShell
./correr-todo.sh           # Linux / macOS / Git Bash
```
Para **ensayar** rápido (duraciones al 30 %): `.\correr-todo.ps1 -Factor 0.3` o `./correr-todo.sh 0.3`.

Opción B, escenario por escenario (útil para la demo en vivo):
```bash
# (en otra terminal, opcional) registra CPU y memoria del servidor:
node monitor.js baja

k6 run -e ESCENARIO=baja     tienda.js
k6 run -e ESCENARIO=objetivo tienda.js
k6 run -e ESCENARIO=estres   tienda.js
```
Para generar el **reporte con gráficas** de k6 (archivo .html):
```powershell
$env:K6_WEB_DASHBOARD="true"; $env:K6_WEB_DASHBOARD_EXPORT="resultados/estres.html"
k6 run -e ESCENARIO=estres tienda.js
```
(En Linux/macOS: `K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=resultados/estres.html k6 run -e ESCENARIO=estres tienda.js`.)

> **Recomendación:** reinicie el servidor (`Ctrl + C` y `npm start`) entre escenarios para empezar con memoria limpia, y no use el computador para otra cosa mientras corre la prueba.

### Resultados que se generan en `pruebas/resultados/`

| Archivo | Contenido | Para qué sirve |
|---|---|---|
| `<escenario>.html` | Reporte interactivo de k6 con gráficas | **Gráficas para la presentación** |
| `<escenario>.json` | Resumen con p50 (`med`), p95, throughput, errores | Llenar la tabla de resultados |
| `recursos-<escenario>.csv` | CPU %, memoria, event loop lag cada segundo | Cumple "CPU o memoria"; abra en Excel y haga una gráfica de línea |

---

## 5. Cómo leer los resultados (20 % — "Resultados y análisis")

| Qué mide el documento | Dónde verlo |
|---|---|
| **Latencia p50** | `http_req_duration{name:checkout}` → columna `med` |
| **Latencia p95** | misma línea → `p(95)` |
| **Throughput** | `http_reqs` (peticiones/s) e `iterations` (compras/s) |
| **Tasa de errores** | `http_req_failed` |
| **CPU / memoria** | `recursos-<escenario>.csv` |
| **¿Cumple criterios?** | Las marcas ✓ / ✗ junto a cada umbral en la salida de k6 |
| **Límite alcanzado** | Gráfica de latencia vs. tiempo en el `.html`; `dropped_iterations` > 0 indica que k6 ya no logró generar la carga pedida |

### Tabla para la presentación (rellene con SUS datos)

| Escenario | Carga | p50 | p95 | Throughput | Errores | CPU máx. | Memoria máx. | ¿Cumple? |
|---|---|---|---|---|---|---|---|---|
| Baja | 2/s | | | | | | | |
| Objetivo | 10/s | | | | | | | |
| Estrés (pico) | hasta 60/s | | | | | | | n/a |
| Recuperación | 5/s | | | | | | | |

### Preguntas que debe poder contestar con los datos

1. ¿Se cumplió la hipótesis de ~28 pagos/s? ¿A cuántos pagos/s empezó a subir la latencia?
2. ¿Qué crece primero: latencia, errores o descarte de iteraciones?
3. ¿La CPU llegó a ~100 %? (Si sí, el cuello de botella es el procesamiento del pago en un solo hilo.)
4. ¿Se recuperó al bajar la carga? ¿Cuánto tardó?
5. ¿La memoria creció de forma sostenida? (Hay un tope de 5000 facturas en memoria.)

### Cuellos de botella y recomendaciones (ajústelas a lo que midió)

- **Procesamiento del pago en el hilo principal** → moverlo a `worker_threads`, a un servicio aparte o a una **cola de trabajos** (el cliente recibe "pedido en proceso" y el cobro se hace asíncrono).
- **Un solo proceso Node** → usar `cluster`/PM2 para aprovechar todos los núcleos, o escalar horizontalmente detrás de un balanceador.
- **Catálogo consultado en cada visita** → caché (en memoria/CDN); es estático y aguanta muchísima más carga.
- **Saturación sin protección** → *rate limiting*, límite de conexiones y *timeouts* para fallar rápido en vez de acumular cola.
- **Observabilidad** → alertas cuando p95 o CPU superen los umbrales encontrados.

### Limitaciones (decirlas honestamente es parte de la nota)

- Cliente de carga y servidor comparten la misma máquina y compiten por CPU.
- El "pago" es un bucle que consume CPU; una pasarela real tiene latencia de red, no CPU local.
- No hay base de datos ni red real; los resultados dependen del hardware.
- Carga sintética: los usuarios reales no se comportan de forma tan uniforme.

---

## 6. Plan de la presentación oral (10–15 min)

| Min | Diapositiva | Contenido | Rúbrica |
|---|---|---|---|
| 0–1 | Portada | Tema, integrantes | — |
| 1–4 | Conceptos | Performance vs. Stress (tabla de la sección 1), motivación y riesgos | Comprensión (15) |
| 4–6 | Sistema y entorno | Tienda Magochix, endpoints, herramienta k6, especificaciones de la PC | Diseño (20) |
| 6–8 | Diseño del experimento | Hipótesis, escenarios, criterios de aceptación, condiciones de parada | Diseño (20) |
| 8–10 | **Demo en vivo** | Mostrar la tienda funcionando y correr `baja` o `estres` con `DUR_FACTOR=0.3` (≈ 1 min) | POC (30) |
| 10–13 | Resultados | Tabla + gráficas del `.html` + CPU/memoria; ¿se cumplió la hipótesis? | Resultados (20) |
| 13–14 | Conclusiones y recomendaciones | Límite observado, cuello de botella, 3 mejoras concretas, limitaciones | Resultados (20) |
| 14–15 | Preguntas | Ver preguntas probables abajo | Defensa (15) |

> **Consejo:** ejecute la prueba **completa** antes y guarde los reportes; en vivo, muestre el ensayo corto (`-Factor 0.3`) y apóyese en los resultados completos ya guardados.

### Preguntas probables del profesor

- *¿Por qué p95 y no el promedio?* El promedio esconde a los usuarios más lentos; p95 dice "el 95 % de los clientes esperó menos que esto".
- *¿Por qué `arrival-rate` y no usuarios fijos?* Porque simula clientes que llegan sin importar si el servidor va lento; con usuarios fijos el cliente se frena y subestima el problema.
- *¿Qué haría para soportar más carga?* Ver las recomendaciones de la sección 5.
- *¿Qué no pudieron probar?* Ver limitaciones.
- *¿Cómo se aseguraron de no afectar a terceros?* Solo `localhost`, tope de VUs y condiciones de parada.

---

## 7. Lista de verificación final

- [ ] Hipótesis escrita **antes** de medir.
- [ ] Criterios de aceptación y condiciones de parada definidos (ya están en `tienda.js`).
- [ ] Los 3 escenarios ejecutados (baja, objetivo, estrés) + recuperación.
- [ ] Reportes `.html`, resúmenes `.json` y CSV de recursos guardados.
- [ ] Tabla de resultados llena con **sus** números.
- [ ] Conclusiones basadas en datos, con limitaciones y 3 recomendaciones concretas.
- [ ] Demo ensayada y tiempo cronometrado (10–15 min).
- [ ] Todos los integrantes saben explicar cualquier diapositiva.
