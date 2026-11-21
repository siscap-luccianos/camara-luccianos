// Control › detalle: celdas recontadas pintadas (amarillo 1 vez, naranja 2+ veces, azul supervisión) y leyenda.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.addInitScript(() => localStorage.setItem("idioma", "es"));
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]'); }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.click("#tabs [data-t='control']"); await page.waitForSelector("[data-ctl-ver]");
  await page.click("button[data-ctl-ver='Local prueba']"); await page.waitForSelector(".ctlFranja"); await page.waitForTimeout(400);
  const cel = async (rub, col) => page.evaluate(([i, c]) => { const r = document.querySelectorAll(".ctlRubro")[i - 1]; if (!r) return null; const d = [...r.querySelectorAll(".ctlEq > div")].find(x => x.querySelector("small") && x.querySelector("small").textContent.trim() === c); return d ? d.className : null }, [rub, col]);
  ok(/corrY/.test(await cel(1, "INICIAL")), "Vasquetas: INICIAL en amarillo (corregido 1 vez)");
  ok(/corrO/.test(await cel(1, "CONTEO")), "Vasquetas: CONTEO en naranja (corregido 2 veces)");
  ok(!/corr/.test(await cel(2, "INICIAL")) && !/corr/.test(await cel(2, "CONTEO")), "Icepops: sin color (sin reconteo)");
  ok(/corregido ×2/.test(await page.innerText("#main")), "el cartel dice cuántas veces");
  ok(/Ajuste de supervisión/.test(await page.innerText("#main")) && /Corregido 2 o más veces/.test(await page.innerText("#main")), "la leyenda de los tres colores está abajo");
  await page.click("[data-ctl-verg='vasquetas']"); await page.waitForTimeout(200);
  ok(await page.$(".ctlProds .corrO em") !== null && /antes 12/.test(await page.innerText(".ctlProds")), "en «Ver sabores» el sabor corregido muestra cómo estaba antes");
  await page.click("[data-ctl-sel='8']"); await page.waitForTimeout(400);
  ok(/corrB/.test(await cel(1, "CONTEO")), "el parcial corregido por supervisión se pinta de azul");
  ok(err.length === 0, "sin errores de consola " + err.join(" | "));
  console.log("FALLAS " + fallas); await b.close(); process.exit(fallas ? 1 : 0);
})();
