const vm=require("vm"),fs=require("fs");
const sb={console,Date,Math,JSON,String,Number,Array,Object,RegExp};
vm.createContext(sb); vm.runInContext(fs.readFileSync(require("path").join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8"),sb);
const S=(id,nombre,cat)=>({id:String(id),nombre,tipo:"i",familia:"icepops",categoria:cat,cantidad_maestra:25});
const cat=[S(77,"Chocolate & Crocante","Bañados"),S(83,"Oli Chocolate Platino","Bañados"),S(84,"Oli Dolca","Bañados"),S(85,"Oli King","Bañados"),S(86,"Vito Crema del Cielo","Bañados"),
 S(54,"Double Chocolate & King","Luxury"),S(55,"Double Chocolate & Chocolate","Luxury"),S(57,"Pistacchio","Luxury")];
sb.cat=cat; let f=0; const ok=(c,m)=>{console.log((c?"OK   ":"FALLA")+" "+m); if(!c)f++};
const corr=(nombre,id)=>{sb.n=nombre; sb.s=cat.find(x=>x.id==id); const r=vm.runInContext("_corregirPorNombre(n,s,cat)",sb); return r?r.id:null};
ok(corr("ICE POPS BAÑADOS - OLI DOLCA","85")==="84","IA puso Oli King pero el renglón dice Oli Dolca -> corrige a Dolca");
ok(corr("OLI CHOCOLATE PLATINO","85")==="83","IA puso Oli King pero dice Oli Chocolate Platino -> corrige a Platino");
ok(corr("OLI KING","85")===null,"Oli King bien puesto: no toca nada");
ok(corr("ICE POPS BAÑADOS - OLI KING","84")==="85","IA puso Dolca pero dice Oli King -> corrige a King");
ok(corr("ICE POPS LUXURY - DOUBLE CHOCOLATE & KING","55")==="54","Double & King mal puesto -> corrige");
ok(corr("ICE POPS LUXURY - DOUBLE CHOCOLATE & CHOCOLATE","54")==="55","Double & Chocolate mal puesto -> corrige");
ok(corr("ICE POPS BAÑADOS - CHOCOLATE & CROCANTE","77")===null,"renglón normal sin hermanos parecidos: no toca");
ok(corr("ICE POPS LUXURY - PISTACCHIO","57")===null,"Pistacchio Luxury: no toca");
console.log(f?"RESULTADO: "+f+" fallo(s)":"RESULTADO: todo OK");
