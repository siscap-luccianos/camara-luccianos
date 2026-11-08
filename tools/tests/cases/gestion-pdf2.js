const { chromium } = require("playwright");
const { execSync } = require("child_process");
(async () => {
  const b = await chromium.launch();
  for (const fmt of ["A4"]) for (const n of [16,20]) {
    const page = await (await b.newContext({ viewport: { width: 1000, height: 900 } })).newPage();
    await page.goto("http://localhost:8997/"); await page.waitForSelector("#authLocal");
    await page.fill("#authLocal","Operaciones"); await page.click("#authLocalOk");
    await page.fill("#authClave","op2024"); await page.click("#authClaveOk");
    await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if(await page.waitForSelector("[data-tecla]",{timeout:900}).catch(()=>null)){ for(const d of "1234") await page.click('[data-tecla="'+d+'"]') }
    await page.waitForSelector("header"); await page.waitForTimeout(250);
    await page.fill("#local","Local prueba"); await page.press("#local","Enter"); await page.waitForTimeout(700);
    await page.click("#tabs [data-t='gestion']"); await page.waitForSelector(".gvTbl tbody tr",{timeout:15000}); await page.waitForTimeout(300);
    await page.evaluate((n)=>{ const tb=document.querySelector(".gvTbl tbody"); const tr=tb.rows[1]; while(tb.rows.length<n) tb.appendChild(tr.cloneNode(true));
      const p=document.createElement("p"); p.className="note gvAviso"; p.textContent="1 producto con stock no tiene precio de lista y no entra en el valor."; document.querySelector(".gvTbl").after(p); },n);
    await page.pdf({path:"g2.pdf",format:fmt,printBackground:true,preferCSSPageSize:true});
    const info=execSync("pdfinfo g2.pdf").toString(); execSync("cp g2.pdf g2-"+n+".pdf");console.log(fmt,"filas",n,"páginas",(info.match(/Pages:\s+(\d+)/)||[])[1]);
    await page.close();
  }
  await b.close();
})();
