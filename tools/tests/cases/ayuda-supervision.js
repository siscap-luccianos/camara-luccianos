// Ayuda «?» de supervisión: temas extra solo para admin y supervisor, y botón «Cómo funciona» en Control.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click("[data-tecla='" + d + "']"); }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.click("#tabs [data-t='control']"); await page.waitForSelector(".ctlTabla"); await page.waitForTimeout(300);
  ok(!!(await page.$("[data-ctl-como]")), "Control tiene el botón «Cómo funciona»");
  await page.click("[data-ctl-como]"); await page.waitForSelector("#ayudaOv"); await page.waitForTimeout(200);
  let t = (await page.innerText("#ayudaOv")).replace(/\s+/g, " ");
  ok(/SUPERVISIÓN/i.test(t) && /Control de stock/.test(t) && /Pedir un conteo/.test(t) && /Candados/.test(t) && /PARA TODOS/i.test(t), "el «?» muestra la sección Supervisión y «Para todos»");
  ok(await page.evaluate(() => S.ayudaTema) === "control" && /Cada fila es un local/.test(t), "abre directo en «Control de stock»");
  const n = await page.$$eval("#ayLista .ayTema", e => e.length); ok(n >= 8, "los temas de supervisión se suman a los de siempre: " + n);
  await page.click("[data-ay-tema='candados']"); await page.waitForTimeout(150);
  ok(/Desbloquear/.test(await page.innerText("#ayudaOv")), "se abre un tema a la vez");
  await page.keyboard.press("Escape");
  // un responsable no ve los temas de supervisión
  const r = await page.evaluate(() => { S.empleado.rol = "encargado"; return ayudaTemas().filter(x => x.grupo === "sup").length });
  ok(r === 0, "el responsable no ve los temas de supervisión");
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
