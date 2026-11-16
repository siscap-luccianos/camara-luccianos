const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,parseFloat,isFinite,CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) f++};
const AHORA=Date.now(), DIA=864e5;
function montar(){
  sb.T={
    Locales:[{nombre:"SR",activo:"SI"}],
    Empleados:[{id:"e1",nombre:"Ana",rol:"encargado",local:"SR",activo:"SI"},{id:"e2",nombre:"Manuel",rol:"colaborador",local:"SR",activo:"SI"},{id:"e3",nombre:"Otro",rol:"colaborador",local:"XX",activo:"SI"}],
    Sabores:[{id:21,nombre:"Frutilla a la crema",tipo:"v",activo:"SI",familia:"vasquetas",orden:1},{id:5,nombre:"Cheesecake",tipo:"v",activo:"SI",familia:"vasquetas",orden:2}],
    Stock:[{local:"SR",base:JSON.stringify({21:0,5:2}),ts:AHORA-5*DIA}],
    Registros:[
      {id:9,tipo:"ingreso",local:"SR",empleadoId:"e9",empleado:"Z",items:JSON.stringify({21:10}),ts:AHORA-3*36e5},
      {id:10,tipo:"salida",local:"SR",empleadoId:"e2",empleado:"Manuel",items:JSON.stringify({21:3}),ts:AHORA-2*36e5},
      {id:1,tipo:"ingreso",local:"SR",empleadoId:"e1",empleado:"Ana",items:JSON.stringify({21:10}),ts:AHORA-3*DIA},
      {id:2,tipo:"salida",local:"SR",empleadoId:"e1",empleado:"Ana",items:JSON.stringify({21:8}),ts:AHORA-2*DIA},
      {id:3,tipo:"ingreso",local:"SR",empleadoId:"e1",empleado:"Ana",items:JSON.stringify({5:4}),ts:AHORA-6*DIA}, // anterior al conteo
    ]};
  sb.nextId=100; sb.AUD=[];
  vm.runInContext(`
   _leerCrudo=function(n){return (T[n]||[]).map(r=>Object.assign({},r))};
   _leerUltimasFilas=function(n,k){return T[n].slice(-k).map(r=>Object.assign({},r))};
   _auditar=function(){ AUD.push([].slice.call(arguments)) }; _invalidarCacheDatos=function(){};
   _escribirCrudo=function(n,o){var id=nextId++; T[n].push(Object.assign({id:id},o)); return {ok:true,id:id}};
   _eliminarCrudo=function(n,id){var i=T[n].findIndex(function(r){return String(r.id)===String(id)}); if(i<0) return {ok:false,error:"no"}; T[n].splice(i,1); return {ok:true}};
   _sheet=function(n){ var H=["id","clienteId","tipo","local","empleadoId","empleado","items","total","remito","ts","anulado_por","anulado_ts","motivo","fecha_aaa","foto_remito","subtipo"];
     return {getDataRange:function(){return {getValues:function(){return [H].concat(T[n].map(function(r){return H.map(function(h){return r[h]===undefined?"":r[h]})}))}}},
       getRange:function(row,c){return {setValue:function(v){T[n][row-2][H[c-1]]=v}}}} };
  `,sb);
}
const run=c=>vm.runInContext(c,sb);
const ana={id:"e1",nombre:"Ana",rol:"encargado",local:"SR"}, colab={id:"e2",nombre:"Manuel",rol:"colaborador",local:"SR"}, otroLocal={id:"e5",nombre:"Zeta",rol:"encargado",local:"XX"};
sb.ana=ana; sb.colab=colab; sb.otroLocal=otroLocal; sb.d1={21:1};
montar();
let r=run("registrar('p1','ingreso','SR',d1,'',ana,'','devolucion','Manuel se fue',undefined,undefined,undefined,undefined,'e2')");
ok(r.ok,"un responsable devuelve por Manuel: "+(r.error||""));
const g=sb.T.Registros[sb.T.Registros.length-1];
ok(g.empleadoId==="e2"&&g.empleado==="Manuel"&&g.cargado_por==="Ana","queda a nombre de Manuel y «cargado por» Ana: "+g.empleadoId+"/"+g.cargado_por);
ok(sb.AUD.some(a=>a[0]==="devolucion_por_companero"),"queda en Auditoría");
sb.d3={21:3}; r=run("registrar('p2','ingreso','SR',d3,'',ana,'','devolucion','otra',undefined,undefined,undefined,undefined,'e2')");
ok(!r.ok&&/No podés devolver más/.test(r.error),"no puede devolver más de lo que Manuel tenía pendiente (2): "+(r.error||"").slice(0,60));
r=run("registrar('p3','ingreso','SR',d1,'',ana,'','devolucion','',undefined,undefined,undefined,undefined,'e2')");
ok(!r.ok&&/motivo/i.test(r.error),"sin motivo se rechaza");
r=run("registrar('p4','ingreso','SR',d1,'',colab,'','devolucion','x',undefined,undefined,undefined,undefined,'e1')");
ok(!r.ok&&/responsable/i.test(r.error),"un colaborador no puede devolver por otro");
r=run("registrar('p5','ingreso','SR',d1,'',ana,'','devolucion','x',undefined,undefined,undefined,undefined,'e3')");
ok(!r.ok&&/no es de este local/.test(r.error),"no se puede por alguien de otro local");
r=run("registrar('p6','ingreso','SR',d1,'',otroLocal,'','devolucion','x',undefined,undefined,undefined,undefined,'e2')");
ok(!r.ok,"un responsable de otro local no puede");
r=run("registrar('p7','salida','SR',d1,'',ana,'','','x',undefined,undefined,undefined,undefined,'e2')");
ok(!r.ok&&/devoluci/i.test(r.error),"solo una devolución se puede cargar por otra persona");
r=run("registrar('p8','ingreso','SR',d1,'',ana,'','devolucion','propia')"); ok(!r.ok,"Ana no sacó nada: su propia devolución sigue rechazada");
r=run("registrar('p9','ingreso','SR',d1,'',colab,'','devolucion')"); ok(r.ok,"Manuel todavía puede devolver 1 por su cuenta (le quedaba 2 menos 1)");
console.log(f?"FALLAS "+f:"FALLAS 0"); process.exit(f?1:0);
