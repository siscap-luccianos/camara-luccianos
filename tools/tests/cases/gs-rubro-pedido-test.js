// Code.gs 1.113.0: parcial de UN solo rubro (solicitud, guardado, control) y reconteo habilitado de un solo rubro.
const vm=require("vm"),fs=require("fs");
let NOW=Date.parse("2026-12-05T12:00:00-03:00"); class FDate extends Date{ static now(){ return NOW } }
const sb={console,Date:FDate,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){return true},releaseLock(){}})},
 Utilities:{formatDate:(d)=>new Date(d.getTime()-3*3600e3).toISOString().slice(0,10)}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"A",activo:"SI"},{nombre:"B",activo:"SI",lleva_baldes:"NO"},{nombre:"Operaciones",operaciones:"SI"}];
const sabores=[{id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas",peso:"3,5"},{id:"20",nombre:"Frutilla",tipo:"v",familia:"vasquetas",peso:"3,5"},{id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops"}];
let inv=[],ped=[],regs=[],audit=[];
sb._hojaInventarios=()=>({}); sb._hojaPedidosConteo=()=>({});
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:h==="Inventarios"?inv:h==="PedidosConteo"?ped:h==="Registros"?regs:h==="Empleados"?[]:[];
sb._puedeVerLocal=()=>true;
const tabla=h=>h==="Inventarios"?inv:ped;
sb._escribirCrudo=(h,o)=>{const t=tabla(h);const f=Object.assign({},o,{id:String(t.length+1)});t.push(f);return {id:f.id}};
sb._actualizarCrudo=(h,id,c)=>{const f=tabla(h).filter(x=>x.id===String(id))[0];Object.assign(f,c);return {ok:true}};
sb._leerUltimasFilas=()=>inv.slice(-50);
sb._auditar=(...a)=>audit.push(a);
sb._stockActualLocal=()=>({"4":5,"20":4,"49":10});
sb._datosSinCache=()=>({stock:{ts:0},registros:[]});
sb.preciosStock=()=>({ok:false});
sb._coberturaMes=()=>null;
sb._exigirPinAdmin=(e,pin)=>pin==="1234"?null:{ok:false,pidePin:true,error:"PIN incorrecto."};
const run=c=>vm.runInContext(c,sb);
const E=(rol,nombre)=>{ sb.emp={id:"1",nombre:nombre||"Gabi",rol}; };
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};

// 1) solicitud de un parcial de un rubro
E("supervisor","Laura");
let r=run(`pedirConteo("A","parcial",emp,"vasquetas")`);
ok(r.ok&&r.pedido.rubro==="vasquetas"&&ped[0].rubro==="vasquetas","el parcial se pide con rubro y queda guardado");
ok(run(`pedirConteo("A","parcial",emp,"vasquetas")`).repetido===true,"el mismo pedido es repetido");
r=run(`pedirConteo("A","parcial",emp,"icepops")`); ok(!r.ok&&/anulala/.test(r.error),"otro rubro con uno pendiente: avisa");
r=run(`pedirConteo("A","parcial",emp,"")`); ok(!r.ok&&/todo el local|anulala/.test(r.error),"todo el local con uno de rubro pendiente: avisa");
ped.length=0;
ok(!run(`pedirConteo("A","final",emp,"vasquetas")`).ok,"el cierre rechaza el rubro");
ok(!run(`pedirConteo("A","inicial",emp,"vasquetas")`).ok,"el inicial rechaza el rubro");
ok(!run(`pedirConteo("A","parcial",emp,"helados")`).ok,"rubro inexistente rechazado");
ok(!run(`pedirConteo("B","parcial",emp,"baldes")`).ok&&/no lleva/i.test(run(`pedirConteo("B","parcial",emp,"baldes")`).error),"un local que no lleva el rubro lo rechaza");
r=run(`pedirConteo("A","parcial",emp)`); ok(r.ok&&r.pedido.rubro==="","sin rubro = todo el local (cliente viejo)");
ped.length=0;
E("encargado"); ok(!run(`pedirConteo("A","parcial",emp,"vasquetas")`).ok,"el responsable no puede pedir");
// masivo
E("supervisor","Laura");
r=run(`pedirConteoMasivo(["A","B","Operaciones"],"parcial",emp,"baldes")`);
ok(r.ok&&r.pedidos===1&&r.sinRubro.join()==="B"&&ped.length===1&&ped[0].local==="A"&&ped[0].rubro==="baldes","masivo: el rubro va a todos y B (no lleva baldes) se omite y avisa");
ok(r.errores.some(e=>e.local==="B"&&/no lleva/i.test(e.error)),"masivo: el aviso dice que no lo lleva");
ok(!run(`pedirConteoMasivo(["A"],"final",emp,"baldes")`).ok,"masivo: el cierre rechaza el rubro");
ped.length=0;
r=run(`pedirConteoMasivo(["A"],"parcial",emp)`); ok(r.ok&&r.pedidos===1&&ped[0].rubro==="","masivo sin rubro como antes");
ok(run(`_pedidoPublico({id:"1",local:"A",tipo:"parcial",rubro:"icepops"})`).rubro==="icepops"&&run(`_pedidoPublico({id:"1",local:"A",tipo:"parcial"})`).rubro==="","_pedidoPublico devuelve el rubro (vacío si no hay)");
ped.length=0;

// 2) el responsable hace el parcial de Vasquetas
E("supervisor","Laura"); NOW=Date.parse("2026-12-01T08:00:00-03:00"); E("encargado","Marta");
run(`guardarInventario("i1","A",{"4":2,"49":4},{"4":{k:10},"49":{}},emp)`);
NOW=Date.parse("2026-12-05T12:00:00-03:00"); E("supervisor","Laura");
r=run(`pedirConteo("A","parcial",emp,"vasquetas")`); const idPed=r.pedido.id;
E("encargado","Marta");
r=run(`guardarInventario("p0","A",{"4":3,"49":2},{"4":{k:11}},emp,"${idPed}",{"4":{u:5,k:11}})`);
ok(!r.ok&&/solo de Vasquetas/.test(r.error)&&/Frutilla icepop/.test(r.error),"un parcial de Vasquetas rechaza un icepop contado");
r=run(`guardarInventario("p1","A",{"4":3},{"4":{k:11}},emp,"${idPed}",{"4":{u:5,k:11}})`);
ok(r.ok&&r.inventario.tipo==="parcial"&&r.inventario.oculto&&r.inventario.rubro==="vasquetas","el parcial de un rubro se guarda con su rubro");
ok(inv[inv.length-1].rubro==="vasquetas"&&ped[0].estado==="hecho","queda el rubro en Inventarios y el pedido cerrado");
// 3) control: solo se compara el rubro
E("supervisor","Laura");
r=run(`controlDetalle("A","",emp)`);
const gs=r.grupos.map(g=>g.g);
ok(r.ok&&r.conteo.tipo==="parcial"&&r.conteo.rubro==="vasquetas","el detalle muestra el rubro del parcial");
ok(gs.indexOf("icepops")===-1,"el control no compara los demás rubros (si no, el icepop saldría como faltante)");
const cs=run(`controlStock(emp)`).locales.filter(x=>x.local==="A")[0];
ok(cs.rubrosOff.length===0&&run(`controlStock(emp)`).locales.filter(x=>x.local==="B")[0].rubrosOff.indexOf("baldes")!==-1,"controlStock informa los rubros apagados de cada local");
ok(cs.difU===0,"la diferencia de unidades no cuenta los demás rubros: "+cs.difU);

// 4) habilitar reconteo de un solo rubro (inicial, todo el local sin rubro)
const idIni=inv[0].id, idPar=inv[inv.length-1].id;
E("encargado","Marta"); ok(!run(`desbloquearInventario("A","${idIni}","1234","recuento",emp,"icepops")`).ok,"el responsable no puede habilitar");
E("supervisor","Laura");
ok(!run(`desbloquearInventario("A","${idIni}","1234","recuento",emp,"helados")`).ok,"habilitar: rubro inexistente rechazado");
ok(!run(`desbloquearInventario("B","${idIni}","1234","recuento",emp,"icepops")`).ok,"habilitar: el conteo es de otro local");
ok(!run(`desbloquearInventario("A","${idPar}","1234","recuento",emp,"icepops")`).ok,"un parcial de Vasquetas no se puede habilitar para otro rubro");
r=run(`desbloquearInventario("A","${idPar}","1234","recuento",emp)`);
ok(r.ok&&r.rubro==="vasquetas"&&inv[inv.length-1].desbloqueo_rubro==="vasquetas","un parcial de un rubro se habilita solo de ese rubro");
r=run(`desbloquearInventario("A","${idIni}","1234","recuento de icepops",emp,"icepops")`);
ok(r.ok&&r.rubro==="icepops"&&inv[0].desbloqueo_rubro==="icepops"&&JSON.parse(inv[0].desbloqueo)[0].rubro==="icepops","el inicial se habilita solo para Icepops y queda en el registro");
E("encargado","Marta");
r=run(`corregirInventario("A","${idIni}","4",9,"me equivoqué",emp)`);
ok(!r.ok&&/solo para Icepops/.test(r.error),"con el reconteo de Icepops no se puede tocar una vasqueta");
const antes4=JSON.parse(inv[0].items)["4"];
r=run(`corregirInventario("A","${idIni}","49",7,"recontamos",emp)`);
ok(r.ok&&JSON.parse(inv[0].items)["49"]===7&&JSON.parse(inv[0].items)["4"]===antes4,"se corrige el producto del rubro y las vasquetas quedan como estaban");
ok(inv[0].desbloqueado_hasta>NOW,"con un rubro habilitado el candado sigue abierto para recontar el resto del rubro");
const cb=JSON.parse(inv[0].cambios); ok(cb.length===1&&cb[0].rb==="icepops"&&cb[0].q==="Marta"&&cb[0].ts&&cb[0].rec,"la corrección queda con quién, cuándo y de qué rubro");
ok(!!inv[0].items_original,"el conteo original se conserva");
r=run(`corregirInventario("A","${idIni}","49",8,"recontamos otra vez",emp)`); ok(r.ok,"se puede seguir corrigiendo ese rubro");
E("supervisor","Laura");
r=run(`controlDetalle("A","${idIni}",emp)`);
ok(r.conteo.corrRubros.icepops&&r.conteo.corrRubros.icepops.n===1&&r.conteo.corrRubros.icepops.q==="Marta","en el resumen: Icepops · corregido ×1 (un reconteo, aunque se corrigió dos veces)");
// segundo reconteo del mismo rubro = ×2
NOW+=1000; run(`desbloquearInventario("A","${idIni}","1234","otra vez",emp,"icepops")`);
E("encargado","Marta"); run(`corregirInventario("A","${idIni}","49",9,"tercera",emp)`);
E("supervisor","Laura"); r=run(`controlDetalle("A","${idIni}",emp)`);
ok(r.conteo.corrRubros.icepops.n===2,"un segundo reconteo del rubro cuenta ×2");
// habilitar todo el local limpia el rubro
NOW+=1000; run(`desbloquearInventario("A","${idIni}","1234","todo",emp)`);
ok(inv[0].desbloqueo_rubro==="","habilitar todo el local deja el reconteo sin rubro");
E("encargado","Marta"); r=run(`corregirInventario("A","${idIni}","4",6,"vasquetas ahora",emp)`);
ok(r.ok&&inv[0].desbloqueado_hasta===0,"todo el local: una corrección y se vuelve a cerrar (como siempre)");
// 5) cliente viejo: sin rubro
const antesPed=ped.length;
E("supervisor","Laura"); ped.length=0; r=run(`pedirConteoParcial("A",emp)`); ok(r.ok&&r.pedido.rubro==="","pedirConteoParcial sin rubro sigue andando");
// 6) (1.114.0) varios rubros en un mismo pedido
E("supervisor","Laura"); ped.length=0;
r=run(`pedirConteo("A","parcial",emp,"icepops, vasquetas")`);
ok(r.ok&&r.pedido.rubro==="vasquetas,icepops"&&ped[0].rubro==="vasquetas,icepops","dos rubros: se guardan normalizados y en orden fijo");
ok(run(`pedirConteo("A","parcial",emp,"vasquetas,icepops")`).repetido===true,"el mismo par de rubros es repetido");
ok(!run(`pedirConteo("A","parcial",emp,"vasquetas")`).ok,"un solo rubro con un par pendiente: avisa");
ok(!run(`pedirConteo("A","final",emp,"vasquetas,icepops")`).ok,"el cierre rechaza varios rubros");
ok(!run(`pedirConteo("A","parcial",emp,"vasquetas,helados")`).ok,"un rubro inexistente en la lista se rechaza");
ok(!run(`pedirConteo("B","parcial",emp,"vasquetas,baldes")`).ok,"si el local no lleva uno de los rubros, lo rechaza");
ok(run(`_rubroEnLista({familia:"icepops"},"vasquetas,icepops")`)===true&&run(`_rubroEnLista({familia:"chocolateria"},"vasquetas,icepops")`)===false,"_rubroEnLista acepta cualquiera de los rubros y rechaza el resto");
ok(run(`_txtRubro("vasquetas,icepops")`)==="Vasquetas + Icepops","el texto une los nombres");
console.log("FALLAS "+f); process.exit(f?1:0);
