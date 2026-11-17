// Code.gs: un conteo con números imposibles (ej. 2 vasquetas con 7400 kg) se rechaza.
const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,isFinite,CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({tryLock(){},releaseLock(){}})},Utilities:{}};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c) f++};
const cat=[{id:4,nombre:"Banana Split",tipo:"v",familia:"vasquetas"},{id:49,nombre:"Frutilla icepop",tipo:"i",familia:"icepops"},{id:106,nombre:"Crumble",tipo:"k",familia:"vasquetas"}];
sb.cat=cat;
const imp=(items,kilos,pesos)=>{ sb.a=items; sb.b=kilos||{}; sb.c=pesos||{}; return vm.runInContext("_conteoImposible(a,b,c,cat)",sb) };
let r=imp({4:2},{4:7400}); ok(r&&/Banana Split/.test(r)&&/7400/.test(r),"2 vasquetas con 7400 kg se rechaza: "+r);
ok(imp({4:2},{4:7.4})===null,"2 vasquetas con 7,4 kg está bien");
ok(imp({4:2},{4:24})===null,"2 vasquetas con 24 kg (12 cada una) está en el límite");
ok(imp({4:2},{4:25})!==null,"2 vasquetas con 25 kg no puede ser");
ok(imp({4:600},{})!==null,"600 vasquetas de un sabor no puede ser");
ok(imp({4:3},{4:11},{4:[3.5,3.7,4]})===null,"pesadas normales: está bien");
ok(imp({4:2},{4:7},{4:[3.5,350]})!==null,"una pesada de 350 kg no puede ser");
ok(imp({49:6794})===null,"6794 icepops es posible");
ok(imp({49:90000})!==null,"90000 icepops no puede ser");
ok(imp({106:40},{106:40})===null,"el crumble se cuenta en kilos y no se evalúa como vasquetas");
ok(imp({4:0},{4:5000})===null,"si no hay vasquetas contadas no se evalúa");
// ingresos (remito, producción, devolución)
const ki=(sub,items,kilos)=>{ sb.s_=sub; sb.i_=items; sb.k_=kilos; return vm.runInContext("_kgVasqImposible(s_,i_,k_,cat)",sb) };
ok(ki("produccion",{4:12},{4:12})!==null,"producción: 12 vasquetas con 12 kg (1 kg cada una) se rechaza");
ok(ki("",{4:12},{4:12})!==null,"remito: 12 vasquetas con 12 kg se rechaza");
ok(ki("",{4:4},{4:14.57})===null,"remito: 4 vasquetas con 14,57 kg está bien");
ok(ki("produccion",{4:2},{4:7400})!==null,"producción: 2 vasquetas con 7400 kg se rechaza");
ok(ki("devolucion",{4:1},{4:1.1})===null,"devolución: una vasqueta abierta de 1,1 kg es posible");
ok(ki("devolucion",{4:1},{4:30})!==null,"devolución: una vasqueta de 30 kg no puede ser");
ok(ki("",{49:50},{})===null,"los icepops no se evalúan");
console.log(f?"FALLAS "+f:"TODO OK"); process.exit(f?1:0);
