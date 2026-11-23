// Aviso de versión nueva: cuadro centrado imposible de pasar por alto; «Actualizar ahora» recarga limpio; «Más tarde» lo cierra y vuelve a los 10 min.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let f = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) f++ };
  await page.route(/\?nocache=/, r => r.fulfill({ status: 200, contentType: "text/html", body: 'x FRONTEND_VERSION = "99.0.0" x' }));
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.evaluate(() => { window.__t = []; const st = window.setTimeout; window.setTimeout = (fn, ms, ...a) => { if (ms === 600000) { window.__t.push(fn); return 0 } return st(fn, ms, ...a) } });
  await page.evaluate(() => chequearVersionNueva()); await page.waitForSelector("#avisoVersionOv");
  const txt = await page.innerText("#avisoVersionOv");
  ok(/Actualizá LogiStock/.test(txt) && /99\.0\.0/.test(txt) && /Actualizar ahora/.test(txt), "aparece el cuadro con la versión nueva y «Actualizar ahora»");
  const box = await page.$eval("#avisoVersionOv .mantenerBox", e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } });
  ok(box.x >= 0 && box.x + box.w <= 390 && box.y >= 0 && box.y + box.h <= 844, "el cuadro entra completo en un celular");
  ok(await page.$$eval("#avisoVersionOv", e => e.length) === 1, "hay un solo aviso aunque se vuelva a chequear");
  await page.evaluate(() => chequearVersionNueva()); await page.waitForTimeout(300);
  ok(await page.$$eval("#avisoVersionOv", e => e.length) === 1, "chequear de nuevo no lo duplica");
  // Más tarde
  await page.click("#btnAvisoMasTarde"); await page.waitForTimeout(200);
  ok(await page.$("#avisoVersionOv") === null, "«Más tarde» lo cierra");
  ok(await page.evaluate(() => window.__t.length) === 1, "queda programado para volver a los 10 minutos");
  await page.evaluate(() => window.__t[0]()); await page.waitForSelector("#avisoVersionOv", { timeout: 3000 });
  ok(true, "a los 10 minutos vuelve a aparecer si todavía no actualizó");
  // Actualizar ahora: recarga con ?v=
  await page.click("#btnActualizarApp"); await page.waitForURL(/\?v=99\.0\.0/, { timeout: 5000 }).catch(() => {});
  ok(/\?v=99\.0\.0/.test(page.url()), "«Actualizar ahora» recarga con la versión nueva en la dirección: " + page.url());
  console.log("errores:", err.length ? err : "ninguno");
  console.log(f || err.length ? "FALLAS " + (f + err.length) : "FALLAS 0"); await b.close(); process.exit(f || err.length ? 1 : 0);
})();
