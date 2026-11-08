const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=require("path").join(__dirname,"..","..","..");
const db={regs:[{id:"900",tipo:"ingreso",subtipo:"",local:"Marruecos",empleadoId:"1",empleado:"Gabi Busquets",items:{"162":120,"49":9,"5":10,"117":50},total:189,ts:Date.now()-3600000}],nextId:1};
const locales=[{nombre:"Marruecos",grupo:"Franquicias",pais:"Marruecos",produccion:true},{nombre:"Obelisco CABA",grupo:"Propios",pais:"Argentina"},{nombre:"Operaciones",grupo:"Gestion",pais:"",operaciones:true,clave:"op2024"}];
const peso=(s,pais)=>(s.peso_paises&&s.peso_paises[pais])||s.peso;
const relevarMock=()=>({ok:true,ts:Date.now(),sabores:[{id:"5",nombre:"Cheesecake al pistacchio",tipo:"v",familia:"vasquetas",categoria:"Cremas"},{id:"20",nombre:"Frutilla",tipo:"v",familia:"vasquetas",categoria:"Frutales"},{id:"162",nombre:"Mango",tipo:"i",familia:"icepops",categoria:"Fruta"},{id:"117",nombre:"Alfajor Semiamargo",tipo:"c",familia:"chocolateria",categoria:"Alfajores"},{id:"172",nombre:"Red Velvet",tipo:"c",familia:"pasteleria",categoria:"Tortas"},{id:"188",nombre:"Croissant",tipo:"c",familia:"bolleria",categoria:"Bollería"},{id:"189",nombre:"Medialunas x2",tipo:"c",familia:"bolleria",categoria:"Bollería"}],locales:[{nombre:"Obelisco CABA",grupo:"Propios",region:"CABA",stock:{"5":12,"20":0,"162":60,"117":120,"172":3,"188":0,"189":16}},{nombre:"Unicenter",grupo:"Propios",region:"GBA",stock:{"5":4,"20":9,"162":0,"117":30,"172":0,"188":8,"189":24}},{nombre:"Recoleta CABA",grupo:"Propios",region:"CABA",stock:{"5":0,"20":3,"162":25,"117":0,"172":5,"188":2,"189":0}},{nombre:"Devoto CABA",grupo:"Franquicias",region:"CABA",stock:{"5":7,"20":2,"162":10,"117":48,"172":1,"188":12,"189":6}}]});
const sabores=[
 {id:"172",nombre:"Red Velvet",tipo:"c",familia:"pasteleria",categoria:"Tortas",minimo:6,orden:172,peso:0,cantidad_maestra:0},
 {id:"184",nombre:"Budín de Limón",tipo:"c",familia:"pasteleria",categoria:"Pastelería Fresca",minimo:6,orden:184,peso:0,cantidad_maestra:0},
 {id:"188",nombre:"Croissant",tipo:"c",familia:"bolleria",categoria:"Bollería",minimo:6,orden:188,peso:0,cantidad_maestra:0},
 {id:"189",nombre:"Medialunas x2",tipo:"c",familia:"bolleria",categoria:"Bollería",minimo:6,orden:189,peso:0,cantidad_maestra:0},
 {id:"20",nombre:"Frutilla",tipo:"v",familia:"vasquetas",categoria:"Frutales",minimo:6,orden:20,peso:3.64,cantidad_maestra:0},

 {id:"117",nombre:"Alfajor Semiamargo",tipo:"c",familia:"chocolateria",categoria:"Alfajores",minimo:6,orden:117,peso:0,cantidad_maestra:60},
 {id:"5",nombre:"Cheesecake al pistacchio",tipo:"v",familia:"vasquetas",categoria:"Cremas",minimo:6,orden:5,peso:3.09,peso_paises:{Marruecos:4.97},cantidad_maestra:0},
 {id:"4",nombre:"Banana Split",tipo:"v",familia:"vasquetas",categoria:"Cremas",minimo:6,orden:4,peso:3.89,peso_paises:{Marruecos:4.6},cantidad_maestra:0},
 {id:"162",nombre:"Mango",tipo:"i",familia:"icepops",categoria:"Fruta",minimo:30,orden:162,peso:0,cantidad_maestra:30},
 {id:"49",nombre:"Frutilla",tipo:"i",familia:"icepops",categoria:"Fruta",minimo:30,orden:49,peso:0,cantidad_maestra:30},
 {id:"73",nombre:"Frutilla con Chantilly",tipo:"i",familia:"icepops",categoria:"Crema",minimo:30,orden:73,peso:0,cantidad_maestra:25},
];
function resp(b){
  const a=b.accion;
  if(a==="relevar") return relevarMock();
  if(a==="localesActivos") return {ok:true,locales:locales.map(l=>({nombre:l.nombre,grupo:l.grupo,pais:l.pais,tieneClave:!!l.clave,esGestion:!!l.operaciones,controlEquipos:false}))};
  if(a==="verificarClaveLocal") return {ok:true};
  if(a==="empleadosGestion") return {ok:true,empleados:[{id:"1",nombre:"Gabi Busquets",rol:"admin"}]};
  if(a==="loginGestion") return {ok:true,token:"t",empleado:{id:"1",nombre:"Gabi Busquets",rol:"admin",local:""}};
  if(a==="datos"){const l=locales.find(x=>x.nombre===b.local)||{};return {ok:true,registros:db.regs.filter(r=>r.local===b.local),stock:null,sabores:sabores.map(s=>({...s,peso:peso(s,l.pais)})),excluidos:l.exc||[],pais:l.pais||"Argentina",fueraDePais:[],produccion:!!l.produccion,produccionRubros:[],produccionSabores:l.prodSab||[],escanerPeso:false,ventaDia:false,chocoSoloDeposito:false,controlEquipos:false,rol:"admin"}}
  if(a==="saboresAdmin") return {ok:true,sabores:sabores.map(x=>({...x,activo:true,paises:x.id==="162"?["Marruecos"]:[],paises_excluidos:x.id==="4"?["Marruecos"]:[],peso_paises:x.peso_paises||{},nombre_paises:x.id==="49"?{Marruecos:"Fraise"}:{},categoria_paises:x.id==="49"?{Marruecos:"Classiques"}:{}}))};
  if(a==="guardarProduccionSabores"){const l=locales.find(x=>x.nombre===b.local); if(!l||!l.produccion) return {ok:false,error:"Este local no tiene Producción activada."}; if(!b.ids||!b.ids.length) return {ok:false,error:"Dejá al menos un sabor que producís."}; l.prodSab=b.ids.map(String); return {ok:true,ids:l.prodSab}}
  if(a==="toggleSaborLocal"){const l=locales.find(x=>x.nombre===b.local); l.exc=l.exc||[]; const i=l.exc.indexOf(String(b.saborId)); if(i<0) l.exc.push(String(b.saborId)); else l.exc.splice(i,1); return {ok:true,excluido:i<0}}
  if(a==="eliminarSabor"){const i=sabores.findIndex(x=>x.id===b.saborId); if(db.regs.some(r=>r.items&&Object.prototype.hasOwnProperty.call(r.items,b.saborId))) return {ok:false,error:"ya tiene movimientos"}; if(i>=0) sabores.splice(i,1); return {ok:true}}
  if(a==="registrar"){if(b.subtipo==="produccion"){const l=locales.find(x=>x.nombre===b.local)||{}; if((l.prodSab||[]).length){const no=Object.keys(b.items).filter(i=>l.prodSab.indexOf(String(i))===-1); if(no.length) return {ok:false,error:"Este local no produce: "+no.join(", ")+"."}}}
  const r={id:String(db.nextId++),clienteId:b.clienteId,tipo:b.tipo,subtipo:b.subtipo||"",local:b.local,empleadoId:"1",empleado:"Gabi Busquets",items:b.items,kilos:b.kilos||{},total:Object.values(b.items).reduce((x,y)=>x+y,0),ts:Date.now()};db.regs.push(r);console.log("REGISTRAR",JSON.stringify({tipo:b.tipo,subtipo:b.subtipo,items:b.items,kilos:b.kilos}));return {ok:true,registro:r}}
  return {ok:true,sabores:[],empleados:[],locales:[]};
}
const MIME={".html":"text/html",".js":"text/javascript",".jpg":"image/jpeg",".png":"image/png",".json":"application/json"};
http.createServer((q,r)=>{
  if(q.method==="POST"){let d="";q.on("data",c=>d+=c);q.on("end",()=>{let b={};try{b=JSON.parse(d)}catch(e){}console.log("REQ",b.accion);const o=resp(b);o.backendVersion="1.54.0";r.setHeader("Content-Type","application/json");r.end(JSON.stringify(o))});return}
  let p=q.url.split("?")[0];if(p.endsWith("/"))p+="index.html";const f=path.join(ROOT,p);
  fs.readFile(f,(e,x)=>{if(e){r.statusCode=404;r.end("no");return}r.setHeader("Content-Type",MIME[path.extname(f)]||"application/octet-stream");if(p.endsWith("/index.html"))x=Buffer.from(x.toString().replace(/const API_URL = "[^"]+"/,'const API_URL = "/exec"'));r.end(x)});
}).listen(8993,()=>console.log("up"));
