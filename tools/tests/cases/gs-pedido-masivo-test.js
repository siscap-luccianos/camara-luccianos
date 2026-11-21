// Code.gs 1.104.0: pedido y cancelación de conteos en masa (un candado, una auditoría).
const vm = require("vm"), fs = require("fs");
let locks = 0;
const sb = { console, Date, Math, JSON, String, Number, Array, Object, isFinite,
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  SpreadsheetApp: { flush() {} }, LockService: { getScriptLock: () => ({ tryLock() { locks++; return true }, releaseLock() {} }) },
  Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 10) } };
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname, "..", "..", "..", "apps-script/Code.gs"), "utf8"), sb);
const locales = [{ nombre: "A", activo: "SI" }, { nombre: "B", activo: "SI" }, { nombre: "C", activo: "SI" }, { nombre: "Operaciones", operaciones: "SI" }];
let pedidos = [{ id: "1", local: "B", estado: "pendiente", tipo: "final" }, { id: "2", local: "C", estado: "pendiente", tipo: "parcial" }], audit = [];
sb._hojaPedidosConteo = () => ({});
sb._leerCrudo = h => h === "Locales" ? locales : h === "PedidosConteo" ? pedidos : [];
sb._escribirCrudo = (h, o) => { const f = Object.assign({}, o, { id: String(100 + pedidos.length) }); pedidos.push(f); return { id: f.id } };
sb._actualizarCrudo = (h, id, c) => { pedidos.filter(q => q.id === id).forEach(q => Object.assign(q, c)); return { ok: true } };
sb._auditar = (...a) => audit.push(a);
const run = c => vm.runInContext(c, sb);
let f = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) f++ };
sb.sup = { id: "9", nombre: "Super", rol: "supervisor" }; sb.enc = { id: "8", nombre: "Enc", rol: "encargado" };
ok(!run(`pedirConteoMasivo(["A"],"parcial",enc)`).ok, "un encargado no puede pedir");
let r = run(`pedirConteoMasivo(["A","B","C","Operaciones","Nope","A"],"parcial",sup)`);
ok(r.ok && r.pedidos === 1, "pide solo a A: " + JSON.stringify(r));
ok(r.repetidos.join() === "C", "C ya tenía uno parcial");
ok(r.errores.length === 3 && r.errores.some(e => e.local === "B"), "B (cierre pendiente), Operaciones y Nope dan error");
ok(audit.length === 1, "una sola fila de auditoría: " + audit.length);
r = run(`cancelarPedidosMasivo(["A","B"],sup)`);
ok(r.ok && r.cancelados === 2 && audit.length === 2, "cancela A y B con una auditoría más");
ok(pedidos.filter(q => q.estado === "pendiente").map(q => q.local).join() === "C", "queda pendiente solo C");
ok(!run(`pedirConteoMasivo([],"parcial",sup)`).ok, "lista vacía rechazada");
console.log("FALLAS " + f); process.exit(f ? 1 : 0);
