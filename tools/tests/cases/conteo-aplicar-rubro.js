// Conteo físico: «Poner el mismo número» → «Solo <rubro seleccionado>» (por defecto) o «Todo el local».
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
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);
  await page.click("#conteoBtn"); await page.waitForTimeout(400);

  const valor = id => page.$eval(`[data-c="${id}"]`, e => e.value);
  const rubro = async f => { await page.click(`.tabCat[data-familia='${f}']`); await page.waitForTimeout(250) };
  const aplicar = async v => { await page.fill("#aplicarTodosValor", String(v)); await page.click("#aplicarTodos"); await page.waitForTimeout(300) };

  // Icepops: cargo un número a mano para ver que después no se pisa
  await rubro("icepops");
  await page.fill('[data-c="49"]', "10"); await page.dispatchEvent('[data-c="49"]', "input");
  await rubro("chocolateria"); const choco = await valor("117");

  // 1) Por defecto: solo el rubro seleccionado
  await rubro("vasquetas");
  ok(Number(await valor("4")) > 0, "Banana Split arranca con stock: " + await valor("4"));
  const opciones = (await page.innerText(".aplicarOp")).replace(/\s+/g, " ");
  ok(/Solo Vasquetas · \d+/.test(opciones) && /Todo el local · \d+/.test(opciones), "ofrece «Solo Vasquetas» y «Todo el local»: " + opciones);
  ok(await page.$eval('[data-apl="visible"]', e => e.getAttribute("aria-pressed")) === "true", "por defecto está elegido «Solo <rubro>»");
  await aplicar(0);
  ok(await valor("4") === "0" && await valor("5") === "0", "las vasquetas quedan en 0");
  await rubro("icepops");
  ok(await valor("49") === "10", "los Icepops NO se tocaron (sigue en 10): " + await valor("49"));
  await rubro("chocolateria");
  ok(await valor("117") === choco, "la chocolatería NO se tocó (sigue en " + choco + "): " + await valor("117"));

  // 2) «Todo el local»: pisa todos los rubros
  await page.click('[data-apl="todo"]'); await page.waitForTimeout(200);
  ok(await page.$eval('[data-apl="todo"]', e => e.getAttribute("aria-pressed")) === "true", "se elige «Todo el local»");
  await aplicar(0);
  ok(await valor("117") === "0", "la chocolatería ahora queda en 0: " + await valor("117"));
  await rubro("icepops");
  ok(await valor("49") === "0", "los Icepops quedan en 0: " + await valor("49"));

  // 3) «Aplicar» no cuenta como haber contado
  await rubro("vasquetas");
  const etiqueta = await page.$eval('[data-cbadge="4"]', e => e.hidden ? "" : e.textContent.trim());
  ok(etiqueta === "Queda en 0", "Banana Split pasa a «Queda en 0» y no «contado»: " + etiqueta);

  // 4) el «?» brilla fuerte mientras se cuenta y abre directo el tema «Conteo físico»
  ok(await page.$eval("#ayudaBtn", e => e.classList.contains("llama")), "el «?» está en modo llamada mientras se cuenta");
  const anim = await page.$eval("#ayudaBtn", e => getComputedStyle(e).animationName);
  ok(/ayudaHalo/.test(anim), "el «?» tiene la animación de brillo: " + anim);
  await page.click("#ayudaBtn"); await page.waitForTimeout(300);
  ok(/Conteo físico/.test(await page.innerText(".ayTema[aria-expanded='true'], .ayTema.on, #ayudaOv")), "la ayuda abre en el tema Conteo físico");
  const abierto = await page.evaluate(() => S.ayudaTema);
  ok(abierto === "conteo", "tema abierto = conteo: " + abierto);
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);

  ok(err.length === 0, "sin errores de consola " + JSON.stringify(err));
  console.log(fallas ? "FALLAS " + fallas : "TODO OK");
  await b.close();
})().catch(e => { console.error("ERROR", e.message); process.exit(1) });
