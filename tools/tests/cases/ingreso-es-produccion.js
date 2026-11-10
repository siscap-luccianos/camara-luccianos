// Local que solo fabrica (Locales.ingreso_solo_produccion=SI, ej. Marruecos): Ingreso ES la pantalla de Producción.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const fallos=[], err=[], posts=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message));
  page.on("request",r=>{ if(r.method()==="POST"){ try{ posts.push(JSON.parse(r.postData())) }catch(e){} } });
  await page.goto("http://localhost:8990/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);

  // ---- Marruecos: Ingreso = Producción
  await page.fill("#local","Marruecos"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(400);
  const txt=await page.innerText("#main");
  ok(/ingreso de producción/i.test(txt), "el título dice «Ingreso de producción»");
  ok(await page.$("#irProduccion")===null, "no hay botón Producción");
  ok(await page.$("#volverIngreso")===null, "no hay «Volver a Ingreso»");
  ok(await page.$("#remito")===null && await page.$("#btnLeerRemitoFoto")===null, "no hay N° de remito ni lector de fotos");
  ok(await page.$("[data-kilos]")!==null && await page.$("[data-prodinc]")!==null, "vasquetas: kilos + vasquetas resultantes");
  ok(await page.$("#irCambioSabor")!==null && /Una vasqueta quedó mal rotulada\? Corregir sabor/.test(await page.innerText("#irCambioSabor")), "el botón dice «¿Una vasqueta quedó mal rotulada? Corregir sabor»");
  await page.click(".tabCat[data-familia='icepops']"); await page.waitForTimeout(300);
  ok(await page.$("[data-kilos]")===null && await page.$$eval("[data-uni]",e=>e.length)>=3, "icepops: unidades con el pad, sin kilos");
  await page.click(".tabCat[data-familia='vasquetas']"); await page.waitForTimeout(300);
  await page.click("[data-prodinc='5']"); await page.click("[data-prodinc='5']");
  await page.fill("[data-kilos='5']","7,2");
  await page.screenshot({path:"ingreso-es-produccion.png"});
  // confirmar: sale como Producción (subtipo produccion) con sus kilos
  await page.click("#bar #go, #bar button >> nth=-1").catch(()=>{}); await page.waitForTimeout(500);
  if(await page.$("#ok")){ await page.click("#ok"); await page.waitForTimeout(900) }
  const reg=posts.filter(p=>p.accion==="registrar").pop();
  ok(reg && reg.tipo==="ingreso" && reg.subtipo==="produccion", "se guarda como ingreso con subtipo produccion: "+JSON.stringify(reg&&{t:reg.tipo,s:reg.subtipo}));
  ok(reg && reg.items && reg.items["5"]===2 && reg.kilos && String(reg.kilos["5"]).replace(",",".")==="7.2", "manda 2 vasquetas y 7,2 kg: "+JSON.stringify(reg&&{i:reg.items,k:reg.kilos}));
  // Devolución sigue disponible solo si hay algo pendiente; el Cambio de sabor abre y vuelve a la misma pantalla
  await page.click("#irCambioSabor"); await page.waitForTimeout(300);
  const cs=await page.innerText("#main");
  ok(/Figura como/i.test(cs) && /corregir sabor/i.test(cs), "la pantalla se llama «Corregir sabor»");
  ok(/una vasqueta quedó cargada o rotulada/i.test(cs) && !/venía rotulada/i.test(cs), "el texto habla de producción propia, no de cajas que llegan");
  await page.selectOption("#cmbDesde","5"); await page.waitForTimeout(200);
  await page.selectOption("#cmbHacia","4"); await page.waitForTimeout(200);
  const cs2=await page.innerText("#main");
  ok(/vasqueta mal rotulada/i.test(cs2) && /error al cargar la producción/i.test(cs2) && !/error de fábrica/i.test(cs2), "motivos de producción propia");
  ok(await page.$("#cmbKilos")!==null && /opcional/i.test(await page.innerText("#main")), "aparece el campo de kilos, opcional");
  await page.click("[data-cmb-motivo='Vasqueta mal rotulada']"); await page.waitForTimeout(150);
  ok(await page.$eval("#cmbOk",e=>!e.disabled), "se puede registrar sin kilos");
  await page.fill("#cmbKilos","3,6"); await page.waitForTimeout(150);
  ok(/Registrar corrección/.test(await page.innerText("#cmbOk")), "el botón dice «Registrar corrección»");
  await page.click("#cmbOk"); await page.waitForTimeout(600);
  const cam=posts.filter(p=>p.accion==="cambioSabor").pop();
  ok(cam && cam.desde==="5" && cam.hacia==="4" && Number(cam.kilos)===3.6, "manda el cambio con los kilos escritos: "+JSON.stringify(cam&&{k:cam.kilos,m:cam.motivo}));
  await page.click("#irCambioSabor"); await page.waitForTimeout(300);
  await page.selectOption("#cmbDesde","5"); await page.waitForTimeout(150); await page.selectOption("#cmbHacia","4"); await page.waitForTimeout(150);
  await page.click("[data-cmb-motivo='Vasqueta mal rotulada']"); await page.waitForTimeout(100); await page.click("#cmbOk"); await page.waitForTimeout(500);
  const cam2=posts.filter(p=>p.accion==="cambioSabor").pop();
  ok(cam2 && (cam2.kilos===undefined||cam2.kilos===null), "sin kilos escritos, no manda kilos");
  await page.click("#irCambioSabor"); await page.waitForTimeout(300);
  await page.selectOption("#cmbDesde","162"); await page.waitForTimeout(150); await page.selectOption("#cmbHacia","49"); await page.waitForTimeout(150);
  ok(await page.$("#cmbKilos")===null, "con Icepops no pide kilos");
  await page.click("#cmbCancelar"); await page.waitForTimeout(300);
  ok(/ingreso de producción/i.test(await page.innerText("#main")), "al volver queda en «Ingreso de producción»");

  // ---- Servidor: un ingreso común de helado se rechaza en ese local
  const r1=await page.evaluate(async()=>{ const x=await fetch("/exec",{method:"POST",body:JSON.stringify({accion:"registrar",tipo:"ingreso",local:"Marruecos",items:{"5":3}})}); return x.json() });
  ok(r1.ok===false && /ingreso de producción/i.test(r1.error||""), "el servidor rechaza un ingreso común de helado: "+(r1.error||""));

  // ---- Unicenter (recibe y fabrica): queda como hoy
  await page.fill("#local","Unicenter"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(400);
  ok(await page.$("#irProduccion")!==null && await page.$("#remito")!==null, "Unicenter conserva el botón Producción y el remito");
  await page.click("#irProduccion"); await page.waitForTimeout(300);
  ok(await page.$("#volverIngreso")!==null && !/ingreso de producción/i.test(await page.innerText("#main")), "Unicenter: Producción sigue siendo una pantalla aparte con «Volver a Ingreso»");

  // recarga con Marruecos: sigue siendo Ingreso de producción (viene del cache)
  await page.fill("#local","Marruecos"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300);
  await page.reload(); await page.waitForSelector("#main"); await page.waitForTimeout(1200);
  await page.click("#tabs [data-t='ingreso']").catch(()=>{}); await page.waitForTimeout(400);
  ok(/ingreso de producción/i.test(await page.innerText("#main")), "después de recargar sigue siendo «Ingreso de producción»");

  console.log("errores:", err.length?err:"ninguno"); if(err.length) fallos.push("errores de consola");
  console.log(fallos.length?"RESULTADO: "+fallos.length+" fallo(s)":"RESULTADO: todo OK");
  await b.close(); process.exit(fallos.length?1:0);
})().catch(e=>{console.error("ERROR",e.message);process.exit(1)});
