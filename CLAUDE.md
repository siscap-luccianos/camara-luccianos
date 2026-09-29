# Cámara Lucciano's — contexto del proyecto

App para registrar **salidas de cámara**, **ingresos** de vasquetas/baldes y **stock** de sabores de helado por local de Lucciano's. Se usa en una **tablet junto a la cámara** (empleados) y en **PC** (encargado/supervisor).

- Dueño: Gabi (Jefe de Capacitación, Lucciano's). Responder siempre en español rioplatense, concreto.
- Publicada en GitHub Pages: https://siscap-luccianos.github.io/camara-luccianos/ (rama `main`, raíz).
- Stack objetivo: **HTML/JS estático en GitHub Pages + Google Apps Script + Google Sheets** (mismo patrón que SisCap y Lucciano's Academy, repos hermanos en la org `siscap-luccianos`).

## Estado actual (29/09/2026)

- `index.html`: app completa en un solo archivo (≈165 KB, fotos embebidas en base64 en la constante `FOTOS`).
- `fotos/`: 42 fotos 160×160 de los sabores (por id). Faltan: 11 Chocolate vegano 81%, 19 Frambuesa + Avella bianca, 29 Mascarpone, 37 Pretzel, 43 Tiramisú al pistacchio.
- `SABORES`: 47 sabores hardcodeados (45 vasquetas `v` + Chantilly y Vainilla en balde `b`).
- `LOCALES_PADRON`: 122 locales activos (35 propios + 87 franquicias), copiados de `apps-script/Setup.gs` → `PADRON_SUCURSALES` del repo `luccianos-academy`.
- **La persistencia usa `window.claude.use("db")` (base de artifacts de claude.ai). En GitHub Pages NO guarda nada**: botones de registrar deshabilitados. Esto es lo primero a reemplazar.

Modelo de datos actual (mantener la lógica al migrar):
- `registros`: `{tipo: salida|ingreso|conteo, local, empleado, items:{idSabor:cant}, total, ts}`
- `stock/<local>`: último conteo físico `{local, base:{idSabor:cant}, ts, empleado}`
- Stock actual = conteo base + ingresos − salidas posteriores al conteo (`stockMap()`).
- Alerta: sabor con stock < `MIN` (6). Pedido sugerido = salidas 7 días + MIN − stock.

## Plan de trabajo (auditoría 29/09)

### Fase 1 — que funcione al 100% en la tablet
1. **Backend Google Sheets + Apps Script** (Web App, `doGet`/`doPost` JSON). Hojas: `Registros`, `Stock`, `Sabores`, `Locales`, `Empleados`, `Config`. Usar `LockService` en escrituras. Polling cada ~30 s en vez de onSnapshot.
2. **Usuarios, roles y PIN** (DECIDIDO con Gabi 29/09 — ver sección "Roles y permisos"). Reemplaza el nombre libre guardado en localStorage (bug: el siguiente registraba con el nombre del anterior).
3. **Local fijo por dispositivo**: configurarlo una vez con PIN de admin; selector bloqueado después.
4. **Cola offline**: guardar movimientos pendientes en localStorage y sincronizar al volver la conexión (con id único para evitar duplicados).
5. **Mínimo por sabor** (columna en `Sabores`), no un 6 global (los baldes no son vasquetas).
6. **Sabores desde el Sheet** con columna `activo`; foto por id desde `fotos/`.
7. **Anular** el último movimiento propio (≤10 min), queda registrado.
8. **Ingreso con cantidad numérica + nº de remito** (no un toque por vasqueta).
9. **Días hasta la próxima entrega** (2/3/4/7) para el pedido sugerido.
10. **Botón "Enviar pedido por WhatsApp"** (`https://wa.me/?text=`), texto con sabores y cantidades.

### Roles y permisos (decidido)

Roles: **Admin** (Gabi, crea todo) · **Supervisor** (locales asignados) · **Encargado** (un local) · **Colaborador**.

| Acción | Admin | Supervisor | Encargado | Colaborador |
|---|---|---|---|---|
| Crear/editar locales, sabores, mínimos | ✅ | ❌ | ❌ | ❌ |
| Crear supervisores y asignarles locales | ✅ | ❌ | ❌ | ❌ |
| Crear encargados | ✅ | ✅ solo en sus locales | ❌ | ❌ |
| Alta/baja de colaboradores | ✅ | ✅ | ✅ solo su local | ❌ |
| Resetear PIN | ✅ | ✅ | ✅ solo colaboradores | ❌ |
| Anular movimiento | ✅ | ✅ | ✅ dentro de 24 hs | solo el propio, ≤10 min |
| Borrar registros/historial (borrado real) | ✅ | ❌ | ❌ | ❌ |
| Salida / ingreso | ✅ | ✅ | ✅ | ✅ |
| Conteo físico | ✅ | ✅ | ✅ | ❌ |
| Ver stock / pedido / enviar WhatsApp | ✅ | ✅ sus locales | ✅ | solo ver stock |

Reglas:
- **Soft delete**: bajas y anulaciones nunca borran; guardan `anulado_por`, `anulado_ts`, `motivo`. Borrado real solo Admin.
- **Auditoría**: hoja `Auditoria` con toda acción administrativa (alta, baja, reset PIN, anulación, cambio de config): quién, qué, cuándo.
- **PIN de 4 dígitos** (no contraseña). El encargado/supervisor da de alta con nombre y apellido; en el primer ingreso el colaborador crea su PIN (dos veces). Reset → vuelve a crearlo al próximo ingreso.
- PIN guardado como **hash con salt** (`Utilities.computeDigest` SHA-256) en el Sheet, nunca en texto plano. Validación siempre en Apps Script, nunca en el cliente.
- **Bloqueo**: 5 PIN incorrectos → usuario bloqueado 5 minutos.
- **Sesión**: token temporal emitido por Apps Script; en la tablet se cierra sola tras cada registro (o 60 s de inactividad). En PC dura más (p. ej. 8 hs) para supervisores/admin.
- La tablet muestra solo los colaboradores del local fijado en ese dispositivo.
- Hoja `Empleados`: `id, nombre, rol, local(es), pin_hash, salt, activo, creado_por, creado_ts, intentos, bloqueado_hasta`.

### Limpieza
- Sacar las fotos base64 del HTML y cargarlas desde `fotos/`.
- Quitar/limitar a admin el cambio de foto desde la app.
- Quitar textos que mencionan "la app de Claude".
- Mover `<title>` y fuentes al `<head>`; unidad correcta en baldes; historial filtrado por fecha real.

### Fase 2
- Vista PC para encargado/supervisor (varios locales, consumo semanal), con PIN.
- PWA instalable (manifest + service worker, como Academy).
- Alerta por mail cuando un sabor queda bajo mínimo.

## Convenciones
- Todo en español. Commits en español, descriptivos.
- Probar en Playwright (Chromium preinstalado) antes de pushear: sin errores de consola, flujo salida → stock → historial.
- El código de Apps Script va en `apps-script/` con instrucciones de despliegue paso a paso para Gabi (él pega el script y hace "Implementar").
