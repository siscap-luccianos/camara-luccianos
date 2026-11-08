const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); const err=[];
  page.on("pageerror",e=>err.push("PAGEERROR "+e.message)); page.on("console",m=>{if(m.type()==="error"&&!/404/.test(m.text()))err.push(m.text())});
  await page.goto("http://localhost:8991/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Marruecos"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(500);
  for (const t of ["salida","ingreso","stock","hist"]) { await page.click(`#tabs [data-t='${t}']`).catch(()=>{}); await page.waitForTimeout(300) }
  await page.click("#tabs [data-t='salida']"); await page.waitForTimeout(400);
  console.log("antes de recargar, errores:", err);
  await page.reload(); await page.waitForTimeout(2500);
  console.log("tras recargar: header?", !!(await page.$("header")), "| #app texto:", (await page.innerText("body")).replace(/\s+/g," ").slice(0,120));
  console.log("errores:", err);
  await b.close();
})().catch(e=>{console.error("ERROR",e.message);process.exit(1)});
