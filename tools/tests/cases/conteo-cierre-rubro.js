// «Guardar y seguir contando» se puede repetir; «Guardar definitivo» cierra el rubro (candado) y no deja volver a contarlo.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  let msg = ""; page.on("dialog", d => { msg = d.message(); d.accept() });
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);
  await (await page.$("#conteoInicialBtn"))?.click(); await page.click("#conteoBtn"); await page.waitForTimeout(500);
  ok(/Guardar definitivo/.test(await page.innerText(".cntAcla")) && /Guardar y seguir contando/.test(await page.innerText(".cntAcla")), "la pantalla explica la diferencia entre «seguir contando» y «definitivo»");
  const cargar = async (id, v, kg) => { await page.fill(`[data-c="${id}"]`, String(v)); await page.dispatchEvent(`[data-c="${id}"]`, "input"); await page.fill(`[data-kc="${id}"]`, kg); await page.dispatchEvent(`[data-kc="${id}"]`, "input") };
  const revisar = async () => { await page.click("#go"); await page.waitForTimeout(400); for (let i = 0; i < 10 && await page.$(".rcOk:not(.on)"); i++) { await page.click(".rcOk:not(.on)"); await page.waitForTimeout(100) } };
  await cargar(4, 30, "117"); await revisar();
  await page.click("#okContado"); await page.waitForTimeout(1200);
  ok(/NO es definitivo/.test(msg) && /volver a contar/.test(msg), "«Guardar y seguir contando» avisa que NO es definitivo y que se puede corregir");
  ok(await page.evaluate(() => !(S.rubrosCerrados || []).includes("vasquetas")), "después de «seguir contando» el rubro sigue abierto");
  // volver a contar el mismo sabor: se puede
  await cargar(4, 28, "108"); await revisar();
  await page.click("#okContado"); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => stockMap()["4"]) === 28, "se pudo volver a guardar Banana Split (28)");
  // definitivo
  await cargar(20, 7, "25,5"); await revisar();
  await page.click("#ok"); await page.waitForTimeout(1500);
  ok(/GUARDAR DEFINITIVO/.test(msg) && /no vas a poder volver a contar/.test(msg), "«Guardar definitivo» advierte que cierra el rubro");
  ok(await page.evaluate(() => (S.rubrosCerrados || []).includes("vasquetas")), "Vasquetas queda cerrado");
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(300);
  await (await page.$("#conteoInicialBtn"))?.click(); await page.click("#conteoBtn"); await page.waitForTimeout(500);
  ok(/cerrado este mes/.test(await page.innerText("main")) && await page.$("[data-c='4']") === null, "al volver, Vasquetas muestra el candado y no deja contar");
  await page.click(".tabCat:has-text('Icepops')").catch(() => {}); await page.waitForTimeout(300);
  ok(await page.$("[data-c]") !== null, "los otros rubros (Icepops) siguen abiertos para contar");
  console.log("errores:", err.length ? err : "ninguno");
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); await b.close(); process.exit(fallas || err.length ? 1 : 0);
})();
