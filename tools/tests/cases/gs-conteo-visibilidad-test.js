// Code.gs: el responsable ve solo el inicial; parcial y cierre quedan ocultos hasta que supervisión los muestra (PIN) o, el cierre, hasta las 12:00.
const vm=require("vm"),fs=require("fs");
let NOW=Date.parse("2026-12-05T12:00:00-03:00"); class FDate extends Date{ static now(){ return NOW } }
const sb={console,Date:FDate,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},
 Utilities:{formatDate:(d)=>new Date(d.getTime()-3*3600e3).toISOString().slice(0,10)}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"Galerías",operaciones:"NO",activo:"SI"},{nombre:"Recoleta",operaciones:"NO",activo:"SI",ver_diferencias:"SI"}];
const sabores=[{id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas",peso:"3,5"}];
const T=s=>Date.parse(s+"-03:00");
let inv=[],audit=[];
const mk=(id,local,tipo,ts)=>({id,local,tipo,ts,fecha:"x",empleado:"Gabi",items:'{"4":2}',camara:'{"4":{"u":2,"k":7}}'});
inv.push(mk("1","Galerías","inicial",T("2026-12-01T08:00:00")));
inv.push(mk("2","Galerías","parcial",T("2026-12-10T08:00:00")));
inv.push(mk("3","Galerías","final",T("2026-12-31T23:30:00")));
inv.push(mk("4","Recoleta","parcial",T("2026-12-10T08:00:00")));
sb._hojaInventarios=()=>({}); sb._hojaPedidosConteo=()=>({});
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:h==="Inventarios"?inv:[];
sb._puedeVerLocal=()=>true;
sb._actualizarCrudo=(h,id,c)=>{Object.assign(inv.filter(x=>x.id===String(id))[0],c);return {ok:true}};
sb._auditar=(...a)=>audit.push(a);
sb._exigirPinAdmin=(e,pin)=>pin==="1234"?null:{ok:false,pidePin:true,error:"PIN incorrecto."};
sb._coberturaMes=()=>({}); sb._conteoSueltoBloqueado=()=>false;
const run=c=>vm.runInContext(c,sb);
const E=(rol)=>{ sb.emp={id:"1",nombre:"Gabi",rol}; };
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
const ids=r=>r.inventarios.map(x=>x.id).sort().join(",");
// horario de liberación del cierre
ok(run(`_liberaCierreTs(${T("2026-12-31T23:30:00")})`)===T("2027-01-01T12:00:00"),"cierre guardado 23:30 → se libera a las 12:00 del día siguiente");
ok(run(`_liberaCierreTs(${T("2027-01-01T01:00:00")})`)===T("2027-01-01T12:00:00"),"cierre guardado 01:00 → se libera a las 12:00 de ese mismo día");
ok(run(`_liberaCierreTs(${T("2027-01-01T13:00:00")})`)===T("2027-01-02T12:00:00"),"cierre guardado 13:00 → a las 12:00 del día siguiente");
// responsable, antes de las 12:00
NOW=T("2027-01-01T09:00:00");
E("encargado"); let r=run(`inventarios("Galerías",emp)`);
ok(r.ok&&ids(r)==="1","el responsable ve solo el inicial (cierre antes de las 12:00 y parcial, ocultos)");
ok(r.ocultos.length===2&&r.ocultos.every(o=>!("items" in o)&&!("camara" in o)),"y de lo oculto solo sabe que existe, sin kilos");
ok(r.ocultos.filter(o=>o.tipo==="final")[0].libera_ts===T("2027-01-01T12:00:00"),"el cierre trae la hora en que se libera");
// a las 12:00
NOW=T("2027-01-01T12:00:00");
r=run(`inventarios("Galerías",emp)`); ok(ids(r)==="1,3"&&r.ocultos.length===1,"a las 12:00 el cierre se muestra solo; el parcial sigue oculto");
// supervisión ve todo
NOW=T("2027-01-01T09:00:00");
E("supervisor"); r=run(`inventarios("Galerías",emp)`); ok(ids(r)==="1,2,3"&&r.ocultos.length===0,"supervisión ve todo");
// franquicia con ver_diferencias
E("encargado"); r=run(`inventarios("Recoleta",emp)`); ok(ids(r)==="4","con ver_diferencias=SI el responsable ve también el parcial");
// mostrar con PIN
r=run(`liberarInventario("Galerías","2","1234",true,emp)`); ok(!r.ok,"el responsable no puede mostrar un conteo");
E("supervisor"); r=run(`liberarInventario("Galerías","2","0000",true,emp)`); ok(!r.ok&&r.pidePin,"PIN incorrecto: no lo muestra");
ok(!(Number(inv[1].visible_resp_ts)>0),"y no se escribió nada");
r=run(`liberarInventario("Galerías","1","1234",true,emp)`); ok(!r.ok,"el inicial no se libera (ya lo ve el responsable)");
r=run(`liberarInventario("Galerías","2","1234",true,emp)`); ok(r.ok&&inv[1].visible_resp_ts===NOW&&inv[1].visible_resp_por==="Gabi","con PIN lo muestra y queda quién y cuándo");
ok(audit.some(a=>a[0]==="mostrar_conteo_responsable"),"queda en Auditoría");
E("encargado"); r=run(`inventarios("Galerías",emp)`); ok(ids(r)==="1,2","el responsable ya ve el parcial liberado");
// dura 1 hora y se oculta solo
NOW+=59*60000; E("encargado"); r=run(`inventarios("Galerías",emp)`); ok(ids(r)==="1,2","a los 59 minutos el responsable todavía lo ve");
NOW+=2*60000; r=run(`inventarios("Galerías",emp)`); ok(ids(r)==="1","pasada la hora se oculta solo");
NOW-=61*60000; E("supervisor");
E("supervisor"); r=run(`liberarInventario("Galerías","2","1234",false,emp)`); ok(r.ok&&inv[1].visible_resp_ts===0,"supervisión puede volver a ocultarlo");
E("encargado"); r=run(`inventarios("Galerías",emp)`); ok(ids(r)==="1","y el responsable deja de verlo");
// no puede corregir lo oculto
r=run(`corregirInventario("Galerías","2","4",3,"motivo",emp)`); ok(!r.ok,"el responsable no puede corregir un conteo oculto");
console.log(f?"FALLAS "+f:"FALLAS 0"); process.exit(f?1:0);
