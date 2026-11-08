const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,RegExp};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const S=(id,nombre,fam,cat,tipo)=>({id:String(id),nombre,tipo:tipo||"v",familia:fam,categoria:cat});
const cat=[S(1,"Alfajor de nuez Lucciano's","vasquetas","Dulces de leche"),S(3,"Alfajor pistacchio","vasquetas","Cremas"),S(34,"Pistacchio","vasquetas","Cremas"),
 S(46,"Chantilly","vasquetas","Cremas","b"),S(68,"Alfajor","icepops","Cannoli","i"),S(65,"Dulce de Leche","icepops","Cannoli","i"),S(75,"Crema Chantilly","icepops","Bañados","i"),
 S(79,"Chocolate Lucciano's con Dulce de Leche","icepops","Bañados","i"),S(62,"Icepop Chocotorta (Selección 10 - Copa América)","icepops","Luxury","i"),S(53,"Jameson Icepop (Luxury Jameson Negro)","icepops","Luxury","i"),
 S(56,"Vegan 72% (Sorbete Dark 72% - 100% Vegetal)","icepops","Luxury","i")];
sb.cat=cat; let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
const nd=n=>{sb.n=n;return vm.runInContext("_nombreDeRenglon(n)",sb)};
ok(nd("ICE POPS LUXURY - SELECCION 10 - COPA AMERICA")==="SELECCION 10 - COPA AMERICA","nombre conserva «SELECCION 10 - COPA AMERICA»");
ok(nd("SIN GLUTEN - N°07 - SORBETE DARK 72% - LIBRE DE GLUTEN - 100% VEGETAL").startsWith("N°07 - SORBETE"),"Sin gluten: saca solo el encabezado");
ok(nd("OLI KING")==="OLI KING","sin encabezado: igual");
const fb=(nombre)=>{ sb.n=nombre; return vm.runInContext(`(function(){const sec=_seccionDeRenglon(n); if(!sec) return null; const esB=/balde/i.test(n); const c=sec.familia==="vasquetas"?cat.filter(x=>(x.tipo==="b")===esB):cat; const m=_matchearSabor(_nombreDeRenglon(n),c,sec.familia,sec.categoria,true); return m&&m.sabor.id})()`,sb)};
ok(fb("SABORES - ALFAJOR DE PISTACCHIO LUCCIANOS")!=="34","Alfajor de pistacchio NO cae en la vasqueta Pistacchio ("+fb("SABORES - ALFAJOR DE PISTACCHIO LUCCIANOS")+")");
ok(fb("ICE POPS BAÑADOS - CHANTILLY & CROCANTE")!=="46","Chantilly & Crocante NO cae en el Balde Chantilly ("+fb("ICE POPS BAÑADOS - CHANTILLY & CROCANTE")+")");
ok(fb("ICE POPS BAÑADOS - CHOCOLATE & DULCE DE LECHE")!=="65","Bañados Chocolate & DDL NO cae en Cannoli DDL ("+fb("ICE POPS BAÑADOS - CHOCOLATE & DULCE DE LECHE")+")");
ok(fb("CANNOLIS - MINI CANNOLI - ALFAJOR")==="68","Cannoli Alfajor -> 68");
console.log(f?"RESULTADO: "+f+" fallo(s)":"RESULTADO: todo OK");
