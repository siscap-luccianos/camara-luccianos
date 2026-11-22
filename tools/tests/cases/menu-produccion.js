// Marruecos (Ingreso = Producción): la tarjeta del menú de Ingreso muestra lo producido hoy, solo de los rubros que fabrica.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  await page.addInitScript(()=>{try{localStorage.setItem("idioma","es")}catch(e){}});
  await page.goto("http://localhost:8990/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Marruecos"); await page.press("#local","Enter"); await page.waitForTimeout(1200);
  await page.evaluate(()=>{ S.produccionRubros=["vasquetas","icepops"]; });
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(500);
  const t = (await page.innerText(".menuHero.resumen")).replace(/\s+/g," ");
  ok(/Producido hoy/.test(t), "Ingreso de Marruecos dice «Producido hoy»: " + t);
  ok(/vasquetas/.test(t) && /icepops/.test(t) && !/chocolatería|gluten|baldes/i.test(t), "solo los rubros que fabrica (vasquetas e icepops)");
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(400);
  ok(/Salió hoy/.test(await page.innerText(".menuHero")), "Salida sigue diciendo «Salió hoy»");
  ok(err.length===0,"sin errores de consola"+(err.length?": "+err[0]:""));
  await b.close(); console.log(fallos.length?"FALLAS "+fallos.length:"FALLAS 0"); process.exit(fallos.length?1:0);
})();
