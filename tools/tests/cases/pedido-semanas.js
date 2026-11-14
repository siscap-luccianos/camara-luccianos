// Pedido sugerido por días de la semana: último pedido y llegada como fechas, proyección día por día y detalle por sabor.
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

  // Historial: 28 días de salidas de Banana Split (id 4), con un patrón fijo por día de la semana (dom..sáb)
  const patron = [8, 2, 1, 0, 8, 8, 3];
  await page.evaluate(p => {
    S.regs = (S.regs || []).filter(r => !(r.tipo === "salida" && r.items && r.items["4"] !== undefined && String(r.id).startsWith("t-")));
    const ahora = new Date();
    S.regs.push({ id: "t-ing", tipo: "ingreso", subtipo: "", items: { "4": 300 }, ts: new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 30, 12).getTime(), total: 300, empleado: "T" });
    for (let i = 1; i <= 28; i++) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - i, 12), q = p[d.getDay()];
      if (q) S.regs.push({ id: "t-" + i, tipo: "salida", subtipo: "", items: { "4": q }, ts: d.getTime(), total: q, empleado: "T" });
    }
    S.diasEntrega = 4; ls.del && ls.del("ultimoPedido:" + S.local);
    S.tab = "stock"; S.verPedido = true; S.pedidoAdj = {}; S.pedidoDetalle = {}; renderApp();
  }, patron);
  await page.waitForTimeout(300);

  const esperado = (k, st) => {
    let t = 0; const hoy = new Date();
    for (let i = 0; i <= k; i++) t += patron[new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i).getDay()];
    const m = 2; return Math.ceil(Math.max(0, Math.ceil(t - st)) / m) * m;
  };
  const leer = () => page.evaluate(() => ({ st: stockMap()["4"], ped: pedidoSugerido("4", stockMap()), sin: pedidoSinAjuste("4", stockMap()), N: datosProyeccion().N, vent: datosProyeccion().ventana }));

  ok(await page.locator("[data-ultped]").count() === 14, "hay 14 días para marcar el último pedido");
  ok(await page.locator("[data-llega]").count() === 14, "hay 14 días para marcar la llegada");
  ok((await page.locator('[data-llega="4"]').getAttribute("aria-pressed")) === "true", "la llegada en 4 días está marcada");
  ok(/Llega el .* · 4 días/.test(await page.innerText(".llegaFila")), "dice cuándo llega: " + (await page.innerText(".llegaFila")).replace(/\n/g, " "));
  let r = await leer();
  ok(r.N === 7 && r.vent === 21, "sin nada marcado: último pedido hace 7 días y muestra de 3 semanas (N=" + r.N + ", ventana=" + r.vent + ")");
  ok(r.sin === esperado(4, r.st), "el pedido sale de los mismos días de la semana: " + r.sin + " (esperado " + esperado(4, r.st) + ", stock " + r.st + ")");

  await page.click('[data-llega="2"]'); await page.waitForTimeout(200);
  r = await leer();
  ok(r.sin === esperado(2, r.st), "llegando antes pide distinto: " + r.sin + " (esperado " + esperado(2, r.st) + ")");
  await page.click("#llegaMas"); await page.waitForTimeout(150);
  ok(await page.evaluate(() => S.diasEntrega) === 3, "el + suma un día");
  await page.click('[data-llega="4"]'); await page.waitForTimeout(150);

  await page.click("[data-ultped]:nth-child(5)"); await page.waitForTimeout(200);
  r = await leer();
  ok(r.N === 10, "marcar otro día de último pedido cambia los días medidos (N=" + r.N + ")");
  ok(/Pasaron 10 días/.test(await page.innerText(".kpis")), "dice «Pasaron 10 días»");
  ok(/ultimoPedido/.test(await page.evaluate(() => Object.keys(localStorage).join(","))), "se recuerda por local");

  const fila = page.locator('[data-pdet="4"]'); await fila.click(); await page.waitForTimeout(200);
  ok(/Salieron \d+ desde el \d+\/\d+/.test(await fila.innerText()), "cada sabor dice cuánto salió desde el último pedido: " + (await fila.innerText()).replace(/\n/g, " "));
  ok(await page.locator(".pdDia.proy").count() === 5, "el detalle muestra los 5 días proyectados (hoy hasta la llegada)");
  ok(await page.locator(".pdCuenta").count() === 1 && /Pedir \d+/.test(await page.innerText(".pdCuenta")), "el detalle cierra con la cuenta: " + (await page.innerText(".pdCuenta")).replace(/\n/g, " "));
  ok(/tendencia · 3 semanas/i.test(await page.innerText(".pedDetalle")) && await page.locator(".pdLinea").count() === 1, "línea de tendencia de 3 semanas");
  await page.screenshot({ path: "pedido-semanas.png", fullPage: true });
  ok(err.length === 0, "sin errores de consola: " + err.join(" | "));
  console.log(fallas ? "FALLAS " + fallas : "FALLAS 0");
  await b.close(); process.exit(fallas ? 1 : 0);
})();
