// Code.gs: el Conteo cámara queda con candado apenas se guarda en el mes; solo supervisión lo desbloquea (PIN + motivo), y se cierra otra vez al guardar.
const vm=require("vm"),fs=require("fs");
let NOW=Date.parse("2026-11-17T12:00:00-03:00"); class FDate extends Date{ static now(){ return NOW } }
const props={};
const sb={console,Date:FDate,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]===undefined?null:props[k],setProperty:(k,v)=>{props[k]=v},deleteProperty:k=>{delete props[k]}})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},
 Utilities:{formatDate:(d)=>new Date(d.getTime()-3*3600e3).toISOString().slice(0,10)}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
let regs=[], inv=[], audit=[];
sb._hojaInventarios=()=>({});
sb._leerCrudo=h=>h==="Inventarios"?inv:h==="Registros"?regs:[];
sb._puedeVerLocal=()=>true;
sb._auditar=(...a)=>audit.push(a);
sb._exigirPinAdmin=(e,pin)=>pin==="1234"?null:{ok:false,pidePin:true,error:"PIN incorrecto."};
const run=c=>vm.runInContext(c,sb);
const E=(rol)=>{ sb.emp={id:"1",nombre:"Gabi",rol}; };
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
const ts=s=>Date.parse(s);
const bloq=()=>run(`_conteoSueltoBloqueado("Galerías",emp)`);
E("encargado");
ok(bloq()===false,"sin Conteo cámara este mes: se puede contar");
regs=[{tipo:"conteo",local:"Galerías",ts:ts("2026-11-05T09:00:00-03:00"),empleado:"Laura"}];
ok(bloq()===true,"con un Conteo cámara de este mes (sin conteo inicial todavía): queda con candado");
E("supervisor"); ok(bloq()===false,"supervisión no se bloquea"); E("encargado");
regs=[{tipo:"conteo",local:"Galerías",ts:ts("2026-11-05T09:00:00-03:00"),anulado_ts:"1"}];
ok(bloq()===false,"uno anulado no cuenta");
regs=[{tipo:"conteo",local:"Galerías",ts:ts("2026-10-20T09:00:00-03:00")}];
ok(bloq()===false,"uno de otro mes no cuenta");
regs=[{tipo:"conteo",local:"Otro",ts:ts("2026-11-05T09:00:00-03:00")}];
ok(bloq()===false,"el de otro local no afecta");
regs=[{tipo:"conteo",local:"Galerías",ts:ts("2026-11-05T09:00:00-03:00"),empleado:"Laura"}];
// desbloqueo
let r=run(`desbloquearConteoCamara("Galerías","1234","por un error de carga",emp)`); ok(!r.ok,"el responsable no puede desbloquear");
E("supervisor");
r=run(`desbloquearConteoCamara("Galerías","1234","",emp)`); ok(!r.ok&&/motivo/i.test(r.error),"pide motivo");
r=run(`desbloquearConteoCamara("Galerías","0000","por un error de carga",emp)`); ok(!r.ok&&r.pidePin,"PIN incorrecto: no desbloquea");
ok(bloq()===false,"(supervisión nunca se bloquea)");
E("encargado"); ok(bloq()===true,"y el responsable sigue bloqueado");
E("supervisor"); r=run(`desbloquearConteoCamara("Galerías","1234","por un error de carga",emp)`); ok(r.ok&&r.desbloqueado_hasta>NOW,"con PIN y motivo se desbloquea 24 h");
ok(audit.some(a=>a[0]==="desbloquear_conteo_camara"),"queda en Auditoría");
E("encargado"); ok(bloq()===false,"el responsable puede recontar la cámara");
NOW=ts("2026-11-18T13:00:00-03:00"); ok(bloq()===true,"pasadas las 24 h vuelve a cerrarse");
NOW=ts("2026-11-17T13:00:00-03:00"); ok(bloq()===false,"(dentro de las 24 h sigue abierto)");
run(`_camaraRecerrar("Galerías")`); ok(bloq()===true,"al guardar el conteo, el candado se vuelve a cerrar");
const cc=run(`_camaraContadaMes("Galerías")`); ok(cc&&cc.empleado==="Laura","controlDetalle sabe quién y cuándo contó la cámara");
console.log(f?"FALLAS "+f:"TODO OK"); process.exit(f?1:0);
