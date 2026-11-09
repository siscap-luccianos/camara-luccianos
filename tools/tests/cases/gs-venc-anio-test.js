// Vencimiento con año a medias («0002»): el servidor lo rechaza en ingreso/conteo/etiquetado y no toca las salidas de lotes ya existentes.
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,isFinite,parseFloat,Utilities:{},LockService:{},SpreadsheetApp:{},CacheService:{},PropertiesService:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const run=c=>vm.runInContext(c,sb); let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
const anio=new Date().getFullYear();
ok(run('_anioVencOk("'+anio+'-05-10")')===true,"el año actual es válido");
ok(run('_anioVencOk("'+(anio+3)+'-05-10")')===true,"dentro de 3 años es válido");
ok(run('_anioVencOk("0002-05-10")')===false,"0002 no es válido");
ok(run('_anioVencOk("0026-05-10")')===false,"0026 no es válido");
ok(run('_anioVencOk("1999-05-10")')===false,"1999 no es válido");
ok(run('_anioVencOk("'+(anio+40)+'-05-10")')===false,"dentro de 40 años no es válido");
let r=run('_normalizarVencimientos({"117":"0002-05-10"},{"117":5},"ingreso")'); ok(!r.ok&&/0002/.test(r.error),"ingreso con fecha suelta 0002: rechazado ("+(r.error||"")+")");
r=run('_normalizarVencimientos({"117":[{f:"0026-05-10",c:5}]},{"117":5},"conteo")'); ok(!r.ok&&/0026/.test(r.error),"conteo con lote 0026: rechazado");
r=run('_normalizarVencimientos({"117":[{f:"0002-05-10",c:5}]},{"117":5},"etiquetado")'); ok(!r.ok,"etiquetado con 0002: rechazado");
r=run('_normalizarVencimientos({"117":[{f:"'+anio+'-12-31",c:3},{f:"",c:2}]},{"117":5},"ingreso")'); ok(r.ok&&r.vencimientos["117"].length===2,"fecha buena + lote sin fecha: pasa");
r=run('_normalizarVencimientos({"117":"0002-05-10"},{"117":5},"salida")'); ok(r.ok&&r.vencimientos["117"]==="0002-05-10","salida del lote ya existente con fecha mala: se deja salir (no se traba la cámara)");
console.log(f?"\n"+f+" FALLAS":"\nTODO OK"); process.exit(f?1:0);
