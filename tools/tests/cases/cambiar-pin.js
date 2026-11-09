// «Cambiar mi PIN» (🔑 en el encabezado) y Enter en el login.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.press("#authLocal", "Enter");
  await page.fill("#authClave", "op2024"); await page.press("#authClave", "Enter");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("[data-tecla]");
  ok(true, "Enter avanza local y contraseña");
  for (const d of "12") await page.keyboard.press(d);
  await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  ok(!(await page.$("header")), "Enter con 2 dígitos no entra");
  for (const d of "34") await page.keyboard.press(d);
  await page.waitForSelector("header");
  ok(true, "con 4 dígitos entra");
  await page.click("#cambiarPinBtn"); await page.waitForSelector("#pinOv");
  await page.fill("#pinActual", "1234"); await page.press("#pinActual", "Enter");
  ok(await page.evaluate(() => document.activeElement.id) === "pinNuevo", "Enter pasa al campo siguiente");
  await page.fill("#pinNuevo", "5678"); await page.fill("#pinNuevo2", "5679"); await page.press("#pinNuevo2", "Enter");
  ok(/no coinciden/.test(await page.innerText("#pinMsg")), "avisa si los dos PIN nuevos no coinciden");
  await page.fill("#pinNuevo2", "5678"); await page.fill("#pinActual", "0000"); await page.press("#pinNuevo2", "Enter"); await page.waitForTimeout(400);
  ok(/incorrecto/.test(await page.innerText("#pinMsg")) && !!(await page.$("#pinOv")), "PIN actual malo: error y el diálogo sigue");
  await page.fill("#pinActual", "1234"); await page.press("#pinNuevo2", "Enter"); await page.waitForTimeout(500);
  ok(!(await page.$("#pinOv")), "PIN bueno: guarda y cierra");
  ok(await page.evaluate(() => S.token) === "t2", "usa el token nuevo");
  // Enter en el selector «Equipo» del encabezado (sin tocar la lista)
  await page.fill("#local", "Obelisco CABA"); await page.press("#local", "Enter"); await page.waitForTimeout(800);
  ok(await page.evaluate(() => S.local) === "Obelisco CABA", "Enter en «Equipo» cambia de local sin hacer clic");
  await page.fill("#local", "Operaciones"); await page.press("#local", "Enter"); await page.waitForTimeout(800);
  ok(await page.evaluate(() => !S.local), "Enter con «Operaciones» vuelve a Operaciones");
  // sin PIN creado: no pide el actual
  await page.evaluate(() => { S.empleado.tienePin = false });
  await page.click("#cambiarPinBtn"); await page.waitForSelector("#pinOv");
  ok(!(await page.$("#pinActual")) && /Crear mi PIN/.test(await page.innerText("#pinOv")), "sin PIN creado: «Crear mi PIN» y no pide el actual");
  ok(err.length === 0, "sin errores de consola " + JSON.stringify(err));
  console.log(fallas ? "FALLAS " + fallas : "TODO OK");
  await b.close();
})().catch(e => { console.error("ERROR", e.message); process.exit(1) });
