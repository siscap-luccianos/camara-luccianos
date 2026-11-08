const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"Local prueba",kilos_reales:"SI",operaciones:"NO"},{nombre:"Obelisco CABA",operaciones:"NO"}];
const sabores=[
 {id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas",plu:"011"},
 {id:"5",nombre:"Cheesecake",tipo:"v",familia:"vasquetas"},
 {id:"110",nombre:"Dulce granizado",tipo:"b",familia:"vasquetas"},
 {id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops"},
 {id:"117",nombre:"Alfajor",tipo:"c",familia:"chocolateria"},
 {id:"172",nombre:"Red Velvet",tipo:"c",familia:"pasteleria"},{id:"188",nombre:"Croissant",tipo:"c",familia:"bolleria"},{id:"96",nombre:"Choco GF",tipo:"p",familia:"glutenfree"}];
let escritos=[], regs=[], audit=[];
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:[];
sb._puedeVerLocal=()=>true; sb._errorPaisItems=()=>null;
sb._escribirCrudo=(h,o)=>{escritos.push(o);return {id:String(escritos.length)}}; sb._invalidarCacheDatos=()=>{};
sb._datosSinCache=()=>({stock:{base:{"4":10,"5":3,"110":4,"49":9,"117":6},ts:1},registros:regs,sabores});
sb._leerUltimasFilas=()=>[]; sb._auditar=(...a)=>audit.push(a);
const run=c=>vm.runInContext(c,sb);
const E=(rol)=>{ sb.emp={id:"1",nombre:"Lucía",rol}; };
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
let r;
E("admin");
r=run(`cambioSabor("x1","Local prueba","4","5",2,8.1,"Caja mal rotulada",emp)`); ok(r.ok,"cambio válido: "+JSON.stringify(r));
const w=escritos[escritos.length-1];
ok(w.tipo==="cambio"&&w.subtipo==="cambio"&&JSON.parse(w.items)["4"]===-2&&JSON.parse(w.items)["5"]===2&&w.total===2, "guarda un movimiento «cambio» con items firmados");
ok(JSON.parse(w.kilos)["4"]===-8.1&&JSON.parse(w.kilos)["5"]===8.1, "guarda kilos firmados");
ok(w.motivo==="Caja mal rotulada"&&audit.some(a=>a[0]==="cambio_sabor"), "guarda el motivo y audita");
regs=[{tipo:"cambio",anulado:false,ts:5,items:{"4":-2,"5":2}}];
const st=run(`_stockActualLocal("Local prueba")`); ok(st["4"]===8&&st["5"]===5,"el stock del servidor suma el cambio: Banana "+st["4"]+", Cheesecake "+st["5"]);
r=run(`cambioSabor("x2","Local prueba","4","5",9,8,"Error",emp)`); ok(!r.ok&&/No hay 9 de Banana Split/.test(r.error),"no deja cambiar más de lo que hay: "+r.error);
r=run(`cambioSabor("x3","Local prueba","4","4",1,3,"m",emp)`); ok(!r.ok,"mismo sabor se rechaza");
r=run(`cambioSabor("x4","Local prueba","4","5",1,0,"m",emp)`); ok(!r.ok&&/kilos/i.test(r.error),"con kilos reales exige kilos: "+r.error);
r=run(`cambioSabor("x5","Local prueba","4","5",1,3.9,"  ",emp)`); ok(!r.ok&&/motivo/i.test(r.error),"exige motivo: "+r.error);
r=run(`cambioSabor("x6","Local prueba","4","110",1,3.9,"m",emp)`); ok(!r.ok&&/otra vasqueta/.test(r.error),"con kilos reales una vasqueta solo se cambia por otra vasqueta: "+r.error);
r=run(`cambioSabor("x7","Local prueba","4","117",1,3.9,"m",emp)`); ok(!r.ok&&/chocolater/i.test(r.error),"no aplica a chocolatería: "+r.error);
r=run(`cambioSabor("x7b","Obelisco CABA","110","172",1,0,"m",emp)`); ok(!r.ok&&/pasteler/i.test(r.error),"no aplica a pastelería: "+r.error);
r=run(`cambioSabor("x7c","Obelisco CABA","188","110",1,0,"m",emp)`); ok(!r.ok&&/bolle/i.test(r.error),"no aplica a bollería: "+r.error);
r=run(`cambioSabor("x7d","Obelisco CABA","110","96",1,0,"m",emp)`); ok(r.ok||/stock|hay/i.test(r.error||""),"balde ↔ gluten free sí se permite (si hay stock): "+JSON.stringify(r));
r=run(`cambioSabor("x8","Obelisco CABA","110","49",1,0,"m",emp)`); ok(r.ok,"local sin kilos reales: balde → icepop pasa sin kilos: "+JSON.stringify(r));
for(const rol of ["colaborador","produccion"]){ E(rol); r=run(`cambioSabor("y1","Local prueba","4","5",1,3.9,"m",emp)`); ok(!r.ok&&/responsable/.test(r.error),rol+" no puede: "+r.error) }
for(const rol of ["encargado","turno","supervisor"]){ E(rol); r=run(`cambioSabor("z-${rol}","Local prueba","4","5",1,3.9,"m",emp)`); ok(r.ok,rol+" sí puede") }
// PLU en el catálogo
ok(run(`_plu("00011")`)==="11"&&run(`_plu(6)`)==="6"&&run(`_plu("")`)==="","_plu normaliza ceros a la izquierda");
console.log(f?"FALLAS "+f:"TODO OK");
