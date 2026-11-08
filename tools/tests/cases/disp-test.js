const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 820, height: 600 } })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8995/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.evaluate(()=>{ S.controlEquipos=true; S.equipos={max:3,usados:1,pendientes:[{clave:"x",nombre:"Tablet"}],aprobados:[]}; S.tab="equipo"; S.subEquipo="empleados"; renderApp(); });
  await page.waitForTimeout(400);
  const tabs=await page.$$eval(".tabsCat .tabCat",e=>e.map(x=>x.textContent.trim()));
  console.log("solapas:",tabs.join(" | "));
  const gap=await page.evaluate(()=>{ const h=document.querySelector("header").getBoundingClientRect(), t=document.querySelector(".tabsCat").getBoundingClientRect(); return Math.round(t.top-h.bottom) });
  console.log("separación cabecera → solapas:",gap,"px");
  await page.screenshot({path:"disp1.png",clip:{x:0,y:0,width:820,height:330}});
  await page.click("[data-sub-equipo='equipos']"); await page.waitForTimeout(500);
  const txt=await page.$eval("#app",e=>e.textContent.replace(/\s+/g," ")).catch(()=>"");
  console.log("dispositivos:",/Dispositivos de/.test(txt), /dispositivos/.test(txt), "| quedan 'equipos' sueltos:", (txt.match(/equipos/gi)||[]).length);
  console.log("errores:",err.length?err:"ninguno"); await b.close();
})();
