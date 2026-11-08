const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor:1 })).newPage();
  await page.goto("http://localhost:8997/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(800);
  await page.click("#tabs [data-t='gestion']"); await page.waitForTimeout(500);
  await page.click("[data-gval='vasquetas']"); await page.waitForTimeout(200);
  await page.evaluate(()=>window.scrollTo(0,420));
  await page.screenshot({path:"gestion-c.png"});
  await b.close();
})();
