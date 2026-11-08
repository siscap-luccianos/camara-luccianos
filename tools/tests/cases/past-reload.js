const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const ctx=await b.newContext({ viewport: { width: 390, height: 844 } }); const page=await ctx.newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  await page.goto("http://localhost:8992/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.fill("#local","Obelisco CABA"); await page.press("#local","Enter"); await page.waitForTimeout(800);
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(900);
  console.log("tras recargar, hay header:", !!(await page.$("header")), "| errores:", err.length?err.join(" || "):"ninguno");
  // admin Sabores: familias
  await page.click("#tabs [data-t='sabores']").catch(()=>{}); await page.waitForTimeout(500);
  console.log((await page.innerText("#main")).slice(0,200).replace(/\n/g," | "));
  await b.close();
})();
