const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  for (const [w,h,name] of [[390,700,"celular"],[1100,700,"PC"]]) {
    const page = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    await page.goto("http://localhost:8996/"); await page.waitForSelector("#authLocal");
    await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
    await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
    await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
    await page.waitForSelector("header"); await page.waitForTimeout(400);
    await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);
    await page.click("[data-t='salida']"); await page.waitForTimeout(300);
    await page.evaluate(()=>{ document.body.style.minHeight="3000px"; window.scrollTo(0,300) });
    const antes=await page.evaluate(()=>window.scrollY);
    await page.click("#ayudaBtn"); await page.waitForSelector("#ayudaOv");
    await page.mouse.move(w/2,40); await page.mouse.wheel(0,600); await page.waitForTimeout(300);
    const durante=await page.evaluate(()=>({y:window.scrollY, ov:getComputedStyle(document.body).overflow}));
    console.log(name,"scroll antes:",antes,"| con la ayuda abierta tras girar la rueda sobre el fondo:",durante.y,"| overflow del body:",durante.ov, durante.y===antes?"-> QUIETO":"-> SE MUEVE");
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    const despues=await page.evaluate(()=>getComputedStyle(document.body).overflow);
    console.log("   al cerrar, overflow del body:",despues);
    await page.close();
  }
  await b.close();
})();
