const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message));
  const ok=(c,m)=>console.log((c?"OK   ":"FALLA")+" "+m);
  await page.goto("http://localhost:8997/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(2600); // el pedido tarda 1,5 s: ya tiene que estar de fondo
  await page.click("#tabs [data-t='gestion']"); await page.waitForTimeout(120);
  let t=await page.$eval("main",e=>e.textContent);
  ok(/\$ 849\.883/.test(t)&&!/Calculando/.test(t),"abre al instante con los valores (pedidos de fondo antes de entrar)");
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(700); // menos de 1,5 s: tiene que salir del equipo
  await page.click("#tabs [data-t='gestion']"); await page.waitForTimeout(150);
  t=await page.$eval("main",e=>e.textContent);
  ok(/\$ 849\.883/.test(t),"tras recargar muestra lo guardado mientras actualiza de fondo");
  const hay=await page.evaluate(()=>localStorage.getItem("preciosCache")!==null); ok(hay,"precios guardados en el equipo");
  await page.click("#salir"); await page.waitForTimeout(500);
  const sigue=await page.evaluate(()=>localStorage.getItem("preciosCache")!==null); ok(!sigue,"se borran al cerrar sesión");
  console.log("errores:",JSON.stringify(err)); await b.close();
})();
