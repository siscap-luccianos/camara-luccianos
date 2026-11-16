// Pedido sugerido: solo referencias (tendencia 3 semanas, consumo por día, hay hoy); Pedir arranca en 0 y lo carga quien pide; el detalle muestra la última semana de lunes a domingo.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/404|ERR_/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);

  // Historial: 28 días de salidas de Banana Split (id 4), con un patrón fijo por día de la semana (dom..sáb)
  const patron = [8, 2, 1, 0, 8, 8, 3];
  await page.evaluate(p => {
    S.regs = (S.regs || []).filter(r => !(r.tipo === "salida" && r.items && r.items["4"] !== undefined && String(r.id).startsWith("t-")));
    const ahora = new Date();
    S.regs.push({ id: "t-ing", tipo: "ingreso", subtipo: "", items: { "4": 300 }, ts: new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 30, 12).getTime(), total: 300, empleado: "T" });
    for (let i = 1; i <= 28; i++) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - i, 12), q = p[d.getDay()];
      if (q) S.regs.push({ id: "t-" + i, tipo: "salida", subtipo: "", items: { "4": q }, ts: d.getTime(), total: q, empleado: "T" });
    }
    S.diasEntrega = 4; ls.del && ls.del("ultimoPedido:" + S.local);
    S.tab = "stock"; S.verPedido = true; S.pedidoAdj = {}; S.pedidoDetalle = {}; renderApp();
  }, patron);
  await page.waitForTimeout(300);

  const txt = await page.innerText("#main");
  ok(!(await page.$(".pdFechas")), "ya no hay tarjetas de «último pedido» ni de «te llega»");
  ok(!/hasta que llega|Se espera|cómo se calcula|Salieron \d+ desde/i.test(txt), "no quedan textos de proyección ni de «salió desde el último pedido»");
  ok(!/lo decidís vos/.test(txt) && /Cargá lo que pidas/.test(txt), "el aviso explica cómo cargar el pedido, sin la frase «lo decidís vos»");
  ok(await page.$(".pedTend") !== null && await page.$(".pedCons") !== null, "se ven tendencia y consumo por día");
  const fila = await page.$(".pedFila:has([data-pdet='4'])");
  ok(fila && (await fila.$eval(".pedInp", e => e.value)) === "" && (await fila.$eval(".pedInp", e => e.placeholder)) === "–", "«Pedir» arranca vacío (guión), no en 0");
  const cab = await page.innerText(".pedHead");
  ok(/stock/i.test(cab) && !/hay hoy/i.test(cab), "la columna se llama «Stock»");
  const tipo = await fila.$eval(".pedTend", e => e.textContent.replace(/\s+/g, " "));
  ok(/Bajando|Subiendo|Estable/i.test(tipo), "muestra la tendencia: " + tipo.trim());
  const ids = await page.$$eval("input[data-pedinp]", e => e.map(x => x.dataset.pedinp));
  ok(ids.length >= 2, "hay varios sabores para pedir: " + ids.length);
  const [a1, a2] = ids;
  await page.fill("[data-pedinp='" + a1 + "']", "7"); await page.press("[data-pedinp='" + a1 + "']", "Enter"); await page.waitForTimeout(250);
  ok((await page.$eval("[data-pedinp='" + a1 + "']", e => e.value)) === "7", "se puede cargar 7 (no se cambia solo)");
  const fix = await page.$$eval(".pedFila:has([data-pedinp='" + a1 + "']) [data-pedfix]", e => e.map(x => x.textContent.trim()));
  ok(fix.join(",") === "6,8", "ofrece corregir a 6 u 8: " + fix.join(","));
  const foco = await page.evaluate(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.pedinp);
  ok(foco === a2, "Enter pasa al siguiente sabor (foco en " + foco + ")");
  await page.keyboard.press("ArrowUp"); await page.waitForTimeout(250);
  ok((await page.$eval("[data-pedinp='" + a1 + "']", e => e.value)) === "7", "↑ vuelve al sabor anterior sin perder lo cargado");
  await page.click("[data-pedfix='" + a1 + ":6']"); await page.waitForTimeout(200);
  ok((await page.$eval("[data-pedinp='" + a1 + "']", e => e.value)) === "6" && !(await page.$("[data-pedfix='" + a1 + ":6']")), "corregir a 6 deja el 6 y saca el aviso");
  await page.click("[data-pinc='" + a1 + "']"); await page.waitForTimeout(150);
  ok((await page.$eval("[data-pedinp='" + a1 + "']", e => e.value)) === "8", "+ sube de a 2");
  for (let i = 0; i < 4; i++) await page.click("[data-pdec='" + a1 + "']");
  await page.waitForTimeout(150);
  ok((await page.$eval("[data-pedinp='" + a1 + "']", e => e.value)) === "", "bajar hasta 0 deja la celda vacía");
  // Cajas que llegan: vasquetas de a 2 por caja, caja maestra, y resumen al pie
  await page.fill("[data-pedinp='" + a1 + "']", "8"); await page.press("[data-pedinp='" + a1 + "']", "Enter"); await page.waitForTimeout(250);
  const cel = await page.$eval(".pedFila:has([data-pedinp='" + a1 + "']) .pedCajas", e => e.textContent.trim());
  ok(cel === "4", "8 vasquetas = 4 cajas (de a 2): " + cel);
  ok(/Cajas/i.test(await page.innerText(".pedHead")), "hay una columna «Cajas»");
  const kpiV = await page.$$eval(".pdCard", e => e.map(x => x.innerText.replace(/\s+/g, " ")).find(t => /Cajas de vasquetas/i.test(t)) || "");
  ok(/cajas de vasquetas 4/i.test(kpiV) && /pallet/i.test(kpiV) && /36 = 1/.test(kpiV), "tarjeta «Cajas de vasquetas» con los pallets (36 = 1): " + kpiV);
  await page.evaluate(() => { S.pedidoAdj = { "4": 72 }; renderApp() }); await page.waitForTimeout(200);
  const kpi72 = await page.$$eval(".pdCard", e => e.map(x => x.innerText.replace(/\s+/g, " ")).find(t => /Cajas de vasquetas/i.test(t)) || "");
  ok(/cajas de vasquetas 36/i.test(kpi72) && /≈ 1 pallet/i.test(kpi72), "72 vasquetas = 36 cajas = 1 pallet: " + kpi72);
  ok(!(await page.$(".pedCajasTot")), "sin otros rubros con cajas, no hay renglón de «Otras cajas»");
  // Borrar todo el pedido
  ok(await page.$("#borrarPedido") !== null, "hay botón «Borrar todo el pedido» cuando hay algo cargado");
  page.once("dialog", d => d.dismiss()); await page.click("#borrarPedido"); await page.waitForTimeout(150);
  ok((await page.$eval("[data-pedinp='4']", e => e.value)) === "72", "si se cancela la confirmación no se borra nada");
  page.once("dialog", d => d.accept()); await page.click("#borrarPedido"); await page.waitForTimeout(250);
  ok((await page.$eval("[data-pedinp='4']", e => e.value)) === "" && !(await page.$("#borrarPedido")), "al confirmar queda todo vacío y el botón desaparece");
  const cj = await page.evaluate(() => { S.saboresPorId["4"].cantidad_maestra = 30; const a = cajasDePedido("4", 60), b = cajasDePedido("4", 45); S.saboresPorId["4"].cantidad_maestra = 0; const f = S.saboresPorId["4"].familia; S.saboresPorId["4"].familia = "pasteleria"; const c = cajasDePedido("4", 5); S.saboresPorId["4"].familia = f; return [a, b, c] });
  ok(JSON.stringify(cj) === "[2,1.5,null]", "caja de 30: 60→2, 45→1,5; pastelería sin caja: nada " + JSON.stringify(cj));
  const mult = await page.evaluate(() => {
    S.saboresPorId["4"].cantidad_maestra = 30; const caja = multiploPedido("4");
    S.saboresPorId["4"].cantidad_maestra = 0; const vasq = multiploPedido("4");
    const g = S.saboresPorId["4"].familia, c = S.saboresPorId["4"].categoria;
    S.saboresPorId["4"].familia = "pasteleria"; const past = multiploPedido("4");
    S.saboresPorId["4"].familia = "bolleria"; const boll = multiploPedido("4");
    S.saboresPorId["4"].familia = g; S.saboresPorId["4"].categoria = c;
    return [caja, vasq, past, boll];
  });
  ok(JSON.stringify(mult) === "[30,2,1,1]", "múltiplos: caja 30, vasquetas de a 2, pastelería y bollería por unidad: " + JSON.stringify(mult));
  await page.click("[data-pdet='4']"); await page.waitForTimeout(250);
  const det = await page.$eval(".pedDetalle", e => e.innerText.replace(/\s+/g, " "));
  ok(/Consumo de la última semana/i.test(det), "el detalle se llama «Consumo de la última semana»");
  ok((await page.$$(".pedDetalle .pdDia")).length === 7 && (await page.$$(".pedDetalle .pdTot")).length === 1, "7 días (lunes a domingo) y un total");
  const dias = await page.$$eval(".pedDetalle .pdDia small", e => e.map(x => x.textContent.trim().split(" ")[0]));
  ok(/^lun/i.test(dias[0]) && /^dom/i.test(dias[6]), "va de lunes a domingo: " + dias.join(","));
  ok(!(await page.$(".pedDetalle .pdLinea")), "sin gráfico de tendencia repetido en el detalle");
  const suma = await page.$$eval(".pedDetalle .pdDia b", e => e.reduce((a, x) => a + (+x.textContent || 0), 0)), tot = await page.$eval(".pedDetalle .pdTot b", e => +e.textContent);
  ok(suma === tot, "el total coincide con la suma de los 7 días: " + suma);
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
