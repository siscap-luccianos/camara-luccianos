// Selector «Equipo»: Enter con una sugerencia marcada en la lista debe ir a ESA (no volver al local de antes).
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.press("#authLocal", "Enter");
  await page.fill("#authClave", "op2024"); await page.press("#authClave", "Enter");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("[data-tecla]");
  for (const d of "1234") await page.keyboard.press(d);
  await page.waitForSelector("header");
  // El simulador solo trae 2 locales: se suman dos con el mismo comienzo para probar lo ambiguo (como «Galerias Pacifico» / «Galerias Salta»).
  await page.evaluate(() => { S.locales.push({ nombre: "Galerias Pacifico CABA", grupo: "Propios", pais: "Argentina" }, { nombre: "Galerias Salta", grupo: "Propios", pais: "Argentina" }); });
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(700);
  ok(await page.evaluate(() => S.local) === "Local prueba", "parte en Local prueba");
  // El navegador, con una sugerencia marcada, escribe el nombre completo en el campo DESPUÉS del keydown de Enter.
  await page.evaluate(() => {
    window.addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target && e.target.id === "local" && window.__sugerida) {
        const inp = e.target; setTimeout(() => { inp.value = window.__sugerida; inp.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" })); }, 0);
      }
    }, true);
  });
  await page.evaluate(() => { window.__sugerida = "Galerias Pacifico CABA" });
  await page.fill("#local", "galer"); await page.press("#local", "Enter"); await page.waitForTimeout(900);
  ok(await page.evaluate(() => S.local) === "Galerias Pacifico CABA", "Enter con la sugerencia marcada va a esa (antes volvía al local de antes)");
  await page.evaluate(() => { window.__sugerida = null });
  // Sin sugerencia y texto ambiguo: se queda y avisa
    await page.fill("#local", "galer"); await page.press("#local", "Enter"); await page.waitForTimeout(500);
    ok(await page.evaluate(() => S.local) === "Galerias Pacifico CABA", "texto ambiguo sin sugerencia: se queda en el local actual");
  ok(await page.evaluate(() => document.getElementById("local").value) === "Galerias Pacifico CABA", "el campo vuelve a mostrar el local actual");
  const tx = await page.evaluate(() => document.getElementById("toast").textContent); ok(/elegí uno de la lista/.test(tx), "avisa que elija de la lista (\"" + tx + "\")");
  // Único que empieza con lo escrito: entra directo
  await page.fill("#local", "obel"); await page.press("#local", "Enter"); await page.waitForTimeout(900);
  ok(await page.evaluate(() => S.local) === "Obelisco CABA", "texto que identifica un solo local entra directo");
  ok(err.length === 0, "sin errores de consola " + JSON.stringify(err));
  console.log(fallas ? "FALLAS " + fallas : "TODO OK");
  await b.close();
})().catch(e => { console.error("ERROR", e.message); process.exit(1) });
