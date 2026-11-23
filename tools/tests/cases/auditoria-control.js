// Auditoría › Control: fechas, locales, problemas con 3 propuestas, decisión que queda guardada, contraste y celular.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts|404/.test(m.text())) err.push(m.text()) });
  let f = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) f++ };
  const entrar = async pg => {
    await pg.addInitScript(() => localStorage.setItem("idioma", "es"));
    await pg.goto("http://localhost:8999/"); await pg.waitForSelector("#authLocal");
    await pg.fill("#authLocal", "Operaciones"); await pg.click("#authLocalOk");
    await pg.fill("#authClave", "op2024"); await pg.click("#authClaveOk");
    await pg.waitForSelector("[data-authemp]"); await pg.click("[data-authemp]");
    if (await pg.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await pg.click('[data-tecla="' + d + '"]') }
    await pg.waitForSelector("header"); await pg.waitForTimeout(400);
  };
  await entrar(page);
  await page.click("#tabs [data-t='informe']"); await page.waitForSelector(".audProb"); await page.waitForTimeout(300);
  ok(/etapa de pruebas/i.test(await page.innerText(".infPruebas")) && /recuentan/i.test(await page.innerText(".infPruebas")), "aviso fijo: etapa de pruebas, cuentan y recuentan");
  ok((await page.$$(".audProb")).length === 2, "se ven los 2 problemas del período");
  ok((await page.$$(".audProb .audOp")).length === 6, "cada problema trae 3 propuestas (6 en total)");
  ok(await page.$("[data-aud-p='7'][aria-pressed='true']") !== null, "por defecto, últimos 7 días");
  await page.click("[data-aud-p='30']"); await page.waitForTimeout(400);
  ok(await page.$("[data-aud-p='30'][aria-pressed='true']") !== null, "se elige 30 días");
  await page.click("[data-aud-p='rango']"); await page.waitForSelector("#audD1");
  await page.fill("#audD1", "2026-11-10"); await page.fill("#audD2", "2026-11-12"); await page.click("[data-aud-aplicar]"); await page.waitForTimeout(400);
  const nota = await page.innerText(".audBar");
  ok(/10\/11\/2026/.test(nota) && /12\/11\/2026/.test(nota), "con «Elegir fechas» muestra el período elegido");
  await page.fill("#audBuscar", "Obelisco CABA"); await page.click("[data-aud-add]"); await page.waitForTimeout(400);
  ok((await page.$$(".audTag")).length === 1 && (await page.$$(".audProb")).length === 1, "al agregar un local, solo quedan los problemas de ese local");
  await page.click("[data-aud-quitar]"); await page.waitForTimeout(400);
  ok((await page.$$(".audProb")).length === 2, "al quitar el local vuelve a ver todos");
  await page.fill("#audBuscar", "Local que no existe"); await page.click("[data-aud-add]");
  ok((await page.$$(".audTag")).length === 0, "un local que no está en la lista no se agrega");
  await page.click(".audProb .audOp"); await page.waitForTimeout(500);
  ok((await page.$$(".audOp[aria-pressed='true']")).length === 1 && /Decisiones tomadas/.test(await page.innerText("main")) && /1 \/ 2/.test(await page.innerText(".audRes")), "elegir una propuesta la marca y suma «con decisión»");
  await page.reload(); await page.waitForSelector("#tabs"); await page.waitForTimeout(600);
  if (await page.$("#tabs [data-t='informe']")) { await page.click("#tabs [data-t='informe']"); await page.waitForSelector(".audProb"); await page.waitForTimeout(500) }
  ok((await page.$$(".audOp[aria-pressed='true']")).length === 1, "la decisión sigue después de recargar");
  await page.fill("#audIdea-unidades", "Que el supervisor revise cada lunes"); await page.click("[data-aud-idea='unidades']"); await page.waitForTimeout(500);
  ok(/Que el supervisor revise cada lunes/.test(await page.innerText("main")), "se puede guardar otra idea propia");
  const contraste = async nombre => {
    const r = await page.evaluate(() => {
      const num = s => (s.match(/[\d.]+/g) || []).map(Number);
      const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4) }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b) };
      const fondo = el => { for (let e = el; e; e = e.parentElement) { const v = num(getComputedStyle(e).backgroundColor); if (v.length >= 3 && (v.length < 4 || v[3] > .9)) return v.slice(0, 3) } return document.documentElement.getAttribute('data-tema') === 'dorado' ? [13, 12, 10] : [244, 238, 228] };
      let n = 0; const malos = [];
      document.querySelectorAll(".inf *").forEach(el => {
        if (![...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim()) || el.closest(".infSl")) return;
        const cs = getComputedStyle(el); const fg = num(cs.color).slice(0, 3), bg = fondo(el), L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        n++; if (cr < 4.5) malos.push(el.textContent.trim().slice(0, 28) + " " + cr.toFixed(1));
      });
      return { n, malos };
    });
    ok(r.malos.length === 0, "contraste (" + nombre + "): " + r.n + " textos, " + r.malos.length + " flojos " + JSON.stringify(r.malos.slice(0, 5)));
  };
  await contraste("crema");
  await page.evaluate(() => document.documentElement.setAttribute("data-tema", "dorado")); await page.waitForTimeout(200); await contraste("dorado");
  await page.evaluate(() => document.documentElement.removeAttribute("data-tema"));
  const cel = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); cel.on("pageerror", e => err.push(e.message));
  await entrar(cel); await cel.click("#tabs [data-t='informe']"); await cel.waitForSelector(".audProb"); await cel.waitForTimeout(300);
  ok(await cel.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "en el celular no se desborda a los costados");
  ok(await cel.evaluate(() => { const o = document.querySelector(".audProps"); return o && getComputedStyle(o).gridTemplateColumns.split(" ").length === 1 }), "en el celular las 3 propuestas van una debajo de la otra");
  await cel.click("[data-inf-vista='slides']"); await cel.waitForTimeout(200);
  ok(await cel.$(".infLista") !== null, "la vista «Presentación» sigue disponible");
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(f || err.length ? "FALLAS " + (f + err.length) : "FALLAS 0"); process.exit(f || err.length ? 1 : 0);
})();
