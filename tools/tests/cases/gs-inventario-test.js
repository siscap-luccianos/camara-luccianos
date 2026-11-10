// Code.gs: guardarInventario() / corregirInventario() / inventarios() — inventario del local (fuera de la cámara).
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,isFinite,
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
 SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},
 Utilities:{formatDate:(d)=>"2026-11-10"}};
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
let r;
E("encargado");
r=run(`guardarInventario("c1","Galerías",{"4":2.5,"107":1.25,"49":10,"117":0},{"4":{k:17.5,ap:1}},emp)`);
ok(r.ok, "guarda: "+JSON.stringify(r).slice(0,120));
const inv=r.inventario;
ok(inv.items["4"]===2.5&&inv.items["107"]===1.25&&inv.items["49"]===10&&!("117" in inv.items), "items: kilos con decimales, unidades enteras, ceros no se guardan: "+JSON.stringify(inv.items));
ok(inv.camara["4"].u===5&&inv.camara["4"].k===17.5&&inv.camara["4"].ap===1, "cámara de la vasqueta: unidades del servidor + kilos aproximados del cliente");
ok(inv.camara["49"].u===48&&inv.camara["117"].u===30, "cámara de icepops y chocolatería en unidades (stock del servidor)");
ok(inv.aprox===true, "marca el inventario como aproximado");
// valor = (17,5+2,5)*8000 + 1,25*10000 + (48+10)*1700 + 30*1800 = 160000+12500+98600+54000
ok(inv.valor_total===325100, "valor total: "+inv.valor_total);
ok(inv.fecha==="2026-11-10"&&inv.empleado==="Karina", "fecha de la jornada y quién lo hizo");
ok(audit.some(a=>a[0]==="guardar_inventario"), "audita");
// validaciones
r=run(`guardarInventario("c2","Galerías",{"49":1.5},{},emp)`);
ok(!r.ok&&/inválidas/.test(r.error), "una unidad no puede tener decimales");
r=run(`guardarInventario("c3","Galerías",{"4":-1},{},emp)`);
ok(!r.ok, "no acepta negativos");
r=run(`guardarInventario("c1","Galerías",{"49":3},{},emp)`);
ok(r.ok&&r.repetido&&filas.length===1, "mismo clienteId no se guarda dos veces");
E("colaborador");
r=run(`guardarInventario("c4","Galerías",{"49":3},{},emp)`);
ok(!r.ok&&/permiso/.test(r.error), "el colaborador no puede");
// sin permiso de valor: no se guardan precios
E("turno");
r=run(`guardarInventario("c5","Sin valor",{"49":3},{},emp)`);
ok(r.ok&&r.inventario.valor_total===null&&r.inventario.precios===null&&filas[filas.length-1].precios==="", "un turno guarda sin precios ni valor");
// local de otro país: sin valor
E("admin");
r=run(`guardarInventario("c6","Chile",{"49":3},{},emp)`);
ok(r.ok&&r.inventario.valor_total===null, "locales de otro país no valorizan");
// corrección
E("encargado");
r=run(`corregirInventario("Galerías","1","4",1.5,"Me confundí al tipear",emp)`);
ok(r.ok, "corrige: "+JSON.stringify(r).slice(0,100));
ok(r.inventario.items["4"]===1.5, "queda el valor nuevo");
const c=r.inventario.cambios[0];
ok(r.inventario.cambios.length===1&&c.antes===2.5&&c.despues===1.5&&c.q==="Karina"&&c.s==="4"&&/confundí/.test(c.mot)&&c.ts>0, "registra antes, después, quién, cuándo y motivo: "+JSON.stringify(c));
ok(r.inventario.valor_total===325100-8000, "recalcula el valor con los precios guardados: "+r.inventario.valor_total);
ok(audit.some(a=>a[0]==="corregir_inventario"), "audita la corrección");
r=run(`corregirInventario("Galerías","1","4",1.5,"otra vez",emp)`);
ok(r.ok&&r.sinCambios, "si el valor no cambia no registra nada");
r=run(`corregirInventario("Galerías","1","49",12,"",emp)`);
ok(!r.ok&&/motivo/i.test(r.error), "sin motivo no corrige");
r=run(`corregirInventario("Galerías","1","49",2.5,"x pasó",emp)`);
ok(!r.ok, "unidad con decimales rechazada");
r=run(`corregirInventario("Galerías","1","117",4,"Faltaba cargarlo",emp)`);
ok(r.ok&&r.inventario.items["117"]===4&&r.inventario.cambios.length===2, "puede cargar un producto que estaba en 0");
r=run(`corregirInventario("Galerías","1","49",0,"No había nada",emp)`);
ok(r.ok&&!("49" in r.inventario.items), "dejarlo en 0 lo saca de items");
r=run(`corregirInventario("Sin valor","1","49",5,"mal local",emp)`);
ok(!r.ok&&/No se encontró ese inventario/.test(r.error), "no corrige un inventario de otro local");
E("colaborador");
r=run(`corregirInventario("Galerías","1","49",5,"mal",emp)`);
ok(!r.ok&&/permiso/.test(r.error), "colaborador no corrige");
// listado
E("turno");
r=run(`inventarios("Galerías",emp)`);
ok(r.ok&&r.inventarios.length===1&&r.verValor===false&&r.inventarios[0].precios===null&&r.inventarios[0].valor_total===null, "un turno ve el inventario pero sin precios ni valor");
E("encargado");
r=run(`inventarios("Galerías",emp)`);
ok(r.ok&&r.verValor===true&&r.inventarios[0].valor_total>0&&r.inventarios[0].precios["4"]===8000, "el responsable con stock valorizado ve el valor");
console.log(f?"FALLAS "+f:"TODO OK"); process.exit(f?1:0);
