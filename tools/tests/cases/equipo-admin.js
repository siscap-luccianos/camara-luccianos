// Equipo: el admin resetea el PIN de supervisores/admins, edita cualquier nombre y cambia el rol de un responsable de local.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  const fallos=[], err=[]; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) fallos.push(m)};
  page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8995/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  const f = async (yo, e) => page.evaluate(([yo,e]) => { S.empleado.rol = yo; return _teamFila(e, ["encargado","turno","colaborador"]) }, [yo, e]);
  const sup = {id:"s1",nombre:"Sofía Sup",rol:"supervisor",activo:true}, enc = {id:"e1",nombre:"Eva Enc",rol:"encargado",activo:true,local:"X"}, adm = {id:"a1",nombre:"Ana Adm",rol:"admin",activo:true};
  let h = await f("admin", sup);
  ok(/data-resetpin/.test(h) && /data-editar-nombre-emp/.test(h), "admin ve «Resetear PIN» y «Editar nombre» en un supervisor");
  h = await f("admin", adm); ok(/data-resetpin/.test(h), "admin ve «Resetear PIN» en otro admin");
  h = await f("admin", enc); ok(/data-cambiar-rol/.test(h) && /data-editar-nombre-emp/.test(h) && /rolChip/.test(h) && /Responsable de local/.test(h), "admin ve el puesto, edita el nombre y cambia el rol del responsable de local");
  h = await f("supervisor", sup); ok(!/data-resetpin/.test(h), "un supervisor NO ve «Resetear PIN» en un supervisor");
  h = await f("supervisor", enc); ok(/data-cambiar-rol/.test(h) && /data-resetpin/.test(h), "un supervisor cambia el rol y resetea el PIN de un responsable de local");
  h = await f("encargado", enc); ok(!/data-editar-nombre-emp/.test(h), "un responsable de local no edita el nombre de otro responsable");
  ok(err.length===0,"sin errores de consola"+(err.length?": "+err[0]:""));
  await b.close(); console.log(fallos.length?"FALLAS "+fallos.length:"FALLAS 0"); process.exit(fallos.length?1:0);
})();
