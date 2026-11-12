// El escáner se prende por función y no depende de los kilos: escaner_conteo = solo «Contar escaneando» en Conteo;
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
  const conteoBtn = async () => { await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400); await page.click("#conteoBtn"); await page.waitForSelector("#contOv"); const e = await page.$("[data-ce-empezar]"); if (e) { await e.click(); await page.waitForTimeout(400); } return await page.$("#escConteoBtn") !== null; };
  const salidaTiene = async () => { await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(400); return await page.$("#irEscaner") !== null; };
  const flags = () => page.evaluate(() => ({ p: S.escanerPeso, s: S.escanerSalida, c: S.escanerConteo, k: S.kilosReales }));

  // 1) Solo escaner_conteo
  await irA("Local conteo");
  let f = await flags();
  ok(f.c === true && f.s === false && f.p === false && f.k === false, "Local conteo: escáner de conteo sí; salida, peso y kilos no");
  ok(await salidaTiene() === false, "Local conteo: Salida NO muestra «Escanear vasqueta»");
  ok(await page.evaluate(() => esPesable("4") === false && esPesable("20") === false), "Local conteo: tocar una vasqueta en Salida NO pide el peso (esPesable falso)");
  ok(await conteoBtn() === true, "Local conteo: Conteo físico SÍ muestra «Contar escaneando»");

  // 2) Solo escaner_salida
  await irA("Local salida");
  f = await flags();
  ok(f.s === true && f.c === false && f.p === false && f.k === false, "Local salida: escáner de salida sí; conteo, peso y kilos no");
  ok(await salidaTiene() === true, "Local salida: Salida SÍ muestra «Escanear vasqueta»");
  ok(await conteoBtn() === false, "Local salida: Conteo físico NO muestra «Contar escaneando»");

  // 3) Local sin nada
  await irA("Obelisco CABA");
  f = await flags();
  ok(!f.s && !f.c && !f.p && !f.k, "Obelisco: sin escáner de ninguna función");
  ok(await salidaTiene() === false && await conteoBtn() === false, "Obelisco: ni Salida ni Conteo tienen escáner");

  // 4) Kilos reales (Local prueba) sigue prendiendo los dos, como antes
  await irA("Local prueba");
  f = await flags();
  ok(f.k === true && f.s === true && f.c === true, "Local prueba (kilos reales): sigue con escáner en Salida y Conteo");
  ok(await page.evaluate(() => esPesable("4") === true), "Local prueba (kilos reales): sigue pidiendo el peso de cada vasqueta");

  ok(err.length === 0, "sin errores de consola" + (err.length ? " " + err[0] : ""));
  console.log(fallas ? "FALLAS " + fallas : "FALLAS 0"); await b.close(); process.exit(fallas ? 1 : 0);
})();
