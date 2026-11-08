const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  await page.goto("http://localhost:8997/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(800);
  await page.click("#tabs [data-t='gestion']"); await page.waitForTimeout(600);
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(1200);
  await page.click("#tabs [data-t='gestion']"); await page.waitForTimeout(700);
  const k=await page.$eval(".gvKpis",e=>getComputedStyle(e).gridTemplateColumns);
  const t=await page.$eval("main",e=>e.textContent.replace(/\s+/g," "));
  console.log(/\$ 849\.883/.test(t)?"OK   valor tras recargar":"FALLA valor tras recargar", "| kpis cols:",k, "| errores:",JSON.stringify(err));
  await page.screenshot({path:"gestion-pc.png"});
  await b.close();
})();
