const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  let fallas=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallas++};
  for (const [nom,vw,vh] of [["pc",1280,720],["cel",390,844],["cel-bajo",390,560]]) {
    const page = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage();
    const err=[]; page.on("pageerror",e=>err.push(e.message));
    await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
    await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
    await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
    await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
    await page.waitForSelector("header"); await page.waitForTimeout(300);
    await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(1000);
    await page.evaluate(()=>{ S.tab="salida"; S.verVencimientos=true; S.filtroVenc="todos"; renderApp() }); await page.waitForTimeout(150);
    const btn=(await page.$$eval("[data-etiq-cambiar]",e=>e.map(x=>x.dataset.etiqCambiar)))[0];
    await page.click("[data-etiq-cambiar='"+btn+"']"); await page.waitForTimeout(250);
    const r=await page.evaluate(()=>{const s=document.querySelector(".etiqSheet").getBoundingClientRect(), o=document.querySelector(".etiqOv").getBoundingClientRect(); return {s:[s.x,s.y,s.width,s.height].map(Math.round), o:[o.x,o.y,o.width,o.height].map(Math.round), vw:innerWidth, vh:innerHeight, bodyOv:getComputedStyle(document.body).overflow, sc:document.querySelector(".etiqSheet").scrollHeight>document.querySelector(".etiqSheet").clientHeight}});
    console.log(nom, JSON.stringify(r));
    const [x,y,w,h]=r.s;
    ok(x>=0 && y>=0 && x+w<=r.vw && y+h<=r.vh,nom+": el cuadro entra completo en la pantalla");
    ok(Math.abs((x+w/2)-r.vw/2)<2,nom+": centrado horizontal");
    if(!r.sc) ok(Math.abs((y+h/2)-r.vh/2)<2,nom+": centrado vertical"); else console.log("   (más alto que la pantalla: scrollea adentro)");
    ok(r.bodyOv==="hidden",nom+": el fondo no se desplaza");
    await page.screenshot({path:"etiq-centro-"+nom+".png"});
    ok(err.length===0,nom+": sin errores "+JSON.stringify(err));
    await page.close();
  }
  console.log(fallas?"FALLAS "+fallas:"TODO OK"); await b.close();
})();
