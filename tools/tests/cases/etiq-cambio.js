const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  let fallas=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallas++};
  await page.goto("http://localhost:8998/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(1000);
  const lotes=()=>page.evaluate(()=>lotesPorSabor()["117"].map(l=>[l.f,l.c]));
  const abrir=async(idx)=>{ await page.evaluate(()=>{ S.tab="salida"; S.etiq=null; S.verVencimientos=true; S.filtroVenc="todos"; renderApp() }); await page.waitForTimeout(150);
    const btns=(await page.$$eval("[data-etiq-cambiar]",e=>e.map(x=>x.dataset.etiqCambiar))).filter(x=>x.startsWith("117|")).sort((a,b)=>a.split("|")[1]<b.split("|")[1]?-1:1);
    await page.click("[data-etiq-cambiar='"+btns[idx]+"']"); await page.waitForTimeout(200); return btns[idx]; };
  const poner=async(sel,v)=>{ await page.fill(sel,String(v)); await page.dispatchEvent(sel,"change"); await page.waitForTimeout(100) };
  const txt=()=>page.$eval(".etiqSheet",e=>e.textContent.replace(/\s+/g," "));
  const confirmar=async()=>{ await page.click("[data-etiq-confirmar]"); await page.waitForTimeout(120); await page.click("[data-etiq-si]"); await page.waitForTimeout(900) };
  console.log("inicio", JSON.stringify(await lotes()));
  // 1) subir la cantidad con la MISMA fecha: toma de las sin fecha (hay 15)
  await abrir(1);
  ok(await page.$eval("[data-etiq-confirmar]",e=>e.disabled),"sin tocar nada el botón está apagado");
  ok((await page.$eval("#etiqCant",e=>+e.max))===35,"se puede subir hasta 35 (20 del lote + 15 sin fecha)");
  await poner("#etiqCant",99); ok((await page.$eval("#etiqCant",e=>+e.value))===35,"99 se topa en 35");
  await poner("#etiqCant",25);
  ok(!(await page.$eval("[data-etiq-confirmar]",e=>e.disabled)),"con otra cantidad el botón se prende (misma fecha)");
  ok(/se toman 5 .* sin fecha/.test(await txt()),"avisa «se toman 5 de las que están sin fecha»");
  await confirmar();
  let L=await lotes(); console.log(JSON.stringify(L));
  ok(L.find(l=>l[1]===25&&l[0])&&L.find(l=>!l[0]&&l[1]===10),"el lote queda con 25 y sin fecha baja a 10");
  ok(L.reduce((a,l)=>a+l[1],0)===45,"el stock total no cambia (45)");
  // 2) bajar la cantidad: lo que sobra vuelve a sin fecha
  await abrir(1);
  await poner("#etiqCant",10);
  ok(/15 .* vuelven a «sin fecha»/.test(await txt()),"avisa que 15 vuelven a sin fecha");
  await confirmar();
  L=await lotes(); console.log(JSON.stringify(L));
  ok(L.find(l=>l[0]&&l[1]===10)&&L.find(l=>!l[0]&&l[1]===25),"lote en 10 y sin fecha sube a 25");
  // 3) cambiar fecha y cantidad a la vez
  await abrir(0);
  const nueva=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+60);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")});
  await poner("#etiqFecha",nueva); await poner("#etiqCant",4);
  ok(/pasan del .* al .*/.test(await txt())&&/vuelven a «sin fecha»/.test(await txt()),"fecha y cantidad juntas: «pasan del… al…» y el resto a sin fecha");
  await confirmar();
  L=await lotes(); console.log(JSON.stringify(L));
  ok(L.find(l=>l[0]===nueva&&l[1]===4),"4 unidades con la fecha nueva");
  ok(L.reduce((a,l)=>a+l[1],0)===45,"el stock total sigue en 45");
  // 4) en 0: todas vuelven a sin fecha
  await abrir(1);
  await poner("#etiqCant",0);
  ok(/vuelven a «sin fecha»/.test(await txt()) && !(await page.$eval("[data-etiq-confirmar]",e=>e.disabled)),"0 = todas vuelven a sin fecha y el botón se prende");
  console.log(fallas?"FALLAS "+fallas:"TODO OK","errores:",JSON.stringify(err)); await b.close();
})();
