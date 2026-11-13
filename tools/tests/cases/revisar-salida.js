const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  await page.goto("http://localhost:8995/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  // Ingreso con kilos (remito simulado)
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300);
  await page.setInputFiles("#inputRemitoFoto",require("path").join(__dirname,"..","..","..","fotos/5.jpg"));
  await page.waitForSelector("[data-remito-kg]",{timeout:8000});
  await page.fill("[data-remito-kg='1']","22,5"); await page.click("#remitoCargar"); await page.waitForTimeout(300);
  await page.fill("[data-kilos='5']","6,2"); await page.click("#go"); await page.click("#ok"); await page.waitForTimeout(700);
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  await page.click("#irEscaner"); await page.waitForSelector("#escCodigo");
  const scan=async c=>{ await page.fill("#escCodigo",c); await page.press("#escCodigo","Enter"); await page.waitForTimeout(2700) };
  await scan("00040036014102621001");
  await scan("00040036014102621001"); // repetido
  await scan("00200040202112621002");
  await page.click("[data-esc-cerrar]"); await page.waitForTimeout(300);
  // Registrar → se abre la revisión, todavía no se guardó nada
  await page.click("#go"); await page.waitForTimeout(300);
  ok(/Lo que vas a sacar/.test(await page.innerText("#app")),"se abre «Lo que vas a sacar» al tocar Registrar");
  ok((await page.$$(".revLin")).length===3,"3 líneas, una por vasqueta escaneada");
  ok((await page.$$(".revLin.dup")).length===1,"una línea marcada como código repetido");
  ok(/Seguir cargando/.test(await page.innerText("#barIn")) && await page.$("#ok")!==null,"la barra tiene «Seguir cargando» y «Confirmar»");
  await page.screenshot({path:"revisar1.png",fullPage:true});
  // quitar la línea repetida con su ✕
  await page.click(".revLin.dup [data-rev-x]"); await page.waitForTimeout(300);
  ok((await page.$$(".revLin")).length===2 && (await page.$$(".revLin.dup")).length===0,"la ✕ saca solo esa vasqueta y ya no hay repetidos");
  // volver sigue en la grilla con lo cargado
  await page.click("#volver"); await page.waitForTimeout(300);
  ok(await page.$(".revLin")===null && await page.$(".grid")!==null,"«Seguir cargando» vuelve a la grilla");
  await page.click("#go"); await page.waitForTimeout(300);
  // quitar todo un producto
  const n0=(await page.$$(".revProd")).length;
  await page.click("[data-rev-quitar]"); await page.waitForTimeout(300);
  ok(n0===2 && (await page.$$(".revProd")).length===1,"«Quitar» saca el producto entero ("+n0+" → 1)");
  // confirmar guarda lo que se ve
  await page.click("#ok"); await page.waitForTimeout(800);
  await page.click("#tabs [data-t='historial']"); await page.waitForTimeout(400);
  ok(/salida/i.test(await page.innerText("#app")),"queda en Historial");
  // quitar lo último vuelve a la grilla
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  await page.click("#irEscaner"); await page.waitForSelector("#escCodigo"); await scan("00200040202112621002");
  await page.click("[data-esc-cerrar]"); await page.click("#go"); await page.waitForTimeout(300);
  await page.click("[data-rev-x]"); await page.waitForTimeout(300);
  ok(await page.$(".revLin")===null && await page.$("#go")===null,"al quitar lo último se sale de la revisión y no queda nada cargado");
  ok(err.length===0,"sin errores de consola "+err.join("|"));
  console.log("FALLAS "+fallos.length); await b.close();
})();
