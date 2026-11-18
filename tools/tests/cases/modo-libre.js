// Modo libre: un responsable lo activa sin señal; el equipo carga eligiendo su nombre; al volver la señal sale a nombre de quien cargó.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); const err = [], posts = [];
  page.on("pageerror", e => err.push("pageerror " + e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts|404/.test(m.text())) err.push(m.text()) });
  page.on("request", r => { if (r.method() === "POST") { try { posts.push(JSON.parse(r.postData())) } catch (e) {} } });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  const txt = async s => (await page.innerText(s)).replace(/\s+/g, " ");
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Local prueba"); await page.click("#authLocalOk");
  await page.waitForSelector("[data-authemp]");
  await page.click('[data-authemp="12"]'); await page.waitForSelector("[data-tecla]"); for (const d of "1234") await page.click(`[data-tecla="${d}"]`);
  await page.waitForSelector("header"); await page.waitForTimeout(2500);
  const roster = await page.evaluate(() => rosterLibre().map(e => e.nombre));
  ok(roster.length >= 2, "con señal, el responsable se lleva el equipo al dispositivo: " + roster.join(", "));
  ok(!(await page.$("#activarModoLibre")), "con señal no se ofrece el modo libre");
  // se corta la señal
  await ctx.setOffline(true);
  await page.evaluate(() => api("datos", { local: S.local })); await page.evaluate(() => renderApp()); await page.waitForTimeout(300);
  ok(!!(await page.$("#activarModoLibre")), "sin señal el responsable ve «Modo libre»");
  await page.click("#activarModoLibre"); await page.waitForTimeout(300);
  ok(/Modo libre/.test(await txt("body")) && /¿Quién carga\?/i.test(await txt("body")), "el modo libre pide elegir quién carga");
  // cargar una salida sin elegir quién: no deja
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  await page.click("[data-sal-menu='comun']").catch(() => {}); await page.waitForTimeout(300);
  await page.evaluate(() => { S.stock.base["49"] = 20; renderApp() }); await page.waitForTimeout(200);
  await page.click(".tabCat[data-familia='icepops']"); await page.waitForTimeout(300);
  await page.click("[data-add='49']"); await page.waitForSelector("#cantOv"); await page.click("[data-cant-tecla='2']"); await page.click("[data-cant-listo]"); await page.waitForTimeout(300);
  await page.click('[data-libre-carga="11"]'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => S.modoLibre.carga) === "11", "se elige quién carga (Lucía Benítez)");
  await page.click("#bar button >> nth=-1"); await page.waitForTimeout(500);
  if (await page.$("#ok")) { await page.click("#ok"); await page.waitForTimeout(900) }
  const cola = await page.evaluate(() => S.cola.map(x => ({ a: x.accion, p: x.payload })));
  ok(cola.length === 1 && cola[0].p.modoLibre && cola[0].p.paraEmpleadoId === "11" && cola[0].p.items["49"] === 2, "la salida queda en la cola con quién la cargó y modo libre: " + JSON.stringify(cola).slice(0, 160));
  ok(await page.evaluate(() => S.regs.some(r => String(r.id).startsWith("pendiente-") && String(r.empleadoId) === "11")), "se ve pendiente, a nombre de quien cargó");
  // vuelve la señal
  await ctx.setOffline(false);
  await page.evaluate(() => cerrarModoLibre()); await page.waitForTimeout(1500);
  const env = posts.filter(x => x.accion === "registrar" && x.modoLibre)[0];
  ok(env && env.paraEmpleadoId === "11" && env.modoLibre.por === "12", "al volver la señal se envía a nombre de quien cargó, por el responsable: " + JSON.stringify(env || {}).slice(0, 160));
  ok(await page.evaluate(() => S.cola.length) === 0, "la cola queda vacía");
  ok(err.length === 0, "sin errores de consola" + (err.length ? ": " + err.join(" | ") : ""));
  console.log("FALLAS " + fallas); await b.close(); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error("ERROR", e.message); process.exit(1) });
