const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  await page.goto("http://localhost:8992/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Obelisco CABA"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  // INGRESO sin remito
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300);
  const tabs=await page.$$eval(".tabCat[data-familia]",e=>e.map(x=>x.dataset.familia));
  ok(tabs.includes("pasteleria")&&tabs.includes("bolleria"), "pestañas en Ingreso: "+tabs.join(","));
  await page.click(".tabCat[data-familia='pasteleria']"); await page.waitForTimeout(250);
  const subs=await page.$$eval(".subCat",e=>e.map(x=>x.textContent.trim()));
  console.log("subcategorías:", subs.join(" | "));
  ok(subs.includes("Tortas")&&subs.includes("Pastelería Fresca"), "subcategorías Tortas y Pastelería Fresca");
  for(let i=0;i<12;i++) await page.click("[data-iinc='172']").catch(()=>{});
  await page.click("[data-iinc='184']").catch(()=>{});
  await page.click(".tabCat[data-familia='bolleria']"); await page.waitForTimeout(250);
  await page.click("[data-iinc='188']").catch(()=>{}); await page.click("[data-iinc='188']").catch(()=>{});
  for(let i=0;i<24;i++) await page.click("[data-iinc='189']").catch(()=>{});
  await page.fill("#remito","Elaboración propia");
  ok(await page.$(".vencCampo")===null, "sin vencimiento");
  await page.screenshot({path:"past-ingreso2.png"});
  const btn=await page.$("#confirmar, #confirmBtn, .bar .btn:not(.ghost)");
  console.log("botón confirmar:", btn?await btn.innerText():"no");
  await btn.click(); await page.waitForTimeout(500); await page.fill("#remito","Elaboración propia").catch(()=>{}); await page.click("text=Confirmar ingreso"); await page.waitForTimeout(900); await page.screenshot({path:"past-after-confirm.png"}); console.log((await page.innerText("body")).slice(0,300).replace(/\n/g," | "));
  // SALIDA con pad
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(400);
  const t2=await page.$$eval(".tabCat[data-familia]",e=>e.map(x=>x.dataset.familia));
  ok(t2.includes("pasteleria")&&t2.includes("bolleria"), "pestañas en Salida: "+t2.join(","));
  await page.click(".tabCat[data-familia='pasteleria']"); await page.waitForTimeout(250);
  await page.click("[data-add='172']"); await page.waitForSelector("#cantOv");
  ok(true, "Red Velvet abre el pad de cantidad");
  await page.click("[data-cant-tecla='5']"); 
  ok((await page.inputValue("#cantNum"))==="5", "pad: 5");
  await page.screenshot({path:"past-pad.png"});
  await page.click("[data-cant-listo]"); await page.waitForTimeout(300);
  await page.screenshot({path:"past-salida.png"});
  const conf=await page.$(".bar .btn:not(.ghost)"); console.log("salida btn:", await conf.innerText()); await conf.click(); await page.waitForTimeout(500); const c2=await page.$("text=/Confirmar salida/"); if(c2){await c2.click(); await page.waitForTimeout(900)}
  // HISTORIAL
  await page.click("#tabs [data-t='historial']"); await page.waitForTimeout(400);
  const pills=await page.$$eval("[data-categoria-hist]",e=>e.map(x=>x.dataset.categoriaHist));
  ok(pills.includes("pasteleria")&&pills.includes("bolleria"), "pills de Historial: "+pills.join(","));
  await page.click("[data-categoria-hist='pasteleria']"); await page.waitForTimeout(300);
  const h=await page.innerText("#main");
  ok(/Red Velvet/.test(h), "Historial Pastelería muestra Red Velvet");
  await page.screenshot({path:"past-hist.png"});
  // STOCK / PEDIDO
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);
  const t3=await page.$$eval(".tabCat[data-familia]",e=>e.map(x=>x.dataset.familia));
  ok(t3.includes("pasteleria")&&t3.includes("bolleria"), "pestañas en Stock: "+t3.join(","));
  await page.screenshot({path:"past-stock.png"});
  console.log("ERRORES CONSOLA:", err.length?err.join(" || "):"ninguno");
  await b.close(); process.exit(fallos.length?1:0);
})();
