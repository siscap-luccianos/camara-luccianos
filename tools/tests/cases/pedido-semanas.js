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
  ok(/El pedido lo decidís vos/.test(txt), "el aviso dice que el pedido lo decide quien lo hace");
  ok(await page.$(".pedTend") !== null && await page.$(".pedCons") !== null, "se ven tendencia y consumo por día");
  const fila = await page.$(".pedFila:has([data-pdet='4'])");
  ok(fila && (await fila.$eval(".pedInp", e => e.value)) === "0", "«Pedir» arranca en 0 aunque el consumo sea alto");
  const tipo = await fila.$eval(".pedTend", e => e.textContent.replace(/\s+/g, " "));
  ok(/Bajando|Subiendo|Estable/i.test(tipo), "muestra la tendencia: " + tipo.trim());
  await page.click("[data-pinc='4']"); await page.waitForTimeout(150);
  ok((await page.$eval("[data-pedinp='4']", e => e.value)) === "2", "con + se suma de a 2 (vasquetas)");
  const ids = await page.$$eval("input[data-pedinp]", e => e.map(x => x.dataset.pedinp));
  ok(ids.length >= 2, "hay varios sabores para pedir: " + ids.length);
  const [a1, a2] = ids;
  await page.fill("[data-pedinp='" + a1 + "']", "7"); await page.press("[data-pedinp='" + a1 + "']", "Enter"); await page.waitForTimeout(250);
  ok((await page.$eval("[data-pedinp='" + a1 + "']", e => e.value)) === "8", "escribir 7 y Enter lo sube al múltiplo de 2: 8");
  const foco = await page.evaluate(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.pedinp);
  ok(foco === a2, "Enter pasa al siguiente sabor (foco en " + foco + ")");
  await page.keyboard.type("5"); await page.keyboard.press("ArrowUp"); await page.waitForTimeout(250);
  ok((await page.$eval("[data-pedinp='" + a1 + "']", e => e.value)) === "8", "↑ vuelve al sabor anterior sin perder lo cargado");
  ok((await page.$eval("[data-pedinp='" + a2 + "']", e => e.value)) === "6", "lo escrito en el siguiente (5) quedó en 6, múltiplo de 2");
  const regla = await page.evaluate(() => { S.saboresPorId["4"].cantidad_maestra = 30; const r = [fijarPedidoManual("4", 7), fijarPedidoManual("4", 30), fijarPedidoManual("4", 31), fijarPedidoManual("4", 0)]; S.saboresPorId["4"].cantidad_maestra = 0; const v = [fijarPedidoManual("4", 7), fijarPedidoManual("4", 8)]; return r.concat(v) });
  ok(JSON.stringify(regla) === "[30,30,60,0,8,8]", "caja maestra: 7→30, 30→30, 31→60, 0→0; sin caja, de a 2: 7→8, 8→8 " + JSON.stringify(regla));
  await page.fill("[data-pedinp='4']", "0"); await page.press("[data-pedinp='4']", "Tab"); await page.waitForTimeout(250);
  ok((await page.$eval("[data-pedinp='4']", e => e.value)) === "0", "0 deja el sabor sin pedir");
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
