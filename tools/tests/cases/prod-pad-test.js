const { chromium } = require("playwright");
let fails=0; const ok=(c,m)=>{ console.log((c?"OK   ":"FALLA ")+m); if(!c) fails++ };
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{ if(m.type()==="error" && !/404/.test(m.text())) err.push(m.text()) });
  await page.goto("http://localhost:8996/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.click("[data-t='salida']"); await page.waitForTimeout(300);
  ok(await page.$("#irEscaner")!==null, "local común con kilos reales: tiene «Escanear vasqueta»");
  await page.evaluate(()=>{ S.produccionLocal=true; renderApp() }); await page.waitForTimeout(200);
  ok(await page.$("#irEscaner")!==null, "Local prueba (produccion=SI pero sin «sin_escaner»): conserva el escáner");
  await page.evaluate(()=>{ S.produccionLocal=false; S.sinEscaner=true; renderApp() }); await page.waitForTimeout(300);
  ok(await page.$("#irEscaner")===null, "local con sin_escaner=SI: sin «Escanear vasqueta»");
  const tiles=await page.$$eval(".accTile",e=>e.map(x=>x.textContent.trim().replace(/\s+/g," ")));
  ok(tiles.length>=2 && tiles.some(t=>/Desperdicio/.test(t)), "quedan las demás acciones: "+tiles.join(" | "));
  // tocar una vasqueta abre el pad ¿Cuánto pesa?
  const card=await page.$("[data-add='4'], [data-wadd='4'], .card .pick");
  await card.click(); await page.waitForTimeout(300);
  ok(await page.$("#kilosOv")!==null || (await page.$eval("body",e=>/Cuánto pesa/.test(e.textContent))), "tocar el sabor abre «¿Cuánto pesa?»");
  for(const d of ["3","5","5"]) { const bt=await page.$(`#kilosOv [data-kg-tecla='${d}'], #kilosOv button:text-is('${d}')`); if(bt) await bt.click(); }
  const temas=await page.evaluate(()=>{ const t=ayudaTemas().map(x=>x.id); return t });
  ok(temas.includes("pesar") && !temas.includes("escaner"), "el «?» explica el pad y no el escáner: "+temas.join(","));
  await page.evaluate(()=>{ S.sinEscaner=false });
  const t2=await page.evaluate(()=>ayudaTemas().map(x=>x.id)); ok(t2.includes("escaner") && !t2.includes("pesar"), "local común: el «?» sigue con el escáner");
  ok(err.length===0, "sin errores de consola"+(err.length?": "+err.join(" | "):""));
  console.log(fails?("\n"+fails+" FALLAS"):"\nTODO OK"); await b.close(); process.exit(fails?1:0);
})();
