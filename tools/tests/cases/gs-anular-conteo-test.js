// Code.gs: un movimiento anterior al último conteo (inicial, parcial o cierre) solo lo anula supervisión, con motivo y PIN; y _movimientosPeriodo.
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,parseFloat,isFinite,CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{formatDate:(d)=>{const x=new Date(d.getTime()-3*3600e3).toISOString(); return x.slice(8,10)+"/"+x.slice(5,7)}}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) f++};
const AHORA=Date.now(), DIA=864e5;
sb.T={
  Locales:[{nombre:"SR",activo:"SI"}],
  Sabores:[{id:5,nombre:"Cheesecake",tipo:"v",activo:"SI",familia:"vasquetas",orden:1,peso:3.5}],
  Stock:[{local:"SR",base:JSON.stringify({5:2}),ts:AHORA-9*DIA}],
  Inventarios:[{id:1,local:"SR",tipo:"inicial",ts:AHORA-10*3600e3,items:"{}",camara:"{}"}],
  Registros:[
    {id:1,tipo:"ingreso",local:"SR",empleadoId:"e1",empleado:"Ana",items:JSON.stringify({5:4}),kilos:JSON.stringify({5:14}),remito:"00079-1",ts:AHORA-20*3600e3},
    {id:2,tipo:"salida",local:"SR",empleadoId:"e1",empleado:"Ana",items:JSON.stringify({5:1}),pesos:JSON.stringify({5:[3.5]}),ts:AHORA-1*3600e3},
    {id:3,tipo:"ingreso",local:"SR",empleadoId:"e1",empleado:"Ana",items:JSON.stringify({5:2}),ts:AHORA-4*DIA},
  ]};
vm.runInContext(`
 _hojaInventarios=function(){return {}};
 _leerCrudo=function(n){return (T[n]||[]).map(function(r){return Object.assign({},r)})};
 _leerUltimasFilas=function(n,k){return T[n].slice(-k).map(function(r){return Object.assign({},r)})};
 _auditar=function(){ (typeof AUD!=="undefined"?AUD:(AUD=[])).push(Array.prototype.slice.call(arguments)) }; _invalidarCacheDatos=function(){};
 _exigirPinAdmin=function(e,pin){ return pin==="1234"?null:{ok:false,pidePin:true,error:"PIN incorrecto."} };
 _sheet=function(n){ var H=["id","clienteId","tipo","local","empleadoId","empleado","items","total","remito","ts","anulado_por","anulado_ts","motivo","fecha_aaa","foto_remito","subtipo","kilos","pesos"];
   return {getDataRange:function(){return {getValues:function(){return [H].concat(T[n].map(function(r){return H.map(function(h){return r[h]===undefined?"":r[h]})}))}}},
     getRange:function(row,c){return {setValue:function(v){T[n][row-2][H[c-1]]=v}}}} };
`,sb);
const run=c=>vm.runInContext(c,sb);
sb.ana={id:"e1",nombre:"Ana",rol:"encargado",local:"SR"}; sb.admin={id:"a1",nombre:"Gabi",rol:"admin",local:""}; sb.sup={id:"s1",nombre:"Sofi",rol:"supervisor",local:""};
// responsable: el movimiento anterior al conteo (hace 3 días) está cerrado; uno posterior se anula como siempre
let r=run("anular(1,'error',ana)");
ok(!r.ok&&/anterior al conteo/.test(r.error)&&/supervisión/.test(r.error),"el responsable no anula un movimiento anterior al conteo: "+(r.error||""));
r=run("anular(2,'error',ana)"); ok(r.ok,"uno posterior al conteo se anula como siempre");
// supervisión: pide motivo, después PIN
r=run("anular(1,'',admin)"); ok(!r.ok&&r.pideMotivo,"supervisión: sin motivo lo pide");
r=run("anular(1,'error de carga',admin)"); ok(!r.ok&&r.pidePin,"con motivo y sin PIN lo pide");
r=run("anular(1,'error de carga',admin,'9999')"); ok(!r.ok&&/PIN/.test(r.error),"PIN incorrecto: no anula");
ok(!run("T.Registros[0].anulado_ts"),"y el movimiento sigue vigente");
r=run("anular(1,'error de carga',admin,'1234')"); ok(r.ok,"con motivo y PIN correcto se anula");
ok(run("AUD.some(function(a){return a[0]==='anular_antes_de_conteo'})"),"queda en Auditoría");
// un conteo propio no se bloquea por esto
// _movimientosPeriodo
const mov=run(`_movimientosPeriodo({ts:${AHORA-9*DIA}}, ${AHORA}, "SR", {"5":T.Sabores[0]}, null)`);
ok(mov.ing.n===1&&Math.abs(mov.ing.kg-7)<0.01&&mov.ing.lista[0].remito==="",
  "ingresos del período: el anulado no cuenta, queda el del 4.º día (2 vasquetas × 3,5 = 7 kg): "+JSON.stringify(mov.ing));
ok(mov.sal.n===0&&mov.anulados.length===2,"salidas 0 (la salida y el ingreso de 14 kg están anulados): anulados "+mov.anulados.length);
ok(mov.anulados.some(a=>a.tipo==="ingreso"&&Math.abs(a.kg-14)<0.01)&&mov.anulados.some(a=>a.tipo==="salida"&&Math.abs(a.kg-3.5)<0.01),"los anulados traen tipo y kilos");
// con una salida vigente por semana
vm.runInContext(`T.Registros.push({id:9,tipo:"salida",local:"SR",empleadoId:"e1",empleado:"Ana",items:JSON.stringify({5:2}),pesos:JSON.stringify({5:[3.4,3.6]}),ts:${AHORA-2*DIA}})`,sb);
const m2=run(`_movimientosPeriodo({ts:${AHORA-9*DIA}}, ${AHORA}, "SR", {"5":T.Sabores[0]}, null)`);
ok(m2.sal.n===1&&Math.abs(m2.sal.kg-7)<0.01&&m2.sal.semanas.length===1,"salidas: 1 movimiento de 7 kg en 1 semana: "+JSON.stringify(m2.sal));
console.log(f?"FALLAS "+f:"TODO OK"); process.exit(f?1:0);
