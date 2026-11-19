const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message));
  await page.addInitScript(()=>{try{localStorage.setItem("idioma","es")}catch(e){}}); // estos tests miran textos en español (Marruecos sale en francés solo)
  await page.goto("http://localhost:8991/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Marruecos"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300);
  await page.click("[data-ing-menu='prod']"); await page.waitForTimeout(300);
  await page.click("[data-prodinc='4']"); await page.click("[data-prodinc='4']"); await page.waitForTimeout(300);
  const barTxt=await page.innerText(".bar");
  ok(/Faltan los kilos fabricados de/.test(barTxt), "sin kilos: avisa que faltan los kilos fabricados — "+barTxt.replace(/\s+/g," ").slice(0,120));
  ok(await page.$eval("#go",e=>e.disabled), "sin kilos, el botón de registrar queda apagado");
  await page.fill("[data-kilos='4']","7,5"); await page.waitForTimeout(250);
  ok(!(await page.$eval("#go",e=>e.disabled)), "con kilos, el botón se enciende");
  ok(!/Faltan los kilos fabricados/.test(await page.innerText(".bar")), "y desaparece el aviso");
  await page.fill("[data-kilos='4']",""); await page.waitForTimeout(250);
  ok(await page.$eval("#go",e=>e.disabled), "si se borran los kilos vuelve a apagarse");
  // Icepops: por unidad, no piden kilos
  await page.click(".tabCat[data-familia='icepops']"); await page.waitForTimeout(300);
  await page.click("[data-prodinc='4']").catch(()=>{});
  console.log(fallos.length?"FALLAS "+fallos.length:"FALLAS 0", err.length?err:""); await b.close(); process.exit(fallos.length||err.length?1:0);
})();
