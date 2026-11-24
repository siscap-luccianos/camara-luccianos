// Retiros: sin columna «chocolatería» en «Salió hoy» y aviso de consumo cargado / días sin cargar.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message));
  let f = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) f++ };
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1200);
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(500);
  const hero = () => page.evaluate(() => { const h = document.querySelector(".menuHero"); return h ? h.innerText : "" });
  const setReg = async (dias, sub) => { await page.evaluate(([d, sub]) => { S.regs = S.regs.filter(r => !String(r.id).startsWith("tc")); if (d !== null) { const id = String(S.sabores.find(x => grupoProductoDe(x) === "chocolateria").id); S.regs.push({ id: "tc1", tipo: "salida", subtipo: sub, ts: jornadaDe() - d * 864e5 + 19.5 * 36e5, items: { [id]: 2 }, local: S.local }) } renderApp() }, [dias, sub]); await page.waitForTimeout(300) };
  await setReg(null, "venta");
  let t = await hero();
  ok(!/chocolater[ií]a\s*$/im.test(t.split("Salió hoy")[1].split("sin stock")[0]) , "«Salió hoy» ya no tiene columna de chocolatería");
  ok(/Chocolatería: sin consumo cargado/.test(t), "sin consumo cargado nunca: aviso rojo");
  await setReg(1, "venta"); t = await hero();
  ok(/Consumo de chocolatería cargado al \d\d\/\d\d/.test(t), "cargado ayer: aviso verde con fecha");
  await setReg(3, "giftcard"); t = await hero();
  ok(/Chocolatería: 3 días sin cargar consumo/.test(t), "3 días sin cargar: aviso rojo con la cuenta");
  await setReg(1, "transferencia"); t = await hero();
  ok(/sin consumo cargado/.test(t), "una transferencia no cuenta como consumo");
  await setReg(0, "sincargo"); t = await hero();
  ok(/cargado al/.test(t), "sin cargo de hoy cuenta");
  // local sin chocolatería activada: nada
  const sin = await page.evaluate(() => { S.regs = S.regs.filter(r => !String(r.id).startsWith("tc")); const g = S.sabores; S.sabores = g.filter(x => grupoProductoDe(x) !== "chocolateria"); S.excluidos = []; renderApp(); const h = document.querySelector(".menuHero").innerText; S.sabores = g; return h });
  ok(!/hocolater/i.test(sin), "sin chocolatería no existe ningún aviso");
  // ingreso conserva su columna
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(400);
  ok(!/sin cargar consumo|cargado al/.test(await hero()), "Ingreso no lleva el aviso de consumo");
  ok(err.length === 0, "sin errores de consola " + err.join("|"));
  await b.close(); process.exit(f ? 1 : 0);
})();
