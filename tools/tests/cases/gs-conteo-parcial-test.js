// Code.gs: pedido de Conteo parcial, candado con PIN y control de stock (debería haber vs contado).
const vm=require("vm"),fs=require("fs");
let NOW=Date.parse("2026-12-05T12:00:00-03:00"); class FDate extends Date{ static now(){ return NOW } }
const sb={console,Date:FDate,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},
 Utilities:{formatDate:(d)=>new Date(d.getTime()-3*3600e3).toISOString().slice(0,10)}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"Galerías",operaciones:"NO",activo:"SI"},{nombre:"Recoleta",operaciones:"NO",activo:"SI"},{nombre:"Operaciones",operaciones:"SI"}];
const sabores=[{id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas",peso:"3,5"},{id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops"}];
let inv=[],ped=[],regs=[],audit=[];
sb._hojaInventarios=()=>({}); sb._hojaPedidosConteo=()=>({});
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:h==="Inventarios"?inv:h==="PedidosConteo"?ped:h==="Registros"?regs:[];
sb._puedeVerLocal=()=>true;
const tabla=h=>h==="Inventarios"?inv:ped;
sb._escribirCrudo=(h,o)=>{const t=tabla(h);const f=Object.assign({},o,{id:String(t.length+1)});t.push(f);return {id:f.id}};
sb._actualizarCrudo=(h,id,c)=>{const f=tabla(h).filter(x=>x.id===String(id))[0];Object.assign(f,c);return {ok:true}};
sb._leerUltimasFilas=()=>inv.slice(-50);
sb._auditar=(...a)=>audit.push(a);
sb._stockActualLocal=()=>({"4":5,"49":10});
sb._datosSinCache=()=>({stock:{ts:0},registros:[]});
sb.preciosStock=()=>({ok:false});
sb.PIN_OK="1234";
sb._exigirPinAdmin=(e,pin)=>pin===sb.PIN_OK?null:{ok:false,pidePin:true,error:"PIN incorrecto."};
let CONTEOS=[]; sb.conteo=(cid,local,items,emp,venc,kilos)=>{ CONTEOS.push({cid,local,items,kilos}); return {ok:true,ts:1} };
const run=c=>vm.runInContext(c,sb);
const E=(rol)=>{ sb.emp={id:"1",nombre:"Gabi",rol}; };
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
// 1) pedido
E("encargado"); let r=run(`pedirConteoParcial("Galerías",emp)`); ok(!r.ok,"el responsable no puede pedir un conteo parcial");
E("supervisor"); r=run(`pedirConteoParcial("Galerías",emp)`); ok(r.ok&&r.pedido.estado==="pendiente","supervisión pide un conteo parcial");
const idPed=r.pedido.id;
r=run(`pedirConteoParcial("Galerías",emp)`); ok(r.ok&&r.repetido&&ped.length===1,"no duplica el pedido pendiente");
r=run(`pedirConteoParcial("Operaciones",emp)`); ok(!r.ok,"no se pide para Operaciones");
E("encargado"); r=run(`pedidoConteo("Galerías",emp)`); ok(r.ok&&r.pedido&&r.pedido.id===idPed,"el responsable ve el pedido pendiente");
E("colaborador"); r=run(`pedidoConteo("Galerías",emp)`); ok(!r.ok,"el colaborador no lo ve");
// 2) inicial (antes del parcial) y parcial
E("encargado"); NOW=Date.parse("2026-12-01T08:00:00-03:00");
r=run(`guardarInventario("i1","Recoleta",{"4":2,"49":4},{"4":{k:10},"49":{}},emp)`);
ok(r.ok&&r.inventario.tipo==="inicial","sin pedido, el guardado es un conteo inicial");
// camara 49: u=10 (stock) ; local 4
r=run(`guardarInventario("i2","Galerías",{"4":2,"49":4},{"4":{k:10}},emp)`);
ok(r.ok&&r.inventario.tipo==="inicial","inicial de Galerías (cámara 5 vasq / 10 kg + local 2 kg; icepop 10 + 4)");
// movimientos entre medio
regs.push({local:"Galerías",tipo:"ingreso",ts:Date.parse("2026-12-02T10:00:00-03:00"),items:'{"4":2,"49":6}',kilos:'{"4":7.2}'});
regs.push({local:"Galerías",tipo:"salida",ts:Date.parse("2026-12-03T10:00:00-03:00"),items:'{"4":1,"49":3}',pesos:'{"4":[3.5]}'});
regs.push({local:"Galerías",tipo:"salida",ts:Date.parse("2026-12-03T11:00:00-03:00"),items:'{"49":2}',anulado_ts:"1"});
// debería: kg 12 + 7.2 - 3.5 = 15.7 ; icepop 14 + 6 - 3 = 17
NOW=Date.parse("2026-12-05T12:00:00-03:00");
sb._stockActualLocal=()=>({"4":6,"49":17});
r=run(`guardarInventario("p1","Galerías",{"4":3.5},{"4":{k:11.2}},emp,"${idPed}")`);
ok(r.ok&&r.inventario.tipo==="parcial","con el pedido, el guardado es un conteo parcial");
ok(ped[0].estado==="hecho"&&ped[0].inventario_id===r.inventario.id,"el pedido queda hecho y atado al conteo");
r=run(`guardarInventario("p2","Galerías",{"4":3},{},emp,"${idPed}")`); ok(!r.ok,"el pedido ya hecho no se reutiliza");
// 3) control
E("encargado"); r=run(`controlStock(emp)`); ok(!r.ok,"el responsable no ve el control");
E("supervisor"); r=run(`controlStock(emp)`);
const g=r.locales.filter(x=>x.local==="Galerías")[0], rc=r.locales.filter(x=>x.local==="Recoleta")[0];
ok(g&&g.estado==="controlado","Galerías aparece controlada");
ok(Math.abs(g.debia-15.7)<0.01&&Math.abs(g.conto-14.7)<0.01&&Math.abs(g.diferencia+1)<0.01,"vasquetas: debía 15,7 kg, contó 14,7 kg (cámara 11,2 + local 3,5), faltan 1 kg: "+JSON.stringify([g.debia,g.conto,g.diferencia]));
ok(g.debiaU===17&&g.contoU===17&&g.difU===0,"icepops: sin diferencia (17 u): "+JSON.stringify([g.debiaU,g.contoU]));
ok(g.detalle.length===1&&g.detalle[0].nombre==="Banana Split","el detalle lista solo lo que difiere");
ok(rc&&rc.estado==="sin_pedir","Recoleta tiene inicial y nada pedido");
// 4) candado
const idInv=inv[1].id; E("encargado");
NOW=Date.parse("2026-12-05T13:00:00-03:00");
r=run(`corregirInventario("Galerías","${idInv}","4",3,"me confundí",emp)`); ok(!r.ok&&/bloqueado/.test(r.error),"conteo fijo: el responsable no puede corregir");
E("encargado"); r=run(`desbloquearInventario("Galerías","${idInv}","1234","recuento",emp)`); ok(!r.ok,"el responsable no puede desbloquear");
E("supervisor"); r=run(`desbloquearInventario("Galerías","${idInv}","0000","recuento",emp)`); ok(!r.ok&&r.pidePin,"PIN incorrecto: no desbloquea");
r=run(`desbloquearInventario("Galerías","${idInv}","1234","x",emp)`); ok(!r.ok,"pide un motivo");
r=run(`desbloquearInventario("Galerías","${idInv}","1234","Recuento por diferencia",emp)`); ok(r.ok&&r.desbloqueado_hasta===NOW+24*3600e3,"con PIN y motivo se desbloquea 24 h");
E("encargado"); r=run(`corregirInventario("Galerías","${idInv}","4",3,"recuento autorizado",emp)`);
ok(r.ok&&JSON.parse(inv[1].items_original)["4"]===2&&JSON.parse(inv[1].items)["4"]===3,"desbloqueado: se corrige y queda la versión original al lado");
NOW=Date.parse("2026-12-06T14:00:00-03:00");
r=run(`corregirInventario("Galerías","${idInv}","4",4,"otra",emp)`); ok(!r.ok,"pasadas las 24 h vuelve a quedar bloqueado");
// cámara contada a ciegas
E("supervisor"); r=run(`pedirConteoParcial("Recoleta",emp)`); const idPed2=r.pedido.id; E("encargado");
sb._stockActualLocal=()=>({"4":99,"49":99});
r=run(`guardarInventario("p9","Recoleta",{"4":1},{},emp,"${idPed2}",{"4":{u:2,k:7.5},"49":{u:5}})`);
ok(r.ok&&r.inventario.camara["4"].k===7.5&&r.inventario.camara["4"].u===2&&r.inventario.camara["49"].u===5,"la cámara guardada es la contada, no el stock del sistema (99): "+JSON.stringify(r.inventario&&r.inventario.camara));
sb._stockActualLocal=()=>({"4":6,"49":17});
// 5) conteo final (cierre del mes): se pide aparte, queda bloqueado y es la base del mes siguiente
inv.length=0; ped.length=0; regs.length=0; NOW=Date.parse("2026-12-01T08:00:00-03:00"); sb._stockActualLocal=()=>({"4":5,"49":10});
E("encargado"); r=run(`guardarInventario("f-i","Galerías",{"49":4},{"4":{k:10}},emp)`); ok(r.ok&&r.inventario.tipo==="inicial","inicial del mes");
E("encargado"); r=run(`pedirConteo("Galerías","final",emp)`); ok(!r.ok,"el responsable no puede pedir un conteo final");
E("supervisor"); r=run(`pedirConteoFinal_("Galerías")`.replace("pedirConteoFinal_(\"Galerías\")",`pedirConteo("Galerías","final",emp)`));
ok(r.ok&&r.pedido.tipo==="final","supervisión pide el conteo final");
const idFin=r.pedido.id;
r=run(`pedirConteo("Galerías","parcial",emp)`); ok(!r.ok&&/cierre/.test(r.error),"no se puede pedir un parcial con un final pendiente");
r=run(`pedirConteo("Galerías","final",emp)`); ok(r.ok&&r.repetido,"el mismo pedido no se duplica");
E("encargado"); r=run(`pedidoConteo("Galerías",emp)`); ok(r.ok&&r.pedido.tipo==="final","el responsable ve que es un conteo final");
regs.push({local:"Galerías",tipo:"salida",ts:Date.parse("2026-12-10T10:00:00-03:00"),items:'{"4":1}',pesos:'{"4":[3.5]}'});
NOW=Date.parse("2026-12-31T22:00:00-03:00"); sb._stockActualLocal=()=>({"4":4,"49":10});
r=run(`guardarInventario("f-f","Galerías",{"49":4},{},emp,"${idFin}",{"4":{u:2,k:6},"49":{u:10}})`);
ok(r.ok&&r.inventario.tipo==="final"&&r.inventario.fijo===true,"el conteo de cierre se guarda como «final» y queda bloqueado");
ok(r.stockAplicado===true&&CONTEOS.length===1&&CONTEOS[0].items["4"]===2&&CONTEOS[0].items["49"]===10&&CONTEOS[0].kilos["4"]===6,"el conteo final deja el stock de la cámara igual a lo contado (2 vasq / 6 kg y 10 icepops): "+JSON.stringify(CONTEOS[0]));
ok(r._final===undefined,"el dato interno no se devuelve al cliente");
r=run(`corregirInventario("Galerías","${r.inventario.id}","49",5,"motivo largo",emp)`); ok(!r.ok&&/bloqueado/.test(r.error),"no se corrige: "+JSON.stringify(r).slice(0,160));
ok(CONTEOS.length===1,"un conteo parcial NO toca el stock (solo el final lo hace)");
E("supervisor"); r=run(`controlStock(emp)`);
let gg=r.locales.filter(x=>x.local==="Galerías")[0];
ok(gg.estado==="controlado"&&gg.parcial.tipo==="final"&&gg.inicial.tipo==="inicial","el control compara el final contra el inicial del mes");
ok(Math.abs(gg.debia-6.5)<0.01&&Math.abs(gg.conto-6)<0.01,"cierre: debía 6,5 kg (10 − 3,5), contó 6 kg: "+JSON.stringify([gg.debia,gg.conto]));
// mes siguiente: un parcial se compara contra el final
E("supervisor"); r=run(`pedirConteo("Galerías","parcial",emp)`); const idP2=r.pedido.id;
NOW=Date.parse("2027-01-15T10:00:00-03:00"); E("encargado"); sb._stockActualLocal=()=>({"4":4,"49":10});
regs.push({local:"Galerías",tipo:"salida",ts:Date.parse("2027-01-05T10:00:00-03:00"),items:'{"4":1}',pesos:'{"4":[3]}'});
r=run(`guardarInventario("f-p","Galerías",{},{},emp,"${idP2}",{"4":{u:1,k:3},"49":{u:10}})`);
E("supervisor"); r=run(`controlStock(emp)`); gg=r.locales.filter(x=>x.local==="Galerías")[0];
ok(gg.inicial.tipo==="final"&&gg.parcial.tipo==="parcial","el mes siguiente, la base es el conteo final del mes anterior");
ok(Math.abs(gg.debia-3)<0.01,"debería haber: 6 kg del final − 3 kg de la salida = 3 kg: "+gg.debia);
console.log(f?"FALLAS "+f:"FALLAS 0"); process.exit(f?1:0);
