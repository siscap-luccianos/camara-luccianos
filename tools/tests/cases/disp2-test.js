const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 820, height: 600 } })).newPage();
  await page.goto("http://localhost:8995/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  const html=await page.evaluate(()=>{ S.controlEquipos=true; S.equipos={max:3,usados:1,pendientes:[{clave:"x",nombre:"Tablet"}],aprobados:[],autorizados:[]}; try{ return equiposView() }catch(e){ return "ERR "+e.message } });
  const txt=html.replace(/<[^>]+>/g," ").replace(/\s+/g," ");
  console.log(txt.slice(0,420));
  console.log("equipos sueltos:",(txt.match(/\bequipos?\b/gi)||[]).length,"| dispositivos:",(txt.match(/dispositivos?/gi)||[]).length);
  await b.close();
})();
