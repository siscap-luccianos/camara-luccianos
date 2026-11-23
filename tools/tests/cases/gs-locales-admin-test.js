// Servidor 1.118.0: panel de locales (solo admin): listar, guardar opciones, crear, cambiar una opción en varios y bitácora.
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const H=["nombre","grupo","activo","clave","operaciones","region","pais","control_equipos","venta_dia","kilos_reales","lleva_baldes","lleva_chocolateria","lleva_vasquetas","lleva_icepops","lleva_glutenfree","lleva_pasteleria","lleva_bolleria","produccion","escaner_salida","escaner_conteo","sin_escaner","stock_valorizado","ver_diferencias","ingreso_solo_produccion","max_equipos"];
const T=[H.slice(),
 ["Operaciones","Gestion","SI","x","SI"],
 ["Torreon","Propios","SI","","","Mar del Plata","Argentina","SI","SI","SI"],
 ["Obelisco","Propios","SI","","","CABA","","SI","SI","","NO"],
 ["Bllis","Franquicias","NO","","","GBA","Argentina"]];
T.slice(1).forEach(r=>{while(r.length<H.length)r.push("")});
const sheet={getDataRange:()=>({getValues:()=>T.map(r=>r.slice())}),getLastRow:()=>T.length,
 getRange:(r,c)=>({setNumberFormat(){},setValue(v){while(T.length<r)T.push(H.map(()=>""));T[r-1][c-1]=v}})};
sb._sheet=h=>sheet;
sb._leerCrudo=h=>{ if(h!=="Locales") return []; return T.slice(1).map(r=>{const o={};H.forEach((k,i)=>o[k]=r[i]);return o}) };
const aud=[]; sb._auditar=(a,i,n,d)=>aud.push({a,d}); sb._invalidarHojaCache=()=>{};
const admin={id:"1",nombre:"Gabi",rol:"admin"}, sup={id:"2",nombre:"Fabri",rol:"supervisor"}, enc={id:"3",nombre:"Ana",rol:"encargado",local:"Torreon"};
sb.admin=admin; sb.sup=sup; sb.enc=enc;
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
let r=run(`localesAdmin(admin)`);
ok(r.ok&&r.locales.length===3&&!r.locales.some(l=>l.nombre==="Operaciones"),"el admin ve los locales y no ve «Operaciones»");
const tor=r.locales.find(l=>l.nombre==="Torreon"), obe=r.locales.find(l=>l.nombre==="Obelisco"), bll=r.locales.find(l=>l.nombre==="Bllis");
ok(tor.opciones.kilos_reales===true&&tor.opciones.escaner_salida===false&&tor.opciones.activo===true,"lee las opciones (vacío de escáner = no)");
ok(obe.opciones.lleva_baldes===false&&obe.opciones.lleva_icepops===true&&obe.pais==="Argentina","«lleva_» vacío = sí, «NO» = no; país vacío = Argentina");
ok(bll.opciones.activo===false,"un local con activo=NO figura de baja");
ok(!run(`localesAdmin(sup)`).ok&&!run(`localesAdmin(enc)`).ok,"supervisor y responsable no pueden");
r=run(`guardarLocalAdmin("Torreon",{escaner_salida:true,kilos_reales:true,lleva_baldes:false,inventada:true},"Propios","Mar del Plata","Argentina",admin)`);
ok(r.ok&&r.local.opciones.escaner_salida===true&&r.local.opciones.lleva_baldes===false,"guarda opciones: "+JSON.stringify(r.local&&r.local.opciones.escaner_salida));
ok(T[2][H.indexOf("escaner_salida")]==="SI"&&T[2][H.indexOf("lleva_baldes")]==="NO","escribe SI/NO en la hoja");
ok(!("inventada" in r.local.opciones)&&aud.length===1&&/escaner_salida: NO → SI/.test(aud[0].d)&&!/kilos_reales/.test(aud[0].d),"ignora opciones que no existen y la bitácora lista solo lo que cambió: "+aud[0].d);
r=run(`guardarLocalAdmin("Torreon",{escaner_salida:true},undefined,undefined,undefined,admin)`); ok(r.ok&&r.sinCambios&&aud.length===1,"sin cambios no escribe ni audita");
ok(!run(`guardarLocalAdmin("Torreon",{kilos_reales:false},"Otra",undefined,undefined,admin)`).ok,"tipo de local inválido se rechaza");
ok(!run(`guardarLocalAdmin("Operaciones",{activo:false},undefined,undefined,undefined,admin)`).ok,"no se puede tocar «Operaciones»");
ok(!run(`guardarLocalAdmin("Torreon",{kilos_reales:false},undefined,undefined,undefined,sup)`).ok,"supervisor no puede guardar");
r=run(`guardarLocalAdmin("Bllis",{activo:true},undefined,undefined,undefined,admin)`); ok(r.ok&&T[4][H.indexOf("activo")]==="SI"&&r.local.opciones.activo===true,"dar de alta un local de baja");
r=run(`guardarLocalAdmin("Bllis",{activo:false},undefined,undefined,undefined,admin)`); ok(r.ok&&T[4][H.indexOf("activo")]==="NO","dar de baja un local");
// crear
r=run(`crearLocalAdmin("Palermo CABA","Franquicias","CABA","Argentina",admin)`);
const nueva=T[T.length-1]; ok(r.ok&&nueva[0]==="Palermo CABA"&&nueva[H.indexOf("activo")]==="SI"&&nueva[H.indexOf("control_equipos")]==="SI"&&nueva[H.indexOf("lleva_vasquetas")]==="SI"&&nueva[H.indexOf("max_equipos")]===3&&nueva[H.indexOf("clave")]==="","crea el local con los valores de arranque y sin contraseña");
ok(!run(`crearLocalAdmin("palermo caba","Franquicias","","",admin)`).ok,"no deja repetir el nombre (sin importar mayúsculas)");
ok(!run(`crearLocalAdmin("A","Franquicias","","",admin)`).ok&&!run(`crearLocalAdmin("Con, coma","Franquicias","","",admin)`).ok&&!run(`crearLocalAdmin("Nuevo","Otro","","",admin)`).ok,"nombre muy corto, con coma o tipo inválido se rechazan");
ok(!run(`crearLocalAdmin("Nuevo2","Franquicias","","",sup)`).ok,"supervisor no puede crear");
// masivo
r=run(`localesAdminMasivo(["Torreon","Obelisco","Palermo CABA","Operaciones","No existe"],"kilos_reales",true,admin)`);
ok(r.ok&&r.cambiados===2&&r.iguales===1&&r.noEncontrados.length===2,"masivo: cambia 2, uno ya estaba así y «Operaciones» y el inexistente no cuentan: "+JSON.stringify(r));
ok(!run(`localesAdminMasivo(["Torreon"],"clave",true,admin)`).ok&&!run(`localesAdminMasivo([],"kilos_reales",true,admin)`).ok&&!run(`localesAdminMasivo(["Torreon"],"kilos_reales",true,sup)`).ok,"masivo rechaza opciones inválidas, lista vacía y a quien no es admin");
ok(aud.some(x=>x.a==="admin_local_masivo")&&aud.some(x=>x.a==="crear_local"),"todo queda en la bitácora");
r=run(`localesAdminMasivo(["Torreon","Obelisco","Palermo CABA"],undefined,undefined,admin,{escaner_salida:true,escaner_conteo:true,lleva_baldes:true})`);
ok(r.ok&&r.cambiados===3&&T[2][H.indexOf("escaner_conteo")]==="SI"&&T[3][H.indexOf("lleva_baldes")]==="SI"&&T[3][H.indexOf("escaner_salida")]==="SI","masivo con varias opciones a la vez: prende escáner y baldes donde falten: "+JSON.stringify(r));
r=run(`localesAdminMasivo(["Torreon","Obelisco"],undefined,undefined,admin,{activo:false})`);
ok(r.ok&&r.cambiados===2&&T[2][H.indexOf("activo")]==="NO"&&T[3][H.indexOf("activo")]==="NO","dar de baja a varios de una vez");
r=run(`localesAdminMasivo(["Torreon","Obelisco","Bllis"],undefined,undefined,admin,{activo:true})`);
ok(r.ok&&r.cambiados===3&&T[2][H.indexOf("activo")]==="SI","dar de alta a varios de una vez");
ok(!run(`localesAdminMasivo(["Torreon"],undefined,undefined,admin,{clave:true})`).ok,"una de las opciones no existe: rechaza todo y no escribe nada");
console.log(f?"FALLAS "+f:"FALLAS 0"); process.exit(f?1:0);
