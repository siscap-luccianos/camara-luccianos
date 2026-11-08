const vm=require("vm"),fs=require("fs"),crypto=require("crypto");
const store={}; const props={SESSION_SECRET:"s3cret",ADMIN_CODE:"123456"};
const sb={console,Date,Math,JSON,String,Number,Array,Object,
 CacheService:{getScriptCache:()=>({get:k=>store[k]??null,put:(k,v)=>{store[k]=v},remove:k=>{delete store[k]}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},
 Utilities:{computeHmacSha256Signature:(m,k)=>[...crypto.createHmac("sha256",k).update(m).digest()],
  base64EncodeWebSafe:x=>(Array.isArray(x)?Buffer.from(x):Buffer.from(String(x))).toString("base64url"),
  base64DecodeWebSafe:s=>[...Buffer.from(s,"base64url")],newBlob:b=>({getDataAsString:()=>Buffer.from(b).toString()})}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
let emp={id:"7",nombre:"Ana",rol:"colaborador",local:"X",activo:"SI",pin_hash:"AAA"};
const locales=[{nombre:"Local1",clave:"abc",operaciones:"NO"},{nombre:"Operaciones",clave:"op",operaciones:"SI"}];
sb._leerCrudo=h=>h==="Locales"?locales:h==="Empleados"?[emp]:[]; sb._auditar=()=>{};
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
// token
const t=run("_emitirToken('7')"); sb.t=t;
ok(run("_verificarSesion(t)").ok,"token válido");
emp={...emp,pin_hash:"BBB"};
ok(!run("_verificarSesion(t)").ok,"token muere al cambiar el PIN (reset)");
emp={...emp,pin_hash:"AAA"}; ok(run("_verificarSesion(t)").ok,"y vuelve a valer con el mismo PIN");
// token legado (2 campos)
const pay=Buffer.from("7|"+(Date.now()+3600000)).toString("base64url"); sb.leg=pay+"."+run("_firmar")(pay);
ok(run("_verificarSesion(leg)").ok,"token viejo (sin versión) sigue valiendo hasta vencer");
// contraseña de local
for(let i=0;i<8;i++) run("verificarClaveLocal('Local1','mal')");
let r=run("verificarClaveLocal('Local1','abc')"); ok(!r.ok&&/Demasiados/.test(r.error),"8 fallos bloquean incluso la clave correcta");
r=run("verificarClaveLocal('Local1','123456')"); ok(r.ok&&r.modoAdmin,"pero el código de admin sí entra aunque el local esté bloqueado");
// operaciones
for(let i=0;i<6;i++) run("loginGestion('1','mal','Operaciones')");
r=run("loginGestion('1','op','Operaciones')"); ok(!r.ok&&/Demasiados/.test(r.error),"Operaciones bloqueada tras 6 fallos");
// lista de admins
Object.keys(store).forEach(k=>delete store[k]);
ok(!run("empleadosGestion('Operaciones','')").ok,"sin contraseña no lista admins");
ok(run("empleadosGestion('Operaciones','op')").ok,"con la contraseña sí");
ok(run("empleadosGestion('Operaciones','123456')").ok,"con el código de admin sí");
// remitos
Object.keys(store).forEach(k=>delete store[k]);
let ult; for(let i=0;i<41;i++) ult=run("_rlUso('remito:7',40,3600)"); ok(ult===true,"remito: el uso 41 de la hora se corta");
console.log(f?"RESULTADO: "+f+" fallo(s)":"RESULTADO: todo OK");
