const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message)); const ok=(c,m)=>console.log((c?"OK   ":"FALLA")+" "+m);
  const dlg=[]; page.on("dialog",async d=>{dlg.push(d.message().split("\n")[0]); await d.accept()});
  await page.goto("http://localhost:8991/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(500);
  await page.click("#tabs [data-t='sabores']"); await page.waitForTimeout(800);
  ok((await page.$$("[data-eliminar-sabor]")).length>0,"cada sabor tiene Editar / Desactivar / Eliminar");
  const antes=(await page.$$("[data-eliminar-sabor]")).length;
  await page.click("[data-eliminar-sabor='73']"); await page.waitForTimeout(600);
  const desp=(await page.$$("[data-eliminar-sabor]")).length;
  ok(desp===antes-1,"Eliminar saca el sabor de la lista"); console.log("confirmación:",dlg[0]);
  await page.click("[data-eliminar-sabor='162']"); await page.waitForTimeout(600);
  console.log("errores:",err); await b.close();
})().catch(e=>{console.error("ERROR",e.message);process.exit(1)});
