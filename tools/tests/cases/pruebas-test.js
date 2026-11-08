const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const ctx=await b.newContext({ viewport: { width: 390, height: 844 } });
  const page=await ctx.newPage(); const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  const fotos404=[]; page.on("response",r=>{if(/fotos\//.test(r.url())&&r.status()>=400) fotos404.push(r.url())});
  // 1) abre PRODUCCIÓN-simulada (raíz) y deja algo en localStorage
  await page.goto("http://localhost:8993/"); await page.waitForSelector("#authLocal");
  await page.evaluate(()=>localStorage.setItem("clave_prod","X"));
  // 2) abre PRUEBAS
  await page.goto("http://localhost:8993/pruebas/"); await page.waitForSelector("#authLocal");
  ok((await page.title())==="LogiStock PRUEBAS","título");
  ok(!!(await page.$("#bannerPruebas")) && !!(await page.$("#cintaPruebas")),"franja y cinta de PRUEBAS");
  ok(await page.evaluate(()=>localStorage.getItem("clave_prod"))===null,"localStorage de pruebas NO ve lo de producción");
  await page.evaluate(()=>localStorage.setItem("solo_pruebas","Y"));
  const crudo=await page.evaluate(()=>Object.keys(Object.getPrototypeOf(localStorage)===Storage.prototype?{}:{}).length);
  await page.goto("http://localhost:8993/"); await page.waitForSelector("#authLocal");
  ok(await page.evaluate(()=>localStorage.getItem("solo_pruebas"))===null,"producción NO ve lo de pruebas");
  ok(await page.evaluate(()=>localStorage.getItem("pruebas:solo_pruebas"))==="Y","la clave real lleva el prefijo pruebas:");
  // 3) login completo en pruebas
  await page.goto("http://localhost:8993/pruebas/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.fill("#local","Obelisco CABA"); await page.press("#local","Enter"); await page.waitForTimeout(1200);
  ok(!!(await page.$("[data-add]")) , "carga la grilla de Salida en pruebas");
  const imgOk=await page.$$eval(".plate img",els=>els.filter(i=>i.complete&&i.naturalWidth>0).length);
  ok(imgOk>0,"las fotos (../fotos) cargan: "+imgOk);
  await page.screenshot({path:"../pruebas-salida.png"});
  // recarga con sesión
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(800);
  ok(!!(await page.$("header")),"recarga con sesión abierta");
  // service worker y manifest
  await page.waitForTimeout(1500);
  const sw=await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistrations();return r.map(x=>x.scope)});
  ok(sw.some(s=>s.endsWith("/pruebas/")),"SW registrado con alcance /pruebas/: "+sw.join(","));
  const cn=await page.evaluate(()=>caches.keys());
  ok(cn.some(k=>k.startsWith("logistock-pruebas-shell")),"caché propia: "+cn.join(","));
  const man=await page.evaluate(()=>fetch(document.querySelector('link[rel=manifest]').href).then(r=>r.json()));
  ok(man.name==="LogiStock PRUEBAS"&&man.scope==="./","manifest propio: "+man.name);
  ok(fotos404.length===0,"sin 404 de fotos: "+fotos404.length);
  console.log("ERRORES CONSOLA:", err.length?err.join(" || "):"ninguno");
  await b.close(); process.exit(fallos.length?1:0);
})();
