const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const ctx=await b.newContext({ viewport: { width: 1100, height: 900 } });
  const page=await ctx.newPage(); const err=[];
  page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  await page.addInitScript(()=>{ try{ localStorage.setItem("relevarProductos",JSON.stringify(["5","20","162","117","172","188"])); localStorage.setItem("relevarLocales",JSON.stringify(["Obelisco CABA","Unicenter","Recoleta CABA","Devoto CABA"])); }catch(e){} });
  await page.goto("http://localhost:8993/pruebas/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(500);
  // RELEVAR
  await page.click("#tabs [data-t='relevar']"); await page.waitForTimeout(1200);
  await page.emulateMedia({media:"print"});
  await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
  await page.pdf({path:"informe-relevar-pruebas.pdf",format:"A4",printBackground:false,preferCSSPageSize:true});
  await page.emulateMedia({media:"screen"});
  // HISTORIAL (local con movimientos)
  await page.fill("#local","Obelisco CABA"); await page.press("#local","Enter"); await page.waitForTimeout(1000);
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300);
  for(let i=0;i<10;i++) await page.click("[data-iinc='20']").catch(()=>{});
  await page.fill("#remito","Prueba"); await page.click(".bar .btn:not(.ghost)"); await page.waitForTimeout(400); await page.click("text=Confirmar ingreso"); await page.waitForTimeout(800);
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  for(let i=0;i<4;i++) await page.click("[data-add='20']").catch(()=>{});
  await page.click(".bar .btn:not(.ghost)"); await page.waitForTimeout(400); const c2=await page.$("text=/Confirmar salida/"); if(c2){await c2.click(); await page.waitForTimeout(800)}
  await page.click("#tabs [data-t='historial']"); await page.waitForTimeout(600);
  await page.emulateMedia({media:"print"});
  await page.pdf({path:"informe-historial-pruebas.pdf",format:"A4",printBackground:false,preferCSSPageSize:true});
  console.log("errores:", err.length?err.join(" || "):"ninguno");
  await b.close();
})();
