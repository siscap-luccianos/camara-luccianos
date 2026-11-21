// Responsable viendo un conteo parcial que supervisión le mostró: 1 hora, sin copiar ni imprimir y con marca de agua con su nombre.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  await page.addInitScript(() => localStorage.setItem("idioma", "es"));
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]'); }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  const html = (rol, hasta) => page.evaluate(([rol, hasta]) => {
    S.empleado = Object.assign({}, S.empleado, { rol, nombre: "Marta Gómez" });
    const x = { id: "9", tipo: "parcial", ts: Date.now(), empleado: "Marta", items: { "4": 2 }, camara: { "4": { u: 2 } }, cambios: [], visible_hasta: hasta ? Date.now() + hasta : 0 };
    S.inv = { paso: "ver", ver: x, items: {}, tocado: {}, res: "rubro", det: null, busca: "" };
    return invResultadoHTML();
  }, [rol, hasta]);
  let h = await html("encargado", 40 * 60000);
  ok(/invProt/.test(h) && /invMarca/.test(h) && /Marta Gómez/.test(h), "el responsable ve el resultado con marca de agua con su nombre");
  ok(/Lo ves hasta las/.test(h) && /No se puede copiar ni imprimir/.test(h), "avisa hasta cuándo lo ve y que no se copia ni imprime");
  h = await html("encargado", -60000);
  ok(/ya no está disponible/.test(h) && !/invProt/.test(h), "pasada la hora ya no se muestra");
  h = await html("admin", -60000);
  ok(!/ya no está disponible/.test(h) && !/invProt/.test(h), "el admin lo ve siempre, sin marca");
  h = await html("supervisor", 0);
  ok(!/invProt/.test(h), "el supervisor lo ve sin restricciones");
  // copiar y menú contextual bloqueados dentro de la zona protegida
  await page.evaluate(() => { document.body.insertAdjacentHTML("beforeend", '<div class="invProt" id="zonaP">dato</div><div id="zonaL">libre</div>'); });
  const r = await page.evaluate(() => { const ev = (t, id) => { const e = new Event(t, { bubbles: true, cancelable: true }); document.getElementById(id).dispatchEvent(e); return e.defaultPrevented }; return { p: ev("copy", "zonaP"), c: ev("contextmenu", "zonaP"), l: ev("copy", "zonaL") } });
  ok(r.p && r.c && !r.l, "copiar y menú contextual bloqueados solo en la zona protegida");
  const imp = await page.evaluate(() => { const st = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch (e) { return [] } }).filter(x => x.type === 4 && /invProt/.test(x.cssText)); return st.length });
  ok(imp > 0, "al imprimir la zona protegida se oculta");
  ok(err.length === 0, "sin errores de consola " + err.join(" | "));
  console.log("FALLAS " + fallas); await b.close(); process.exit(fallas ? 1 : 0);
})();
