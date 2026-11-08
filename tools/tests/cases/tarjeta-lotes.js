const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor:2 })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(1000);
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  await page.click(".tabCat[data-familia='chocolateria']"); await page.waitForTimeout(300);
  const lineas=await page.$$eval(".card.consulta .loteL",e=>e.map(x=>x.textContent.trim()));
  console.log(JSON.stringify(lineas));
  const el=await page.$(".card.consulta"); await el.scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollBy(0,-120));
  await page.screenshot({path:"tarjeta-lotes.png"});
  const ok=lineas.some(x=>/^10 vencen en 3 días$/.test(x)) && lineas.some(x=>/^20 vencen en 30 días$/.test(x));
  console.log(ok?"OK   la tarjeta dice «10 vencen en 3 días» y «20 vencen en 30 días»":"FALLA");
  console.log("errores:",JSON.stringify(err)); await b.close();
})();
