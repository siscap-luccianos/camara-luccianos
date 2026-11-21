// Code.gs 1.105.0: grupos de locales para pedir conteos, por supervisor; el admin ve todos.
const vm = require("vm"), fs = require("fs");
const sb = { console, Date, Math, JSON, String, Number, Array, Object, isFinite,
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  SpreadsheetApp: { flush() {} }, LockService: { getScriptLock: () => ({ tryLock() { return true }, releaseLock() {} }) },
  Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 10) } };
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname, "..", "..", "..", "apps-script/Code.gs"), "utf8"), sb);
let filas = [];
sb._hojaGruposConteo = () => ({});
sb._leerCrudo = h => h === "GruposConteo" ? filas : [];
sb._escribirCrudo = (h, o) => { const f = Object.assign({}, o, { id: String(filas.length + 1) }); filas.push(f); return { id: f.id } };
sb._actualizarCrudo = (h, id, c) => { filas.filter(q => q.id === id).forEach(q => Object.assign(q, c)); return { ok: true } };
sb._sheet = () => ({ getDataRange: () => ({ getValues: () => [["id"]].concat(filas.map(f => [f.id])) }), deleteRow: i => { filas.splice(i - 2, 1) } });
const run = c => vm.runInContext(c, sb);
let f = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) f++ };
sb.admin = { id: "1", nombre: "Gabi", rol: "admin" }; sb.s1 = { id: "2", nombre: "Laura", rol: "supervisor" }; sb.s2 = { id: "3", nombre: "Marina", rol: "supervisor" }; sb.enc = { id: "4", nombre: "E", rol: "encargado" };
ok(!run(`guardarGrupoConteo("X",["A"],enc)`).ok, "un encargado no puede");
ok(run(`guardarGrupoConteo("CABA",["A","B","A"],s1)`).ok, "supervisor guarda un grupo");
ok(run(`guardarGrupoConteo("caba",["A","B","C"],s1)`).ok && filas.length === 1, "mismo nombre lo actualiza, no duplica");
run(`guardarGrupoConteo("Norte",["Z"],s2)`); run(`guardarGrupoConteo("__ultimo__",["A"],s1)`);
let r = run(`gruposConteo(s1)`);
ok(r.grupos.length === 1 && r.grupos[0].locales.length === 3 && r.ultimo.join() === "A", "el supervisor ve solo el suyo y su último grupo");
r = run(`gruposConteo(admin)`);
ok(r.grupos.length === 2 && r.grupos.some(g => g.owner === "Marina" && !g.propio), "el admin ve los de todos, con su dueño");
run(`guardarGrupoConteo("Mío",["Q"],admin)`);
ok(run(`gruposConteo(admin)`).grupos.some(g => g.propio && g.nombre === "Mío"), "el admin también arma los suyos");
ok(!run(`borrarGrupoConteo("${filas.find(g => g.nombre === "Norte").id}",s1)`).ok, "un supervisor no borra el de otro");
ok(run(`borrarGrupoConteo("${filas.find(g => g.nombre === "Norte").id}",admin)`).ok && !filas.some(g => g.nombre === "Norte"), "el admin sí puede borrar");
console.log("FALLAS " + f); process.exit(f ? 1 : 0);
