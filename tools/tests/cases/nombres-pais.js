const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message)); const ok=(c,m)=>console.log((c?"OK   ":"FALLA")+" "+m);
  await page.goto("http://localhost:8991/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(500);
  await page.click("#tabs [data-t='sabores']"); await page.waitForTimeout(800);
  let t=await page.innerText("#main"); ok(t.includes("Frutilla")&&!t.includes("Fraise"),"sin país elegido: nombre general");
  await page.click("[data-pais-filtro='Marruecos']"); await page.waitForTimeout(400);
  t=await page.innerText("#main"); ok(t.includes("Fraise")&&t.includes("Acá se llama «Frutilla»")&&t.includes("Classiques"),"con Marruecos: nombre y categoría de Marruecos");
  ok(t.includes("Se vende en Marruecos"),"con Marruecos: «Se vende en Marruecos» en vez de «Todos los países»");
  console.log("errores:",err); await b.close();
})().catch(e=>{console.error("ERROR",e.message);process.exit(1)});
