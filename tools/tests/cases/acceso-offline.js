// Acceso sin señal: quien ya ingresó hoy en este dispositivo puede volver a entrar tipeando su PIN, sin internet.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); const err = [];
  page.on("pageerror", e => err.push("pageerror " + e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts|404/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  const tipear = async pin => { for (const d of pin) await page.click(`[data-tecla="${d}"]`) };
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Local prueba"); await page.click("#authLocalOk");
  await page.waitForSelector("[data-authemp]");
  const quien = await page.$$eval("[data-authemp]", e => e.map(x => ({ id: x.dataset.authemp, t: x.innerText.replace(/\s+/g, " ") })));
  console.log("perfiles:", JSON.stringify(quien).slice(0, 200));
  await page.click("[data-authemp]"); await page.waitForSelector("[data-tecla]"); await tipear("1234");
  await page.waitForSelector("header"); await page.waitForTimeout(700);
  const nombre = await page.evaluate(() => S.empleado.nombre), rol = await page.evaluate(() => S.empleado.rol), id = await page.evaluate(() => S.empleado.id);
  const guardada = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("offlineCred") || localStorage.getItem("pruebas:offlineCred") || "{}")));
  const esResp = ["encargado", "turno", "colaborador", "produccion"].includes(rol);
  ok(!esResp || guardada.includes(String(id)), "se guardó la huella de quien ingresó (" + nombre + " · " + rol + ")");
  ok(await page.evaluate(() => !Object.entries(localStorage).filter(([k]) => /offlineCred/.test(k)).some(([k, v]) => /1234/.test(v))), "el PIN no queda guardado en texto");
  // salir y quedarse sin señal
  await page.evaluate(() => cerrarSesion && cerrarSesion(false)); await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.waitForSelector("#authLocal", { timeout: 4000 }).catch(() => {});
  if (await page.$("#authLocal")) { await page.fill("#authLocal", "Local prueba"); await page.click("#authLocalOk"); if (await page.$("#authClave")) { await page.fill("#authClave", "x"); await page.click("#authClaveOk").catch(() => {}); } }
  await page.waitForSelector("[data-authemp]", { timeout: 15000 });
  await page.waitForFunction(() => /Sin señal/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  const txt = (await page.innerText("body")).replace(/\s+/g, " ");
  if (esResp) {
    ok(/Sin señal/.test(txt), "sin señal: avisa que entran quienes ya ingresaron hoy");
    await page.click(`[data-authemp="${id}"]`); await page.waitForSelector("[data-tecla]");
    await tipear("9999"); await page.waitForTimeout(1500);
    ok(/PIN incorrecto/.test((await page.innerText("body")).replace(/\s+/g, " ")), "con PIN equivocado no entra");
    await tipear("1234"); await page.waitForSelector("header", { timeout: 8000 }); await page.waitForTimeout(500);
    ok(await page.evaluate(() => !!S.empleado && S.empleado.id) == id, "con su PIN entra sin internet");
  } else console.log("(el primer perfil no es de local: se prueba con el de otro rol en la suite larga)");
  // pantalla bloqueada sin señal: también se desbloquea con el PIN
  await page.evaluate(() => { S.bloqueado = true; S.bloqueoPin = ""; renderApp() }); await page.waitForSelector("[data-tecla-bloqueo]");
  for (const d of "9999") await page.click(`[data-tecla-bloqueo="${d}"]`); await page.waitForTimeout(1500);
  ok(/PIN incorrecto/.test((await page.innerText("body")).replace(/\s+/g, " ")) && await page.evaluate(() => S.bloqueado), "bloqueo sin señal: PIN equivocado no desbloquea");
  for (const d of "1234") await page.click(`[data-tecla-bloqueo="${d}"]`); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => !S.bloqueado), "bloqueo sin señal: con su PIN se desbloquea");
  ok(err.length === 0, "sin errores de consola" + (err.length ? ": " + err.join(" | ") : ""));
  console.log("FALLAS " + fallas); await b.close(); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error("ERROR", e.message); process.exit(1) });
