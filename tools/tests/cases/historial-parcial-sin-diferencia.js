// Historial: un conteo parcial muestra también los sabores contados SIN diferencia (traen kilos), así los kilos de Historial cierran con Stock.
const fs=require("fs"),vm=require("vm"),path=require("path");
const src=fs.readFileSync(path.join(__dirname,"..","..","..","index.html"),"utf8");
const m=src.match(/function contadosDe\(r\)\{[\s\S]*?\n\}\n/); if(!m){console.log("FALLA no encontré contadosDe");process.exit(1)}
const sb={S:{stock:{ts:1},kilosReales:true},stockMapHasta:()=>({"1":3,"2":5,"3":7}),kilosMap:()=>({})};
vm.createContext(sb); vm.runInContext(m[0],sb);
let f=0; const ok=(c,t)=>{console.log((c?"OK   ":"FALLA")+" "+t); if(!c)f++};
const r={tipo:"cambio",subtipo:"conteo_parcial",ts:100,items:{"2":-1},kilos:{"1":14.68,"2":18.82,"3":8.77},pesos:{}};
const c=vm.runInContext("contadosDe",sb)(r);
ok(c.exacto,"es exacto (posterior al último conteo)");
ok(Object.keys(c.items).sort().join()==="1,2,3","lista los 3 sabores: el que cambió y los 2 sin diferencia: "+Object.keys(c.items));
ok(c.items["2"]===4&&c.items["1"]===3&&c.items["3"]===7,"unidades: con diferencia 5−1=4; sin diferencia queda el stock de ese momento");
const kg=Object.values(c.kilos).reduce((a,x)=>a+x,0);
ok(Math.abs(kg-42.27)<0.001,"los kilos suman 42,27 (= todo lo que se cargó): "+kg);
// sabor sin diferencia y sin kilos (local sin kilos reales): no se inventa
const c2=vm.runInContext("contadosDe",sb)({...r,kilos:{"2":1}});
ok(!("1" in c2.items),"sin kilos no aparece (no hay dato de que se contó)");
console.log(f?"FALLAS "+f:"FALLAS 0"); process.exit(f?1:0);
