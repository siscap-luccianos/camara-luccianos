// «Guardar solo lo contado y seguir»: contar un solo sabor (kilos reales), guardarlo y seguir contando sin tener que terminar todo.
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
  const stock = id => page.evaluate(i => stockMap()[i] || 0, id);
  const s5 = await stock("5"), s20 = await stock("20");

  await page.click("#conteoBtn"); await page.waitForSelector("#contOv"); await page.click("[data-ce-empezar]"); await page.waitForTimeout(400);
  const cargar = async (id, v, kg) => { await page.fill(`[data-c="${id}"]`, String(v)); await page.dispatchEvent(`[data-c="${id}"]`, "input"); if (kg) { await page.fill(`[data-kc="${id}"]`, kg); await page.dispatchEvent(`[data-kc="${id}"]`, "input") } await page.waitForTimeout(80) };
  // contar solo Banana Split (30 vasquetas) con sus kilos; el resto sin tocar (y sin kilos cargados)
  await cargar(4, 30, "117");
  ok(!(await page.$eval("#go", e => e.disabled)), "con un solo sabor contado «Revisar y guardar» NO queda bloqueado por los demás");
  await page.click("#go"); await page.waitForTimeout(400);
  for (let i = 0; i < 10 && await page.$(".cvFlag button:not(.ok)"); i++) { await page.click(".cvFlag button:not(.ok)"); await page.waitForTimeout(100) }
  ok(await page.$("#okContado") !== null && !(await page.$eval("#okContado", e => e.disabled)), "aparece «Guardar solo lo contado y seguir» habilitado");
  ok(await page.$eval("#ok", e => e.disabled), "«Guardar conteo» (todo) sigue bloqueado: faltan los kilos de los sin contar");
  await page.click("#okContado"); await page.waitForTimeout(1200);
  ok(await stock("4") === 30, "Banana Split quedó en 30 en el sistema");
  ok(await stock("5") === s5 && await stock("20") === s20, "los sabores no contados no se tocaron");
  ok(await page.evaluate(() => !!S.conteo), "el conteo sigue abierto para seguir contando");
  ok(/Guardado ✓/.test(await page.innerText('[data-cbadge="4"]')), "Banana Split queda marcado «Guardado ✓»");
  // seguir: contar Frutilla y volver a guardar
  await cargar(20, 7, "25,5");
  await page.click("#go"); await page.waitForTimeout(400);
  for (let i = 0; i < 10 && await page.$(".cvFlag button:not(.ok)"); i++) { await page.click(".cvFlag button:not(.ok)"); await page.waitForTimeout(100) }
  await page.click("#okContado"); await page.waitForTimeout(1200);
  ok(await stock("20") === 7 && await stock("4") === 30 && await stock("5") === s5, "segundo guardado: Frutilla 7, Banana Split sigue en 30, Cheesecake sin tocar");
  // Historial: dos conteos parciales
  await page.click("#cancelConteo"); await page.waitForTimeout(300);
  await page.click("#tabs [data-t='historial']"); await page.waitForTimeout(500);
  ok((((await page.innerText("main")).match(/conteo parcial/gi)) || []).length >= 2, "Historial muestra los dos guardados como «conteo parcial»");
  ok(err.length === 0, "sin errores de consola " + JSON.stringify(err));
  console.log(fallas ? "FALLAS " + fallas : "FALLAS 0");
  await b.close(); process.exit(fallas ? 1 : 0);
})();
