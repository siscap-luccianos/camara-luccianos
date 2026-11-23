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
  // 2) stock «3 cajas (1 abierta)»
  ok(/3\s*cajas\s*·\s*1 abierta/.test(await txt('[data-add="194"]')), "Salida: la tarjeta dice «3 cajas · 1 abierta» chico, como las demás — " + await txt('[data-add="194"]'));
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(300);
  ok(!!(await page.$('[data-familia="geladot"]')), "Stock: pill Geladot");
  await abrirGeladot();
  ok(/3 cajas \(1 abierta\)/.test(await txt("main")), "Stock: «3 cajas (1 abierta)»");

  // 3) Salida con pad
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  if (await page.$('[data-sal-menu="comun"]')) { await page.click('[data-sal-menu="comun"]'); await page.waitForTimeout(300) }
  await abrirGeladot();
  const posts = []; page.on("request", r => { if (r.method() === "POST") { try { posts.push(JSON.parse(r.postData())) } catch (e) {} } });
  await page.click('[data-add="194"]'); await page.waitForSelector("#repOv");
  let ov = await txt("#repOv");
  ok(/Reposición de Geladot/.test(ov) && /2 cajas cerradas/.test(ov) && /1 caja ABIERTA de 2\.000 g/.test(ov), "Reposición: paso 1 muestra cajas cerradas y la abierta — " + ov.replace(/\s+/g, " ").slice(0, 160));
  ok(/Siempre usá primero la caja ABIERTA/.test(ov), "Reposición: regla «siempre primero la abierta»");
  ok(await page.$eval("[data-rep-ok]", e => e.disabled), "Reposición: Confirmar apagado sin elegir caja");
  await page.click('[data-rep-caja="abierta"]');
  ov = await txt("#repOv");
  ok(/ABIERTA/.test(ov) && /fibrón/.test(ov) && /balanza/.test(ov), "Reposición: instrucciones de fraccionar, pesar y fibrón");
  await page.evaluate(() => { const b = document.querySelector("#repOv .mantenerBox"); b.scrollTop = b.scrollHeight });
  const top0 = await page.evaluate(() => document.querySelector("#repOv .mantenerBox").scrollTop);
  await page.click('[data-rep-tecla="2"]'); await page.waitForTimeout(100);
  const top1 = await page.evaluate(() => document.querySelector("#repOv .mantenerBox").scrollTop);
  ok(!!(await page.$("#repOv")) && Math.abs(top1 - top0) < 3 && top0 > 0, "Reposición: al tipear un número no salta ni se cierra (scroll " + top0 + " → " + top1 + ")");
  await page.click('[data-rep-tecla="⌫"]');
  for (const d of ["2", ",", "5", "0", "0"]) await page.click(`[data-rep-tecla="${d}"]`);
  ok(/no puede pesar más de 2\.000 g/.test(await txt("#repOv")), "Reposición: la abierta no puede pesar más de lo que tenía");
  for (let i = 0; i < 6; i++) await page.click('[data-rep-tecla="⌫"]');
  for (const k of ["1", ",", "5", "Backspace", "3", "0", "0"]) await page.keyboard.press(k);
  ok((await page.inputValue("#repNum")) === "1,300", "Reposición: el teclado físico escribe kilos con coma (1,5,⌫,3,0,0 → " + await page.inputValue("#repNum") + ")");

  ov = await txt("#repOv");
  ok(/Usaste 700 g/.test(ov) && /3 cajas \(1 abierta\)/.test(ov), "Reposición: la app calcula «Usaste 700 g» y lo que queda — " + ov.replace(/\s+/g, " ").slice(-200));
  ok(/1,300 kg = 1\.300 g/.test(await txt("#repOv")) && /Usaste 700 g \(0,70 kg\)/.test(await txt("#repOv")), "Reposición: escribe 1,300 kg y muestra 1.300 g · usaste 0,70 kg");
  await page.click("[data-rep-ok]"); await page.waitForTimeout(900);
  const rp = posts.filter(x => x.accion === "registrar" && x.subtipo === "reposicion")[0];
  ok(rp && rp.tipo === "salida" && rp.items["194"] === 700, "Reposición: manda salida subtipo reposicion con 700 g: " + JSON.stringify(rp));
  ok(!(await page.$("#repOv")), "Reposición: se cierra al confirmar");

  // 4) Desperdicio
  await page.click("#volverSalidaMenu"); await page.waitForTimeout(200); await page.click('[data-sal-menu="desp"]'); await page.waitForTimeout(300); await abrirGeladot();
  await page.click('[data-add="195"], [data-wadd="195"]'); await page.waitForSelector("#cantOv");
  ov = await txt("#cantOv");
  ok(/¿Cuántos kilos\?/.test(ov) && /Pesá lo que sacás/.test(ov), "Desperdicio: pad de kilos con aviso");
  for (const d of ["9", ",", "9", "9", "9"]) await page.click(`[data-cant-tecla="${d}"]`);
  ok(/Solo hay 3 cajas \(1 abierta\) para marcar como desperdicio/.test(await txt("#cantMsg")), "Desperdicio: «Solo hay …» — " + await txt("#cantMsg"));
  await page.click('[data-cant-tecla="⌫"]'); await page.click('[data-cant-tecla="⌫"]'); await page.click('[data-cant-tecla="⌫"]'); await page.click('[data-cant-tecla="⌫"]'); await page.click('[data-cant-tecla="⌫"]');
  await page.click('[data-cant-tecla="0"]'); await page.click('[data-cant-tecla=","]'); await page.click('[data-cant-tecla="0"]'); await page.click('[data-cant-tecla="3"]'); await page.click('[data-cant-tecla="0"]');
  ok((await page.inputValue("#cantNum")) === "0,030" && /30 g/.test(await txt("#cantKg")), "Desperdicio: 0,030 kg = 30 g — " + await txt("#cantKg"));
  for (let i = 0; i < 5; i++) await page.click('[data-cant-tecla="⌫"]');
  await page.click("[data-cant-caja]");
  ok((await page.inputValue("#cantNum")) === "2,500", "Desperdicio: +1 caja = 2,500 kg: " + await page.inputValue("#cantNum"));
  await page.click("[data-cant-listo]"); await page.waitForTimeout(200);
  ok(await page.evaluate(() => S.cart.desperdicio["195"]) === 2500, "carrito de desperdicio: 2500 g");

  // 5) ayuda
  await page.click("#ayudaBtn"); await page.waitForSelector("#ayudaOv");
  const tema = await page.$('[data-ay-tema="geladot"]');
  ok(!!tema && /Geladot: cómo se retira/.test(await tema.innerText()), "«?» tiene el tema «Geladot: cómo se retira»");
  if (tema) { await tema.click(); await page.waitForTimeout(150); ok(/2,500 kg/.test(await txt("#ayudaOv")) && /ABIERTA/.test(await txt("#ayudaOv")) && /fibrón/.test(await txt("#ayudaOv")), "el tema explica la caja abierta, el fibrón y pesar") }

  // 5b) conteo en gramos con helper
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(1500);
  // Ingreso: gramos escritos a mano
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(400);
  if (await page.$('[data-ing-menu="merc"]')) { await page.click('[data-ing-menu="merc"]'); await page.waitForTimeout(300) }
  const pillI = await page.$('[data-familia="geladot"]'); if (pillI) { await pillI.click(); await page.waitForTimeout(300) }
  const ci = await page.$('input[data-cant-input="194"]');
  ok(!!ci, "Ingreso: Geladot tiene campo para escribir gramos");
  if (ci) { await ci.fill("1,300"); await ci.dispatchEvent("input"); await page.waitForTimeout(150);
    
    ok(/1,300/.test(await page.inputValue('input[data-cant-input="194"]')) && /1\.300 g/.test(await txt("#main")), "Ingreso: 1,300 kg quedan cargados y dice 1.300 g"); }
  await page.evaluate(() => document.querySelector("#tabs [data-t='stock']").click()); await page.waitForTimeout(500);
  await page.evaluate(() => abrirElegirConteo()); await page.waitForSelector("#contOv");
  await page.evaluate(() => { document.querySelector("#contOv [data-ce=\"todo\"]").click(); document.querySelector("#contOv [data-ce-empezar]").click() }); await page.waitForTimeout(700);
  const pill = await page.$('[data-familia="geladot"]'); if (pill) { await pill.click(); await page.waitForTimeout(300) }
  const campo = await page.$('input[data-c="194"]');
  ok(!!campo, "Conteo: hay campo de Geladot");
  if (campo) {
    ok(/kilos/i.test(await page.innerText('[data-gelhelp="194"]')), "helper explica que se escribe en kilos");
    await campo.fill("3,000"); await campo.dispatchEvent("input"); await page.waitForTimeout(150);
    const h = (await page.innerText('[data-gelhelp="194"]')).replace(/\s+/g, " ");
    ok(/3\.000 g/.test(h) && /2 cajas \(1 abierta\)/.test(h), "helper: 3,000 kg = 3.000 g = 1 caja + 500 g → " + h);
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
