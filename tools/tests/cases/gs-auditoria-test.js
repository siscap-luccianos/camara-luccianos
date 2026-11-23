// Servidor 1.122.0: auditoriaDatos (problemas del período y de los locales elegidos), auditoriaDecidir y auditoriaDecisiones.
const vm=require("vm"),fs=require("fs"),path=require("path");
const AR=3*3600000;
const ts=(d,h,m)=>Date.UTC(2026,10,d,h+3,m||0); // hora Argentina
const R=(id,tipo,local,t,items,extra)=>Object.assign({id:String(id),tipo,local,ts:String(t),items:JSON.stringify(items),anulado_por:"",subtipo:"",vencimientos:""},extra||{});
const reg=[
 R(1,"conteo","Local A",ts(20,10,0),{1:5}),R(2,"conteo","Local A",ts(20,10,10),{1:6}),R(3,"conteo","Local A",ts(20,10,20),{1:7}),
 R(4,"ingreso","Local B",ts(19,12),{1:799}),
 R(5,"ingreso","Local X",ts(10,12),{1:30}),R(6,"ingreso","Local X",ts(11,12),{1:28}),R(7,"salida","Local X",ts(12,12),{1:32}),
 R(8,"conteo","Local C",ts(17,9),{2:50,3:5}),R(9,"conteo","Local C",ts(21,9),{3:5}),
 R(10,"ingreso","Local D",ts(16,12),{3:5}),
 R(11,"ingreso","Local E",ts(18,12),{3:5},{vencimientos:'{"3":"0002-01-03"}'}),
 R(12,"ingreso","Local G",ts(18,12),{4:2500}),
 R(13,"conteo","Operaciones",ts(20,10),{1:1}),R(14,"conteo","Operaciones",ts(20,10,5),{1:1}),R(15,"conteo","Operaciones",ts(20,10,9),{1:1}),
 R(16,"salida","Local A",ts(17,11),{1:1}),R(17,"salida","Local A",ts(18,11),{1:1}),R(18,"salida","Local A",ts(19,11),{1:1}),R(19,"salida","Local A",ts(21,11),{1:1})
];
const sab=[{id:"1",nombre:"Frutilla",tipo:"i",familia:"icepops"},{id:"2",nombre:"Dulce",tipo:"v",familia:"vasquetas"},{id:"3",nombre:"Alfajor",tipo:"c",familia:"chocolateria"},{id:"4",nombre:"Geladot Frutilla",tipo:"g",familia:"icepops"}];
const dec=[["id","ts","clave","problema","opcion","titulo","nota","por","desde","hasta"]]; let filas=[];
const hojaDec={getLastRow:()=>dec.length+filas.length,appendRow:r=>{filas.push(r)},getRange:()=>{const o={setValues(){return o},setFontWeight(){return o},setBackground(){return o},setFontColor(){return o}};return o},setFrozenRows(){}};
const sb={console,Date,Math,JSON,String,Number,Array,Object,RegExp,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){},removeAll(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){},getActiveSpreadsheet:()=>({getSheetByName:n=>n==="Decisiones"&&filas.length?hojaDec:null,insertSheet:()=>hojaDec})},
 LockService:{getScriptLock:()=>({waitLock(){},tryLock(){},releaseLock(){}})},
 Utilities:{formatDate:(d,tz,f)=>{const x=new Date(d.getTime()-AR),p=n=>String(n).padStart(2,"0");return f==="yyyy-MM-dd"?x.getUTCFullYear()+"-"+p(x.getUTCMonth()+1)+"-"+p(x.getUTCDate()):p(x.getUTCDate())+"/"+p(x.getUTCMonth()+1)+" "+p(x.getUTCHours())+":"+p(x.getUTCMinutes())}}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
sb._leerCrudo=h=>h==="Sabores"?sab.map(x=>Object.assign({},x)):h==="Registros"?reg.map(x=>Object.assign({},x)):[];
sb._filasComoObjetos=()=>filas.map(r=>{const o={};dec[0].forEach((k,i)=>o[k]=r[i]);return o});
sb._auditar=()=>{};
sb.admin={id:"1",nombre:"Gabi",rol:"admin"}; sb.sup={id:"2",nombre:"Fabri",rol:"supervisor"};
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
sb.p1={desde:"2026-11-16",hasta:"2026-11-22",locales:[]};
let r=run("auditoriaDatos(p1,admin)"); const por=k=>(r.problemas||[]).find(x=>x.clave===k);
ok(r.ok,"responde ok: "+(r.error||""));
ok(por("rafaga")&&por("rafaga").locales[0].local==="Local A"&&/3 conteos/.test(por("rafaga").locales[0].detalle[0]),"detecta 3 conteos seguidos en Local A");
ok(por("unidades")&&por("unidades").locales[0].local==="Local B","detecta 799 donde lo normal es ~30 (Local B)");
ok(!(por("unidades")&&por("unidades").locales.some(l=>l.local==="Local G")),"Geladot en 2.500 g no es un error");
ok(por("pisados")&&por("pisados").locales[0].local==="Local C"&&/vasquetas/.test(por("pisados").locales[0].detalle[0]),"detecta el rubro vasquetas que pasó de 50 a 0 (Local C)");
ok(por("sinsalidas")&&por("sinsalidas").locales.some(l=>l.local==="Local D"),"detecta jornadas seguidas sin salidas (Local D)");
ok(por("datos")&&por("datos").locales[0].local==="Local E"&&/0002/.test(por("datos").locales[0].detalle[0]),"detecta el vencimiento con año 0002 (Local E)");
ok(!(r.problemas||[]).some(p=>p.locales.some(l=>l.local==="Operaciones")),"ignora Operaciones");
r=run('auditoriaDatos({desde:"2026-11-16",hasta:"2026-11-22",locales:["Local A"]},admin)');
ok(r.ok&&r.problemas.length===1&&r.problemas[0].clave==="rafaga","con un solo local elegido solo ve los problemas de ese local");
r=run('auditoriaDatos({desde:"2026-11-21",hasta:"2026-11-22",locales:[]},admin)');
ok(r.ok&&!r.problemas.some(p=>p.clave==="rafaga"),"con otro período no aparece lo de otra fecha");
ok(!run("auditoriaDatos(p1,sup)").ok,"el supervisor no puede");
ok(!run('auditoriaDatos({desde:"2026-01-01",hasta:"2026-11-22"},admin)').ok,"más de 60 días se rechaza");
ok(run('auditoriaDecisiones(admin)').decisiones.length===0,"sin la hoja Decisiones devuelve lista vacía");
ok(run('auditoriaDecidir("rafaga","Conteos en ráfaga","A","Un solo conteo por jornada","","2026-11-16","2026-11-22",admin)').ok,"el admin guarda una decisión");
ok(!run('auditoriaDecidir("rafaga","x","A","t","","","",sup)').ok,"el supervisor no puede decidir");
ok(!run('auditoriaDecidir("MAL!","x","A","t","","","",admin)').ok,"rechaza una clave inválida");
run('auditoriaDecidir("rafaga","Conteos en ráfaga","B","Guía y aviso","","2026-11-16","2026-11-22",admin)');
const d=run("auditoriaDecisiones(admin)").decisiones;
ok(d.length===1&&d[0].opcion==="B"&&d[0].titulo==="Guía y aviso","queda la última decisión por problema");
console.log(f?"FALLAS "+f:"FALLAS 0"); process.exit(f?1:0);
