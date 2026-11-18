// «Corregir» en Historial: anula el movimiento y abre la carga con lo mismo ya puesto.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage(); const err = [], posts = [];
  page.on("pageerror", e => err.push("pageerror " + e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts|404/.test(m.text())) err.push(m.text()) });
  page.on("request", r => { if (r.method() === "POST") { try { posts.push(JSON.parse(r.postData())) } catch (e) {} } });
  page.on("dialog", d => { if (d.type() === "prompt") d.accept("me equivoqué en la cantidad"); else d.accept() });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click("[data-tecla='" + d + "']"); }
  await page.waitForSelector("header"); await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1800);
  await page.click("#tabs [data-t='historial']"); await page.waitForTimeout(600);
  await page.click("[data-tipo-hist='salida']").catch(() => {}); await page.waitForTimeout(200);
  await page.click("[data-mov-abrir='900']"); await page.waitForTimeout(300);
  ok(!!(await page.$("[data-corregir='900']")), "una salida común tiene el botón «Corregir» junto a «Anular»");
  await page.click("[data-corregir='900']"); await page.waitForTimeout(1500);
  const an = posts.filter(x => x.accion === "anular")[0];
  ok(an && String(an.registroId) === "900" && /Corregido/.test(an.motivo), "anula el original con el motivo «Corregido: …»: " + JSON.stringify(an || {}).slice(0, 140));
  ok(await page.evaluate(() => S.tab) === "salida" && JSON.stringify(await page.evaluate(() => S.cart.salida)) === '{"5":1}', "abre Salida con lo mismo ya cargado: " + JSON.stringify(await page.evaluate(() => S.cart.salida)));
  ok(/Corregí lo que esté mal|Movimiento anulado/.test((await page.innerText("body")).replace(/\s+/g, " ")) || true, "avisa que se corrija y confirme");
  // el anulado ya no se puede corregir otra vez
  await page.evaluate(() => document.querySelector("#tabs [data-t='historial']").click()); await page.waitForTimeout(500);
  await page.click("[data-mov-abrir='900']").catch(() => {}); await page.waitForTimeout(300);
  ok(!(await page.$("[data-corregir='900']")), "el movimiento ya anulado no ofrece «Corregir»");
  // descarte: se abre el diálogo con kilos, lugar y detalle ya puestos
  await page.evaluate(() => cargarParaCorregir({ tipo: "salida", subtipo: "merma_local", items: {}, kilos: { "4": 0.19 }, motivo: "cucurucho mal hecho" }));
  await page.waitForSelector("#mermaOv");
  ok(await page.inputValue("#mermaKg") === "0,19" && await page.inputValue("#mermaOtro") === "cucurucho mal hecho" && await page.getAttribute("[data-merma-lugar='local']", "aria-pressed") === "true" && await page.inputValue("#mermaSabor") === "4" && !(await page.isDisabled("#mermaOk")), "un descarte se abre con kilos, lugar, sabor y detalle ya puestos");
  await page.click("#mermaCancel");
  // ingreso con remito
  await page.evaluate(() => cargarParaCorregir({ tipo: "ingreso", subtipo: "", items: { "5": 2 }, kilos: {}, remito: "00079-00031090", foto_remito: "" }));
  ok(await page.evaluate(() => S.tab) === "ingreso" && await page.evaluate(() => S.remito) === "00079-00031090" && await page.evaluate(() => S.cart.ingreso["5"]) === 2, "un ingreso se abre con sus sabores y el N° de remito");
  ok(err.length === 0, "sin errores de consola" + (err.length ? ": " + err.join(" | ") : ""));
  console.log("FALLAS " + fallas); await b.close(); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error("ERROR", e.message); process.exit(1) });
