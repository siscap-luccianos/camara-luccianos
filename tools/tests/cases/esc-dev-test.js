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

  // ---- ESCÁNER
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  await page.click("#irEscaner"); await page.waitForSelector("#escCodigo");
  const scan=async c=>{ await page.fill("#escCodigo",c); await page.press("#escCodigo","Enter"); await page.waitForTimeout(2700) };
  await scan("00040036014102621001");
  ok(await page.$eval("#escMsg",e=>e.className)==="escMsg ok","primer escaneo: mensaje ok");
  await scan("00040036014102621001");
  ok(await page.$eval("#escMsg",e=>/warn/.test(e.className)&&/ya se escane/.test(e.textContent)),"repetido: franja amarilla 'ya se escaneó'");
  const bg=await page.$eval("#escMsg",e=>getComputedStyle(e).backgroundColor); ok(/242, 180, 0/.test(bg),"franja amarilla "+bg);
  await scan("00200040202112621002");
  ok((await page.$$("#escLista .escRow")).length===3,"lista completa con 3 filas");
  ok((await page.$$("#escLista .escRow.dup")).length===1,"una fila marcada repetida");
  await page.screenshot({path:"esc1.png"});
  await page.click("[data-esc-cerrar]"); await page.waitForTimeout(300);
  ok(await page.$(".escDupAviso")!==null,"aviso amarillo de repetido en la pantalla de Salida");
  ok(/código repetido/.test(await page.$eval("#barIn",e=>e.textContent)),"aviso también en la barra de abajo");
  await page.click("[data-esc-revisar]"); await page.waitForSelector("#escCodigo");
  await page.click("#escLista .escRow.dup [data-esc-quitar]"); await page.waitForTimeout(300);
  ok((await page.$$("#escLista .escRow")).length===2,"quitar saca solo esa fila");
  ok((await page.$$("#escLista .escRow.dup")).length===0,"ya no hay repetidos");
  await page.click("[data-esc-cerrar]"); await page.waitForTimeout(300);
  ok(await page.$(".escDupAviso")===null,"desaparece el aviso de repetido");
  ok(/Con peso: 2/.test(await page.$eval(".pesosResumen",e=>e.textContent)),"salida con 2 pesadas");
  // Pesada a mano y quitar
  await page.click("[data-add='20']"); await page.waitForSelector("#kilosOv");
  for(const k of ["3",",","9","5"]) await page.click(`[data-kg-tecla='${k}']`);
  await page.click("[data-kg-ok]"); await page.waitForTimeout(200);
  for(const k of ["3",",","8"]) await page.click(`[data-kg-tecla='${k}']`);
  await page.click("[data-kg-ok]"); await page.waitForTimeout(200);
  ok((await page.$$("#kgCargadas .kgChip")).length===2,"dos chips de pesadas a mano");
  await page.click("#kgCargadas .kgChip button"); await page.waitForTimeout(300);
  ok((await page.$$("#kgCargadas .kgChip")).length===1,"✕ quita una pesada a mano");
  await page.click("[data-kg-listo]"); await page.waitForTimeout(300);
  ok(/Con peso: 3/.test(await page.$eval(".pesosResumen",e=>e.textContent)),"salida con 3 pesadas en total");
  await page.click("#go"); await page.click("#ok"); await page.waitForTimeout(800);

  // ---- DEVOLUCIÓN con pesos
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300);
  await page.click("#irDevolucion"); await page.waitForTimeout(300);
  const chips=await page.$$eval(".devChip",e=>e.map(x=>x.textContent.replace(/\s+/g," ").trim()));
  console.log("chips:",chips);
  ok(chips.length===3 && chips.some(t=>/3,60 kg/.test(t)) && chips.some(t=>/4,02 kg/.test(t)) && chips.some(t=>/3,80 kg/.test(t)),"cada vasqueta de hoy con su peso");
  ok(await page.$("[data-devtip]")!==null,"Cheesecake sin peso registrado pide escribirlo");
  await page.screenshot({path:"dev1.png"});
  await page.click(".devChip:has-text('4,02')"); await page.waitForTimeout(300);
  ok(await page.$eval(".devChip.on",e=>/4,02/.test(e.textContent)),"chip tocado queda marcado");
  ok(/4,02 kg/.test(await page.$eval("#barIn",e=>e.textContent)),"la barra muestra 4,02 kg");
  await page.fill("[data-devtip='5:0']","3,1"); await page.waitForTimeout(200);
  ok(/7,12 kg/.test(await page.$eval("#barIn",e=>e.textContent)),"con el peso escrito a mano suma 7,12 kg");
  await page.click("#go"); await page.click("#ok"); await page.waitForTimeout(800);
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300);
  await page.click("#irDevolucion"); await page.waitForTimeout(300);
  const chips2=await page.$$eval(".devChip",e=>e.map(x=>x.textContent.replace(/\s+/g," ").trim()));
  ok(chips2.length===2 && !chips2.some(t=>/4,02/.test(t)),"lo ya devuelto no vuelve a aparecer: "+chips2.join(" | "));
  ok(await page.$("[data-devtip]")===null,"la vasqueta sin peso ya devuelta tampoco aparece");
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(500);
  console.log("KPI:",(await page.$eval(".kpis",e=>e.textContent.replace(/\s+/g," "))).slice(0,140));
  console.log("errores de consola:", err.length?err:"ninguno");
  console.log(fallos.length?("FALLAS: "+fallos.length):"TODO OK");
  await b.close();
})();
