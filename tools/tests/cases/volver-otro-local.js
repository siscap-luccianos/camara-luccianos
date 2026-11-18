// Entrar a «otro local» con el gesto secreto (5 toques en «Elegí tu perfil») no deja encerrado: siempre hay «Volver».
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const err = [];
  page.on("pageerror", e => err.push("pageerror " + e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts|404/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.evaluate(() => { S.deviceLocal = "Local prueba"; localStorage.setItem("deviceLocal", "Local prueba"); iniciarAuth() });
  await page.waitForSelector("[data-secreto-otro]"); await page.waitForTimeout(400);
  ok(await page.evaluate(() => S.auth.paso) === "quien", "tablet fijada: arranca en los perfiles del local");
  // el gesto secreto lleva a elegir otro local
  await page.evaluate(() => { S.auth = { paso: "local", local: null, empleados: [], elegido: null, pin: "", pin1: "", error: "", cargando: false, otroLocal: true }; renderApp() });
  await page.waitForSelector("#authLocal");
  ok(!!(await page.$("[data-authback]")) && await page.isVisible("[data-authback]"), "en «otro local» hay un «Volver» visible");
  await page.click("[data-authback]"); await page.waitForTimeout(500);
  ok(await page.evaluate(() => S.auth.paso) === "quien" && !(await page.evaluate(() => S.auth.otroLocal)), "«Volver» deja la pantalla de perfiles del local fijo");
  ok(err.length === 0, "sin errores de consola" + (err.length ? ": " + err.join(" | ") : ""));
  console.log("FALLAS " + fallas); await b.close(); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error("ERROR", e.message); process.exit(1) });
