const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 860 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8995/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  const temas=async()=>page.$$eval("#ayLista [data-ay-tema]",e=>e.map(x=>x.dataset.ayTema));
  await page.click("#ayudaBtn"); await page.waitForSelector("#ayudaOv");
  let t=await temas(); console.log("Local prueba:",t.join(","));
  ok(t.includes("quepaso")&&t.includes("escaner")&&t.includes("venc")&&t.includes("conteo")&&t.includes("remito")&&t.includes("pedido"),"Local prueba ve escáner, vencimientos, conteo, remito y pedido");
  ok(!t.includes("choco"),"sin «Salida de chocolatería» porque el local no tiene venta del día");
  ok(await page.$(".ayTema.abierto .ayCards")!==null,"arranca abierto «Qué usar según lo que pasó»");
  await page.click("[data-ay-tema='escaner']"); await page.waitForTimeout(150);
  ok(await page.$(".ayTema.abierto .ayPasos")!==null && (await page.$$(".ayTema.abierto")).length===1,"abrir el escáner cierra el anterior");
  ok(/Escanear vasqueta/.test(await page.$eval(".ayTema.abierto",e=>e.textContent)),"el texto del escáner está");
  await page.screenshot({path:"ayuda3.png"});
  for(const id of ["venc","conteo","remito","pedido"]){ await page.click(`[data-ay-tema='${id}']`); await page.waitForTimeout(100); ok((await page.$eval(".ayTema.abierto",e=>e.textContent.length))>80,"tema "+id+" se abre con texto"); }
  await page.click("[data-ay-tema='pedido']"); await page.waitForTimeout(100);
  ok(await page.$(".ayTema.abierto")===null,"tocar el tema abierto lo cierra");
  await page.keyboard.press("Escape");
  await page.fill("#local","Obelisco CABA"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.click("#ayudaBtn"); await page.waitForSelector("#ayudaOv");
  t=await temas(); console.log("Obelisco:",t.join(","));
  ok(!t.includes("escaner"),"un local sin escáner no ve el tema del escáner");
  console.log("errores:",err.length?err:"ninguno"); console.log(fallos.length?"FALLAS":"TODO OK"); await b.close();
})();
