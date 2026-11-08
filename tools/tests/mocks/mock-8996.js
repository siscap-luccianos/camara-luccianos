const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=require("path").join(__dirname,"..","..","..");
const db={regs:[{id:"900",tipo:"salida",subtipo:"",local:"Local prueba",empleadoId:"1",empleado:"Gabi Busquets",items:{"5":1},kilos:{},pesos:{},total:1,ts:Date.now()}],stock:{"Local prueba":{local:"Local prueba",base:{"4":20,"5":3,"20":6,"107":0,"49":0},ts:Date.now()-3600000,empleado:"Gabi Busquets"}},nextId:1000};
const locales=[{nombre:"Local prueba",grupo:"Propios",pais:"Argentina",kilosReales:true},{nombre:"Obelisco CABA",grupo:"Propios",pais:"Argentina"},{nombre:"Operaciones",grupo:"Gestion",pais:"",operaciones:true,clave:"op2024"}];
db.regs.push({id:"800",tipo:"conteo",subtipo:"",local:"Local prueba",empleadoId:"1",empleado:"Gabi Busquets",items:{"4":20,"5":3,"20":6},kilos:{"4":80.4,"5":12.6,"20":24},total:0,ts:db.stock["Local prueba"].ts});
const sabores=[
 {id:"5",nombre:"Cheesecake al pistacchio",tipo:"v",familia:"vasquetas",categoria:"Cremas",minimo:6,orden:5,peso:3.09,cantidad_maestra:0},
 {id:"4",codigo_fabrica:"0004",plu:"11",nombre:"Banana Split",tipo:"v",familia:"vasquetas",categoria:"Cremas",minimo:6,orden:4,peso:3.89,cantidad_maestra:0},
 {id:"20",codigo_fabrica:"0020",plu:"6",nombre:"Frutilla",tipo:"v",familia:"vasquetas",categoria:"Frutales",minimo:6,orden:20,peso:3.64,cantidad_maestra:0},
 {id:"107",nombre:"Granella de Pistacchio",tipo:"k",familia:"vasquetas",categoria:"Cremas",minimo:6,orden:107,peso:0,cantidad_maestra:0},
 {id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops",categoria:"Fruta",minimo:30,orden:49,peso:0,cantidad_maestra:30},
];
const vasq=id=>{const s=sabores.find(x=>x.id===String(id));return s&&s.tipo==="v"&&s.familia==="vasquetas"};
const nom=id=>(sabores.find(x=>x.id===String(id))||{}).nombre;
function resp(b){
  const a=b.accion, l=locales.find(x=>x.nombre===b.local)||{};
  if(a==="localesActivos") return {ok:true,locales:locales.map(x=>({nombre:x.nombre,grupo:x.grupo,pais:x.pais,tieneClave:!!x.clave,esGestion:!!x.operaciones,controlEquipos:false}))};
  if(a==="verificarClaveLocal") return {ok:true};
  if(a==="empleadosGestion") return {ok:true,empleados:[{id:"1",nombre:"Gabi Busquets",rol:"admin"}]};
  if(a==="loginGestion") return {ok:true,token:"t",empleado:{id:"1",nombre:"Gabi Busquets",rol:"admin",local:""}};
  if(a==="datos") return {ok:true,registros:db.regs.filter(r=>r.local===b.local),stock:db.stock[b.local]||null,sabores:sabores,excluidos:[],pais:"Argentina",fueraDePais:[],produccion:false,produccionRubros:[],produccionSabores:[],escanerPeso:!!l.kilosReales,kilosReales:!!l.kilosReales,ventaDia:false,chocoSoloDeposito:false,controlEquipos:false,rol:"admin"};
  if(a==="leerRemito") return {ok:true,remitos:["00079-00035154"],fecha:"04/11/2026",fotoUrl:"",bultosDeclaradosSabores:null,bultosLeidosSabores:12,items:[
    {nombreDetectado:"SABORES - BANANA SPLIT",cantidad:4,bultos:4,kilos:14.57,saborId:"4",nombreSabor:"Banana Split",confianza:"alta"},
    {nombreDetectado:"SABORES - FRUTILLA",cantidad:6,bultos:6,kilos:60,saborId:"20",nombreSabor:"Frutilla",confianza:"alta"},
    {nombreDetectado:"SABORES - CHEESECAKE",cantidad:2,bultos:2,kilos:null,saborId:"5",nombreSabor:"Cheesecake al pistacchio",confianza:"alta"}]};
  if(a==="conteo"){
    if(l.kilosReales){const f=Object.keys(b.items).filter(i=>vasq(i)&&b.items[i]>0&&!((b.kilos||{})[i]>0)); if(f.length) return {ok:false,error:"Faltan los kilos totales de: "+f.map(nom).join(", ")+"."}}
    const ts=Date.now(); db.stock[b.local]={local:b.local,base:b.items,ts,empleado:"Gabi Busquets"};
    db.regs.push({id:String(db.nextId++),tipo:"conteo",subtipo:"",local:b.local,empleadoId:"1",empleado:"Gabi Busquets",items:b.items,kilos:b.kilos||{},total:0,ts});
    console.log("CONTEO",JSON.stringify({items:b.items,kilos:b.kilos})); return {ok:true,ts};
  }
  if(a==="cambioSabor"){
    const n=Math.floor(+b.cantidad||0); if(!b.motivo) return {ok:false,error:"Escribí el motivo del cambio."};
    if(b.desde===b.hacia) return {ok:false,error:"Elegí dos sabores distintos."};
    const reg=db.regs.filter(r=>r.local===b.local&&!r.anulado); const base=(db.stock[b.local]||{}).base||{}; const bts=(db.stock[b.local]||{}).ts||0; let st=+base[b.desde]||0;
    reg.forEach(r=>{ if(r.ts<=bts) return; const sg=(r.tipo==="ingreso"||r.tipo==="cambio")?1:r.tipo==="salida"?-1:0; st+=sg*(+((r.items||{})[b.desde])||0) });
    if(st<n) return {ok:false,error:"No hay "+n+" de "+nom(b.desde)+" en cámara para cambiar (hay "+st+")."};
    if(l.kilosReales && !(+b.kilos>0)) return {ok:false,error:"Faltan los kilos de esas vasquetas."};
    const items={}; items[b.desde]=-n; items[b.hacia]=n; const kil={}; if(+b.kilos>0){kil[b.desde]=-b.kilos; kil[b.hacia]=+b.kilos}
    const r={id:String(db.nextId++),clienteId:b.clienteId,tipo:"cambio",subtipo:"cambio",local:b.local,empleadoId:"1",empleado:"Gabi Busquets",items,kilos:kil,pesos:{},total:n,motivo:b.motivo,ts:Date.now()};
    db.regs.push(r); console.log("CAMBIO",JSON.stringify({d:b.desde,h:b.hacia,n,kilos:b.kilos,motivo:b.motivo})); return {ok:true,id:r.id};
  }
  if(a==="registrar"){
    if(l.kilosReales && b.subtipo!=="transferencia"){
      const ids=Object.keys(b.items).filter(i=>vasq(i)&&b.items[i]>0);
      if(b.tipo==="salida"){const f=ids.filter(i=>((b.pesos||{})[i]||[]).length!==b.items[i]); if(f.length) return {ok:false,error:"Falta pesar cada vasqueta de: "+f.map(nom).join(", ")+"."}}
      else {const f=ids.filter(i=>!((b.kilos||{})[i]>0)); if(f.length) return {ok:false,error:"Faltan los kilos totales de: "+f.map(nom).join(", ")+"."}}
    }
    const r={id:String(db.nextId++),clienteId:b.clienteId,tipo:b.tipo,subtipo:b.subtipo||"",local:b.local,empleadoId:"1",empleado:"Gabi Busquets",items:b.items,kilos:b.kilos||{},pesos:b.pesos||{},total:Object.values(b.items).reduce((x,y)=>x+y,0),ts:Date.now()};
    db.regs.push(r); console.log("REGISTRAR",JSON.stringify({tipo:b.tipo,subtipo:b.subtipo,items:b.items,kilos:b.kilos,pesos:b.pesos})); return {ok:true,registro:r};
  }
  return {ok:true,sabores:[],empleados:[],locales:[]};
}
const MIME={".html":"text/html",".js":"text/javascript",".jpg":"image/jpeg",".png":"image/png",".json":"application/json",".wasm":"application/wasm"};
http.createServer((q,r)=>{
  if(q.method==="POST"){let d="";q.on("data",c=>d+=c);q.on("end",()=>{let b={};try{b=JSON.parse(d)}catch(e){}const o=resp(b);o.backendVersion="1.61.0";r.setHeader("Content-Type","application/json");r.end(JSON.stringify(o))});return}
  let p=q.url.split("?")[0];if(p.endsWith("/"))p+="index.html";const f=path.join(ROOT,p);
  fs.readFile(f,(e,x)=>{if(e){r.statusCode=404;r.end("no");return}r.setHeader("Content-Type",MIME[path.extname(f)]||"application/octet-stream");if(p.endsWith("/index.html"))x=Buffer.from(x.toString().replace(/const API_URL = "[^"]+"/,'const API_URL = "/exec"'));r.end(x)});
}).listen(8996,()=>console.log("up7"));
