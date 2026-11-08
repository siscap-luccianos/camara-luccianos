const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({viewport:{width:1000,height:900}})).newPage(); const err=[]; page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8997/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  const orig=await page.title();
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(700);
  await page.click("#tabs [data-t='gestion']"); await page.waitForFunction(()=>/Valor de referencia/.test(document.querySelector("main").textContent),{timeout:6000});
  const r=await page.evaluate(()=>{ window.dispatchEvent(new Event("beforeprint")); const durante=document.title; window.dispatchEvent(new Event("afterprint")); return {durante, despues:document.title} });
  console.log(JSON.stringify(r),"original:",orig);
  const hoy=new Date().toLocaleDateString("es-AR",{timeZone:"America/Argentina/Buenos_Aires",day:"numeric",month:"numeric",year:"2-digit"}).replace(/\//g,"-");
  console.log(r.durante==="LogiStock_Local prueba_"+hoy&&r.despues===orig?"OK   nombre de archivo y título restaurado":"FALLA", "errores:",JSON.stringify(err)); await b.close(); })();
