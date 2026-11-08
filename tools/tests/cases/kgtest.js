const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8993/index.html');await p.waitForTimeout(800);
const r=await p.evaluate(()=>{S.saboresPorId={"1":{id:1,tipo:"k"},"2":{id:2,tipo:"v"}};S.escanerPeso=true;return [unidad("1",1),unidad("1",16),unidad("2",2),esPesable("1"),TIPO_LABEL.k]});
console.log(JSON.stringify(r),'errores:',errs.length?errs:'ninguno');await b.close()})();
