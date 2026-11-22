// (varios) Parcial de uno o más rubros: Supervisión lo solicita (uno o varios locales), el responsable ve «reconteo parcial · Rubro» y cuenta solo ese rubro;
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

  // varios rubros: se marcan Vasquetas e Icepops (no Chocolatería)
  await page.click(".cgFin [data-ctl-pedir1='Obelisco CABA']"); await page.waitForSelector("[data-tp='parcial']");
  await page.click("[data-tp='rubro']");
  await page.click("[data-tp-rubro='vasquetas']"); await page.click("[data-tp-rubro='icepops']");
  const on = await page.$$eval("[data-tp-rubro][aria-pressed='true']", e => e.map(x => x.dataset.tpRubro));
  ok(on.join() === "vasquetas,icepops", "se pueden marcar dos rubros: " + on.join());
  ok(/Vasquetas \+ Icepops/.test(await page.innerText("#ctlTpNota")), "la nota nombra los dos rubros");
  await page.click("[data-tp-rubro='vasquetas']");
  ok((await page.$$eval("[data-tp-rubro][aria-pressed='true']", e => e.length)) === 1, "tocar de nuevo desmarca");
  await page.click("[data-tp-rubro='vasquetas']");
  await page.click("[data-si]"); await page.waitForTimeout(500);
  ok(/Solicitud parcial · Vasquetas \+ Icepops/.test(await txt()), "la fila queda «Solicitud parcial · Vasquetas + Icepops»");
  // el responsable ve los dos rubros y no el resto
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.evaluate(() => { S.empleado.rol = "turno"; S.pedidoConteo = { id: "7", tipo: "parcial", rubro: "vasquetas,icepops" }; S.tab = "salida"; renderApp() });
  await page.waitForSelector("#pedidoConteoHacer");
  ok(/Solicitud de reconteo parcial · Vasquetas \+ Icepops/.test(await page.innerText(".avisoNovedad")), "el aviso del responsable nombra los dos rubros");
  await page.click("#pedidoConteoHacer"); await page.waitForTimeout(600);
  const est = await page.evaluate(() => ({ r: S.inv && S.inv.rubroPedido, g: S.inv && invGrupos().join() }));
  ok(est.r === "vasquetas,icepops" && est.g === "vasquetas,icepops", "el conteo cubre solo esos dos rubros: " + JSON.stringify(est));
  const tabs = await page.innerText(".tabsCat");
  ok(/Vasquetas/.test(tabs) && /Icepops/.test(tabs) && !/Chocolatería/.test(tabs), "las pestañas muestran Vasquetas e Icepops, sin Chocolatería");
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
