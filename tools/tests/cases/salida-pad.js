const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error")err.push(m.text())});
  await page.goto("http://localhost:8991/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Marruecos"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
  // vasquetas: un toque suma 1 (sin pad)
  await page.click("[data-add='5']"); await page.waitForTimeout(200);
  ok(await page.$("#cantOv")===null, "vasqueta: no abre pad");
  ok((await page.innerText("[data-add='5'] >> xpath=..")).includes("1"), "vasqueta suma 1 con un toque");
  // icepops
  await page.click(".tabCat[data-familia='icepops']"); await page.waitForTimeout(300);
  await page.click("[data-add='162']"); await page.waitForSelector("#cantOv");
  ok((await page.inputValue("#cantNum"))==="1", "abre con 1");
  await page.click("[data-cant-tecla='1']"); await page.click("[data-cant-tecla='8']");
  ok((await page.inputValue("#cantNum"))==="18", "1,8 → 18 (el primer número reemplaza al 1)");
  await page.screenshot({path:"salida-pad.png"});
  await page.click("[data-cant-listo]"); await page.waitForTimeout(300);
  ok(await page.$("#cantOv")===null, "Listo cierra");
  ok((await page.innerText("[data-add='162'] >> xpath=..")).includes("18"), "Mango muestra 18");
  // caja
  await page.click("[data-add='49']"); await page.waitForSelector("#cantOv");
  ok(await page.$("[data-cant-caja]")===null, "caja de 30 > stock 9: sin botón +1 caja");
  await page.click("[data-cant-tecla='2']"); await page.click("[data-cant-tecla='0']");
  ok(!(await page.$eval("#cantMsg",e=>e.hidden)), "20 > 9: avisa");
  ok(await page.$eval("[data-cant-listo]",e=>e.disabled), "Listo apagado");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  ok(await page.$("#cantOv")===null, "Escape cierra sin cargar");
  // reabrir uno cargado: arranca con 18 y Quitar
  await page.click("[data-add='162']"); await page.waitForSelector("#cantOv");
  ok((await page.inputValue("#cantNum"))==="18", "reabre con la cantidad cargada");
  await page.click("[data-cant-caja]"); ok((await page.inputValue("#cantNum"))==="48", "+1 caja suma 30 → 48");
  await page.click("[data-cant-cancel]"); await page.waitForTimeout(200);
  await page.click("[data-add='162']"); await page.waitForSelector("#cantOv"); await page.waitForTimeout(150);
  await page.keyboard.type("7"); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  ok((await page.innerText("[data-add='162'] >> xpath=..")).includes("7"), "teclado físico: 7 + Enter");
  await page.click("[data-add='162']"); await page.click("[data-cant-quitar]"); await page.waitForTimeout(300);
  ok(!(await page.innerText("[data-add='162'] >> xpath=..")).includes("qty") , "quitar");
  ok(await page.$("[data-sub='162']")===null, "quitar: ya no hay botón − (no está en la salida)");
  // chocolatería
  await page.click(".tabCat[data-familia='chocolateria']"); await page.waitForTimeout(300);
  await page.click("[data-add='117']"); await page.waitForSelector("#cantOv");
  ok(await page.$("[data-cant-caja]")===null, "alfajor: caja de 60 > stock 50, sin +1 caja");
  await page.click("[data-cant-tecla='5']"); await page.click("[data-cant-tecla='0']"); await page.click("[data-cant-listo]"); await page.waitForTimeout(300);
  ok((await page.innerText("[data-add='117'] >> xpath=..")).includes("50"), "alfajor cargado con pad: 50");
  // confirmar
  console.log("barra:", (await page.innerText("#bar")).replace(/\n/g," | ").slice(0,200));
  await page.click("#bar button >> nth=-1"); await page.waitForTimeout(500);
  if(await page.$("#ok")){ await page.click("#ok"); await page.waitForTimeout(900) }
  // desperdicio
  await page.click("#irDesperdicio"); await page.waitForTimeout(300);
  await page.click(".tabCat[data-familia='icepops']"); await page.waitForTimeout(200);
  await page.click("[data-wadd='162']"); await page.waitForSelector("#cantOv");
  await page.click("[data-cant-tecla='3']"); await page.click("[data-cant-listo]"); await page.waitForTimeout(300);
  ok((await page.innerText("[data-wadd='162'] >> xpath=..")).includes("3"), "desperdicio con pad: 3");
  await page.screenshot({path:"salida-pad2.png"});
  console.log("errores:", err.length?err:"ninguno"); console.log(fallos.length?"RESULTADO: "+fallos.length+" fallo(s)":"RESULTADO: todo OK");
  await b.close();
})().catch(e=>{console.error("ERROR",e.message);process.exit(1)});
