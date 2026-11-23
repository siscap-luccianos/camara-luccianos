// Informe de salud (solo admin): diapositivas 16:9, aviso de etapa de pruebas, sin desbordes, modo lista, teclas y legibilidad.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const err = [];
  page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts|404/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
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

  ok(await page.$("#tabs [data-t='informe']") !== null, "el admin ve la pestaña «Auditoría» en Operaciones");
  await page.click("#tabs [data-t='informe']"); await page.waitForSelector(".audBar"); await page.click("[data-inf-vista='slides']"); await page.waitForSelector("#infBox"); await page.waitForTimeout(500);
  const aviso = await page.innerText(".infPruebas");
  ok(/etapa de pruebas/i.test(aviso) && /conteo fijo/i.test(aviso), "arriba hay un aviso fijo: gestión en etapa de pruebas para detectar inconsistencias antes del conteo fijo");
  const n = await page.$$eval(".infSl", s => s.length);
  ok(n === 11, "el informe tiene 11 diapositivas (" + n + ")");
  ok(!(await page.$eval("#infStage", e => e.textContent)).match(/6\.250|toneladas|miles de cajas/), "no queda ninguna mención de Geladot como error (se guarda en gramos)");
  const sol = await page.$$eval(".infSl", ss => ss.map((s, i) => { const pie = s.querySelector(".pie").offsetTop; const fin = Math.max(...[...s.children].filter(c => !c.classList.contains("pie")).map(c => c.offsetTop + c.offsetHeight)); return { i: i + 1, fin, pie } }));
  const malas = sol.filter(x => x.fin > x.pie - 4);
  ok(malas.length === 0, "ninguna diapositiva se pisa con el pie: " + JSON.stringify(malas));
  const bw = await page.$eval("#infBox", e => e.getBoundingClientRect().width);
  const sw = await page.$eval("#infStage", e => e.getBoundingClientRect().width);
  ok(Math.abs(sw - bw) < 3, "el lienzo de 1920 px se escala al ancho disponible");
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(200);
  ok(/2 \/ 11/.test(await page.innerText(".infCtl")), "la flecha derecha pasa a la siguiente diapositiva");
  await page.click("[data-inf-sig]"); await page.waitForTimeout(200);
  ok(/3 \/ 11/.test(await page.innerText(".infCtl")), "«Siguiente» también avanza");
  await page.click("[data-inf-ant]"); await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(200);
  ok(/1 \/ 11/.test(await page.innerText(".infCtl")) && await page.$eval("[data-inf-ant]", e => e.disabled), "se puede volver y en la primera queda apagado «Anterior»");
  ok((await page.$$eval(".infSl.on", s => s.length)) === 1, "solo una diapositiva visible a la vez");

  const contraste = async nombre => {
    const r = await page.evaluate(() => {
      const num = s => (s.match(/[\d.]+/g) || []).map(Number);
      const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4) }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b) };
      const fondo = el => { for (let e = el; e; e = e.parentElement) { const v = num(getComputedStyle(e).backgroundColor); if (v.length >= 3 && (v.length < 4 || v[3] > .9)) return v.slice(0, 3) } return [244, 238, 228] };
      let medidos = 0; const malos = [];
      document.querySelectorAll(".infSl *").forEach(el => {
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
        const cs = getComputedStyle(el); if (!el.closest(".infSl")) return;
        const fg = num(cs.color).slice(0, 3), bg = fondo(el), L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        medidos++; if (cr < 4.5) malos.push(el.textContent.trim().slice(0, 30) + " " + cr.toFixed(1));
      });
      return { medidos, malos };
    });
    ok(r.malos.length === 0, "contraste del informe (" + nombre + "): " + r.medidos + " textos, " + r.malos.length + " con poco contraste " + JSON.stringify(r.malos.slice(0, 5)));
  };
  await contraste("crema");
  await page.evaluate(() => document.documentElement.setAttribute("data-tema", "dorado")); await page.waitForTimeout(200);
  await contraste("dorado");
  await page.evaluate(() => document.documentElement.removeAttribute("data-tema"));

  const cel = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  cel.on("pageerror", e => err.push(e.message));
  await entrar(cel);
  await cel.click("#tabs [data-t='informe']"); await cel.waitForSelector(".audBar"); await cel.click("[data-inf-vista='slides']"); await cel.waitForSelector(".infLista"); await cel.waitForTimeout(300);
  ok((await cel.$$(".infLista .infSl")).length === 11, "en el celular se ve como lista con las 11 secciones");
  ok(await cel.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "el celular no se desborda a los costados");
  await cel.click("[data-inf-modo]"); await cel.waitForSelector("#infBox"); await cel.waitForTimeout(200);
  ok(await cel.$("#infBox") !== null, "en el celular se puede pasar a diapositivas");

  await page.evaluate(() => { S.empleado.rol = "supervisor"; renderApp() }); await page.waitForTimeout(200);
  ok(await page.$("#tabs [data-t='informe']") === null, "el supervisor no ve la pestaña «Auditoría»");
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
