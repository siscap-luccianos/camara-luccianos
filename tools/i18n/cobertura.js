// Recorre pantallas en francés y lista los textos que quedaron en español.
// Uso (con el mock en 8999 y el servidor de tests en 8995): node tools/i18n/cobertura.js
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  const vistos = new Map();
  const esp = /(\b(el|los|las|del|que|para|con|una|tu|tus|hay|sin|este|esta|ya|se|lo|al|por|todavía|menos|más|cargá|tocá|elegí|escribí|revisá|pesado|informe|todos|supervisión|generado|prueba|catálogo)\b|[¿¡ñ]|[a-z]ción\b)/i;
  async function barrer(etq) {
    const l = await page.evaluate(() => {
      const out = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const p = n.parentNode;
        if (!p || /SCRIPT|STYLE/.test(p.nodeName)) continue;
        const t = n.nodeValue.replace(/\s+/g, " ").trim();
        if (t.length > 2) out.push(t);
      }
      document.querySelectorAll("[placeholder],[title],[aria-label]").forEach((e) =>
        ["placeholder", "title", "aria-label"].forEach((a) => {
          const v = e.getAttribute(a);
          if (v && v.length > 2) out.push(v);
        })
      );
      return out;
    });
    for (const t of l) if (esp.test(t) && !vistos.has(t)) vistos.set(t, etq);
  }
  await page.goto("http://localhost:8995/");
  await page.waitForSelector("#authLocal");
  const idioma = process.env.IDIOMA || "fr";
  await page.evaluate((i) => localStorage.setItem("idioma", i), idioma);
  await page.reload();
  await page.waitForSelector("#authLocal");
  await barrer("login");
  await page.fill("#authLocal", "Operaciones");
  await page.click("#authLocalOk");
  await barrer("clave");
  await page.fill("#authClave", "op2024");
  await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]");
  await barrer("perfiles");
  await page.click("[data-authemp]");
  if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) {
    await barrer("pin");
    for (const d of "1234") await page.click('[data-tecla="' + d + '"]');
  }
  await page.waitForSelector("header");
  await page.waitForTimeout(400);
  await barrer("operaciones");
  await page.fill("#local", "Local prueba");
  await page.press("#local", "Enter");
  await page.waitForTimeout(1200);
  for (const t of ["salida", "ingreso", "stock", "historial", "equipo", "sabores", "gestion"]) {
    const el = await page.$(`#tabs [data-t='${t}']`);
    if (!el) continue;
    await el.click();
    await page.waitForTimeout(700);
    await barrer(t);
    for (const sel of ["#irDesperdicio", "#irVentaDia", "[data-ing-menu='dev']", "[data-ing-menu='merc']", "[data-ing-menu='cambio']", "#conteoBtn", "#verPedidoBtn", "#inventarioBtn"]) {
      const x = await page.$(sel);
      if (x && (await x.isVisible())) {
        await x.click().catch(() => {});
        await page.waitForTimeout(500);
        await barrer(t + ":" + sel);
        const v = await page.$("#volverSalida, #volverIngreso, #cancelConteo");
        if (v) await v.click().catch(() => {});
        await page.waitForTimeout(200);
      }
    }
  }
  await page.click("#ayudaBtn").catch(() => {});
  await page.waitForTimeout(400);
  await barrer("ayuda");
  for (const h of await page.$$(".ayTema > button, .ayTema summary, [data-ayt]")) {
    await h.click().catch(() => {});
    await page.waitForTimeout(150);
    await barrer("ayuda-tema");
  }
  console.log([...vistos.entries()].map(([t, e]) => e + " | " + t).join("\n"));
  console.log("\n" + vistos.size + " textos en español");
  await b.close();
})();
