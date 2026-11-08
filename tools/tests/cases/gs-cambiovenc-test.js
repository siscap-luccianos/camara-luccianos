const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const sabores=[{id:"117",nombre:"Alfajor Semiamargo",familia:"chocolateria",categoria:"Alfajores"},{id:"150",nombre:"Lata",familia:"chocolateria",categoria:"Latas"},{id:"4",nombre:"Banana",familia:"vasquetas",categoria:""}];
let escritos=[], aud=[];
sb._leerCrudo=h=>h==="Sabores"?sabores:[];
sb._puedeVerLocal=()=>true; sb._leerUltimasFilas=()=>[];
sb._escribirCrudo=(h,o)=>{escritos.push(o);return {id:"9"}}; sb._invalidarCacheDatos=()=>{};
sb._auditar=(...a)=>aud.push(a);
sb._stockActualLocal=()=>({"117":300,"150":5,"4":10});
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
const adm={id:"1",nombre:"Gabi",rol:"admin"}, col={id:"2",nombre:"Col",rol:"colaborador"};
sb.adm=adm; sb.col=col;
const ult=()=>JSON.parse(escritos[escritos.length-1].vencimientos)["117"];
let r;
// lote de 60 con fecha A
r=run(`cambiarVencimiento("a1","Local prueba","117","2027-01-17","2027-01-17",100,60,adm)`); ok(r.ok,"subir 60→100 con la misma fecha: "+JSON.stringify(r));
ok(JSON.stringify(ult())===JSON.stringify([{f:"2027-01-17",c:40}]),"toma 40 de «sin fecha» (sin de): "+JSON.stringify(ult()));
r=run(`cambiarVencimiento("a2","Local prueba","117","2027-01-17","2027-01-17",50,60,adm)`); ok(r.ok,"bajar 60→50");
ok(JSON.stringify(ult())===JSON.stringify([{f:"",c:10,de:"2027-01-17"}]),"10 vuelven a sin fecha: "+JSON.stringify(ult()));
r=run(`cambiarVencimiento("a3","Local prueba","117","2027-01-17","2027-02-01",60,60,adm)`); ok(r.ok&&JSON.stringify(ult())===JSON.stringify([{f:"2027-02-01",c:60,de:"2027-01-17"}]),"solo fecha: "+JSON.stringify(ult()));
r=run(`cambiarVencimiento("a4","Local prueba","117","2027-01-17","2027-02-01",40,60,adm)`); ok(r.ok&&JSON.stringify(ult())===JSON.stringify([{f:"2027-02-01",c:40,de:"2027-01-17"},{f:"",c:20,de:"2027-01-17"}]),"fecha + cantidad: "+JSON.stringify(ult()));
r=run(`cambiarVencimiento("a5","Local prueba","117","2027-01-17","",0,60,adm)`); ok(r.ok&&JSON.stringify(ult())===JSON.stringify([{f:"",c:60,de:"2027-01-17"}]),"0 = todo vuelve a sin fecha: "+JSON.stringify(ult()));
const reg=escritos[escritos.length-1]; ok(reg.tipo==="etiquetado" && JSON.parse(reg.items)["117"]===60,"movimiento etiquetado");
ok(aud.length===5 && aud[0][0]==="cambiar_vencimiento","queda en Auditoría");
r=run(`cambiarVencimiento("b1","Local prueba","117","2027-01-17","2027-01-17",60,60,adm)`); ok(!r.ok&&/nada para cambiar/.test(r.error),"sin cambios se rechaza: "+r.error);
r=run(`cambiarVencimiento("b2","Local prueba","117","2027-01-17","hoy",5,60,adm)`); ok(!r.ok,"fecha inválida se rechaza: "+r.error);
r=run(`cambiarVencimiento("b3","Local prueba","117","2027-01-17","2027-02-01",-1,60,adm)`); ok(!r.ok,"cantidad negativa se rechaza");
r=run(`cambiarVencimiento("b4","Local prueba","117","2027-01-17","2027-02-01",301,60,adm)`); ok(!r.ok&&/menos unidades/.test(r.error),"más que el stock se rechaza: "+r.error);
r=run(`cambiarVencimiento("b5","Local prueba","150","2027-01-17","2027-02-01",1,1,adm)`); ok(!r.ok&&/latas/i.test(r.error),"latas se rechazan: "+r.error);
r=run(`cambiarVencimiento("b6","Local prueba","4","2027-01-17","2027-02-01",1,1,adm)`); ok(!r.ok&&/chocolatería/.test(r.error),"no chocolatería se rechaza: "+r.error);
r=run(`cambiarVencimiento("b7","Local prueba","117","2027-01-17","2027-02-01",1,1,col)`); ok(!r.ok&&/responsable/.test(r.error),"colaborador no puede: "+r.error);
console.log(f?"FALLAS "+f:"TODO OK");
