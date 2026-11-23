// Servidor 1.121.0: informeAlertas (solo admin, solo lectura, desde la hoja «Alertas»).
const vm=require("vm"),fs=require("fs");
const H=["id","ts","jornada","local","severidad","regla","titulo","detalle","sugerencia","estado","clave"];
let T=[H.slice(),
 ["1","1795431600000","22/11/2026","Obelisco CABA","informativo","5 Local silencioso","Sin conteo","d","s","pendiente","k1"],
 ["3","1795440000000","22/11/2026","Santa Rosa","URGENTE","1 Stock negativo","Frutilla -1","d","s","corregida","k3"],
 ["","","","","","","","","","",""],
 ["4","1795440000000","22/11/2026","Dot CABA","revisar","4 Remito repetido","Mismo remito","d","s","","k4"]];
let hojaExiste=true, escrituras=0;
const sh={getDataRange:()=>({getValues:()=>T.map(r=>r.slice())}),getLastRow:()=>T.length,getLastColumn:()=>H.length,
 getRange:()=>({getValues:()=>T.map(r=>r.slice()),setValue(){escrituras++},setValues(){escrituras++}})};
const sb={console,Date,Math,JSON,String,Number,Array,Object,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){},getActiveSpreadsheet:()=>({getSheetByName:n=>n==="Alertas"&&hojaExiste?sh:null})},
 LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
sb._filasComoObjetos=()=>T.slice(1).map(r=>{const o={};H.forEach((k,i)=>o[k]=r[i]);return o});
sb.admin={id:"1",nombre:"Gabi",rol:"admin"}; sb.sup={id:"2",nombre:"Fabri",rol:"supervisor"}; sb.enc={id:"3",nombre:"Ana",rol:"encargado",local:"X"};
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
let r=run("informeAlertas(admin)");
ok(r.ok&&r.alertas.length===3&&r.alertas[0].id===4&&r.alertas[2].id===1,"el admin recibe las alertas, las más nuevas primero, sin filas vacías");
ok(r.alertas.find(a=>a.id===3).severidad==="urgente"&&r.alertas.find(a=>a.id===3).estado==="corregida","severidad en minúscula y estado corregida");
ok(r.alertas.find(a=>a.id===4).estado==="pendiente","estado vacío = pendiente");
ok(!run("informeAlertas(sup)").ok&&!run("informeAlertas(enc)").ok,"supervisor y responsable no pueden");
ok(escrituras===0,"es solo lectura: no escribe nada");
hojaExiste=false; r=run("informeAlertas(admin)");
ok(r.ok&&r.alertas.length===0&&r.sinHoja===true,"sin la hoja «Alertas» devuelve lista vacía, no error");
ok(/^1\.12[1-9]|^1\.1[3-9]/.test(r.backend),"informa la versión del servidor: "+r.backend);
console.log(f?"FALLAS "+f:"FALLAS 0"); process.exit(f?1:0);
