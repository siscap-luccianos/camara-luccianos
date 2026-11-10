// Servidor: local que solo fabrica (Locales.ingreso_solo_produccion=SI + produccion=SI) rechaza un ingreso común de helado.
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[
 {nombre:"Marruecos",produccion:"SI",ingreso_solo_produccion:"SI",operaciones:"NO"},
 {nombre:"Unicenter",produccion:"SI",operaciones:"NO"},
 {nombre:"Sin flag de producción",produccion:"",ingreso_solo_produccion:"SI",operaciones:"NO"},
 {nombre:"Obelisco CABA",operaciones:"NO"}];
const sabores=[{id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas"},{id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops"},{id:"108",nombre:"Choco torta",tipo:"b",familia:"vasquetas"},{id:"96",nombre:"GF",tipo:"p",familia:"glutenfree"},{id:"117",nombre:"Alfajor",tipo:"c",familia:"chocolateria",categoria:"Alfajores"}];
let escritos=[];
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:[];
sb._puedeVerLocal=()=>true; sb._errorPaisItems=()=>null;
sb._escribirCrudo=(h,o)=>{escritos.push(o);return {id:"1"}}; sb._invalidarCacheDatos=()=>{};
sb._datosSinCache=()=>({stock:null,registros:[]});
sb._leerUltimasFilas=()=>[]; sb._auditar=()=>{};
const emp={id:"1",nombre:"Gabi",rol:"admin"}; sb.emp=emp;
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
const reg=(id,loc,items,sub)=>run(`registrar("${id}","ingreso","${loc}",${JSON.stringify(items)},"R",emp,"","${sub||""}",undefined,{},{},{})`);
let r;
for (const [id,items,txt] of [["a1",{"4":4},"vasquetas"],["a2",{"49":30},"icepops"],["a3",{"108":2},"baldes"],["a4",{"96":5},"gluten free"],["a5",{"117":10,"4":1},"helado mezclado con chocolatería"]]) {
  r=reg(id,"Marruecos",items); ok(!r.ok&&/Ingreso de producción/.test(r.error||""),"Marruecos rechaza un ingreso común de "+txt+": "+(r.error||JSON.stringify(r)));
}
r=reg("b1","Marruecos",{"4":4},"produccion"); ok(r.ok,"Marruecos acepta producción: "+JSON.stringify(r));
r=reg("b2","Marruecos",{"49":30},"produccion"); ok(r.ok,"Marruecos acepta producción de icepops");
r=reg("c1","Marruecos",{"117":10}); ok(r.ok,"Marruecos acepta un ingreso común que NO es helado (chocolatería): "+JSON.stringify(r));
r=reg("d1","Unicenter",{"4":4}); ok(r.ok,"Unicenter (sin el flag) sigue aceptando ingreso común: "+JSON.stringify(r));
r=reg("d2","Unicenter",{"4":4},"produccion"); ok(r.ok,"Unicenter acepta producción");
r=reg("e1","Sin flag de producción",{"4":4}); ok(r.ok,"el flag no vale si el local no tiene produccion=SI");
r=reg("f1","Obelisco CABA",{"4":4}); ok(r.ok,"un local común no cambia");
console.log(f?"FALLAS "+f:"TODO OK");
