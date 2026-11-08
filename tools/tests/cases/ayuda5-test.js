const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  for(const tema of ["crema","dorado"]){
    const page = await (await b.newContext({ viewport: { width: 390, height: 300 } })).newPage();
    await page.addInitScript(t=>{ try{ localStorage.setItem("pruebas:tema",t); localStorage.setItem("tema",t) }catch(e){} }, tema);
    await page.goto("http://localhost:8995/"); await page.waitForSelector("#authLocal");
    await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
    await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
    await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
    await page.waitForSelector("header"); await page.waitForTimeout(500);
    await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(700);
    console.log(tema, await page.evaluate(()=>document.documentElement.dataset.tema||"crema"), await page.$eval("#ayudaBtn",e=>getComputedStyle(e).backgroundColor));
    await page.screenshot({path:"ayuda-"+tema+".png",clip:{x:0,y:0,width:390,height:220}});
    await page.close();
  }
  await b.close();
})();
