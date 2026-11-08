const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  let fallas=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallas++};
  for (const [nom,vw,vh] of [["cel",390,900],["pc",1280,800]]) {
    const page = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage();
    const err=[]; page.on("pageerror",e=>err.push(e.message));
    await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
    await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
    await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
    await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
    await page.waitForSelector("header"); await page.waitForTimeout(300);
    await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(1200);
    await page.evaluate(()=>{ S.stockValorizado=true; S.tab="gestion"; S.produccionLocal=false; renderApp() });
    await page.waitForTimeout(1500);
    const heads=await page.$$eval(".gvTbl th",e=>e.map(x=>x.textContent.trim()));
    ok(JSON.stringify(heads)===JSON.stringify(["Producto","Unid.","Kilos","Costo unit.","Valor"]),nom+": columnas "+heads.join(" | "));
    const filas=await page.$$eval(".gvTbl tbody tr",e=>e.map(x=>[...x.children].map(c=>c.textContent.replace(/\s+/g," ").trim())));
    console.log("  ",JSON.stringify(filas.slice(0,3)));
    const bn=filas.find(f=>/Banana/.test(f[0])); ok(bn && /^\$ 7\.822\/kg$/.test(bn[3]),nom+": Banana Split por kilo: "+(bn&&bn[3]));
    const ice=filas.find(f=>/Frutilla icepop/.test(f[0])); ok(!ice || /^\$ 1\.709\/u\.$/.test(ice[3]),nom+": Icepop por unidad: "+(ice&&ice[3]));
    const pos=await page.evaluate(()=>{ const t=document.querySelector(".gvTbl table"); const th=[...t.querySelectorAll("th")].map(x=>Math.round(x.getBoundingClientRect().x+x.getBoundingClientRect().width/2)); const td=[...t.querySelector("tbody tr").children].map(x=>Math.round(x.getBoundingClientRect().x+x.getBoundingClientRect().width/2)); return {th,td,ov:t.scrollWidth>t.parentElement.clientWidth+1} });
    ok(JSON.stringify(pos.th)===JSON.stringify(pos.td),nom+": encabezados y celdas alineados "+JSON.stringify(pos.th));
    ok(!pos.ov,nom+": la tabla no desborda");
    await page.emulateMedia({media:"print"});
    const ovp=await page.evaluate(()=>{ const t=document.querySelector(".gvTbl table"); return t.scrollWidth>t.parentElement.clientWidth+1 });
    ok(!ovp,nom+": en impresión tampoco desborda");
    await page.emulateMedia({media:"screen"});
    await page.screenshot({path:`gestion-costo-${nom}.png`});
    ok(err.length===0,nom+": sin errores "+JSON.stringify(err));
    await page.close();
  }
  console.log(fallas?"FALLAS "+fallas:"TODO OK"); await b.close();
})();
