const { chromium } = require("playwright");
let fails=0; const ok=(c,m)=>{ console.log((c?"OK   ":"FALLA ")+m); if(!c) fails++ };
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{ if(m.type()==="error" && !/404/.test(m.text())) err.push(m.text()) });
  await page.goto("http://localhost:8996/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);

  // ---------- CAMBIO DE SABOR ----------
  await page.click("[data-t='ingreso']"); await page.waitForTimeout(300);
  ok(await page.$("#irCambioSabor")!==null, "responsable ve «¿Llegó un sabor cambiado?» en Ingreso");
  await page.click("#irCambioSabor"); await page.waitForTimeout(300);
  ok((await page.$eval("#cmbOk",e=>e.disabled)), "Registrar apagado al entrar");
  const desdeOpts=await page.$$eval("#cmbDesde option",o=>o.map(x=>x.textContent));
  ok(desdeOpts.some(t=>/Banana Split/.test(t)) && !desdeOpts.some(t=>/Granella|icepop/i.test(t)), "«Figura como» solo con stock y sin chocolatería: "+desdeOpts.join(" | "));
  await page.selectOption("#cmbDesde","4"); await page.waitForTimeout(250);
  const haciaOpts=await page.$$eval("#cmbHacia option",o=>o.map(x=>x.textContent));
  ok(!haciaOpts.some(t=>/Banana Split/.test(t)) && haciaOpts.some(t=>/Frutilla$/.test(t.trim())) && !haciaOpts.some(t=>/Granella|icepop/i.test(t)), "«Era en realidad» sin el mismo sabor ni no-vasquetas (kilos reales): "+haciaOpts.join(" | "));
  await page.selectOption("#cmbHacia","5"); await page.waitForTimeout(250);
  await page.click("[data-cmb-inc]"); await page.waitForTimeout(150);
  ok((await page.$eval(".stepper .n",e=>e.textContent))==="2", "cantidad 2");
  ok(await page.$("#cmbKilos")!==null, "pide kilos (vasquetas con kilos reales)");
  const sug=await page.$eval("[data-cmb-sug]",e=>e.dataset.cmbSug); ok(sug==="8.04","kilos sugeridos = 80,4/20×2 = 8,04 (dio "+sug+")");
  ok((await page.$eval("#cmbOk",e=>e.disabled)), "sigue apagado sin kilos ni motivo");
  await page.click("[data-cmb-sug]"); await page.waitForTimeout(150);
  ok((await page.$eval("#cmbKilos",e=>e.value))==="8,04", "«Usar sugerido» llena los kilos");
  ok((await page.$eval("#cmbOk",e=>e.disabled)), "sigue apagado sin motivo");
  await page.fill("#cmbKilos","30"); await page.waitForTimeout(150);
  ok(/no cuadra/.test(await page.$eval("#cmbKgAv",e=>e.textContent)), "kilos que no cuadran (15 kg por vasqueta) avisan");
  await page.fill("#cmbKilos","8,04"); await page.waitForTimeout(100);
  ok((await page.$eval("#cmbKgAv",e=>e.textContent))==="", "kilos que cuadran, sin aviso");
  await page.click("[data-cmb-motivo='Caja mal rotulada']"); await page.waitForTimeout(150);
  ok(!(await page.$eval("#cmbOk",e=>e.disabled)), "con kilos y motivo se habilita");
  const prev=await page.$eval("#cmbPreview",e=>e.textContent.replace(/\s+/g," "));
  ok(/Banana Split20 → 18/.test(prev.replace(/\s/g,"")||"") || /20\s*→\s*18/.test(prev), "«Cómo queda» muestra 20 → 18: "+prev);
  ok(/2\s*→\s*4/.test(prev), "«Cómo queda» muestra 2 → 4 (Cheesecake tenía 3 y se vendió 1)");
  await page.click("#cmbOk"); await page.waitForTimeout(900);
  ok(await page.$("#irCambioSabor")!==null && await page.$("#cmbOk")===null, "vuelve a Ingreso después de registrar");
  const st=await page.evaluate(()=>{ const m=stockMap(), k=kilosMap(); return {b:m["4"],c:m["5"],kb:k["4"],kc:k["5"]} });
  ok(st.b===18 && st.c===4, "stock: Banana 18, Cheesecake 4 (dio "+st.b+" / "+st.c+")");
  ok(Math.abs(st.kb-72.36)<0.01 && st.kc===null, "kilos: Banana 72,36; Cheesecake queda «sin kilos» porque ya tenía una salida sin pesar (dio "+st.kb+" / "+st.kc+")");
  await page.click("[data-t='historial']"); await page.waitForTimeout(500);
  await page.evaluate(()=>{ S.rangoHist="d60" }); await page.click(".hMov"); await page.waitForTimeout(250); // el movimiento se abre al tocar la fila
  const hist=await page.$eval("#app",e=>e.textContent.replace(/\s+/g," "));
  ok(/cambio de sabor/.test(hist) && /Banana Split\s*−2\s*→\s*Cheesecake al pistacchio\s*\+2/.test(hist) && /Caja mal rotulada/.test(hist), "Historial muestra el cambio de sabor con motivo");
  ok(await page.$("[data-anular]")!==null, "se puede anular");
  // el consumo no cambia: ningún registro de salida nuevo
  const sal=await page.evaluate(()=>regsActivos().filter(r=>r.tipo==="salida").length); ok(sal===1,"no se creó ninguna salida (consumo intacto)");
  // pedir más de lo que hay
  await page.click("[data-t='ingreso']"); await page.click("#irCambioSabor"); await page.selectOption("#cmbDesde","20"); await page.selectOption("#cmbHacia","4"); await page.waitForTimeout(200);
  for(let i=0;i<12;i++) await page.click("[data-cmb-inc]");
  ok((await page.$eval(".stepper .n",e=>e.textContent))==="6","el tope es el stock (6)");
  await page.click("#cmbCancelar"); await page.waitForTimeout(150);
  ok(await page.$("#cmbDesde")===null,"Cancelar vuelve a Ingreso");

  const grp=await page.evaluate(()=>({v:cambioPermitido({tipo:"v",familia:"vasquetas"}),b:cambioPermitido({tipo:"b",familia:"vasquetas"}),i:cambioPermitido({tipo:"i",familia:"icepops"}),g:cambioPermitido({tipo:"p",familia:"glutenfree"}),c:cambioPermitido({tipo:"c",familia:"chocolateria"}),p:cambioPermitido({tipo:"c",familia:"pasteleria"}),bo:cambioPermitido({tipo:"c",familia:"bolleria"})}));
  ok(grp.v&&grp.b&&grp.i&&grp.g&&!grp.c&&!grp.p&&!grp.bo,"aplica a vasquetas, baldes, icepops y gluten free; no a chocolatería, pastelería ni bollería: "+JSON.stringify(grp));
  // rol sin permiso
  const perm=await page.evaluate(()=>{ const r=S.empleado.rol; const out={}; for(const x of ["admin","supervisor","encargado","turno","produccion","colaborador"]){ S.empleado.rol=x; out[x]=puedeCambioSabor() } S.empleado.rol=r; return out });
  ok(perm.admin&&perm.supervisor&&perm.encargado&&perm.turno&&!perm.produccion&&!perm.colaborador, "permisos: "+JSON.stringify(perm));

  // ---------- ESCÁNER: etiqueta de producción (EAN-13 con peso) ----------
  const dec=await page.evaluate(()=>({a:parseCodigoRotulo("2000011035501"), b:parseCodigoRotulo("2000011035502"), c:parseCodigoRotulo("2000006038289"), d:parseCodigoRotulo("00040038905112621001"), e:parseCodigoRotulo("7790480089963"), f:parseCodigoRotulo("2000011000001")}));
  ok(dec.a&&dec.a.plu==="11"&&dec.a.kg===3.55, "decodifica 2000011035501 → PLU 11, 3,55 kg");
  ok(dec.b===null, "dígito verificador malo se rechaza");
  ok(dec.c&&dec.c.plu==="6"&&dec.c.kg===3.828, "decodifica 2000006038289 → PLU 6, 3,828 kg");
  ok(dec.d&&dec.d.codigo==="0004"&&dec.d.kg===3.89, "el rótulo de fábrica de 20 dígitos sigue andando");
  ok(dec.e===null, "un EAN-13 común (empieza con 7) no se toma como etiqueta de producción");
  await page.click("[data-t='salida']"); await page.waitForTimeout(300);
  await page.click("#irEscaner"); await page.waitForSelector("#escCodigo");
  await page.fill("#escCodigo","2000011035501"); await page.press("#escCodigo","Enter"); await page.waitForTimeout(300);
  let msg=await page.$eval("#escMsg",e=>e.textContent); ok(/Banana Split/.test(msg)&&/3,55/.test(msg), "escanea la etiqueta de producción: "+msg);
  await page.waitForTimeout(2700);
  await page.fill("#escCodigo","2000011035501"); await page.press("#escCodigo","Enter"); await page.waitForTimeout(300);
  msg=await page.$eval("#escMsg",e=>e.textContent); ok(/ya se escane/.test(msg), "repetida avisa en amarillo");
  const ean=c=>{ let t=0; for(let i=0;i<12;i++) t+=(+c[i])*(i%2?3:1); return c+((10-t%10)%10) };
  await page.fill("#escCodigo",ean("200009903550")); await page.press("#escCodigo","Enter"); await page.waitForTimeout(300);
  msg=await page.$eval("#escMsg",e=>e.textContent); ok(/PLU 99 sin asignar/.test(msg), "PLU sin asignar avisa: "+msg);
  await page.fill("#escCodigo","00040038905112621001"); await page.press("#escCodigo","Enter"); await page.waitForTimeout(300);
  msg=await page.$eval("#escMsg",e=>e.textContent); ok(/Banana Split/.test(msg)&&/lote/.test(msg), "el rótulo de fábrica sigue andando: "+msg);
  const kgs=await page.evaluate(()=>S.pesos.salida["4"]); ok(JSON.stringify(kgs)==="[3.55,3.55,3.89]","pesos cargados: "+JSON.stringify(kgs));

  ok(err.length===0, "sin errores de consola"+(err.length?": "+err.join(" | "):""));
  console.log(fails?("\n"+fails+" FALLAS"):"\nTODO OK");
  await b.close(); process.exit(fails?1:0);
})();
