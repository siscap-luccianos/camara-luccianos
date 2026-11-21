// Code.gs 1.107.0: la corrección de un admin no deja marca visible (solo Auditoría); la de un supervisor sí deja «corregido por» y el original.
const vm = require("vm"), fs = require("fs");
const sb = { console, Date, Math, JSON, String, Number, Array, Object, isFinite,
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  SpreadsheetApp: { flush() {} }, LockService: { getScriptLock: () => ({ tryLock() { return true }, releaseLock() {} }) },
  Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 10) } };
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname, "..", "..", "..", "apps-script/Code.gs"), "utf8"), sb);
const locales = [{ nombre: "Galerías", operaciones: "NO", activo: "SI" }];
const sabores = [{ id: "4", nombre: "Banana Split", tipo: "v", familia: "vasquetas", peso: "3,5" }];
let inv = [{ id: "1", local: "Galerías", tipo: "inicial", ts: Date.now() - 1e6, empleado: "Laura", items: JSON.stringify({ "4": 5 }), camara: "{}", cambios: "[]", desbloqueado_hasta: Date.now() + 1e6 }], audit = [], upd = [];
sb._hojaInventarios = () => ({});
sb._leerCrudo = h => h === "Locales" ? locales : h === "Sabores" ? sabores : h === "Inventarios" ? inv : [];
sb._actualizarCrudo = (h, id, c) => { upd.push(c); Object.assign(inv.find(x => x.id === id), c); return { ok: true } };
sb._auditar = (...a) => audit.push(a); sb._invalidarCacheDatos = () => {}; sb._puedeVerLocal = () => true;
sb._invPermiso = () => null; sb._invVerValor = () => false;
const run = c => vm.runInContext(c, sb);
let f = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) f++ };
sb.admin = { id: "1", nombre: "Gabi", rol: "admin" }; sb.sup = { id: "2", nombre: "Fabricio", rol: "supervisor" };
let r = run(`corregirInventario("Galerías","1","4",3,"error de carga",admin)`);
ok(r.ok, "el admin corrige: " + (r.error || ""));
ok(JSON.parse(inv[0].cambios).length === 0 && !inv[0].items_original, "sin «corregido por» y sin el original a la vista");
ok(audit.some(a => a[0] === "corregir_inventario" && /5 → 3/.test(a[3])), "pero queda en Auditoría con antes y después");
inv[0].desbloqueado_hasta = Date.now() + 1e6;
r = run(`corregirInventario("Galerías","1","4",2,"recuento",sup)`);
ok(r.ok && JSON.parse(inv[0].cambios).length === 1 && JSON.parse(inv[0].cambios)[0].q === "Fabricio" && !!inv[0].items_original, "la corrección del supervisor sí deja quién la hizo y el original");
console.log("FALLAS " + f); process.exit(f ? 1 : 0);
