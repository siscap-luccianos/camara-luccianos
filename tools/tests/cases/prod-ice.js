const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8991/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Marruecos"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300);
  await page.click("#irProduccion"); await page.waitForTimeout(300);
  // vasquetas: como hoy, con peso de Marruecos
  const txt=await page.innerText("#main");
  ok(/Peso promedio: 4,97 kg/.test(txt), "vasqueta muestra el peso de Marruecos (4,97) y no el general (3,09)");
  ok(await page.$("[data-kilos]")!==null, "vasquetas siguen con kilos");
  // pestaña Icepops
  await page.click(".tabCat[data-familia='icepops']"); await page.waitForTimeout(300);
  ok(await page.$("[data-kilos]")===null, "icepops sin campo de kilos");
  ok(await page.$$eval("[data-uni]",e=>e.length)>=3, "icepops con botón de unidades");
  await page.click("[data-uni='162']"); await page.waitForSelector("#uniOv");
  for (const k of ["1","2"]) await page.click(`[data-uni-tecla='${k}']`);
  await page.click("[data-uni-caja]");
  ok((await page.inputValue("#uniNum"))==="42", "12 + 1 caja (30) = 42");
  await page.screenshot({path:"../prod-ice-pad.png"});
  await page.click("[data-uni-tecla='⌫']"); ok((await page.inputValue("#uniNum"))==="4","borrar deja 4");
  await page.click("[data-uni-tecla='2']"); await page.click("[data-uni-listo]"); await page.waitForTimeout(300);
  ok((await page.innerText("[data-uni='162']")).includes("42"), "la fila muestra 42 unid.");
  // teclado físico en otro sabor
  await page.click("[data-uni='49']"); await page.waitForSelector("#uniOv"); await page.waitForTimeout(200); await page.keyboard.type("7"); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  ok((await page.innerText("[data-uni='49']")).includes("7"), "teclado físico: 7");
  // cancelar no cambia
  await page.click("[data-uni='73']"); await page.click("[data-uni-tecla='9']"); await page.click("[data-uni-cancel]"); await page.waitForTimeout(200);
  ok((await page.innerText("[data-uni='73']")).includes("Tocar"), "cancelar no carga nada");
  await page.screenshot({path:"../prod-ice-lista.png"});
  console.log("barra:", (await page.innerText("#bar")).replace(/\n/g," | ").slice(0,160));
  await page.click("#bar #go, #bar button >> nth=-1").catch(()=>{});
  await page.waitForTimeout(500);
  if(await page.$("#ok")){ await page.click("#ok"); await page.waitForTimeout(900) }
  console.log("errores:", err.length?err:"ninguno"); console.log(fallos.length?"RESULTADO: "+fallos.length+" fallo(s)":"RESULTADO: todo OK");
  await b.close();
})().catch(e=>{console.error("ERROR",e.message);process.exit(1)});
