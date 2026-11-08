// Code.gs: conteoParcial() — deja el stock de UN rubro en lo contado sin tocar lo demás.
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"Local prueba",kilos_reales:"SI",operaciones:"NO"},{nombre:"Obelisco CABA",operaciones:"NO"},{nombre:"Sin choco",operaciones:"NO",lleva_chocolateria:"NO"}];
const sabores=[
 {id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas"},
 {id:"5",nombre:"Cheesecake",tipo:"v",familia:"vasquetas"},
 {id:"110",nombre:"Dulce granizado",tipo:"b",familia:"vasquetas"},
 {id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops"},
 {id:"117",nombre:"Alfajor",tipo:"c",familia:"chocolateria"}];
let escritos=[], audit=[], regs=[];
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:[];
sb._puedeVerLocal=()=>true;
sb._escribirCrudo=(h,o)=>{escritos.push(o);return {id:String(escritos.length)}}; sb._invalidarCacheDatos=()=>{};
// stock del sistema: 4=10, 5=3, 110=4, 49=9, 117=6 ; después del conteo se vendieron 2 de Banana Split (queda 8)
sb._datosSinCache=()=>({stock:{base:{"4":10,"5":3,"110":4,"49":9,"117":6},ts:1},registros:regs,sabores});
sb._leerUltimasFilas=()=>[]; sb._auditar=(...a)=>audit.push(a);
regs=[{id:"9",tipo:"salida",subtipo:"",local:"Local prueba",items:{"4":2},ts:5,anulado:false}];
const run=c=>vm.runInContext(c,sb);
const E=(rol)=>{ sb.emp={id:"1",nombre:"Lucía",rol}; };
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
let r;
E("encargado");
// Vasquetas con kilos reales: el cliente manda los kilos totales y la diferencia
r=run(`conteoParcial("p1","Local prueba","vasquetas",{"4":12,"5":3},emp,{"4":44,"5":11.4},{"4":8.2,"5":0})`);
ok(r.ok, "conteo parcial de vasquetas pasa: "+JSON.stringify(r));
const w=escritos[escritos.length-1];
ok(w.tipo==="cambio"&&w.subtipo==="conteo_parcial", "se guarda como movimiento «cambio» con subtipo conteo_parcial");
const it=JSON.parse(w.items);
ok(it["4"]===4, "Banana Split: contó 12 y el sistema tenía 8 → +4 (no 12−10): "+JSON.stringify(it));
ok(!("5" in it), "Cheesecake: contó 3 y había 3 → sin cambio, no se registra");
ok(!("49" in it)&&!("117" in it)&&!("110" in it), "no toca Icepops, chocolatería ni baldes");
ok(JSON.parse(w.kilos)["4"]===8.2, "guarda la diferencia de kilos");
ok(w.total===4&&/Conteo parcial/.test(w.motivo), "total = suma de diferencias y motivo");
ok(audit.some(a=>a[0]==="conteo_parcial"), "audita");
// sin cambios
const antes=escritos.length;
r=run(`conteoParcial("p2","Local prueba","icepops",{"49":9},emp,{},{})`);
ok(r.ok&&r.sinCambios&&escritos.length===antes, "si lo contado coincide con el sistema no escribe nada");
// un sabor de otro rubro dentro de items se ignora
r=run(`conteoParcial("p3","Local prueba","icepops",{"49":5,"4":99,"117":99},emp,{},{})`);
const w3=escritos[escritos.length-1], it3=JSON.parse(w3.items);
ok(r.ok&&it3["49"]===-4&&!("4" in it3)&&!("117" in it3), "ignora sabores de otro rubro: "+JSON.stringify(it3));
// poner en 0
r=run(`conteoParcial("p4","Obelisco CABA","chocolateria",{"117":0},emp,{},{})`);
ok(r.ok&&JSON.parse(escritos[escritos.length-1].items)["117"]===-6, "contar 0 resta todo lo que había");
// validaciones
r=run(`conteoParcial("p5","Local prueba","vasquetas",{"4":12},emp,{},{})`);
ok(!r.ok&&/Faltan los kilos totales de: Banana Split/.test(r.error), "con kilos reales faltan los kilos: "+r.error);
r=run(`conteoParcial("p6","Obelisco CABA","vasquetas",{"4":-1},emp,{},{})`);
ok(!r.ok&&/enteros/.test(r.error), "no acepta negativos");
r=run(`conteoParcial("p7","Obelisco CABA","vasquetas",{"4":1.5},emp,{},{})`);
ok(!r.ok&&/enteros/.test(r.error), "no acepta decimales");
r=run(`conteoParcial("p8","Obelisco CABA","helados",{"4":1},emp,{},{})`);
ok(!r.ok&&/rubro/.test(r.error), "rechaza un rubro que no existe");
r=run(`conteoParcial("p9","Sin choco","chocolateria",{"117":1},emp,{},{})`);
ok(!r.ok&&/no lleva ese rubro/.test(r.error), "rechaza un rubro apagado en ese local: "+r.error);
E("colaborador");
r=run(`conteoParcial("p10","Obelisco CABA","vasquetas",{"4":1},emp,{},{})`);
ok(!r.ok&&/permiso/.test(r.error), "el colaborador no puede");
// idempotencia
E("encargado");
sb._leerUltimasFilas=()=>[{clienteId:"dup",id:"77"}];
r=run(`conteoParcial("dup","Obelisco CABA","vasquetas",{"4":1},emp,{},{})`);
ok(r.ok&&r.repetido, "el mismo clienteId no se guarda dos veces");
console.log(f?"FALLAS "+f:"TODO OK"); process.exit(f?1:0);
