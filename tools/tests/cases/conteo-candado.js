// Conteo guardado: en vez de «Corregir» hay un candado; solo supervisión lo desbloquea (PIN) y, al corregir, se vuelve a cerrar.
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
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1500);
  const html = (rol, fijo) => page.evaluate(([rol, fijo]) => {
    S.empleado.rol = rol;
    const x = { id: "77", ts: Date.now(), items: { "4": 2 }, camara: { "4": { u: 1, k: 10 } }, empleado: "Laura", cambios: [], tipo: "inicial", fijo };
    S.inv = { paso: "ver", ver: x, res: "prod", det: null, busca: "", lista: [x], ocultos: [] };
    const h = invResultadoHTML(); S.inv = null; return h;
  }, [rol, fijo]);
  let h = await html("encargado", true);
  ok(!/data-inv-cor=/.test(h) && !/data-inv-desb=/.test(h) && /🔒/.test(h), "el responsable ve el candado, sin «Corregir» y sin poder desbloquear");
  h = await html("supervisor", true);
  ok(/data-inv-desb="77"/.test(h) && !/data-inv-cor=/.test(h), "supervisión ve «🔒 Desbloquear»");
  h = await html("encargado", false);
  ok(/data-inv-cor=/.test(h) && /Desbloqueado por supervisión/.test(h), "con el candado abierto aparece «Corregir»");
  const l = await page.evaluate(() => { S.empleado.rol = "encargado"; S.inv = { paso: "guardados", lista: [{ id: "1", ts: Date.now(), items: { "4": 2 }, camara: { "4": { u: 1, k: 10 } }, empleado: "Laura", cambios: [], tipo: "inicial" }], ocultos: [{ id: "2", tipo: "parcial", ts: Date.now(), empleado: "Pedro", libera_ts: 0 }], verDif: false }; const h = invGuardadosHTML(); S.inv = null; return h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") });
  ok(/Cargado por Laura/.test(l) && !/kg/.test(l), "la lista del inicial muestra solo quién lo cargó, sin kilos: " + l.slice(0, 160));
  ok(/Hecho por Pedro/.test(l) && !/Lo ve supervisión/.test(l), "el parcial oculto dice quién lo hizo y no «Lo ve supervisión»");
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
