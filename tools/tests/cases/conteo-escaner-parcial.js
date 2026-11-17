// Conteo parcial (pedido por supervisión): «Contar escaneando» en la cámara y en el local, vasquetas, a ciegas.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  page.on("dialog", d => d.accept());
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.evaluate(() => { S.tab = "stock"; S.hubInicial = true; S.inv = null; invIniciarParcial("1"); });
  await page.waitForTimeout(400);
  const cajaBanana = "99" + "0004" + "000355" + "00778" + "290926" + "21" + "015";   // 7,78 kg = 2 × 3,89
  const vasqFrut = "0020" + "00364" + "290926" + "22" + "031";
  const scan = async c => { await page.evaluate(x => procesarEscaneoConteo(x), c); await page.waitForTimeout(80) };
  ok(await page.$("#escConteoBtn") !== null, "paso 1 (cámara): aparece «Contar escaneando»");
  ok(!/Cámara:/.test(await page.innerText("#main")), "sigue a ciegas (no muestra el sistema)");
  await page.click("#escConteoBtn"); await page.waitForSelector("#escanerOv");
  await scan(cajaBanana);
  ok(await page.evaluate(() => S.inv.items["4"]) === 7.78 && (await page.evaluate(() => S.inv.pesos["4"].length)) === 2, "caja = 2 vasquetas de 3,89 kg en las casillas de la cámara");
  await scan(vasqFrut);
  ok(await page.evaluate(() => S.inv.items["20"]) === 3.64, "vasqueta suelta = 1 casilla con su peso");
  await page.click("[data-esc-cerrar]"); await page.waitForTimeout(300);
  ok(await page.evaluate(() => invCamaraLive()["4"].u === 2 && Math.abs(invCamaraLive()["4"].k - 7.78) < 0.01), "la cámara contada queda con 2 vasquetas y 7,78 kg");
  ok(/Escaneado: 1 caja/.test(await page.innerText("#main")), "la fila muestra «Escaneado: 1 caja»");
  // a mano saca la marca
  await page.fill('[data-inv-w="4:0"]', "3,9"); await page.waitForTimeout(150);
  ok(!/Escaneado: 1 caja/.test(await page.innerText("#main")), "escribir a mano saca la marca de escaneado");
  // paso 2: local, con su propio escaneo
  await page.click("#invFaseLocal"); await page.waitForTimeout(300);
  ok(await page.$("#escConteoBtn") !== null && (await page.evaluate(() => ceEsc().items.length)) === 0, "paso 2 (local): también hay escáner y arranca sin lecturas");
  await page.click("#escConteoBtn"); await page.waitForSelector("#escanerOv");
  await scan(vasqFrut); await page.click("[data-esc-cerrar]"); await page.waitForTimeout(300);
  ok(await page.evaluate(() => S.inv.items["20"]) === 3.64, "en el local se cuenta aparte: Frutilla 3,64 kg");
  await page.click("#invFaseCam"); await page.waitForTimeout(300);
  ok(await page.evaluate(() => S.inv.items["20"]) === 3.64 && (await page.evaluate(() => ceEsc().items.length)) === 1, "volver a la cámara conserva lo escaneado ahí (1 lectura)");
  // 25 vasquetas de un mismo sabor: una fila compacta, no 25 casillas
  await page.evaluate(() => { [S.inv.items, S.inv.pesos, S.inv.tocado].forEach(o => Object.keys(o).forEach(k => delete o[k])); ceEsc().items = []; ceEsc().previo = {}; renderApp(); });
  await page.click("#escConteoBtn"); await page.waitForSelector("#escanerOv");
  for (let i = 0; i < 25; i++) await scan("0020" + String(300 + i).padStart(5, "0") + "290926" + "22" + "031");
  await page.click("[data-esc-cerrar]"); await page.waitForTimeout(400);
  ok(await page.evaluate(() => S.inv.pesos["20"].length) === 25, "25 lecturas = 25 pesos");
  ok((await page.$$('[data-inv-row="20"] input.invW')).length === 0 && /25 vasquetas/.test(await page.innerText('[data-inv-row="20"]')), "la fila queda compacta: «25 vasquetas», sin 25 casillas");
  ok(await page.evaluate(() => invCamaraLive()["20"].u) === 25, "cuenta 25 vasquetas en la cámara");
  await page.click('[data-inv-verpesos="20"]'); await page.waitForTimeout(200);
  ok((await page.$$('[data-inv-row="20"] input.invW')).length === 25, "«Ver pesos» muestra las 25 casillas");
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
