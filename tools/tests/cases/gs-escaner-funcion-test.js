// Servidor: el escáner por función (Locales.escaner_salida / escaner_conteo) es independiente de los kilos.
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"L salida",escaner_salida:"SI",operaciones:"NO"},{nombre:"L conteo",escaner_conteo:"SI",operaciones:"NO"},{nombre:"L nada",operaciones:"NO"},{nombre:"L piloto",escaner_peso:"SI",operaciones:"NO"}];
const sabores=[{id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas"}];
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:[];
sb._puedeVerLocal=()=>true; sb._errorPaisItems=()=>null;
sb._escribirCrudo=()=>({id:"1"}); sb._invalidarCacheDatos=()=>{}; sb._leerUltimasFilas=()=>[]; sb._auditar=()=>{};
sb._datosSinCache=()=>({stock:{base:{"4":10},ts:1},registros:[],sabores});
const emp={id:"1",nombre:"Gabi",rol:"admin"}; sb.emp=emp;
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
const sal=l=>run(`registrar("c-${l}","salida","${l}",{"4":1},"",emp,"","",undefined,{},{},{"4":[3.6]})`);
let r=sal("L salida"); ok(r.ok,"escaner_salida: una salida con el peso del rótulo pasa: "+JSON.stringify(r));
r=sal("L conteo"); ok(!r.ok&&/escáner/.test(r.error),"solo escaner_conteo: NO acepta pesos en una salida: "+r.error);
r=sal("L nada"); ok(!r.ok,"sin escáner: rechaza pesos");
r=sal("L piloto"); ok(r.ok,"escaner_peso (piloto) sigue aceptando pesos: "+JSON.stringify(r));
r=run(`registrar("c-sin","salida","L conteo",{"4":1},"",emp,"","",undefined,{},{},{})`); ok(r.ok,"solo escaner_conteo: una salida común (sin pesos) sigue andando: "+JSON.stringify(r));
console.log(f?"FALLAS "+f:"FALLAS 0");
process.exit(f?1:0);
