// Hub del Conteo inicial: con la cámara ya contada (sin inicial todavía) la cámara queda con candado y el Conteo local sigue disponible.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click("[data-tecla='" + d + "']"); }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1500);
  const h = await page.evaluate(() => { S.camaraBloqueada = true; S.conteoBloqueado = false; S.cobertura = null; return conteoInicialHubHTML() });
  ok((h.match(/stkOff/g) || []).length === 1 && /Cámara<\/b>/.test(h) && /Hecho · 🔒/.test(h), "la cámara ya contada queda apagada (🔒)");
  ok(/id="invBtn"/.test(h), "el Conteo local sigue disponible");
  const h2 = await page.evaluate(() => { S.camaraBloqueada = false; S.conteoBloqueado = false; return conteoInicialHubHTML() });
  ok(!/stkOff/.test(h2) && /id="conteoBtn"/.test(h2), "sin candado, los dos conteos están disponibles");
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
