const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  const entrar=async()=>{
    await page.goto("http://localhost:8991/"); await page.waitForSelector("#authLocal");
    await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
    await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
    await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
    await page.waitForSelector("header"); await page.waitForTimeout(400);
    await page.fill("#local","Marruecos"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  };
  await entrar();
  await page.click("#tabs [data-t='sabores']"); await page.waitForTimeout(400);
  ok(await page.$("[data-sub-sab-local='produce']")!==null, "hay selector Lo tenemos / Lo producimos");
  await page.click("[data-sub-sab-local='produce']"); await page.waitForTimeout(300);
  let n=await page.$$eval("[data-toggle-sabor-prod][aria-pressed='true']",e=>e.length);
  ok(n===6, "sin lista elegida, todos aparecen como «Lo producimos» ("+n+")");
  for(const id of ["4","49","73","117"]){ await page.click(`[data-toggle-sabor-prod='${id}']`); await page.waitForTimeout(250) }
  n=await page.$$eval("[data-toggle-sabor-prod][aria-pressed='true']",e=>e.length);
  ok(n===2, "quedan 2 que se producen (5 y 162): "+n);
  await page.screenshot({path:"prod-sab-1.png"});
  // Producción solo muestra los 2
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300);
  await page.click("#irProduccion"); await page.waitForTimeout(400);
  let txt=await page.innerText("#main");
  ok(/Cheesecake/.test(txt) && !/Banana Split/.test(txt), "Producción: vasquetas solo Cheesecake (sin Banana Split)");
  await page.click(".tabCat[data-familia='icepops']"); await page.waitForTimeout(300);
  ok(await page.$("[data-uni='162']")!==null && await page.$("[data-uni='49']")===null, "Producción: icepops solo Mango");
  // apagar «Lo tenemos» de Cheesecake (5)
  await page.click("#tabs [data-t='sabores']"); await page.waitForTimeout(300);
  await page.click("[data-sub-sab-local='tenemos']"); await page.waitForTimeout(200);
  await page.click("[data-toggle-sabor-local='5']"); await page.waitForTimeout(300);
  ok((await page.innerText("#main")).includes("lo producimos"), "marca «lo producimos» en el sabor apagado");
  // Ingreso normal: sin Cheesecake
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300);
  txt=await page.innerText("#main");
  ok(!/Cheesecake/.test(txt), "Ingreso con remito: Cheesecake no aparece");
  // Producción: sigue
  await page.click("#irProduccion"); await page.waitForTimeout(300);
  await page.click(".tabCat[data-familia='vasquetas']"); await page.waitForTimeout(300);
  ok(/Cheesecake/.test(await page.innerText("#main")), "Producción: Cheesecake sigue");
  // Salida: Cheesecake visible
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  await page.click(".tabCat[data-familia='vasquetas']").catch(()=>{}); await page.waitForTimeout(300);
  ok(/Cheesecake/.test(await page.innerText("#main")), "Salida: Cheesecake visible por producirse");
  // Pedido
  await page.evaluate(async()=>{await fetch("/exec",{method:"POST",body:JSON.stringify({accion:"registrar",tipo:"salida",local:"Marruecos",items:{"5":8}})})});
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(200);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(300);
  await page.evaluate(()=>cargarDatos&&cargarDatos()); await page.waitForTimeout(600);
  await page.click("#verPedidoBtn"); await page.waitForTimeout(300);
  txt=await page.innerText("#main");
  ok(/a producir/i.test(txt) && /Copiar lista para producción/.test(txt), "Pedido: bloque A producir");
  const pedirTxt=await page.$$eval(".pedTabla",e=>e.map(x=>x.innerText));
  ok(pedirTxt.length===2 && /Cheesecake/.test(pedirTxt[1]) && !/Cheesecake/.test(pedirTxt[0]), "Cheesecake solo en A producir, no en A pedir");
  await page.screenshot({path:"prod-sab-2.png",fullPage:true});
  await page.click("#volverPedido"); await page.waitForTimeout(200);
  await page.click("#verPedidoBtn"); await page.click("#verResumenBtn"); await page.waitForTimeout(300);
  txt=await page.innerText("#main"); ok(/a producir/i.test(txt) && /no va a fábrica/.test(txt),"Resumen con tarjeta A producir");
  // reload
  await page.reload(); await page.waitForTimeout(1500);
  await page.click("#tabs [data-t='ingreso']").catch(()=>{}); await page.waitForTimeout(300);
  ok(!/Cheesecake/.test(await page.innerText("#main")), "tras recargar sigue sin Cheesecake en Ingreso");
  // servidor rechaza no producidos
  const r=await page.evaluate(async()=>{const x=await fetch("/exec",{method:"POST",body:JSON.stringify({accion:"registrar",tipo:"ingreso",subtipo:"produccion",local:"Marruecos",items:{"4":3}})});return x.json()});
  ok(r.ok===false && /no produce/.test(r.error), "servidor rechaza producir lo que no está en la lista");
  console.log("errores:", err.length?err:"ninguno"); console.log(fallos.length?"RESULTADO: "+fallos.length+" fallo(s)":"RESULTADO: todo OK");
  await b.close();
})().catch(e=>{console.error("ERROR",e.message);process.exit(1)});
