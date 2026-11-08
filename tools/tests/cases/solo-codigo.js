const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8995/"); await page.waitForSelector("#authLocal");
  await page.evaluate(()=>{ S.auth.local="Local prueba"; S.auth.paso="codigo"; S.auth.codigo=""; renderApp(); });
  await page.waitForTimeout(300);
  let txt=await page.$eval(".authCard",e=>e.textContent.replace(/\s+/g," "));
  console.log("codigo:",txt.slice(0,260));
  console.log("sin 'Pedir que me aprueben':", !/Pedir que me aprueben/.test(txt), "| sin '¿No tenés el código?':", !/No tenés el código/.test(txt));
  console.log("teclado:", await page.$$eval("[data-tecla]",e=>e.length), "| volver visible:", await page.$$eval(".authBack",e=>e.length&&getComputedStyle(e[0]).display!=="none"));
  await page.screenshot({path:"solo-codigo.png"});
  // estado pendiente -> vuelve al código con mensaje
  await page.evaluate(()=>{ S.auth.paso="quien"; S.auth.error=""; renderApp(); });
  console.log("errores:",err.length?err:"ninguno");
  await b.close();
})();
