// Transferencia en un local SIN venta del día: Salida y Ingreso la ofrecen igual.
// (copia de encabezado) El escáner se prende por función y no depende de los kilos: escaner_conteo = solo «Contar escaneando» en Conteo;
// escaner_salida = solo «Escanear vasqueta» en Salida; ninguno pide el peso al tocar un sabor ni activa kilos reales.
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
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click(`[data-tecla="${d}"]`); }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  const irA = async n => { await page.fill("#local", n); await page.press("#local", "Enter"); await page.waitForTimeout(1200); };
  const conteoBtn = async () => { await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400); await (await page.$("#conteoInicialBtn"))?.click(); await page.click("#conteoBtn"); await page.waitForSelector("#contOv"); const e = await page.$("[data-ce-empezar]"); if (e) { await e.click(); await page.waitForTimeout(400); } return await page.$("#escConteoBtn") !== null; };
  const salidaTiene = async () => { await page.click("#tabs [data-t='salida']"); await page.evaluate(() => { S.ventaDia = false; renderApp(); }); await page.waitForTimeout(300); return await page.$("#irEscaner") !== null; }; await page.click("[data-sal-menu='comun']").catch(()=>{}); await page.waitForTimeout(200);
  const flags = () => page.evaluate(() => ({ p: S.escanerPeso, s: S.escanerSalida, c: S.escanerConteo, k: S.kilosReales }));

  await irA("Local conteo");
  await page.evaluate(() => { S.ventaDia = false; renderApp(); });
  ok(await page.evaluate(() => S.ventaDia) === false, "se fuerza un local sin venta del día");
  await page.click("#tabs [data-t='salida']"); await page.evaluate(() => { S.ventaDia = false; renderApp(); }); await page.waitForTimeout(300);
  ok(await page.$("[data-sal-menu='transf']") !== null, "Salida ofrece «Transferencia» sin venta del día");
  await page.click("[data-sal-menu='transf']"); await page.waitForTimeout(300);
  ok(await page.$(".transfCampo") !== null, "aparece el campo del local de destino");
  ok(await page.$("[data-sal-menu='choco']") === null, "pero no la salida de chocolatería (esa sí depende de la venta del día)");
  await page.click("#tabs [data-t='ingreso']"); await page.evaluate(() => { S.ventaDia = false; renderApp(); }); await page.waitForTimeout(300);
  ok(await page.$("[data-ing-menu='transf']") !== null, "Ingreso ofrece «Transferencia recibida» sin venta del día");
  await page.click("[data-ing-menu='transf']"); await page.waitForTimeout(300);
  ok(await page.$(".transfCampo") !== null, "aparece el campo del local de origen");
  console.log(fallas ? "FALLAS " + fallas : "FALLAS 0"); await b.close(); process.exit(fallas ? 1 : 0);
})();
