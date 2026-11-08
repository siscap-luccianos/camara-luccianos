const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1000, height: 900 } })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8997/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(800);
  await page.click("#tabs [data-t='gestion']"); await page.waitForTimeout(600);
  await page.pdf({path:"gestion.pdf",format:"A4",printBackground:true,preferCSSPageSize:true});
  console.log("errores:",JSON.stringify(err)); await b.close();
})();
