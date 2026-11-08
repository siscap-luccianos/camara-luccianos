const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,parseFloat,isFinite,CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) f++};
const AHORA=Date.now(), DIA=864e5;
function montar(){
  sb.T={
    Locales:[{nombre:"SR",activo:"SI"}],
    Sabores:[{id:21,nombre:"Frutilla a la crema",tipo:"v",activo:"SI",familia:"vasquetas",orden:1},{id:5,nombre:"Cheesecake",tipo:"v",activo:"SI",familia:"vasquetas",orden:2}],
    Stock:[{local:"SR",base:JSON.stringify({21:0,5:2}),ts:AHORA-5*DIA}],
    Registros:[
      {id:1,tipo:"ingreso",local:"SR",empleadoId:"e1",empleado:"Ana",items:JSON.stringify({21:10}),ts:AHORA-3*DIA},
      {id:2,tipo:"salida",local:"SR",empleadoId:"e1",empleado:"Ana",items:JSON.stringify({21:8}),ts:AHORA-2*DIA},
      {id:3,tipo:"ingreso",local:"SR",empleadoId:"e1",empleado:"Ana",items:JSON.stringify({5:4}),ts:AHORA-6*DIA}, // anterior al conteo
    ]};
  sb.nextId=100;
  vm.runInContext(`
   _leerCrudo=function(n){return (T[n]||[]).map(r=>Object.assign({},r))};
   _leerUltimasFilas=function(n,k){return T[n].slice(-k).map(r=>Object.assign({},r))};
   _auditar=function(){}; _invalidarCacheDatos=function(){};
   _escribirCrudo=function(n,o){var id=nextId++; T[n].push(Object.assign({id:id},o)); return {ok:true,id:id}};
   _eliminarCrudo=function(n,id){var i=T[n].findIndex(function(r){return String(r.id)===String(id)}); if(i<0) return {ok:false,error:"no"}; T[n].splice(i,1); return {ok:true}};
   _sheet=function(n){ var H=["id","clienteId","tipo","local","empleadoId","empleado","items","total","remito","ts","anulado_por","anulado_ts","motivo","fecha_aaa","foto_remito","subtipo"];
     return {getDataRange:function(){return {getValues:function(){return [H].concat(T[n].map(function(r){return H.map(function(h){return r[h]===undefined?"":r[h]})}))}}},
       getRange:function(row,c){return {setValue:function(v){T[n][row-2][H[c-1]]=v}}}} };
  `,sb);
}
const run=c=>vm.runInContext(c,sb);
const ana={id:"e1",nombre:"Ana",rol:"encargado",local:"SR"}, admin={id:"a1",nombre:"Gabi",rol:"admin",local:""};
sb.ana=ana; sb.admin=admin;

montar();
// stock actual: 21 = 0 + 10 − 8 = 2 ; 5 = 2 (el ingreso 3 es anterior al conteo)
let st=run("_stockActualLocal('SR')"); ok(st[21]===2&&st[5]===2,"stock calculado 21=2, 5=2: "+JSON.stringify(st));
// a) anular el ingreso consumido
let r=run("anular(1,'prueba',admin)"); ok(!r.ok&&/Frutilla a la crema/.test(r.error)&&/negativo/.test(r.error),"anular un ingreso ya consumido se rechaza: "+(r.error||"").slice(0,90));
// b) anular primero la salida, después el ingreso
r=run("anular(2,'prueba',admin)"); ok(r.ok,"anular la salida se puede");
r=run("anular(1,'prueba',admin)"); ok(r.ok,"ahora sí se puede anular el ingreso (stock 10−10=0)");
// c) ingreso anterior al conteo: anular no toca el stock
montar(); r=run("anular(3,'prueba',admin)"); ok(r.ok,"anular un ingreso anterior al último conteo no se bloquea");
// d) salida de más
montar(); sb.it1={21:3}; r=run("registrar('c1','salida','SR',it1,'',ana)"); ok(!r.ok&&/No hay stock suficiente/.test(r.error),"salida de más se rechaza");
sb.it2={21:2}; r=run("registrar('c2','salida','SR',it2,'',ana)"); ok(r.ok,"salida exacta se acepta");
// e) devolución
montar(); sb.s1={21:1}; run("registrar('c3','salida','SR',s1,'',ana)"); // Ana sacó 1 más (ahora hay 1)… además la salida 2 es de Ana (hace 2 días, fuera de 24 hs)
sb.d1={21:2}; r=run("registrar('c4','ingreso','SR',d1,'',ana,'','devolucion')"); ok(!r.ok&&/No podés devolver más/.test(r.error),"devolver más de lo sacado hoy se rechaza: "+(r.error||"").slice(0,80));
sb.d2={21:1}; r=run("registrar('c5','ingreso','SR',d2,'',ana,'','devolucion')"); ok(r.ok,"devolver lo sacado se acepta");
r=run("registrar('c6','ingreso','SR',d2,'',ana,'','devolucion')"); ok(!r.ok,"no se puede devolver dos veces lo mismo");
sb.otro={id:"e2",nombre:"Beto",rol:"colaborador",local:"SR"};
r=run("registrar('c7','ingreso','SR',d2,'',otro,'','devolucion')"); ok(!r.ok,"otra persona no puede devolver lo que sacó Ana");
// f) enteros
montar(); sb.fr={21:2.5}; r=run("registrar('c8','salida','SR',fr,'',ana)"); ok(!r.ok&&/enteros/.test(r.error),"cantidad con decimales se rechaza");
sb.ng={21:-1}; r=run("registrar('c9','ingreso','SR',ng,'',ana)"); ok(!r.ok&&/enteros/.test(r.error),"cantidad negativa se rechaza");
// g) eliminar (admin) un ingreso consumido
montar(); r=run("eliminarRegistro(1,admin)"); ok(!r.ok&&/negativo/.test(r.error),"borrar un ingreso consumido se rechaza: "+(r.error||"").slice(0,70));
r=run("eliminarRegistro(2,admin)"); ok(r.ok,"borrar la salida se puede");
r=run("eliminarRegistro(1,admin)"); ok(r.ok,"y después el ingreso");
// h) ventana: conteo y movimientos viejos (más de 60 días) igual entran al stock
montar(); sb.T.Stock[0].ts=AHORA-100*DIA; sb.T.Registros=[{id:1,tipo:"ingreso",local:"SR",empleadoId:"e1",items:JSON.stringify({21:10}),ts:AHORA-70*DIA},{id:2,tipo:"salida",local:"SR",empleadoId:"e1",items:JSON.stringify({21:4}),ts:AHORA-65*DIA}];
st=run("_stockActualLocal('SR')"); ok(st[21]===6,"conteo de hace 100 días + movimientos de hace 70 y 65: stock 6 (no se pierden por la ventana de 60 días): "+st[21]);
montar(); sb.T.Stock=[]; sb.T.Registros=[{id:1,tipo:"ingreso",local:"SR",empleadoId:"e1",items:JSON.stringify({21:10}),ts:AHORA-90*DIA}];
st=run("_stockActualLocal('SR')"); ok(st[21]===10,"sin conteo nunca: cuenta toda la historia ("+st[21]+")");
console.log(f?"FALLAS "+f:"TODO OK");
