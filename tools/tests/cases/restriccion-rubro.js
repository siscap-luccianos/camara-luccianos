// Un local con un rubro apagado (lleva_chocolateria=NO) no debe ver nada de ese rubro: ni pestaña en Historial, ni avisos de «Registrar consumo».
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(1000);
  const nChoco = await page.evaluate(() => S.sabores.filter(s => grupoProductoDe(s) === "chocolateria").length);
  ok(nChoco > 0, "el catálogo de prueba tiene chocolatería (" + nChoco + ")");
  // 1) local que SÍ lleva chocolatería con venta del día
  await page.evaluate(() => { S.ventaDia = true; S.saboresExcluidos = []; });
  ok(await page.evaluate(() => ventaDiaActiva()), "con chocolatería y venta del día: «Registrar consumo» activo");
  await page.click("#tabs [data-t='historial']"); await page.waitForTimeout(500);
  ok(/Chocolatería/.test(await page.innerText(".tabsCat, [role=tablist]")), "Historial muestra la pestaña Chocolatería");
  // 2) el mismo local con la chocolatería apagada (como Marruecos)
  await page.evaluate(() => { S.saboresExcluidos = S.sabores.filter(s => grupoProductoDe(s) === "chocolateria").map(s => s.id); renderApp(); });
  await page.waitForTimeout(400);
  ok(!(await page.evaluate(() => ventaDiaActiva())), "sin chocolatería: la venta del día no se activa");
  const tabs = await page.innerText(".tabsCat, [role=tablist]");
  ok(!/Chocolatería/.test(tabs) && /Vasquetas/.test(tabs), "Historial sin Chocolatería y con Vasquetas: " + tabs.replace(/\s+/g, " "));
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(400);
  await page.click("[data-sal-menu='comun']"); await page.waitForTimeout(400);
  ok(!/La chocolatería no se saca acá|Registrar consumo/.test(await page.innerText("main")), "Salida no menciona la chocolatería");
  await page.click("#ayudaBtn"); await page.waitForTimeout(400);
  ok(!/Registrar consumo/.test(await page.innerText("#ayudaOv")), "la ayuda no ofrece «Registrar consumo»");
  ok(err.length===0, "sin errores de consola" + (err.length ? ": " + err[0] : ""));
  await b.close(); console.log(fallos.length ? "FALLAS " + fallos.length : "FALLAS 0"); process.exit(fallos.length ? 1 : 0);
})();
