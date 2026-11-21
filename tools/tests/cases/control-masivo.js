// Control (estilo Apple): tarjetas inteligentes, grupos como listas, mover a…, arrastrar, deslizar y pedidos de conteo (uno o varios).
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  page.on("dialog", d => d.accept());
  await page.addInitScript(() => localStorage.setItem("idioma", "es"));
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]'); }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.click("#tabs [data-t='control']"); await page.waitForSelector("[data-ctl-chk]");
  const n = async () => (await page.$$("[data-ctl-chk]")).length;
  const txt = () => page.innerText("#main");
  ok((await page.$$(".cgTile")).length === 6, "hay 6 tarjetas inteligentes");
  ok(await n() === 4, "lista todos los locales, incluso sin conteo: " + await n());
  ok(/#CABA/.test(await txt()), "las regiones salen como etiquetas");
  await page.fill("#ctlQ", "santa"); await page.waitForTimeout(150);
  ok(await n() === 1, "el buscador filtra"); await page.fill("#ctlQ", ""); await page.waitForTimeout(150);
  await page.click("[data-ctl-f='fran']"); ok(await n() === 1, "tarjeta Franquicias"); await page.click("[data-ctl-f='todos']");
  await page.click("[data-cg-reg='CABA']"); ok(await n() === 3, "etiqueta #CABA filtra"); await page.click("[data-cg-reg='CABA']");
  // pedido individual
  await page.click(".cgFin [data-ctl-pedir1='Recoleta CABA']"); await page.click("[data-tp='final']"); await page.click("[data-si]"); await page.waitForTimeout(400);
  ok(/Pedido de cierre/.test(await txt()), "pedido individual de cierre queda marcado");
  // pedido a varios
  await page.check("[data-ctl-chk='Obelisco CABA']"); await page.check("[data-ctl-chk='Santa Rosa La Pampa']"); await page.waitForTimeout(150);
  ok(/2 seleccionados/.test(await txt()), "se marcan con las casillas redondas");
  await page.click("[data-ctl-masivo]"); await page.click("[data-si]"); await page.waitForTimeout(500);
  ok((await txt()).match(/Pedido parcial/g)?.length === 2, "pedido a varios: parcial a los 2 marcados");
  await page.click("[data-ctl-f='pend']"); ok(await n() === 3, "tarjeta Con pedido");
  await page.check("[data-ctl-chk='Obelisco CABA']"); await page.click("[data-ctl-cancelmas]"); await page.waitForTimeout(500);
  await page.click("[data-ctl-f='todos']");
  ok((await txt()).match(/Pedido parcial/g)?.length === 1, "cancelar los pedidos de lo marcado");
  // grupos: mover a… / grupo nuevo
  await page.check("[data-ctl-chk='Obelisco CABA']"); await page.check("[data-ctl-chk='Santa Rosa La Pampa']");
  await page.click("[data-cg-mover]"); await page.waitForSelector(".cgHoja");
  await page.click("[data-mnuevo]"); await page.fill("#cgNuevoN", "Mis locales"); await page.click("[data-mcrear]"); await page.waitForTimeout(500);
  ok(/Mis locales/.test(await page.innerText(".cgSide")), "«Mover a… › Grupo nuevo» crea el grupo");
  ok(/CABA de Laura/.test(await page.innerText(".cgSide")) && /Laura/.test(await page.innerText(".cgSide")), "el admin ve el grupo de otro supervisor con su nombre");
  const gid = await page.$$eval("[data-cg-g]", e => e.find(x => /Mis locales/.test(x.textContent)).dataset.cgG);
  await page.click("[data-cg-g='" + gid + "']"); await page.waitForTimeout(200);
  ok(await n() === 2 && /Pedir conteo a los 2/.test(await txt()), "abrir el grupo muestra sus 2 locales y «Pedir conteo a los 2»");
  await page.click("[data-cg-pedirg]"); await page.click("[data-si]"); await page.waitForTimeout(500);
  ok((await txt()).match(/Pedido parcial/g)?.length === 2, "pedir conteo a todo el grupo");
  // arrastrar un local desde Todos sobre el grupo
  await page.click("[data-ctl-f='todos']"); await page.waitForTimeout(200);
  await page.dragAndDrop("[data-cg-drag='Recoleta CABA']", "[data-cg-drop='" + gid + "']"); await page.waitForTimeout(500);
  ok(/Mis locales\s*3/.test((await page.innerText(".cgSide")).replace(/\n/g, " ")), "arrastrar un local sobre el grupo lo agrega (3)");
  // quitar
  await page.click("[data-cg-g='" + gid + "']"); await page.waitForTimeout(200);
  await page.check("[data-ctl-chk='Recoleta CABA']"); await page.click("[data-cg-quitar]"); await page.waitForTimeout(500);
  ok(await n() === 2, "«Quitar» saca el local del grupo");
  // deslizar
  const cdp = await ctx.newCDPSession(page);
  const caja = await (await page.$("[data-cg-drag='Obelisco CABA']")).boundingBox();
  const y = caja.y + caja.height / 2, x0 = caja.x + caja.width - 120;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 - i * 18, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await page.waitForTimeout(400);
  ok(await page.$eval("[data-cg-drag='Obelisco CABA']", e => e.classList.contains("abierto")), "deslizar la fila hacia la izquierda muestra «Mover» y «Pedir»");
  await page.click(".cgSwAcc [data-cg-mover1='Obelisco CABA']"); await page.waitForSelector(".cgHoja");
  ok(/Mover a/.test(await page.innerText(".cgHoja")), "«Mover» del deslizar abre la hoja");
  await page.click("[data-no]");
  // persistencia y borrado
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(800);
  await page.click("#tabs [data-t='control']"); await page.waitForSelector("[data-ctl-chk]"); await page.waitForTimeout(400);
  ok(/Mis locales/.test(await page.innerText(".cgSide")), "el grupo sigue después de recargar");
  await page.click("[data-cg-g='" + gid + "']"); await page.click("[data-cg-borrarg]"); await page.waitForTimeout(500);
  ok(!/Mis locales/.test(await page.innerText(".cgSide")), "se puede borrar el grupo");
  // admin dentro de un local ve el aviso y los pasos de Stock
  await page.click("[data-ctl-f='todos']");
  await page.click(".cgFin [data-ctl-pedir1='Local prueba']"); await page.click("[data-si]"); await page.waitForTimeout(400);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1500);
  ok(await page.$("#pedidoConteoHacer") !== null, "admin dentro del local ve el aviso del pedido");
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(300);
  await page.click("#conteoInicialBtn"); await page.waitForTimeout(200);
  ok(/paso 1/i.test(await txt()) && /paso 2/i.test(await txt()) && /hacelo primero/i.test(await txt()), "Stock explica los pasos");
  ok(err.length === 0, "sin errores de consola " + err.join(" | "));
  console.log("FALLAS " + fallas); await b.close(); process.exit(fallas ? 1 : 0);
})();
