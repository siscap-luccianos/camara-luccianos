// Caja entera en Salida (1.234.0): el escáner pregunta «¿cerrada y completa?» y suma 2 vasquetas con la mitad de los kilos cada una;
// el rótulo de 28 dígitos viaja con las dos pesadas; en Devolución cada una figura «de caja» con peso estimado y se pesa al devolver.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = [], posts = []; page.on("pageerror", e => err.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/ERR_|404/.test(m.text())) err.push(m.text()) });
  page.on("request", q => { if (q.method() === "POST") { try { const x = JSON.parse(q.postData() || "{}"); if (x.accion === "registrar") posts.push(x) } catch (e) {} } });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  const E = (f, a) => page.evaluate(f, a);
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Local prueba"); await page.waitForTimeout(300); await page.click("#authLocalOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]:has-text('Luc')"); await page.waitForSelector("[data-tecla]");
  for (const d of "1234") await page.click('[data-tecla="' + d + '"]');
  await page.waitForSelector("header"); await page.waitForTimeout(1200);

  const caja = "99" + "0004" + "000355" + "00778" + "131025" + "21" + "057";   // Banana Split, 7,78 kg = 2 × 3,89
  const scan = async c => { await E(x => procesarEscaneo(x, false), c); await page.waitForTimeout(100) };
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(400); await page.click(".menuHero"); await page.waitForTimeout(500);
  await page.click("#irEscaner"); await page.waitForSelector("#escanerOv");

  // 1) la caja pregunta y no suma hasta confirmar
  await scan(caja);
  ok(await E(() => !!S.escaner.cajaPend), "escanear una caja abre la pregunta");
  ok(/cerrada y completa/i.test(await page.innerText("#escMsg")), "el aviso dice «¿La caja está cerrada y completa?»");
  ok(await page.$("[data-esc-caja='si']") !== null && await page.$("[data-esc-caja='no']") !== null, "están los botones Sí y No");
  ok((await E(() => S.cart.salida["4"] || 0)) === 0, "todavía no suma nada");

  // 2) «No, una por una» no suma y pide escanear de a una
  await page.click("[data-esc-caja='no']"); await page.waitForTimeout(150);
  ok((await E(() => S.cart.salida["4"] || 0)) === 0 && /una por una/i.test(await page.innerText("#escMsg")), "«No» no suma y pide escanear las vasquetas una por una");

  // 3) «Sí» suma 2 con la mitad de los kilos cada una
  await scan(caja); await page.click("[data-esc-caja='si']"); await page.waitForTimeout(200);
  ok((await E(() => S.cart.salida["4"])) === 2, "«Sí» suma 2 vasquetas");
  ok(JSON.stringify(await E(() => S.pesos.salida["4"])) === "[3.89,3.89]", "cada una pesa 3,89 kg (la mitad de 7,78)");
  ok((await E(() => escDuplicados().length)) === 0, "las 2 vasquetas de la misma caja no se marcan como repetidas");
  ok((await page.$$(".escRow")).length === 1 && /7,78/.test(await page.innerText("#escLista")), "la lista muestra UNA fila de caja con 7,78 kg");

  // 4) la misma caja otra vez avisa repetido; la ✕ saca la caja entera (2 vasquetas)
  await scan(caja); await page.click("[data-esc-caja='si']"); await page.waitForTimeout(200);
  ok((await E(() => S.cart.salida["4"])) === 4 && (await E(() => escDuplicados().length)) > 0, "la segunda caja igual suma 4 y avisa código repetido");
  await page.click(".escRow.dup .escX"); await page.waitForTimeout(200);
  ok((await E(() => S.cart.salida["4"])) === 2 && (await E(() => S.pesos.salida["4"].length)) === 2, "la ✕ saca la caja entera: vuelve a 2 vasquetas");

  // 5) se confirma: el servidor recibe 2 pesos y el rótulo de la caja alineado con cada uno
  await page.click("[data-esc-cerrar]"); await page.waitForTimeout(200);
  await page.click("#go"); await page.waitForTimeout(500); await page.click("#ok"); await page.waitForTimeout(1500);
  const sal = posts.find(x => x.tipo === "salida");
  ok(sal && JSON.stringify(sal.pesos["4"]) === "[3.89,3.89]", "registrar manda pesos [3,89, 3,89]");
  ok(sal && JSON.stringify(sal.rotulos && sal.rotulos["4"]) === JSON.stringify([caja, caja]), "registrar manda el rótulo de 28 dígitos con cada pesada");

  // 6) Devolución: dos vasquetas «de caja» con peso estimado; vuelve una y se pesa
  await page.click("#tabs [data-t='devolucion']"); await page.waitForTimeout(900);
  ok(await page.$("[data-devcaja='4:0']") !== null && await page.$("[data-devcaja='4:1']") !== null, "Devolución muestra las 2 vasquetas «de caja»");
  ok(/≈ 3,89 kg/.test(await page.innerText("[data-devcaja='4:0']")) && /De caja/.test(await page.innerText("[data-devcaja='4:0']")), "figuran «≈ 3,89 kg · De caja»");
  await page.click("[data-devcaja='4:0']"); await page.waitForTimeout(200);
  ok(await page.$("[data-devcajakg='4:0']") !== null, "al tocar una pide el peso real");
  ok((await E(() => S.cart.devolucion["4"] || 0)) === 0, "sin peso escrito todavía no se puede devolver");
  await page.fill("[data-devcajakg='4:0']", "4,10"); await page.waitForTimeout(150);
  ok((await E(() => S.cart.devolucion["4"])) === 1 && JSON.stringify(await E(() => S.pesos.devolucion["4"])) === "[4.1]", "con 4,10 kg la devolución suma 1 con peso 4,10");
  await page.click("#go"); await page.waitForTimeout(500); await page.click("#ok"); await page.waitForTimeout(1500);
  const dev = posts.find(x => x.subtipo === "devolucion");
  ok(dev && JSON.stringify(dev.pesos["4"]) === "[4.1]", "registrar la devolución manda el peso real 4,10");

  // 7) la que sigue afuera ya no figura con 3,89: figura con lo que falta de la caja (7,78 − 4,10 = 3,68)
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300); await page.click("#tabs [data-t='devolucion']"); await page.waitForTimeout(900);
  const chips = await page.$$("[data-devcaja]");
  ok(chips.length === 1 && /≈ 3,68 kg/.test(await chips[0].innerText()), "queda 1 vasqueta de caja con ≈ 3,68 kg (lo que falta de los 7,78)");
  ok(err.length === 0, "sin errores de consola" + (err.length ? ": " + err[0] : ""));
  await b.close(); console.log(fallas ? "FALLAS " + fallas : "FALLAS 0"); process.exit(fallas ? 1 : 0);
})();
