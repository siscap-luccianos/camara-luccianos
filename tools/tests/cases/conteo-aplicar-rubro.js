// Conteo cámara: arranca de cero y a ciegas; el «?» brilla fuerte mientras se cuenta.
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
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);
  await (await page.$("#conteoInicialBtn"))?.click(); await page.click("#conteoBtn"); if (await page.$("[data-ce-empezar]") || await page.waitForSelector("[data-ce-empezar]",{timeout:700}).catch(()=>null)) await page.click("[data-ce-empezar]"); await page.waitForTimeout(400);

  const valor = id => page.$eval(`[data-c="${id}"]`, e => e.value === "" ? "0" : e.value);
  const rubro = async f => { await page.click(`.tabCat[data-familia='${f}']`); await page.waitForTimeout(250) };
  const aplicar = async v => { if(!(await page.$("#aplicarTodosValor"))){ await page.click("#aplicarAbrir"); await page.waitForTimeout(150) } await page.fill("#aplicarTodosValor", String(v)); await page.click("#aplicarTodos"); await page.waitForTimeout(300) };

  // El conteo arranca de cero y a ciegas: sin «Poner todo en 0» ni el número del sistema
  await rubro("vasquetas");
  ok(await valor("4") === "0" && await valor("5") === "0", "las vasquetas arrancan en 0");
  await rubro("icepops"); ok(await valor("49") === "0", "los Icepops arrancan en 0: " + await valor("49"));
  await rubro("chocolateria"); ok(await valor("117") === "0", "la chocolatería arranca en 0: " + await valor("117"));
  ok(!(await page.$("#aplicarAbrir")), "ya no hay «Poner todo en 0»");
  ok(!/Sistema:/.test(await page.innerText("#main")), "no se muestra el número del sistema (a ciegas)");

  // 4) el «?» brilla fuerte mientras se cuenta y abre directo el tema «Conteo físico»
  ok(await page.$eval("#ayudaBtn", e => e.classList.contains("llama")), "el «?» está en modo llamada mientras se cuenta");
  const anim = await page.$eval("#ayudaBtn", e => getComputedStyle(e).animationName);
  ok(/ayudaHalo/.test(anim), "el «?» tiene la animación de brillo: " + anim);
  await page.click("#ayudaBtn"); await page.waitForTimeout(300);
  ok(/Conteo cámara/.test(await page.innerText(".ayTema[aria-expanded='true'], .ayTema.on, #ayudaOv")), "la ayuda abre en el tema Conteo físico");
  const abierto = await page.evaluate(() => S.ayudaTema);
  ok(abierto === "conteo", "tema abierto = conteo: " + abierto);
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);

  ok(err.length === 0, "sin errores de consola " + JSON.stringify(err));
  console.log(fallas ? "FALLAS " + fallas : "TODO OK");
  await b.close();
})().catch(e => { console.error("ERROR", e.message); process.exit(1) });
