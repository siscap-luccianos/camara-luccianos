// Un solo guardado: «Guardar definitivo» graba, cambia el stock y cierra el rubro (candado). Antes se puede revisar y seguir contando sin grabar.
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
  const acla = await page.innerText(".cntAcla");
  ok(/Guardar definitivo/.test(acla) && /cambia el stock en el momento/.test(acla) && /salí tranquilo/.test(acla), "el aviso explica: definitivo cambia el stock y, si te tenés que ir, el avance queda en el equipo");
  ok(!/seguir contando/i.test(acla.replace(/Seguir contando/g, "")), "ya no existe «Guardar y seguir contando»");
  const cargar = async (id, v, kg) => { await page.fill(`[data-c="${id}"]`, String(v)); await page.dispatchEvent(`[data-c="${id}"]`, "input"); await page.fill(`[data-kc="${id}"]`, kg); await page.dispatchEvent(`[data-kc="${id}"]`, "input") };
  const revisar = async () => { await page.click("#go"); await page.waitForTimeout(400); for (let i = 0; i < 10 && await page.$(".rcOk:not(.on)"); i++) { await page.click(".rcOk:not(.on)"); await page.waitForTimeout(100) } };
  const stock4 = () => page.evaluate(() => stockMap()["4"]);
  const antes = await stock4();
  await cargar(4, 30, "117"); await revisar();
  ok(/Todavía no se guardó nada/.test(await page.innerText("body")), "la revisión avisa que todavía no se guardó nada");
  ok(await page.$("#okContado") === null, "en la revisión no hay botón de «guardar y seguir»");
  ok(/Guardar definitivo/.test(await page.innerText("#ok")) && /Seguir contando/.test(await page.innerText("#volver")), "quedan «Seguir contando» (sin grabar) y «Guardar definitivo»");
  // revisar y seguir: no graba
  await page.click("#volver"); await page.waitForTimeout(400);
  ok(await stock4() === antes && await page.evaluate(() => !(S.rubrosCerrados || []).includes("vasquetas")), "«Seguir contando» no grabó nada: el stock sigue igual y el rubro abierto");
  await revisar();
  await page.click("#ok"); await page.waitForTimeout(1500);
  ok(/GUARDAR DEFINITIVO/.test(msg) && /cambia el stock ahora/.test(msg) && /no vas a poder volver a contar/.test(msg), "«Guardar definitivo» advierte que cambia el stock y que cierra el rubro");
  ok(await stock4() === 30, "el stock de Banana Split quedó en 30");
  ok(await page.evaluate(() => (S.rubrosCerrados || []).includes("vasquetas")), "Vasquetas queda cerrado");
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(300);
  await (await page.$("#conteoInicialBtn"))?.click(); await page.click("#conteoBtn"); await page.waitForTimeout(500);
  ok(/cerrado este mes/.test(await page.innerText("main")) && await page.$("[data-c='4']") === null, "al volver, Vasquetas muestra el candado y no deja contar");
  await page.click(".tabCat:has-text('Icepops')").catch(() => {}); await page.waitForTimeout(300);
  ok(await page.$("[data-c]") !== null, "los otros rubros (Icepops) siguen abiertos para contar");
  // «Dejar en 0» (lo sin contar) no toca el rubro cerrado ni lo mete en la revisión
  const antes4 = await page.evaluate(() => S.conteo["4"]);
  const idIce = await page.$eval("[data-c]", e => e.dataset.c);
  await page.fill(`[data-c="${idIce}"]`, "3"); await page.dispatchEvent(`[data-c="${idIce}"]`, "input");
  await page.click("#go"); await page.waitForTimeout(400);
  if (await page.$("[data-csin0]")) { await page.evaluate(() => document.querySelector("[data-csin0]").click()); await page.waitForTimeout(300) }
  ok(await page.evaluate(() => S.conteo["4"]) === antes4, "«Dejar en 0» no cambió las vasquetas del rubro cerrado");
  ok(!/Banana Split/.test(await page.innerText("main")), "la revisión no lista sabores del rubro cerrado");
  console.log("errores:", err.length ? err : "ninguno");
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); await b.close(); process.exit(fallas || err.length ? 1 : 0);
})();
