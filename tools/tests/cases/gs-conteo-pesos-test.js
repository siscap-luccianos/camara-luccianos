// Code.gs 1.80.0: conteo() y conteoParcial() guardan el peso de cada vasqueta/caja escaneada (solo para mostrar en Movimientos).
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"Torreon Mar del Plata",kilos_reales:"SI",operaciones:"NO"}];
const sabores=[{id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas"},{id:"5",nombre:"Cheesecake",tipo:"v",familia:"vasquetas"}];
let escritos=[];
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:[];
sb._puedeVerLocal=()=>true;
sb._escribirCrudo=(h,o)=>{escritos.push(o);return {id:String(escritos.length)}}; sb._invalidarCacheDatos=()=>{};
sb._datosSinCache=()=>({stock:{base:{},ts:1},registros:[],sabores});
sb._leerUltimasFilas=()=>[]; sb._auditar=()=>{};
sb._sheet=()=>({getDataRange:()=>({getValues:()=>[["local","base","ts","empleado"]]}),getLastRow:()=>1,getRange:()=>({})}); sb._escribirCeldaSinAdivinar=()=>{};
const run=c=>vm.runInContext(c,sb); sb.emp={id:"1",nombre:"Lourdes",rol:"encargado"};
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
let r, w;
// completo: 4 = 1 vasqueta suelta + 2 cajas = 5; 5 sin pesos (a mano)
r=run(`conteo("c1","Torreon Mar del Plata",{"4":5,"5":3},emp,{},{"4":20.3,"5":11.4},{"4":[4.1,"c:8.1","c:8.1"]})`);
w=escritos[escritos.length-1];
ok(r.ok&&w.tipo==="conteo", "conteo completo con pesos pasa: "+JSON.stringify(r));
ok(JSON.parse(w.pesos)["4"].length===3 && JSON.parse(w.pesos)["4"][1]==="c:8.1", "guarda cada peso (vasqueta suelta y caja)");
ok(!("5" in JSON.parse(w.pesos)), "un sabor contado a mano no lleva pesos");
// más vasquetas pesadas que contadas: se descartan (el conteo igual se guarda)
r=run(`conteo("c2","Torreon Mar del Plata",{"4":2,"5":3},emp,{},{"4":8,"5":11.4},{"4":[4,4,4]})`);
w=escritos[escritos.length-1];
ok(r.ok && !w.pesos, "pesos que no cierran con lo contado se descartan sin trabar el conteo");
// peso inválido
r=run(`conteo("c3","Torreon Mar del Plata",{"4":1,"5":3},emp,{},{"4":99,"5":11.4},{"4":[99]})`);
w=escritos[escritos.length-1];
ok(r.ok && !w.pesos, "un peso fuera de rango se descarta");
// sin pesos (cliente viejo): igual que antes
r=run(`conteo("c4","Torreon Mar del Plata",{"4":2,"5":3},emp,{},{"4":8,"5":11.4})`);
w=escritos[escritos.length-1];
ok(r.ok && !w.pesos, "sin pesos (cliente viejo) se guarda igual que antes");
// parcial: solo guarda pesos de sabores que cambian
r=run(`conteoParcial("p1","Torreon Mar del Plata","vasquetas",{"4":4,"5":3},emp,{"4":19.53,"5":11.4},{"4":19.53,"5":11.4},{"4":[4.88,"c:9.77",4.88],"5":[3.8,3.8,3.8]})`);
w=escritos[escritos.length-1];
ok(r.ok&&w.subtipo==="conteo_parcial", "conteo parcial con pesos pasa: "+JSON.stringify(r));
ok(JSON.parse(w.pesos)["4"].length===3, "parcial guarda los pesos de Banana Split");
console.log(f?"FALLAS "+f:"FALLAS 0"); process.exit(f?1:0);
