#!/usr/bin/env node
// Corre las pruebas de LogiStock: node tools/tests/run.js [filtro] [--lista]
//  - cases/gs-*.js     prueban Code.gs en Node con un simulador de Apps Script (sin navegador)
//  - cases/*.js resto   prueban index.html con Playwright contra un servidor simulado (mocks/mock-<puerto>.js)
//  Cada prueba de navegador usa el puerto que escribe en su URL (localhost:89xx); se levanta un servidor
//  nuevo por prueba para que no arrastren datos entre sí. Las capturas/PDF van a una carpeta temporal.
const fs = require("fs"), os = require("os"), path = require("path");
const { spawn, spawnSync } = require("child_process");
const dir = __dirname, cases = path.join(dir, "cases");
const args = process.argv.slice(2), filtro = args.find(a => !a.startsWith("--"));
const todas = fs.readdirSync(cases).filter(f => f.endsWith(".js") && (!filtro || f.includes(filtro))).sort();
if (args.includes("--lista")) { console.log(todas.join("\n")); process.exit(0); }
const salida = fs.mkdtempSync(path.join(os.tmpdir(), "logistock-tests-"));
const esperar = ms => new Promise(r => setTimeout(r, ms));
const resultados = [];
function fallo(txt, code) { return code !== 0 || /^FALLA(?!S 0)/m.test(txt) || /FALLAS [1-9]/.test(txt) || /Error: |pageerror/i.test(txt) && /pageerror\s*[:=]\s*\[?["'{A-Za-z]/.test(txt); }
(async () => {
  for (const f of todas) {
    const ruta = path.join(cases, f), src = fs.readFileSync(ruta, "utf8");
    const puerto = (src.match(/localhost:(89\d\d)/) || [])[1];
    let srv = null;
    if (puerto) {
      const mock = path.join(dir, "mocks", "mock-" + puerto + ".js");
      if (!fs.existsSync(mock)) { resultados.push([f, "SALTADA", "no hay mocks/mock-" + puerto + ".js"]); continue; }
      srv = spawn("node", [mock], { stdio: "ignore" });
      await esperar(500);
    }
    const r = spawnSync("node", [ruta], { cwd: salida, encoding: "utf8", timeout: 180000 });
    if (srv) srv.kill();
    const txt = (r.stdout || "") + (r.stderr || "");
    const mal = fallo(txt, r.status);
    resultados.push([f, mal ? "FALLA" : "OK", mal ? txt.trim().split("\n").slice(-6).join("\n") : ""]);
    console.log((mal ? "FALLA " : "OK    ") + f);
    if (mal) console.log(resultados[resultados.length - 1][2].replace(/^/gm, "      "));
  }
  const n = s => resultados.filter(r => r[1] === s).length;
  console.log(`\n${n("OK")} OK · ${n("FALLA")} con fallas · ${n("SALTADA")} saltadas  (capturas en ${salida})`);
  process.exit(n("FALLA") ? 1 : 0);
})();
