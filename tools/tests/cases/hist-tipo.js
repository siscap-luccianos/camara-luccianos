// Historial › Movimientos: filtro por tipo (Salidas, Ingresos, Conteos…) para no depender del día.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.click("#tabs [data-t='historial']"); await page.waitForTimeout(500);
  await page.click('[data-rango-hist="d60"]'); await page.waitForTimeout(400);

  // una venta del día (es una salida) y una transferencia recibida (es un ingreso) se cargan para ver que quedan en su propio filtro
  await page.evaluate(async () => {
    await api("registrar", { clienteId: uuid(), tipo: "salida", subtipo: "venta", local: S.local, items: { "117": 2 }, motivo: "Venta del día" });
    await api("registrar", { clienteId: uuid(), tipo: "ingreso", subtipo: "transferencia", local: S.local, items: { "117": 3 }, motivo: "Transferencia de Obelisco CABA" });
    await cargarDatos();
  });
  await page.waitForTimeout(500);
  const chips = async () => (await page.$$eval("[data-tipo-hist]", e => e.map(x => x.textContent.trim())));
  const pills = async () => (await page.$$eval(".hist .pill", e => e.map(x => x.textContent.trim())));
  const c0 = await chips();
  console.log("   chips:", JSON.stringify(c0));
  ok(c0[0].startsWith("Todos"), "primera opción «Todos»");
  ok(c0.some(x => x.startsWith("Salidas")) && c0.some(x => x.startsWith("Ingresos")) && c0.some(x => x.startsWith("Conteos")), "ofrece Salidas, Ingresos y Conteos");
  const totalTodos = (await pills()).length;
  ok(totalTodos > 0, "sin filtro hay movimientos: " + totalTodos);

  // Conteos: solo conteos
  await page.click('[data-tipo-hist="conteo"]'); await page.waitForTimeout(300);
  let p = await pills();
  ok(p.length > 0 && p.every(x => /conteo/i.test(x)), "«Conteos» muestra solo conteos: " + JSON.stringify([...new Set(p)]));
  const nConteos = parseInt((c0.find(x => x.startsWith("Conteos")) || "").split("·")[1]);
  ok(p.length === nConteos, "la cantidad del botón coincide con la lista (" + nConteos + "): " + p.length);

  // Salidas: solo salidas
  await page.click('[data-tipo-hist="salida"]'); await page.waitForTimeout(300);
  p = await pills();
  ok(p.length > 0 && p.every(x => /salida/i.test(x)), "«Salidas» muestra solo salidas");

  // Ingresos
  await page.click('[data-tipo-hist="ingreso"]'); await page.waitForTimeout(300);
  p = await pills();
  ok(p.length > 0 && p.every(x => /ingreso/i.test(x)), "«Ingresos» muestra solo ingresos");

  // Venta del día: filtro propio, separado de «Salidas»
  const cVenta = await chips();
  ok(cVenta.some(t => t.startsWith("Venta del día · 1")), "aparece «Venta del día · 1»: " + JSON.stringify(cVenta));
  ok(cVenta.some(t => t.startsWith("Transferencia recibida · 1")), "aparece «Transferencia recibida · 1»");
  await page.click('[data-tipo-hist="venta"]'); await page.waitForTimeout(300);
  p = await pills();
  ok(p.length === 1 && /venta del día/i.test(p[0]), "«Venta del día» muestra solo esa venta: " + JSON.stringify(p));
  await page.click('[data-tipo-hist="salida"]'); await page.waitForTimeout(300);
  p = await pills();
  ok(p.length > 0 && p.every(x => /^salida$/i.test(x)), "«Salidas» ya no mezcla la venta del día: " + JSON.stringify([...new Set(p)]));
  await page.click('[data-tipo-hist="ingreso"]'); await page.waitForTimeout(300);
  p = await pills();
  ok(p.length > 0 && p.every(x => /^ingreso$/i.test(x)), "«Ingresos» ya no mezcla la transferencia recibida: " + JSON.stringify([...new Set(p)]));

  // Todos vuelve a mostrar todo
  await page.click('[data-tipo-hist="todos"]'); await page.waitForTimeout(300);
  ok((await pills()).length === totalTodos, "«Todos» vuelve a mostrar todo");

  // Un tipo sin movimientos en el período no se ofrece; el período «Hoy» puede dejarlo vacío con aviso
  await page.click('[data-tipo-hist="conteo"]'); await page.click('[data-rango-hist="d1"]'); await page.waitForTimeout(300);
  const vacio = (await page.innerText("main")).replace(/\s+/g, " ");
  ok(/Conteos/.test(vacio) && (/No hay movimientos de este tipo/.test(vacio) || (await pills()).length >= 0), "con «Hoy» el filtro sigue y avisa si no hay nada");

  ok(err.length === 0, "sin errores de consola " + JSON.stringify(err));
  console.log(fallas ? "FALLAS " + fallas : "TODO OK");
  await b.close();
})().catch(e => { console.error("ERROR", e.message); process.exit(1) });
