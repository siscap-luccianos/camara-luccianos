// Contar solo un sabor (kilos reales) y «Guardar definitivo»: no se bloquea por lo no contado, solo cambia lo contado y queda en Historial.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  let pregunta = ""; page.on("dialog", d => { pregunta = d.message(); d.accept() });
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);
  const stock = id => page.evaluate(i => stockMap()[i] || 0, id);
  const s5 = await stock("5"), s20 = await stock("20");
  await (await page.$("#conteoInicialBtn"))?.click(); await page.click("#conteoBtn"); await page.waitForTimeout(400);
  const cargar = async (id, v, kg) => { await page.fill(`[data-c="${id}"]`, String(v)); await page.dispatchEvent(`[data-c="${id}"]`, "input"); if (kg) { await page.fill(`[data-kc="${id}"]`, kg); await page.dispatchEvent(`[data-kc="${id}"]`, "input") } };
  await cargar(4, 30, "117");
  ok(!(await page.$eval("#go", e => e.disabled)), "con un solo sabor contado «Revisar» NO queda bloqueado por los demás");
  await page.click("#go"); await page.waitForTimeout(400);
  for (let i = 0; i < 10 && await page.$(".rcOk:not(.on)"); i++) { await page.click(".rcOk:not(.on)"); await page.waitForTimeout(100) }
  ok(!(await page.$eval("#ok", e => e.disabled)) && /Guardar definitivo/.test(await page.innerText("#ok")), "«Guardar definitivo» NO queda bloqueado por los sabores sin contar");
  await page.click("#ok"); await page.waitForTimeout(1500);
  ok(/GUARDAR DEFINITIVO/.test(pregunta) && /queda en 0/.test(pregunta), "pregunta antes de cerrar y avisa que lo no contado queda en 0");
  ok(await stock("4") === 30, "Banana Split quedó en 30 en el sistema");
  ok(await stock("5") === 0 && await stock("20") === 0, "en el rubro contado, lo que no se contó quedó en 0 (antes " + s5 + " y " + s20 + ")");
  ok(await page.evaluate(() => !S.conteo), "y el conteo se cerró");
  await page.click("#tabs [data-t='historial']"); await page.waitForTimeout(500);
  ok(/conteo parcial/i.test(await page.innerText("main")), "Historial muestra el guardado como «conteo parcial»");
  ok(err.length === 0, "sin errores de consola " + JSON.stringify(err));
  console.log(fallas ? "FALLAS " + fallas : "FALLAS 0");
  await b.close(); process.exit(fallas ? 1 : 0);
})();
