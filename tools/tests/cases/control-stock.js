// Control de stock (Operaciones) y aviso de conteo parcial al responsable.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  page.on("dialog", d => d.accept());
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click("[data-tecla='" + d + "']"); }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  ok(!!(await page.$("#tabs [data-t='control']")), "Operaciones tiene la pestaña Control");
  await page.click("#tabs [data-t='control']"); await page.waitForSelector(".ctlTabla"); await page.waitForTimeout(300);
  const txt = await page.innerText("#main");
  ok(/Local prueba/.test(txt) && /Recoleta CABA/.test(txt), "lista los locales");
  ok(/Controlado/.test(txt) && /Sin pedir/.test(txt), "muestra el estado de cada uno");
  ok(/faltan 3,2 kg/i.test(txt), "muestra la diferencia: " + (txt.match(/faltan[^\n]*/i) || [""])[0]);
  await page.click("[data-ctl-ver='Local prueba']"); await page.waitForTimeout(200);
  const det = await page.innerText(".ctlDetalle");
  ok(/Banana Split/.test(det) && /bloqueado/.test(det) && /Una diferencia que no se detecta es merma/.test(det), "el detalle lista el producto, el candado y la nota de merma");
  // pedir conteo a Recoleta
  await page.click("[data-ctl-pedir='Recoleta CABA']"); await page.waitForTimeout(500);
  ok(/Pedido · sin contar/.test(await page.innerText("#main")) && !!(await page.$("[data-ctl-cancel='Recoleta CABA']")), "pedir conteo deja el estado «Pedido · sin contar» y ofrece cancelar");
  await page.click("[data-ctl-cancel='Recoleta CABA']"); await page.waitForTimeout(500);
  ok(/Sin pedir/.test(await page.innerText("#main")), "cancelar el pedido lo vuelve a «Sin pedir»");
  await page.click("[data-ctl-pedir='Recoleta CABA']"); await page.waitForTimeout(400);
  // desbloquear
  await page.click("[data-ctl-desb='7']"); await page.waitForSelector("#ctlOv");
  await page.click("[data-ctl-si]"); ok(/motivo/i.test(await page.innerText("#ctlErr")), "pide motivo");
  await page.fill("#ctlMotivo", "Recuento por diferencia"); await page.fill("#ctlPin", "0000"); await page.click("[data-ctl-si]"); await page.waitForTimeout(400);
  ok(/incorrecto/i.test(await page.innerText("#ctlErr")), "PIN incorrecto: no desbloquea");
  await page.fill("#ctlPin", "1234"); await page.click("[data-ctl-si]"); await page.waitForTimeout(600);
  ok(!(await page.$("#ctlOv")) && /desbloqueado hasta/.test(await page.innerText("#main")), "con PIN y motivo queda desbloqueado y se ve hasta cuándo");
  ok(!!(await page.$("[data-ctl-print]")), "hay PDF por local");
  // responsable ve el aviso
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1500);
  await page.evaluate(() => { S.empleado.rol = "encargado"; S.pedidoConteo = { id: "1", local: "Local prueba", ts: Date.now(), por: "Gabi" }; renderApp(); });
  ok(/Solicitud de nuevo conteo parcial/.test(await page.innerText("#main")), "el responsable ve el aviso «Solicitud de nuevo conteo parcial»");
  await page.click("#pedidoConteoHacer"); await page.waitForTimeout(500);
  ok(await page.evaluate(() => !!(S.inv && S.inv.paso === "contar" && S.inv.pedidoId === "1")), "«Hacer el conteo» abre el Conteo local atado al pedido");
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
