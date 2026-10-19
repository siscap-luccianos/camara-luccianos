/* ============================================================
   LogiStock Lucciano's — Backend (Google Apps Script)

   Reemplaza la base de artifacts de claude.ai (window.claude.use("db"))
   por una planilla de Google Sheets real. Mismo patrón que los repos
   hermanos (Lucciano's Academy, SisCap): un solo endpoint doPost,
   despachado por "accion", con un token de sesión propio firmado
   (HMAC) en vez de cuentas de Google — acá el login es con PIN de
   4 dígitos por empleado, no con Google Sign-In.

   SETUP OBLIGATORIO (una sola vez, a mano, en el editor de Apps
   Script): Configuración del proyecto → Propiedades del script →
   agregar "SESSION_SECRET" con un valor random largo. Sin eso,
   CUALQUIER request autenticado falla con un error claro.

   Este script va ligado ("bound") a la planilla que contiene las
   hojas (ver apps-script/README.md para los encabezados exactos).
   Antes de desplegar, correr Setup.gs una vez (crea las hojas,
   puebla Sabores/Locales y da de alta al primer admin).
=============================================================== */

const JORNADA_INICIO_HORA = 7; // 7am
const JORNADA_FIN_HORA = 3; // 3am del día siguiente
const BLOQUEO_MS = 5 * 60 * 1000; // 5 minutos de bloqueo tras 5 PIN incorrectos
const INTENTOS_MAX = 5;
const VENTANA_ANULAR_COLABORADOR_MS = 10 * 60 * 1000; // 10 min
const VENTANA_ANULAR_ENCARGADO_MS = 24 * 60 * 60 * 1000; // 24 hs
const DIAS_HISTORIAL = 60; // igual que el podado que hacía el cliente contra la base vieja

/** Versión de este archivo — devuelta por doGet(). Sirve para confirmar
 *  que "Implementar → Nueva implementación" realmente se hizo: pegar
 *  código en el editor NO alcanza, si no se crea una versión nueva el
 *  Web App sigue sirviendo la anterior. */
const BACKEND_VERSION = "1.39.0";

function doPost(e) {
  let resultado;
  try {
    const body = JSON.parse(e.postData.contents);
    resultado = _despachar(body);
  } catch (err) {
    resultado = { ok: false, error: String((err && err.message) || err) };
  }
  resultado.backendVersion = BACKEND_VERSION;
  return ContentService
    .createTextOutput(JSON.stringify(resultado))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, mensaje: "LogiStock Lucciano's backend activo", version: BACKEND_VERSION }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Acciones que no requieren token (login y datos públicos no sensibles:
// nombres de locales/empleados para armar los selectores de login).
const ACCIONES_PUBLICAS = ["localesActivos", "empleadosLocal", "empleadosGestion", "login", "loginGestion", "verificarClaveLocal"];

function _despachar(body) {
  const accion = body.accion;
  if (ACCIONES_PUBLICAS.indexOf(accion) === -1) {
    const sesion = _verificarSesion(body.token);
    if (!sesion.ok) return sesion;
    return _despacharConSesion(accion, body, sesion.empleado);
  }
  switch (accion) {
    case "localesActivos": return localesActivos();
    case "empleadosLocal": return empleadosLocal(body.local);
    case "empleadosGestion": return empleadosGestion();
    case "login": return login(body.empleadoId, body.pin, body.pinConfirm, body.local);
    case "loginGestion": return loginGestion(body.empleadoId, body.clave, body.local);
    case "verificarClaveLocal": return verificarClaveLocal(body.local, body.clave);
    default: return { ok: false, error: "Acción desconocida: " + accion };
  }
}

function _despacharConSesion(accion, body, empleado) {
  switch (accion) {
    case "misDatos": return { ok: true, empleado: _empleadoPublico(empleado) };
    case "actualizarMiNombre": return actualizarMiNombre(body.nombre, empleado);
    case "datos": return datos(body.local, empleado);
    case "registrar": return registrar(body.clienteId, body.tipo, body.local, body.items, body.remito, empleado, body.fotoRemito, body.subtipo, body.motivo, body.kilos, body.vencimientos);
    case "leerRemito": return leerRemito(body.foto, body.mime, body.local, empleado);
    case "conteo": return conteo(body.clienteId, body.local, body.items, empleado);
    case "anular": return anular(body.registroId, body.motivo, empleado);
    case "eliminarRegistro": return eliminarRegistro(body.registroId, empleado);
    case "altaEmpleado": return altaEmpleado(body.nombre, body.rol, body.local, empleado);
    case "bajaEmpleado": return bajaEmpleado(body.empleadoId, empleado);
    case "eliminarEmpleado": return eliminarEmpleado(body.empleadoId, empleado);
    case "resetPin": return resetPin(body.empleadoId, empleado);
    case "editarNombreEmpleado": return editarNombreEmpleado(body.empleadoId, body.nombre, empleado);
    case "cambiarRolEmpleado": return cambiarRolEmpleado(body.empleadoId, body.rol, empleado);
    case "empleadosAdmin": return empleadosAdmin(body.local, empleado);
    case "adminSabor": return adminSabor(body.sabor, empleado);
    case "saboresAdmin": return saboresAdmin(empleado);
    case "adminLocal": return adminLocal(body.localDatos, empleado);
    case "toggleSaborLocal": return toggleSaborLocal(body.saborId, body.local, empleado);
    default: return { ok: false, error: "Acción desconocida: " + accion };
  }
}

/* ============================================================
   SESIÓN — token propio firmado (HMAC), sin cuentas de Google
============================================================ */

function _secret() {
  const s = PropertiesService.getScriptProperties().getProperty("SESSION_SECRET");
  if (!s) throw new Error("Falta configurar SESSION_SECRET en Propiedades del script (ver cabecera de Code.gs).");
  return s;
}

function _firmar(payloadB64) {
  const bytes = Utilities.computeHmacSha256Signature(payloadB64, _secret());
  return Utilities.base64EncodeWebSafe(bytes);
}

/** Fin de la jornada comercial (7am a 3am del día siguiente) que
 *  contiene el momento "desde": si ya pasaron las 3am pero todavía no
 *  son las 7am, es la franja "muerta" entre jornadas y se toma como
 *  parte de la jornada que recién arranca (corta a las 3am de mañana),
 *  igual que cualquier login después de las 7am. Si todavía no son las
 *  3am, corta hoy a las 3am (esa jornada arrancó ayer a las 7am). */
function _finDeJornada(desde) {
  const d = new Date(desde);
  const limite = new Date(d.getFullYear(), d.getMonth(), d.getDate(), JORNADA_FIN_HORA, 0, 0, 0);
  if (d.getHours() >= JORNADA_FIN_HORA) limite.setDate(limite.getDate() + 1);
  return limite.getTime();
}

/** Token = "<payload>.<firma>", payload = base64(empleadoId|expiraUnix).
 *  No lleva rol ni local — esos se releen frescos de Empleados en CADA
 *  request, así que un reset de PIN, una baja o un cambio de rol surten
 *  efecto al toque, sin esperar a que venza el token. Dura hasta el
 *  cierre de la jornada comercial (7am a 3am), no un tope fijo de
 *  horas — así nadie queda desconectado a mitad de turno. */
function _emitirToken(empleadoId) {
  const expira = _finDeJornada(Date.now());
  const payloadB64 = Utilities.base64EncodeWebSafe(String(empleadoId) + "|" + expira);
  return payloadB64 + "." + _firmar(payloadB64);
}

function _verificarSesion(token) {
  if (!token || typeof token !== "string") return { ok: false, sesionInvalida: true, error: "No autenticado." };
  const partes = token.split(".");
  if (partes.length !== 2) return { ok: false, sesionInvalida: true, error: "Token inválido." };
  const payloadB64 = partes[0], firma = partes[1];
  if (_firmar(payloadB64) !== firma) return { ok: false, sesionInvalida: true, error: "Token inválido." };

  let decodificado;
  try { decodificado = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString(); }
  catch (err) { return { ok: false, sesionInvalida: true, error: "Token inválido." }; }
  const sep = decodificado.lastIndexOf("|");
  if (sep === -1) return { ok: false, sesionInvalida: true, error: "Token inválido." };
  const empleadoId = decodificado.substring(0, sep);
  const expira = Number(decodificado.substring(sep + 1));
  if (!empleadoId || !expira || Date.now() > expira) {
    return { ok: false, sesionInvalida: true, error: "Tu sesión expiró. Volvé a ingresar tu PIN." };
  }

  const empleado = _empleadoPorId(empleadoId);
  if (!empleado || _esVerdadero(empleado.activo) === false) {
    return { ok: false, sesionInvalida: true, error: "Tu acceso ya no está activo." };
  }
  return { ok: true, empleado: empleado };
}

function _empleadoPublico(empleado) {
  return { id: empleado.id, nombre: empleado.nombre, rol: empleado.rol, local: empleado.local || "" };
}

/** Cualquier empleado logueado puede corregir SU PROPIO nombre (typos al
 *  darlo de alta) — nunca el de otro, eso sigue siendo alta/edición desde
 *  Equipo. No hace falta ningún rol especial. */
function actualizarMiNombre(nombre, empleado) {
  nombre = String(nombre || "").trim();
  if (!nombre) return { ok: false, error: "El nombre no puede quedar vacío." };
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    return _actualizarCrudo("Empleados", empleado.id, { nombre: nombre });
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   LOGIN — PIN de 4 dígitos con hash+salt, bloqueo tras 5 intentos
============================================================ */

function _hashPin(pin, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pin) + ":" + salt);
  return Utilities.base64Encode(bytes);
}

function _pinValido(pin) {
  return /^[0-9]{4}$/.test(String(pin || ""));
}

function localesActivos() {
  const filas = _leerCrudo("Locales").filter((l) => _esVerdadero(l.activo) !== false);
  return {
    ok: true,
    locales: filas.map((l) => ({
      nombre: l.nombre, grupo: l.grupo || "", tieneClave: !!String(l.clave || "").trim(),
      esGestion: _esVerdadero(l.operaciones) === true,
    })),
  };
}

/** Contraseña por local (no es el PIN de nadie): un candado extra para
 *  que no cualquiera que abra la app en una PC vea la nómina de un
 *  local. Se pide solo al buscar/elegir el local en el login general
 *  (no en una tablet ya fijada, que salta directo a "¿quién sos?").
 *  Se guarda en texto plano en la hoja Locales — admin/supervisor la
 *  ven ahí para pasársela al responsable de local. */
function verificarClaveLocal(local, clave) {
  const fila = _leerCrudo("Locales").filter((l) => String(l.nombre) === String(local))[0];
  if (!fila) return { ok: false, error: "No se encontró el local." };
  const claveGuardada = String(fila.clave || "").trim();
  if (!claveGuardada) return { ok: true }; // este local no tiene clave configurada
  if (String(clave || "").trim() !== claveGuardada) return { ok: false, error: "Contraseña incorrecta." };
  return { ok: true };
}

function empleadosLocal(local) {
  if (!local) return { ok: false, error: "Falta el local." };
  const filas = _leerCrudo("Empleados").filter((e) =>
    _esVerdadero(e.activo) !== false &&
    (e.rol === "colaborador" || e.rol === "encargado" || e.rol === "turno" || e.rol === "produccion") &&
    String(e.local || "").trim() === String(local).trim());
  return { ok: true, empleados: filas.map((e) => ({ id: e.id, nombre: e.nombre, rol: e.rol })) };
}

function empleadosGestion() {
  const filas = _leerCrudo("Empleados").filter((e) =>
    _esVerdadero(e.activo) !== false && (e.rol === "admin" || e.rol === "supervisor"));
  return { ok: true, empleados: filas.map((e) => ({ id: e.id, nombre: e.nombre, rol: e.rol })) };
}

/** Login a Operaciones (admin/supervisor) SIN PIN — Gabi decidió que ahí
 *  alcanza con la contraseña del local trucho "Operaciones" como único
 *  factor. Solo vale para un local marcado operaciones=SI y con
 *  contraseña realmente cargada (si no tiene contraseña, no se puede
 *  entrar así — si no, quedaría sin ninguna protección). Para un local
 *  real el PIN sigue siendo obligatorio, esto no lo toca. */
function loginGestion(empleadoId, clave, local) {
  if (!empleadoId) return { ok: false, error: "Falta elegir quién sos." };
  const filaLocal = _leerCrudo("Locales").filter((l) => String(l.nombre) === String(local))[0];
  if (!filaLocal || _esVerdadero(filaLocal.operaciones) !== true) {
    return { ok: false, error: "Esto solo vale para el acceso de administración." };
  }
  const claveGuardada = String(filaLocal.clave || "").trim();
  if (!claveGuardada) {
    return { ok: false, error: "Operaciones no tiene una contraseña configurada todavía — hay que cargarla en la columna 'clave' de la hoja Locales." };
  }
  if (String(clave || "").trim() !== claveGuardada) {
    return { ok: false, error: "Contraseña incorrecta." };
  }
  const empleado = _empleadoPorId(empleadoId);
  if (!empleado) return { ok: false, error: "No se encontró ese empleado." };
  if (_esVerdadero(empleado.activo) === false) return { ok: false, error: "Ese usuario está dado de baja." };
  if (empleado.rol !== "admin" && empleado.rol !== "supervisor") return { ok: false, error: "No corresponde." };
  _auditar("login_gestion_sin_pin", empleado.id, empleado.nombre, "Entró a Operaciones solo con la contraseña del local (sin PIN)");
  return _resultadoLogin(empleado, local, true);
}

/**
 * Login por PIN. Dos casos:
 *  - Empleado sin pin_hash todavía (alta reciente o recién reseteado):
 *    hace falta pin + pinConfirm iguales, y ESO queda como su PIN.
 *  - Empleado con pin_hash: valida contra el hash guardado.
 * Bloquea 5 minutos tras 5 intentos incorrectos seguidos.
 */
function login(empleadoId, pin, pinConfirm, local) {
  if (!empleadoId) return { ok: false, error: "Falta elegir quién sos." };
  if (!_pinValido(pin)) return { ok: false, error: "El PIN tiene que ser de 4 números." };

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  let empleado = null;
  try {
    const sheet = _sheet("Empleados");
    const datos = sheet.getDataRange().getValues();
    const headers = datos[0];
    const col = {};
    headers.forEach((h, i) => { col[h] = i; });
    let fila = -1;
    for (let i = 1; i < datos.length; i++) {
      if (String(datos[i][col.id]) === String(empleadoId)) { fila = i; break; }
    }
    if (fila === -1) return { ok: false, error: "No se encontró ese empleado." };
    if (_esVerdadero(datos[fila][col.activo]) === false) return { ok: false, error: "Ese usuario está dado de baja." };

    const bloqueadoHasta = Number(datos[fila][col.bloqueado_hasta]) || 0;
    if (bloqueadoHasta > Date.now()) {
      const minutos = Math.ceil((bloqueadoHasta - Date.now()) / 60000);
      return { ok: false, error: "PIN bloqueado por intentos incorrectos. Probá de nuevo en " + minutos + " min." };
    }

    const pinHash = String(datos[fila][col.pin_hash] || "");
    const nombre = datos[fila][col.nombre];

    if (!pinHash) {
      // Primera vez (o recién reseteado): pin y pinConfirm tienen que coincidir.
      if (!_pinValido(pinConfirm) || String(pin) !== String(pinConfirm)) {
        return { ok: false, error: "Repetí el mismo PIN en los dos campos para crearlo.", primeraVez: true };
      }
      const salt = Utilities.getUuid();
      const hash = _hashPin(pin, salt);
      sheet.getRange(fila + 1, col.pin_hash + 1).setValue(hash);
      sheet.getRange(fila + 1, col.salt + 1).setValue(salt);
      sheet.getRange(fila + 1, col.intentos + 1).setValue(0);
      sheet.getRange(fila + 1, col.bloqueado_hasta + 1).setValue("");
      _auditar("pin_creado", empleadoId, nombre, "Primer PIN creado");
    } else {
      const salt = String(datos[fila][col.salt] || "");
      if (_hashPin(pin, salt) !== pinHash) {
        const intentos = (Number(datos[fila][col.intentos]) || 0) + 1;
        sheet.getRange(fila + 1, col.intentos + 1).setValue(intentos);
        if (intentos >= INTENTOS_MAX) {
          sheet.getRange(fila + 1, col.bloqueado_hasta + 1).setValue(Date.now() + BLOQUEO_MS);
          _auditar("pin_bloqueado", empleadoId, nombre, "5 intentos incorrectos");
          return { ok: false, error: "PIN incorrecto. Se bloqueó por 5 minutos por intentos fallidos." };
        }
        return { ok: false, error: "PIN incorrecto (" + intentos + "/" + INTENTOS_MAX + ")." };
      }

      // Solo escribimos si hacía falta limpiar algo — la gran mayoría de los
      // logins ya tienen intentos=0 y bloqueado_hasta vacío, y reescribir lo
      // mismo que ya había es una ida a Sheets de más en el caso común.
      const intentosActuales = Number(datos[fila][col.intentos]) || 0;
      if (intentosActuales !== 0 || datos[fila][col.bloqueado_hasta]) {
        sheet.getRange(fila + 1, col.intentos + 1).setValue(0);
        sheet.getRange(fila + 1, col.bloqueado_hasta + 1).setValue("");
      }
    }
    // Armamos el empleado con la fila que ya leímos — pedirlo nuevo con
    // _empleadoPorId() releería la hoja Empleados entera para nada.
    empleado = {};
    headers.forEach((h, i) => { empleado[h] = _celdaComoTexto(datos[fila][i]); });
  } finally {
    lock.releaseLock();
  }

  // Soltamos el candado global ACÁ, antes de armar la respuesta — lo que
  // sigue (emitir el token y, si corresponde, traer los datos del local)
  // es de solo lectura y no necesita bloquear a otros locales mientras
  // tanto. Esto es lo que más recorta la espera cuando varias personas
  // entran casi al mismo tiempo en distintos locales.
  return _resultadoLogin(empleado, local, false);
}

/** Arma la respuesta del login. Si el cliente ya sabe con qué local va a
 *  trabajar (deviceLocal fijo en la tablet, o el que se eligió en el
 *  selector para armar la lista de "¿quién sos?"), le devolvemos también
 *  los datos de ese local en la MISMA respuesta — así el cliente no
 *  necesita una segunda ida y vuelta a Apps Script (que es lo que más
 *  demora siente en este stack) para tener algo para mostrar. */
/** `esLocalDeGestion` lo pasa quien llama (ya lo sabe: login() nunca es
 *  Operaciones, loginGestion() ya leyó Locales para validar la clave) —
 *  evita una lectura de más acá, que antes releía toda la hoja Locales
 *  para algo que el caller ya tenía resuelto. */
function _resultadoLogin(empleado, local, esLocalDeGestion) {
  const resultado = { ok: true, token: _emitirToken(empleado.id), empleado: _empleadoPublico(empleado) };
  // Admin/supervisor entrando por Operaciones no aterriza en ningún local
  // real (el cliente arranca en "elegí el local arriba"), así que traer el
  // stock/historial de "Operaciones" es trabajo de más — ahí es donde más
  // se siente la demora, porque lee toda la hoja Registros para nada.
  if (local && !esLocalDeGestion && _puedeVerLocal(empleado, local)) {
    try { resultado.datos = datos(local, empleado); } catch (err) { /* si falla, el cliente lo pide aparte */ }
  }
  return resultado;
}

/* ============================================================
   DATOS — carga inicial + polling (reemplaza los onSnapshot)
============================================================ */

function _puedeVerLocal(empleado, local) {
  if (empleado.rol === "admin" || empleado.rol === "supervisor") return true;
  return String(empleado.local || "").trim() === String(local || "").trim();
}

const DATOS_CACHE_SEGUNDOS = 45; // más que POLL_MS (30s) del cliente, para que la mayoría de los sondeos reutilicen el cache en vez de releer toda la hoja de Registros

/** Registros se lee entero y se filtra por fecha/local en JS (ver
 *  _leerCrudo) — se usó una búsqueda binaria por fecha acá (_leerDesdeTs,
 *  sacada 13/10/2026), pero asumía que la columna ts nunca decrece fila
 *  a fila, y una fila que alguien borra a mano en el Sheet (clic derecho
 *  > eliminar contenido, no eliminar fila) queda como una fila en blanco
 *  en el MEDIO de la hoja con ts=0 — eso rompe el supuesto y la búsqueda
 *  podía arrancar a leer varias filas más abajo de lo que correspondía,
 *  descartando en silencio ingresos/salidas reales que sí estaban dentro
 *  de los DIAS_HISTORIAL (causa confirmada del stock negativo en
 *  Obelisco CABA y Shopping Abasto CABA el 12/10/2026). Con el volumen
 *  actual (un local activo acumula unas pocas centenas de filas en 60
 *  días) leer la hoja entera no tiene costo relevante, y se sigue
 *  cacheando por local (ver datos()) para no repetirlo en cada polling. */
function _datosSinCache(local, empleado) {
  const limite = Date.now() - DIAS_HISTORIAL * 864e5;
  const registros = _leerCrudo("Registros")
    .filter((r) => String(r.local || "").trim() === String(local).trim() && Number(r.ts) >= limite)
    .map(_registroPublico);

  const stockFilas = _leerCrudo("Stock").filter((s) => String(s.local || "").trim() === String(local).trim());
  const stock = stockFilas.length ? _stockPublico(stockFilas[0]) : null;

  const sabores = _leerCrudo("Sabores")
    .filter((s) => _esVerdadero(s.activo) !== false)
    .map((s) => ({ id: String(s.id), nombre: s.nombre, tipo: s.tipo, minimo: Number(s.minimo) || 0, orden: Number(s.orden) || 0, categoria: s.categoria || "Cremas", peso: Number(s.peso) || 0, familia: s.familia || "vasquetas", cantidad_maestra: Number(s.cantidad_maestra) || 0 }))
    .sort((a, b) => a.orden - b.orden);

  // Sabores que ESTE local marcó que no tiene (ej. Baldes en un local que
  // no vende baldes) — columna Locales.sabores_excluidos, ids separados
  // por coma. No se sacan del catálogo global (sabores arriba), solo se
  // le avisa al cliente cuáles ocultar en las grillas de este local; así
  // nombre(id) sigue funcionando para movimientos viejos de un sabor que
  // se excluyó después.
  const filaLocal = _leerCrudo("Locales").filter((l) => String(l.nombre || "").trim() === String(local).trim())[0];
  const excluidos = filaLocal ? String(filaLocal.sabores_excluidos || "").split(",").map((x) => x.trim()).filter(Boolean) : [];
  // Locales.produccion=SI habilita el link "Producción" dentro de Ingreso
  // (hoy solo Unicenter) — ver registrar(), subtipo "produccion".
  const produccion = filaLocal ? _esVerdadero(filaLocal.produccion) === true : false;

  return { registros: registros, stock: stock, sabores: sabores, excluidos: excluidos, produccion: produccion };
}

function _cacheKeyDatos(local) {
  return "datos_" + local;
}

/** Invalida el cache de un local — se llama después de cualquier
 *  escritura que le cambie los datos (registrar, conteo, anular), así
 *  la propia persona ve su movimiento reflejado al toque en vez de
 *  esperar hasta 20s a que venza el cache. */
function _invalidarCacheDatos(local) {
  try { CacheService.getScriptCache().remove(_cacheKeyDatos(local)); } catch (err) { /* no crítico */ }
}

function datos(local, empleado) {
  if (!local) return { ok: false, error: "Falta el local." };
  if (!_puedeVerLocal(empleado, local)) return { ok: false, error: "No tenés acceso a ese local." };

  const cache = CacheService.getScriptCache();
  const key = _cacheKeyDatos(local);
  let base;
  try {
    const cacheado = cache.get(key);
    if (cacheado) base = JSON.parse(cacheado);
  } catch (err) { /* si el cache falla, seguimos sin él */ }

  if (!base) {
    base = _datosSinCache(local, empleado);
    try { cache.put(key, JSON.stringify(base), DATOS_CACHE_SEGUNDOS); } catch (err) { /* no crítico */ }
  }

  return { ok: true, registros: base.registros, stock: base.stock, sabores: base.sabores, excluidos: base.excluidos, produccion: base.produccion, rol: empleado.rol };
}

function _registroPublico(r) {
  let items = {};
  try { items = JSON.parse(r.items || "{}"); } catch (e) { items = {}; }
  let kilos = {};
  try { kilos = JSON.parse(r.kilos || "{}"); } catch (e) { kilos = {}; }
  let vencimientos = {};
  try { vencimientos = JSON.parse(r.vencimientos || "{}"); } catch (e) { vencimientos = {}; }
  return {
    id: String(r.id), tipo: r.tipo, local: r.local, empleadoId: String(r.empleadoId || ""), empleado: r.empleado, items: items,
    total: Number(r.total) || 0, remito: r.remito || "", ts: Number(r.ts),
    anulado: !!r.anulado_ts, anulado_por: r.anulado_por || "", motivo: r.motivo || "",
    foto_remito: r.foto_remito || "", subtipo: r.subtipo || "", kilos: kilos, vencimientos: vencimientos,
  };
}

function _stockPublico(s) {
  let base = {};
  try { base = JSON.parse(s.base || "{}"); } catch (e) { base = {}; }
  return { local: s.local, base: base, ts: Number(s.ts), empleado: s.empleado || "" };
}

/* ============================================================
   REGISTRAR movimiento (salida/ingreso) y CONTEO físico
============================================================ */

function _totalItems(items) {
  let t = 0;
  Object.keys(items || {}).forEach((id) => { t += Number(items[id]) || 0; });
  return t;
}

function registrar(clienteId, tipo, local, items, remito, empleado, fotoRemito, subtipo, motivo, kilos, vencimientos) {
  if (tipo !== "salida" && tipo !== "ingreso") return { ok: false, error: "Tipo de movimiento inválido." };
  if (!local) return { ok: false, error: "Falta el local." };
  if (!_puedeVerLocal(empleado, local)) return { ok: false, error: "No tenés acceso a ese local." };
  if (!items || !Object.keys(items).length) return { ok: false, error: "No hay sabores cargados." };
  // Chocolatería (familia "chocolateria"): en un ingreso normal (no devolución
  // ni producción) cada producto trae su vencimiento. Se valida acá, no solo en
  // el cliente.
  const catalogoVenc = _leerCrudo("Sabores");
  const nombreVenc = {}, familiaVenc = {};
  catalogoVenc.forEach((sab) => { nombreVenc[String(sab.id)] = sab.nombre; familiaVenc[String(sab.id)] = sab.familia || "vasquetas"; });
  const vencimientos2 = {};
  if (tipo === "ingreso") {
    Object.keys(vencimientos || {}).forEach((id) => {
      const v = String((vencimientos || {})[id] || "");
      if (items[id] && /^\d{4}-\d{2}-\d{2}$/.test(v)) vencimientos2[id] = v;
    });
  }
  if (tipo === "ingreso" && !subtipo) {
    const sinVenc = Object.keys(items).filter((id) => familiaVenc[String(id)] === "chocolateria" && !vencimientos2[id]);
    if (sinVenc.length) return { ok: false, error: "Falta el vencimiento de: " + sinVenc.map((id) => nombreVenc[String(id)] || ("Sabor " + id)).join(", ") + "." };
  }
  if (subtipo === "devolucion" && tipo !== "ingreso") return { ok: false, error: "Subtipo de movimiento inválido." };
  if (subtipo === "desperdicio" && tipo !== "salida") return { ok: false, error: "Subtipo de movimiento inválido." };
  if (subtipo === "produccion" && tipo !== "ingreso") return { ok: false, error: "Subtipo de movimiento inválido." };
  if (subtipo && ["devolucion", "desperdicio", "produccion"].indexOf(subtipo) === -1) return { ok: false, error: "Subtipo de movimiento inválido." };
  if (subtipo === "produccion") {
    const filaLocalProd = _leerCrudo("Locales").filter((l) => String(l.nombre) === String(local))[0];
    if (!filaLocalProd || _esVerdadero(filaLocalProd.produccion) !== true) {
      return { ok: false, error: "Este local no tiene Producción activada." };
    }
  }

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    if (clienteId) {
      const existente = _leerUltimasFilas("Registros", 500).filter((r) => r.clienteId && String(r.clienteId) === String(clienteId))[0];
      if (existente) return { ok: true, id: existente.id, repetido: true }; // idempotencia (cola offline)
    }
    const items2 = {};
    Object.keys(items).forEach((id) => { const q = Number(items[id]) || 0; if (q > 0) items2[id] = q; });

    // No dejar que una Salida (o Desperdicio, que es tipo "salida" con
    // subtipo propio) deje un sabor en negativo — un producto que no
    // existe no se puede sacar de la cámara. Se valida ACÁ (adentro del
    // lock, con datos frescos — nunca con lo que mandó el cliente) para
    // cubrir el caso en que dos dispositivos descuenten el mismo sabor
    // casi al mismo tiempo, o que la cola offline sincronice contra un
    // stock que ya cambió. El cliente también lo valida antes (no deja
    // ni cargar el carrito), esto es la red de seguridad real.
    if (tipo === "salida") {
      const infoLocal = _datosSinCache(local);
      const stockBase = infoLocal.stock ? infoLocal.stock.base : {};
      const bts = infoLocal.stock ? infoLocal.stock.ts : 0;
      const stockActual = Object.assign({}, stockBase);
      infoLocal.registros.forEach((rg) => {
        if (rg.anulado || rg.ts <= bts) return;
        const signo = rg.tipo === "ingreso" ? 1 : rg.tipo === "salida" ? -1 : 0;
        if (!signo) return;
        Object.keys(rg.items || {}).forEach((id) => {
          stockActual[id] = (Number(stockActual[id]) || 0) + signo * (Number(rg.items[id]) || 0);
        });
      });
      const nombreDe = {};
      infoLocal.sabores.forEach((s) => { nombreDe[s.id] = s.nombre; });
      const faltantes = [];
      Object.keys(items2).forEach((id) => {
        if (items2[id] > (Number(stockActual[id]) || 0)) faltantes.push(nombreDe[id] || ("Sabor " + id));
      });
      if (faltantes.length) {
        return { ok: false, error: "No hay stock suficiente de: " + faltantes.join(", ") + ". Actualizá la pantalla e intentá de nuevo." };
      }
    }

    const total = _totalItems(items2);
    const kilos2 = {};
    Object.keys(kilos || {}).forEach((id) => { const k = Number(kilos[id]) || 0; if (k > 0) kilos2[id] = k; });
    const ts = Date.now();
    const r = _escribirCrudo("Registros", {
      clienteId: clienteId || "", tipo: tipo, local: local, empleadoId: empleado.id, empleado: empleado.nombre,
      items: JSON.stringify(items2), total: total, remito: remito || "", ts: ts,
      anulado_por: "", anulado_ts: "", motivo: motivo || "", foto_remito: fotoRemito || "", subtipo: subtipo || "",
      kilos: Object.keys(kilos2).length ? JSON.stringify(kilos2) : "",
      vencimientos: Object.keys(vencimientos2).length ? JSON.stringify(vencimientos2) : "",
    });
    _invalidarCacheDatos(local);
    return { ok: true, id: r.id, ts: ts };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   LECTOR DE REMITOS — foto del remito → IA con visión → sabores +
   cantidades detectados, matcheados contra el catálogo. El empleado
   siempre revisa y confirma antes de que esto se convierta en un
   ingreso real (eso sigue pasando por registrar(), más arriba).

   SETUP: Propiedades del script → agregar "ANTHROPIC_API_KEY" con una
   clave de console.anthropic.com (⚠️ NO es la cuenta de claude.ai —
   ver apps-script/README.md). Sin eso, esta acción devuelve un error
   claro en vez de romper el resto de la app.
============================================================ */

/** Minúsculas, sin tildes ni signos, espacios simples — para poder
 *  comparar "Tiramisù" con "Tiramisu" o "Pistacchio 100% Vegetal" con
 *  "Pistacchio" sin que un detalle de tipeo rompa el match. */
const _REGEX_MARCAS_ACENTO = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");
function _normalizar(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(_REGEX_MARCAS_ACENTO, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Busca, para un nombre detectado en el remito, el sabor del catálogo
 *  que mejor matchea. Devuelve null si ninguno se parece lo suficiente
 *  (el frontend lo marca para que el empleado elija a mano).
 *
 *  Si se pasa familiaEsperada, solo busca entre los sabores de esa
 *  familia — hay nombres repetidos entre familias (ej. "Pistacchio"
 *  existe como vasqueta, como Icepop Luxury y como Cannoli, son
 *  productos distintos con cajas distintas) y sin este filtro el
 *  primer "Pistacchio" del catálogo (la vasqueta) le ganaba por orden
 *  al que realmente correspondía, dando cantidades mal calculadas.
 *
 *  Si además se pasa categoriaEsperada, acota todavía más dentro de la
 *  familia Icepops (Luxury/Bañados/Crema/Cannoli/Mini Icepops/Fruta) —
 *  sin esto, un "Cookies and Cream" de la sección Bañados podía
 *  matchear contra "Tonio (Cookies & Cream)" de Luxury solo por
 *  compartir esas dos palabras. Si el filtro combinado no deja
 *  candidatos, se afloja a solo familia, y si tampoco deja, a todo el
 *  catálogo — mejor buscar más ancho que no encontrar nada. */
function _matchearSabor(nombreDetectado, sabores, familiaEsperada, categoriaEsperada) {
  // Los sabores Sin Gluten se llaman "<nombre> (Gluten Free)" en el catálogo,
  // pero en el remito ya llegan limpios de esa marca (nosotros le pedimos a
  // la IA que saque "LIBRE DE GLUTEN" del nombre) — comparar tal cual hacía
  // que "gluten"/"free" infumdieran las palabras del catálogo y no las del
  // remito, bajando el puntaje de parecido por debajo del mínimo aunque el
  // nombre fuera el mismo. Para la familia Sin Gluten sacamos esas palabras
  // de los dos lados antes de comparar.
  const limpiar = (s) => {
    let n = _normalizar(s);
    if (familiaEsperada === "glutenfree") n = n.replace(/\b(gluten|free|libre)\b/g, " ").replace(/\s+/g, " ").trim();
    return n;
  };
  const norm = limpiar(nombreDetectado);
  if (!norm) return null;
  const porFamilia = familiaEsperada
    ? sabores.filter((s) => (s.familia || "vasquetas") === familiaEsperada)
    : sabores;
  const catNorm = categoriaEsperada ? _normalizar(categoriaEsperada) : "";
  const porCategoria = catNorm ? porFamilia.filter((s) => _normalizar(s.categoria || "") === catNorm) : [];

  // Prueba las reglas de match (exacto → uno contiene al otro → comparten
  // la mayoría de las palabras) dentro de una lista de candidatos. Devuelve
  // null si ninguna encuentra nada en ESA lista puntual.
  //
  // `relajado` suma una cuarta regla, solo para cuando la lista ya viene
  // acotada por categoría (no para familia entera ni todo el catálogo): si
  // el remito ya nos dice "esto es Bañados" y dentro de Bañados hay un
  // único sabor que comparte aunque sea una palabra con lo detectado (ej.
  // "Chantilly & Crocante" vs el único "Crema Chantilly" de esa categoría),
  // alcanza — la categoría ya hizo la mayor parte de la desambiguación, no
  // hace falta que el resto del nombre matchee tanto. Si dos o más
  // comparten esa palabra, sigue siendo ambiguo y no adivina.
  const intentar = (lista, relajado) => {
    if (!lista.length) return null;
    // 1) match exacto
    let mejor = lista.find((s) => limpiar(s.nombre) === norm);
    if (mejor) return { sabor: mejor, confianza: "alta" };
    // 2) uno contiene al otro (ej. "pistacchio" vs "pistacchio 100% vegetal")
    mejor = lista.find((s) => {
      const ns = limpiar(s.nombre);
      return ns.length > 3 && (norm.indexOf(ns) !== -1 || ns.indexOf(norm) !== -1);
    });
    if (mejor) return { sabor: mejor, confianza: "media" };
    // 3) comparten la mayoría de las palabras (similitud de Jaccard: comunes
    // sobre el total de palabras distintas entre los dos, no sobre el más
    // largo de los dos — así un catálogo con una palabra de más, tipo
    // "Tonio (Cookies & Cream)", no empata con el "Cookies & Cream" real
    // nomás por compartir "cookies"/"cream"; el que tiene menos palabras
    // de sobra gana, que es el match más preciso.
    const palabrasDet = norm.split(" ").filter((w) => w.length > 2);
    if (!palabrasDet.length) return null;
    let mejorScore = 0;
    lista.forEach((s) => {
      const palabrasS = limpiar(s.nombre).split(" ").filter((w) => w.length > 2);
      if (!palabrasS.length) return;
      const comunes = palabrasDet.filter((w) => palabrasS.indexOf(w) !== -1).length;
      const union = palabrasDet.length + palabrasS.length - comunes;
      const score = comunes / union;
      if (score > mejorScore) { mejorScore = score; mejor = s; }
    });
    if (mejor && mejorScore >= 0.6) return { sabor: mejor, confianza: "media" };
    // 4) (solo con categoría ya acotada) único candidato que comparte
    // alguna palabra con lo detectado.
    if (relajado) {
      const conAlgunaPalabra = lista.filter((s) => {
        const palabrasS = limpiar(s.nombre).split(" ").filter((w) => w.length > 2);
        return palabrasDet.some((w) => palabrasS.indexOf(w) !== -1);
      });
      if (conAlgunaPalabra.length === 1) return { sabor: conAlgunaPalabra[0], confianza: "media" };
    }
    return null;
  };

  // Ensancha la búsqueda en cascada — categoría → familia → todo el
  // catálogo — probando las reglas en cada paso antes de pasar al
  // siguiente. Antes, si la categoría detectada tenía ALGÚN candidato
  // (aunque ninguno matcheara), se quedaba ahí sin probar más ancho — por
  // eso "Minion 1 Ojo" (que categorizamos como Luxury por su caja real)
  // nunca aparecía: la IA etiqueta esa sección como "Mini Icepops", que sí
  // tiene candidatos (los Mini de siempre), así que nunca se ensanchaba a
  // buscar en el resto de Icepops donde Minion sí está.
  return intentar(porCategoria, true) || intentar(porFamilia, false) || intentar(sabores, false);
}

/** Carpeta Remitos/<Local>/<AAAA-MM>/ en el Drive de la cuenta dueña
 *  de la planilla — la crea si no existe. */
function _carpetaDriveRemito(local, fechaMs) {
  const raiz = DriveApp.getRootFolder();
  const nombreRaiz = "Remitos";
  const carpetasRaiz = raiz.getFoldersByName(nombreRaiz);
  const carpetaRemitos = carpetasRaiz.hasNext() ? carpetasRaiz.next() : raiz.createFolder(nombreRaiz);

  const carpetasLocal = carpetaRemitos.getFoldersByName(local);
  const carpetaLocal = carpetasLocal.hasNext() ? carpetasLocal.next() : carpetaRemitos.createFolder(local);

  const d = new Date(fechaMs);
  const mes = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  const carpetasMes = carpetaLocal.getFoldersByName(mes);
  return carpetasMes.hasNext() ? carpetasMes.next() : carpetaLocal.createFolder(mes);
}

/** Arma el catálogo en texto (agrupado por familia, y por categoría
 *  dentro de Icepops) para pegarlo en el prompt — así la IA matchea
 *  cada renglón contra el catálogo real mientras lee la foto, en vez
 *  de que nosotros tengamos que adivinar después con reglas de texto
 *  (substring, palabras en común) que nunca cubren todos los casos
 *  reales (sinónimos, errores de tipeo, nombres abreviados). */
function _catalogoParaPrompt(sabores) {
  // Baldes son tipo "b" pero su columna familia viene vacía (default
  // "vasquetas" al leerlos) — hay que separarlos ANTES de agrupar por
  // familia, si no quedan mezclados en el mismo bloque de texto que las
  // vasquetas y la IA no tiene forma de distinguir cuál id corresponde
  // a un balde (ver leerRemito()/bultosLeidosBaldes).
  const baldes = sabores.filter((s) => s.tipo === "b");
  const vasquetas = sabores.filter((s) => s.familia === "vasquetas" && s.tipo !== "b");
  const glutenfree = sabores.filter((s) => s.familia === "glutenfree");
  const icepops = sabores.filter((s) => s.familia === "icepops");
  const linea = (s) => s.id + ": " + s.nombre;
  let txt = "SABORES (vasquetas):\n" + vasquetas.map(linea).join("\n");
  txt += "\n\nBALDES:\n" + baldes.map(linea).join("\n");
  txt += "\n\nSIN GLUTEN:\n" + glutenfree.map(linea).join("\n");
  txt += "\n\nICEPOPS Y CANNOLIS (agrupado por categoría — hay nombres repetidos en categorías distintas, son productos distintos, fijate en qué sección del remito está el renglón):\n";
  const categorias = {};
  icepops.forEach((s) => { const c = s.categoria || "Otros"; (categorias[c] = categorias[c] || []).push(s); });
  Object.keys(categorias).forEach((c) => { txt += "\n" + c + ":\n" + categorias[c].map(linea).join("\n"); });
  return txt;
}

/** Le manda la foto a Claude (API de Anthropic, con visión) junto con
 *  el catálogo completo de sabores activos, y le pide que transcriba
 *  SOLO los renglones de las secciones de cámara del remito (sabor +
 *  cantidad de bultos) y que, para cada uno, elija directamente el
 *  sabor del catálogo que corresponde (en vez de devolvernos un
 *  nombre suelto para que nosotros adivinemos el match después — la
 *  IA tiene mucho mejor criterio semántico, con la foto Y el catálogo
 *  juntos, que cualquier fórmula de parecido de texto). Devuelve el
 *  JSON ya parseado — tira error si la clave falta o la IA no
 *  contesta algo parseable, y quien llama decide qué hacer con eso. */
function _leerRemitoConIA(fotoBase64, mimeType, sabores) {
  const clave = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!clave) throw new Error("Falta configurar ANTHROPIC_API_KEY en Propiedades del script (ver apps-script/README.md).");

  const prompt = "Esta es la foto de un remito de productos Lucciano's. Quiero SOLO los renglones que están bajo alguno de estos encabezados de sección: \"SABORES\", \"SIN GLUTEN\", cualquiera que empiece con \"ICE POPS\" (incluye ICE POPS FRUTALES, ICE POPS BAÑADOS, ICE POPS SIN BAÑAR, ICE POPS LUXURY, ICE POPS MINI) y \"CANNOLIS\". También incluí cualquier sección de Mini Icepops aunque tenga un nombre promocional distinto (ej. un tie-in con una película o un evento, como \"MI VILLANO FAVORITO\") — se reconoce porque aparece en el mismo lugar que ICE POPS MINI (después de ICE POPS LUXURY, antes de CANNOLIS) y tiene el mismo formato de columnas. Ignorá todo el resto: Chocolates, Tabletas, Geladot's, Pastelería, Envases y Packaging, Utensillos, Varios, Alfajores, Envasado en Frasco, Conitos, Cafés, Salsas y Variegatos, Insumos, \\\"BALDES Y VASQUETAS\\\" (esa sección son envases vacíos, no sabores), Bienes de Uso, y cualquier otra sección que no sea claramente una de las listadas arriba.\n\nDENTRO de la sección \\\"SABORES\\\", algunos renglones vienen agrupados bajo un sub-encabezado \\\"BALDES\\\" (o el nombre del renglón arranca con \\\"BALDES -\\\" y/o termina en \\\"- BALDE\\\") — es el mismo sabor que una vasqueta pero vendido en formato balde. Esos renglones los tenés que matchear contra el bloque \\\"BALDES\\\" del catálogo de abajo, NUNCA contra \\\"SABORES (vasquetas)\\\" aunque el nombre sea parecido o igual al de una vasqueta — son productos de catálogo distintos.\n\nMás abajo te paso el catálogo completo de sabores que tenemos cargados, con su ID. Para cada renglón de esas secciones:\n- Id: elegí, del catálogo de abajo, el sabor que corresponda a ese renglón, y poné su ID tal cual. Usá criterio: el nombre en el remito puede venir abreviado, con errores de tipeo, en otro orden, con palabras de más o de menos, o nombrado distinto a como está en el catálogo (ej. el remito puede decir \"Sorbete Dark 72%\" para lo que el catálogo tiene como \"Vegan 72%\", o \"Luxury Jameson Negro\" para \"Jameson Icepop\") — el objetivo es identificar el PRODUCTO real, no encontrar coincidencia exacta de texto. Prestá mucha atención a en qué sección del remito está el renglón: varios sabores se llaman igual en categorías distintas del catálogo (ej. \"Pistacchio\" existe como vasqueta, como Icepop Luxury y como Cannoli — son cajas y productos distintos) y el catálogo te muestra la categoría de cada uno para que elijas el que corresponde a la sección donde estás leyendo. Si de verdad no hay ningún sabor del catálogo que corresponda (por ejemplo un producto nuevo o de edición limitada que todavía no cargamos), dejá el id vacío — no inventes ni fuerces un match que no corresponde.\n- Nombre: igual escribí el nombre del renglón tal cual lo ves en la foto (incluso si encontraste el id) — lo necesitamos para poder revisar a mano los que no matcheen.\n- Bultos: el número de la columna \"Cantidad/Bultos\" (la de más a la izquierda), tal cual aparece escrito. NO mires la columna \"Kg/Unidad\" ni hagas ninguna cuenta ni multiplicación — nosotros ya sabemos cuánto trae cada caja cerrada de cada sabor, vos solo transcribí el número de bultos tal cual está.\n\nOJO con renglones consecutivos que arrancan con la misma palabra pero son productos distintos (ej. \\\"Oli Chocolate Platino\\\", \\\"Oli Dolca\\\" y \\\"Oli King\\\" son 3 sabores distintos del catálogo que a veces aparecen uno debajo del otro) — leé el nombre COMPLETO de cada renglón por separado, nunca asumas que dos renglones parecidos son el mismo producto, y nunca repitas o copies el número de bultos de un renglón vecino: cada renglón tiene su propio número en su propia fila, aunque el nombre se vea casi igual al de arriba o abajo.\n\nTambién fijate si se ve el número de remito y la fecha. Al pie del remito, en el recuadro \"Bultos:\", suele haber un resumen tipo \"Palitos=80 Sabores=397 Baldes=5 Pastelería=103 Chocolates=...\" — Sabores y Baldes son los totales de bultos que declaró la fábrica para cada uno, para controlar que no se perdió ningún renglón (el de Palitos no lo necesitamos — esa parte del recuadro no es confiable, no la uses para nada). Buscá ese recuadro y decime los números de \"Sabores\" y de \"Baldes\" tal cual figuran ahí — si no se ve ese recuadro o no tiene alguno de esos campos, dejalo vacío, no inventes un número.\n\nContestá ÚNICAMENTE con este JSON, sin texto alrededor:\n{\"remito\":\"<número o vacío>\",\"fecha\":\"<DD/MM/AAAA o vacío>\",\"bultosDeclaradosSabores\":<número entero del recuadro \\\"Bultos:\\\" junto a \\\"Sabores\\\", o vacío>,\"bultosDeclaradosBaldes\":<número entero del recuadro \\\"Bultos:\\\" junto a \\\"Baldes\\\", o vacío>,\"items\":[{\"id\":\"<id del catálogo, o vacío si ninguno corresponde>\",\"nombre\":\"<nombre tal cual aparece en el remito>\",\"bultos\":<número entero tal cual aparece en \\\"Cantidad/Bultos\\\", sin multiplicar>}]}\n\nCATÁLOGO:\n" + _catalogoParaPrompt(sabores);

  const payload = {
    model: "claude-sonnet-5-5",
    max_tokens: 10000, // un remito real ahora puede traer Sabores + Icepops + Sin Gluten + Cannolis todos juntos, son muchos más renglones que antes (solo Sabores) — con 2048 la respuesta se cortaba a mitad del JSON
    // Sin esto, Sonnet 5.5 piensa de forma adaptativa por defecto y a veces
    // gasta TODO max_tokens pensando, sin dejar nada para el JSON de
    // respuesta (quedaba un bloque "thinking" vacío y sin texto). Esta tarea
    // es transcribir/matchear contra el catálogo, no hace falta que delibere.
    thinking: { type: "between_tools" },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: fotoBase64 } },
        { type: "text", text: prompt },
      ],
    }],
  };

  const resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": clave, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  if (resp.getResponseCode() !== 200) {
    throw new Error("La IA no pudo leer el remito (código " + resp.getResponseCode() + "). Probá de nuevo en un rato.");
  }
  const data = JSON.parse(resp.getContentText());
  // El modelo a veces antepone un bloque "thinking" antes del "text" —
  // no asumir que la respuesta está en content[0], hay que buscar el
  // bloque de tipo "text" donde esté.
  const bloqueTexto = (data.content || []).filter((b) => b.type === "text")[0];
  const texto = (bloqueTexto && bloqueTexto.text) || "";
  const match = texto.match(/\{[\s\S]*\}/);
  if (!match) {
    // Mostramos lo que realmente contestó la IA (y por qué cortó) para poder
    // diagnosticar sin tener que reproducir la llamada — acá no hay forma de
    // probar contra la API real, así que el mensaje de error ES el diagnóstico.
    const motivo = data.stop_reason ? " Motivo: " + data.stop_reason + "." : "";
    let muestra;
    if (texto) {
      muestra = " Contestó: «" + texto.slice(0, 500) + "»";
    } else {
      const bloques = (data.content || []).map((b) => b.type).join(",") || "ninguno";
      muestra = " No contestó texto (bloques de la respuesta: " + bloques + "). JSON crudo: " + JSON.stringify(data).slice(0, 500);
    }
    throw new Error("La IA contestó algo que no se pudo entender." + motivo + muestra);
  }
  return JSON.parse(match[0]);
}

function leerRemito(fotoBase64, mimeType, local, empleado) {
  if (!local) return { ok: false, error: "Falta el local." };
  if (!_puedeVerLocal(empleado, local)) return { ok: false, error: "No tenés acceso a ese local." };
  if (!fotoBase64) return { ok: false, error: "Falta la foto." };

  const sabores = _leerCrudo("Sabores")
    .filter((s) => _esVerdadero(s.activo) !== false)
    .map((s) => ({ id: String(s.id), nombre: s.nombre, tipo: s.tipo, familia: s.familia || "vasquetas", categoria: s.categoria || "", cantidad_maestra: Number(s.cantidad_maestra) || 0 }));
  const saboresPorId = {};
  sabores.forEach((s) => { saboresPorId[s.id] = s; });

  let leido;
  try {
    leido = _leerRemitoConIA(fotoBase64, mimeType, sabores);
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }

  // Para comparar contra el recuadro "Bultos:" que imprime la fábrica al
  // pie del remito (control de que no se perdió ningún renglón de
  // Sabores/Baldes — el de Palitos de ese recuadro no es confiable, no
  // se usa): sumamos los bultos de cada renglón leído, separados en
  // vasquetas vs. baldes vs. el resto (Icepops, Sin Gluten, Cannolis,
  // todo en palito). Un renglón que no matcheó ningún sabor no sabemos
  // de qué familia es, así que no entra en ninguna de las sumas
  // (quedaría contado de más).
  let bultosLeidosSabores = 0, bultosLeidosBaldes = 0, bultosLeidosPalitos = 0;
  const items = (leido.items || []).map((it) => {
    const bultos = Math.max(0, Number(it.bultos) || 0);
    // La IA ya matchea cada renglón contra el catálogo que le pasamos
    // (tiene la foto Y el catálogo juntos, mucho mejor criterio que
    // cualquier fórmula de parecido de texto). Si por algún motivo no
    // encontró nada, probamos igual con el matching por texto como red
    // de contención — no cuesta nada intentarlo.
    let sabor = it.id ? saboresPorId[String(it.id)] : null;
    let confianza = sabor ? "alta" : "sin_match";
    if (!sabor) {
      const m = _matchearSabor(it.nombre, sabores);
      if (m) { sabor = m.sabor; confianza = m.confianza; }
    }
    // La multiplicación por el tamaño de la caja la hacemos acá con el
    // dato ya cargado en Sabores (cantidad_maestra), que es confiable;
    // dejar que la IA lea y multiplique la otra columna daba cuentas mal
    // hechas. Mini Icepops es la excepción: ahí el stock se cuenta por
    // caja, así que el bulto del remito YA es la unidad de stock.
    let cantidad;
    if (sabor && sabor.tipo === "m") cantidad = bultos;
    else if (sabor && sabor.cantidad_maestra > 0) cantidad = bultos * sabor.cantidad_maestra;
    else cantidad = bultos;
    if (sabor && sabor.tipo === "b") bultosLeidosBaldes += bultos;
    else if (sabor && sabor.familia === "vasquetas") bultosLeidosSabores += bultos;
    else if (sabor) bultosLeidosPalitos += bultos;
    return {
      nombreDetectado: it.nombre,
      cantidad: cantidad,
      bultos: bultos, // el frontend la necesita para recalcular si el empleado corrige el sabor a mano
      saborId: sabor ? sabor.id : null,
      nombreSabor: sabor ? sabor.nombre : null,
      confianza: confianza,
    };
  });

  // La foto se guarda en Drive apenas se lee, aunque después el empleado
  // termine cancelando — es un costo de espacio insignificante y preferible
  // a mandar la imagen dos veces (una para leerla, otra para guardarla).
  let fotoUrl = "";
  try {
    const carpeta = _carpetaDriveRemito(local, Date.now());
    const bytes = Utilities.base64Decode(fotoBase64);
    const blob = Utilities.newBlob(bytes, mimeType || "image/jpeg", "remito.jpg");
    const d = new Date();
    const fechaArchivo = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const nombreArchivo = fechaArchivo + "_remito-" + (leido.remito || "sinnumero").replace(/[^a-zA-Z0-9-]/g, "") + ".jpg";
    const archivo = carpeta.createFile(blob).setName(nombreArchivo);
    fotoUrl = archivo.getUrl();
  } catch (err) {
    // Si falla subir a Drive, no tiramos abajo toda la lectura — el
    // empleado puede seguir revisando y confirmando el ingreso igual,
    // simplemente no va a quedar el link a la foto en ese registro.
  }

  return {
    ok: true, remitoDetectado: leido.remito || "", fechaDetectada: leido.fecha || "", items: items, fotoUrl: fotoUrl,
    bultosDeclaradosSabores: (leido.bultosDeclaradosSabores !== undefined && leido.bultosDeclaradosSabores !== "") ? Number(leido.bultosDeclaradosSabores) : null,
    bultosLeidosSabores: bultosLeidosSabores,
    bultosDeclaradosBaldes: (leido.bultosDeclaradosBaldes !== undefined && leido.bultosDeclaradosBaldes !== "") ? Number(leido.bultosDeclaradosBaldes) : null,
    bultosLeidosBaldes: bultosLeidosBaldes,
    // Palitos no se compara contra ningún declarado — ese recuadro de la
    // fábrica no es confiable para esta familia (ver el comentario en
    // _leerRemitoConIA). bultosLeidosPalitos queda como dato informativo
    // nomás ("cajas detectadas" en el cliente).
    bultosLeidosPalitos: bultosLeidosPalitos,
  };
}

function conteo(clienteId, local, items, empleado) {
  if (empleado.rol === "colaborador") return { ok: false, error: "No tenés permiso para hacer el conteo físico." };
  if (!local) return { ok: false, error: "Falta el local." };
  if (!_puedeVerLocal(empleado, local)) return { ok: false, error: "No tenés acceso a ese local." };
  if (!items) return { ok: false, error: "Falta el conteo." };

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    if (clienteId) {
      const existente = _leerUltimasFilas("Registros", 500).filter((r) => r.clienteId && String(r.clienteId) === String(clienteId))[0];
      if (existente) return { ok: true, id: existente.id, repetido: true };
    }
    const items2 = {};
    Object.keys(items).forEach((id) => { items2[id] = Math.max(0, Number(items[id]) || 0); });
    const total = _totalItems(items2);
    const ts = Date.now();

    _escribirCrudo("Registros", {
      clienteId: clienteId || "", tipo: "conteo", local: local, empleadoId: empleado.id, empleado: empleado.nombre,
      items: JSON.stringify(items2), total: total, remito: "", ts: ts, anulado_por: "", anulado_ts: "", motivo: "",
    });

    const sheet = _sheet("Stock");
    const filas = sheet.getDataRange().getValues();
    const headers = filas[0];
    const colLocal = headers.indexOf("local");
    let filaIdx = -1;
    for (let i = 1; i < filas.length; i++) {
      if (String(filas[i][colLocal]) === String(local)) { filaIdx = i; break; }
    }
    const fila = { local: local, base: JSON.stringify(items2), ts: ts, empleado: empleado.nombre };
    if (filaIdx === -1) {
      const destino = sheet.getLastRow() + 1;
      headers.forEach((h, i) => _escribirCeldaSinAdivinar(sheet.getRange(destino, i + 1), fila[h] !== undefined ? fila[h] : ""));
    } else {
      headers.forEach((h, i) => {
        if (fila[h] !== undefined) _escribirCeldaSinAdivinar(sheet.getRange(filaIdx + 1, i + 1), fila[h]);
      });
    }
    _invalidarCacheDatos(local);
    return { ok: true, ts: ts };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   ANULAR / ELIMINAR
============================================================ */

function anular(registroId, motivo, empleado) {
  if (!registroId) return { ok: false, error: "Falta el movimiento a anular." };
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const sheet = _sheet("Registros");
    const filas = sheet.getDataRange().getValues();
    const headers = filas[0];
    const col = {};
    headers.forEach((h, i) => { col[h] = i; });
    let idx = -1;
    for (let i = 1; i < filas.length; i++) {
      if (String(filas[i][col.id]) === String(registroId)) { idx = i; break; }
    }
    if (idx === -1) return { ok: false, error: "No se encontró el movimiento." };
    if (filas[idx][col.anulado_ts]) return { ok: false, error: "Ese movimiento ya estaba anulado." };

    const ts = Number(filas[idx][col.ts]);
    const local = filas[idx][col.local];
    const empleadoIdDueño = String(filas[idx][col.empleadoId]);
    const edad = Date.now() - ts;

    let permitido = false;
    if (empleado.rol === "admin" || empleado.rol === "supervisor") permitido = true;
    else if ((empleado.rol === "encargado" || empleado.rol === "turno" || empleado.rol === "produccion") && String(empleado.local) === String(local) && edad <= VENTANA_ANULAR_ENCARGADO_MS) permitido = true;
    else if (empleado.rol === "colaborador" && empleadoIdDueño === String(empleado.id) && edad <= VENTANA_ANULAR_COLABORADOR_MS) permitido = true;

    if (!permitido) return { ok: false, error: "No tenés permiso para anular ese movimiento (o ya pasó el tiempo permitido)." };

    // Si esto es una Salida (no Desperdicio, que nunca tiene devolución
    // asociada) y la misma persona ya cargó una Devolución vigente
    // DESPUÉS de esta Salida en el mismo local, anular la Salida dejaría
    // esa Devolución "huérfana" — el stock quedaría de más, sin ninguna
    // salida real que la justifique. Se bloquea y se pide anular primero
    // la Devolución (orden inverso al que se cargaron).
    const tipoReg = filas[idx][col.tipo];
    const subtipoReg = filas[idx][col.subtipo];
    if (tipoReg === "salida" && subtipoReg !== "desperdicio") {
      const hayDevolucionPosterior = filas.some((fila, i) => {
        if (i === 0) return false;
        return fila[col.tipo] === "ingreso" &&
          fila[col.subtipo] === "devolucion" &&
          String(fila[col.empleadoId]) === empleadoIdDueño &&
          String(fila[col.local]) === String(local) &&
          Number(fila[col.ts]) > ts &&
          !fila[col.anulado_ts];
      });
      if (hayDevolucionPosterior) {
        return { ok: false, error: "No se puede anular: ya hay una devolución cargada después de esta salida. Anulá primero esa devolución y después esta salida." };
      }
    }

    sheet.getRange(idx + 1, col.anulado_por + 1).setValue(empleado.nombre);
    sheet.getRange(idx + 1, col.anulado_ts + 1).setValue(Date.now());
    sheet.getRange(idx + 1, col.motivo + 1).setValue(motivo || "");
    _auditar("anular", empleado.id, empleado.nombre, "Movimiento " + registroId + " (" + filas[idx][col.tipo] + ", " + local + ")" + (motivo ? ": " + motivo : ""));
    _invalidarCacheDatos(local);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function eliminarRegistro(registroId, empleado) {
  if (empleado.rol !== "admin") return { ok: false, error: "Solo un administrador puede borrar el historial real." };
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    // Necesitamos el local ANTES de borrar la fila, para poder invalidar el
    // cache de datos() de ese local — si no, un admin que borra una
    // salida/ingreso de prueba puede ver el stock viejo hasta 45s (lo que
    // dure el cache) en vez de corregirse al toque.
    const objetivo = _leerCrudo("Registros").filter((x) => String(x.id) === String(registroId))[0];
    const r = _eliminarCrudo("Registros", registroId);
    if (r.ok) {
      _auditar("eliminar_registro", empleado.id, empleado.nombre, "Registro " + registroId + " borrado definitivamente");
      if (objetivo && objetivo.local) _invalidarCacheDatos(objetivo.local);
    }
    return r;
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   EMPLEADOS — alta, baja, reset de PIN (matriz de roles)
============================================================ */

const ROLES = ["admin", "supervisor", "encargado", "turno", "colaborador", "produccion"];

function empleadosAdmin(local, empleado) {
  let filas = _leerCrudo("Empleados");
  if (empleado.rol === "encargado") {
    filas = filas.filter((e) => String(e.local || "").trim() === String(empleado.local).trim());
  } else if (empleado.rol === "supervisor" || empleado.rol === "admin") {
    // Sin local: gestión general (admins y supervisores, que no pertenecen a
    // ningún local puntual) — nunca la nómina completa de todos los locales.
    filas = local
      ? filas.filter((e) => String(e.local || "").trim() === String(local).trim())
      : filas.filter((e) => e.rol === "admin" || e.rol === "supervisor");
  } else {
    return { ok: false, error: "No tenés permiso para ver empleados." };
  }
  return {
    ok: true,
    empleados: filas.map((e) => ({
      id: e.id, nombre: e.nombre, rol: e.rol, local: e.local || "", activo: _esVerdadero(e.activo) !== false,
      tienePin: !!e.pin_hash,
    })),
  };
}

function altaEmpleado(nombre, rol, local, empleado) {
  nombre = String(nombre || "").trim();
  if (!nombre) return { ok: false, error: "Falta el nombre y apellido." };
  if (ROLES.indexOf(rol) === -1) return { ok: false, error: "Rol inválido." };
  if ((rol === "encargado" || rol === "turno" || rol === "colaborador" || rol === "produccion") && !local) return { ok: false, error: "Falta el local." };

  if (rol === "admin" || rol === "supervisor") {
    if (empleado.rol !== "admin") return { ok: false, error: "Solo un administrador puede crear admins o supervisores." };
  } else if (rol === "encargado") {
    if (empleado.rol !== "admin" && empleado.rol !== "supervisor") return { ok: false, error: "No tenés permiso para crear encargados." };
  } else if (rol === "turno" || rol === "colaborador" || rol === "produccion") {
    if (empleado.rol === "turno" || empleado.rol === "colaborador" || empleado.rol === "produccion") return { ok: false, error: "No tenés permiso para dar de alta empleados." };
    if (empleado.rol === "encargado" && String(empleado.local) !== String(local)) {
      return { ok: false, error: "Un encargado solo puede dar de alta empleados de su propio local." };
    }
    if (rol === "produccion") {
      const filaLocalProd = _leerCrudo("Locales").filter((l) => String(l.nombre) === String(local))[0];
      if (!filaLocalProd || _esVerdadero(filaLocalProd.produccion) !== true) {
        return { ok: false, error: "Ese local no tiene Producción activada." };
      }
    }
  }

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const r = _escribirCrudo("Empleados", {
      nombre: nombre, rol: rol, local: (rol === "admin" || rol === "supervisor") ? "" : local,
      pin_hash: "", salt: "", activo: true, creado_por: empleado.nombre, creado_ts: Date.now(),
      intentos: 0, bloqueado_hasta: "",
    });
    _auditar("alta_empleado", empleado.id, empleado.nombre, "Alta de " + nombre + " (" + rol + (local ? ", " + local : "") + ")");
    return { ok: true, id: r.id };
  } finally {
    lock.releaseLock();
  }
}

function _empleadoPorId(id) {
  const filas = _leerCrudo("Empleados").filter((e) => String(e.id) === String(id));
  return filas[0] || null;
}

function bajaEmpleado(empleadoId, empleado) {
  const objetivo = _empleadoPorId(empleadoId);
  if (!objetivo) return { ok: false, error: "No se encontró ese empleado." };

  let permitido = false;
  if (empleado.rol === "admin") permitido = true;
  else if (empleado.rol === "supervisor" && objetivo.rol !== "admin") permitido = true;
  else if (empleado.rol === "encargado" && (objetivo.rol === "colaborador" || objetivo.rol === "turno" || objetivo.rol === "produccion") && String(objetivo.local) === String(empleado.local)) permitido = true;
  if (!permitido) return { ok: false, error: "No tenés permiso para dar de baja a ese empleado." };

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const r = _actualizarCrudo("Empleados", empleadoId, { activo: false });
    if (r.ok) _auditar("baja_empleado", empleado.id, empleado.nombre, "Baja de " + objetivo.nombre);
    return r;
  } finally {
    lock.releaseLock();
  }
}

/** Borrado real (no soft-delete) — solo admin, y solo sobre alguien ya
 *  dado de baja, para evitar borrar por error a alguien todavía activo
 *  sin pasar primero por "Dar de baja". Pensado para limpiar altas
 *  duplicadas por error (p. ej. cargar el mismo nombre varias veces). */
function eliminarEmpleado(empleadoId, empleado) {
  if (empleado.rol !== "admin") return { ok: false, error: "Solo un administrador puede eliminar empleados del todo." };
  const objetivo = _empleadoPorId(empleadoId);
  if (!objetivo) return { ok: false, error: "No se encontró ese empleado." };
  if (_esVerdadero(objetivo.activo) !== false) return { ok: false, error: "Primero tenés que dar de baja a este empleado antes de eliminarlo del todo." };

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const r = _eliminarCrudo("Empleados", empleadoId);
    if (r.ok) _auditar("eliminar_empleado", empleado.id, empleado.nombre, "Empleado " + objetivo.nombre + " (id " + empleadoId + ") borrado definitivamente");
    return r;
  } finally {
    lock.releaseLock();
  }
}

function resetPin(empleadoId, empleado) {
  const objetivo = _empleadoPorId(empleadoId);
  if (!objetivo) return { ok: false, error: "No se encontró ese empleado." };

  let permitido = false;
  if (empleado.rol === "admin") permitido = true;
  else if (empleado.rol === "supervisor") permitido = true;
  else if (empleado.rol === "encargado" && (objetivo.rol === "colaborador" || objetivo.rol === "turno" || objetivo.rol === "produccion") && String(objetivo.local) === String(empleado.local)) permitido = true;
  if (!permitido) return { ok: false, error: "No tenés permiso para resetear el PIN de ese empleado." };

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const r = _actualizarCrudo("Empleados", empleadoId, { pin_hash: "", salt: "", intentos: 0, bloqueado_hasta: "" });
    if (r.ok) _auditar("reset_pin", empleado.id, empleado.nombre, "Reset de PIN de " + objetivo.nombre);
    return r;
  } finally {
    lock.releaseLock();
  }
}

/** A diferencia de actualizarMiNombre() (que cada uno usa para su
 *  propio nombre), esta la usa quien gestiona el equipo para corregir
 *  el nombre de un colaborador o responsable de turno — mismo permiso
 *  que resetear el PIN. */
function editarNombreEmpleado(empleadoId, nombre, empleado) {
  const objetivo = _empleadoPorId(empleadoId);
  if (!objetivo) return { ok: false, error: "No se encontró ese empleado." };
  nombre = String(nombre || "").trim();
  if (!nombre) return { ok: false, error: "Falta el nombre." };

  let permitido = false;
  if (empleado.rol === "admin") permitido = true;
  else if (empleado.rol === "supervisor" && objetivo.rol !== "admin") permitido = true;
  else if (empleado.rol === "encargado" && (objetivo.rol === "colaborador" || objetivo.rol === "turno" || objetivo.rol === "produccion") && String(objetivo.local) === String(empleado.local)) permitido = true;
  if (!permitido) return { ok: false, error: "No tenés permiso para editar el nombre de ese empleado." };

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const r = _actualizarCrudo("Empleados", empleadoId, { nombre: nombre });
    if (r.ok) _auditar("editar_nombre_empleado", empleado.id, empleado.nombre, "Nombre de \"" + objetivo.nombre + "\" -> \"" + nombre + "\"");
    return r;
  } finally {
    lock.releaseLock();
  }
}

/** Antes, para pasar a alguien de colaborador a turno (o viceversa) había
 *  que darlo de baja, eliminarlo y volver a darlo de alta — una encargada
 *  lo reportó como un trámite innecesario. Esto solo cambia Empleados.rol,
 *  nunca el local ni el PIN. Mismo criterio de "quién puede asignar qué
 *  rol" que altaEmpleado(): a propósito NO deja pasar a nadie a admin o
 *  supervisor desde acá (esos dos locales quedan sin `local`, y promover
 *  a alguien a gestión general es una decisión más grande que merece el
 *  alta normal, no un <select> de la fila). */
function cambiarRolEmpleado(empleadoId, nuevoRol, empleado) {
  const objetivo = _empleadoPorId(empleadoId);
  if (!objetivo) return { ok: false, error: "No se encontró ese empleado." };
  if (objetivo.rol !== "colaborador" && objetivo.rol !== "turno" && objetivo.rol !== "produccion") {
    return { ok: false, error: "Ese rol no se puede cambiar desde acá." };
  }
  if (["encargado", "turno", "colaborador", "produccion"].indexOf(nuevoRol) === -1) {
    return { ok: false, error: "Rol inválido." };
  }

  let permitido = false;
  if (empleado.rol === "admin" || empleado.rol === "supervisor") permitido = true;
  else if (empleado.rol === "encargado" && nuevoRol !== "encargado" && String(objetivo.local) === String(empleado.local)) permitido = true;
  if (!permitido) return { ok: false, error: "No tenés permiso para cambiar el rol de ese empleado." };

  if (nuevoRol === "produccion") {
    const filaLocalProd = _leerCrudo("Locales").filter((l) => String(l.nombre) === String(objetivo.local))[0];
    if (!filaLocalProd || _esVerdadero(filaLocalProd.produccion) !== true) {
      return { ok: false, error: "Ese local no tiene Producción activada." };
    }
  }

  if (nuevoRol === objetivo.rol) return { ok: true };

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const r = _actualizarCrudo("Empleados", empleadoId, { rol: nuevoRol });
    if (r.ok) _auditar("cambiar_rol_empleado", empleado.id, empleado.nombre, "Rol de \"" + objetivo.nombre + "\": \"" + objetivo.rol + "\" -> \"" + nuevoRol + "\"");
    return r;
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   ADMIN — sabores y locales (alta/edición, solo admin)
============================================================ */

function adminSabor(sabor, empleado) {
  if (empleado.rol !== "admin") return { ok: false, error: "Solo un administrador puede editar los sabores." };
  if (!sabor || !String(sabor.nombre || "").trim()) return { ok: false, error: "Falta el nombre del sabor." };
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const todos = _leerCrudo("Sabores");
    const existente = sabor.id ? todos.filter((s) => String(s.id) === String(sabor.id))[0] : null;
    let orden = Number(sabor.orden) || 0;
    if (!existente && !orden) {
      orden = todos.reduce((max, s) => Math.max(max, Number(s.orden) || 0), 0) + 1;
    }
    const cambios = {
      nombre: sabor.nombre, tipo: sabor.tipo, minimo: Number(sabor.minimo) || 0,
      activo: sabor.activo !== false, orden: orden, categoria: sabor.categoria || "Cremas",
      peso: Number(sabor.peso) || 0, familia: sabor.familia || "vasquetas",
      cantidad_maestra: Number(sabor.cantidad_maestra) || 0,
    };
    const r = existente ? _actualizarCrudo("Sabores", sabor.id, cambios) : _escribirCrudo("Sabores", cambios);
    if (r.ok) _auditar("admin_sabor", empleado.id, empleado.nombre, "Sabor " + r.id + " (" + sabor.nombre + ")");
    return r;
  } finally {
    lock.releaseLock();
  }
}

/** Todos los sabores, activos e inactivos — a diferencia de datos(),
 *  que solo devuelve los activos (lo que ve el personal para registrar
 *  movimientos). Solo admin: hace falta ver los inactivos para poder
 *  reactivarlos o corregirlos desde la pantalla de administración. */
function saboresAdmin(empleado) {
  if (empleado.rol !== "admin") return { ok: false, error: "Solo un administrador puede ver esto." };
  const sabores = _leerCrudo("Sabores")
    .map((s) => ({
      id: String(s.id), nombre: s.nombre, tipo: s.tipo, minimo: Number(s.minimo) || 0,
      orden: Number(s.orden) || 0, categoria: s.categoria || "Cremas", activo: _esVerdadero(s.activo) !== false,
      peso: Number(s.peso) || 0, familia: s.familia || "vasquetas", cantidad_maestra: Number(s.cantidad_maestra) || 0,
    }))
    .sort((a, b) => a.orden - b.orden);
  return { ok: true, sabores: sabores };
}

function adminLocal(local, empleado) {
  if (empleado.rol !== "admin") return { ok: false, error: "Solo un administrador puede editar los locales." };
  if (!local || !local.nombre) return { ok: false, error: "Falta el nombre del local." };
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const existente = _leerCrudo("Locales").filter((l) => String(l.nombre) === String(local.nombre))[0];
    const cambios = { grupo: local.grupo || "", activo: local.activo !== false };
    let r;
    if (existente) {
      const sheet = _sheet("Locales");
      const filas = sheet.getDataRange().getValues();
      const headers = filas[0];
      const colNombre = headers.indexOf("nombre");
      let idx = -1;
      for (let i = 1; i < filas.length; i++) if (String(filas[i][colNombre]) === String(local.nombre)) { idx = i; break; }
      headers.forEach((h, i) => { if (cambios[h] !== undefined) _escribirCeldaSinAdivinar(sheet.getRange(idx + 1, i + 1), cambios[h]); });
      r = { ok: true };
    } else {
      const sheet = _sheet("Locales");
      const headers = sheet.getDataRange().getValues()[0];
      const fila = Object.assign({ nombre: local.nombre }, cambios);
      const destino = sheet.getLastRow() + 1;
      headers.forEach((h, i) => _escribirCeldaSinAdivinar(sheet.getRange(destino, i + 1), fila[h] !== undefined ? fila[h] : ""));
      r = { ok: true };
    }
    _auditar("admin_local", empleado.id, empleado.nombre, "Local " + local.nombre);
    return r;
  } finally {
    lock.releaseLock();
  }
}

/** El Resp. de local prende/apaga qué sabores del catálogo tiene SU
 *  local (ej. Baldes, en un local que no los vende) — a diferencia de
 *  adminSabor/adminLocal, esto NO es solo-admin: el que puede ajustarlo
 *  es justamente el responsable de ese local, nadie más (ni siquiera
 *  supervisor por ahora, así lo pidió Gabi). Guarda en Locales.sabores_excluidos
 *  (ids separados por coma); si esa columna todavía no existe en la
 *  hoja, avisa en vez de fallar silencioso. */
function toggleSaborLocal(saborId, local, empleado) {
  if (!saborId) return { ok: false, error: "Falta el sabor." };
  if (!local) return { ok: false, error: "Falta el local." };
  if (empleado.rol !== "encargado" || String(empleado.local || "").trim() !== String(local).trim()) {
    return { ok: false, error: "Solo el responsable de ese local puede ajustar esto." };
  }
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const sheet = _sheet("Locales");
    const filas = sheet.getDataRange().getValues();
    const headers = filas[0];
    const colNombre = headers.indexOf("nombre");
    const colExcluidos = headers.indexOf("sabores_excluidos");
    if (colExcluidos === -1) {
      return { ok: false, error: "Falta la columna 'sabores_excluidos' en la hoja Locales — hay que agregarla (ver apps-script/README.md)." };
    }
    let idx = -1;
    for (let i = 1; i < filas.length; i++) if (String(filas[i][colNombre]) === String(local)) { idx = i; break; }
    if (idx === -1) return { ok: false, error: "No se encontró ese local." };
    const actuales = String(filas[idx][colExcluidos] || "").split(",").map((x) => x.trim()).filter(Boolean);
    const pos = actuales.indexOf(String(saborId));
    let excluido;
    if (pos === -1) { actuales.push(String(saborId)); excluido = true; }
    else { actuales.splice(pos, 1); excluido = false; }
    _escribirCeldaSinAdivinar(sheet.getRange(idx + 1, colExcluidos + 1), actuales.join(","));
    _invalidarCacheDatos(local);
    _auditar("toggle_sabor_local", empleado.id, empleado.nombre, (excluido ? "Desactivó" : "Reactivó") + " el sabor " + saborId + " en " + local);
    return { ok: true, excluido: excluido };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   AUDITORÍA
============================================================ */

function _auditar(accion, actorId, actorNombre, detalle) {
  try {
    _escribirCrudo("Auditoria", { ts: Date.now(), accion: accion, actorId: actorId, actor: actorNombre, detalle: detalle || "" });
  } catch (err) {
    // La auditoría nunca debe tumbar la operación principal.
  }
}

/* ============================================================
   HELPERS genéricos de hoja (mismo patrón que luccianos-academy)
============================================================ */

function _sheet(nombre) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!sheet) throw new Error("No existe la hoja '" + nombre + "'.");
  return sheet;
}

function _esVerdadero(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v == null ? "" : v).trim().toUpperCase();
  if (s === "") return null;
  return s === "SI" || s === "TRUE" || s === "1";
}

function _celdaComoTexto(v) {
  if (v instanceof Date) return v.getTime();
  return v;
}

function _filasComoObjetos(sheet) {
  const datos = sheet.getDataRange().getValues();
  if (datos.length < 2) return [];
  const headers = datos[0];
  return datos.slice(1)
    .filter((fila) => fila.some((c) => c !== ""))
    .map((fila) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = _celdaComoTexto(fila[i]); });
      return obj;
    });
}

function _leerCrudo(hoja) {
  return _filasComoObjetos(_sheet(hoja));
}

/** Como _leerCrudo, pero solo lee las últimas `maxFilas` filas en vez de
 *  la hoja entera — para chequeos que solo necesitan historial reciente
 *  (ej. no duplicar un movimiento de la cola offline, que siempre se
 *  reintenta a los pocos segundos/minutos, nunca meses después). En
 *  Registros, que acumula el historial de los 35 locales juntos, leer
 *  la hoja entera en cada salida/ingreso/conteo es lo que más lentitud
 *  genera a medida que crece. */
function _leerUltimasFilas(hoja, maxFilas) {
  const sheet = _sheet(hoja);
  const ultimaFila = sheet.getLastRow();
  if (ultimaFila < 2) return [];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const desde = Math.max(2, ultimaFila - maxFilas + 1);
  const datos = sheet.getRange(desde, 1, ultimaFila - desde + 1, sheet.getLastColumn()).getValues();
  return datos
    .filter((fila) => fila.some((c) => c !== ""))
    .map((fila) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = _celdaComoTexto(fila[i]); });
      return obj;
    });
}

function _sanitizarCelda(v) {
  if (v === true) return "SI";
  if (v === false) return "NO";
  if (v === null || v === undefined) return "";
  return v;
}

/** Fuerza formato de texto plano antes de escribir — evita que Sheets
 *  "adivine" el tipo de celda (fechas, números con coma decimal, etc.)
 *  en columnas que son JSON, ids o listas separadas por coma. */
function _escribirCeldaSinAdivinar(celda, valor) {
  if (typeof valor === "string") celda.setNumberFormat("@");
  celda.setValue(valor);
}

/** IDs correlativos que nunca se reciclan (se guarda el máximo
 *  histórico en Script Properties), así un id borrado no se le
 *  hereda por accidente a un registro nuevo. */
function _proximoId(sheet) {
  const props = PropertiesService.getScriptProperties();
  const clave = "proximoId_" + sheet.getName();
  const maxGuardado = Number(props.getProperty(clave)) || 0;
  let maxActual = maxGuardado;
  if (!maxGuardado) {
    // Primera vez que esta hoja pide un id: todavía no hay nada guardado en
    // Script Properties, así que la escaneamos una única vez para arrancar
    // el correlativo. De ahí en más ya queda guardado acá y no hace falta
    // releer la hoja entera (que puede tener miles de filas en Registros)
    // en cada alta — eso era lo que hacía cada vez más lento registrar
    // una salida/ingreso a medida que se acumulaba historial.
    const datos = sheet.getDataRange().getValues();
    const headers = datos[0];
    const colId = headers.indexOf("id");
    for (let i = 1; i < datos.length; i++) {
      const v = Number(datos[i][colId]);
      if (v > maxActual) maxActual = v;
    }
  }
  const nuevoId = maxActual + 1;
  props.setProperty(clave, String(nuevoId));
  return nuevoId;
}

/** Arma la fila (valores + formatos) para escribirla de una sola vez
 *  en vez de una llamada a Sheets por columna — con ~14 columnas en
 *  Registros, eso eran hasta 28 idas y vueltas por cada salida/ingreso/
 *  conteo, y era lo que más demoraba "Guardando…" cuando la planilla
 *  tenía varios locales escribiendo a la vez. */
function _filaParaEscribir(headers, filaCompleta) {
  const valores = [];
  const formatos = [];
  headers.forEach((h) => {
    const valor = filaCompleta[h] !== undefined ? _sanitizarCelda(filaCompleta[h]) : "";
    valores.push(valor);
    formatos.push(typeof valor === "string" ? "@" : "General");
  });
  return { valores: valores, formatos: formatos };
}

function _escribirFilaCompleta(sheet, headers, filaCompleta) {
  const destino = sheet.getLastRow() + 1;
  const { valores, formatos } = _filaParaEscribir(headers, filaCompleta);
  const rango = sheet.getRange(destino, 1, 1, headers.length);
  rango.setNumberFormats([formatos]);
  rango.setValues([valores]);
}

function _escribirCrudo(hoja, fila) {
  const sheet = _sheet(hoja);
  const headers = sheet.getDataRange().getValues()[0];
  const nuevoId = _proximoId(sheet);
  const filaCompleta = Object.assign({}, fila, { id: nuevoId });
  _escribirFilaCompleta(sheet, headers, filaCompleta);
  return { ok: true, id: nuevoId };
}

/** Como _escribirCrudo pero con id explícito (Sabores usa el id fijo
 *  del catálogo de toda la vida, 1..47, no un correlativo nuevo). */
function _escribirCrudoConId(hoja, fila) {
  const sheet = _sheet(hoja);
  const headers = sheet.getDataRange().getValues()[0];
  _escribirFilaCompleta(sheet, headers, fila);
  return { ok: true, id: fila.id };
}

function _actualizarCrudo(hoja, id, cambios) {
  const sheet = _sheet(hoja);
  const datos = sheet.getDataRange().getValues();
  const headers = datos[0];
  const colId = headers.indexOf("id");
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][colId]) === String(id)) {
      const noEncontradas = [];
      Object.keys(cambios).forEach((key) => {
        const col = headers.indexOf(key);
        if (col === -1) { noEncontradas.push(key); return; }
        _escribirCeldaSinAdivinar(sheet.getRange(i + 1, col + 1), _sanitizarCelda(cambios[key]));
      });
      if (noEncontradas.length > 0) return { ok: false, error: "Faltan columnas en \"" + hoja + "\": " + noEncontradas.join(", ") };
      return { ok: true };
    }
  }
  return { ok: false, error: "No se encontró id " + id + " en " + hoja };
}

function _eliminarCrudo(hoja, id) {
  const sheet = _sheet(hoja);
  const datos = sheet.getDataRange().getValues();
  const headers = datos[0];
  const colId = headers.indexOf("id");
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][colId]) === String(id)) { sheet.deleteRow(i + 1); return { ok: true }; }
  }
  return { ok: false, error: "No se encontró id " + id + " en " + hoja };
}
