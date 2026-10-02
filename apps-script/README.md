# Conectar LogiStock Lucciano's a un Google Sheet real

Esta carpeta no es parte de la app cliente (esa sigue siendo `index.html` en
la raíz del repo) — son los dos archivos que hay que copiar a un proyecto de
**Google Apps Script**, más los pasos para dejarlo andando. Nada de esto se
puede hacer desde acá (Claude Code no tiene acceso a tu cuenta de Google) —
son pasos manuales en `sheets.google.com` y `script.google.com`. Es el mismo
patrón que ya usan Lucciano's Academy y SisCap.

## 1. Crear la planilla

1. Andá a [sheets.google.com](https://sheets.google.com) y creá una planilla nueva. Nombrala como quieras (ej. "LogiStock Lucciano's — Base de datos").
2. Anotá el nombre — no hace falta el ID, el script queda "atado" a la planilla (ver paso 2).

No hace falta crear las hojas a mano: `Setup.gs` las crea con los encabezados exactos en el paso 3.

## 2. Crear el proyecto de Apps Script

1. En la misma planilla: menú **Extensiones → Apps Script**.
2. Borrá el contenido de `Code.gs` que trae por defecto y pegá ahí el contenido de **`apps-script/Code.gs`** de este repo.
3. Creá un archivo nuevo (ícono `+` al lado de "Archivos" → Script) llamado `Setup` y pegá ahí el contenido de **`apps-script/Setup.gs`**.
4. Guardá (Ctrl/Cmd+S).

## 3. Configurar el secreto de sesión (SESSION_SECRET)

Sin esto, todo login y toda acción autenticada fallan con un error claro.

1. En el editor de Apps Script, elegí la función `generarSessionSecretSugerido` en el desplegable de arriba y tocá **Ejecutar**.
2. La primera vez pide autorización (tu propio script accediendo a tu propia planilla) — aceptá los permisos.
3. Andá a **Ver → Registros de ejecución** y copiá el valor que aparece.
4. Andá a **Configuración del proyecto** (ícono de engranaje, menú de la izquierda) → **Propiedades del script** → **Agregar propiedad del script**.
5. Nombre de la propiedad: `SESSION_SECRET`. Valor: pegá lo que copiaste. Guardá.

## 4. Crear las hojas y poblar los datos iniciales

Todo esto desde el mismo desplegable de funciones, de a una:

1. Elegí `crearHojas` → **Ejecutar**. Crea las 7 hojas (`Registros`, `Stock`, `Sabores`, `Locales`, `Empleados`, `Config`, `Auditoria`) con los encabezados exactos, y borra la hoja vacía por defecto ("Hoja 1"). Revisá el log: debería decir qué hojas creó.
2. Elegí `poblarSaboresYLocales` → **Ejecutar**. Carga los 47 sabores (con mínimo 6 para vasquetas y 3 para baldes — se puede ajustar después, ver abajo) y los 122 locales activos. Es seguro volver a correrla: si algo ya está cargado, no lo duplica.
3. Elegí `crearPrimerAdmin` → **Ejecutar**. Te da de alta a vos (Gabi) como admin, **sin PIN todavía** — lo vas a crear la primera vez que entres a la app (te va a pedir escribirlo dos veces).

## 5. Desplegar como Web App

1. En el editor de Apps Script: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. "Ejecutar como": tu cuenta. "Quién tiene acceso": **Cualquier usuario** (así GitHub Pages puede hacer `fetch` sin pedir login de Google en cada request — el control de acceso real lo hace el PIN adentro del script).
4. Tocá **Implementar** y copiá la URL que termina en `/exec`.

## 6. Conectar la app

Abrí `index.html` y pegá esa URL en la constante `API_URL`, cerca del principio del `<script>`:

```js
const API_URL = "https://script.google.com/macros/s/AKfycb.../exec";
```

Guardá, commiteá y hacé push — GitHub Pages se actualiza sola en un par de minutos.

## 7. (Opcional) Lector de remitos por foto

Esto es aparte de todo lo de arriba — si no lo configurás, el resto de la app funciona igual, "Leer remito" simplemente muestra un error pidiendo que lo configures.

1. Andá a [console.anthropic.com](https://console.anthropic.com) y creá una cuenta — **ojo, no es lo mismo que tu cuenta de claude.ai** (esa es para chatear vos; esta es para que la app llame a la IA sola, y se paga aparte, por uso, normalmente centavos por remito leído).
2. Ahí, **API Keys → Create Key**. Copiá la clave (empieza con `sk-ant-...`).
3. En el editor de Apps Script: **Configuración del proyecto → Propiedades del script → Agregar propiedad del script**. Nombre: `ANTHROPIC_API_KEY`. Valor: la clave que copiaste. Guardá.
4. Agregá la columna `foto_remito` al final de la hoja `Registros` (encabezado en la fila 1, igual que las demás) — ahí queda el link a la foto en Drive de cada ingreso cargado por foto.
5. La primera vez que se use "Leer remito" en la app, Apps Script va a necesitar permiso para crear carpetas en tu Google Drive (la carpeta `Remitos` se crea sola, ver `CLAUDE.md`) — si pide autorizar de nuevo, es por eso, aceptá igual que la primera vez.

## 8. Función "Devolución" — agregar columna `subtipo`

Esto sí hace falta para que funcione (no es opcional como el lector de remitos): el botón "Devolución" guarda el movimiento como un ingreso normal, pero marcado con `subtipo="devolucion"` para que Historial lo muestre distinto — sin esta columna, `registrar()` igual guarda la devolución bien (el stock queda correcto), pero el dato de "esto fue una devolución" no tiene dónde guardarse y en Historial aparece como un Ingreso cualquiera.

1. Agregá la columna `subtipo` al final de la hoja `Registros` (encabezado en la fila 1, igual que `foto_remito`).
2. Redesplegá el backend (`Implementar → Administrar implementaciones → ✎ → Nueva versión → Implementar`) con el `Code.gs` actualizado.

## Cómo probar que quedó bien conectado

1. Abrí la URL del deploy (`.../exec`) directo en el navegador — debería devolver `{"ok":true,"mensaje":"LogiStock Lucciano's backend activo","version":"1.0.0"}`.
2. Abrí la app publicada, elegí un local y entrá como "Gabi Busquets" (admin) — te va a pedir crear tu PIN las dos veces.
3. Hacé una salida de prueba y confirmá que aparece la fila nueva en la hoja `Registros` de tu planilla.

## Cada vez que actualices el código

Pegar código nuevo en el editor de Apps Script **no alcanza** — el Web App sigue sirviendo la versión vieja hasta que crees una implementación nueva:

1. **Implementar → Administrar implementaciones**.
2. Ícono de lápiz sobre la implementación activa → en "Versión" elegí **Nueva versión** → **Implementar**.
3. La URL `/exec` no cambia, así que no hace falta tocar `index.html` de nuevo.

(Para confirmar que quedó bien: abrí la URL `/exec` en el navegador y fijate que el campo `version` coincida con `BACKEND_VERSION` de `Code.gs` — si no coincide, la implementación quedó vieja.)

## Encabezados exactos de cada hoja

`Setup.gs` los crea solo, pero por si hace falta tocar algo a mano:

| Hoja | Encabezados (fila 1) |
|---|---|
| `Registros` | `id`, `clienteId`, `tipo`, `local`, `empleadoId`, `empleado`, `items`, `total`, `remito`, `ts`, `anulado_por`, `anulado_ts`, `motivo`, `foto_remito`, `subtipo` |
| `Stock` | `local`, `base`, `ts`, `empleado` |
| `Sabores` | `id`, `nombre`, `tipo`, `minimo`, `activo`, `orden`, `categoria`, `peso` |
| `Locales` | `nombre`, `grupo`, `activo`, `clave`, `operaciones` |
| `Empleados` | `id`, `nombre`, `rol`, `local`, `pin_hash`, `salt`, `activo`, `creado_por`, `creado_ts`, `intentos`, `bloqueado_hasta` |
| `Config` | `key`, `value` (reservada para más adelante, no la usa el código todavía) |
| `Auditoria` | `id`, `ts`, `accion`, `actorId`, `actor`, `detalle` |

Notas:
- `Registros.items` y `Stock.base` guardan un JSON tipo `{"3":2,"14":1}` (id de sabor → cantidad) en una sola celda de texto.
- `Registros.clienteId` es el id que genera el dispositivo al crear el movimiento (para la cola offline) — sirve para no duplicar un movimiento si se reintenta el envío.
- `Registros.foto_remito` queda vacío salvo que el ingreso se haya cargado con "Leer remito" — ver sección 7 más abajo.
- `Registros.subtipo` queda vacío salvo en una Devolución (vale `"devolucion"`) — ver sección 8 más abajo. Un ingreso normal nunca lo llena.
- `Empleados.local` queda vacío para `admin` y `supervisor` (no están atados a un local).
- `Empleados.pin_hash`/`salt` nunca se llenan a mano — los genera el propio backend cuando el empleado crea su PIN.
- `rol` es `admin`, `supervisor`, `encargado` (se muestra como "Responsable de local"), `turno` ("Responsable de turno") o `colaborador` (ver la matriz de permisos en el `CLAUDE.md` de la raíz).

## Agregar sabores o locales nuevos

Editá directo la hoja `Sabores` o `Locales` (agregar una fila con los mismos encabezados) — no hace falta pantalla especial ni redesplegar nada, `Code.gs` lee la hoja en cada request. Para dar de baja algo sin borrarlo, poné `NO` en la columna `activo`.

## Ajustar el mínimo de un sabor

Directo en la hoja `Sabores`, columna `minimo` — es el número de vasquetas/baldes bajo el cual la app lo marca en rojo y lo suma al pedido sugerido. `poblarSaboresYLocales` carga 6 para vasquetas y 3 para baldes por defecto.

Nombre, tipo, categoría, mínimo, peso y alta/baja de sabores también se pueden editar directo desde la app (pestaña "Sabores", solo admin) — no hace falta tocar la planilla para eso.

## Peso promedio por sabor (columna `peso`)

`peso` es el peso promedio en kilos de una vasqueta/balde de ese sabor. Con eso cargado, la vista de Stock muestra los kilos totales en cámara de cada sabor (cantidad × peso) y un total general. Se carga sabor por sabor desde la app (pestaña Sabores → lápiz → Editar), no hace falta tocar la planilla. En una hoja que ya existía antes de esta columna, correr `agregarColumnaPeso()` una vez desde Setup.gs para agregarla (queda en 0 — "no cargado" — hasta que se edite cada sabor).

Ya están cargados los pesos reales de 40 sabores (de los 47), sacados de la tabla dinámica del remito de Plaza Oeste — correr `cargarPesosPromedio()` una vez desde Setup.gs para aplicarlos (pisa lo que hubiera en esos ids). Los 7 que faltan (Chocolate Platino, Chocolate vegano 81%, Dulce de Leche con Brownie, Frambuesa + Avella bianca, Mascarpone, Chantilly, Vainilla) no estaban en ese remito — se cargan a mano cuando se tenga el dato.

## Contraseña por local (columna `clave` en Locales)

Un candado extra para el login: al buscar y elegir un local (en una PC, o la primera vez que se configura una tablet), si ese local tiene algo cargado en la columna `clave`, la app pide esa contraseña antes de mostrar la nómina de gente para elegir quién sos. Si `clave` está vacío, no pide nada (como hasta ahora).

No es el PIN de nadie — es una clave compartida por local, para que no cualquiera que abra la app vea de entrada los nombres del equipo. Se guarda en texto plano en la hoja (no hasheada, a diferencia de los PIN) porque admin/supervisor tienen que poder verla ahí para pasársela al responsable de local. Una vez que alguien ya inició sesión, no la vuelve a pedir mientras la sesión esté activa — solo se pide al elegir el local de cero.

## Cómo entran admin y supervisor (local "Operaciones")

Admin y supervisor no pertenecen a ningún local, así que en vez de un link aparte y visible para "soy admin", entran por un local trucho llamado **Operaciones**: aparece mezclado en el mismo buscador que cualquier local real, nadie que no sepa que existe lo encuentra, y si le cargás una `clave` (muy recomendable) queda protegido exactamente igual que un local de verdad.

Para armarlo (una sola vez):
1. Corré `agregarColumnaOperaciones()` desde Setup.gs (agrega la columna a `Locales` si todavía no existe).
2. Corré `crearLocalOperaciones()` desde Setup.gs (crea la fila "Operaciones" con `activo=SI`).
3. En la hoja `Locales`, buscá esa fila y cargale una contraseña en la columna `clave`.

No hace falta crear ningún empleado con `local="Operaciones"` — quien elige ese local y pone la contraseña ve la lista de todos los admins/supervisores ya dados de alta (columna `rol`), no la nómina de un local. Podés cambiarle el nombre a otra cosa editando la celda `nombre` de esa fila; el backend lo reconoce por la columna `operaciones=SI`, no por el nombre.

## Dar de alta al segundo admin o supervisor (sin pasar por Setup.gs)

Una vez que hay un admin activo (Gabi) y ya está conectada la app, el resto de los admins/supervisores/encargados/colaboradores se dan de alta **desde la propia app** (pantalla de Empleados, según lo que permite el rol de quien está logueado — ver la matriz de `CLAUDE.md`). `crearPrimerAdmin()` es solo para el arranque, cuando todavía no hay nadie que pueda loguearse para crear al primero.

## Si algo no cierra

- **"Falta configurar SESSION_SECRET..."** → repetí el paso 3.
- **"No existe la hoja 'X'"** → corré `crearHojas()` (paso 4.1) y revisá que el nombre de la pestaña sea exactamente ese, sin tildes ni mayúsculas distintas.
- **Error de CORS / fetch falla** → confirmá que el deploy tiene acceso "Cualquier usuario" (no "Solo yo" ni "Cualquiera con cuenta de Google en tu organización"), y que `index.html` manda el `Content-Type: text/plain;charset=utf-8` (ya viene así en el código — si lo tocaste, revisalo).
- **Los cambios que subiste no se ven** → te falta crear una "Nueva versión" de la implementación (ver "Cada vez que actualices el código" arriba). Pegar código no alcanza.
- **"PIN bloqueado por intentos incorrectos"** → esperar los 5 minutos, o pedirle a un admin/supervisor/encargado que use "Resetear PIN" desde la app (vuelve a pedirlo en el próximo ingreso).
