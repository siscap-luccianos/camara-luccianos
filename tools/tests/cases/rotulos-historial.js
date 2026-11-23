const { chromium } = require("playwright");
(async () => {
  const b2 = await chromium.launch();
  const page = await (await b2.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const fallos=[], err=[], posts=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  page.on("request",q=>{ if(q.method()==="POST"){ try{ const b=JSON.parse(q.postData()||"{}"); if(b.accion==="registrar") posts.push(b) }catch(e){} } });
  await page.goto("http://localhost:8995/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  // Ingreso con kilos (remito simulado)
  await page.click("#tabs [data-t='ingreso']"); await page.waitForTimeout(300); await page.click("[data-ing-menu='merc']"); await page.waitForTimeout(200);
  await page.setInputFiles("#inputRemitoFoto",require("path").join(__dirname,"..","..","..","fotos/5.jpg"));
  await page.waitForSelector("[data-remito-kg]",{timeout:8000});
  await page.fill("[data-remito-kg='1']","22,5"); await page.click("#remitoCargar"); await page.waitForTimeout(300);
  await page.fill("[data-kilos='5']","6,2"); await page.click("#go"); await page.click("#ok"); await page.waitForTimeout(700);
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(300); await page.click("[data-sal-menu='comun']").catch(()=>{}); await page.waitForTimeout(200);
  await page.click("#irEscaner"); await page.waitForSelector("#escCodigo");
  const scan=async c=>{ await page.fill("#escCodigo",c); await page.press("#escCodigo","Enter"); await page.waitForTimeout(2700) };
  await scan("00040036014102621001"); // vasqueta escaneada: lote 14/10/26, turno 21, operario 1
  await scan("00200040202112621002");
  await page.click("[data-esc-cerrar]"); await page.waitForTimeout(300);
  await page.click("#go"); await page.waitForTimeout(300);
  await page.click("#ok"); await page.waitForTimeout(900);
  const b=posts[posts.length-1]||{};
  ok(b.tipo==="salida" && b.rotulos && Object.keys(b.rotulos).length===2, "la salida manda los rótulos de cada sabor escaneado: "+JSON.stringify(b.rotulos));
  const todos=Object.values(b.rotulos||{}).flat();
  ok(todos.includes("00040036014102621001") && todos.includes("00200040202112621002"), "cada vasqueta lleva sus 20 dígitos");
  ok(Object.entries(b.rotulos||{}).every(([id,l])=>l.length===(b.pesos[id]||[]).length), "los rótulos van alineados con los pesos");
  const h=await page.evaluate(()=>({d:datosRotulo("00040039313102622057"), x:rotulosHistHTML({rotulos:{"4":["00040039313102622057",""]}},"4",[{kg:3.93},{kg:3.2}]), v:rotulosHistHTML({rotulos:{}},"4",[])}));
  ok(h.d&&h.d.lc==="LC13102622057"&&h.d.operario==="57"&&h.d.turno==="tarde","decodifica el rótulo real de la Tramontana: "+JSON.stringify(h.d));
  ok(/LC13102622057/.test(h.x)&&/Operario 57/.test(h.x)&&/3,93 kg/.test(h.x)&&!/3,20/.test(h.x),"el Historial muestra LC, operario y turno solo de la vasqueta escaneada");
  ok(h.v==="","sin rótulos el Historial queda como antes");
  const pr=await page.evaluate(()=>({v:parseCodigoRotulo("00400039313102622057"), c:parseCodigoRotulo("9900090003550083529092621015"), h:rotulosHistHTML({rotulos:{"4":["9900090003550083529092621015"]}},"4",[{kg:8.35,caja:true}])}));
  ok(pr.v&&pr.v.lote==="13/10/2026 · LC13102622057 · Operario 57 · tarde","el escáner muestra fecha, LC, operario y turno de la vasqueta: "+(pr.v&&pr.v.lote));
  ok(pr.c&&pr.c.lote==="29/09/2026 · Operario 15 · mañana","el escáner muestra fecha, operario y turno de la caja: "+(pr.c&&pr.c.lote));
  ok(/caja ×2/.test(pr.h)&&/Operario 15/.test(pr.h)&&/Lote 29\/09\/2026/.test(pr.h),"el Historial muestra la caja con su lote y operario");
  console.log("errores:", err.length?err:"ninguno"); await b2.close();
  console.log(fallos.length||err.length?"FALLAS "+(fallos.length+err.length):"FALLAS 0"); process.exit(fallos.length||err.length?1:0);
})();
