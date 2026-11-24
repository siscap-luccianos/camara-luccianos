// Conteo sin pedir fechas: no aparece el panel de vencimiento y, al guardar, los lotes que ya estaban se mantienen.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let f = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) f++ };
  page.on("dialog", d => d.accept());
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);
  await (await page.$("#conteoInicialBtn"))?.click(); await page.click("#conteoBtn"); await page.waitForTimeout(500);
  await page.evaluate(() => { S.filtroFamilia = "chocolateria"; S.filtroCategoria = "todas"; S.catAbierta = false; renderApp() }); await page.waitForTimeout(300);
  const id = await page.evaluate(() => Array.from(document.querySelectorAll("[data-c]")).map(e => e.dataset.c).find(i => lotesPorSabor()[i].some(l => l.f && l.c > 0)));
  const lotes = await page.evaluate(i => lotesPorSabor()[i].filter(l => l.c > 0).map(l => ({ f: l.f || "", c: l.c })), id);
  const sis = lotes.reduce((a, l) => a + l.c, 0);
  console.log("lotes de partida:", JSON.stringify(lotes), "sistema:", sis);
  await page.fill(`[data-c="${id}"]`, String(sis - 3)); await page.dispatchEvent(`[data-c="${id}"]`, "input"); await page.waitForTimeout(300);
  ok(await page.$(".lotesPanel") === null && await page.$(".lpHead") === null, "al contar chocolatería NO aparece el panel de vencimiento");
  // reglas de lotesTrasConteo
  const r = await page.evaluate(([i, sis]) => ({ igual: lotesTrasConteo(i, sis), menos: lotesTrasConteo(i, sis - 3), mas: lotesTrasConteo(i, sis + 6), todo: lotesTrasConteo(i, 0) }), [id, sis]);
  const suma = a => a.reduce((x, l) => x + l.c, 0);
  ok(JSON.stringify(r.igual) === JSON.stringify(lotes), "contar lo mismo deja los lotes como están");
  ok(suma(r.menos) === sis - 3 && r.menos[0].f === lotes[0].f && r.menos[0].c === lotes[0].c - 3, "contar 3 menos: salen del lote que vence antes (" + JSON.stringify(r.menos[0]) + ")");
  ok(suma(r.mas) === sis + 6 && r.mas.find(l => !l.f).c === (lotes.find(l => !l.f) ? lotes.find(l => !l.f).c : 0) + 6 && r.mas.filter(l => l.f).length === lotes.filter(l => l.f).length, "contar 6 más: las de más quedan sin fecha y las fechas siguen");
  ok(suma(r.todo) === 0, "contar 0 vacía los lotes");
  // al guardar el conteo completo se manda el reparto de lotes sin pedir nada
  const env = await page.evaluate(async (i) => {
    let cap = null; const orig = window.api; window.api = async (a, p) => { if (a === "conteo") { cap = p; return { ok: true } } if (a === "cerrarConteoRubro") return { ok: true, rubrosCerrados: [] }; return orig(a, p) };
    S.conteo = {}; S.conteoTocado = {}; S.sabores.forEach(s => S.conteo[s.id] = Math.max(0, stockMap()[s.id] || 0)); S.conteo[i] = S.conteo[i] - 3; S.conteoTocado[i] = true; S.conteoAlcance = "todo";
    await guardarConteo(); window.api = orig; return cap;
  }, id);
  ok(env && env.vencimientos && Array.isArray(env.vencimientos[id]) && env.vencimientos[id].reduce((a, l) => a + l.c, 0) === sis - 3, "el conteo completo manda los lotes conservados, sumando lo contado: " + JSON.stringify(env && env.vencimientos && env.vencimientos[id]));
  console.log("errores:", err.length ? err : "ninguno");
  console.log(f || err.length ? "FALLAS " + (f + err.length) : "FALLAS 0"); await b.close(); process.exit(f || err.length ? 1 : 0);
})();
