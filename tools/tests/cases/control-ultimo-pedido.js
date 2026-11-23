// «Último pedido» (Control › Mis grupos) muestra solo los locales del último pedido.
// (base copiada de solicitud-rubro.js) Supervisión lo solicita (uno o varios locales), el responsable ve «reconteo parcial · Rubro» y cuenta solo ese rubro;
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

  // pedido masivo a 2 locales -> se guarda «Último pedido»
  await page.check("[data-ctl-chk='Recoleta CABA']"); await page.check("[data-ctl-chk='Santa Rosa La Pampa']"); await page.waitForTimeout(150);
  await page.click("[data-ctl-masivo]"); await page.waitForSelector("[data-tp='parcial']"); await page.click("[data-si]"); await page.waitForTimeout(900);
  await page.waitForSelector("[data-ctl-gultimo]");
  const antes = await page.$$eval("[data-ctl-chk]", e => e.length);
  ok(antes > 2, "la lista completa tiene más de 2 locales: " + antes);
  await page.click("[data-ctl-gultimo]"); await page.waitForTimeout(200);
  const filas = await page.$$eval("[data-ctl-chk]", e => e.map(x => x.dataset.ctlChk).sort());
  ok(filas.join("|") === "Recoleta CABA|Santa Rosa La Pampa", "al tocar «Último pedido» se ven solo los locales que se pidieron: " + filas.join(", "));
  ok(/Último pedido/.test(await page.innerText(".cgCab h2")) && /a los que les pediste/.test(await page.innerText(".cgSubT")), "el título dice «Último pedido» y explica qué es");
  ok(!(await page.$("[data-cg-borrarg]")), "no ofrece borrar el grupo (es automático)");
  ok(/Solicitar conteo a los 2/.test(await page.innerText(".cgCab")), "ofrece «Solicitar conteo a los 2»");
  await page.click("[data-ctl-gultimo]"); await page.waitForTimeout(200);
  ok((await page.$$eval("[data-ctl-chk]", e => e.length)) === antes, "tocar de nuevo vuelve a la lista completa");
  // quitarlo de la lista
  await page.click("[data-ctl-gultimo]"); await page.waitForTimeout(200);
  await page.click(".cgCab [data-ctl-gultimo-quitar]"); await page.waitForTimeout(700);
  ok(!(await page.$("[data-ctl-gultimo]")), "«Quitar de la lista» saca «Último pedido» de Mis grupos");
  ok((await page.$$eval("[data-ctl-chk]", e => e.length)) === antes, "y vuelve a la lista completa");
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
