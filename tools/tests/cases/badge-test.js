const { chromium } = require("playwright");
(async()=>{
  const b=await chromium.launch(); const page=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
  const err=[]; page.on("pageerror",e=>err.push(e.message)); page.on("console",m=>{if(m.type()==="error"&&!/ERR_|404/.test(m.text())) err.push(m.text())});
  await page.goto("http://localhost:8996/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(900);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(500);
  const r=await page.$$eval(".row .badge",els=>els.map(e=>{const b=e.getBoundingClientRect(); const lh=parseFloat(getComputedStyle(e).lineHeight)||b.height; return {t:e.textContent,w:Math.round(b.width),h:Math.round(b.height),ws:getComputedStyle(e).whiteSpace}}));
  console.log(JSON.stringify(r));
  console.log("una sola línea cada insignia:", r.length>0 && r.every(x=>x.h<26));
  const el=await page.$(".row .badge"); if(el){ await el.scrollIntoViewIfNeeded(); const row=await el.evaluateHandle(e=>e.closest(".row")); await row.asElement().screenshot({path:"badge-fila.png"}); }
  console.log("errores:",err.length?err.join("|"):"ninguno"); await b.close();
})();
