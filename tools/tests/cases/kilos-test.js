const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  await page.goto("http://localhost:8994/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);

  // ---- INGRESO por remito con kilos
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300); await page.click("[data-ing-menu='merc']"); await page.waitForTimeout(200);
  await page.setInputFiles("#inputRemitoFoto",require("path").join(__dirname,"..","..","..","fotos/5.jpg")); 
  await page.waitForSelector("[data-remito-kg]",{timeout:8000});
  const kgs=await page.$$eval("[data-remito-kg]",e=>e.map(x=>x.value));
  ok(kgs.join("|")==="14,57|60|", "kilos leídos por renglón: "+kgs.join("|"));
  const avisos=await page.$$eval(".kgAv",e=>e.map(x=>x.textContent));
  ok(avisos.some(t=>/10,00 kg por vasqueta/.test(t)), "avisa kilos raros (60 kg / 6 vasq.): "+avisos.join(" / "));
  ok(avisos.some(t=>/No se leyeron los kilos/.test(t)), "avisa que no se leyeron los kilos del Cheesecake");
  const resumen=await page.$eval(".remitoResumen",e=>e.textContent);
  ok(/kg de vasquetas/.test(resumen), "resumen con kilos: "+resumen.slice(0,120));
  await page.fill("[data-remito-kg='1']","22,5");
  await page.click("#remitoCargar"); await page.waitForTimeout(400);
  // carrito: Banana Split trae 14,57; Frutilla 22,5; Cheesecake sin kilos
  const kcart=await page.$$eval("[data-kilos]",e=>e.map(x=>x.dataset.kilos+"="+x.value));
  console.log("kilos en carrito:",kcart.join(" "));
  ok(kcart.includes("4=14,57")&&kcart.includes("20=22,5")&&kcart.includes("5="), "carrito con kilos del remito (Cheesecake vacío)");
  let go=await page.$("#go"); ok(go && await go.isDisabled(), "Registrar bloqueado hasta cargar los kilos del Cheesecake");
  const aviso=await page.$eval("#barIn",e=>e.textContent); ok(/Faltan los kilos totales de: Cheesecake/.test(aviso),"aviso en la barra: "+aviso.slice(0,100));
  await page.fill("[data-kilos='5']","6,2");
  go=await page.$("#go"); ok(go && !(await go.isDisabled()), "con los kilos cargados se puede registrar");
  await page.click("#go"); await page.click("#ok"); await page.waitForTimeout(800);

  // ---- STOCK: sin conteo => kilos = 0 base + ingreso
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(500);
  const kpi=await page.$eval(".kpis",e=>e.textContent);
  ok(/Kilos de helado en cámara/.test(kpi)&&/43,27 kg/.test(kpi), "KPI kilos en cámara 14,57+22,5+6,2=43,27: "+kpi.replace(/\s+/g," ").slice(0,160));
  const filas=await page.$$eval(".rows .row",e=>e.map(x=>x.textContent.replace(/\s+/g," ")));
  ok(filas.some(t=>/Banana Split/.test(t)&&/14,57 kg/.test(t)), "fila Banana Split con 14,57 kg");
  ok(!/promedio/.test(kpi+filas.join(" ")), "sin textos de peso promedio");

  // ---- SALIDA: cada vasqueta se pesa
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300); await page.click("[data-sal-menu='comun']").catch(()=>{}); await page.waitForTimeout(200);
  await page.click("[data-add='4']"); await page.waitForSelector("#kilosOv"); await page.waitForTimeout(200);
  const sub=await page.$eval("#kilosOv .mantSub",e=>e.textContent); ok(!/promedio/.test(sub),"el pad no muestra peso promedio: "+sub);
  for(const k of ["3",",","6","0"]) await page.click(`[data-kg-tecla='${k}']`);
  await page.click("[data-kg-listo]"); await page.waitForTimeout(300);
  await page.click("#go"); await page.click("#ok"); await page.waitForTimeout(800);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(500);
  const kpi2=await page.$eval(".kpis",e=>e.textContent.replace(/\s+/g," "));
  ok(/39,67 kg/.test(kpi2), "después de sacar 3,60 kg quedan 39,67: "+kpi2.slice(0,150));

  // (21/11/2026) El tramo «Conteo con kilos» se sacó de acá: el Conteo cámara pasó a ser por rubro y ya no reemplaza el stock operativo,
  // así que ese flujo lo cubren conteo-camara-*.js, conteo-parcial.js y gs-conteoparcial-test.js.

  // ---- Local sin kilos reales no cambia
  await page.fill("#local","Obelisco CABA"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300); await page.click("[data-ing-menu='merc']"); await page.waitForTimeout(200);
  await page.click("[data-iinc='4']"); await page.waitForTimeout(200);
  ok(await page.$("[data-kilos]")===null, "otro local: sin campo de kilos en Ingreso");

  console.log("errores de consola:", err.length?err:"ninguno");
  console.log(fallos.length?("FALLAS: "+fallos.length):"TODO OK");
  await b.close();
})();
