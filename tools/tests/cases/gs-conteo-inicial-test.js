// Code.gs: guardarInventario() / corregirInventario() / inventarios() — inventario del local (fuera de la cámara).
const vm=require("vm"),fs=require("fs");
let NOW=Date.parse("2026-11-20T12:00:00Z"); class FDate extends Date{ static now(){ return NOW } }
const sb={console,Date:FDate,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},
 Utilities:{formatDate:(d)=>new Date(d.getTime()-3*3600e3).toISOString().slice(0,10)}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"Galerías",operaciones:"NO",stock_valorizado:"SI"},{nombre:"Sin valor",operaciones:"NO"},{nombre:"Chile",operaciones:"NO",pais:"Chile",stock_valorizado:"SI"}];
const sabores=[
 {id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas",peso:"3,5"},
 {id:"107",nombre:"Granella",tipo:"k",familia:"vasquetas"},
 {id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops"},
 {id:"117",nombre:"Alfajor",tipo:"c",familia:"chocolateria"}];
let filas=[], audit=[], precios={"4":8000,"107":10000,"49":1700,"117":1800};
sb._hojaInventarios=()=>({});
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:h==="Inventarios"?filas:[];
sb._puedeVerLocal=()=>true;
sb._escribirCrudo=(h,o)=>{const f=Object.assign({},o,{id:String(filas.length+1)});filas.push(f);return {id:f.id}};
sb._actualizarCrudo=(h,id,c)=>{const f=filas.filter(x=>x.id===String(id))[0];Object.assign(f,c);return {ok:true}};
sb._leerUltimasFilas=()=>filas.slice(-50);
sb._auditar=(...a)=>audit.push(a);
sb._stockActualLocal=()=>({"4":5,"49":48,"117":30});
sb.preciosStock=()=>({ok:true,precios});
const run=c=>vm.runInContext(c,sb);
const E=(rol)=>{ sb.emp={id:"1",nombre:"Karina",rol}; };
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
sb.NOWSET=v=>{ NOW=v };
sb._datosSinCache=()=>({stock:{ts:sb.STOCK_TS||0},registros:[]});
E("encargado");
// ---- fuera de jornada: cámara 23:40 (ART) del 30/11; local guardado a la 01:15 del 1/12 (misma jornada) o a las 05:00 (otra)
sb.STOCK_TS=Date.parse("2026-11-30T23:40:00-03:00");
NOW=Date.parse("2026-12-01T01:15:00-03:00");
let r=run(`guardarInventario("a1","Galerías",{"4":2},{},emp)`);
ok(r.ok&&r.inventario.camara_ts===sb.STOCK_TS&&r.inventario.fuera_jornada===false,"cierre a la 01:15: misma jornada, sin marca: "+JSON.stringify([r.ok,r.inventario&&r.inventario.fuera_jornada]));
NOW=Date.parse("2026-12-01T05:00:00-03:00");
r=run(`guardarInventario("a2","Galerías",{"4":2},{},emp)`);
ok(r.ok&&r.inventario.fuera_jornada===true,"cierre a las 05:00: cruza el corte de las 04:00, queda marcado");
ok(filas[filas.length-1].fuera_jornada==="SI"&&Number(filas[filas.length-1].camara_ts)===sb.STOCK_TS,"se guardan camara_ts y fuera_jornada en la hoja");
// ---- fijo desde el 1/12
ok(r.inventario.fijo===true,"guardado el 1/12 o después: queda fijo");
const idFijo=r.inventario.id;
r=run(`corregirInventario("Galerías","${idFijo}","4",3,"me confundí",emp)`);
ok(!r.ok&&/candado/i.test(r.error),"un conteo inicial con candado no se puede corregir: "+(r.error||""));
NOW=Date.parse("2026-11-20T12:00:00-03:00"); sb.STOCK_TS=0; E("admin");
r=run(`guardarInventario("p1","Galerías",{"4":2},{},emp)`);
ok(r.ok&&r.inventario.fijo===true&&r.inventario.fuera_jornada===false,"antes del 1/12 también queda con candado");
const idPr=r.inventario.id;
filas.filter(x=>x.id===String(idPr))[0].desbloqueado_hasta=NOW+36e5; // supervisión lo desbloquea
r=run(`corregirInventario("Galerías","${idPr}","4",3,"me confundí",emp)`);
ok(r.ok&&r.inventario.fijo===true,"desbloqueado se corrige una vez y el candado vuelve a cerrarse: "+(r.error||""));
console.log(f?"FALLAS "+f:"FALLAS 0"); process.exit(f?1:0);
