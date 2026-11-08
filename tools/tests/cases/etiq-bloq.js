const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch:true, isMobile:true, deviceScaleFactor:2 });
  const page = await ctx.newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message));
  const ok=(c,m)=>console.log((c?"OK   ":"FALLA")+" "+m);
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.tap("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.tap("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.tap("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(1000);
  await page.evaluate(()=>{ S.tab="salida"; S.verVencimientos=true; S.filtroVenc="todos"; renderApp() }); await page.waitForTimeout(200);
  const btns=await page.$$eval("[data-etiq-cambiar]",e=>e.map(x=>x.dataset.etiqCambiar));
  await page.tap("[data-etiq-cambiar='"+btns[1]+"']"); await page.waitForTimeout(300);
  await page.screenshot({path:"etiq-bloq-1.png"});
  // ¿qué elemento recibe el toque en cada control?
  for (const sel of ["#etiqFecha","[data-etiq-dec]","#etiqCant","[data-etiq-inc]","[data-etiq-confirmar]"]) {
    const r=await page.evaluate(s=>{const el=document.querySelector(s); if(!el) return null; const b=el.getBoundingClientRect(); const x=b.x+b.width/2,y=b.y+b.height/2; const top=document.elementFromPoint(x,y); return {rect:[Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)], dis:el.disabled, ro:el.readOnly, tapa: top===el||el.contains(top)?"nadie":(top?top.tagName+"."+top.className:"nada"), pe:getComputedStyle(el).pointerEvents}},sel);
    console.log(sel, JSON.stringify(r));
  }
  // probar tocar − y +
  const c0=await page.$eval("#etiqCant",e=>+e.value);
  await page.tap("[data-etiq-dec]"); await page.waitForTimeout(200);
  const c1=await page.$eval("#etiqCant",e=>+e.value);
  await page.tap("[data-etiq-inc]"); await page.waitForTimeout(200);
  const c2=await page.$eval("#etiqCant",e=>+e.value);
  console.log("cant:",c0,c1,c2);
  ok(c1===c0-1 && c2===c0,"los botones − y + cambian la cantidad");
  // escribir en cantidad
  await page.tap("#etiqCant"); await page.keyboard.type("7"); await page.keyboard.press("Tab"); await page.waitForTimeout(200);
  console.log("cant tras escribir:", await page.$eval("#etiqCant",e=>e.value));
  // fecha: escribir con teclado
  await page.tap("#etiqFecha"); await page.waitForTimeout(100);
  console.log("fecha antes:", await page.$eval("#etiqFecha",e=>e.value));
  console.log("errores:",JSON.stringify(err)); await b.close();
})();
