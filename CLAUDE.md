# LogiStock Lucciano's — contexto del proyecto

App para registrar **salidas de cámara**, **ingresos** de vasquetas/baldes y **stock** de sabores de helado por local de Lucciano's. Se usa en una **tablet junto a la cámara** (empleados) y en **PC** (encargado/supervisor).

- Dueño: Gabi (Jefe de Capacitación, Lucciano's). Responder siempre en español rioplatense, concreto.
- Publicada en GitHub Pages: https://siscap-luccianos.github.io/camara-luccianos/ (rama `main`, raíz).
- Stack objetivo: **HTML/JS estático en GitHub Pages + Google Apps Script + Google Sheets** (mismo patrón que SisCap y Lucciano's Academy, repos hermanos en la org `siscap-luccianos`).

## Estado actual (29/09/2026, tarde)

**Fase 1 implementada de punta a punta** (backend + frontend). Falta que Gabi despliegue el backend (pasos en `apps-script/README.md`) y pegue la URL en `index.html` — hasta entonces la app publicada en GitHub Pages muestra un aviso de "backend no conectado".

- `apps-script/Code.gs` + `apps-script/Setup.gs` + `apps-script/README.md`: backend real en Google Apps Script + Sheets. Login por PIN (hash+salt SHA-256, bloqueo 5 intentos), roles admin/supervisor/encargado/colaborador con la matriz de abajo, anular con ventana por rol, Auditoria, `LockService` en escrituras. Ver detalle de hojas/columnas en `apps-script/README.md`.
- `index.html`: reescrito. Ya no usa `window.claude.use("db")` ni tiene `SABORES`/`LOCALES_PADRON`/fotos en base64 hardcodeados — todo (sabores, locales, stock, registros) viene del backend vía `fetch` (`accion` + `token`, `Content-Type: text/plain` para evitar preflight CORS, mismo patrón que `luccianos-academy`). Polling cada 30 s. Fotos desde `fotos/<id>.jpg` con fallback a iniciales si falta el archivo.
- Paleta/tipografía nueva (Fraunces + Manrope, fondo crema/tinta oscura) y flujo de login con selector de persona + teclado numérico propio para el PIN, inspirados en el mockup que armó Gabi (`claude.ai/artifact/P5uG4JV3wT3c4YaSsEtG3U`).
- `API_URL` en `index.html` todavía tiene el placeholder `PEGAR_URL_DEL_DEPLOY_DE_APPS_SCRIPT_ACA` — Gabi tiene que desplegar el backend (`apps-script/README.md`) y pegar la URL real ahí.
- Falta cargar `fotos/11.jpg`, `19.jpg`, `29.jpg`, `37.jpg`, `43.jpg` (Chocolate vegano 81%, Frambuesa + Avella bianca, Mascarpone, Pretzel, Tiramisú al pistacchio) — mientras tanto esos sabores muestran las iniciales.
- Probado con Playwright contra un backend simulado (ver "Convenciones"): login con PIN nuevo, salida, stock/pedido/WhatsApp, historial + anular, conteo físico y alta de empleado en Equipo, todo sin errores de consola.

Modelo de datos (en Sheets, ver `apps-script/README.md` para columnas exactas):
- `Registros`: `{id, clienteId, tipo: salida|ingreso|conteo, local, empleadoId, empleado, items:{idSabor:cant} (JSON), total, remito, ts, anulado_por, anulado_ts, motivo, foto_remito}`.
- `Stock`: una fila por local con el último conteo físico `{local, base:{idSabor:cant} (JSON), ts, empleado}`.
- Stock actual = conteo base + ingresos − salidas posteriores al conteo (`stockMap()` en el cliente, sobre lo que devuelve `datos()`).
- Alerta: sabor con stock bajo su `minimo` propio (columna en `Sabores`, ya no un `MIN=6` global). Pedido sugerido = consumo promedio diario (salidas 7 días / 7) × (días hasta la entrega elegidos + 1) − stock, con ajuste manual por sabor.

## Qué falta para que Gabi la use en la tablet

1. Desplegar el backend siguiendo `apps-script/README.md` (crear planilla, pegar `Code.gs`/`Setup.gs`, `SESSION_SECRET`, poblar datos, deployar como Web App).
2. Pegar la URL del deploy en `API_URL` de `index.html`, commitear y pushear.
3. Fijar el local de cada tablet la primera vez: cualquiera del equipo de ese local hace login normal (local + contraseña de local si tiene + su nombre + su PIN) y al final le pregunta si quiere fijar ese local en el dispositivo.
4. Subir las 5 fotos que faltan a `fotos/`.

### Fase 1 — historial de lo pedido (todo hecho salvo el despliegue)
1. ~~Backend Google Sheets + Apps Script~~ hecho — `apps-script/Code.gs`.
2. ~~Usuarios, roles y PIN~~ hecho.
3. ~~Local fijo por dispositivo~~ hecho: se ofrece fijarlo al final del login normal (a cualquiera de encargado/turno/colaborador, no hace falta PIN de admin aparte — la contraseña del local, si tiene, ya cumple ese filtro).
4. ~~Cola offline~~ hecho (`localStorage`, `clienteId` para deduplicar, reintento al volver la conexión y en cada polling).
5. ~~Mínimo por sabor~~ hecho (columna `minimo` en `Sabores`).
6. ~~Sabores desde el Sheet~~ hecho (columna `activo`; foto por id desde `fotos/`).
7. ~~Anular~~ hecho, con la ventana por rol de la matriz.
8. ~~Ingreso con cantidad numérica + nº de remito~~ hecho.
9. ~~Días hasta la próxima entrega~~ hecho (chips 2/3/4/7 en Stock).
10. ~~Botón "Enviar pedido por WhatsApp"~~ hecho, con vista previa del mensaje y "Copiar texto".

### Roles y permisos (decidido)

Roles: **Admin** (Gabi, crea todo) · **Supervisor** (ve y gestiona todos los locales; elige cuál ver con un selector) · **Encargado** = "Responsable de local" en la interfaz (un local, gestiona su equipo) · **Turno** = "Responsable de turno" en la interfaz (un local, mismas tareas operativas que Responsable de local pero sin gestión de equipo) · **Colaborador**.

| Acción | Admin | Supervisor | Encargado (Resp. de local) | Turno (Resp. de turno) | Colaborador |
|---|---|---|---|---|---|
| Crear/editar locales, sabores, mínimos | ✅ | ❌ | ❌ | ❌ | ❌ |
| Crear supervisores | ✅ | ❌ | ❌ | ❌ | ❌ |
| Crear encargados | ✅ | ✅ en cualquier local | ❌ | ❌ | ❌ |
| Alta/baja de turno/colaboradores | ✅ | ✅ | ✅ solo su local | ❌ | ❌ |
| Resetear PIN | ✅ | ✅ | ✅ solo turno/colaboradores | ❌ | ❌ |
| Editar nombre de otro empleado | ✅ | ✅ (no admins) | ✅ solo turno/colaboradores de su local | ❌ | ❌ (solo el propio, desde el header) |
| Anular movimiento | ✅ | ✅ | ✅ dentro de 24 hs | ✅ dentro de 24 hs | solo el propio, ≤10 min |
| Borrar registros/historial (borrado real) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Salida / ingreso | ✅ | ✅ | ✅ | ✅ | ✅ (ingreso sin N° de remito ni lector de remitos — eso lo carga encargado/turno) |
| Conteo físico | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver stock / pedido / enviar WhatsApp | ✅ | ✅ todos (selector de local) | ✅ | ✅ | ❌ (decidido por Gabi 02/10/2026: colaborador solo tiene Salida, Ingreso e Historial, para que no toque nada por error) |
| Ver/gestionar pestaña Equipo | ✅ | ✅ | ✅ | ❌ | ❌ |

Reglas:
- **Soft delete**: bajas y anulaciones nunca borran; guardan `anulado_por`, `anulado_ts`, `motivo`. Borrado real solo Admin.
- **Auditoría**: hoja `Auditoria` con toda acción administrativa (alta, baja, reset PIN, anulación, cambio de config): quién, qué, cuándo.
- **PIN de 4 dígitos** (no contraseña). El encargado/supervisor da de alta con nombre y apellido; en el primer ingreso el colaborador crea su PIN (dos veces). Reset → vuelve a crearlo al próximo ingreso.
- PIN guardado como **hash con salt** (`Utilities.computeDigest` SHA-256) en el Sheet, nunca en texto plano. Validación siempre en Apps Script, nunca en el cliente.
- **Bloqueo**: 5 PIN incorrectos → usuario bloqueado 5 minutos.
- **Sesión**: token temporal emitido por Apps Script, vence al cierre de la jornada comercial (7am a 3am del día siguiente) — no un tope fijo de horas, así nadie queda desconectado a mitad de turno. En la tablet la sesión queda abierta mientras haya actividad — ya NO se cierra sola después de cada registro (decidido por Gabi 02/10/2026: si alguien tiene que cargar varias salidas seguidas, se queda logueado) — y se cierra sola a los 60 s de inactividad, o con el botón "Salir". En PC, para un local real (login con PIN), no se cierra por inactividad, pero a los 3 min sin tocar nada la pantalla se **bloquea** (pide de nuevo el PIN de quien está logueado, sin perder lo que estaba haciendo) — así si alguien deja la PC abierta nadie puede tocar nada sin el PIN; tiene un botón "Salir" para cerrar sesión del todo si no es la misma persona. Si entró por **Operaciones** (admin/supervisor, sin PIN propio — ver más abajo), en PC la sesión queda abierta sin bloquearse por inactividad — no tiene sentido pedir una contraseña compartida de local como si fuera el PIN personal de alguien (decidido por Gabi 04/10/2026, revirtiendo la versión anterior de este bloqueo).
- **Contraseña por local**: candado opcional (columna `clave` en `Locales`, texto plano, la ven admin/supervisor en la planilla) que se pide al elegir el local en el login general (PC, o al configurar una tablet nueva) antes de mostrar la nómina — evita que cualquiera vea los nombres del equipo. No se pide en una tablet ya fijada ni mientras la sesión siga activa.
- **Cómo entran admin y supervisor**: no hay link visible de "soy admin" (exponía sus nombres a cualquiera) — entran por un local trucho llamado **Operaciones** (columna `Locales.operaciones=SI`), que se ve mezclado en el buscador igual que cualquier local real. Requiere contraseña cargada (columna `clave`, **obligatoria** para este local en particular — sin ella no se puede entrar así). Ver `apps-script/README.md` para armarlo.
- **Operaciones no pide PIN** (decidido por Gabi 01/10/2026): una vez puesta la contraseña del local, elegir el perfil (admin/supervisor) entra directo — la contraseña de Operaciones es el único factor ahí, no se valida el PIN personal de esa cuenta. Backend: acción `loginGestion` (`empleadoId`, `clave`, `local`), exige `Locales.operaciones=SI` y una `clave` realmente cargada; nunca aplica a un local real (ahí el PIN sigue siendo obligatorio, sin cambios).
- La tablet muestra solo el equipo (colaboradores, turno y encargado) del local fijado en ese dispositivo.
- Hoja `Empleados`: `id, nombre, rol, local (vacío para admin/supervisor), pin_hash, salt, activo, creado_por, creado_ts, intentos, bloqueado_hasta`.

### Limpieza (hecho)
- ~~Sacar las fotos base64 del HTML y cargarlas desde `fotos/`~~ hecho.
- ~~Quitar/limitar a admin el cambio de foto desde la app~~: se sacó el cambio de foto desde la app (no hay upload); para cambiar una foto se reemplaza el archivo `fotos/<id>.jpg` en el repo.
- ~~Quitar textos que mencionan "la app de Claude"~~ hecho.
- ~~Mover `<title>` y fuentes al `<head>`~~ hecho. Unidad correcta en baldes (`unidad()` según `tipo` del sabor). Historial con filtro real (Hoy/7 días/30 días/Todo).

### Recortes de alcance de esta vuelta (a valorar en Fase 2)
- Alta/edición de **sabores y locales** (mínimo, activo, nombre) no tiene pantalla propia todavía — se edita directo en las hojas `Sabores`/`Locales` (ver `apps-script/README.md`). El backend ya tiene las acciones (`adminSabor`, `adminLocal`) por si se arma la UI después.
- El panel **Equipo** administra encargados/colaboradores del local seleccionado; para dar de alta un segundo admin o supervisor hay que hacerlo desde la cuenta de un admin existente (la app permite crearlos, pero la lista de "Equipo" no lista admins/supervisores sueltos — son gente de gestión general, no de "un local").
- Borrado real de un movimiento (`eliminarRegistro`, solo-admin) existe en el backend pero no tiene botón en la interfaz todavía — hoy la vía normal es "Anular" (soft delete).
- No se migró el diseño a un layout apaisado de dos paneles (grilla + carrito lateral) como el mockup de Gabi — se mantuvo la columna única responsive con la barra inferior de carrito, para no arriesgar el uso en celular/tablet angosta. Si en Fase 2 se confirma que todas las tablets son apaisadas, vale la pena revisarlo.

### Fase 2
- Vista PC para encargado/supervisor (varios locales, consumo semanal), con PIN.
- PWA instalable (manifest + service worker, como Academy).
- Alerta por mail cuando un sabor queda bajo mínimo.
- ~~**Lector de remitos por foto**~~ implementado 01/10/2026, falta que Gabi lo configure (no se puede probar en vivo porque necesita una clave de API propia):
  - Backend: acción `leerRemito` en `Code.gs` — manda la foto a Claude (Anthropic, con visión) pidiéndole SOLO los renglones de la sección "SABORES" (ignora Chocolates/Tabletas/Sin Gluten), matchea cada nombre detectado contra el catálogo de `Sabores` (`_matchearSabor`: exacto → contiene → palabras en común ≥60%), sube la foto a Drive (`Remitos/<Local>/<AAAA-MM>/<AAAA-MM-DD>_remito-<número>.jpg`, se crean las carpetas solas) y devuelve todo para que el cliente lo revise — no escribe en `Registros` todavía.
  - Frontend: botón "📷 Leer remito" en Ingreso → pantalla "Leyendo…" con la foto → pantalla de revisión (cantidad editable por renglón, los sin-match en amarillo con un `<select>` para elegir el sabor a mano o ignorar el renglón) → "Cargar al carrito de ingreso" precarga el carrito normal de Ingreso (mismo flujo de "Confirmar ingreso" de siempre, nada nuevo ahí) y precompleta el N° de remito detectado.
  - `registrar()` ahora acepta un `fotoRemito` (URL de Drive) opcional y lo guarda en la columna nueva `Registros.foto_remito`.
  - **Pendiente de Gabi** (ver `apps-script/README.md` sección 7, es opcional — sin esto el resto de la app funciona igual):
    1. Crear una clave en `console.anthropic.com` (cuenta de API, **no** es la de claude.ai) y guardarla en Propiedades del script como `ANTHROPIC_API_KEY`.
    2. Agregar la columna `foto_remito` al final de la hoja `Registros`.
  - Maqueta original (solo referencia visual, ya no vigente — se construyó la versión real descripta arriba): `https://claude.ai/artifact/EpdrEMYvv45T49C86nfEog`.
- **Icepops** (arrancado 05/10/2026 — catálogo listo para cargar, falta que Gabi lo pegue en la hoja):
  1. ~~Catálogo y fotos~~ sacados de Lucciano's Academy (`js/data/productosIcepops.js` + `assets/img/icepops/`, carta oficial "Hey! Choose your Icepop" jul-2026) — 48 sabores reales en 6 categorías (**Fruta, Luxury, Cannoli, Crema, Bañados, Mini Icepops**, las categorías son las oficiales, ya no las de ejemplo del mock), ids 48-95, fotos ya convertidas y subidas en `fotos/48.jpg`...`fotos/95.jpg`. **Quedan afuera por ahora**: Dubai (decidido por Gabi 04/10/2026) y Geladot, 8 sabores (se vende por peso, no por unidad — no encaja en este modelo de stock, decidido por Gabi 05/10/2026).
  2. ~~Modelo de datos para Icepops~~ hecho 05/10/2026 — dos columnas nuevas en `Sabores` (backend, ver `apps-script/README.md` sección 9): `familia` (`vasquetas` | `icepops`) y `cantidad_maestra` (unidades por caja cerrada, varía por sabor). Dos `tipo` nuevos en el frontend: `i` (icepop suelto, se saca de a uno) y `m` (Mini Icepops — **se cuentan por caja x4, no por unidad individual**, decidido por Gabi 05/10/2026, aunque la caja traiga 4 sigue siendo "una caja" de stock).
  3. ~~Carga rápida por caja~~ hecho 05/10/2026: en Ingreso, un sabor con `cantidad_maestra` cargada muestra un botón "+1 caja (N)" al lado del contador de siempre, para sumar una caja cerrada de una sola vez. En Stock, el renglón de ese sabor muestra además "X cajas + Y sueltas" (**solo ayuda visual** — no cambia el cálculo de stock, que sigue siendo la cuenta de unidades de siempre; decidido por Gabi 05/10/2026 explícitamente para no tocar ningún cálculo existente).
  4. **Pendiente de Gabi**: agregar las columnas `familia`/`cantidad_maestra` a `Sabores`, redesplegar el backend, y pegar el catálogo de 48 filas que le pasamos (TSV aparte) — viene con todo completo salvo `cantidad_maestra`, que hay que cargar sabor por sabor porque cada caja trae una cantidad distinta.
  5. Agrupados por categoría propia en la navegación (pills Vasquetas/Icepops → categoría → sabores) — **todavía no armado**, sigue siendo el filtro de categorías de siempre (plano, mezclando categorías de helado e Icepop en la misma lista de chips). Mock ya armado para cuando se encare: `https://claude.ai/artifact/VzaSPHuerYsivU3jdwBDpZ`.
  6. Que se puedan cargar por remito (el lector de remitos de arriba tendría que reconocer también la sección de Icepops del remito, no solo "SABORES") — no empezado.
  7. Que el pedido sugerido evalúe Icepops igual que a los helados (consumo promedio × días hasta la entrega − stock) — en principio ya funciona solo una vez cargado el catálogo (`pedidoSugerido()` opera por sabor, no distingue familia), falta confirmar en la práctica con datos reales.
  8. ~~Tendencia de 3 semanas~~ implementado 02/10/2026 **para helados** (Icepops lo hereda solo, no hace falta tocar esto de nuevo — ver más abajo). Dos vistas, calculadas 100% en el cliente sobre lo que ya trae `datos()` (60 días de historial, nada nuevo al backend):
     - **Stock > Pedido sugerido**: mini gráfico de 3 barras por sabor (`tendenciaSemanas()` en `index.html`) con el consumo de las **últimas 3 semanas calendario completas** (lunes a domingo, sin contar la semana en curso) + indicador de tendencia (Subiendo/Bajando/Estable) + aviso si alguna semana tuvo quiebre de stock (reconstruido con `stockMapHasta()`, día a día).
     - **Historial**: la tabla "Salidas por sabor" (sabor × LU-DO) tiene selector de 3 semanas (Esta semana / Semana pasada / Hace 2 semanas, `S.semanaHist`) que rota solo cada lunes porque se calcula siempre contra "ahora" (`lunesDe()`), no hay nada que migrar a mano.
  - **Cómo entran los Icepops en una salida**: mismo carrito y mismo registro que los helados — si en una salida sacás helado e Icepops juntos, es una sola salida con un solo `items:{idSabor:cantidad}` mezclando ambas familias (el campo ya es JSON libre, no distingue por sabor). No se abren dos registros ni dos pantallas de confirmación separadas.
- ~~**Función "Devolución"**~~ implementada 02/10/2026 (surgió porque en Recoleta sacaron sabores de más y los volvieron a guardar en la cámara sin forma clara de registrarlo). Diseño, mock aprobado por Gabi y armado tal cual:
  - Es para **todos** los roles que hacen Salida (colaborador, turno, encargado, supervisor, admin).
  - **Colaborador**: el tab "Ingreso" genérico pasa a ser "Devolución" directamente (`renderNav()` en `index.html`).
  - **Turno/Encargado/Supervisor/Admin**: mantienen el Ingreso completo (remito + lector de remitos); si tienen algo pendiente de devolver les aparece el link "¿Es una devolución de algo que sacaste? Tocá acá" arriba de todo en `gridIngreso()`, que cambia a la vista de Devolución (`S.modoDevolucion=true`) con un "Volver a Ingreso" — no es una pestaña nueva, la nav sigue marcando "Ingreso" como activo.
  - `gridDevolucion()` muestra, por sabor, lo que esa persona sacó hoy **menos lo que ya devolvió hoy** (`pendienteDevolucionHoy()` en `index.html`, calculado 100% en el cliente sobre `S.regs`) — ese neto es el tope del stepper, no se puede devolver de más. Un sabor en 0 pendiente no aparece en la lista.
  - Sin campo de N° de remito.
  - Backend: sigue siendo `tipo:"ingreso"` (no toca `stockMap()`/`pedidoSugerido()`/`tendenciaSemanas()`), con una columna nueva `Registros.subtipo` (`"devolucion"` o vacío) — **a diferencia de lo planeado originalmente, NO se reutilizó `motivo`** porque esa columna ya la pisa `anular()` con el motivo de la anulación, hubiera perdido la marca de "esto fue una devolución" apenas alguien anulara el movimiento. En Historial, la pill muestra "devolución" (color propio, `.pill.devolucion`) en vez de "ingreso" cuando corresponde.
  - Quedó resuelto el punto que estaba abierto: alcanza con sumar todas las salidas propias del día (neteadas contra devoluciones ya hechas) — no se asocia a una salida puntual.
  - **Pendiente de Gabi**: agregar la columna `subtipo` al final de la hoja `Registros` y redesplegar el backend — ver `apps-script/README.md` sección 8. Sin esto el stock queda bien igual, solo que Historial muestra la devolución como un Ingreso común.
- ~~**Función "Desperdicio"**~~ implementada 05/10/2026 (sabores que se rompen, se caen o vencen — antes no había forma de sacarlos del stock sin que pareciera una venta real). Diseño acordado con Gabi y armado tal cual:
  - Es para **todos** los roles que hacen Salida (colaborador, turno, encargado, supervisor, admin) — decidido explícitamente no restringirlo a responsable: si solo turno/encargado pudieran cargarlo, en la práctica el colaborador que rompe algo no lo reporta (no hay nadie de turno en el momento, o por las dudas), y el stock queda con un agujero invisible hasta el próximo conteo. La trazabilidad ya está — cada registro queda con el nombre de quién lo cargó.
  - Mismo mecanismo que Salida (grilla de sabores, tocar para sumar de a uno), accesible desde adentro de Salida con el link "¿Se rompió o se tiró algo? Tocá acá" (`gridSalida()`/`gridDesperdicio()` en `index.html`, mismo patrón que el link de Devolución dentro de Ingreso) — no es una pestaña nueva.
  - Pide un **motivo corto obligatorio** (input `motivoDesperdicio`, ej. "se cayó") antes de poder confirmar — mismo criterio que Anular, como salvaguarda liviana contra un toque accidental; el botón "Registrar desperdicio" queda deshabilitado hasta que se completa.
  - Backend: sigue siendo `tipo:"salida"` (resta del stock igual que cualquier salida — la unidad física ya no está, así que sí entra en `salidasDias()`/`pedidoSugerido()`/`tendenciaSemanas()` para que se siga reponiendo), con `Registros.subtipo="desperdicio"` (reutiliza la misma columna que ya existe de Devolución, no hizo falta agregar otra). A diferencia de Devolución, acá `motivo` si se guarda en la creación del registro (`registrar()` ahora acepta un `motivo` opcional) — se acepta que si alguien anula el movimiento más adelante, `anular()` pisa ese motivo con el de la anulación; no es grave porque el `subtipo` (lo que importa para no contarlo como venta) no se toca, y el registro igual queda marcado "Anulado" bien visible.
  - `pendienteDevolucionHoy()` ya no cuenta un desperdicio como "lo saqué hoy" (no se puede devolver algo que se rompió).
  - En Historial, la pill muestra "desperdicio" (color propio, `.pill.desperdicio`) y, si no está anulado, el motivo cargado al lado del total.
  - No necesita columna nueva en Sabores ni en Registros — reutiliza `subtipo`, que ya está desplegado desde Devolución.

## Convenciones
- Todo en español. Commits en español, descriptivos.
- Probar en Playwright (Chromium preinstalado) antes de pushear: sin errores de consola, flujo salida → stock → historial.
- El código de Apps Script va en `apps-script/` con instrucciones de despliegue paso a paso para Gabi (él pega el script y hace "Implementar").
- **Antes de armar una pantalla o flujo nuevo (no un fix chiquito), mostrar siempre un mock interactivo primero** (artifact tipo Design, canvas) para que Gabi lo vea y apruebe antes de tocar `index.html`/`Code.gs` de verdad (decidido por Gabi 02/10/2026). El canvas de mocks que ya se viene usando: `https://claude.ai/artifact/VzaSPHuerYsivU3jdwBDpZ`.
