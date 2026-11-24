// Alerta de vencimiento en riesgo (chocolatería): cálculo con ventas de 30 días, aviso en Stock, franja en la tarjeta, filtro y detalle.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let f = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) f++ };
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  // datos de prueba: historial viejo (más de 14 días), 3 ventas de un producto con lotes y una transferencia grande que NO debe contar
  const info = await page.evaluate(() => {
    const id = String(Object.keys(lotesPorSabor()).find(i => saboresConVencimiento().some(s => String(s.id) === i) && lotesPorSabor()[i].some(l => l.f && diasHasta(l.f) >= 0)));
    S.regs.push({ id: "t0", tipo: "ingreso", ts: Date.now() - 45 * 864e5, items: {}, local: S.local });
    S.regs.push({ id: "t1", tipo: "salida", subtipo: "venta", ts: Date.now() - 5 * 864e5, items: { [id]: 3 }, local: S.local });
    S.regs.push({ id: "t2", tipo: "salida", subtipo: "transferencia", ts: Date.now() - 4 * 864e5, items: { [id]: 50 }, local: S.local });
    S.regs.push({ id: "t3", tipo: "salida", subtipo: "desperdicio", ts: Date.now() - 3 * 864e5, items: { [id]: 40 }, local: S.local });
    _lotesMemo = null; _riesgoMemo = null;
    const R = riesgoTodos()[id], lotes = lotesPorSabor()[id].filter(l => l.f && l.c > 0 && diasHasta(l.f) >= 0).sort((a, b) => a.f < b.f ? -1 : 1);
    // cuenta independiente: 3 vendidas en 30 días = 0,1 por día, lote por lote
    let vendido = 0, total = 0; lotes.forEach(l => { const d = diasHasta(l.f), v = Math.min(l.c, Math.max(0, 0.1 * d - vendido)); vendido += v; total += Math.round(l.c - v) });
    return { id, total: R && R.total, esperado: total, v30: R && R.v30, sin: R && R.sin, lotes: lotes.length };
  });
  ok(!info.sin, "con más de 14 días de historial sí se estima");
  ok(info.v30 === 3, "el consumo toma solo la venta: 3 (la transferencia y el desperdicio no cuentan), dio " + info.v30);
  ok(info.total === info.esperado && info.total > 0, "el riesgo coincide con la cuenta aparte: " + info.total + " vs " + info.esperado);
  // Stock: aviso en la portada
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(500);
  const aviso = await page.$(".rgAviso"); ok(!!aviso, "Stock muestra el aviso de vencimientos en riesgo");
  ok(/vencimientos en riesgo/i.test(await page.innerText(".rgAviso")) && /no se alcanzan a vender/.test(await page.innerText(".rgAviso")), "el aviso dice cuántos productos y unidades");
  await page.click(".rgAviso"); await page.waitForTimeout(400);
  ok(/En riesgo · \d+/.test(await page.innerText("main")) && await page.$(".vencRow") !== null, "tocar el aviso abre Ver vencimientos con el filtro «En riesgo»");
  ok(await page.$(".rgBtn") !== null && await page.$(".rgBar") !== null, "cada lote en riesgo muestra «~N en riesgo» y su barra");
  // detalle
  await page.click(".rgBtn"); await page.waitForSelector("#riesgoOv", { timeout: 2000 });
  const det = await page.innerText("#riesgoOv");
  ok(/En riesgo: ~\d+/.test(det) && /Se vendieron 3 en los últimos 30 días/.test(det) && /Vencen en \d+ días?/.test(det), "el detalle dice el número, lo vendido en 30 días y cuándo vence: " + det.replace(/\s+/g, " ").slice(0, 120));
  ok(/Ofrecerlas primero/.test(det) && /Transferir a otro local/.test(det) && /Pasar a desperdicio/.test(det), "tiene las tres salidas");
  ok(await page.$eval("#riesgoOv [disabled]", e => /desperdicio/i.test(e.textContent)), "«Pasar a desperdicio» está apagado hasta que venza");
  await page.click("[data-rg-cerrar]"); await page.waitForTimeout(200);
  ok(await page.$("#riesgoOv") === null, "Cerrar cierra el detalle");
  // transferir: arranca con lo que está en riesgo cargado
  await page.click(".rgBtn"); await page.waitForSelector("#riesgoOv"); await page.click("[data-rg-transf]"); await page.waitForTimeout(500);
  const car = await page.evaluate((id) => ({ tab: S.tab, tr: S.salidaTransf, n: (S.cart[cartKeyActual()] || {})[id] }), info.id);
  ok(car.tab === "salida" && car.tr && car.n > 0, "«Transferir» abre Transferencia enviada con " + car.n + " cargadas");
  // franja en la tarjeta y aviso en la portada de Chocolatería (antes de entrar a Vencimientos)
  await page.evaluate(() => { const k = cartKeyActual(); S.cart[k] = {}; S.tab = "salida"; S.salidaElegida = true; S.salidaTransf = false; S.modoVenta = false; S.modoDesperdicio = false; S.verVencimientos = false; S.filtroFamilia = "chocolateria"; S.filtroCategoria = "todas"; S.catAbierta = false; renderApp() }); await page.waitForTimeout(400);
  ok(await page.$(".rgFr") !== null, "la tarjeta del producto muestra la franja «~N en riesgo»");
  ok(await page.$(".chocoBarra .rgAviso") === null && await page.$(".chocoBarra + .rgAviso") === null, "en Chocolatería no hay una tarjeta aparte: una sola entrada");
  ok(/en riesgo/.test(await page.innerText(".chocoBtn.venc.rg")), "el botón «Vencimientos» se pone rojo y dice «N en riesgo»: " + (await page.innerText(".chocoBtn.venc.rg")));
  await page.screenshot({ path: "/tmp/riesgo-chocolateria.png" });
  await page.click(".chocoBtn.venc.rg"); await page.waitForTimeout(300);
  ok(/Volver a Salida/.test(await page.innerText("main")) && /En riesgo · \d+/.test(await page.innerText("main")), "tocar el botón abre Vencimientos en «En riesgo»");
  // sin datos: menos de 14 días de historial → no se avisa nada
  const sin = await page.evaluate(() => { window.riesgoHistDias = () => 5; _riesgoMemo = null; return { aviso: riesgoAvisoHTML(), ids: riesgoIds().length } });
  ok(sin.aviso === "" && sin.ids === 0, "con menos de 14 días de historial no se avisa ni se estima");
  console.log("errores:", err.length ? err : "ninguno");
  console.log(f || err.length ? "FALLAS " + (f + err.length) : "FALLAS 0"); await b.close(); process.exit(f || err.length ? 1 : 0);
})();
