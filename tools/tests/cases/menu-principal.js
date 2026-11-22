// Menú principal de Salida e Ingreso: tarjeta grande + acciones al costado, en PC y celular, Crema y Dorado.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  async function entrar(w,h){
    const page = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
    await page.goto("http://localhost:8995/"); await page.waitForSelector("#authLocal");
    await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
    await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
    await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
    await page.waitForSelector("header"); await page.waitForTimeout(400);
    await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(1000);
    return page;
  }
  for (const [w,h,n] of [[1280,800,"pc"],[390,844,"cel"]]) {
    const page = await entrar(w,h);
    await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(400);
    ok(await page.$(".menuHero")!==null,n+": Salida muestra la tarjeta grande");
    ok((await page.$$(".menuRow")).length>=1,n+": Salida muestra las otras acciones");
    ok(/Retiros/.test(await page.innerText(".menuHero")),n+": la grande es «Retiros»");
    ok(await page.$(".menuAvisos")!==null,n+": hay avisos de stock");
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),n+": sin scroll horizontal");
    await page.screenshot({path:"menu-salida-"+n+".png"});
    await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(400);
    ok(/Mercadería que llegó/.test(await page.innerText(".menuHero")),n+": Ingreso: la grande es «Mercadería que llegó»");
    ok((await page.$$(".menuRow")).length>=2,n+": Ingreso muestra devolución y demás al costado");
    await page.screenshot({path:"menu-ingreso-"+n+".png"});
    await page.click("#cambiarTema").catch(()=>{}); await page.waitForTimeout(300);
    await page.screenshot({path:"menu-ingreso-"+n+"-dorado.png"});
    await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300);
    await page.screenshot({path:"menu-salida-"+n+"-dorado.png"});
    await page.click(".menuHero"); await page.waitForTimeout(400);
    ok(await page.$(".menuHero")===null,n+": tocar la grande abre la lista de sabores");
    await page.close();
  }
  ok(err.length===0,"sin errores de consola"+(err.length?": "+err[0]:""));
  await b.close(); console.log(fallos.length?"FALLAS "+fallos.length:"FALLAS 0"); process.exit(fallos.length?1:0);
})();
