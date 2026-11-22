// Code.gs 1.111.0: el servidor respeta los rubros apagados (lleva_<rubro>=NO) y los sabores excluidos del local.
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,parseFloat,isFinite,CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) f++};
const run=c=>vm.runInContext(c,sb);
const AHORA=Date.now(), DIA=864e5;
function montar(){
  sb.T={
    Locales:[{nombre:"L1",activo:"SI",lleva_chocolateria:"NO",sabores_excluidos:"5,7",produccion_sabores:"7"},{nombre:"Operaciones",operaciones:"SI"}],
    Sabores:[
      {id:1,nombre:"Chocolate",tipo:"v",activo:"SI",familia:"vasquetas",orden:1},
      {id:5,nombre:"Cheesecake",tipo:"v",activo:"SI",familia:"vasquetas",orden:2},
      {id:7,nombre:"Pistacchio",tipo:"v",activo:"SI",familia:"vasquetas",orden:3},
      {id:8,nombre:"Frutilla",tipo:"v",activo:"SI",familia:"vasquetas",orden:4},
      {id:117,nombre:"Alfajor",tipo:"c",activo:"SI",familia:"chocolateria",orden:5}],
    Stock:[{local:"L1",base:JSON.stringify({1:5,5:9,7:4,117:3}),ts:AHORA-3*DIA}],
    Registros:[{id:1,tipo:"ingreso",local:"L1",empleadoId:"e1",empleado:"Ana",items:JSON.stringify({1:10,117:5}),ts:AHORA-1*DIA}],
    Inventarios:[]};
  sb.nextId=100;
  vm.runInContext(`
   _hojaInventarios=function(){return {}}; _hojaPedidosConteo=function(){return {}};
   _leerCrudo=function(n){return (T[n]||[]).map(r=>Object.assign({},r))};
   _leerCrudoCache=_leerCrudo;
   _leerUltimasFilas=function(n,k){return (T[n]||[]).slice(-k).map(r=>Object.assign({},r))};
   _auditar=function(){}; _invalidarCacheDatos=function(){}; _camaraRecerrar=function(){};
   _escribirCrudo=function(n,o){var id=nextId++; T[n].push(Object.assign({id:id},o)); return {ok:true,id:id}};
   _escribirCeldaSinAdivinar=function(rg,v){rg.setValue(v)};
   _sheet=function(n){ var H=n==="Stock"?["local","base","ts","empleado"]:["id"];
     return {getLastRow:function(){return T[n].length+1},
       getDataRange:function(){return {getValues:function(){return [H].concat(T[n].map(function(r){return H.map(function(h){return r[h]===undefined?"":r[h]})}))}}},
       getRange:function(row,c){return {setValue:function(v){T[n][row-2][H[c-1]]=v}}}} };
  `,sb);
}
sb.ana={id:"e1",nombre:"Ana",rol:"encargado",local:"L1"}; sb.admin={id:"a1",nombre:"Gabi",rol:"admin",local:""};
run("_puedeVerLocal=function(){return true}");
sb.Utilities.formatDate=(d)=>new Date(d).toISOString().slice(0,10);
montar();
ok(run("BACKEND_VERSION")==="1.111.0","BACKEND_VERSION 1.111.0");

// registrar: ingreso y salida de un rubro apagado
sb.i1={117:2}; let r=run("registrar('a1','ingreso','L1',i1,'R1',ana)");
ok(!r.ok&&/no lleva ese rubro/.test(r.error)&&/Alfajor/.test(r.error),"ingreso de rubro apagado se rechaza: "+(r.error||"").slice(0,80));
sb.i2={117:1}; r=run("registrar('a2','salida','L1',i2,'',ana)");
ok(!r.ok&&/no lleva ese rubro/.test(r.error),"salida de rubro apagado se rechaza");
sb.i3={117:0,1:2}; r=run("registrar('a3','ingreso','L1',i3,'R2',ana)");
ok(r.ok,"cantidad 0 de rubro apagado + sabor normal se acepta: "+(r.error||""));
// excluido a mano (no rubro apagado): sigue pudiendo registrar
sb.i4={5:1}; r=run("registrar('a4','ingreso','L1',i4,'R3',ana)");
ok(r.ok,"sabor excluido a mano (no rubro apagado) no se rechaza en registrar: "+(r.error||""));

// cambioSabor
r=run("cambioSabor('c1','L1','117','1',1,0,'x',ana)");
ok(!r.ok,"cambioSabor con chocolatería se rechaza (rubro no permitido o apagado): "+(r.error||"").slice(0,60));
sb.T.Sabores.push({id:9,nombre:"Icepop X",tipo:"i",activo:"SI",familia:"icepops",orden:9});
sb.T.Locales[0].lleva_icepops="NO";
r=run("cambioSabor('c2','L1','1','9',1,0,'x',ana)");
ok(!r.ok&&/no lleva ese rubro/.test(r.error),"cambioSabor hacia un rubro apagado se rechaza: "+(r.error||"").slice(0,70));

// guardarInventario
montar();
sb.inv1={117:2}; r=run("_guardarInventarioInterno('i1','L1',inv1,{},ana,null,null)");
ok(!r.ok&&/no lleva ese rubro/.test(r.error),"guardarInventario con rubro apagado se rechaza: "+(r.error||"").slice(0,70));

// conteo completo
montar();
sb.c={1:7,5:99,7:50,8:2,117:30};
r=run("conteo('k1','L1',c,ana,null,null,null,true)");
ok(r.ok,"conteo completo ok: "+(r.error||""));
const base=JSON.parse(sb.T.Stock[0].base);
ok(base[117]===0,"rubro apagado (chocolatería) forzado a 0: "+base[117]);
ok(base[5]===9,"sabor excluido por el local conserva el valor anterior (9), no el del cliente: "+base[5]);
ok(base[7]===50,"sabor que el local produce no se oculta: usa lo contado (50): "+base[7]);
ok(base[1]===7&&base[8]===2,"sabores normales usan lo contado");

// Control sin excluidos
montar();
sb.T.Locales[0].grupo="Propios";
sb.T.Inventarios=[{id:1,local:"L1",tipo:"inicial",ts:AHORA-2*DIA,empleado:"Ana",items:JSON.stringify({1:1,5:3,117:4}),camara:JSON.stringify({1:{u:2},5:{u:2},117:{u:2}})}];
run("_soloSupervision=function(){return true}");
r=run("controlDetalle('L1',null,admin)");
const ids=[]; (r.conteos&&r.conteos.length?[]:[]);
const prods=[]; (r.grupos||[]).forEach(g=>(g.productos||[]).forEach(p=>prods.push(String(p.id))));
ok(r.ok&&prods.indexOf("1")!==-1,"controlDetalle muestra el sabor normal: "+JSON.stringify(prods));
ok(prods.indexOf("5")===-1&&prods.indexOf("117")===-1,"controlDetalle no muestra excluidos ni rubro apagado");
r=run("controlStock(admin)");
const fila=(r.locales||[]).filter(x=>x.local==="L1")[0];
ok(r.ok&&fila&&fila.base&&fila.base.locKg===1&&fila.base.locU===0,"controlStock resume solo lo contable (vasquetas locKg 1; sin excluidos ni rubro apagado): "+JSON.stringify(fila&&fila.base));
console.log(f?"FALLAS "+f:"TODO OK");
process.exit(f?1:0);
