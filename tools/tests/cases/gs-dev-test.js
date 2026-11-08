const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"Local prueba",kilos_reales:"SI",operaciones:"NO"},{nombre:"Obelisco CABA",operaciones:"NO"}];
const sabores=[{id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas"},{id:"107",nombre:"Granella",tipo:"k",familia:"vasquetas"},{id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops"},{id:"108",nombre:"Choco torta",tipo:"b",familia:"vasquetas"}];
let escritos=[];
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:[];
sb._puedeVerLocal=()=>true; sb._errorPaisItems=()=>null;
sb._escribirCrudo=(h,o)=>{escritos.push(o);return {id:"1"}}; sb._invalidarCacheDatos=()=>{};
sb._datosSinCache=()=>({stock:null,registros:[]});
sb._leerUltimasFilas=()=>[]; sb._auditar=()=>{};
const emp={id:"1",nombre:"Gabi",rol:"admin"}; sb.emp=emp;
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
let r;
r=run(`registrar("c1","ingreso","Local prueba",{"4":4},"R1",emp,"","",undefined,{},{},{})`); ok(!r.ok&&/Faltan los kilos totales de: Banana Split/.test(r.error),"ingreso de vasquetas sin kilos se rechaza: "+r.error);
r=run(`registrar("c2","ingreso","Local prueba",{"4":4},"R1",emp,"","",undefined,{"4":14.57},{},{})`); ok(r.ok,"ingreso con kilos pasa: "+JSON.stringify(r));
ok(escritos.length&&JSON.parse(escritos[escritos.length-1].kilos)["4"]===14.57,"guarda Registros.kilos");
r=run(`registrar("c3","ingreso","Local prueba",{"107":16,"49":30,"108":3},"R2",emp,"","",undefined,{},{},{})`); ok(r.ok,"granella (kilos), icepops y baldes no piden kilos: "+JSON.stringify(r));
r=run(`registrar("c4","ingreso","Obelisco CABA",{"4":4},"R3",emp,"","",undefined,{},{},{})`); ok(r.ok,"local sin kilos_reales no cambia");
r=run(`registrar("c5","salida","Local prueba",{"4":2},"",emp,"","",undefined,{},{},{"4":[3.6]})`); ok(!r.ok&&/Falta pesar cada vasqueta de: Banana Split/.test(r.error),"salida con menos pesos que vasquetas se rechaza: "+r.error);
r=run(`registrar("c6","salida","Local prueba",{"4":1},"",emp,"","",undefined,{},{},{})`); ok(!r.ok&&/Falta pesar/.test(r.error),"salida sin pesos se rechaza");
// la salida válida necesita stock: se simula
sb._datosSinCache=()=>({stock:{base:{"4":10},ts:1},registros:[],sabores:sabores});
r=run(`registrar("c7","salida","Local prueba",{"4":2},"",emp,"","",undefined,{},{},{"4":[3.6,3.9]})`); console.log("   salida válida:",JSON.stringify(r));
r=run(`registrar("d1","ingreso","Local prueba",{"4":1},"",emp,"","devolucion",undefined,{"4":3.6},{},{"4":[3.6]})`); ok(r.ok,"devolución con pesos pasa: "+JSON.stringify(r));
ok(JSON.parse(escritos[escritos.length-1].pesos)["4"][0]===3.6,"guarda Registros.pesos de la devolución");
r=run(`registrar("d2","ingreso","Local prueba",{"4":1},"R9",emp,"","",undefined,{"4":3.6},{},{"4":[3.6]})`); ok(!r.ok,"pesos en un ingreso común se rechazan: "+r.error);
r=run(`registrar("d3","ingreso","Obelisco CABA",{"4":1},"",emp,"","devolucion",undefined,{},{},{"4":[3.6]})`); ok(!r.ok,"local sin escáner/kilos rechaza pesos: "+r.error);
console.log(f?"FALLAS "+f:"TODO OK");
