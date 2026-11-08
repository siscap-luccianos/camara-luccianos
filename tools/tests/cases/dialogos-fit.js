const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  let fallas=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallas++};
  const abrirTodos={
    cantidad:()=>abrirCantidad("117","salida"),
    unidades:()=>abrirUnidades("49"),
    kilos:()=>abrirKilos("4","salida"),
    escaner:()=>abrirEscaner(),
    ayuda:()=>abrirAyuda(),
    lote:()=>{ S.tab="salida"; S.elegirLote="117"; renderElegirLote(); },
  };
  for (const [nom,vw,vh] of [["cel",390,844],["cel-bajo",390,560],["apaisado",740,360]]) {
    const page = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage();
    const err=[]; page.on("pageerror",e=>err.push(e.message));
    await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
    await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
    await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
    await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
    await page.waitForSelector("header"); await page.waitForTimeout(300);
    await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(1000);
    await page.evaluate(()=>{ S.tab="salida"; renderApp() });
    for (const k of Object.keys(abrirTodos)) {
      await page.evaluate(`(${abrirTodos[k].toString()})()`); await page.waitForTimeout(250);
      const r=await page.evaluate(()=>{ const bx=document.querySelector(".mantenerOv .mantenerBox"); if(!bx) return null; const q=bx.getBoundingClientRect(); return {box:[q.x,q.y,q.width,q.height].map(Math.round), vw:innerWidth, vh:innerHeight, scroll:bx.scrollHeight>bx.clientHeight+1, ovf:getComputedStyle(bx).overflowY} });
      if(!r){ console.log(nom,k,"(no se abrió en este contexto)"); }
      else {
        const [x,y,w,h]=r.box;
        ok(x>=0&&y>=0&&x+w<=r.vw&&y+h<=r.vh, `${nom}/${k}: entra en pantalla ${JSON.stringify(r.box)} de ${r.vw}×${r.vh}${r.scroll?" (scrollea adentro)":""}`);
      }
      await page.screenshot({path:`dlg-${nom}-${k}.png`}).catch(()=>{});
      await page.evaluate(()=>{ document.querySelectorAll(".mantenerOv").forEach(e=>e.remove()); S.cantDlg=null; S.escaner=null; S.ayuda=null; S.elegirLote=null; S.kilosDlg=null; S.uniDlg=null; });
      await page.waitForTimeout(80);
    }
    ok(err.length===0,nom+": sin errores "+JSON.stringify(err));
    await page.close();
  }
  console.log(fallas?"FALLAS "+fallas:"TODO OK"); await b.close();
})();
