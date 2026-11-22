// Parcial de un solo rubro: Supervisión lo solicita (uno o varios locales), el responsable ve «reconteo parcial · Rubro» y cuenta solo ese rubro;
// y «Habilitar reconteo» de un conteo cerrado deja elegir todo el local o un solo rubro.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  const set = o => page.evaluate(o => fetch("http://localhost:8999/", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ accion: "__set", set: o }) }), o);
  page.on("dialog", d => d.accept());
  await page.addInitScript(() => localStorage.setItem("idioma", "es"));
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]'); }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.click("#tabs [data-t='control']"); await page.waitForSelector("[data-ctl-chk]");
  const txt = () => page.innerText("#main");

  // 1) solicitar a un local: parcial de un solo rubro
  await page.click(".cgFin [data-ctl-pedir1='Obelisco CABA']"); await page.waitForSelector("[data-tp='parcial']");
  ok(!(await page.$("[data-tp-rubro]")), "al abrir no hay rubros: el parcial es de todo el local por defecto");
  await page.click("[data-tp='rubro']");
  const pills = await page.$$eval("[data-tp-rubro]", e => e.map(x => ({ r: x.dataset.tpRubro, off: x.disabled, t: x.textContent })));
  ok(pills.length === 7 && pills.map(p => p.r).join() === "vasquetas,baldes,icepops,glutenfree,chocolateria,pasteleria,bolleria", "los 7 rubros: " + pills.map(p => p.r).join());
  ok(pills.find(p => p.r === "baldes").off && /no lo lleva/.test(pills.find(p => p.r === "baldes").t), "Baldes apagado: «no lo lleva» (Obelisco lleva_baldes=NO)");
  ok(await page.$eval("[data-si]", e => e.disabled), "«Solicitar» está apagado hasta elegir el rubro");
  await page.click("[data-tp-rubro='vasquetas']");
  const nota = await page.innerText("#ctlTpNota");
  ok(/cámara \+ local/.test(nota) && /Vasquetas/.test(nota) && /El rubro solo se elige en el parcial/.test(nota), "la nota dice que se pide cámara + local de Vasquetas");
  await page.click("[data-tp='final']");
  ok(!(await page.$("[data-tp-rubro]")) && /Cierre del mes/.test(await page.innerText("#ctlTpNota")), "el cierre es siempre todo el local: no ofrece rubros");
  await page.click("[data-tp='rubro']"); await page.click("[data-tp-rubro='vasquetas']");
  await page.click("[data-si]"); await page.waitForTimeout(500);
  ok(/Solicitud parcial · Vasquetas/.test(await txt()), "la fila queda «Solicitud parcial · Vasquetas»");

  // 2) varios locales con un rubro que uno no lleva
  await page.check("[data-ctl-chk='Recoleta CABA']"); await page.check("[data-ctl-chk='Santa Rosa La Pampa']"); await page.waitForTimeout(150);
  await page.click("[data-ctl-masivo]"); await page.waitForSelector("[data-tp='rubro']"); await page.click("[data-tp='rubro']");
  ok(!(await page.$eval("[data-tp-rubro='baldes']", e => e.disabled)), "con varios locales sin Obelisco, Baldes se puede elegir");
  await page.click("[data-tp-rubro='icepops']"); await page.click("[data-si]"); await page.waitForTimeout(600);
  ok((await txt()).match(/Solicitud parcial · Icepops/g)?.length === 2, "el rubro elegido se manda a los dos locales");
  await page.check("[data-ctl-chk='Obelisco CABA']"); await page.click("[data-ctl-cancelmas]"); await page.waitForTimeout(500);
  await page.check("[data-ctl-chk='Obelisco CABA']"); await page.check("[data-ctl-chk='Local prueba']"); await page.click("[data-ctl-masivo]");
  await page.waitForSelector("[data-tp='rubro']"); await page.click("[data-tp='rubro']"); await page.click("[data-tp-rubro='baldes']");
  ok(/Se omiten 1 \(no lo llevan\)/.test(await page.innerText(".mantenerBox")), "avisa cuántos locales se omiten porque no lo llevan");
  await page.click("[data-no]");

  // 3) el responsable: aviso y conteo de un solo rubro
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.evaluate(() => { S.empleado.rol = "turno"; S.pedidoConteo = { id: "7", tipo: "parcial", rubro: "vasquetas" }; S.tab = "salida"; renderApp() });
  await page.waitForSelector("#pedidoConteoHacer");
  const av = await page.innerText(".avisoNovedad");
  ok(/Solicitud de reconteo parcial · Vasquetas/.test(av) && /solo vasquetas/i.test(av), "el aviso dice «Solicitud de reconteo parcial · Vasquetas»");
  await page.click("#pedidoConteoHacer"); await page.waitForTimeout(600);
  const m = await txt();
  ok(/Conteo parcial · Vasquetas · Cámara/.test(m) && /Contando solo\s+Vasquetas\. El resto del local no se toca/.test(m), "la pantalla dice «Contando solo Vasquetas. El resto del local no se toca»");
  ok(await page.$("[data-inv-row='4']") !== null && await page.$("[data-inv-row='49']") === null && await page.$("[data-inv-row='117']") === null, "solo hay sabores de vasquetas (no icepops ni chocolatería)");
  ok(!/Icepops|Chocolatería/.test(await page.innerText(".tabsCat")), "las pestañas de rubro muestran solo Vasquetas");
  const est = await page.evaluate(() => ({ r: S.inv.rubroPedido, n: invSabores().length }));
  ok(est.r === "vasquetas" && est.n >= 3, "el estado del conteo guarda el rubro: " + JSON.stringify(est));
  await page.evaluate(() => { S.inv=null; S.hubInicial=false; S.pedidoConteo=null; S.empleado.rol="admin"; renderApp() });
  // pedido sin rubro (cliente viejo): todo el local, como siempre
  await page.evaluate(() => { S.empleado.rol = "turno"; S.pedidoConteo = { id: "8", tipo: "parcial" }; S.tab = "salida"; renderApp() });
  await page.waitForSelector("#pedidoConteoHacer");
  ok(/Solicitud de nuevo conteo parcial/.test(await page.innerText(".avisoNovedad")), "sin rubro el aviso es el de siempre");
  await page.click("#pedidoConteoHacer"); await page.waitForTimeout(500);
  ok(/Icepops/.test(await page.innerText(".tabsCat")) && !/Contando solo/.test(await txt()) && !(await page.evaluate(() => S.inv.rubroPedido)), "sin rubro se cuentan todos los rubros (hay pestaña de Icepops)");
  await page.evaluate(() => { S.inv=null; S.hubInicial=false; S.pedidoConteo=null; S.empleado.rol="admin"; renderApp() });

  // 4) habilitar reconteo en Control
  await page.click("[data-t='control']").catch(() => {}); await page.fill("#local", "Operaciones").catch(() => {});
  await page.evaluate(() => { S.local=""; renderApp() }); await page.waitForTimeout(300);
  await page.click("#tabs [data-t='control']"); await page.waitForSelector("[data-ctl-chk]");
  await page.click("[data-cg-drag='Local prueba'] .cgSub"); await page.waitForSelector(".ctlAcc");
  // un parcial de un solo rubro solo se recuenta de su rubro
  await set({ parcialRubro: "vasquetas" });
  await page.click("[data-ctl-volver]"); await page.waitForSelector("[data-ctl-chk]");
  await page.click("[data-cg-drag='Local prueba'] .cgSub"); await page.waitForSelector(".ctlAcc");
  await page.click("[data-ctl-sel='8']"); await page.waitForSelector(".ctlAcc");
  ok(/Parcial · Vasquetas/.test(await page.innerText(".ctlAcc")) && /Parcial · Vasquetas/.test(await page.innerText(".chip[data-ctl-sel='8']")), "el parcial de un rubro se ve con su rubro en el resumen");
  await page.click("[data-ctl-desb='8']"); await page.waitForSelector("#ctlOv");
  ok(/solo de\s+Vasquetas/.test(await page.innerText("#ctlOv")) && !(await page.$("#ctlOv [data-hab]")), "al habilitar un parcial de un rubro solo se recuenta ese rubro (sin elegir)");
  ok(/Habilitar reconteo de Vasquetas/.test(await page.innerText("#ctlOv [data-ctl-si]")), "el botón dice «Habilitar reconteo de Vasquetas»");
  await page.click("#ctlOv [data-ctl-no]");
  await set({ parcialRubro: "" });
  // un inicial: todo el local o un solo rubro
  await page.click("[data-ctl-sel='7']"); await page.waitForSelector(".ctlAcc");
  await page.click("[data-ctl-desb='7']"); await page.waitForSelector("#ctlOv [data-hab]");
  ok(/Todo el local/.test(await page.innerText("#ctlOv")) && /Solo un rubro/.test(await page.innerText("#ctlOv")), "el diálogo ofrece «Todo el local» y «Solo un rubro»");
  await page.click("#ctlOv [data-hab='rubro']");
  const hp = await page.$$eval("#ctlOv [data-hab-rubro]", e => e.map(x => x.dataset.habRubro));
  ok(hp.join() === "vasquetas,icepops", "ofrece los rubros que tiene ese conteo: " + hp.join());
  await page.fill("#ctlMotivo", "Recontar Icepops"); await page.fill("#ctlPin", "1234");
  ok(await page.$eval("#ctlOv [data-ctl-si]", e => e.disabled), "sin elegir el rubro no se puede habilitar");
  await page.click("#ctlOv [data-hab-rubro='icepops']");
  ok(/Habilitar reconteo de Icepops/.test(await page.innerText("#ctlOv [data-ctl-si]")), "el botón dice «Habilitar reconteo de Icepops»");
  ok(await page.inputValue("#ctlMotivo") === "Recontar Icepops", "elegir el rubro no borra el motivo escrito");
  await page.click("#ctlOv [data-ctl-si]"); await page.waitForTimeout(700);
  ok(/Habilitado solo para Icepops/.test(await page.innerText(".ctlAcc")), "queda «Habilitado solo para Icepops»");
  // después del reconteo: el resumen dice «Icepops · corregido ×1»
  await set({ corrRubro: true });
  await page.click("[data-ctl-sel='8']"); await page.waitForSelector(".ctlAcc"); await page.click("[data-ctl-sel='7']"); await page.waitForTimeout(500);
  const rr = await page.innerText(".ctlCorrRubro");
  ok(/Icepops · corregido ×1/.test(rr) && /Marta/.test(rr) && /Los demás rubros no se tocaron/.test(rr), "el resumen dice «Icepops · corregido ×1», quién y que los demás rubros no se tocaron: " + rr.slice(0, 80));
  ok(err.length === 0, "sin errores de consola " + err.join(" | "));
  console.log("FALLAS " + fallas); await b.close(); process.exit(fallas ? 1 : 0);
})();
