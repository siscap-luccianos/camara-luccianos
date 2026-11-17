// El responsable ve solo el inicial; parcial y cierre aparecen como «hecho ✓» / «en revisión», sin kilos.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  page.on("dialog", d => d.accept());
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click("[data-tecla='" + d + "']"); }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1500);
  const h = await page.evaluate(() => {
    const T = Date.now();
    const lista = [{ id: "1", ts: T - 20 * 864e5, items: { "4": 2 }, camara: { "4": { u: 1, k: 10 } }, empleado: "x", cambios: [], tipo: "inicial" }];
    const ocultos = [{ id: "2", tipo: "parcial", ts: T - 5 * 864e5, libera_ts: 0 }, { id: "3", tipo: "final", ts: T - 3600e3, libera_ts: T + 3 * 3600e3 }];
    S.inv = { paso: "guardados", lista, ocultos, verDif: false };
    const html = invGuardadosHTML(); S.inv = null; return html;
  });
  const t = h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  ok(/Conteo inicial/.test(t), "se ve el conteo inicial");
  ok(/Conteo parcial/.test(t) && /Hecho ✓/.test(t) && /Hecho por/.test(t), "el parcial aparece como «Hecho ✓», sin kilos");
  ok(/Conteo de cierre/.test(t) && /En revisión/.test(t) && /desde las 12:00/.test(t), "el cierre aparece «En revisión» y dice que se ve desde las 12:00");
  ok(!/data-inv-abrir="2"/.test(h) && !/data-inv-abrir="3"/.test(h), "lo oculto no se puede abrir");
  // guardar un cierre: la respuesta oculta no rompe y vuelve a Stock
  const r = await page.evaluate(async () => {
    const orig = api; let enviado = null;
    api = async (a, b) => { if (a === "guardarInventario") { enviado = b; return { ok: true, inventario: { id: "9", ts: Date.now(), local: "Local prueba", tipo: "final", oculto: true } } } return orig(a, b) };
    S.inv = { paso: "resultado", items: { "4": 1 }, cam: { items: {}, pesos: {} }, loc: { items: {}, pesos: {} }, pedidoId: "1", pedidoTipo: "final", fase: "local", guardando: false };
    try { await invGuardarServidor() } catch (e) { return { error: String(e) } }
    api = orig; return { inv: S.inv, enviado: !!enviado };
  });
  ok(r && !r.error && r.enviado && r.inv === null, "guardar el cierre no abre el resultado: vuelve a Stock " + JSON.stringify(r && r.error || ""));
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
