// Modo libre (sin señal): un responsable manda lo cargado a nombre de quien lo cargó, con su hora real.
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"Obelisco CABA",operaciones:"NO"},{nombre:"Otro local",operaciones:"NO"}];
const sabores=[{id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops"}];
const empleados={"7":{id:"7",nombre:"Lucía Benítez",rol:"colaborador",local:"Obelisco CABA",activo:"SI"},"8":{id:"8",nombre:"Otra Persona",rol:"colaborador",local:"Otro local",activo:"SI"}};
let escritos=[], audit=[];
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:[];
sb._puedeVerLocal=()=>true; sb._errorPaisItems=()=>null;
sb._escribirCrudo=(h,o)=>{escritos.push(o);return {id:"1"}}; sb._invalidarCacheDatos=()=>{};
sb._empleadoPorId=id=>empleados[String(id)]||null;
sb._leerUltimasFilas=()=>[]; sb._auditar=(a,id,n,d)=>{audit.push(a+"|"+d)};
sb._datosSinCache=()=>({stock:{base:{"49":50},ts:1},registros:[],sabores:sabores});
const enc={id:"2",nombre:"Sofía Ramirez",rol:"encargado",local:"Obelisco CABA"}, col={id:"3",nombre:"Colab",rol:"colaborador",local:"Obelisco CABA"}; sb.enc=enc; sb.col=col;
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
let r;
const hace=Date.now()-5*36e5; sb.hace=hace;
r=run(`registrar("m1","salida","Obelisco CABA",{"49":3},"",enc,"","",undefined,{},{},{},undefined,"7",{ts:hace})`);
ok(r.ok,"un responsable manda un movimiento de modo libre a nombre de quien lo cargó: "+JSON.stringify(r));
const w=escritos[escritos.length-1];
ok(w.empleadoId==="7"&&w.empleado==="Lucía Benítez","queda a nombre de quien lo cargó");
ok(/modo libre/.test(w.cargado_por)&&/Sofía Ramirez/.test(w.cargado_por),"«cargado_por» dice el responsable y «modo libre»: "+w.cargado_por);
ok(Math.abs(w.ts-hace)<1000,"guarda la hora real en que se cargó (no la del envío)");
ok(audit.some(a=>/^modo_libre_movimiento/.test(a)),"queda en Auditoría");
r=run(`registrar("m2","salida","Obelisco CABA",{"49":1},"",col,"","",undefined,{},{},{},undefined,"7",{ts:hace})`);
ok(!r.ok&&/responsable/.test(r.error),"un colaborador no puede mandar movimientos de modo libre: "+r.error);
r=run(`registrar("m3","salida","Obelisco CABA",{"49":1},"",enc,"","",undefined,{},{},{},undefined,"8",{ts:hace})`);
ok(!r.ok&&/no es de este local/.test(r.error),"quien cargó tiene que ser del local: "+r.error);
r=run(`registrar("m4","salida","Obelisco CABA",{"49":1},"",enc,"","",undefined,{},{},{},undefined,"",{ts:hace})`);
ok(!r.ok&&/Falta quién cargó/.test(r.error),"falta quién cargó: "+r.error);
r=run(`registrar("m5","salida","Obelisco CABA",{"49":1},"",enc,"","",undefined,{},{},{},undefined,"7",{ts:Date.now()-200*36e5})`);
ok(r.ok&&Math.abs(escritos[escritos.length-1].ts-Date.now())<5000,"una hora de hace más de 72 hs se ignora (queda la del envío)");
// ingreso y devolución también
r=run(`registrar("m6","ingreso","Obelisco CABA",{"49":2},"R1",enc,"","",undefined,{},{},{},undefined,"7",{ts:hace})`); ok(r.ok,"un ingreso en modo libre pasa: "+JSON.stringify(r));
r=run(`registrar("m7","salida","Obelisco CABA",{"49":5},"",enc,"","desperdicio","se cayó",{},{},{},undefined,"7",{ts:hace})`); ok(r.ok,"un desperdicio en modo libre pasa: "+JSON.stringify(r));
console.log(f?"FALLAS "+f:"TODO OK"); process.exit(f?1:0);
