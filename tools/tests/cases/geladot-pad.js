// Geladot (tipo "g", gramos): pill, stock en cajas + gramos, pad de gramos en Salida y Desperdicio, ayuda, recarga.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const err = []; page.on("pageerror", e => err.push("pageerror " + e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1500);
  const txt = async sel => (await page.innerText(sel)).replace(/\s+/g, " ");
  const abrirGeladot = async () => { await page.click('[data-familia="geladot"]'); await page.waitForTimeout(200); const sub = await page.$('.subCat[data-cat="Todas"], .subCat'); if (sub && !(await page.$('[data-add="194"]'))) { await sub.click(); await page.waitForTimeout(150) } };

  // 1) pill en Salida y Stock
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  await page.click('[data-sal-menu="comun"]'); await page.waitForTimeout(300);
  ok(!!(await page.$('[data-familia="geladot"]')), "Salida: pill Geladot");
  await abrirGeladot();
  ok(!!(await page.$('[data-add="194"]')) && !!(await page.$('[data-add="195"]')), "Salida: tarjetas de los 2 Geladot");
  // 2) stock «2 cajas + 2000 g»
  ok(/2 cajas \+ 2000 g/.test(await txt('[data-add="194"]')), "Salida: stock «2 cajas + 2000 g» — " + await txt('[data-add="194"]'));
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(300);
  ok(!!(await page.$('[data-familia="geladot"]')), "Stock: pill Geladot");
  await abrirGeladot();
  ok(/2 cajas \+ 2000 g/.test(await txt("main")), "Stock: «2 cajas + 2000 g»");

  // 3) Salida con pad
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  if (await page.$('[data-sal-menu="comun"]')) { await page.click('[data-sal-menu="comun"]'); await page.waitForTimeout(300) }
  await abrirGeladot();
  await page.click('[data-add="194"]'); await page.waitForSelector("#cantOv");
  let ov = await txt("#cantOv");
  ok(/¿Cuántos gramos\?/.test(ov), "Salida: «¿Cuántos gramos?»");
  ok(/Pesá lo que sacás/.test(ov), "Salida: aviso «Pesá lo que sacás…»");
  ok(/\+1 caja · 2500 g \(caja entera\)/.test(ov), "Salida: botón «+1 caja · 2500 g (caja entera)»");
  for (const d of "12345") await page.click(`[data-cant-tecla="${d}"]`);
  ok((await page.inputValue("#cantNum")) === "12345", "pad acepta 5 dígitos: " + await page.inputValue("#cantNum"));
  ok(/Solo hay 2 cajas \+ 2000 g/.test(await txt("#cantMsg")) && await page.$eval("[data-cant-listo]", e => e.disabled), "pasarse del stock avisa «Solo hay …» y apaga Listo — " + await txt("#cantMsg"));
  await page.click('[data-cant-tecla="C"]'); await page.click("[data-cant-caja]");
  ok((await page.inputValue("#cantNum")) === "2500", "+1 caja suma 2500: " + await page.inputValue("#cantNum"));
  await page.click("[data-cant-listo]"); await page.waitForTimeout(200);
  ok(!(await page.$("#cantOv")), "Listo cierra el pad");
  ok(await page.evaluate(() => S.cart.salida["194"]) === 2500, "carrito de salida: 2500 g");
  // reabrir: arranca con lo cargado
  await page.click('[data-add="194"]'); await page.waitForSelector("#cantOv");
  ok((await page.inputValue("#cantNum")) === "2500", "reabrir arranca con lo ya cargado");
  await page.click("[data-cant-quitar]"); await page.waitForTimeout(200);
  ok(!(await page.evaluate(() => S.cart.salida["194"])), "«Quitar de la salida» saca el Geladot");

  // 4) Desperdicio
  await page.click("#volverSalidaMenu"); await page.waitForTimeout(200); await page.click('[data-sal-menu="desp"]'); await page.waitForTimeout(300); await abrirGeladot();
  await page.click('[data-add="195"], [data-wadd="195"]'); await page.waitForSelector("#cantOv");
  ov = await txt("#cantOv");
  ok(/¿Cuántos gramos\?/.test(ov) && /Pesá lo que sacás/.test(ov), "Desperdicio: pad de gramos con aviso");
  for (const d of "99999") await page.click(`[data-cant-tecla="${d}"]`);
  ok(/Solo hay 2 cajas \+ 2000 g para marcar como desperdicio/.test(await txt("#cantMsg")), "Desperdicio: «Solo hay …» — " + await txt("#cantMsg"));
  await page.click('[data-cant-tecla="C"]'); await page.click("[data-cant-caja]");
  ok((await page.inputValue("#cantNum")) === "2500", "Desperdicio: +1 caja = 2500");
  await page.click("[data-cant-listo]"); await page.waitForTimeout(200);
  ok(await page.evaluate(() => S.cart.desperdicio["195"]) === 2500, "carrito de desperdicio: 2500 g");

  // 5) ayuda
  await page.click("#ayudaBtn"); await page.waitForSelector("#ayudaOv");
  const tema = await page.$('[data-ay-tema="geladot"]');
  ok(!!tema && /Cómo retirar Geladot/.test(await tema.innerText()), "«?» tiene el tema «Cómo retirar Geladot»");
  if (tema) { await tema.click(); await page.waitForTimeout(150); ok(/2\.500 g/.test(await txt("#ayudaOv")) && /\+1 caja/.test(await txt("#ayudaOv")), "el tema explica gramos y caja") }

  // 5b) conteo en gramos con helper
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(1500);
  // Ingreso: gramos escritos a mano
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(400);
  if (await page.$('[data-ing-menu="merc"]')) { await page.click('[data-ing-menu="merc"]'); await page.waitForTimeout(300) }
  const pillI = await page.$('[data-familia="geladot"]'); if (pillI) { await pillI.click(); await page.waitForTimeout(300) }
  const ci = await page.$('input[data-cant-input="194"]');
  ok(!!ci, "Ingreso: Geladot tiene campo para escribir gramos");
  if (ci) { await ci.fill("1300"); await ci.dispatchEvent("input"); await page.waitForTimeout(150);
    
    ok(/1\.300|1300/.test(await page.inputValue('input[data-cant-input="194"]')) && /1,30 kg/.test(await txt("#main")), "Ingreso: 1300 g quedan cargados y dice 1,3 kg"); }
  await page.evaluate(() => document.querySelector("#tabs [data-t='stock']").click()); await page.waitForTimeout(500);
  await page.evaluate(() => abrirElegirConteo()); await page.waitForSelector("#contOv");
  await page.evaluate(() => { document.querySelector("#contOv [data-ce=\"todo\"]").click(); document.querySelector("#contOv [data-ce-empezar]").click() }); await page.waitForTimeout(700);
  const pill = await page.$('[data-familia="geladot"]'); if (pill) { await pill.click(); await page.waitForTimeout(300) }
  const campo = await page.$('input[data-c="194"]');
  ok(!!campo, "Conteo: hay campo de Geladot");
  if (campo) {
    ok(/gramos/i.test(await page.innerText('[data-gelhelp="194"]')), "helper explica que se cuenta en gramos");
    await campo.fill("3000"); await campo.dispatchEvent("input"); await page.waitForTimeout(150);
    const h = (await page.innerText('[data-gelhelp="194"]')).replace(/\s+/g, " ");
    ok(/1 caja \+ 500 g/.test(h) && /3,00 kg/.test(h), "helper: 3000 g = 1 caja + 500 g · 3,0 kg → " + h);
  }

  // 6) recarga
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(1500);
  ok(!!(await page.$("#tabs")), "recarga con sesión: la app abre");
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  if (await page.$('[data-sal-menu="comun"]')) { await page.click('[data-sal-menu="comun"]'); await page.waitForTimeout(300) }
  ok(!!(await page.$('[data-familia="geladot"]')), "tras recargar: pill Geladot");
  ok(err.length === 0, "sin errores de consola/pageerror" + (err.length ? ": " + err.join(" | ") : ""));
  console.log("FALLAS " + fallas); await b.close(); process.exit(fallas ? 1 : 0);
})();
