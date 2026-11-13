// Conteo físico parcial: «¿Qué vas a contar?» → «Solo un rubro» reemplaza solo ese rubro y no toca el resto.
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

  const stock = id => page.evaluate(i => stockMap()[i] || 0, id);
  const antes = { banana: await stock("4"), cheese: await stock("5"), ice: await stock("49"), choco: await stock("117") };
  console.log("   stock antes:", JSON.stringify(antes));

  // 1) selector: todo el local o solo un rubro
  await page.click("#conteoBtn"); await page.waitForSelector("#contOv");
  const opciones = (await page.innerText("#contOv")).replace(/\s+/g, " ");
  ok(/¿Qué vas a contar\?/.test(opciones) && /Todo el local/.test(opciones) && /Solo un rubro/.test(opciones), "pregunta «¿Qué vas a contar?» con las dos opciones");
  await page.click('[data-ce="rubro"]'); await page.waitForTimeout(150);
  ok(await page.$$eval("[data-ce-rubro]", e => e.length) >= 3, "al elegir «Solo un rubro» aparecen los rubros del local");
  await page.click('[data-ce-rubro="vasquetas"]');
  ok(/Solo se reemplaza el stock de <b>Vasquetas|solo se reemplaza el stock de Vasquetas/i.test((await page.innerText("#contOv")).replace(/\s+/g, " ")) || /reemplaza el stock de Vasquetas/.test((await page.innerText("#contOv")).replace(/\s+/g, " ")), "explica qué se reemplaza");
  await page.click("[data-ce-empezar]"); await page.waitForTimeout(400);

  // 2) la pantalla queda limitada a ese rubro
  ok(/Contando solo Vasquetas/.test(await page.innerText("main")), "aviso «Contando solo Vasquetas»");
  ok(await page.$$eval(".tabCat", e => e.length) === 1, "una sola pestaña: solo el rubro elegido");
  ok(await page.$('[data-c="49"]') === null && await page.$('[data-c="117"]') === null, "no se ven Icepops ni chocolatería para contar");
  ok(await page.$('[data-apl="todo"]') === null, "no ofrece «Todo el local» en «Poner el mismo número»");

  // 3) contar: Banana Split 20 → 12 ; Cheesecake igual ; kilos de las vasquetas
  const cargar = async (id, v) => { await page.fill(`[data-c="${id}"]`, String(v)); await page.dispatchEvent(`[data-c="${id}"]`, "input"); await page.waitForTimeout(60) };
  await cargar(4, 12); await cargar(5, antes.cheese);
  for (const id of ["4", "5", "20"]) { await page.fill(`[data-kc="${id}"]`, "11,4"); await page.dispatchEvent(`[data-kc="${id}"]`, "input") }
  await page.waitForTimeout(200);
  await page.click("#go"); await page.waitForTimeout(400);
  const rev = (await page.innerText("main")).replace(/\s+/g, " ");
  ok(/Solo se reemplaza el stock de Vasquetas/i.test(rev), "la revisión dice «Solo se reemplaza el stock de Vasquetas»");
  ok(/Los demás rubros no se tocan/.test(rev), "y que los demás rubros no se tocan");
  for (let i = 0; i < 10 && await page.$(".rcOk:not(.on)"); i++) { await page.click(".rcOk:not(.on)"); await page.waitForTimeout(100) }
  ok(!(await page.$eval("#ok", e => e.disabled)), "con todo confirmado se puede guardar");
  await page.click("#ok"); await page.waitForTimeout(1300);

  // 4) resultado: solo cambiaron las vasquetas
  const despues = { banana: await stock("4"), cheese: await stock("5"), ice: await stock("49"), choco: await stock("117") };
  console.log("   stock después:", JSON.stringify(despues));
  ok(despues.banana === 12, "Banana Split quedó en lo contado (12): " + despues.banana);
  ok(despues.cheese === antes.cheese, "Cheesecake sin cambios");
  ok(despues.ice === antes.ice && despues.choco === antes.choco, "Icepops y chocolatería NO se tocaron");

  // 5) Historial: aparece como «conteo parcial»
  await page.click("#tabs [data-t='historial']"); await page.waitForTimeout(500);
  const hist = (await page.innerText("main")).replace(/\s+/g, " ");
  ok(/conteo parcial/i.test(hist), "Historial muestra el movimiento como «conteo parcial»");
  ok(/Banana Split/.test(hist), "con el sabor que cambió");

  // 6) «Todo el local» sigue siendo un conteo completo y normal
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(300);
  await page.click("#conteoBtn"); await page.waitForSelector("#contOv"); await page.click("[data-ce-empezar]"); await page.waitForTimeout(400);
  ok(await page.$$eval(".tabCat", e => e.length) >= 3, "«Todo el local» muestra todos los rubros");
  ok(!/Contando solo/.test(await page.innerText("main")), "sin el aviso de conteo parcial");
  await page.click("#cancelConteo"); await page.waitForTimeout(200);

  ok(err.length === 0, "sin errores de consola " + JSON.stringify(err));
  console.log(fallas ? "FALLAS " + fallas : "TODO OK");
  await b.close();
})().catch(e => { console.error("ERROR", e.message); process.exit(1) });
