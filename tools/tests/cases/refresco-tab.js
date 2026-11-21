// Un refresco (recargar la página) deja a la persona en la pestaña en la que estaba, en el mismo local.
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
  await page.click("#tabs [data-t='historial']"); await page.waitForTimeout(300);
  ok(await page.$eval("#tabs [data-t='historial']", e => e.getAttribute("aria-selected")) === "true", "estoy en Historial");
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(1200);
  ok(await page.$eval("#tabs [data-t='historial']", e => e.getAttribute("aria-selected")) === "true", "después de recargar sigo en Historial (no vuelve a Salida)");
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(300);
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(1200);
  ok(await page.$eval("#tabs [data-t='stock']", e => e.getAttribute("aria-selected")) === "true", "y lo mismo con Stock");
  // otra persona / otro local: no hereda la pestaña
  await page.evaluate(() => sessionStorage.setItem("tabLocal", JSON.stringify({ l: "Otro local", e: "1", t: "stock" })));
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(1200);
  ok(await page.$eval("#tabs [data-t='salida']", e => e.getAttribute("aria-selected")) === "true", "una pestaña guardada de otro local no se aplica");
  ok(err.length === 0, "sin errores de consola " + err.join(" | "));
  console.log("FALLAS " + fallas); await b.close(); process.exit(fallas ? 1 : 0);
})();
