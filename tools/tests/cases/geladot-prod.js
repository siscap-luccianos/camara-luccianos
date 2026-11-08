const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext()).newPage(); const err=[]; page.on("pageerror",e=>err.push(e.message));
  await page.goto("http://localhost:8997/"); await page.waitForSelector("#authLocal");
  const r=await page.evaluate(()=>{ S.sabores=[{id:"1",nombre:"Frutilla",tipo:"i",categoria:"Fruta",familia:"icepops"},{id:"194",nombre:"Frutilla",tipo:"m",categoria:"Geladot",familia:"icepops"}]; S.saboresExcluidos=[]; S.saboresFuera=[]; S.produccionRubros=[]; S.produccionSabores=[];
    const a=saboresProduccion().map(s=>s.id); S.produccionSabores=["1","194"]; const c=saboresProduccion().map(s=>s.id); return {sinLista:a,conLista:c}; });
  console.log(JSON.stringify(r), r.sinLista.join()==="1"&&r.conLista.join()==="1"?"OK   Geladot no está en Producción":"FALLA", "errores:",JSON.stringify(err)); await b.close(); })();
