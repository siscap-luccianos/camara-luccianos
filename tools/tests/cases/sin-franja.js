const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(1000);
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  console.log("Salida sin franja:", (await page.$$(".vrChip")).length===0, "| botón:", await page.$eval("[data-ver-venc]",e=>e.textContent.trim()));
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(300);
  console.log("Stock sin franja:", (await page.$$(".vrChip")).length===0, "| botón Ver vencimientos:", !!(await page.$("[data-ver-venc]")));
  console.log("errores:",JSON.stringify(err)); await b.close();
})();
