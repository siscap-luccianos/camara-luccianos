// Servidor 1.115.0: registrar() guarda los rótulos escaneados (lote, turno, operario) alineados con los pesos de una salida.
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
const filas=[]; sb._escribirCrudo=(h,fila)=>{ filas.push(fila); return {id:"1"} }; sb._invalidarCacheDatos=()=>{}; sb._leerUltimasFilas=()=>[]; sb._auditar=()=>{};
sb._datosSinCache=()=>({stock:{base:{"4":10},ts:1},registros:[],sabores});
const emp={id:"1",nombre:"Gabi",rol:"admin"}; sb.emp=emp;
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
const rot=(l,p,rr,tipo)=>run(`registrar("c-${l}-${Math.random()}","${tipo||"salida"}","${l}",{"4":${p.length}},"",emp,"","",undefined,{},{},{"4":${JSON.stringify(p)}},undefined,undefined,undefined,{"4":${JSON.stringify(rr)}})`);
let r=rot("L salida",[3.93,3.2],["00040039313102622057",""]);
ok(r.ok&&filas.length===1&&JSON.parse(filas[0].rotulos)["4"].length===2&&JSON.parse(filas[0].rotulos)["4"][0]==="00040039313102622057"&&JSON.parse(filas[0].rotulos)["4"][1]==="","guarda el rótulo escaneado y deja vacío el pesado a mano: "+(filas[0]&&filas[0].rotulos));
r=rot("L salida",[3.6],["123"]); ok(r.ok&&filas[filas.length-1].rotulos==="","un código que no tiene 20 dígitos se descarta (no rompe la salida)");
r=rot("L salida",[3.6],["0004003931310262205 7"]); ok(r.ok&&JSON.parse(filas[filas.length-1].rotulos)["4"][0]==="00040039313102622057","limpia espacios y deja solo los dígitos");
r=run(`registrar("c-sin-rot","salida","L salida",{"4":1},"",emp,"","",undefined,{},{},{"4":[3.6]})`); ok(r.ok&&filas[filas.length-1].rotulos==="","una salida sin rótulos (cliente viejo) sigue como siempre");
const pub=run(`_registroPublico({id:"1",tipo:"salida",local:"x",items:"{}",rotulos:'{"4":["00040039313102622057"]}',ts:1})`);
ok(pub.rotulos&&pub.rotulos["4"][0]==="00040039313102622057","el registro público devuelve los rótulos");
ok(run(`_registroPublico({id:"1",tipo:"salida",local:"x",items:"{}",ts:1})`).rotulos&&Object.keys(run(`_registroPublico({id:"1",tipo:"salida",local:"x",items:"{}",ts:1})`).rotulos).length===0,"sin rótulos devuelve {}");
const nc=run(`_normalizarRotulosConteo({"4":["00040039313102622057","9900090003550083529092621015","123"]},{"4":[3.93,"c:8.35",3.0]})`);
ok(nc["4"]&&nc["4"][0]==="00040039313102622057"&&nc["4"][1]==="9900090003550083529092621015"&&nc["4"][2]==="","conteo: acepta rótulos de 20 (vasqueta) y 28 (caja) dígitos y descarta lo demás");
ok(Object.keys(run(`_normalizarRotulosConteo({"4":["1"]},{"4":[3.9]})`)).length===0&&Object.keys(run(`_normalizarRotulosConteo(undefined,{"4":[3.9]})`)).length===0,"conteo: sin rótulos válidos no guarda nada");
r=run(`registrar("c-tr","ingreso","L salida",{"4":2},"",emp,"","transferencia","Transferencia de X",undefined,{},{"4":[3.9,4.0]},undefined,undefined,undefined,{"4":["00040039313102622057","9900090003550083529092621015"]})`);
ok(r.ok&&JSON.parse(filas[filas.length-1].rotulos)["4"].length===2&&JSON.parse(filas[filas.length-1].rotulos)["4"][1]==="9900090003550083529092621015","transferencia recibida: guarda rótulos de vasqueta (20) y de caja (28): "+JSON.stringify(r));
console.log(f?"FALLAS "+f:"FALLAS 0");
process.exit(f?1:0);
