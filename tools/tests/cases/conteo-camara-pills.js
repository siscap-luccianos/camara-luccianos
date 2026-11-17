// Conteo cámara con kilos reales: las vasquetas se cargan igual que en el Conteo local (casillas de peso debajo del sabor + total).
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  page.on("dialog", d => d.accept());
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);
  await (await page.$("#conteoInicialBtn"))?.click(); await page.click("#conteoBtn");
  if (await page.$("[data-ce-empezar]") || await page.waitForSelector("[data-ce-empezar]", { timeout: 1500 }).catch(() => null)) await page.click("[data-ce-empezar]");
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => S.kilosReales === true), "el local usa kilos reales");
  const fila = '[data-cestado]:has([data-cw^="4|"])';
  ok((await page.$$(fila + " input[data-cw]")).length === 3, "cada vasqueta tiene 3 casillas de peso para empezar");
  ok(!!(await page.$(fila + " [data-cwtot]")), "y un total");
  const geo = await page.evaluate(() => { const r = document.querySelector('[data-cestado]:has([data-cw^="4|"])'), n = r.querySelector(".nm").getBoundingClientRect(), p = r.querySelector(".cwPills").getBoundingClientRect(), rr = r.getBoundingClientRect(); return { nb: n.bottom, pt: p.top, pw: p.width, w: rr.width } });
  ok(geo.pt >= geo.nb - 2 && geo.pw > geo.w * 0.8, "las pills van debajo del nombre, a todo el ancho: " + JSON.stringify(geo));
  await page.fill(fila + ' [data-cw="4|0"]', "3,5"); await page.fill(fila + ' [data-cw="4|1"]', "4"); await page.waitForTimeout(200);
  ok(/7,5/.test(await page.innerText(fila + " [data-cwtot]")), "el total se suma solo: 3,5 + 4 = 7,5 kg");
  ok(await page.evaluate(() => S.conteo["4"] === 2 && S.kilosConteo["4"] === "7,5" && S.conteoTocado["4"] === true), "el conteo de siempre queda con 2 vasquetas y 7,5 kg");
  await page.click(fila + " [data-cwmas]"); await page.waitForTimeout(200);
  ok((await page.$$(fila + " input[data-cw]")).length === 4, "«+» agrega otra casilla");
  await page.fill(fila + ' [data-cw="4|0"]', ""); await page.waitForTimeout(200);
  ok(await page.evaluate(() => S.conteo["4"] === 1 && S.kilosConteo["4"] === "4"), "vaciar una casilla baja la cantidad y el total");
  // recarga: el borrador conserva las casillas
  await page.waitForTimeout(700); await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(1200);
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
