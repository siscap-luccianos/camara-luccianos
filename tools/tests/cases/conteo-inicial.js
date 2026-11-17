// Conteo inicial: cartel único en Stock, adentro Conteo cámara + Conteo local = Conteo inicial, aviso de novedad y candado desde el 1/12.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  page.on("dialog", d => d.accept());
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1500);
  const bannerVisible = async () => (await page.$(".avisoNovedad")) !== null;
  ok(await bannerVisible(), "el aviso de novedad se ve al abrir la app");
  ok(/Stock definitivo pasa a ser el «Conteo inicial»/.test(await page.innerText("#main")) && /Desde el 1\/12 queda fijo/.test(await page.innerText("#main")), "el aviso explica el cambio y la fecha");
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);
  ok(await bannerVisible(), "se ve también en Stock");
  ok(!(await page.$("#avisoConteoOk")), "no tiene botón «Entendido»: queda fijo");
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(1200);
  ok(await bannerVisible(), "después de recargar sigue ahí");
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);
  const tarjetas = await page.$$eval(".stkPaso", e => e.map(x => x.textContent.replace(/\s+/g, " ").trim()));
  ok(tarjetas.length === 1 && /Conteo inicial/.test(tarjetas[0]) && !/Conteo físico/.test(await page.innerText("#main")), "en Stock queda un solo cartel «Conteo inicial» (sin «Conteo físico» suelto): " + tarjetas.join(" | "));
  await page.click("#conteoInicialBtn"); await page.waitForTimeout(200);
  const hub = await page.$$eval(".stkPaso b", e => e.map(x => x.textContent.trim()));
  ok(hub.join("|") === "Conteo cámara|Conteo local|Conteo inicial", "adentro: " + hub.join(" + "));
  ok(await page.$("#hubVolver") !== null, "hay «Volver a Stock»");
  await page.click("#hubVolver"); await page.waitForTimeout(200);
  ok(await page.$("#conteoInicialBtn") !== null, "volver deja el Stock con su cartel");
  // Conteo inicial fijo: sin «Corregir»
  const sinCorregir = await page.evaluate(() => {
    S.inv = { paso: "resultado", rubro: invGrupos()[0], items: {}, tocado: {}, res: "prod", det: null, busca: "", lista: null, errorLista: null, restaurado: false,
      ver: { id: "9", ts: Date.parse("2026-12-05T10:00:00-03:00"), camara_ts: Date.parse("2026-12-04T23:40:00-03:00"), fuera_jornada: true, fijo: true, items: { "4": 2 }, camara: { "4": { u: 3 } }, cambios: [], aprox: false, empleado: "Laura" } };
    renderApp(); const t = document.querySelector("#main").innerText; const hay = !!document.querySelector("[data-inv-cor]"); return { hay, t };
  });
  ok(!sinCorregir.hay, "un conteo inicial fijo no ofrece «Corregir»");
  ok(/Conteo inicial fijo/.test(sinCorregir.t) && /Cámara contada/.test(sinCorregir.t) && /Cerrado fuera de la jornada/.test(sinCorregir.t), "muestra el candado, las dos horas y la marca de fuera de jornada");
  const conCorregir = await page.evaluate(() => { S.inv.ver.fijo = false; S.inv.ver.fuera_jornada = false; renderApp(); return { hay: !!document.querySelector("[data-inv-cor]"), t: document.querySelector("#main").innerText } });
  ok(conCorregir.hay && /de práctica/.test(conCorregir.t) && !/fuera de la jornada/i.test(conCorregir.t.replace(/Cerrado fuera de la jornada: el conteo/,"")), "uno de práctica sí se puede corregir y avisa que es de práctica");
  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
