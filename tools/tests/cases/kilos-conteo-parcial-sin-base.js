// Kilos reales: un conteo parcial con kilos fija los kilos del sabor aunque el último conteo completo no los tuviera (caso Recoleta 23/11/2026).
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "..", "..", "index.html"), "utf8");
const i = src.indexOf("function kilosMap(hasta){"), j = src.indexOf("return out;\n}", i) + "return out;\n}".length;
const fn = new Function("S", "regsActivos", "esVasquetaKilos", src.slice(i, j) + "\nreturn kilosMap;");
let f = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) f++ };
const mk = regs => { const S = { kilosReales: true, stock: { base: { "4": 10, "5": 6 }, ts: 1000 }, sabores: [{ id: "4" }, { id: "5" }] }; return fn(S, () => regs, () => true)(); };
const conteoViejo = { id: "1", tipo: "conteo", ts: 1000, items: { "4": 10, "5": 6 }, kilos: {} };
// sin kilos en el conteo: «sin kilos cargados» (null)
let m = mk([conteoViejo]);
ok(m["4"] === null && m["5"] === null, "sin conteo parcial, los sabores del conteo viejo están «sin kilos cargados»");
// conteo parcial con kilos: ahora los toma
m = mk([conteoViejo, { id: "2", tipo: "cambio", subtipo: "conteo_parcial", ts: 2000, items: { "4": 2 }, kilos: { "4": 38.5 } }]);
ok(m["4"] === 38.5, "el conteo parcial fija los kilos de Banana Split (38,5 kg): " + m["4"]);
ok(m["5"] === null, "el sabor que no se contó con kilos sigue sin kilos cargados");
// después una salida con peso resta, y un ingreso con kilos suma
m = mk([conteoViejo, { id: "2", tipo: "cambio", subtipo: "conteo_parcial", ts: 2000, items: {}, kilos: { "4": 38.5 } },
  { id: "3", tipo: "salida", ts: 3000, items: { "4": 1 }, pesos: { "4": [3.5] } }, { id: "4", tipo: "ingreso", ts: 4000, items: { "4": 2 }, kilos: { "4": 7 } }]);
ok(m["4"] === 42, "después una salida de 3,5 kg y un ingreso de 7 kg dan 42 kg: " + m["4"]);
// un cambio de sabor (no es conteo parcial) NO inventa kilos donde no había
m = mk([conteoViejo, { id: "2", tipo: "cambio", subtipo: "cambio", ts: 2000, items: { "4": 1 }, kilos: { "4": 3.8 } }]);
ok(m["4"] === null, "un cambio de sabor no crea kilos donde no se conocían");
// conteo parcial que anula: no suma
console.log(f ? "FALLAS " + f : "FALLAS 0"); process.exit(f ? 1 : 0);
