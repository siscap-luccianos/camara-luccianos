// Conteo cámara: los números imposibles (7400 kg en 2 vasquetas) no dejan guardar y los raros piden confirmación; todo arranca en 0.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click("[data-tecla='" + d + "']"); }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1500);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    S.kilosReales = true; iniciarConteo(false, "todo");
    const arranca = Object.keys(S.conteo).every(id => S.conteo[id] === 0);
    // 2 vasquetas con 7400 kg
    S.conteo["4"] = 2; S.conteoTocado["4"] = true; S.kilosConteo["4"] = "7400";
    const a = conteoChequeo("4", 2);
    // 2 vasquetas con 16 kg (8 por vasqueta): raro, se confirma
    S.kilosConteo["4"] = "16"; const b2 = conteoChequeo("4", 2);
    // 2 vasquetas con 7,4 kg: normal
    S.kilosConteo["4"] = "7,4"; const c = conteoChequeo("4", 2);
    // una pesada de 350
    S.conteoPesos = { "4": ["3,5", "350"] }; const d = conteoChequeo("4", 2);
    S.conteoPesos = {}; S.kilosConteo["4"] = "7400";
    const res = conteoResumen();
    return { arranca, a, b2, c, d, bloq: res.bloqueos.length, flags: res.flags.length };
  });
  ok(r.arranca, "todo arranca en 0 (a ciegas)");
  ok(r.a && r.a.nivel === "bloq" && /7400/.test(r.a.msg), "2 vasquetas con 7400 kg: imposible, no deja guardar: " + (r.a && r.a.msg));
  ok(r.b2 && r.b2.nivel === "aviso", "8 kg por vasqueta: raro, hay que confirmarlo");
  ok(r.c === null, "7,4 kg en 2 vasquetas está bien");
  ok(r.d && r.d.nivel === "bloq", "una vasqueta de 350 kg: imposible");
  ok(r.bloq === 1, "el resumen cuenta 1 número imposible");
  // en la revisión: aviso rojo y «Revisar y guardar» no guarda
  await page.evaluate(() => { S.conteoRevisar = true; S.confirm = true; renderApp() });
  await page.waitForTimeout(300);
  const txt = (await page.innerText("#main")).replace(/\s+/g, " ");
  ok(/no pueden pesar 7400 kg/.test(txt) && /Corregilo/.test(txt) && !(await page.$("[data-cack='4']")), "la revisión lo marca con «Corregilo», sin botón «Está bien»");
  ok(await page.$eval("#ok", e => e.disabled), "«Guardar» queda apagado");
  // local sin kilos reales (ej. Marruecos): 7400 vasquetas en Banana Split
  const m = await page.evaluate(() => { S.kilosReales = false; iniciarConteo(false, "todo"); S.conteo["4"] = 7400; S.conteoTocado["4"] = true; const a = conteoChequeo("4", 7400); S.conteo["4"] = 40; return { a, b: conteoChequeo("4", 40), bloq: (S.conteo["4"] = 7400, conteoResumen().bloqueos.length) } });
  ok(m.a && m.a.nivel === "bloq" && /7400 vasquetas/.test(m.a.msg), "sin kilos reales: 7400 vasquetas de Banana Split no deja guardar: " + (m.a && m.a.msg));
  ok(m.b === null && m.bloq === 1, "40 vasquetas está bien; el resumen cuenta 1 imposible");
  // Ingreso / Producción: 12 vasquetas con 12 kg no deja registrar
  const g = await page.evaluate(() => {
    S.kilosReales = true; S.conteo = null; S.inv = null; S.tab = "ingreso"; S.salidaElegida = false;
    S.cart.ingreso = { "4": 12 }; S.kilosProduccion = { "4": "12" }; S.confirm = false; renderApp();
    const a = kgVasqProblema("4", 12, 12, true), b2 = kgVasqProblema("4", 2, 7400, true), c = kgVasqProblema("4", 4, 14.57, true), d = kgVasqProblema("4", 1, 1.1, false);
    return { a, b2, c, d };
  });
  ok(g.a && /12 vasquetas con 12 kg/.test(g.a), "ingreso/producción: 12 vasquetas con 12 kg es un error: " + g.a);
  ok(g.b2 && /no pueden pesar/.test(g.b2), "2 vasquetas con 7400 kg es un error");
  ok(g.c === null && g.d === null, "4 vasquetas con 14,57 kg está bien, y una vasqueta abierta de 1,1 kg en devolución también");
  await page.waitForTimeout(300);
  const bar = (await page.innerText("#bar")).replace(/\s+/g, " ");
  ok(/Revisá los kilos/.test(bar) && await page.$eval("#go", e => e.disabled), "la barra de Ingreso avisa «Revisá los kilos» y no deja registrar: " + bar.slice(0, 120));
  // Conteo local: una pesada de 350 kg o 400 kg de un sabor tampoco deja avanzar
  const l = await page.evaluate(() => {
    S.tab = "stock"; S.cart.ingreso = {}; S.kilosProduccion = {};
    S.inv = { paso: "contar", items: { "4": 350 }, pesos: { "4": [3.5, 350] }, tocado: { "4": true }, camara: {}, filtroFamilia: "vasquetas" };
    renderApp(); return invImposibles();
  });
  ok(l.length === 1 && /350/.test(l[0]), "conteo local: una vasqueta de 350 kg se marca: " + JSON.stringify(l));
  await page.waitForTimeout(300);
  ok(/Revisá los kilos/.test(await page.innerText("#bar")) && await page.$eval("#invResBtn", e => e.disabled), "y «Ver resultado» queda apagado");
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
