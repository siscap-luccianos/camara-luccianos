const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 860 } })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8995/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  const r=await page.evaluate(()=>{ S.ventaDia=true; const a=ayudaTemas().map(t=>t.id); S.ventaDia=false; S.chocoSoloDeposito=true; const b=ayudaTemas().map(t=>t.id); S.chocoSoloDeposito=false; S.empleado.rol="colaborador"; const c=ayudaTemas().map(t=>t.id); S.empleado.rol="admin"; return {conVentaDia:a, soloDeposito:b, colaborador:c}; });
  console.log(JSON.stringify(r));
  await page.evaluate(()=>{ S.ventaDia=true; });
  await page.click("#ayudaBtn"); await page.waitForSelector("#ayudaOv");
  await page.click("[data-ay-tema='choco']"); await page.waitForTimeout(200);
  await page.screenshot({path:"ayuda4.png"});
  console.log("errores:",err.length?err:"ninguno"); await b.close();
})();
