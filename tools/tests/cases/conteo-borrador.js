// Conteo físico: etiquetas «sin contar», revisión antes de guardar, confirmación de saltos y borrador automático.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  page.on("dialog", d => d.accept());
  const entrar = async () => {
    await page.goto("http://localhost:8998/");
    await page.waitForSelector("#authLocal, header");
    if (await page.$("#authLocal")) {
      await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
      await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
      await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
      await page.waitForSelector("header"); await page.waitForTimeout(300);
    }
    await page.waitForTimeout(500);
    const local = await page.$eval("#local", e => e.value).catch(() => "");
    if (local !== "Local prueba") { await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); }
    await page.waitForTimeout(1200);
    await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);
  };
  const confirmarTodos = async () => { for (let i = 0; i < 20 && await page.$(".cvFlag button:not(.ok)"); i++) { await page.click(".cvFlag button:not(.ok)"); await page.waitForTimeout(120) } };
  await entrar();
  await page.click("#conteoBtn"); if (await page.$("[data-ce-empezar]") || await page.waitForSelector("[data-ce-empezar]",{timeout:700}).catch(()=>null)) await page.click("[data-ce-empezar]"); await page.waitForTimeout(400);

  // 1) estado inicial: sabores con stock sin tocar = «Sin contar»; barra de avance
  const badge = id => page.$eval(`[data-cbadge="${id}"]`, e => e.hidden ? "" : e.textContent.trim());
  ok(await badge("4") === "Sin contar", "Banana Split (stock 20) arranca «Sin contar»: " + await badge("4"));
  ok(/0 de \d+ contados/.test(await page.innerText("#conteoProg")), "barra de avance en 0: " + (await page.innerText("#conteoProg")).replace(/\s+/g, " "));
  ok(/Faltan \d+ sin contar/.test(await page.innerText("#bar")), "la barra de abajo avisa cuántos faltan");

  // 2) cargar números: 4: 20→0 (queda en 0), 20: 6→60 (salto), 5: 3→3 (igual)
  const cargar = async (id, v) => { await page.fill(`[data-c="${id}"]`, String(v)); await page.dispatchEvent(`[data-c="${id}"]`, "input"); await page.waitForTimeout(80) };
  await cargar(4, 0); await cargar(20, 60); await cargar(5, 2);
  ok(await badge("4") === "Queda en 0", "20 → 0 muestra «Queda en 0»: " + await badge("4"));
  ok(await badge("20") === "Salto raro", "6 → 60 muestra «Salto raro»: " + await badge("20"));
  ok(await badge("5") === "Igual al sistema", "2 → 2 (igual al stock del sistema) muestra «Igual al sistema»: " + await badge("5"));
  ok(/3 de \d+ contados/.test(await page.innerText("#conteoProg")), "el avance sube a 3");

  // vasquetas con kilos reales (Local prueba): hay que cargar los kilos totales para poder revisar
  for (const id of ["20", "5"]) { await page.fill(`[data-kc="${id}"]`, "11,4"); await page.dispatchEvent(`[data-kc="${id}"]`, "input") }
  await page.waitForTimeout(150);

  // 3) borrador: se guarda solo (debounce) y sobrevive a recargar
  await page.waitForTimeout(900);
  const crudo = await page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.indexOf("conteoBorrador:") >= 0); return k ? localStorage.getItem(k) : null });
  ok(!!crudo && JSON.parse(crudo).vals["20"] === 60, "el borrador queda guardado en el equipo");

  // 4) revisar: resumen + confirmaciones obligatorias
  await page.click("#go"); await page.waitForTimeout(400);
  const txt = (await page.innerText("main")).replace(/\s+/g, " ");
  ok(/Revisá antes de guardar/.test(txt), "abre la pantalla de revisión");
  ok(/Así queda el stock/i.test(txt) && /Total:/.test(txt), "muestra «Así queda el stock» con el total antes y después");
  ok(await page.$$eval(".cvFlag", e => e.length) === 2, "pide confirmar los 2 números raros");
  ok(await page.$eval("#ok", e => e.disabled), "«Guardar conteo» queda apagado sin confirmar");
  ok(/Confirmá 2 números/.test(await page.innerText("#bar")), "la barra dice cuántos faltan confirmar");
  await confirmarTodos();
  // vasquetas con kilos reales: hay que cargar los kilos para poder guardar (se vuelve a contar y se completan)
  await page.click("#volver"); await page.waitForTimeout(300);
  ok(await page.$("#go") !== null, "«Volver a contar» regresa a la lista");
  ok(await badge("20") === "Salto raro", "los números siguen cargados al volver");

  // 5) recargar la página: el borrador reaparece y se retoma
  await page.waitForTimeout(800);
  await entrar();
  const banner = (await page.innerText(".cBorrador")).replace(/\s+/g, " ");
  ok(/Tenés un conteo sin terminar/.test(banner), "tras recargar aparece «Tenés un conteo sin terminar»");
  await page.click("#continuarConteo"); await page.waitForTimeout(400);
  ok(await page.$eval('[data-c="20"]', e => e.value) === "60", "«Continuar donde quedé» recupera lo cargado (60)");
  ok(await badge("20") === "Salto raro", "y la etiqueta «Salto raro»");
  ok(await badge("4") === "Queda en 0", "y «Queda en 0»");

  // 6) confirmar y guardar
  await page.click("#go"); await page.waitForTimeout(300);
  await confirmarTodos();
  ok(!(await page.$eval("#ok", e => e.disabled)), "con todo confirmado se puede guardar");
  await page.click("#ok"); await page.waitForTimeout(1200);
  ok(/Conteo guardado/.test(await page.innerText("#toast").catch(() => "")) || (await page.$("#conteoBtn")) !== null, "se guarda y vuelve a Stock");
  const quedo = await page.evaluate(() => Object.keys(localStorage).some(k => k.indexOf("conteoBorrador:") >= 0));
  ok(!quedo, "el borrador se borra al guardar");
  ok(await page.$(".cBorrador") === null, "ya no aparece el aviso de conteo sin terminar");

  // 7) descartar
  await page.click("#conteoBtn"); if (await page.$("[data-ce-empezar]") || await page.waitForSelector("[data-ce-empezar]",{timeout:700}).catch(()=>null)) await page.click("[data-ce-empezar]"); await page.waitForTimeout(300);
  await cargar(20, 7);
  await page.waitForTimeout(800);
  await page.click("#cancelConteo"); await page.waitForTimeout(300);
  ok(await page.$(".cBorrador") === null, "«Cancelar» descarta el borrador");

  ok(err.length === 0, "sin errores de consola " + JSON.stringify(err));
  console.log(fallas ? "FALLAS " + fallas : "TODO OK");
  await b.close();
})().catch(e => { console.error("ERROR", e.message); process.exit(1) });
