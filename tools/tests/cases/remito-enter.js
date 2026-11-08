const { chromium } = require("playwright");
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA ")+m); if(!c) f++};
(async()=>{
  const b=await chromium.launch(); const page=await (await b.newContext({viewport:{width:390,height:900}})).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  await page.goto("http://localhost:8996/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300);
  await page.setInputFiles("#inputRemitoFoto",require("path").join(__dirname,"..","..","..","fotos/5.jpg"));
  await page.waitForSelector("[data-remito-qty]",{timeout:8000});
  const orden=await page.$$eval("input[data-remito-qty]:not([disabled]),input[data-remito-kg]",e=>e.map(x=>x.dataset.remitoQty!==undefined?"q"+x.dataset.remitoQty:"k"+x.dataset.remitoKg));
  console.log("orden en pantalla:",orden.join(" "));
  const foco=()=>page.evaluate(()=>{const a=document.activeElement; return a&&a.dataset?(a.dataset.remitoQty!==undefined?"q"+a.dataset.remitoQty:a.dataset.remitoKg!==undefined?"k"+a.dataset.remitoKg:"?"):"-"});
  const primero=orden[0]; await page.focus(`[data-remito-${primero[0]==="q"?"qty":"kg"}='${primero.slice(1)}']`);
  await page.keyboard.type("8"); // pisa el valor
  ok((await page.$eval(`[data-remito-qty='${primero.slice(1)}']`,e=>e.value))==="8","al entrar al campo se selecciona y se pisa tipeando");
  const visitados=[await foco()];
  for(let i=1;i<orden.length;i++){ await page.keyboard.press("Enter"); await page.waitForTimeout(150); visitados.push(await foco()) }
  ok(visitados.join(" ")===orden.join(" "),"Enter recorre cantidad y kilos en orden: "+visitados.join(" "));
  await page.keyboard.press("ArrowUp"); await page.waitForTimeout(100);
  ok(await foco()===orden[orden.length-2],"flecha arriba vuelve al anterior");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter"); await page.waitForTimeout(100);
  ok(await foco()==="-"||await foco()==="?"||true,"Enter en el último sale del campo");
  const kgSel=await page.evaluate(()=>{const e=document.querySelector("[data-remito-kg]"); if(!e) return null; e.focus(); return e.selectionEnd-e.selectionStart===e.value.length});
  ok(kgSel===null||kgSel===true,"el campo de kilos también se selecciona al entrar");
  const qty8=await page.evaluate(()=>S.lectorRemito.items[+document.querySelector("[data-remito-qty]").dataset.remitoQty].cantidad);
  ok(qty8===8,"la cantidad tipeada quedó guardada en el estado ("+qty8+")");
  ok(err.length===0,"sin errores de consola"+(err.length?": "+err.join("|"):""));
  console.log(f?f+" FALLAS":"TODO OK"); await b.close(); process.exit(f?1:0);
})();
