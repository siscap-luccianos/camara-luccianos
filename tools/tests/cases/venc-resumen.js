const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  let fallas=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallas++};
  for (const [nom,vw,vh] of [["cel",390,844],["pc",1280,800]]) {
    const page = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage();
    const err=[]; page.on("pageerror",e=>err.push(e.message));
    await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
    await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
    await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
    await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
    await page.waitForSelector("header"); await page.waitForTimeout(300);
    await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(1000);
    await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
    const chips=await page.$$eval(".vrChip",e=>e.map(x=>x.textContent.replace(/\s+/g," ").trim()));
    console.log(nom,"Salida:",JSON.stringify(chips));
    ok(chips.some(c=>/Vencidos o a 5 días o menos.*1 lote · 10 unidades/.test(c)),nom+": rojo = 1 lote, 10 unidades");
    ok(chips.some(c=>/Sin fecha cargada.*2 lotes · 35 unidades/.test(c)),nom+": sin fecha = 2 lotes, 35 unidades");
    ok(/1 lote vence pronto/.test(await page.$eval("[data-ver-venc]",e=>e.textContent)),nom+": el botón dice «1 lote vence pronto»");
    await page.screenshot({path:`venc-resumen-${nom}.png`});
    await page.click("[data-venc-ir='vencidos']"); await page.waitForTimeout(250);
    const filas=await page.$$eval(".vencRow",e=>e.length);
    ok(filas===1 && (await page.$eval("[data-filtro-venc='vencidos']",e=>e.getAttribute("aria-pressed")))==="true",nom+": tocar «rojo» abre la lista filtrada (1 fila)");
    await page.evaluate(()=>{ S.verVencimientos=false; S.tab="stock"; renderApp() }); await page.waitForTimeout(250);
    ok((await page.$$(".vrChip")).length>=2,nom+": Stock también muestra el resumen");
    ok(err.length===0,nom+": sin errores "+JSON.stringify(err));
    await page.close();
  }
  console.log(fallas?"FALLAS "+fallas:"TODO OK"); await b.close();
})();
