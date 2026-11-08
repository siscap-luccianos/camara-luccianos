// Code.gs: el admin necesita su PIN personal en Operaciones y con el código de admin; el supervisor no.
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const emps={"1":{id:"1",nombre:"Gabi",rol:"admin",activo:"SI"},"2":{id:"2",nombre:"Carlos",rol:"supervisor",activo:"SI"}};
sb._leerCrudo=h=>h==="Locales"?[{nombre:"Operaciones",operaciones:"SI",clave:"abc"},{nombre:"Obelisco CABA",operaciones:"NO"}]:[];
sb._empleadoPorId=id=>emps[id]; sb._auditar=()=>{}; sb._rlBloqueado=()=>false; sb._rlFallo=()=>{}; sb._rlLimpiar=()=>{};
sb._verificarCodigoAdmin=c=>c==="123456"?{ok:true}:{ok:false,error:"Código incorrecto."};
sb._resultadoLogin=(e,l,g)=>({ok:true,token:"t",empleado:e,gestion:g});
sb.login=(id,pin)=>pin==="1111"?{ok:true}:pin==="0000"?{ok:false,primeraVez:true,error:"x"}:{ok:false,error:"PIN incorrecto (1/5)."};
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
let r;
r=run(`loginGestion("1","abc","Operaciones")`); ok(!r.ok&&r.pidePin,"Operaciones: admin sin PIN → pide PIN");
r=run(`loginGestion("1","abc","Operaciones","2222")`); ok(!r.ok&&/PIN incorrecto/.test(r.error),"Operaciones: admin con PIN malo → rechaza");
r=run(`loginGestion("1","abc","Operaciones","1111")`); ok(r.ok&&r.gestion===true,"Operaciones: admin con PIN bueno → entra");
r=run(`loginGestion("1","mala","Operaciones","1111")`); ok(!r.ok&&/Contraseña incorrecta/.test(r.error),"Operaciones: contraseña mala aunque el PIN sea bueno → rechaza");
r=run(`loginGestion("1","abc","Operaciones","0000")`); ok(!r.ok&&/no tiene PIN/.test(r.error),"Operaciones: admin sin PIN creado → avisa");
r=run(`loginGestion("2","abc","Operaciones")`); ok(r.ok,"Operaciones: supervisor entra sin PIN, como antes");
r=run(`loginAdminLocal("1","123456","Obelisco CABA")`); ok(!r.ok&&r.pidePin,"código de admin: admin sin PIN → pide PIN");
r=run(`loginAdminLocal("1","123456","Obelisco CABA","1111")`); ok(r.ok,"código de admin: admin con PIN bueno → entra");
r=run(`loginAdminLocal("2","123456","Obelisco CABA")`); ok(r.ok,"código de admin: supervisor entra sin PIN, como antes");
console.log(f?"FALLAS "+f:"TODO OK"); process.exit(f?1:0);
