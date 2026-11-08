const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 700 }, deviceScaleFactor:2 })).newPage();
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(1200);
  await page.evaluate(()=>{ S.stockValorizado=true; S.tab="gestion"; S.produccionLocal=false; renderApp() });
  await page.waitForTimeout(1500);
  const t=await page.$(".gvTbl"); await t.scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollBy(0,-90));
  await page.waitForTimeout(300);
  await page.screenshot({path:"gestion-tabla.png"});
  await b.close();
})();
