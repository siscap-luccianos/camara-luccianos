// Transferencia: enviada desde Salida (con destino, cualquier rubro) y recibida en Ingreso con el lector; Historial por jornada con detalle.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/404|ERR_/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  page.on("dialog", d => d.accept());
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);

  const banana = "0004" + "00389" + "290926" + "21" + "015";
  const bananaB = "0004" + "00391" + "290926" + "21" + "016";
  const cajaFrut = "99" + "0020" + "000355" + "00728" + "290926" + "21" + "015";
  await page.evaluate(async () => { await api("registrar", { clienteId: uuid(), tipo: "ingreso", local: S.local, items: { "49": 10 }, remito: "T-1" }); await cargarDatos() }); await page.waitForTimeout(400); // stock de Icepops para poder transferir
  // ---------- SALIDA · Transferencia ----------
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  ok(await page.$("[data-sal-tipo='comun']") && await page.$("[data-sal-tipo='transferencia']"), "Salida tiene el selector «Salida común | Transferencia»");
  ok(!(await page.$("#destinoSalida")), "en Salida común no hay campo de destino");
  await page.click("[data-sal-tipo='transferencia']"); await page.waitForTimeout(300);
  ok(await page.$("#destinoSalida") !== null, "con Transferencia aparece «¿A qué local va?»");
  ok(!(await page.$("#irDesperdicio")) && !(await page.$("#irVentaDia")), "en transferencia no se ofrecen Desperdicio ni Salida de chocolatería");
  await page.evaluate(a => { abrirEscaner(); procesarEscaneo(a); }, banana); await page.waitForTimeout(150);
  await page.evaluate(() => cerrarEscaner()); await page.waitForTimeout(250);
  await page.evaluate(() => { S.cart.salida["49"] = 3; scheduleRender() }); await page.waitForTimeout(200); // un Icepop: cualquier rubro
  ok(/transferencia/i.test(await page.innerText("#barIn")), "la barra dice «transferencia»");
  ok(await page.$eval("#go", e => e.disabled), "sin destino no se puede registrar");
  ok(/a qué local va/i.test(await page.innerText("#barIn")), "avisa que falta el local");
  await page.fill("#destinoSalida", "Obelisco CABA"); await page.waitForTimeout(200);
  ok(!(await page.$eval("#go", e => e.disabled)), "con destino se habilita");
  await page.click("#go"); await page.waitForTimeout(300);
  ok(/Lo que vas a transferir/.test(await page.innerText("#app")) && /Obelisco CABA/.test(await page.innerText("#app")), "revisión: «Lo que vas a transferir» con el destino");
  await page.click("#ok"); await page.waitForTimeout(800);
  const reg1 = await page.evaluate(() => S.regs.filter(r => r.subtipo === "transferencia" && r.tipo === "salida").pop());
  ok(reg1 && reg1.items["4"] === 1 && reg1.items["49"] === 3 && (reg1.pesos["4"] || [])[0] === 3.89, "se guardó la transferencia enviada con helado, Icepops y el peso: " + JSON.stringify(reg1 && { i: reg1.items, p: reg1.pesos }));
  ok(await page.$("#destinoSalida") === null, "después de registrar vuelve a Salida común");

  // ---------- INGRESO · Transferencia recibida con el lector ----------
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300);
  ok(await page.$("#irEscanerIng") === null, "en Remito de fábrica NO hay lector");
  await page.click("[data-ing-tipo='transferencia']"); await page.waitForTimeout(300);
  ok(await page.$("#irEscanerIng") !== null, "en Transferencia recibida aparece «Escanear vasqueta»");
  await page.fill("#remito", "Galerías Pacífico CABA");
  await page.click("#irEscanerIng"); await page.waitForSelector("#escCodigo");
  const scan = async c => { await page.evaluate(x => procesarEscaneo(x), c); await page.waitForTimeout(120) };
  await scan(banana);
  await scan(bananaB);
  await scan(cajaFrut);
  await page.waitForTimeout(2700);
  await scan(banana); // repetido
  ok(/ya se escane/i.test(await page.innerText("#escMsg")), "código repetido: franja amarilla");
  let n = await page.evaluate(() => ({ c: S.cart.ingreso, kg4: S.kilosProduccion["4"], kg20: S.kilosProduccion["20"], p: S.pesos.ingreso }));
  ok(n.c["4"] === 3 && n.c["20"] === 2, "suma 1 por vasqueta y 2 por caja: " + JSON.stringify(n.c));
  ok(n.kg20 === "7,28", "los kilos de la caja quedan cargados: " + n.kg20);
  await page.click(".escRow.dup .escX"); await page.waitForTimeout(150);
  n = await page.evaluate(() => ({ c: S.cart.ingreso, kg4: S.kilosProduccion["4"] }));
  ok(n.c["4"] === 2 && n.kg4 === "7,8", "la ✕ saca solo esa vasqueta y recalcula los kilos: " + JSON.stringify(n));
  await page.evaluate(() => cerrarEscaner()); await page.waitForTimeout(250);
  ok(!(await page.$eval("#go", e => e.disabled)), "con origen y kilos se puede registrar");
  await page.click("#go"); await page.waitForTimeout(300); await page.click("#ok"); await page.waitForTimeout(800);
  const reg2 = await page.evaluate(() => S.regs.filter(r => r.subtipo === "transferencia" && r.tipo === "ingreso").pop());
  ok(reg2 && reg2.items["4"] === 2 && reg2.items["20"] === 2 && reg2.kilos["4"] === 7.8 && reg2.pesos["20"].length === 2, "ingreso por transferencia guardado con kilos y pesos: " + JSON.stringify(reg2 && { i: reg2.items, k: reg2.kilos, p: reg2.pesos }));

  // ---------- HISTORIAL por jornada ----------
  await page.click("#tabs [data-t='historial']"); await page.waitForTimeout(500);
  await page.click('[data-rango-hist="d60"]'); await page.waitForTimeout(400);
  const dias = await page.$$(".hDia");
  ok(dias.length >= 1, "los movimientos se agrupan por jornada (" + dias.length + ")");
  const filas0 = (await page.$$(".hDia:first-child .hMov")).length;
  const cab = await page.innerText(".hDia:first-child .hDiaCab");
  ok(filas0 <= 3, "cada día muestra como mucho 3 filas: " + filas0);
  ok(/Jornada/.test(cab) && /movimientos?/.test(cab), "cabecera «Jornada … · N movimientos»: " + cab.replace(/\n/g, " "));
  const verMas = await page.$(".hDia:first-child [data-mov-dia]");
  ok(verMas !== null, "hay «Ver N más de este día»: " + (verMas ? await verMas.innerText() : ""));
  await verMas.click(); await page.waitForTimeout(250);
  const filasTodas = (await page.$$(".hDia:first-child .hMov")).length;
  ok(filasTodas > 3, "«Ver más» despliega todo el día (" + filasTodas + ")");
  ok(/Ver menos/.test(await page.innerText(".hDia:first-child .hVer")), "queda «Ver menos»");
  const pillsTxt = await page.$$eval(".hMov .pill", e => e.map(x => x.textContent.trim()));
  ok(pillsTxt.some(t => /^transferencia/.test(t)), "etiqueta de transferencia: " + JSON.stringify([...new Set(pillsTxt)]));
  ok(await page.$(".hMov .pill.transf") !== null, "la etiqueta de transferencia usa su clase de color (.transf)");
  const idx = await page.$$eval(".hMov", els => els.findIndex(e => /transferencia/.test(e.textContent) && /Banana/.test(e.textContent) && /Frutilla/.test(e.textContent)));
  const btns = await page.$$(".hMov"); await btns[idx >= 0 ? idx : 0].click(); await page.waitForTimeout(250);
  const det = await page.innerText(".hDet");
  ok(/VASQUETAS/i.test(det) && /Banana Split/.test(det) && /Frutilla/.test(det), "el detalle lista cada sabor: " + det.replace(/\n/g, " | ").slice(0, 220));
  ok(/3,89|3,91|7,28/.test(det), "el detalle muestra los pesos");
  ok(/Total/.test(det), "el detalle tiene el total");
  ok(/Jornada .* cargado/.test(det), "el detalle conserva «Jornada … · cargado …»");
  ok(await page.$(".hDet .anularBtn") !== null, "el detalle tiene Anular");
  await page.screenshot({ path: "transf-hist.png", fullPage: true });
  // jornada: una carga a la 01:30 cuenta en la jornada del día anterior
  const j = await page.evaluate(() => { const d = new Date(); d.setHours(1, 30, 0, 0); const r = { id: "x1", tipo: "salida", subtipo: "", items: { "4": 1 }, empleado: "Z", ts: d.getTime(), total: 1 }; const dia = new Date(jornadaDe(d.getTime())).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" }); const noche = new Date(); noche.setHours(12, 0, 0, 0); const diaNoche = new Date(jornadaDe(noche.getTime())).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" }); return { tit: listaMovimientosDiaHTML([r]).match(/Jornada [^<]+/)[0], dia, diaNoche } });
  ok(j.tit.includes(j.dia) && j.dia !== j.diaNoche, "la 01:30 cuenta en la jornada anterior (" + j.tit + ", no " + j.diaNoche + ")");
  ok(err.length === 0, "sin errores de consola: " + err.join(" | "));
  console.log(fallas ? "FALLAS " + fallas : "FALLAS 0");
  await b.close(); process.exit(fallas ? 1 : 0);
})();
