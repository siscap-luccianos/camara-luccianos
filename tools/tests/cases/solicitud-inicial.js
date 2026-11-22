// El responsable recibe la «Solicitud de conteo inicial» y «Hacer el conteo» abre el Conteo inicial de siempre.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.addInitScript(() => { try { localStorage.setItem("idioma", "es") } catch (e) {} });
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]'); }
  await page.waitForSelector("header"); await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.evaluate(() => { S.empleado.rol = "turno"; S.pedidoConteo = { id: "7", tipo: "inicial" }; S.tab = "salida"; renderApp() });
  await page.waitForSelector("#pedidoConteoHacer");
  const t = await page.innerText(".avisoNovedad");
  ok(/Solicitud de conteo inicial/.test(t) && /stock de arranque/.test(t), "el responsable de turno ve «Solicitud de conteo inicial»: " + t.slice(0, 60).replace(/\n/g, " "));
  await page.click("#pedidoConteoHacer"); await page.waitForTimeout(500);
  const est = await page.evaluate(() => ({ hub: !!S.hubInicial, inv: !!S.inv, tab: S.tab }));
  ok(est.hub && !est.inv && est.tab === "stock", "abre el Conteo inicial de siempre (sin el modo a ciegas del parcial): " + JSON.stringify(est));
  ok(err.length === 0, "sin errores de consola " + err.join(" | "));
  console.log("FALLAS " + fallas); await b.close(); process.exit(fallas ? 1 : 0);
})();
