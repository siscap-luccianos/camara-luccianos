// Vencimiento con año a medias en la pantalla: se corrige «26» → 2026 al salir del campo y «0002» apaga el botón.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.press("#authLocal", "Enter");
  await page.fill("#authClave", "op2024"); await page.press("#authClave", "Enter");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("[data-tecla]"); for (const d of "1234") await page.keyboard.press(d);
  await page.waitForSelector("header");
  const anio = new Date().getFullYear();
  ok(await page.evaluate(() => fechaVencValida("0002-05-10")) === false, "0002 no es una fecha válida");
  ok(await page.evaluate(() => fechaVencValida("0026-05-10")) === false, "0026 no es una fecha válida");
  ok(await page.evaluate(a => fechaVencValida(a + "-05-10"), anio) === true, "el año actual sí");
  ok(await page.evaluate(() => loteProblema("ing:117", "117", 5, "0002-05-10")) === "fecha", "un ingreso con 0002 queda con problema (el botón de confirmar se apaga)");
  const pb = await page.evaluate(a => String(loteProblema("ing:117", "117", 5, a + "-05-10")), anio);
  ok(pb === "null", "con fecha buena no hay problema (" + pb + ")");
  // «26» tipeado en Chrome queda 0026: al salir del campo pasa a 2026 y avisa al estado
  const r = await page.evaluate(() => {
    const i = document.createElement("input"); i.type = "date"; i.dataset.venc = "117"; document.body.appendChild(i);
    let evs = 0; i.addEventListener("input", () => evs++);
    i.value = "0026-05-10"; i.focus(); i.blur();
    return { v: i.value, evs };
  });
  ok(r.v === "2026-05-10" && r.evs >= 1, "«0026» al salir del campo pasa a 2026 y dispara el cambio (" + JSON.stringify(r) + ")");
  const r2 = await page.evaluate(() => {
    const i = document.createElement("input"); i.type = "date"; i.dataset.venc = "117"; document.body.appendChild(i);
    i.value = "0002-05-10"; i.focus(); i.blur();
    return { v: i.value, t: document.getElementById("toast").textContent };
  });
  ok(/Revisá el año/.test(r2.t), "«0002» (año que no se arregla solo) avisa: " + r2.t);
  ok(err.length === 0, "sin errores de consola " + JSON.stringify(err));
  console.log(fallas ? "FALLAS " + fallas : "TODO OK");
  await b.close();
})().catch(e => { console.error("ERROR", e.message); process.exit(1) });
