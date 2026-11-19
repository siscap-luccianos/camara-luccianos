const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8995/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  const nav0=await page.innerText("#tabs");
  ok(/Salida/i.test(nav0)&&!/Sortie/i.test(nav0),"en español al entrar: "+nav0.replace(/\s+/g," "));
  ok((await page.innerText("#idiomaBtn")).trim()==="FR","el botón ofrece FR");
  await page.click("#idiomaBtn"); await page.waitForTimeout(500);
  const nav1=await page.innerText("#tabs");
  ok(/Sortie/i.test(nav1)&&/Entrée/i.test(nav1),"pestañas en francés: "+nav1.replace(/\s+/g," "));
  ok((await page.innerText("#idiomaBtn")).trim()==="ES","el botón ahora ofrece ES");
  ok(await page.evaluate(()=>document.documentElement.lang)==="fr","html lang=fr");
  // pantalla de Salida
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(500);
  const t1=await page.innerText("#main");
  ok(!/Registrar consumo|Escanear vasqueta|Desperdicio\b/.test(t1)||/Pertes|Scanner|Enregistrer/.test(t1),"Salida sin textos clave en español");
  // aviso (toast) y confirm traducidos
  const tt=await page.evaluate(()=>tr("No hay stock de ese sabor."));
  ok(tt==="Pas de stock de ce parfum.","toast traducido: "+tt);
  const t3=await page.evaluate(()=>tr("3 vasquetas"));
  ok(/3 gelatos/.test(t3),"número con unidad: "+t3);
  // volver a español
  await page.click("#idiomaBtn"); await page.waitForTimeout(500);
  ok(/Salida/i.test(await page.innerText("#tabs")),"vuelve a español");
  // idioma por país del local
  await page.evaluate(()=>{ localStorage.removeItem("idioma"); S.locales.forEach(l=>{ if(l.nombre==="Local prueba") l.pais="Marruecos" }); S.paisLocal="Marruecos"; renderApp() }); await page.waitForTimeout(500);
  ok(/Sortie/i.test(await page.innerText("#tabs")),"local de Marruecos → francés automático");
  console.log("errores:",err.length?err:"ninguno"); console.log(fallos.length?"FALLAS":"TODO OK"); await b.close(); process.exit(fallos.length||err.length?1:0);
})();
