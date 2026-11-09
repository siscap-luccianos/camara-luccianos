// Code.gs: cambiarMiPin().
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{getUuid:()=>"salt-x",computeDigest:()=>[1,2],base64Encode:()=>"H",DigestAlgorithm:{SHA_256:1}}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
let emps={"1":{id:"1",nombre:"Gabi",rol:"admin",pin_hash:"abc"},"2":{id:"2",nombre:"Carlos",rol:"supervisor",pin_hash:""}}, upd=[], audit=[];
sb._empleadoPorId=id=>emps[id]; sb._actualizarCrudo=(h,id,o)=>{upd.push([id,o]);return {ok:true}}; sb._auditar=(...a)=>audit.push(a);
sb._emitirToken=id=>"tok-"+id; sb._hashPin=()=>"NUEVOHASH";
sb.login=(id,pin)=>pin==="1111"?{ok:true}:{ok:false,error:"PIN incorrecto (1/5)."};
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
let r;
r=run(`cambiarMiPin("1111","12",{id:"1"})`); ok(!r.ok&&/4 números/.test(r.error),"PIN nuevo de menos de 4 números → rechaza");
r=run(`cambiarMiPin("2222","5678",{id:"1"})`); ok(!r.ok&&/incorrecto/.test(r.error)&&upd.length===0,"PIN actual malo → rechaza y no escribe");
r=run(`cambiarMiPin("1111","1111",{id:"1"})`); ok(!r.ok&&/distinto/.test(r.error),"mismo PIN → rechaza");
r=run(`cambiarMiPin("","5678",{id:"1"})`); ok(!r.ok&&/actual/.test(r.error),"sin PIN actual → pide");
r=run(`cambiarMiPin("1111","5678",{id:"1"})`); ok(r.ok&&r.token==="tok-1"&&upd.length===1&&upd[0][1].pin_hash==="NUEVOHASH"&&upd[0][1].intentos===0,"PIN bueno → guarda y devuelve token nuevo");
ok(audit.some(a=>a[0]==="cambio_pin_propio"),"audita");
r=run(`cambiarMiPin("","5678",{id:"2"})`); ok(r.ok,"supervisor sin PIN creado puede crearlo con la sesión");
console.log(f?"FALLAS "+f:"TODO OK"); process.exit(f?1:0);
