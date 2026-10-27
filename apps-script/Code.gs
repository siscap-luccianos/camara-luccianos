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
const BACKEND_VERSION = "1.51.0";

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
const ACCIONES_PUBLICAS = ["localesActivos", "empleadosLocal", "empleadosGestion", "login", "loginGestion", "loginAdminLocal", "verificarClaveLocal", "estadoEquipo", "estadoEquipoLocal", "vincularEquipo"];

function _despachar(body) {
  const accion = body.accion;
  if (ACCIONES_PUBLICAS.indexOf(accion) === -1) {
    const sesion = _verificarSesion(body.token);
    if (!sesion.ok) return sesion;
    return _despacharConSesion(accion, body, sesion.empleado);
  }
  switch (accion) {
    case "localesActivos": return localesActivos();
    case "empleadosLocal": return empleadosLocal(body.local, body.equipoId);
    case "empleadosGestion": return empleadosGestion();
    case "login": return login(body.empleadoId, body.pin, body.pinConfirm, body.local, body.equipoId, body.equipoNombre);
    case "estadoEquipo": return estadoEquipo(body.equipoId, body.equipoNombre, body.local, body.empleadoId);
    case "estadoEquipoLocal": return estadoEquipoLocal(body.equipoId, body.local);
    case "vincularEquipo": return vincularEquipo(body.local, body.codigo, body.equipoId, body.equipoNombre);
    case "loginGestion": return loginGestion(body.empleadoId, body.clave, body.local);
    case "loginAdminLocal": return loginAdminLocal(body.empleadoId, body.codigo, body.local);
    case "verificarClaveLocal": return verificarClaveLocal(body.local, body.clave);
    default: return { ok: false, error: "Acción desconocida: " + accion };
  }
}

function _despacharConSesion(accion, body, empleado) {
  switch (accion) {
    case "misDatos": return { ok: true, empleado: _empleadoPublico(empleado) };
    case "actualizarMiNombre": return actualizarMiNombre(body.nombre, empleado);
    case "datos": return datos(body.local, empleado);
    case "relevar": return relevar(empleado);
    case "registrar": return registrar(body.clienteId, body.tipo, body.local, body.items, body.remito, empleado, body.fotoRemito, body.subtipo, body.motivo, body.kilos, body.vencimientos, body.pesos, body.fecha);
    case "leerRemito": return leerRemito(body.foto, body.mime, body.local, empleado);
    case "conteo": return conteo(body.clienteId, body.local, body.items, empleado, body.vencimientos);
    case "etiquetar": return etiquetar(body.clienteId, body.local, body.items, body.vencimientos, empleado);
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
    case "minimoMasivo": return minimoMasivo(body.cambios, body.detalle, empleado);
    case "saboresAdmin": return saboresAdmin(empleado);
    case "adminLocal": return adminLocal(body.localDatos, empleado);
    case "toggleSaborLocal": return toggleSaborLocal(body.saborId, body.local, empleado);
    case "equiposLocal": return equiposLocal(body.local, empleado);
    case "equipoDecidir": return equipoDecidir(body.clave, body.decision, body.nombre, body.local, empleado);
    case "generarCodigoEquipo": return generarCodigoEquipo(body.local, empleado);
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
      controlEquipos: _esVerdadero(l.control_equipos) === true,
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
  const tipeada = String(clave || "").trim();
  if (tipeada === claveGuardada) return { ok: true };
  // El código de admin (6 dígitos) también abre cualquier local, en lugar
  // de su contraseña. Solo se prueba si lo tipeado tiene pinta de código.
  if (/^\d{6}$/.test(tipeada)) {
    const adm = _verificarCodigoAdmin(tipeada);
    if (adm.ok) return { ok: true, modoAdmin: true };
    if (adm.bloqueado) return { ok: false, error: adm.error };
  }
  return { ok: false, error: "Contraseña incorrecta." };
}

/** Código único de admin (6 dígitos). Vive en Propiedades del script como
 *  ADMIN_CODE — nunca en la hoja ni en el repo. Como 6 dígitos sin límite
 *  se pueden probar a fuerza bruta, 5 errores seguidos bloquean los
 *  intentos 5 minutos (mismo criterio que el PIN personal). */
const ADMIN_CODE_FALLOS_KEY = "adminCodeFallos";
const ADMIN_CODE_MAX_FALLOS = 5;
const ADMIN_CODE_BLOQUEO_SEGUNDOS = 300;
function _verificarCodigoAdmin(codigo) {
  const cache = CacheService.getScriptCache();
  const fallos = Number(cache.get(ADMIN_CODE_FALLOS_KEY) || 0);
  if (fallos >= ADMIN_CODE_MAX_FALLOS) {
    return { ok: false, bloqueado: true, error: "Demasiados intentos con el código de admin. Probá de nuevo en 5 minutos." };
  }
  const esperado = PropertiesService.getScriptProperties().getProperty("ADMIN_CODE");
  if (!esperado) return { ok: false, error: "Falta configurar ADMIN_CODE en Propiedades del script." };
  if (String(codigo || "").trim() !== String(esperado).trim()) {
    cache.put(ADMIN_CODE_FALLOS_KEY, String(fallos + 1), ADMIN_CODE_BLOQUEO_SEGUNDOS);
    return { ok: false, error: "Código incorrecto." };
  }
  cache.remove(ADMIN_CODE_FALLOS_KEY);
  return { ok: true };
}

/** Admin entrando a un local real con el código de admin (en vez de la
 *  contraseña del local). Igual que Operaciones: sin PIN personal, porque
 *  el código es el factor. Solo admin o supervisor. */
function loginAdminLocal(empleadoId, codigo, local) {
  if (!empleadoId) return { ok: false, error: "Falta elegir quién sos." };
  const filaLocal = _leerCrudo("Locales").filter((l) => String(l.nombre) === String(local))[0];
  if (!filaLocal) return { ok: false, error: "No se encontró el local." };
  const adm = _verificarCodigoAdmin(codigo);
  if (!adm.ok) return { ok: false, error: adm.error };
  const empleado = _empleadoPorId(empleadoId);
  if (!empleado) return { ok: false, error: "No se encontró ese empleado." };
  if (_esVerdadero(empleado.activo) === false) return { ok: false, error: "Ese usuario está dado de baja." };
  if (empleado.rol !== "admin" && empleado.rol !== "supervisor") return { ok: false, error: "No corresponde." };
  _auditar("login_admin_codigo", empleado.id, empleado.nombre, "Entró a " + local + " con el código de admin (sin PIN)");
  return _resultadoLogin(empleado, local, false);
}

/* ============================================================
   CONTROL DE EQUIPOS POR LOCAL (hoja Dispositivos, Locales.control_equipos=SI)
   Cada local puede tener hasta EQUIPOS_MAX (3) equipos aprobados, o los de Locales.max_equipos. Un equipo nuevo
   queda "pendiente" hasta que un encargado de ese local, un supervisor o un
   admin lo aprueba; no llega a probar el PIN. Admin y supervisor no cuentan ni
   necesitan aprobación. Quitar o rechazar no cierra sesiones ya abiertas.
============================================================ */

const EQUIPOS_MAX = 3; // por defecto; un local puede tener más con Locales.max_equipos (ej. 5)

/** Cupo de equipos de ESTE local: Locales.max_equipos si está cargado (1 a 20), si no 3. */
function _maxEquipos(local) {
  const fila = _leerCrudo("Locales").filter((l) => String(l.nombre || "").trim() === String(local || "").trim())[0];
  const n = fila ? Math.floor(Number(fila.max_equipos)) : 0;
  return n >= 1 && n <= 20 ? n : EQUIPOS_MAX;
}

function _localConControlEquipos(local) {
  const fila = _leerCrudo("Locales").filter((l) => String(l.nombre || "").trim() === String(local || "").trim())[0];
  return !!fila && _esVerdadero(fila.control_equipos) === true;
}

function _claveEquipo(equipoId, local) { return String(equipoId) + "@" + String(local || "").trim(); }

function _nombreEquipoLimpio(n) { return String(n || "").replace(/[<>]/g, "").trim().slice(0, 60) || "Equipo sin nombre"; }

/** Estado de este equipo para este local y esta persona. Si el equipo no está
 *  aprobado deja el pedido anotado como pendiente (para que lo vea el encargado).
 *  Devuelve { estado: "libre" | "aprobado" | "pendiente" | "lleno" | "sinId", usados, max, ... }. */
function _estadoEquipo(local, empleado, equipoId, equipoNombre) {
  if (empleado && (empleado.rol === "admin" || empleado.rol === "supervisor")) return { estado: "libre" };
  if (!_localConControlEquipos(local)) return { estado: "libre" };
  const MAX = _maxEquipos(local);
  if (!equipoId) return { estado: "sinId", max: MAX };
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const filas = _leerCrudo("Dispositivos").filter((d) => String(d.local || "").trim() === String(local).trim());
    const usados = filas.filter((d) => d.estado === "aprobado").length;
    const clave = _claveEquipo(equipoId, local);
    const propia = filas.filter((d) => String(d.id) === clave)[0];
    const ahora = Date.now();
    const quien = empleado ? empleado.nombre : "";
    if (propia && propia.estado === "aprobado") {
      _actualizarCrudo("Dispositivos", clave, { ultimo_ts: ahora, ultimo_empleado: quien });
      return { estado: "aprobado", usados: usados, max: MAX };
    }
    const detalle = _nombreEquipoLimpio(equipoNombre);
    if (propia) {
      _actualizarCrudo("Dispositivos", clave, { estado: "pendiente", ultimo_ts: ahora, ultimo_empleado: quien });
    } else {
      _escribirCrudoConId("Dispositivos", { id: clave, equipo: String(equipoId), local: String(local).trim(), nombre: detalle, detalle: detalle, estado: "pendiente", solicitado_ts: ahora, ultimo_ts: ahora, ultimo_empleado: quien });
    }
    return { estado: usados >= MAX ? "lleno" : "pendiente", usados: usados, max: MAX, nombre: propia ? propia.nombre : detalle, desde: propia && propia.solicitado_ts ? Number(propia.solicitado_ts) : ahora };
  } finally {
    lock.releaseLock();
  }
}

/** Para login(): null si puede seguir, o la respuesta de error si el equipo no está aprobado. */
function _bloqueoPorEquipo(local, empleado, equipoId, equipoNombre) {
  const e = _estadoEquipo(local, empleado, equipoId, equipoNombre);
  if (e.estado === "libre" || e.estado === "aprobado") return null;
  if (e.estado === "sinId") return { ok: false, equipo: "sinId", error: "Recargá la app para actualizarla y volvé a intentar." };
  return { ok: false, equipo: e.estado, equipoInfo: e, error: e.estado === "lleno" ? "Este local ya tiene sus " + (e.max || EQUIPOS_MAX) + " equipos." : "Este equipo todavía no está aprobado." };
}

/** Acción pública: el cliente la llama al elegir el nombre, antes de pedir el PIN. */
function estadoEquipo(equipoId, equipoNombre, local, empleadoId) {
  if (!local) return { ok: false, error: "Falta el local." };
  const empleado = empleadoId ? _empleadoPorId(empleadoId) : null;
  const e = _estadoEquipo(local, empleado, equipoId, equipoNombre);
  if (e.estado === "sinId") return { ok: false, equipo: "sinId", error: "Recargá la app para actualizarla y volvé a intentar." };
  return { ok: true, estado: e.estado, usados: e.usados || 0, max: e.max || EQUIPOS_MAX, nombre: e.nombre || "", desde: e.desde || 0 };
}

function _puedeGestionarEquipos(empleado, local) {
  if (empleado.rol === "admin" || empleado.rol === "supervisor") return true;
  return empleado.rol === "encargado" && String(empleado.local || "").trim() === String(local || "").trim();
}

function _equipoPublico(d) {
  return { clave: String(d.id), nombre: d.nombre, detalle: d.detalle || "", ultimoTs: Number(d.ultimo_ts) || 0, ultimoEmpleado: d.ultimo_empleado || "", aprobadoPor: d.aprobado_por || "" };
}

function equiposLocal(local, empleado) {
  if (!local) return { ok: false, error: "Falta el local." };
  if (!_puedeGestionarEquipos(empleado, local)) return { ok: false, error: "No tenés permiso para ver los equipos de ese local." };
  if (!_localConControlEquipos(local)) return { ok: true, controlado: false, max: EQUIPOS_MAX, aprobados: [], pendientes: [] };
  const MAX = _maxEquipos(local);
  const filas = _leerCrudo("Dispositivos").filter((d) => String(d.local || "").trim() === String(local).trim());
  return {
    ok: true, controlado: true, max: MAX,
    aprobados: filas.filter((d) => d.estado === "aprobado").map(_equipoPublico),
    pendientes: filas.filter((d) => d.estado === "pendiente").map(_equipoPublico),
  };
}

/** decision: "aprobar" (con nombre opcional), "rechazar" (un pendiente) o "quitar" (uno aprobado). */
function equipoDecidir(clave, decision, nombre, local, empleado) {
  if (!clave || !local) return { ok: false, error: "Faltan datos." };
  if (!_puedeGestionarEquipos(empleado, local)) return { ok: false, error: "No tenés permiso para gestionar los equipos de ese local." };
  if (["aprobar", "rechazar", "quitar"].indexOf(decision) === -1) return { ok: false, error: "Decisión inválida." };
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const filas = _leerCrudo("Dispositivos").filter((d) => String(d.local || "").trim() === String(local).trim());
    const fila = filas.filter((d) => String(d.id) === String(clave))[0];
    if (!fila) return { ok: false, error: "No se encontró ese equipo." };
    if (decision === "aprobar") {
      if (fila.estado === "aprobado") return { ok: true };
      const MAX = _maxEquipos(local);
      if (filas.filter((d) => d.estado === "aprobado").length >= MAX) return { ok: false, error: "Ya hay " + MAX + " equipos aprobados. Quitá uno para poder aprobar este." };
      const nuevoNombre = nombre ? _nombreEquipoLimpio(nombre) : fila.nombre;
      _actualizarCrudo("Dispositivos", clave, { estado: "aprobado", nombre: nuevoNombre, aprobado_ts: Date.now(), aprobado_por: empleado.nombre });
      _auditar("equipo_aprobado", empleado.id, empleado.nombre, "Aprobó el equipo «" + nuevoNombre + "» en " + local);
    } else if (decision === "rechazar") {
      if (fila.estado !== "pendiente") return { ok: false, error: "Ese pedido ya no está pendiente." };
      _actualizarCrudo("Dispositivos", clave, { estado: "rechazado" });
      _auditar("equipo_rechazado", empleado.id, empleado.nombre, "Rechazó el equipo «" + fila.nombre + "» en " + local);
    } else {
      if (fila.estado !== "aprobado") return { ok: false, error: "Ese equipo no está aprobado." };
      _actualizarCrudo("Dispositivos", clave, { estado: "quitado" });
      _auditar("equipo_quitado", empleado.id, empleado.nombre, "Quitó el equipo «" + fila.nombre + "» de " + local);
    }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---- Vincular un equipo con un código (sin contraseña del local) ----
   El encargado (o supervisor/admin) genera un código de 6 números desde Equipo › Equipos.
   Vale 15 minutos y una sola vez, y solo para ese local. Se guarda en CacheService,
   no en la hoja. Al usarlo el equipo queda aprobado directo (si hay lugar en el cupo). */
const VINCULO_MINUTOS = 15;
const VINCULO_MAX_FALLOS = 5;
const VINCULO_BLOQUEO_SEGUNDOS = 300;
function _vinculoKey(local, codigo) { return "vinc:" + String(local || "").trim() + ":" + String(codigo); }

/** "aprobado" | "pendiente" | "nuevo" para este equipo en este local. No escribe nada. */
function _estadoSoloLectura(local, equipoId) {
  if (!equipoId) return "nuevo";
  const clave = _claveEquipo(equipoId, local);
  const propia = _leerCrudo("Dispositivos").filter((d) => String(d.id) === clave)[0];
  if (!propia) return "nuevo";
  return propia.estado === "aprobado" ? "aprobado" : propia.estado === "pendiente" ? "pendiente" : "nuevo";
}

/** Acción pública y de solo lectura: ¿este equipo ya está vinculado a este local? */
function estadoEquipoLocal(equipoId, local) {
  if (!local) return { ok: false, error: "Falta el local." };
  if (!equipoId) return { ok: false, equipo: "sinId", error: "Recargá la app para actualizarla y volvé a intentar." };
  if (!_localConControlEquipos(local)) return { ok: true, estado: "libre" };
  return { ok: true, estado: _estadoSoloLectura(local, equipoId), max: _maxEquipos(local) };
}

function generarCodigoEquipo(local, empleado) {
  if (!local) return { ok: false, error: "Falta el local." };
  if (!_puedeGestionarEquipos(empleado, local)) return { ok: false, error: "No tenés permiso para sumar equipos a ese local." };
  if (!_localConControlEquipos(local)) return { ok: false, error: "Este local no tiene activado el control de equipos." };
  const MAX = _maxEquipos(local);
  const usados = _leerCrudo("Dispositivos").filter((d) => String(d.local || "").trim() === String(local).trim() && d.estado === "aprobado").length;
  if (usados >= MAX) return { ok: false, error: "Ya hay " + MAX + " equipos aprobados. Quitá uno para sumar otro." };
  const cache = CacheService.getScriptCache();
  let codigo = "";
  for (let i = 0; i < 20; i++) {
    const c = ("000000" + Math.floor(Math.random() * 1000000)).slice(-6);
    if (!cache.get(_vinculoKey(local, c))) { codigo = c; break; }
  }
  if (!codigo) return { ok: false, error: "No se pudo generar el código. Probá de nuevo." };
  const vence = Date.now() + VINCULO_MINUTOS * 60000;
  cache.put(_vinculoKey(local, codigo), JSON.stringify({ porId: empleado.id, por: empleado.nombre, vence: vence }), VINCULO_MINUTOS * 60);
  _auditar("equipo_codigo_generado", empleado.id, empleado.nombre, "Generó un código para sumar un equipo en " + local);
  return { ok: true, codigo: codigo, vence: vence, minutos: VINCULO_MINUTOS };
}

/** Acción pública: el equipo nuevo escribe el código de 6 números, después de elegir el local.
 *  También acepta el código de admin (entra como admin, sin vincular el equipo). */
function vincularEquipo(local, codigo, equipoId, equipoNombre) {
  if (!local) return { ok: false, error: "Falta el local." };
  if (!equipoId) return { ok: false, equipo: "sinId", error: "Recargá la app para actualizarla y volvé a intentar." };
  if (!_localConControlEquipos(local)) return { ok: false, error: "Este local no usa control de equipos." };
  const tipeado = String(codigo || "").trim();
  if (!/^\d{6}$/.test(tipeado)) return { ok: false, error: "El código son 6 números." };
  const cache = CacheService.getScriptCache();
  const fKey = "vincFallos:" + String(local).trim();
  const fallos = Number(cache.get(fKey) || 0);
  if (fallos >= VINCULO_MAX_FALLOS) return { ok: false, error: "Demasiados intentos. Probá de nuevo en 5 minutos." };
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const key = _vinculoKey(local, tipeado);
    const crudo = cache.get(key);
    if (!crudo) {
      // No es un código de equipo: puede ser el código de admin.
      const adm = _verificarCodigoAdmin(tipeado);
      if (adm.ok) return { ok: true, modoAdmin: true };
      if (adm.bloqueado) return { ok: false, error: adm.error };
      cache.put(fKey, String(fallos + 1), VINCULO_BLOQUEO_SEGUNDOS);
      return { ok: false, error: "Código incorrecto o vencido." };
    }
    const info = JSON.parse(crudo);
    const MAX = _maxEquipos(local);
    const filas = _leerCrudo("Dispositivos").filter((d) => String(d.local || "").trim() === String(local).trim());
    const clave = _claveEquipo(equipoId, local);
    const propia = filas.filter((d) => String(d.id) === clave)[0];
    const usados = filas.filter((d) => d.estado === "aprobado").length;
    if (!(propia && propia.estado === "aprobado")) {
      if (usados >= MAX) return { ok: false, error: "Este local ya tiene sus " + MAX + " equipos. Pedile a tu encargado que quite uno." };
      const ahora = Date.now();
      const nombre = _nombreEquipoLimpio(equipoNombre);
      if (propia) {
        _actualizarCrudo("Dispositivos", clave, { estado: "aprobado", nombre: nombre, aprobado_ts: ahora, aprobado_por: info.por + " (código)", ultimo_ts: ahora });
      } else {
        _escribirCrudoConId("Dispositivos", { id: clave, equipo: String(equipoId), local: String(local).trim(), nombre: nombre, detalle: nombre, estado: "aprobado", solicitado_ts: ahora, aprobado_ts: ahora, aprobado_por: info.por + " (código)", ultimo_ts: ahora, ultimo_empleado: "" });
      }
      _auditar("equipo_vinculado_codigo", info.porId, info.por, "Equipo «" + nombre + "» vinculado a " + local + " con un código");
    }
    cache.remove(key); // de un solo uso
    cache.remove(fKey);
    const nuevos = usados + ((propia && propia.estado === "aprobado") ? 0 : 1);
    return { ok: true, estado: "aprobado", usados: nuevos, max: MAX, nombre: propia && propia.estado === "aprobado" ? propia.nombre : _nombreEquipoLimpio(equipoNombre) };
  } finally {
    lock.releaseLock();
  }
}

function empleadosLocal(local, equipoId) {
  if (!local) return { ok: false, error: "Falta el local." };
  // En un local con control de equipos la nómina no se muestra hasta que el equipo está aprobado.
  if (_localConControlEquipos(local) && _estadoSoloLectura(local, equipoId) !== "aprobado") {
    return { ok: false, equipo: "noAprobado", error: "Este equipo todavía no está vinculado a " + local + "." };
  }
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
function login(empleadoId, pin, pinConfirm, local, equipoId, equipoNombre) {
  if (!empleadoId) return { ok: false, error: "Falta elegir quién sos." };
  if (!_pinValido(pin)) return { ok: false, error: "El PIN tiene que ser de 4 números." };

  // Control de equipos (solo en locales con Locales.control_equipos=SI): un equipo sin
  // aprobar no llega a probar el PIN, así que tampoco suma intentos fallidos.
  if (_localConControlEquipos(local)) {
    const bloqueo = _bloqueoPorEquipo(local, _empleadoPorId(empleadoId), equipoId, equipoNombre);
    if (bloqueo) return bloqueo;
  }

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
    .map((s) => ({ id: String(s.id), nombre: s.nombre, tipo: s.tipo, minimo: Number(s.minimo) || 0, orden: Number(s.orden) || 0, categoria: s.categoria || "Cremas", peso: Number(s.peso) || 0, familia: s.familia || "vasquetas", cantidad_maestra: Number(s.cantidad_maestra) || 0, vida_util_dias: Number(s.vida_util_dias) || 0, codigo_fabrica: _codigoFabrica(s.codigo_fabrica) }))
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
  // Locales.produccion_rubros: qué rubros fabrica este local (ids separados por
  // coma: vasquetas, baldes, icepops, chocolateria, glutenfree). Vacío = todos.
  const produccionRubros = filaLocal ? _rubrosProduccion(filaLocal.produccion_rubros) : [];
  // Locales.escaner_peso=SI habilita, en Salida, el escaneo del código de barras
  // del rótulo de fábrica (peso por vasqueta). Piloto: hoy solo "Local prueba".
  const escanerPeso = filaLocal ? _esVerdadero(filaLocal.escaner_peso) === true : false;
  // Locales.venta_dia=SI habilita, en Salida, "Venta del día" (chocolatería): una
  // salida con lo que dice la caja al cerrar. Piloto: hoy solo "Local prueba".
  const ventaDia = filaLocal ? _esVerdadero(filaLocal.venta_dia) === true : false;
  // Locales.choco_solo_deposito=SI: la chocolatería se cuenta sin vencimientos (centro comercial con
  // el depósito lejos); la salida es la común. Si el local ya usa «Venta del día», esa manda.
  const chocoSoloDeposito = !ventaDia && (filaLocal ? _esVerdadero(filaLocal.choco_solo_deposito) === true : false);

  // Locales.control_equipos=SI: el local tiene control de equipos (pestaña Equipo > Equipos).
  const controlEquipos = filaLocal ? _esVerdadero(filaLocal.control_equipos) === true : false;
  return { registros: registros, stock: stock, sabores: sabores, excluidos: excluidos, produccion: produccion, produccionRubros: produccionRubros, escanerPeso: escanerPeso, ventaDia: ventaDia, chocoSoloDeposito: chocoSoloDeposito, controlEquipos: controlEquipos };
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

  return { ok: true, registros: base.registros, stock: base.stock, sabores: base.sabores, excluidos: base.excluidos, produccion: base.produccion, produccionRubros: base.produccionRubros, escanerPeso: !!base.escanerPeso, ventaDia: !!base.ventaDia, chocoSoloDeposito: !!base.chocoSoloDeposito, controlEquipos: !!base.controlEquipos, rol: empleado.rol };
}

/** RELEVAR (solo Operaciones: admin y supervisor): stock vigente de TODOS los
 *  locales de una vez, para armar la tabla "Relevar productos". No calcula nada
 *  distinto de lo que ve cada local: es la misma cuenta que stockMap() del
 *  cliente (último conteo + ingresos − salidas posteriores, sin anulados, con
 *  la misma ventana de DIAS_HISTORIAL que usa datos()). Devuelve el catálogo
 *  activo y, por local, {nombre, grupo, region, stock:{idSabor:unidades},
 *  conteoTs, sinDatos}. En "stock" faltan los sabores que ese local marcó que
 *  no tiene (Locales.sabores_excluidos): el cliente los muestra como "—". */
function relevar(empleado) {
  if (empleado.rol !== "admin" && empleado.rol !== "supervisor") {
    return { ok: false, error: "Solo Operaciones puede relevar productos." };
  }
  const limite = Date.now() - DIAS_HISTORIAL * 864e5;
  const saboresFilas = _leerCrudo("Sabores").filter((s) => _esVerdadero(s.activo) !== false);
  const sabores = saboresFilas
    .map((s) => ({ id: String(s.id), nombre: s.nombre, tipo: s.tipo, familia: s.familia || "vasquetas", categoria: s.categoria || "Cremas", orden: Number(s.orden) || 0, peso: Number(s.peso) || 0 }))
    .sort((a, b) => a.orden - b.orden);

  const stockPorLocal = {};
  _leerCrudo("Stock").forEach((f) => { stockPorLocal[String(f.local || "").trim()] = _stockPublico(f); });

  const regsPorLocal = {};
  _leerCrudo("Registros").forEach((r) => {
    if (r.anulado_ts || Number(r.ts) < limite) return;
    if (r.tipo !== "ingreso" && r.tipo !== "salida") return;
    const k = String(r.local || "").trim();
    (regsPorLocal[k] = regsPorLocal[k] || []).push(r);
  });

  const locales = [];
  _leerCrudo("Locales").forEach((l) => {
    const nombre = String(l.nombre || "").trim();
    if (!nombre || _esVerdadero(l.activo) === false || _esVerdadero(l.operaciones) === true) return;
    const st = stockPorLocal[nombre] || null;
    const bts = st ? st.ts : 0;
    const stock = {};
    sabores.forEach((sb) => { stock[sb.id] = Number(st && st.base ? st.base[sb.id] : 0) || 0; });
    const regs = regsPorLocal[nombre] || [];
    regs.forEach((r) => {
      if (Number(r.ts) <= bts) return;
      const signo = r.tipo === "ingreso" ? 1 : -1;
      let items = {};
      try { items = JSON.parse(r.items || "{}"); } catch (e) { items = {}; }
      Object.keys(items).forEach((id) => {
        if (stock[id] === undefined) return;
        stock[id] += signo * (Number(items[id]) || 0);
      });
    });
    String(l.sabores_excluidos || "").split(",").map((x) => x.trim()).filter(Boolean).forEach((id) => { delete stock[id]; });
    locales.push({
      nombre: nombre, grupo: String(l.grupo || "").trim(), region: String(l.region || "").trim(),
      stock: stock, conteoTs: st ? st.ts : 0, sinDatos: !st && regs.length === 0,
    });
  });
  locales.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return { ok: true, sabores: sabores, locales: locales, generado: Date.now() };
}

function _registroPublico(r) {
  let items = {};
  try { items = JSON.parse(r.items || "{}"); } catch (e) { items = {}; }
  let kilos = {};
  try { kilos = JSON.parse(r.kilos || "{}"); } catch (e) { kilos = {}; }
  let vencimientos = {};
  try { vencimientos = JSON.parse(r.vencimientos || "{}"); } catch (e) { vencimientos = {}; }
  let pesos = {};
  try { pesos = JSON.parse(r.pesos || "{}"); } catch (e) { pesos = {}; }
  return {
    id: String(r.id), tipo: r.tipo, local: r.local, empleadoId: String(r.empleadoId || ""), empleado: r.empleado, items: items,
    total: Number(r.total) || 0, remito: r.remito || "", ts: Number(r.ts),
    anulado: !!r.anulado_ts, anulado_por: r.anulado_por || "", motivo: r.motivo || "",
    foto_remito: r.foto_remito || "", subtipo: r.subtipo || "", kilos: kilos, vencimientos: vencimientos, pesos: pesos,
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

/** Vencimientos de Registros.vencimientos (por sabor):
 *  - string "YYYY-MM-DD" = un lote. En una salida o desperdicio es el lote
 *    del que se sacó (lo elige la persona; si no lo elige, sale el que vence antes).
 *  - array [{f, c}] = varios lotes del mismo producto que suman la cantidad
 *    cargada (ej. un ingreso con una caja de 25/10 y otra de 12/11, o un conteo
 *    con lotes distintos). f vacío = sin fecha.
 *  Devuelve {ok, vencimientos} o {ok:false, error}. */
function _normalizarVencimientos(vencimientos, items, tipo) {
  const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const venc = vencimientos || {};
  const out = {};
  for (const id of Object.keys(venc)) {
    const cantidad = Math.floor(Number(items[id]) || 0);
    if (cantidad <= 0) continue;
    const v = venc[id];
    if (typeof v === "string") { if (esFecha(v) || v === "sin-fecha") out[id] = v; continue; } // "sin-fecha": la salida se sacó del lote sin etiquetar
    if (!Array.isArray(v) || tipo === "salida") continue;
    const lotes = v.map((l) => ({ f: String((l && l.f) || ""), c: Math.floor(Number(l && l.c) || 0) })).filter((l) => l.c > 0);
    if (lotes.some((l) => l.f && !esFecha(l.f))) return { ok: false, error: "Hay un vencimiento con fecha inválida." };
    if (lotes.reduce((a, l) => a + l.c, 0) !== cantidad) return { ok: false, error: "Los lotes de un producto no suman la cantidad cargada." };
    if (lotes.length) out[id] = lotes;
  }
  return { ok: true, vencimientos: out };
}
/** true si a un producto que pide vencimiento le falta la fecha (sin fecha, o algún lote sin fecha). */
function _vencFaltante(v) {
  if (!v) return true;
  if (typeof v === "string") return !/^\d{4}-\d{2}-\d{2}$/.test(v);
  return v.some((l) => !l.f);
}

/** Rubro (grupo de producto) de un sabor del catálogo: mismo criterio que el
 *  cliente (grupoProductoDe): Baldes por tipo "b", el resto por familia. */
function _grupoProducto(sab) {
  if (String(sab.tipo || "") === "b") return "baldes";
  const f = String(sab.familia || "vasquetas");
  if (f === "icepops" || f === "chocolateria" || f === "glutenfree") return f;
  return "vasquetas";
}
/** Lista de rubros de Locales.produccion_rubros ("vasquetas,baldes"); [] = todos. */
function _rubrosProduccion(valor) {
  const validos = ["vasquetas", "baldes", "icepops", "chocolateria", "glutenfree"];
  return String(valor || "").split(",").map((x) => x.trim().toLowerCase()).filter((x) => validos.indexOf(x) !== -1);
}

/** Código de fábrica del rótulo (4 dígitos, ej. "1397"): la planilla puede
 *  guardarlo como número y perder el cero inicial ("0024" -> 24), así que se
 *  rellena a 4. Vacío si no hay. */
function _codigoFabrica(valor) {
  const t = String(valor === undefined || valor === null ? "" : valor).replace(/[^0-9]/g, "");
  return t ? ("0000" + t).slice(-4) : "";
}

/** Pesos por vasqueta de una salida: { idSabor: [kg, kg, ...] }. Cada peso entre
 *  0 y 30 kg (se redondea a 2 decimales) y no puede haber más pesos que unidades
 *  del sabor en la salida. */
function _normalizarPesos(pesos, items) {
  const out = {};
  if (!pesos || typeof pesos !== "object") return { ok: true, pesos: out };
  const ids = Object.keys(pesos);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const lista = Array.isArray(pesos[id]) ? pesos[id] : [];
    const limpios = [];
    for (let j = 0; j < lista.length; j++) {
      const k = Math.round(Number(lista[j]) * 100) / 100;
      if (!(k > 0 && k <= 30)) return { ok: false, error: "Peso de vasqueta inválido." };
      limpios.push(k);
    }
    if (!limpios.length) continue;
    if (limpios.length > (Number((items || {})[id]) || 0)) return { ok: false, error: "Hay más pesos que vasquetas en la salida." };
    out[id] = limpios;
  }
  return { ok: true, pesos: out };
}

function registrar(clienteId, tipo, local, items, remito, empleado, fotoRemito, subtipo, motivo, kilos, vencimientos, pesos, fecha) {
  if (tipo !== "salida" && tipo !== "ingreso") return { ok: false, error: "Tipo de movimiento inválido." };
  if (!local) return { ok: false, error: "Falta el local." };
  if (!_puedeVerLocal(empleado, local)) return { ok: false, error: "No tenés acceso a ese local." };
  if (!items || !Object.keys(items).length) return { ok: false, error: "No hay sabores cargados." };
  // Chocolatería (familia "chocolateria"): en un ingreso normal (no devolución
  // ni producción) cada producto trae su vencimiento. Se valida acá, no solo en
  // el cliente.
  const catalogoVenc = _leerCrudo("Sabores");
  const nombreVenc = {}, familiaVenc = {}, categoriaVenc = {};
  catalogoVenc.forEach((sab) => { nombreVenc[String(sab.id)] = sab.nombre; familiaVenc[String(sab.id)] = sab.familia || "vasquetas"; categoriaVenc[String(sab.id)] = sab.categoria || ""; });
  const norm = _normalizarVencimientos(vencimientos, items, tipo);
  if (!norm.ok) return norm;
  const vencimientos2 = norm.vencimientos;
  // Pesos por vasqueta (escaneo del rótulo de fábrica o kilos a mano): en una Salida o un
  // Desperdicio (merma) de un local con Locales.escaner_peso=SI (piloto).
  const normPesos = _normalizarPesos(pesos, items);
  if (!normPesos.ok) return normPesos;
  const pesos2 = normPesos.pesos;
  if (Object.keys(pesos2).length) {
    const filaLocalPeso = _leerCrudo("Locales").filter((l) => String(l.nombre || "").trim() === String(local).trim())[0];
    if (!filaLocalPeso || _esVerdadero(filaLocalPeso.escaner_peso) !== true) return { ok: false, error: "Este local no tiene el escáner de peso activado." };
    if (tipo !== "salida" || (subtipo && subtipo !== "desperdicio")) return { ok: false, error: "El peso por vasqueta solo se carga en una salida o un desperdicio." };
  }
  if (subtipo === "devolucion" && tipo !== "ingreso") return { ok: false, error: "Subtipo de movimiento inválido." };
  if (subtipo === "desperdicio" && tipo !== "salida") return { ok: false, error: "Subtipo de movimiento inválido." };
  if (subtipo === "produccion" && tipo !== "ingreso") return { ok: false, error: "Subtipo de movimiento inválido." };
  // En un local con «Venta del día» la chocolatería no se saca con una salida común: se
  // descuenta al cierre con la venta del día (Desperdicio sí puede sacarla).
  if (tipo === "salida" && !subtipo) {
    const filaLocalSalida = _leerCrudo("Locales").filter((l) => String(l.nombre || "").trim() === String(local).trim())[0];
    if (filaLocalSalida && _esVerdadero(filaLocalSalida.venta_dia) === true) {
      const choco = Object.keys(items).filter((id) => familiaVenc[String(id)] === "chocolateria");
      if (choco.length) return { ok: false, error: "La chocolatería de este local se descuenta con la «Venta del día», no con una salida común." };
    }
  }
  // Salidas de chocolatería de un local con Locales.venta_dia=SI: todas pasan por el
  // sistema, cada una con su tipo. «venta» = lo que dice la caja al cerrar; «giftcard»,
  // «sincargo» (regalo, evento, muestra: lleva motivo), «baja» (por vencimiento) y
  // «transferencia» (a otro local: lleva el destino en el motivo).
  const SUBTIPOS_CHOCO = ["venta", "giftcard", "sincargo", "baja", "transferencia"];
  // «transferencia» también existe como ingreso: es la mercadería que recibe (o le prestan) a este local.
  const esTransfIngreso = subtipo === "transferencia" && tipo === "ingreso";
  const esSalidaChoco = SUBTIPOS_CHOCO.indexOf(subtipo) !== -1 && !esTransfIngreso;
  if (esSalidaChoco && tipo !== "salida") return { ok: false, error: "Subtipo de movimiento inválido." };
  if (esTransfIngreso) {
    const filaLocalTr = _leerCrudo("Locales").filter((l) => String(l.nombre || "").trim() === String(local).trim())[0];
    if (!filaLocalTr || _esVerdadero(filaLocalTr.venta_dia) !== true) return { ok: false, error: "Este local no tiene las transferencias activadas." };
    if (empleado.rol === "colaborador") return { ok: false, error: "Esta carga la hace un responsable." };
    if (!String(motivo || "").trim()) return { ok: false, error: "Falta el local de origen de la transferencia." };
  }
  if (subtipo && ["devolucion", "desperdicio", "produccion"].concat(SUBTIPOS_CHOCO).indexOf(subtipo) === -1) return { ok: false, error: "Subtipo de movimiento inválido." };
  // Solo en un local con Locales.venta_dia=SI, solo productos de chocolatería y no
  // los carga el colaborador (el que mira la caja es el responsable). La fecha solo
  // vale para la venta y la gift card (para el día que se olvidaron de cargarlas): hasta 7 días atrás.
  let tsVenta = 0;
  if (fecha && subtipo !== "venta" && subtipo !== "giftcard") return { ok: false, error: "La fecha solo se usa en la venta del día y en la gift card." };
  if (esSalidaChoco) {
    const filaLocalVenta = _leerCrudo("Locales").filter((l) => String(l.nombre || "").trim() === String(local).trim())[0];
    if (!filaLocalVenta || _esVerdadero(filaLocalVenta.venta_dia) !== true) return { ok: false, error: "Este local no tiene la salida de chocolatería activada." };
    if (empleado.rol === "colaborador") return { ok: false, error: "Esta salida la carga un responsable." };
    const noChoco = Object.keys(items).filter((id) => familiaVenc[String(id)] !== "chocolateria");
    if (noChoco.length) return { ok: false, error: "Esta salida es solo de chocolatería." };
    if ((subtipo === "sincargo" || subtipo === "transferencia") && !String(motivo || "").trim()) return { ok: false, error: subtipo === "transferencia" ? "Falta el local de destino de la transferencia." : "Falta el motivo de la salida sin cargo." };
    if (fecha) {
      const tz = "America/Argentina/Buenos_Aires";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) return { ok: false, error: "Fecha inválida." };
      const hoyBA = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
      const haceUnaSemana = Utilities.formatDate(new Date(Date.now() - 7 * 24 * 3600 * 1000), tz, "yyyy-MM-dd");
      if (String(fecha) > hoyBA) return { ok: false, error: "La fecha no puede ser futura." };
      if (String(fecha) < haceUnaSemana) return { ok: false, error: "La fecha no puede ser de hace más de 7 días." };
      tsVenta = Math.min(Date.now(), Utilities.parseDate(fecha + " 23:30", tz, "yyyy-MM-dd HH:mm").getTime());
    }
  }
  if (subtipo === "produccion") {
    const filaLocalProd = _leerCrudo("Locales").filter((l) => String(l.nombre) === String(local))[0];
    if (!filaLocalProd || _esVerdadero(filaLocalProd.produccion) !== true) {
      return { ok: false, error: "Este local no tiene Producción activada." };
    }
    // Solo los rubros que este local fabrica (si no se cargó ninguno, vale todo).
    const rubrosOk = _rubrosProduccion(filaLocalProd.produccion_rubros);
    if (rubrosOk.length) {
      const porId = {};
      catalogoVenc.forEach((sab) => { porId[String(sab.id)] = sab; });
      const fuera = Object.keys(items).filter((id) => porId[String(id)] && rubrosOk.indexOf(_grupoProducto(porId[String(id)])) === -1);
      if (fuera.length) {
        return { ok: false, error: "Este local no produce: " + fuera.map((id) => porId[String(id)].nombre).join(", ") + "." };
      }
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
    const ts = tsVenta || Date.now();
    if (tsVenta) {
      // Un conteo posterior ya incluye esa venta: cargarla de nuevo descontaría dos veces.
      const stockVenta = _datosSinCache(local).stock;
      const bts2 = stockVenta ? stockVenta.ts : 0;
      if (ts <= bts2) return { ok: false, error: "Esa fecha es anterior al último conteo físico: el conteo ya incluye ese movimiento." };
    }
    const r = _escribirCrudo("Registros", {
      clienteId: clienteId || "", tipo: tipo, local: local, empleadoId: empleado.id, empleado: empleado.nombre,
      items: JSON.stringify(items2), total: total, remito: remito || "", ts: ts,
      anulado_por: "", anulado_ts: "", motivo: motivo || "", foto_remito: fotoRemito || "", subtipo: subtipo || "",
      kilos: Object.keys(kilos2).length ? JSON.stringify(kilos2) : "",
      vencimientos: Object.keys(vencimientos2).length ? JSON.stringify(vencimientos2) : "",
      pesos: Object.keys(pesos2).length ? JSON.stringify(pesos2) : "",
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
  // Chocolatería: sin este bloque la IA no tiene ids para elegir en esas secciones.
  const porCategoriaChoco = {};
  sabores.filter((s) => s.familia === "chocolateria").forEach((s) => { const c = s.categoria || "Otros"; (porCategoriaChoco[c] = porCategoriaChoco[c] || []).push(s); });
  txt += "\n\nCHOCOLATERÍA (alfajores, conitos, tabletas, avellas, latas, squares), agrupado por categoría:\n";
  Object.keys(porCategoriaChoco).forEach((c) => { txt += "\n" + c + ":\n" + porCategoriaChoco[c].map(linea).join("\n"); });
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

  const prompt = "Esta es la foto de un remito de productos Lucciano's. Quiero SOLO los renglones que están bajo alguno de estos encabezados de sección: \"SABORES\", \"SIN GLUTEN\", cualquiera que empiece con \"ICE POPS\" (incluye ICE POPS FRUTALES, ICE POPS BAÑADOS, ICE POPS SIN BAÑAR, ICE POPS LUXURY, ICE POPS MINI) y \"CANNOLIS\", \"CHOCOLATES\", \"ALFAJORES\", \"CONITOS\", \"SQUARES\" y \"ENVASADO EN FRASCO\" (solo los renglones de AVELLA) y los renglones \"LATA CARRUSEL\" aunque estén bajo \"ENVASES Y PACKAGING\". También incluí cualquier sección de Mini Icepops aunque tenga un nombre promocional distinto (ej. un tie-in con una película o un evento, como \"MI VILLANO FAVORITO\") — se reconoce porque aparece en el mismo lugar que ICE POPS MINI (después de ICE POPS LUXURY, antes de CANNOLIS) y tiene el mismo formato de columnas. Ignorá todo el resto: Geladot's, Pastelería, Envases y Packaging (salvo las LATA CARRUSEL), Utensillos, Varios, Envasado en Frasco (salvo las AVELLA), Cafés, Salsas y Variegatos, Insumos, \\\"BALDES Y VASQUETAS\\\" (esa sección son envases vacíos, no sabores), Bienes de Uso, y cualquier otra sección que no sea claramente una de las listadas arriba.\n\nDENTRO de la sección \\\"SABORES\\\", algunos renglones vienen agrupados bajo un sub-encabezado \\\"BALDES\\\" (o el nombre del renglón arranca con \\\"BALDES -\\\" y/o termina en \\\"- BALDE\\\") — es el mismo sabor que una vasqueta pero vendido en formato balde. Esos renglones los tenés que matchear contra el bloque \\\"BALDES\\\" del catálogo de abajo, NUNCA contra \\\"SABORES (vasquetas)\\\" aunque el nombre sea parecido o igual al de una vasqueta — son productos de catálogo distintos.\n\nMás abajo te paso el catálogo completo de sabores que tenemos cargados, con su ID. Para cada renglón de esas secciones:\n- Id: elegí, del catálogo de abajo, el sabor que corresponda a ese renglón, y poné su ID tal cual. Usá criterio: el nombre en el remito puede venir abreviado, con errores de tipeo, en otro orden, con palabras de más o de menos, o nombrado distinto a como está en el catálogo (ej. el remito puede decir \"Sorbete Dark 72%\" para lo que el catálogo tiene como \"Vegan 72%\", o \"Luxury Jameson Negro\" para \"Jameson Icepop\") — el objetivo es identificar el PRODUCTO real, no encontrar coincidencia exacta de texto. Prestá mucha atención a en qué sección del remito está el renglón: varios sabores se llaman igual en categorías distintas del catálogo (ej. \"Pistacchio\" existe como vasqueta, como Icepop Luxury y como Cannoli — son cajas y productos distintos) y el catálogo te muestra la categoría de cada uno para que elijas el que corresponde a la sección donde estás leyendo. Si de verdad no hay ningún sabor del catálogo que corresponda (por ejemplo un producto nuevo o de edición limitada que todavía no cargamos), dejá el id vacío — no inventes ni fuerces un match que no corresponde. EXCEPCIÓN para CHOCOLATES, ALFAJORES, CONITOS, SQUARES, AVELLA y LATA CARRUSEL: si el producto no está en el catálogo de CHOCOLATERÍA, NO lo transcribas (omitilo del JSON). Equivalencias confirmadas (nombre en el remito = producto del catálogo): ALFAJOR DE NUEZ = Alfajor Blanco & Nuez; ALFAJOR DE CHOCOLATE BLANCO = Alfajor Blanco; ALFAJOR DE CHOCOLATE SEMIAMARGO = Alfajor Semiamargo; ALFAJOR DE PISTACCHIO = Alfajor Pistacchio; ALFAJOR DARK = Alfajor Dark; ALFAJOR PINK = Alfajor Frutos Rojos; CONITO PINK = Conito Frutos Rojos; CONITO DE PISTACCHIO = Conito Pistacchio; CHOCOLATE DARK = Chocolate Dark 70%; CHOCOLATE CON LECHE CON DDL = Chocolate con Leche con Dulce de Leche; CHOCOLATE SEMIAMARGO CON AVELLANAS ENTERAS = Chocolate 54% con Avellanas; CHOCOLATE SEMIAMARGO DUBAI = Tableta Dubai Semiamargo; CHOCOLATE CON LECHE DUBAI = Tableta Dubai con Leche; CHOCOLATE PISTACCHIO DUBAI = Tableta Dubai Pistacchio; LATA CARRUSEL ROJA = Lata Carrusel Bordó (Clásica); LATA CARRUSEL CLÁSICA = Lata Carrusel Bordó (Clásica); LATA CARRUSEL NEGRA = Lata Carrusel Negra (Dark); LATA CARRUSEL DARK = Lata Carrusel Negra (Dark); LATA CARRUSEL VERDE = Lata Carrusel Verde (Pistacho).\n- Nombre: igual escribí el nombre del renglón tal cual lo ves en la foto (incluso si encontraste el id) — lo necesitamos para poder revisar a mano los que no matcheen.\n- Bultos: el número de la columna \"Cantidad/Bultos\" (la de más a la izquierda), tal cual aparece escrito. NO mires la columna \"Kg/Unidad\" ni hagas ninguna cuenta ni multiplicación — nosotros ya sabemos cuánto trae cada caja cerrada de cada sabor, vos solo transcribí el número de bultos tal cual está.\n\nOJO con renglones consecutivos que arrancan con la misma palabra pero son productos distintos (ej. \\\"Oli Chocolate Platino\\\", \\\"Oli Dolca\\\" y \\\"Oli King\\\" son 3 sabores distintos del catálogo que a veces aparecen uno debajo del otro) — leé el nombre COMPLETO de cada renglón por separado, nunca asumas que dos renglones parecidos son el mismo producto, y nunca repitas o copies el número de bultos de un renglón vecino: cada renglón tiene su propio número en su propia fila, aunque el nombre se vea casi igual al de arriba o abajo.\n\nTambién fijate si se ve el número de remito y la fecha. Al pie del remito, en el recuadro \"Bultos:\", suele haber un resumen tipo \"Palitos=80 Sabores=397 Baldes=5 Pastelería=103 Chocolates=...\" — Sabores y Baldes son los totales de bultos que declaró la fábrica para cada uno, para controlar que no se perdió ningún renglón (el de Palitos no lo necesitamos — esa parte del recuadro no es confiable, no la uses para nada). Buscá ese recuadro y decime los números de \"Sabores\" y de \"Baldes\" tal cual figuran ahí — si no se ve ese recuadro o no tiene alguno de esos campos, dejalo vacío, no inventes un número.\n\nContestá ÚNICAMENTE con este JSON, sin texto alrededor:\n{\"remito\":\"<número o vacío>\",\"fecha\":\"<DD/MM/AAAA o vacío>\",\"bultosDeclaradosSabores\":<número entero del recuadro \\\"Bultos:\\\" junto a \\\"Sabores\\\", o vacío>,\"bultosDeclaradosBaldes\":<número entero del recuadro \\\"Bultos:\\\" junto a \\\"Baldes\\\", o vacío>,\"items\":[{\"id\":\"<id del catálogo, o vacío si ninguno corresponde>\",\"nombre\":\"<nombre tal cual aparece en el remito>\",\"bultos\":<número entero tal cual aparece en \\\"Cantidad/Bultos\\\", sin multiplicar>}]}\n\nCATÁLOGO:\n" + _catalogoParaPrompt(sabores);

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

/** Reetiquetado: le pone vencimiento a chocolatería que está en cámara sin fecha
 *  (típicamente alfajores y conitos, que se etiquetan a mano después). No cambia
 *  el stock: se guarda como movimiento tipo "etiquetado" (stockMap() lo ignora)
 *  y los lotes del cliente lo leen para asignar la fecha. Responsable de local
 *  y de turno, y también admin y supervisor en casos urgentes — nunca
 *  colaborador ni producción. */
function etiquetar(clienteId, local, items, vencimientos, empleado) {
  if (["admin", "supervisor", "encargado", "turno"].indexOf(empleado.rol) === -1) return { ok: false, error: "Solo el responsable de local o de turno puede poner vencimientos." };
  if (!local) return { ok: false, error: "Falta el local." };
  if (!_puedeVerLocal(empleado, local)) return { ok: false, error: "No tenés acceso a ese local." };
  if (!items || !Object.keys(items).length) return { ok: false, error: "No hay productos para etiquetar." };

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    if (clienteId) {
      const existente = _leerUltimasFilas("Registros", 500).filter((r) => r.clienteId && String(r.clienteId) === String(clienteId))[0];
      if (existente) return { ok: true, id: existente.id, repetido: true };
    }
    const items2 = {};
    Object.keys(items).forEach((id) => { const q = Math.floor(Number(items[id]) || 0); if (q > 0) items2[id] = q; });
    const catalogo = _leerCrudo("Sabores");
    const familiaDe = {}, nombreDe = {}, categoriaDe = {};
    catalogo.forEach((s) => { familiaDe[String(s.id)] = s.familia || ""; nombreDe[String(s.id)] = s.nombre; categoriaDe[String(s.id)] = s.categoria || ""; });
    if (Object.keys(items2).some((id) => familiaDe[id] !== "chocolateria")) return { ok: false, error: "Solo se pone vencimiento a chocolatería." };
    if (Object.keys(items2).some((id) => categoriaDe[id] === "Latas")) return { ok: false, error: "Las latas carrusel no llevan vencimiento." };

    const norm = _normalizarVencimientos(vencimientos, items2, "etiquetado");
    if (!norm.ok) return norm;
    if (Object.keys(items2).some((id) => _vencFaltante(norm.vencimientos[id]))) return { ok: false, error: "Falta la fecha de vencimiento." };

    // No etiquetar más unidades que las que hay en cámara (red de seguridad;
    // la cantidad exacta sin fecha la valida la pantalla con los lotes).
    const infoLocal = _datosSinCache(local);
    const stockActual = Object.assign({}, infoLocal.stock ? infoLocal.stock.base : {});
    const bts = infoLocal.stock ? infoLocal.stock.ts : 0;
    infoLocal.registros.forEach((rg) => {
      if (rg.anulado || rg.ts <= bts) return;
      const signo = rg.tipo === "ingreso" ? 1 : rg.tipo === "salida" ? -1 : 0;
      if (!signo) return;
      Object.keys(rg.items || {}).forEach((id) => { stockActual[id] = (Number(stockActual[id]) || 0) + signo * (Number(rg.items[id]) || 0); });
    });
    const excede = Object.keys(items2).filter((id) => items2[id] > (Number(stockActual[id]) || 0)).map((id) => nombreDe[id] || ("Sabor " + id));
    if (excede.length) return { ok: false, error: "Hay más unidades de las que tenés en cámara de: " + excede.join(", ") + "." };

    const ts = Date.now();
    const r = _escribirCrudo("Registros", {
      clienteId: clienteId || "", tipo: "etiquetado", local: local, empleadoId: empleado.id, empleado: empleado.nombre,
      items: JSON.stringify(items2), total: _totalItems(items2), remito: "", ts: ts, anulado_por: "", anulado_ts: "", motivo: "",
      foto_remito: "", subtipo: "", kilos: "", vencimientos: JSON.stringify(norm.vencimientos),
    });
    const detalle = Object.keys(items2).map((id) => (nombreDe[id] || ("Sabor " + id)) + " x" + items2[id] + " → " + norm.vencimientos[id].map((l) => l.f + " (" + l.c + ")").join(" + ")).join("; ");
    _auditar("etiquetar", empleado.id, empleado.nombre, local + ": " + detalle);
    _invalidarCacheDatos(local);
    return { ok: true, id: r.id, ts: ts };
  } finally {
    lock.releaseLock();
  }
}

function conteo(clienteId, local, items, empleado, vencimientos) {
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
    // Chocolatería: vencimiento según categoría (alfajores y conitos son opcionales, el resto lo pide)
    const catalogoConteo = _leerCrudo("Sabores");
    const nombreConteo = {}, familiaConteo = {}, categoriaConteo = {};
    catalogoConteo.forEach((sab) => { nombreConteo[String(sab.id)] = sab.nombre; familiaConteo[String(sab.id)] = sab.familia || ""; categoriaConteo[String(sab.id)] = sab.categoria || ""; });
    const norm = _normalizarVencimientos(vencimientos, items2, "conteo");
    if (!norm.ok) return norm;
    const vencimientos2 = norm.vencimientos;
    const total = _totalItems(items2);
    const ts = Date.now();

    _escribirCrudo("Registros", {
      clienteId: clienteId || "", tipo: "conteo", local: local, empleadoId: empleado.id, empleado: empleado.nombre,
      items: JSON.stringify(items2), total: total, remito: "", ts: ts, anulado_por: "", anulado_ts: "", motivo: "",
      vencimientos: Object.keys(vencimientos2).length ? JSON.stringify(vencimientos2) : "",
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
    if (tipoReg === "salida" && !subtipoReg) {
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
  else if (empleado.rol === "encargado" && (objetivo.rol === "colaborador" || objetivo.rol === "turno" || objetivo.rol === "produccion") && String(objetivo.local || "").trim() === String(empleado.local || "").trim()) permitido = true;
  else if (empleado.rol === "encargado" && String(objetivo.id) === String(empleado.id)) permitido = true; // su propio PIN
  if (!permitido) return { ok: false, error: empleado.rol === "encargado" ? "Un responsable de local solo puede resetear su propio PIN y el de turno, colaboradores y producción de su local. Para el PIN de otro responsable, pedíselo a un supervisor o admin." : "No tenés permiso para resetear el PIN de ese empleado." };

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

/** Cambia el mínimo de muchos sabores en una sola llamada (un rubro
 *  entero, o el mínimo por defecto de cada tipo). Solo admin. Escribe la
 *  columna "minimo" en una sola pasada, sin reemplazar el resto del sabor.
 *  cambios: [{id, minimo}] — el valor va por sabor, así sirve tanto para
 *  "todo el rubro en 6" como para "cada uno a su default". */
function minimoMasivo(cambios, detalle, empleado) {
  if (empleado.rol !== "admin") return { ok: false, error: "Solo un administrador puede cambiar los mínimos." };
  if (!Array.isArray(cambios) || cambios.length === 0) return { ok: false, error: "No hay sabores para cambiar." };
  if (cambios.length > 1000) return { ok: false, error: "Demasiados sabores en un solo cambio." };
  const porId = {};
  for (let k = 0; k < cambios.length; k++) {
    const c = cambios[k];
    const m = Number(c && c.minimo);
    if (!c || !c.id || !isFinite(m) || m < 0 || Math.floor(m) !== m) return { ok: false, error: "Mínimo inválido." };
    porId[String(c.id)] = m;
  }
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const sheet = _sheet("Sabores");
    const datos = sheet.getDataRange().getValues();
    const headers = datos[0];
    const colId = headers.indexOf("id");
    const colMin = headers.indexOf("minimo");
    if (colId === -1 || colMin === -1) return { ok: false, error: "Faltan columnas id/minimo en Sabores." };
    let actualizados = 0;
    for (let i = 1; i < datos.length; i++) {
      const clave = String(datos[i][colId]);
      if (!porId.hasOwnProperty(clave)) continue;
      _escribirCeldaSinAdivinar(sheet.getRange(i + 1, colMin + 1), _sanitizarCelda(porId[clave]));
      actualizados++;
    }
    _auditar("minimo_masivo", empleado.id, empleado.nombre, actualizados + " sabores" + (detalle ? " (" + detalle + ")" : ""));
    return { ok: true, actualizados: actualizados };
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
 *  adminSabor/adminLocal, esto NO es solo-admin: lo puede ajustar el
 *  responsable de ese local y un admin parado DENTRO de ese local (pedido
 *  de Gabi 20/10/2026). Supervisor no. Admin desde Operaciones no (ahí no
 *  hay local elegido). Guarda en Locales.sabores_excluidos
 *  (ids separados por coma); si esa columna todavía no existe en la
 *  hoja, avisa en vez de fallar silencioso. */
function toggleSaborLocal(saborId, local, empleado) {
  if (!saborId) return { ok: false, error: "Falta el sabor." };
  if (!local) return { ok: false, error: "Falta el local." };
  const esResponsableDeEse = empleado.rol === "encargado" && String(empleado.local || "").trim() === String(local).trim();
  if (!esResponsableDeEse && empleado.rol !== "admin") {
    return { ok: false, error: "Solo el responsable de ese local o un admin dentro de ese local puede ajustar esto." };
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
    const colOperaciones = headers.indexOf("operaciones");
    if (colOperaciones !== -1 && _esVerdadero(filas[idx][colOperaciones]) === true) {
      return { ok: false, error: "Operaciones no tiene sabores por local." };
    }
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
