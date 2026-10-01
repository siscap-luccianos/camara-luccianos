/* ============================================================
   Cámara Lucciano's — Backend (Google Apps Script)

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
const BACKEND_VERSION = "1.15.0";

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
    .createTextOutput(JSON.stringify({ ok: true, mensaje: "Cámara Lucciano's backend activo", version: BACKEND_VERSION }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Acciones que no requieren token (login y datos públicos no sensibles:
// nombres de locales/empleados para armar los selectores de login).
const ACCIONES_PUBLICAS = ["localesActivos", "empleadosLocal", "empleadosGestion", "login", "verificarClaveLocal"];

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
    case "verificarClaveLocal": return verificarClaveLocal(body.local, body.clave);
    default: return { ok: false, error: "Acción desconocida: " + accion };
  }
}

function _despacharConSesion(accion, body, empleado) {
  switch (accion) {
    case "misDatos": return { ok: true, empleado: _empleadoPublico(empleado) };
    case "actualizarMiNombre": return actualizarMiNombre(body.nombre, empleado);
    case "datos": return datos(body.local, empleado);
    case "registrar": return registrar(body.clienteId, body.tipo, body.local, body.items, body.remito, empleado, body.fotoRemito);
    case "leerRemito": return leerRemito(body.foto, body.mime, body.local, empleado);
    case "conteo": return conteo(body.clienteId, body.local, body.items, empleado);
    case "anular": return anular(body.registroId, body.motivo, empleado);
    case "eliminarRegistro": return eliminarRegistro(body.registroId, empleado);
    case "altaEmpleado": return altaEmpleado(body.nombre, body.rol, body.local, empleado);
    case "bajaEmpleado": return bajaEmpleado(body.empleadoId, empleado);
    case "eliminarEmpleado": return eliminarEmpleado(body.empleadoId, empleado);
    case "resetPin": return resetPin(body.empleadoId, empleado);
    case "editarNombreEmpleado": return editarNombreEmpleado(body.empleadoId, body.nombre, empleado);
    case "empleadosAdmin": return empleadosAdmin(body.local, empleado);
    case "adminSabor": return adminSabor(body.sabor, empleado);
    case "saboresAdmin": return saboresAdmin(empleado);
    case "adminLocal": return adminLocal(body.localDatos, empleado);
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
    (e.rol === "colaborador" || e.rol === "encargado" || e.rol === "turno") &&
    String(e.local || "").trim() === String(local).trim());
  return { ok: true, empleados: filas.map((e) => ({ id: e.id, nombre: e.nombre, rol: e.rol })) };
}

function empleadosGestion() {
  const filas = _leerCrudo("Empleados").filter((e) =>
    _esVerdadero(e.activo) !== false && (e.rol === "admin" || e.rol === "supervisor"));
  return { ok: true, empleados: filas.map((e) => ({ id: e.id, nombre: e.nombre, rol: e.rol })) };
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
  let empleadoIdOk = null;
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
      empleadoIdOk = empleadoId;
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

      sheet.getRange(fila + 1, col.intentos + 1).setValue(0);
      sheet.getRange(fila + 1, col.bloqueado_hasta + 1).setValue("");
      empleadoIdOk = empleadoId;
    }
  } finally {
    lock.releaseLock();
  }

  // Soltamos el candado global ACÁ, antes de armar la respuesta — lo que
  // sigue (emitir el token y, si corresponde, traer los datos del local)
  // es de solo lectura y no necesita bloquear a otros locales mientras
  // tanto. Esto es lo que más recorta la espera cuando varias personas
  // entran casi al mismo tiempo en distintos locales.
  const empleado = _empleadoPorId(empleadoIdOk);
  return _resultadoLogin(empleado, local);
}

/** Arma la respuesta del login. Si el cliente ya sabe con qué local va a
 *  trabajar (deviceLocal fijo en la tablet, o el que se eligió en el
 *  selector para armar la lista de "¿quién sos?"), le devolvemos también
 *  los datos de ese local en la MISMA respuesta — así el cliente no
 *  necesita una segunda ida y vuelta a Apps Script (que es lo que más
 *  demora siente en este stack) para tener algo para mostrar. */
function _resultadoLogin(empleado, local) {
  const resultado = { ok: true, token: _emitirToken(empleado.id), empleado: _empleadoPublico(empleado) };
  if (local && _puedeVerLocal(empleado, local)) {
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

/** Ida a Sheets real (3 lecturas de hoja completa) — es lo que hace
 *  lenta a datos(), no el tamaño de la respuesta. Se cachea el
 *  resultado por local (ver datos()) para que cambiar de local varias
 *  veces seguidas, o el polling cada 30s, no vuelvan a pagar ese costo
 *  si nada cambió en el medio. */
function _datosSinCache(local, empleado) {
  const limite = Date.now() - DIAS_HISTORIAL * 864e5;
  const registros = _leerCrudo("Registros")
    .filter((r) => String(r.local || "").trim() === String(local).trim() && Number(r.ts) >= limite)
    .map(_registroPublico);

  const stockFilas = _leerCrudo("Stock").filter((s) => String(s.local || "").trim() === String(local).trim());
  const stock = stockFilas.length ? _stockPublico(stockFilas[0]) : null;

  const sabores = _leerCrudo("Sabores")
    .filter((s) => _esVerdadero(s.activo) !== false)
    .map((s) => ({ id: String(s.id), nombre: s.nombre, tipo: s.tipo, minimo: Number(s.minimo) || 0, orden: Number(s.orden) || 0, categoria: s.categoria || "Cremas", peso: Number(s.peso) || 0 }))
    .sort((a, b) => a.orden - b.orden);

  return { registros: registros, stock: stock, sabores: sabores };
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

  return { ok: true, registros: base.registros, stock: base.stock, sabores: base.sabores, rol: empleado.rol };
}

function _registroPublico(r) {
  let items = {};
  try { items = JSON.parse(r.items || "{}"); } catch (e) { items = {}; }
  return {
    id: String(r.id), tipo: r.tipo, local: r.local, empleado: r.empleado, items: items,
    total: Number(r.total) || 0, remito: r.remito || "", ts: Number(r.ts),
    anulado: !!r.anulado_ts, anulado_por: r.anulado_por || "", motivo: r.motivo || "",
    foto_remito: r.foto_remito || "",
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

function registrar(clienteId, tipo, local, items, remito, empleado, fotoRemito) {
  if (tipo !== "salida" && tipo !== "ingreso") return { ok: false, error: "Tipo de movimiento inválido." };
  if (!local) return { ok: false, error: "Falta el local." };
  if (!_puedeVerLocal(empleado, local)) return { ok: false, error: "No tenés acceso a ese local." };
  if (!items || !Object.keys(items).length) return { ok: false, error: "No hay sabores cargados." };

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    if (clienteId) {
      const existente = _leerCrudo("Registros").filter((r) => r.clienteId && String(r.clienteId) === String(clienteId))[0];
      if (existente) return { ok: true, id: existente.id, repetido: true }; // idempotencia (cola offline)
    }
    const items2 = {};
    Object.keys(items).forEach((id) => { const q = Number(items[id]) || 0; if (q > 0) items2[id] = q; });
    const total = _totalItems(items2);
    const ts = Date.now();
    const r = _escribirCrudo("Registros", {
      clienteId: clienteId || "", tipo: tipo, local: local, empleadoId: empleado.id, empleado: empleado.nombre,
      items: JSON.stringify(items2), total: total, remito: remito || "", ts: ts,
      anulado_por: "", anulado_ts: "", motivo: "", foto_remito: fotoRemito || "",
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
 *  (el frontend lo marca para que el empleado elija a mano). */
function _matchearSabor(nombreDetectado, sabores) {
  const norm = _normalizar(nombreDetectado);
  if (!norm) return null;
  // 1) match exacto
  let mejor = sabores.find((s) => _normalizar(s.nombre) === norm);
  if (mejor) return { sabor: mejor, confianza: "alta" };
  // 2) uno contiene al otro (ej. "pistacchio" vs "pistacchio 100% vegetal")
  mejor = sabores.find((s) => {
    const ns = _normalizar(s.nombre);
    return ns.length > 3 && (norm.indexOf(ns) !== -1 || ns.indexOf(norm) !== -1);
  });
  if (mejor) return { sabor: mejor, confianza: "media" };
  // 3) comparten la mayoría de las palabras
  const palabrasDet = norm.split(" ").filter((w) => w.length > 2);
  if (palabrasDet.length) {
    let mejorScore = 0;
    sabores.forEach((s) => {
      const palabrasS = _normalizar(s.nombre).split(" ").filter((w) => w.length > 2);
      if (!palabrasS.length) return;
      const comunes = palabrasDet.filter((w) => palabrasS.indexOf(w) !== -1).length;
      const score = comunes / Math.max(palabrasDet.length, palabrasS.length);
      if (score > mejorScore) { mejorScore = score; mejor = s; }
    });
    if (mejor && mejorScore >= 0.6) return { sabor: mejor, confianza: "media" };
  }
  return null;
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

/** Le manda la foto a Claude (API de Anthropic, con visión) y le pide
 *  que transcriba SOLO los renglones de la sección "SABORES" del
 *  remito (sabor + cantidad de bultos), más el número y fecha del
 *  remito si se ven. Devuelve el JSON ya parseado — tira error si la
 *  clave falta o la IA no contesta algo parseable, y quien llama
 *  decide qué hacer con eso. */
function _leerRemitoConIA(fotoBase64, mimeType) {
  const clave = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!clave) throw new Error("Falta configurar ANTHROPIC_API_KEY en Propiedades del script (ver apps-script/README.md).");

  const prompt = "Esta es la foto de un remito de helados Lucciano's. Quiero SOLO los renglones que están bajo el encabezado de productos \"SABORES\" (ignorá Chocolates, Tabletas, Sin Gluten, Palitos y cualquier otra sección). Para cada uno de esos renglones, tomá el nombre del sabor tal cual está escrito y la cantidad de bultos/vasquetas (la primera columna numérica, \"Cantidad/Bultos\", NO los kilos). También fijate si se ve el número de remito y la fecha. Contestá ÚNICAMENTE con este JSON, sin texto alrededor:\n{\"remito\":\"<número o vacío>\",\"fecha\":\"<DD/MM/AAAA o vacío>\",\"items\":[{\"nombre\":\"<como figura impreso>\",\"cantidad\":<número entero>}]}";

  const payload = {
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
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
  const texto = (data.content && data.content[0] && data.content[0].text) || "";
  const match = texto.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("La IA contestó algo que no se pudo entender. Probá con otra foto, más clara.");
  return JSON.parse(match[0]);
}

function leerRemito(fotoBase64, mimeType, local, empleado) {
  if (!local) return { ok: false, error: "Falta el local." };
  if (!_puedeVerLocal(empleado, local)) return { ok: false, error: "No tenés acceso a ese local." };
  if (!fotoBase64) return { ok: false, error: "Falta la foto." };

  let leido;
  try {
    leido = _leerRemitoConIA(fotoBase64, mimeType);
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }

  const sabores = _leerCrudo("Sabores")
    .filter((s) => _esVerdadero(s.activo) !== false)
    .map((s) => ({ id: String(s.id), nombre: s.nombre }));

  const items = (leido.items || []).map((it) => {
    const m = _matchearSabor(it.nombre, sabores);
    return {
      nombreDetectado: it.nombre,
      cantidad: Math.max(0, Number(it.cantidad) || 0),
      saborId: m ? m.sabor.id : null,
      nombreSabor: m ? m.sabor.nombre : null,
      confianza: m ? m.confianza : "sin_match",
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

  return { ok: true, remitoDetectado: leido.remito || "", fechaDetectada: leido.fecha || "", items: items, fotoUrl: fotoUrl };
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
      const existente = _leerCrudo("Registros").filter((r) => r.clienteId && String(r.clienteId) === String(clienteId))[0];
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
    else if ((empleado.rol === "encargado" || empleado.rol === "turno") && String(empleado.local) === String(local) && edad <= VENTANA_ANULAR_ENCARGADO_MS) permitido = true;
    else if (empleado.rol === "colaborador" && empleadoIdDueño === String(empleado.id) && edad <= VENTANA_ANULAR_COLABORADOR_MS) permitido = true;

    if (!permitido) return { ok: false, error: "No tenés permiso para anular ese movimiento (o ya pasó el tiempo permitido)." };

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

const ROLES = ["admin", "supervisor", "encargado", "turno", "colaborador"];

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
  if ((rol === "encargado" || rol === "turno" || rol === "colaborador") && !local) return { ok: false, error: "Falta el local." };

  if (rol === "admin" || rol === "supervisor") {
    if (empleado.rol !== "admin") return { ok: false, error: "Solo un administrador puede crear admins o supervisores." };
  } else if (rol === "encargado") {
    if (empleado.rol !== "admin" && empleado.rol !== "supervisor") return { ok: false, error: "No tenés permiso para crear encargados." };
  } else if (rol === "turno" || rol === "colaborador") {
    if (empleado.rol === "turno" || empleado.rol === "colaborador") return { ok: false, error: "No tenés permiso para dar de alta empleados." };
    if (empleado.rol === "encargado" && String(empleado.local) !== String(local)) {
      return { ok: false, error: "Un encargado solo puede dar de alta empleados de su propio local." };
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
  else if (empleado.rol === "encargado" && (objetivo.rol === "colaborador" || objetivo.rol === "turno") && String(objetivo.local) === String(empleado.local)) permitido = true;
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
  else if (empleado.rol === "encargado" && (objetivo.rol === "colaborador" || objetivo.rol === "turno") && String(objetivo.local) === String(empleado.local)) permitido = true;
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
  else if (empleado.rol === "encargado" && (objetivo.rol === "colaborador" || objetivo.rol === "turno") && String(objetivo.local) === String(empleado.local)) permitido = true;
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
      peso: Number(sabor.peso) || 0,
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
      peso: Number(s.peso) || 0,
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

function _escribirCrudo(hoja, fila) {
  const sheet = _sheet(hoja);
  const headers = sheet.getDataRange().getValues()[0];
  const nuevoId = _proximoId(sheet);
  const filaCompleta = Object.assign({}, fila, { id: nuevoId });
  const destino = sheet.getLastRow() + 1;
  headers.forEach((h, i) => {
    const valor = filaCompleta[h] !== undefined ? _sanitizarCelda(filaCompleta[h]) : "";
    _escribirCeldaSinAdivinar(sheet.getRange(destino, i + 1), valor);
  });
  return { ok: true, id: nuevoId };
}

/** Como _escribirCrudo pero con id explícito (Sabores usa el id fijo
 *  del catálogo de toda la vida, 1..47, no un correlativo nuevo). */
function _escribirCrudoConId(hoja, fila) {
  const sheet = _sheet(hoja);
  const headers = sheet.getDataRange().getValues()[0];
  const destino = sheet.getLastRow() + 1;
  headers.forEach((h, i) => {
    const valor = fila[h] !== undefined ? _sanitizarCelda(fila[h]) : "";
    _escribirCeldaSinAdivinar(sheet.getRange(destino, i + 1), valor);
  });
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
