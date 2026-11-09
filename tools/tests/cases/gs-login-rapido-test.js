// Login más rápido (back 1.73.0): sin flush ni relectura de Empleados al emitir el token, el admin no arma
// datos dos veces, Locales/Sabores se leen una vez por pedido y el cache de datos() se parte en trozos de 90 KB.
const vm=require("vm"),fs=require("fs"),crypto=require("crypto");
const lecturas={}; let flushes=0; const store={};
const hojas={
  Empleados:[["id","nombre","rol","local","pin_hash","salt","activo","intentos","bloqueado_hasta"],["1","Ana","colaborador","Alcorta","","","SI",0,""],["2","Gabi","admin","","","","SI",0,""]],
  Locales:[["nombre","activo","operaciones","clave","pais"],["Alcorta","SI","NO","",""],["Operaciones","SI","SI","abc",""]],
  Sabores:[["id","nombre","tipo","activo","orden","categoria","familia","minimo"],["1","Frutilla","v","SI",1,"Cremas","vasquetas",6]],
  Stock:[["local","base","ts","empleado"]],
  Registros:[["id","local","ts","items","tipo"]],
  Auditoria:[["ts","accion","actorId","actor","detalle","id"]],
};
const mk=n=>({getDataRange:()=>({getValues:()=>{lecturas[n]=(lecturas[n]||0)+1;return hojas[n].map(f=>f.slice())}}),
  getRange:(r,c,nr,nc)=>({getValues:()=>[hojas[n][0]],setValue:v=>{while(hojas[n][r-1].length<c)hojas[n][r-1].push("");hojas[n][r-1][c-1]=v},setNumberFormat(){},setNumberFormats(){},setValues(){}}),
  getLastRow:()=>hojas[n].length,getLastColumn:()=>hojas[n][0].length,appendRow(){}});
const sb={console,Date,Math,JSON,String,Number,Array,Object,isFinite,parseFloat,
 CacheService:{getScriptCache:()=>({get:k=>store[k]??null,put:(k,v)=>{store[k]=v},remove:k=>{delete store[k]},
   putAll:(o)=>{Object.keys(o).forEach(k=>{if(o[k].length>100000)throw new Error("too big");store[k]=o[k]})},
   getAll:(ks)=>{const r={};ks.forEach(k=>{if(store[k]!==undefined)r[k]=store[k]});return r},
   removeAll:(ks)=>ks.forEach(k=>delete store[k])})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==="SESSION_SECRET"?"secreto":null,setProperty(){}})},
 SpreadsheetApp:{flush(){flushes++},getActiveSpreadsheet:()=>({getSheetByName:n=>hojas[n]?mk(n):null})},
 LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},
 Utilities:{computeDigest:(a,s)=>Array.from(crypto.createHash("sha256").update(String(s)).digest()),base64Encode:b=>Buffer.from(b).toString("base64"),
   computeHmacSha256Signature:(p,k)=>Array.from(crypto.createHmac("sha256",k).update(p).digest()),
   base64EncodeWebSafe:b=>(typeof b==="string"?Buffer.from(b):Buffer.from(b)).toString("base64url"),getUuid:()=>"uuid-1",base64DecodeWebSafe:s=>Array.from(Buffer.from(s,"base64url")),newBlob:b=>({getDataAsString:()=>Buffer.from(b).toString()}),
   DigestAlgorithm:{SHA_256:1}}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const run=c=>vm.runInContext(c,sb); let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
const reset=()=>{Object.keys(lecturas).forEach(k=>delete lecturas[k]);flushes=0;run('Object.keys(_MEMO_HOJAS).forEach(function(k){delete _MEMO_HOJAS[k]})')};

// 1) Primer login (crea el PIN): el token sale sin flush ni relectura de Empleados y vale en _verificarSesion
reset(); sb.__a="1"; let r=run('login("1","1234","1234","Alcorta","","")');
ok(r.ok&&r.token,"el login crea el PIN y devuelve token");
ok(flushes===0,"sin flush al emitir el token (flushes="+flushes+")");
ok((lecturas.Empleados||0)===1,"Empleados se lee 1 vez en el login ("+lecturas.Empleados+")");
ok((lecturas.Locales||0)<=1,"Locales se lee como mucho 1 vez en el login ("+lecturas.Locales+")");
const v=run('_verificarSesion('+JSON.stringify(r.token)+')'); if(!v.ok) console.log("   ->",v.error);
ok(v.ok,"el token del primer login es válido con el PIN recién creado");

// 2) Login siguiente con el PIN ya creado
reset(); r=run('login("1","1234","","Alcorta","","")');
ok(r.ok&&flushes===0&&(lecturas.Empleados||0)===1,"login con PIN existente: sin flush y 1 lectura de Empleados");
ok(run('_verificarSesion('+JSON.stringify(r.token)+')').ok,"token válido");
r=run('login("1","9999","","Alcorta","","")'); ok(!r.ok&&/incorrecto/.test(r.error),"PIN malo sigue rechazado");

// 3) Admin: la comprobación del PIN no arma token ni datos del local
reset(); r=run('login("2","1111","1111","Operaciones","","")'); // crea PIN del admin
reset(); r=run('login("2","1111","","Operaciones","","",true)');
ok(r.ok&&!r.token&&!r.datos,"soloVerificar devuelve solo ok, sin token ni datos");
ok((lecturas.Registros||0)===0&&(lecturas.Sabores||0)===0,"soloVerificar no lee Registros ni Sabores");
reset(); r=run('loginGestion("2","abc","Operaciones","1111")');
ok(r.ok&&r.token,"loginGestion del admin entra");
ok((lecturas.Registros||0)===0,"Operaciones no lee Registros");

// 4) Locales/Sabores memorizados por pedido y descartados al pedir la hoja para escribir
reset(); run('_leerCrudo("Locales"); _leerCrudo("Locales"); _leerCrudo("Sabores"); _leerCrudo("Sabores")');
ok(lecturas.Locales===1&&lecturas.Sabores===1,"Locales y Sabores: una sola lectura aunque se pidan dos veces");
run('_sheet("Locales")'); run('_leerCrudo("Locales")');
ok(lecturas.Locales===2,"tras _sheet() (posible escritura) se vuelve a leer");
const a=run('_leerCrudo("Locales")[0]'); a.nombre="X"; ok(run('_leerCrudo("Locales")[0].nombre')==="Alcorta","modificar lo leído no ensucia lo memorizado");

// 5) Cache grande en trozos
const grande="x".repeat(250000);
run('(function(){var c=CacheService.getScriptCache(); _cachePonerGrande(c,"datos_T",'+JSON.stringify(grande)+',45);})()');
ok(Object.keys(store).filter(k=>k.indexOf("datos_T#")===0&&k!=="datos_T#n").length===3,"250 KB se guardan en 3 trozos (cada uno bajo 100 KB)");
ok(run('_cacheLeerGrande(CacheService.getScriptCache(),"datos_T")')===grande,"se rearma igual al leerlo");
delete store["datos_T#1"]; ok(run('_cacheLeerGrande(CacheService.getScriptCache(),"datos_T")')===null,"si falta un trozo, devuelve null y se rearma");
Object.keys(store).forEach(k=>delete store[k]);
run('_cachePonerGrande(CacheService.getScriptCache(),"datos_T","chico",45)');
run('_invalidarCacheDatos("T")'); ok(!Object.keys(store).some(k=>k.indexOf("datos_T")===0),"invalidar borra todos los trozos");

// 6) datos() de un local con mucho movimiento usa el cache (antes se pasaba de 100 KB y no cacheaba)
hojas.Registros=[hojas.Registros[0]]; for(let i=1;i<=400;i++) hojas.Registros.push([String(i),"Alcorta",Date.now()-1000*i,JSON.stringify(Object.fromEntries(Array.from({length:40},(_,k)=>[String(k+1),k]))),"salida"]);
reset(); const emp={id:"1",nombre:"Ana",rol:"colaborador",local:"Alcorta"};
sb.__e=emp; let d1=run('datos("Alcorta",__e)'); if(!d1.ok) console.log("   ->",d1.error); const l1=lecturas.Registros||0;
reset(); let d2=run('datos("Alcorta",__e)');
console.log("   registros:",d1.registros&&d1.registros.length,"bytes:",JSON.stringify(d1).length);
ok(d1.ok&&d1.registros.length===400,"datos() trae los 400 movimientos");
ok(l1===1&&(lecturas.Registros||0)===0,"la segunda llamada sale del cache (Registros leídos: "+l1+" y luego "+(lecturas.Registros||0)+")");
ok(JSON.stringify(d1).length>100000,"el caso de prueba pasa de 100 KB ("+JSON.stringify(d1).length+")");
// 7) Cache entre pedidos de Empleados / Sabores / Locales
Object.keys(store).forEach(k=>delete store[k]);
reset(); let rows=run('_leerCrudoCache("Empleados")'); const l0=lecturas.Empleados||0;
reset(); run('_leerCrudoCache("Empleados")'); ok(l0===1&&(lecturas.Empleados||0)===0,"Empleados: la 2ª lectura sale del cache ("+l0+" y "+(lecturas.Empleados||0)+")");
reset(); run('_leerCrudo("Empleados")'); ok((lecturas.Empleados||0)===1&&Object.keys(store).some(k=>k.indexOf("hoja_Empleados")===0),"leer con _leerCrudo no borra el cache");
run('_sheet("Empleados")'); ok(!Object.keys(store).some(k=>k.indexOf("hoja_Empleados")===0),"pedir la hoja para escribir descarta el cache");
run('_leerCrudoCache("Sabores"); _leerCrudoCache("Locales")'); run('_auditar("x","1","a","d")');
ok(!Object.keys(store).some(k=>k.indexOf("hoja_")===0),"auditar descarta los tres caches");
// sesión: usa el cache, pero un PIN recién cambiado se confirma contra la hoja
const t=run('login("1","1234","","Alcorta","","")').token;
reset(); let v1=run('_verificarSesion('+JSON.stringify(t)+')'); const le1=lecturas.Empleados||0;
reset(); let v2=run('_verificarSesion('+JSON.stringify(t)+')');
ok(v1.ok&&v2.ok&&(lecturas.Empleados||0)===0,"la sesión se valida desde el cache sin leer la hoja (1ª: "+le1+", 2ª: "+(lecturas.Empleados||0)+")");
hojas.Empleados[1][4]="otro-hash"; // alguien cambió el PIN directo en la hoja
Object.keys(store).forEach(k=>delete store[k]);
let v3=run('_verificarSesion('+JSON.stringify(t)+')'); ok(!v3.ok&&/PIN cambió/.test(v3.error),"si el PIN cambió, el token viejo se rechaza");
// baja: dentro de los segundos del cache aún pasa, pero al invalidar se corta
hojas.Empleados[1][4]=run('(function(){return _hashPin("1234","uuid-1")})()'); Object.keys(store).forEach(k=>delete store[k]);
ok(run('_verificarSesion('+JSON.stringify(t)+')').ok,"con el PIN original vuelve a valer");
hojas.Empleados[1][6]="NO"; run('_auditar("baja","2","g","x")');
ok(!run('_verificarSesion('+JSON.stringify(t)+')').ok,"una baja con auditoría corta la sesión al toque");
console.log(f?"\n"+f+" FALLAS":"\nTODO OK"); process.exit(f?1:0);
