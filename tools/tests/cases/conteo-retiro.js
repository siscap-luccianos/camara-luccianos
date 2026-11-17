// Hub del Conteo inicial: cuando ya hay un conteo inicial de este mes, «Conteo cámara» queda apagado (el servidor también lo rechaza).
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  page.on("dialog", d => d.accept());
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);
  await (await page.$("#conteoInicialBtn"))?.click(); await page.waitForTimeout(500);
  ok(!!(await page.$("#conteoBtn")), "sin conteo inicial este mes: «Conteo cámara» se puede usar");
  await page.evaluate(() => { S.conteoBloqueado = true; S.cobertura = { tipo: "final", ts: Date.parse("2026-12-31T22:00:00-03:00") }; renderApp(); });
  ok(!(await page.$("#conteoBtn")) && !!(await page.$(".stkOff")), "con un conteo inicial de este mes: «Conteo cámara» queda apagado");
  ok(/🔒/.test(await page.innerText(".stkOff")), "y muestra el candado 🔒");
  const hub = (await page.innerText("#main")).replace(/\s+/g, " ");
  ok(/Arranca con el cierre del 31\/12/.test(hub), "el hub avisa que el mes arranca con el conteo final: no hace falta otro inicial");
  ok(!(await page.$("#invBtn")) && !!(await page.$("#invGuardadosBtn")), "Conteo local también queda apagado y Guardados sigue disponible");
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
