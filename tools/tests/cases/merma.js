// Merma en kilos (Desperdicio › Merma en kilos): solo responsables, con sabor, lugar, kilos y motivo; queda en Historial.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 820, height: 1000 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  const posts = []; page.on("request", r => { if (r.method() === "POST") { try { posts.push(JSON.parse(r.postData())) } catch (e) {} } });
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click("[data-tecla='" + d + "']"); }
  await page.waitForSelector("header"); await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1800);
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(500);
  await page.click("[data-sal-menu='desp']"); await page.waitForTimeout(500);
  ok(!!(await page.$("#irMerma")), "en Desperdicio, el responsable ve «Merma en kilos»");
  ok(/Merma en kilos/.test(await page.innerText("#main")), "y el texto de Desperdicio lo menciona");
  await page.click("#irMerma"); await page.waitForSelector("#mermaOv");
  ok(await page.isDisabled("#mermaOk"), "«Registrar merma» arranca apagado");
  const opciones = await page.$$eval("#mermaSabor option", o => o.map(x => x.textContent));
  ok(opciones.some(t => /Banana Split/.test(t)) && !opciones.some(t => /icepop/i.test(t)), "el selector trae vasquetas (no icepops): " + opciones.join(", "));
  await page.selectOption("#mermaSabor", { label: opciones.find(t => /Banana Split/.test(t)) });
  await page.click("[data-merma-lugar='local']");
  await page.fill("#mermaKg", "0,19");
  ok(await page.isDisabled("#mermaOk"), "sin motivo sigue apagado");
  ok(!(await page.$("[data-merma-motivo]")), "sin motivos sugeridos la primera vez");
  await page.fill("#mermaOtro", "Se cayó un cucurucho");
  ok(!(await page.isDisabled("#mermaOk")), "con sabor, lugar, kilos y motivo se habilita");
  await page.click("#mermaOk"); await page.waitForTimeout(900);
  const p = posts.filter(x => x.accion === "registrarMerma")[0];
  ok(p && p.kilos === 0.19 && p.lugar === "local" && p.motivo === "Se cayó un cucurucho" && p.local === "Local prueba", "manda saborId, 0,19 kg, lugar y motivo al servidor: " + JSON.stringify(p));
  ok(!(await page.$("#mermaOv")), "el diálogo se cierra");
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(400); if (!(await page.$("#irMerma"))) { await page.click("[data-sal-menu='desp']"); await page.waitForTimeout(400); }
  await page.click("#irMerma"); await page.waitForSelector("#mermaOv");
  ok((await page.$$eval("[data-merma-motivo]", e => e.map(x => x.textContent))).join() === "Se cayó un cucurucho", "el motivo usado queda guardado para repetir");
  await page.click("[data-merma-motivo]");
  ok((await page.inputValue("#mermaOtro")) === "Se cayó un cucurucho", "tocar el motivo guardado lo completa");
  await page.click("#mermaCancel");
  await page.click("#tabs [data-t='historial']"); await page.waitForTimeout(700);
  const txt = (await page.innerText("#main")).replace(/\s+/g, " ");
  ok(/merma/i.test(txt) && /0,19 kg/.test(txt), "Historial muestra la merma con sus kilos: " + (txt.match(/[^.]{0,40}0,19 kg[^.]{0,40}/) || [""])[0]);
  console.log("CHIPS",JSON.stringify(await page.$$eval("[data-tipo-hist]",e=>e.map(x=>x.textContent))));
  ok(!!(await page.$("[data-tipo-hist='merma']")), "hay un filtro «Merma» en Historial");
  ok(err.length === 0, "sin errores de consola" + (err.length ? ": " + err.join(" | ") : ""));
  await b.close();
  console.log(fallas ? "FALLAS " + fallas : "TODO OK"); process.exit(fallas ? 1 : 0);
})();
