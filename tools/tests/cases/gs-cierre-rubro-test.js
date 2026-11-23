// Code.gs: cerrarConteoRubro() — «Guardar definitivo» cierra el candado de un rubro; conteoParcial lo rechaza (salvo supervisión).
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){},getActiveSpreadsheet:()=>({getSheetByName:()=>({}),insertSheet:()=>({getRange:()=>({setValues:()=>({setFontWeight:()=>({setBackground:()=>({setFontColor(){}})})})}),setFrozenRows(){}})})},
 LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{formatDate:(d,tz,f)=>new Date(d.getTime()-3*3600e3).toISOString().slice(0,f==="yyyy-MM"?7:10)}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"Local prueba",operaciones:"NO"},{nombre:"Obelisco CABA",operaciones:"NO"}];
const sabores=[{id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas"},{id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops"}];
let cierres=[], audit=[], escritos=[];
sb._hojaInventarios=()=>({}); sb._hojaCierres=()=>({});
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:h==="CierresConteo"?cierres:[];
sb._puedeVerLocal=()=>true;
sb._escribirCrudo=(h,o)=>{ if(h==="CierresConteo") cierres.push(o); else escritos.push(o); return {id:String(cierres.length+escritos.length)} };
sb._invalidarCacheDatos=()=>{}; sb._auditar=(...a)=>audit.push(a); sb._leerUltimasFilas=()=>[];
sb._datosSinCache=()=>({stock:{base:{"4":10,"49":9},ts:1},registros:[],sabores});
const run=c=>vm.runInContext(c,sb);
const E=rol=>{ sb.emp={id:"1",nombre:"Lucía",rol} };
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
let r;
E("encargado");
ok(JSON.stringify(run(`_rubrosCerrados("Local prueba")`))==="[]","al principio no hay rubros cerrados");
r=run(`conteoParcial("a1","Local prueba","vasquetas",{"4":12},emp)`);
ok(r.ok,"antes de cerrar se puede contar y guardar: "+JSON.stringify(r));
r=run(`conteoParcial("a2","Local prueba","vasquetas",{"4":11},emp)`);
ok(r.ok,"y se puede volver a guardar el mismo rubro (todavía no es definitivo)");
E("colaborador"); r=run(`cerrarConteoRubro("Local prueba",["vasquetas"],emp)`); ok(!r.ok,"el colaborador no puede cerrar el conteo");
E("encargado"); r=run(`cerrarConteoRubro("Local prueba",["vasquetas"],emp)`);
ok(r.ok&&r.rubrosCerrados.join()==="vasquetas","el encargado cierra Vasquetas: "+JSON.stringify(r));
ok(audit.some(a=>a[0]==="cerrar_conteo_rubro"),"queda en la bitácora");
r=run(`cerrarConteoRubro("Local prueba",["vasquetas"],emp)`); ok(r.ok&&cierres.length===1,"cerrar dos veces no duplica el cierre");
r=run(`conteoParcial("a3","Local prueba","vasquetas",{"4":9},emp)`);
ok(!r.ok&&/cerr/i.test(r.error||""),"cerrado: el encargado ya no puede guardar Vasquetas: "+(r.error||""));
r=run(`conteoParcial("a4","Local prueba","icepops",{"49":5},emp)`);
ok(r.ok,"los otros rubros siguen abiertos (Icepops)");
r=run(`conteoParcial("a5","Obelisco CABA","vasquetas",{"4":9},emp)`);
ok(r.ok,"otro local no se ve afectado");
sb.emp={id:"2",nombre:"Sup",rol:"supervisor"}; r=run(`conteoParcial("a6","Local prueba","vasquetas",{"4":9},emp)`);
ok(r.ok,"supervisión puede seguir contando un rubro cerrado");
cierres[0].mes="2020-01"; ok(JSON.stringify(run(`_rubrosCerrados("Local prueba")`))==="[]","un cierre de otro mes no cuenta");
console.log(f?"FALLAS "+f:"FALLAS 0"); process.exit(f?1:0);
