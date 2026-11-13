// «Contar escaneando» en Conteo físico (vasquetas, piloto con escaner_peso): caja = +2, vasqueta = +1, pisa el número del
// sistema, repetido avisa sin bloquear, ✕ quita una lectura, caja rara pregunta, código desconocido se asigna, a mano saca las lecturas.
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
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);

  const cajaBanana = "99" + "0004" + "000355" + "00778" + "290926" + "21" + "015";   // 7,78 kg = 2 × 3,89
  const cajaRara   = "99" + "0004" + "000355" + "00450" + "290926" + "21" + "015";   // 4,50 kg: 2,25 por vasqueta, lejos de 3,89
  const vasqFrut   = "0020" + "00364" + "290926" + "22" + "031";
  const vasqDesc   = "0005" + "00310" + "290926" + "21" + "015";                      // Cheesecake: código sin cargar en la planilla
  const S_ = (e) => page.evaluate(e);
  const scan = async c => { await page.evaluate(x => procesarEscaneoConteo(x), c); await page.waitForTimeout(80) };

  // decodificación pura
  const p = await S_(() => parseCodigoRotulo("9900090003550083529092621015"));
  ok(p && p.tipo === "caja" && p.codigo === "0009" && p.kg === 8.35 && p.lote === "29/09/2026", "28 dígitos: caja, producto 0009, 8,35 kg, lote 29/09/2026");
  const pv = await S_(() => parseCodigoRotulo("00200036429092622031"));
  ok(pv && pv.tipo === "vasq" && pv.codigo === "0020" && pv.kg === 3.64, "20 dígitos sigue siendo vasqueta");
  ok(await S_(() => parseCodigoRotulo("98" + "0".repeat(26))) === null, "28 dígitos que no empiezan con 99 se rechazan");

  const antes20 = await S_(() => stockMap()["20"] || 0);
  await page.click("#conteoBtn"); await page.waitForSelector("#contOv"); await page.click("[data-ce-empezar]"); await page.waitForTimeout(400);
  ok(await page.$("#escConteoBtn") !== null, "la tarjeta «Contar escaneando» aparece en Vasquetas (local piloto)");
  await page.click("#escConteoBtn"); await page.waitForSelector("#escanerOv");
  ok(/Contar escaneando/.test(await page.innerText("#escanerOv")), "se abre el diálogo de conteo");

  // 1) caja cerrada = +2 con el peso de la caja; pisa el número del sistema
  await scan(cajaBanana);
  ok(await S_(() => S.conteo["4"]) === 2, "caja de Banana Split suma 2 y pisa el número del sistema");
  ok(await S_(() => S.kilosConteo["4"]) === "7,78", "kilos del sabor = peso de la caja (7,78)");
  ok(await S_(() => S.conteoTocado["4"]) === true, "el sabor queda como contado");
  ok(/caja ×2/.test(await page.innerText("#escLista")), "la lista dice «caja ×2»");
  // 2) repetido: avisa en amarillo, no bloquea
  await scan(cajaBanana);
  ok(/ya se escaneó/.test(await page.innerText("#escMsg")) && await page.$("#escMsg.warn") !== null, "el mismo código avisa «ya se escaneó» en amarillo");
  ok(await S_(() => S.conteo["4"]) === 4 && await S_(() => S.kilosConteo["4"]) === "15,56", "pero no bloquea: suma otra caja (4 / 15,56 kg)");
  ok(await page.$$eval(".escRow.dup", e => e.length) === 1, "la fila repetida queda resaltada en amarillo");
  // 3) ✕ quita una lectura
  await page.click(".escLista .escRow .escX"); await page.waitForTimeout(100);
  ok(await S_(() => S.conteo["4"]) === 2 && await S_(() => S.kilosConteo["4"]) === "7,78", "la ✕ quita solo esa caja y recalcula");
  // 4) vasqueta suelta = +1 con su peso
  await scan(vasqFrut);
  ok(await S_(() => S.conteo["20"]) === 1 && await S_(() => S.kilosConteo["20"]) === "3,64", "vasqueta de Frutilla suma 1 con 3,64 kg");
  // 5) caja con peso raro: pregunta
  await scan(cajaRara);
  ok(await page.$("[data-esc-cajan]") !== null && /Revisá la caja|Esta caja pesa/.test(await page.innerText("#escanerOv")), "caja de 4,50 kg pregunta cuántas vasquetas trae");
  await scan(cajaBanana);
  ok(/Primero respondé/.test(await page.innerText("#escMsg")), "mientras está la pregunta no se procesa otro código");
  await page.click('[data-esc-cajan="1"]'); await page.waitForTimeout(100);
  ok(await S_(() => S.conteo["4"]) === 3 && await S_(() => S.kilosConteo["4"]) === "12,28", "«1 sola» suma 1 vasqueta con los 4,50 kg (3 / 12,28)");
  // 6) código sin asignar
  await scan(vasqDesc);
  ok(await page.$("#escAsigSel") !== null, "código desconocido pide elegir el sabor");
  await page.selectOption("#escAsigSel", "5"); await page.click("[data-esc-asig-ok]"); await page.waitForTimeout(100);
  ok(await S_(() => S.conteo["5"]) === 1 && await S_(() => S.kilosConteo["5"]) === "3,1", "asignado a Cheesecake: suma 1 con 3,1 kg");
  await scan(vasqDesc);
  ok(await page.$("#escAsigSel") === null && await S_(() => S.conteo["5"]) === 2, "el código asignado se recuerda en el conteo");
  // 7) borrador con las lecturas
  await page.waitForTimeout(700);
  ok(await S_(() => { const b = borradorConteo(); return !!(b && b.esc && b.esc.items.length >= 4) }), "el borrador guarda las lecturas");
  await page.click("[data-esc-cerrar]"); await page.waitForTimeout(150);
  ok(await page.$("#escanerOv") === null, "Listo cierra el diálogo");
  ok(await page.$$eval(".cEscTag", e => e.length) >= 3, "las filas escaneadas muestran «📷 Escaneado»");
  await S_(() => { iniciarConteo(true) }); await page.waitForTimeout(300);
  ok(await page.$$eval(".cEscTag", e => e.length) >= 3 && await S_(() => S.conteo["4"]) === 3, "al retomar el borrador vuelven las lecturas");
  // 8) a mano saca las lecturas de ese sabor
  await page.fill('[data-c="4"]', "5"); await page.dispatchEvent('[data-c="4"]', "input"); await page.waitForTimeout(100);
  ok(await page.$('[data-cesc-mano="4"]') === null && await S_(() => ceItemsDe("4").length) === 0, "escribir a mano saca las lecturas de Banana Split");
  ok(await S_(() => S.conteo["4"]) === 5, "y el número queda como lo escribió");
  // 9) quitar la última lectura de un sabor restaura el número del sistema
  await page.click("#escConteoBtn"); await page.waitForSelector("#escanerOv");
  const n20 = await S_(() => ceItemsDe("20")[0].n);
  await page.click(`[data-esc-quitar="${n20}"]`); await page.waitForTimeout(100);
  ok(await S_(() => S.conteo["20"]) === antes20 && await S_(() => !S.conteoTocado["20"]), "al quitar la única lectura vuelve el número del sistema y «sin contar»");
  await page.click("[data-esc-cerrar]"); await page.waitForTimeout(150);
  // 10) guardar: mezcla de escaneado y a mano
  await page.fill('[data-kc="4"]', "19,4"); await page.dispatchEvent('[data-kc="4"]', "input");
  await page.fill('[data-kc="20"]', "21"); await page.dispatchEvent('[data-kc="20"]', "input");
  await page.click("#go"); await page.waitForTimeout(400);
  for (let i = 0; i < 10 && await page.$(".rcOk:not(.on)"); i++) { await page.click(".rcOk:not(.on)"); await page.waitForTimeout(100) }
  await page.click("#ok"); await page.waitForTimeout(1300);
  ok(await S_(() => S.conteo) === null, "el conteo se guardó");
  ok(await S_(() => stockMap()["5"]) === 2, "Cheesecake quedó en 2 (escaneado)");
  ok(await S_(() => (S.conteoEsc.items.length)) === 0, "las lecturas se limpian al guardar");

  ok(err.length === 0, "sin errores de consola " + JSON.stringify(err));
  console.log(fallas ? "FALLAS " + fallas : "FALLAS 0");
  await b.close(); process.exit(fallas ? 1 : 0);
})();
