const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 860 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8995/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  ok(await page.$("#ayudaBtn")!==null,"el ? está en la cabecera (vista Operaciones)");
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  for(const t of ["salida","ingreso","stock","historial"]){
    await page.click(`#tabs [data-t='${t}']`); await page.waitForTimeout(250);
    ok(await page.$("#ayudaBtn")!==null,"el ? sigue en "+t);
  }
  await page.click("#ayudaBtn"); await page.waitForSelector("#ayudaOv");
  const txt=await page.$eval("#ayudaOv",e=>e.textContent);
  ok(/Anulá el movimiento/.test(txt)&&/Desperdicio/.test(txt)&&/Devolución/.test(txt),"la hoja tiene las 3 tarjetas");
  ok(/24 horas/.test(txt),"para admin dice 24 horas");
  await page.screenshot({path:"ayuda1.png"});
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  ok(await page.$("#ayudaOv")===null,"Escape cierra");
  await page.click("#ayudaBtn"); await page.waitForSelector("#ayudaOv");
  await page.click("#ayudaOv [data-ay-cerrar].btn:not(.ghost)"); await page.waitForTimeout(200);
  ok(await page.$("#ayudaOv")===null,"«Entendido» cierra");
  await page.click("#ayudaBtn"); await page.waitForSelector("#ayudaOv"); await page.mouse.click(5,5); await page.waitForTimeout(200);
  ok(await page.$("#ayudaOv")===null,"tocar afuera cierra");
  await page.screenshot({path:"ayuda2.png"});
  console.log("errores:",err.length?err:"ninguno"); console.log(fallos.length?"FALLAS":"TODO OK"); await b.close();
})();
