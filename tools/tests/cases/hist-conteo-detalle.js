// Historial › Movimientos: el conteo completo y el parcial muestran lo contado sabor por sabor (con kilos y total), como un ingreso.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/404|ERR_/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const ahora = Date.now(), h = n => ahora - n * 3600e3;
    S.kilosReales = true; S.stock = { base: {}, ts: 0 };
    S.regs = [
      { id: "c1", tipo: "cambio", subtipo: "conteo_parcial", items: { "4": 4, "5": 3 }, kilos: { "4": 19.53, "5": 11.4 }, pesos: { "4": [4.88, "c:9.77", 4.88] }, ts: h(3), total: 7, empleado: "Lourdes", motivo: "Conteo parcial: vasquetas" },
      { id: "c2", tipo: "conteo", items: { "4": 6, "5": 3, "7": 0 }, kilos: { "4": 24.1, "5": 11.4 }, pesos: { "4": ["c:8.05", "c:8", "c:8.05"] }, ts: h(1), total: 9, empleado: "Lourdes" }
    ];
    S.stock = { base: { "4": 6, "5": 3 }, ts: h(1) };
    S.tab = "historial"; S.rangoHist = "d7"; S.tipoHist = "todos"; S.histAbierto = { c1: true, c2: true }; renderApp();
    return true;
  });
  await page.waitForTimeout(400);
  const txt = await page.innerText("#main");
  ok(/Banana Split ×6, Cheesecake al pistacchio ×3/.test(txt), "la fila del conteo completo lista lo contado");
  ok(/9 vasq\./.test(txt) && /35,50 kg/.test(txt), "la fila muestra el total de vasquetas y el detalle los kilos");
  ok(/Banana Split/.test(txt) && /×6/.test(txt) && /24,10 kg/.test(txt), "el conteo completo lista cada sabor con unidades y kilos");
  ok(/reemplaza el stock de todo el local/.test(txt), "aclara que el completo reemplaza el stock");
  ok(/Banana Split ×4, Cheesecake al pistacchio ×3/.test(txt), "la fila del conteo parcial lista lo contado");
  ok(/×4/.test(txt) && /19,53 kg/.test(txt), "el parcial muestra lo contado (no solo +4) y sus kilos");
  ok(!/\+4/.test(txt), "el parcial ya no muestra «+4» como diferencia suelta");
  ok(/no se tocan/.test(txt), "aclara que el parcial no toca los demás sabores");
  const fichas = await page.$$eval(".hFicha", e => e.map(f => f.textContent.trim()));
  ok(fichas.filter(f => /^caja ×2/.test(f)).length === 4, "las cajas escaneadas salen como ficha «caja ×2 · kg»: " + fichas.join(" | "));
  ok(fichas.includes("4,88") && fichas.includes("caja ×2 · 9,77"), "cada vasqueta suelta sale con su peso individual");
  ok(await page.$$eval(".hFicha.caja", e => e.length) === 4, "las cajas tienen estilo propio");
  ok(!/Cheesecake al pistacchio[^\n]*pesadas/.test(txt), "un sabor contado a mano (sin pesos) muestra solo el total");
  await page.screenshot({ path: "hist-conteo-detalle.png", fullPage: true });
  ok(err.length === 0, "sin errores de consola: " + err.join(" | "));
  console.log(fallas ? "FALLAS " + fallas : "FALLAS 0");
  await b.close(); process.exit(fallas ? 1 : 0);
})();
