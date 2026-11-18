// Code.gs 1.98.0: Control sobre el TOTAL (cámara + local) y merma en kilos (registrarMerma).
const vm=require("vm"),fs=require("fs");
let NOW=Date.parse("2026-12-10T12:00:00Z"); class FDate extends Date{ static now(){ return NOW } }
const sb={console,Date:FDate,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},
 Utilities:{formatDate:(d)=>new Date(d.getTime()-3*3600e3).toISOString().slice(0,10)}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const locales=[{nombre:"Galerías",operaciones:"NO",activo:"SI"}];
const sabores=[
 {id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas",peso:"3,5"},
 {id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops"},
 {id:"108",nombre:"Balde Limón",tipo:"b",familia:"vasquetas"}];
const t0=Date.parse("2026-12-01T12:00:00Z"), t1=Date.parse("2026-12-08T12:00:00Z");
let regs=[], filas=[], audit=[];
filas.push({id:"1",local:"Galerías",tipo:"inicial",ts:t0,empleado:"R",items:JSON.stringify({"4":12,"49":10}),camara:JSON.stringify({"4":{k:100,u:0},"49":{k:0,u:40}})});
filas.push({id:"2",local:"Galerías",tipo:"parcial",ts:t1,empleado:"R",items:JSON.stringify({"4":13,"49":8}),camara:JSON.stringify({"4":{k:60,u:0},"49":{k:0,u:30}})});
// entre medio: ingreso de 4 vasquetas (15 kg), salida de 10 vasquetas (36 kg con pesos), una de icepops, y una merma de 0,19 kg en el local y 2 kg en cámara
regs.push({id:"10",local:"Galerías",tipo:"ingreso",subtipo:"",ts:t0+1e6,items:JSON.stringify({"4":4,"49":20}),kilos:JSON.stringify({"4":15}),pesos:"",anulado_ts:""});
regs.push({id:"11",local:"Galerías",tipo:"salida",subtipo:"",ts:t0+2e6,items:JSON.stringify({"4":10,"49":15}),kilos:"",pesos:JSON.stringify({"4":[3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6]}),anulado_ts:""});
regs.push({id:"12",local:"Galerías",tipo:"salida",subtipo:"merma_local",ts:t0+3e6,items:"{}",kilos:JSON.stringify({"4":0.19}),pesos:"",anulado_ts:""});
regs.push({id:"13",local:"Galerías",tipo:"salida",subtipo:"merma_camara",ts:t0+4e6,items:"{}",kilos:JSON.stringify({"4":2}),pesos:"",anulado_ts:""});
regs.push({id:"15",local:"Galerías",tipo:"salida",subtipo:"desperdicio",ts:t0+3.5e6,items:JSON.stringify({"49":3}),kilos:"",pesos:"",motivo:"se cayeron",anulado_ts:""}); // desperdicio de icepops: cuenta como merma, no como salida
regs.push({id:"14",local:"Galerías",tipo:"salida",subtipo:"merma_local",ts:t0+5e6,items:"{}",kilos:JSON.stringify({"4":5}),pesos:"",anulado_ts:"1"}); // anulada: no cuenta
sb._hojaInventarios=()=>({}); sb._hojaPedidosConteo=()=>({});
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:h==="Inventarios"?filas:h==="Registros"?regs:[];
sb._puedeVerLocal=()=>true;
sb._escribirCrudo=(h,o)=>{const f=Object.assign({},o,{id:String(100+regs.length)});regs.push(f);return {id:f.id}};
sb._leerUltimasFilas=()=>regs.slice(-50);
sb._auditar=(...a)=>audit.push(a);
sb._invalidarCacheDatos=()=>{};
sb._pedidoPendiente=()=>null; sb._camaraContadaMes=()=>null; sb._camaraDesbloqueadaHasta=()=>null;
const run=c=>vm.runInContext(c,sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
sb.sup={id:"9",nombre:"Super",rol:"supervisor"};
let r=run(`controlDetalle("Galerías","2",sup)`);
ok(r.ok,"controlDetalle responde: "+(r.error||""));
const vas=(r.grupos||[]).filter(g=>g.g==="vasquetas")[0]; const p4=vas&&vas.productos.filter(x=>x.id==="4")[0];
// inicial total = 100 + 12 = 112 · ingresos 15 · salidas 36 · merma 0,19 + 2 = 2,19 · esperado = 112 + 15 − 36 − 2,19 = 88,81 · contado = 60 + 13 = 73 · dif = −15,81
ok(p4&&p4.ini===112&&p4.ing===15&&p4.sal===36&&p4.merma===2.19,"vasquetas: inicial 112, ingresos 15, salidas 36, merma 2,19 (la anulada no cuenta): "+JSON.stringify(p4));
ok(p4&&p4.esperado===88.81&&p4.tot===73&&p4.dif===-15.81,"esperado 88,81 · contado 73 · diferencia −15,81 (sobre el TOTAL)");
ok(p4&&p4.difCam!==null&&p4.difCam!==p4.dif,"queda la diferencia solo de cámara como dato aparte: "+(p4&&p4.difCam));
// icepops: inicial 50 + ingreso 20 − salida 15 = 55 · contado 38 · dif −17
const ice=(r.grupos||[]).filter(g=>g.g==="icepops")[0]; const p49=ice&&ice.productos[0];
ok(p49&&p49.ini===50&&p49.ing===20&&p49.sal===15&&p49.merma===3&&p49.esperado===52&&p49.tot===38&&p49.dif===-14,"icepops en unidades: 50 + 20 − 15 − 3 (desperdicio como merma) = 52 contra 38 → −14");
ok(r.varLocal&&r.varLocal.kg===1&&r.varLocal.u===-2,"variación del local: +1 kg (13 − 12) y −2 u (8 − 10): "+JSON.stringify(r.varLocal));
ok(r.dif&&r.dif.kg===-15.81&&r.dif.u===-14,"diferencia total del encabezado: "+JSON.stringify(r.dif));
ok(r.mov&&r.mov.merma&&r.mov.merma.n===3&&r.mov.merma.kg===2.19&&r.mov.merma.u===3&&r.mov.sal.n===1,"el resumen trae la merma aparte (2 en kilos + el desperdicio de 3 icepops) y no la cuenta como salida: "+JSON.stringify(r.mov&&[r.mov.merma.n,r.mov.merma.kg,r.mov.merma.u,r.mov.sal.n]));
r=run(`controlStock(sup)`);
ok(r.ok&&r.locales[0].difKg===-15.81&&r.locales[0].difU===-14,"controlStock (lista de locales) usa la diferencia del total: "+JSON.stringify(r.locales&&[r.locales[0].difKg,r.locales[0].difU]));
// ---- merma SIN sabor (un cucurucho que se cayó: no viene de una vasqueta puntual): cuenta en el total del helado
regs.push({id:"16",local:"Galerías",tipo:"salida",subtipo:"merma_camara",ts:t0+4.5e6,items:"{}",kilos:JSON.stringify({"0":1}),pesos:"",anulado_ts:""});
let rs=run(`controlDetalle("Galerías","2",sup)`);
const vas2=(rs.grupos||[]).filter(g=>g.g==="vasquetas")[0];
ok(vas2&&vas2.productos.some(x=>x.id==="0"&&x.merma===1),"la merma sin sabor aparece como «Sin sabor específico»: "+JSON.stringify(vas2&&vas2.productos.filter(x=>x.id==="0")));
ok(rs.dif&&rs.dif.kg===-14.81,"y baja lo esperado: la diferencia total pasa de −15,81 a −14,81 (1 kg menos esperado): "+JSON.stringify(rs.dif));
ok(rs.mov&&rs.mov.merma.kg===3.19&&rs.mov.merma.n===4,"el resumen suma 3,19 kg de merma en 4 movimientos");
regs.pop(); // vuelve el escenario de antes para el resto
// ---- registrarMerma
const N=regs.length;
sb.emp={id:"1",nombre:"Resp",rol:"encargado"};
r=run(`registrarMerma("m1","Galerías","4",0.19,"local","Se cayó un cucurucho",emp)`);
ok(r.ok&&regs.length===N+1,"el responsable carga una merma de 0,19 kg del local");
const w=regs[regs.length-1];
ok(w.tipo==="salida"&&w.subtipo==="merma_local"&&w.items==="{}"&&JSON.parse(w.kilos)["4"]===0.19&&Number(w.total)===0,"se guarda como salida sin items, con los kilos y subtipo merma_local");
r=run(`registrarMerma("m9","Galerías","",0.5,"camara","Se cayó un cucurucho",emp)`);
ok(r.ok&&JSON.parse(regs[regs.length-1].kilos)["0"]===0.5,"registrarMerma sin sabor se guarda bajo «0»: "+JSON.stringify(r));
r=run(`registrarMerma("m2","Galerías","4",120,"camara","Corte de luz",emp)`);
ok(r.ok,"sin tope: 120 kg por un corte de luz se acepta");
sb.emp={id:"2",nombre:"Colab",rol:"colaborador"};
r=run(`registrarMerma("m3","Galerías","4",1,"camara","x",emp)`);
ok(!r.ok&&/responsable/i.test(r.error),"el colaborador no puede: "+r.error);
sb.emp={id:"1",nombre:"Resp",rol:"turno"};
ok(!run(`registrarMerma("m4","Galerías","4",1,"camara","",emp)`).ok,"sin motivo se rechaza");
ok(!run(`registrarMerma("m5","Galerías","4",0,"camara","x",emp)`).ok,"cero kilos se rechaza");
ok(!run(`registrarMerma("m6","Galerías","4",1,"",   "x",emp)`).ok,"sin lugar se rechaza");
ok(!run(`registrarMerma("m7","Galerías","49",1,"camara","x",emp)`).ok,"un icepop (por unidad) se rechaza: la merma es en kilos");
ok(!run(`registrarMerma("m8","Galerías","108",1,"camara","x",emp)`).ok,"un balde (por unidad) se rechaza");
sb.emp={id:"3",nombre:"Super",rol:"supervisor"};
ok(run(`registrarMerma("m9","Galerías","4",1,"camara","x",emp)`).ok,"supervisor siempre puede");
const antes=regs.length; run(`registrarMerma("m9","Galerías","4",1,"camara","x",emp)`);
ok(regs.length===antes,"el mismo clienteId no se carga dos veces");
console.log(f?"\n"+f+" con fallas":"\nTodo OK"); process.exit(f?1:0);
