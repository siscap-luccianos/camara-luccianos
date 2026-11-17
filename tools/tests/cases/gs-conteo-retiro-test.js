// Code.gs: desde el 1/12/2026 el Conteo físico suelto se retira para los responsables (admin y supervisor siguen pudiendo).
const vm=require("vm"),fs=require("fs");
let NOW=Date.parse("2026-12-05T12:00:00-03:00"); class FDate extends Date{ static now(){ return NOW } }
const sb={console,Date:FDate,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},
 Utilities:{formatDate:(d)=>new Date(d.getTime()-3*3600e3).toISOString().slice(0,10)}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
let inv=[];
sb._hojaInventarios=()=>({});
sb._leerCrudo=h=>h==="Inventarios"?inv:[];
sb._puedeVerLocal=()=>true;
const run=c=>vm.runInContext(c,sb);
const E=(rol)=>{ sb.emp={id:"1",nombre:"X",rol}; };
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
const ts=s=>Date.parse(s);
const bloq=()=>run(`_conteoSueltoBloqueado("Galerías",emp)`);
E("encargado");
ok(bloq()===false,"sin conteos guardados: se puede contar (hay que hacer el conteo inicial)");
inv=[{local:"Galerías",tipo:"inicial",ts:ts("2026-12-01T08:00:00-03:00")}];
ok(bloq()===true,"con el conteo inicial de este mes guardado: el conteo suelto queda retirado");
E("supervisor"); ok(bloq()===false,"supervisión puede seguir corrigiendo"); E("admin"); ok(bloq()===false,"y el admin también"); E("encargado");
inv=[{local:"Galerías",tipo:"parcial",ts:ts("2026-12-03T08:00:00-03:00")}];
ok(bloq()===false,"un parcial no cuenta como conteo inicial");
inv=[{local:"Otro",tipo:"inicial",ts:ts("2026-12-01T08:00:00-03:00")}];
ok(bloq()===false,"el conteo inicial de otro local no afecta");
inv=[{local:"Galerías",tipo:"inicial",ts:ts("2026-11-10T08:00:00-03:00")}];
ok(bloq()===false,"un inventario de práctica anterior al 1/12 no cuenta");
// un final del mes anterior es el inicial de este
inv=[{local:"Galerías",tipo:"final",ts:ts("2026-12-31T22:00:00-03:00")}]; NOW=ts("2027-01-10T10:00:00-03:00");
ok(bloq()===true,"el conteo final de diciembre es el inicial de enero: sigue retirado");
NOW=ts("2027-02-03T10:00:00-03:00"); ok(bloq()===false,"en febrero ese final ya no cubre: hay que hacer un conteo inicial nuevo");
inv=[{local:"Galerías",tipo:"inicial",ts:ts("2026-12-01T08:00:00-03:00")}]; NOW=ts("2027-01-10T10:00:00-03:00");
ok(bloq()===false,"un inicial de diciembre sin final no cubre enero");
// antes del 1/12 nada cambia
NOW=ts("2026-11-20T10:00:00-03:00"); inv=[{local:"Galerías",tipo:"inicial",ts:ts("2026-11-10T08:00:00-03:00")}]; ok(bloq()===false,"antes del 1/12 todo sigue como siempre");
// las acciones lo respetan
NOW=ts("2026-12-05T12:00:00-03:00"); inv=[{local:"Galerías",tipo:"inicial",ts:ts("2026-12-01T08:00:00-03:00")}]; E("encargado");
let r=run(`conteo("c1","Galerías",{"4":3},emp)`); ok(!r.ok&&/conteo suelto ya no se usa/.test(r.error),"conteo() lo rechaza para el responsable: "+(r.error||""));
r=run(`conteoParcial("c2","Galerías","vasquetas",{"4":3},emp)`); ok(!r.ok&&/conteo suelto ya no se usa/.test(r.error),"conteoParcial() (por rubro) también");
// no se duplica el conteo inicial del mes
inv=[{local:"Galerías",tipo:"final",ts:ts("2026-11-30T22:00:00-03:00")}]; NOW=ts("2026-12-05T12:00:00-03:00");
inv=[{local:"Galerías",tipo:"final",ts:ts("2026-12-31T22:00:00-03:00")}]; NOW=ts("2027-01-10T10:00:00-03:00"); E("encargado");
r=run(`guardarInventario("d1","Galerías",{"4":1},{},emp)`); ok(!r.ok&&/no hace falta hacer un conteo inicial/.test(r.error),"con un final del mes anterior, el responsable no puede guardar otro conteo inicial: "+(r.error||""));
inv=[{local:"Galerías",tipo:"inicial",ts:ts("2027-01-02T08:00:00-03:00")}];
r=run(`guardarInventario("d2","Galerías",{"4":1},{},emp)`); ok(!r.ok&&/ya tiene su conteo inicial/.test(r.error),"con un inicial de este mes, tampoco: "+(r.error||""));
r=run(`_coberturaMes("Galerías")`); ok(r&&r.tipo==="inicial","_coberturaMes dice qué conteo cubre el mes");
console.log(f?"FALLAS "+f:"FALLAS 0"); process.exit(f?1:0);
