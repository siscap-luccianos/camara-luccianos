// Servidor: transferencia enviada (salida) de cualquier rubro y recibida (ingreso) con kilos y pesos.
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"L comun",venta_dia:"SI",operaciones:"NO",escaner_salida:"SI"},{nombre:"L sinvd",operaciones:"NO"},{nombre:"L kilos",venta_dia:"SI",kilos_reales:"SI",operaciones:"NO"}];
const sabores=[{id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas"},{id:"60",nombre:"Frutilla Icepop",tipo:"i",familia:"icepops"},{id:"117",nombre:"Alfajor",tipo:"c",familia:"chocolateria",categoria:"Alfajores"}];
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:[];
sb._puedeVerLocal=()=>true; sb._errorPaisItems=()=>null;
sb._escribirCrudo=()=>({id:"1"}); sb._invalidarCacheDatos=()=>{}; sb._leerUltimasFilas=()=>[]; sb._auditar=()=>{};
sb._datosSinCache=()=>({stock:{base:{"4":10,"60":30,"117":12},ts:1},registros:[],sabores});
const emp={id:"1",nombre:"Gabi",rol:"admin"}, col={id:"2",nombre:"Colab",rol:"colaborador"}; sb.emp=emp; sb.col=col;
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
let r=run(`registrar("t1","salida","L comun",{"4":2},"",emp,"","transferencia","Transferencia a Obelisco",{}, {}, {"4":[3.6,3.7]})`); ok(r.ok,"salida por transferencia de helado (vasquetas) pasa: "+JSON.stringify(r));
r=run(`registrar("t2","salida","L comun",{"60":5},"",emp,"","transferencia","Transferencia a Obelisco")`); ok(r.ok,"salida por transferencia de Icepops pasa: "+JSON.stringify(r));
r=run(`registrar("t3","salida","L comun",{"4":1},"",emp,"","transferencia","",{}, {}, {"4":[3.6]})`); ok(!r.ok&&/destino/i.test(r.error),"sin destino se rechaza: "+r.error);
r=run(`registrar("t4","salida","L comun",{"4":1},"",col,"","transferencia","Transferencia a X")`); ok(!r.ok&&/responsable/i.test(r.error),"colaborador no puede: "+r.error);
r=run(`registrar("t5","salida","L sinvd",{"4":1},"",emp,"","transferencia","Transferencia a X")`); ok(!r.ok,"local sin transferencias activadas: "+r.error);
r=run(`registrar("t6","salida","L comun",{"4":1,"117":1},"",emp,"","baja","Baja por vencimiento")`); ok(!r.ok&&/solo de chocolater/i.test(r.error),"una baja sigue siendo solo de chocolatería: "+r.error);
r=run(`registrar("t7","salida","L comun",{"117":2},"",emp,"","transferencia","Transferencia a X")`); ok(r.ok,"transferencia de chocolatería sigue andando: "+JSON.stringify(r));
r=run(`registrar("t8","salida","L comun",{"4":50},"",emp,"","transferencia","Transferencia a X")`); ok(!r.ok&&/stock/i.test(r.error),"no deja sacar de más: "+r.error);
// kilos reales
r=run(`registrar("k1","salida","L kilos",{"4":2},"",emp,"","transferencia","Transferencia a X")`); ok(!r.ok&&/pesar/i.test(r.error),"kilos reales: la transferencia enviada de vasquetas exige pesar cada una: "+r.error);
r=run(`registrar("k2","salida","L kilos",{"4":2},"",emp,"","transferencia","Transferencia a X",{}, {}, {"4":[3.6,3.7]})`); ok(r.ok,"kilos reales: con los pesos pasa: "+JSON.stringify(r));
r=run(`registrar("k3","ingreso","L kilos",{"4":2},"",emp,"","transferencia","Transferencia de Galerías")`); ok(!r.ok&&/kilos/i.test(r.error),"kilos reales: la transferencia recibida de vasquetas exige kilos: "+r.error);
r=run(`registrar("k4","ingreso","L kilos",{"4":2},"",emp,"","transferencia","Transferencia de Galerías",{"4":7.3},{}, {"4":[3.6,3.7]})`); ok(r.ok,"kilos reales: recibida con kilos y pesos del lector pasa: "+JSON.stringify(r));
r=run(`registrar("k5","ingreso","L comun",{"4":2},"",emp,"","transferencia","Transferencia de Galerías",{}, {}, {"4":[3.6,3.7]})`); ok(r.ok,"recibida con pesos del lector (local con escáner) pasa: "+JSON.stringify(r));
r=run(`registrar("k6","ingreso","L sinvd",{"4":2},"",emp,"","transferencia","Transferencia de G",{}, {}, {"4":[3.6,3.7]})`); ok(!r.ok,"recibida en local sin transferencias: "+r.error);
console.log(f?"FALLAS "+f:"FALLAS 0");
process.exit(f?1:0);
