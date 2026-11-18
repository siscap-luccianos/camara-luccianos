// Code.gs 1.99.0: Geladot (tipo "g") — el stock y los movimientos van en GRAMOS (1 caja = 2500 g); el Control compara en KILOS.
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,parseFloat,isFinite,CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{formatDate:(d)=>new Date(d.getTime()-3*3600e3).toISOString().slice(0,10),parseDate:(s)=>new Date(s)}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) f++};
const t0=Date.parse("2026-12-01T12:00:00Z"), t1=Date.parse("2026-12-08T12:00:00Z");
const sabores=[{id:"194",nombre:"Geladot Frutilla",tipo:"g",familia:"icepops",categoria:"Geladot",peso:"2,5",cantidad_maestra:2500},{id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas",peso:"3,5"},{id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops"}];
const locales=[{nombre:"Galerías",operaciones:"NO",activo:"SI"}];
let regs=[], filas=[];
filas.push({id:"1",local:"Galerías",tipo:"inicial",ts:t0,empleado:"R",items:JSON.stringify({"194":0}),camara:JSON.stringify({"194":{u:5000,k:5}})});
filas.push({id:"2",local:"Galerías",tipo:"parcial",ts:t1,empleado:"R",items:JSON.stringify({"194":0}),camara:JSON.stringify({"194":{u:2000,k:2}})});
// tres reposiciones: 700 + 900 + 1400 g = 3000 g
[700,900,1400].forEach((g,i)=>regs.push({id:String(10+i),local:"Galerías",tipo:"salida",subtipo:"reposicion",ts:t0+(i+1)*1e6,items:JSON.stringify({"194":g}),kilos:"",pesos:"",anulado_ts:""}));
regs.push({id:"20",local:"Galerías",tipo:"salida",subtipo:"desperdicio",ts:t0+5e6,items:JSON.stringify({"194":250}),kilos:"",pesos:"",motivo:"se cayó",anulado_ts:""}); // 250 g de desperdicio: cuentan como merma
sb._hojaInventarios=()=>({}); sb._hojaPedidosConteo=()=>({});
sb._leerCrudo=h=>h==="Locales"?locales:h==="Sabores"?sabores:h==="Inventarios"?filas:h==="Registros"?regs:h==="Stock"?[{local:"Galerías",base:JSON.stringify({"194":4300,"4":5}),ts:Date.parse("2026-12-09T12:00:00Z")}]:[];
sb._puedeVerLocal=()=>true; sb._escribirCrudo=(h,o)=>{const x=Object.assign({},o,{id:String(100+regs.length)});regs.push(x);return {id:x.id}};
sb._leerUltimasFilas=()=>regs.slice(-50); sb._auditar=()=>{}; sb._invalidarCacheDatos=()=>{}; sb._pedidoPendiente=()=>null; sb._camaraContadaMes=()=>null; sb._camaraDesbloqueadaHasta=()=>null;
const run=c=>vm.runInContext(c,sb);
sb.sup={id:"9",nombre:"Super",rol:"supervisor"};
ok(run(`_grupoProducto({tipo:"g"})`)==="geladot"&&run(`_rubroDeSabor({tipo:"g"})`)==="geladot","Geladot es su propio rubro");
const r=run(`controlDetalle("Galerías","2",sup)`);
ok(r.ok,"controlDetalle responde: "+(r.error||""));
const g=(r.grupos||[]).filter(x=>x.g==="geladot")[0]; const p=g&&g.productos[0];
// inicial 5 kg · reposiciones 3 kg · desperdicio 0,25 kg (merma) · esperado 1,75 kg · contó 2 kg · dif +0,25
ok(p&&p.kg===true&&p.ini===5&&p.sal===3&&p.merma===0.25&&p.esperado===1.75&&p.tot===2&&p.dif===0.25,"Geladot en KILOS: 5 − 3 − 0,25 = 1,75 esperado, contó 2 → +0,25: "+JSON.stringify(p));
// registrar: reposicion solo para Geladot
sb.emp={id:"1",nombre:"Resp",rol:"colaborador",local:"Galerías"};
sb._stockActualLocal=()=>({"194":4300,"4":5});
let q=run(`registrar("c1","salida","Galerías",{"194":700},"",emp,"","reposicion","Caja abierta",{},{},{})`);
ok(q.ok,"cualquiera con salida puede cargar una reposición de 700 g: "+(q.error||""));
q=run(`registrar("c2","salida","Galerías",{"4":1},"",emp,"","reposicion","x",{},{},{})`);
ok(!q.ok&&/Geladot/.test(q.error),"una reposición de otro sabor se rechaza: "+q.error);
q=run(`registrar("c3","salida","Galerías",{"194":9999},"",emp,"","reposicion","x",{},{},{})`);
ok(!q.ok,"no se puede consumir más de lo que hay: "+(q.error||"").slice(0,80));
q=run(`registrarMerma("m1","Galerías","194",0.2,"camara","x",{id:"2",nombre:"R",rol:"encargado"})`);
ok(!q.ok&&/Geladot/.test(q.error),"Geladot no usa la merma en kilos (va por desperdicio en gramos): "+q.error);
console.log(f?"\n"+f+" con fallas":"\nTodo OK"); process.exit(f?1:0);
