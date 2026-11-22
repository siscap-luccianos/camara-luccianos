const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=require("path").join(__dirname,"..","..","..");
const db={inv:[],regs:[{id:"900",tipo:"salida",subtipo:"",local:"Local prueba",empleadoId:"1",empleado:"Gabi Busquets",items:{"5":1},kilos:{},pesos:{},total:1,ts:Date.now()}],stock:{"Local prueba":{local:"Local prueba",base:{"4":20,"5":3,"20":6,"107":0,"49":0,"194":7000,"195":7000},ts:Date.now()-3600000,empleado:"Gabi Busquets"}},nextId:1000};
const locales=[{nombre:"Local prueba",grupo:"Propios",pais:"Argentina",kilosReales:true,sv:true},{nombre:"Obelisco CABA",grupo:"Propios",pais:"Argentina"},{nombre:"Operaciones",grupo:"Gestion",pais:"",operaciones:true,clave:"op2024"}];
db.regs.push({id:"800",tipo:"conteo",subtipo:"",local:"Local prueba",empleadoId:"1",empleado:"Gabi Busquets",items:{"4":20,"5":3,"20":6},kilos:{"4":80.4,"5":12.6,"20":24},total:0,ts:db.stock["Local prueba"].ts});
db.regs.push({id:"802",tipo:"ingreso",subtipo:"",local:"Local prueba",empleadoId:"1",empleado:"Gabi Busquets",items:{"117":15},kilos:{},pesos:{},total:15,ts:Date.now()-500});
const sabores=[
 {id:"5",nombre:"Cheesecake al pistacchio",tipo:"v",familia:"vasquetas",categoria:"Cremas",minimo:6,orden:5,peso:3.09,cantidad_maestra:0},
 {id:"4",codigo_fabrica:"0004",plu:"11",nombre:"Banana Split",tipo:"v",familia:"vasquetas",categoria:"Cremas",minimo:6,orden:4,peso:3.89,cantidad_maestra:0},
 {id:"20",codigo_fabrica:"0020",plu:"6",nombre:"Frutilla",tipo:"v",familia:"vasquetas",categoria:"Frutales",minimo:6,orden:20,peso:3.64,cantidad_maestra:0},
 {id:"107",nombre:"Granella de Pistacchio",tipo:"k",familia:"vasquetas",categoria:"Cremas",minimo:6,orden:107,peso:0,cantidad_maestra:0},
 {id:"49",nombre:"Frutilla icepop",tipo:"i",familia:"icepops",categoria:"Fruta",minimo:30,orden:49,peso:0,cantidad_maestra:30},
];
sabores.push({id:"117",nombre:"Alfajor Semiamargo",tipo:"c",familia:"chocolateria",categoria:"Alfajores",minimo:6,orden:117,peso:0,cantidad_maestra:60,vida_util_dias:70});
sabores.push({id:"118",nombre:"Alfajor Blanco",tipo:"c",familia:"chocolateria",categoria:"Alfajores",minimo:6,orden:118,peso:0,cantidad_maestra:60,vida_util_dias:70});
(function(){ const f=d=>new Date(Date.now()+d*864e5).toISOString().slice(0,10); const ts=Date.now()-1800000;
  db.regs.push({id:"801",tipo:"ingreso",subtipo:"",local:"Local prueba",empleadoId:"1",empleado:"Gabi Busquets",items:{"117":30,"118":20},kilos:{},pesos:{},vencimientos:{"117":[{f:f(3),c:10},{f:f(30),c:20}]},total:50,ts}); })();
sabores.push({id:"194",nombre:"Geladot Frutilla",tipo:"g",familia:"icepops",categoria:"Geladot",minimo:5000,orden:194,peso:2.5,cantidad_maestra:2500},{id:"195",nombre:"Geladot Pistacchio",tipo:"g",familia:"icepops",categoria:"Geladot",minimo:5000,orden:195,peso:2.5,cantidad_maestra:2500});
const vasq=id=>{const s=sabores.find(x=>x.id===String(id));return s&&s.tipo==="v"&&s.familia==="vasquetas"};
const nom=id=>(sabores.find(x=>x.id===String(id))||{}).nombre;
function resp(b){
  const a=b.accion, l=locales.find(x=>x.nombre===b.local)||{};
  if(a==="localesActivos") return {ok:true,locales:locales.map(x=>({nombre:x.nombre,grupo:x.grupo,pais:x.pais,tieneClave:!!x.clave,esGestion:!!x.operaciones,controlEquipos:false}))};
  if(a==="verificarClaveLocal") return {ok:true};
  if(a==="anular"){ const x=db.regs.find(r=>String(r.id)===String(b.registroId)); if(!x) return {ok:false,error:"No existe ese movimiento."}; x.anulado=true; x.anulado_por="Gabi Busquets"; x.anulado_ts=Date.now(); x.motivo=b.motivo||""; return {ok:true}; }
  if(a==="empleadosLocal") return {ok:true,empleados:[{id:"11",nombre:"Lucía Benítez",rol:"colaborador",local:"Local prueba",tienePin:true},{id:"12",nombre:"Sofía Ramirez",rol:"encargado",local:"Local prueba",tienePin:true}]};
  if(a==="login"){ const e={"11":{id:"11",nombre:"Lucía Benítez",rol:"colaborador",local:"Local prueba",tienePin:true},"12":{id:"12",nombre:"Sofía Ramirez",rol:"encargado",local:"Local prueba",tienePin:true}}[String(b.empleadoId)]; if(!e) return {ok:false,error:"Empleado inexistente."}; if(b.pin!=="1234") return {ok:false,error:"PIN incorrecto."}; return {ok:true,token:"tk"+e.id,empleado:e}; }
  if(a==="empleadosGestion") return {ok:true,empleados:[{id:"1",nombre:"Gabi Busquets",rol:"admin"}]};
  if(a==="cambiarMiPin") return (b.pinActual==="1234" && /^\d{4}$/.test(b.pinNuevo||"")) ? {ok:true,token:"t2"} : {ok:false,error:"PIN incorrecto (1/5)."};
  if(a==="loginGestion") return {ok:true,token:"t",empleado:{id:"1",nombre:"Gabi Busquets",rol:"admin",local:""}};
  if(a==="datos") return {ok:true,registros:db.regs.filter(r=>r.local===b.local),stock:db.stock[b.local]||null,sabores:sabores,excluidos:[],pais:"Argentina",fueraDePais:[],produccion:false,produccionRubros:[],produccionSabores:[],escanerPeso:!!l.kilosReales,kilosReales:!!l.kilosReales,ventaDia:true,chocoSoloDeposito:false,controlEquipos:false,stockValorizado:true,rol:"admin"};
  if(a==="preciosStock"){ console.log("PRECIOS pedidos para",b.local); return {ok:true,precios:{"4":7821.96,"20":9208.24,"5":10747.57,"49":1709.09}} }
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
  if(a==="registrarMerma"){
    if(!b.motivo) return {ok:false,error:"Escribí el motivo de la merma."}; if(!(+b.kilos>0)) return {ok:false,error:"Escribí cuántos kilos se perdieron."};
    const r={id:String(db.nextId=(db.nextId||1000)+1),tipo:"salida",subtipo:b.lugar==="local"?"merma_local":"merma_camara",local:b.local,empleadoId:"1",empleado:"Gabi Busquets",items:{},kilos:{[b.saborId]:+b.kilos},pesos:{},total:0,motivo:b.motivo,ts:Date.now()};
    db.regs.push(r); console.log("MERMA",JSON.stringify({saborId:b.saborId,kilos:b.kilos,lugar:b.lugar,motivo:b.motivo})); return {ok:true,id:r.id};
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
  if(a==="conteoParcial"){
    const items=b.items||{}, reg=db.regs.filter(r=>r.local===b.local&&!r.anulado), bs=db.stock[b.local]||{}, base=bs.base||{}, bts=bs.ts||0, deltas={};
    Object.keys(items).forEach(id=>{ let st=+base[id]||0; reg.forEach(r=>{ if(r.ts<=bts) return; const sg=(r.tipo==="ingreso"||r.tipo==="cambio")?1:r.tipo==="salida"?-1:0; st+=sg*(+((r.items||{})[id])||0) }); const d=(+items[id])-st; if(d) deltas[id]=d });
    if(l.kilosReales){ const f=Object.keys(items).filter(i=>vasq(i)&&items[i]>0&&!((b.kilos||{})[i]>0)); if(f.length) return {ok:false,error:"Faltan los kilos totales de: "+f.map(nom).join(", ")+"."} }
    if(!Object.keys(deltas).length) return {ok:true,sinCambios:true};
    const r={id:String(db.nextId++),clienteId:b.clienteId,tipo:"cambio",subtipo:"conteo_parcial",local:b.local,empleadoId:"1",empleado:"Gabi Busquets",items:deltas,kilos:b.kilosDelta||{},pesos:{},total:Object.values(deltas).reduce((x,y)=>x+Math.abs(y),0),motivo:"Conteo parcial: "+b.rubro,ts:Date.now()};
    db.regs.push(r); console.log("CONTEOPARCIAL",JSON.stringify({rubro:b.rubro,items:b.items,deltas,kilos:b.kilos,kilosDelta:b.kilosDelta})); return {ok:true,id:r.id,cambios:Object.keys(deltas).length};
  }
  if(a==="cambiarVencimiento"){
    const k=Math.floor(+b.k), c=Math.floor(+b.c);
    if(k===c && b.f===b.de) return {ok:false,error:"No hay nada para cambiar: misma fecha y misma cantidad."};
    const lotes=[]; const mov=Math.min(k,c);
    if(mov>0 && b.f!==b.de) lotes.push({f:b.f,c:mov,de:b.de});
    if(k<c) lotes.push({f:"",c:c-k,de:b.de});
    if(k>c) lotes.push({f:b.f,c:k-c});
    const tot=lotes.reduce((x,l)=>x+l.c,0); const items={}; items[b.id]=tot; const v={}; v[b.id]=lotes;
    const r={id:String(db.nextId++),clienteId:b.clienteId,tipo:"etiquetado",local:b.local,empleadoId:"1",empleado:"Gabi Busquets",items,kilos:{},pesos:{},vencimientos:v,total:tot,ts:Date.now()};
    db.regs.push(r); console.log("CAMBIARVENC",JSON.stringify(b)); return {ok:true,id:r.id};
  }
  if(a==="guardarInventario"){
    if(!b.items) return {ok:false,error:"Falta el inventario."};
    const reg=db.regs.filter(r=>r.local===b.local&&!r.anulado), bs=db.stock[b.local]||{}, base=bs.base||{}, bts=bs.ts||0;
    const stk=id=>{ let st=+base[id]||0; reg.forEach(r=>{ if(r.ts<=bts) return; const sg=(r.tipo==="ingreso"||r.tipo==="cambio")?1:r.tipo==="salida"?-1:0; st+=sg*(+((r.items||{})[id])||0) }); return Math.max(0,st) };
    const camara={}; sabores.forEach(sb=>{ const u=stk(sb.id); const kg=(sb.tipo==="v"&&sb.familia==="vasquetas")||sb.tipo==="k"; if(u>0||(b.items||{})[sb.id]){ const c={u}; if(kg){ const d=(b.camaraKg||{})[sb.id]||{}; c.k=+d.k||0; if(d.ap) c.ap=1 } camara[sb.id]=c } });
    const items={}; Object.keys(b.items).forEach(id=>{ if(+b.items[id]>0) items[id]=+b.items[id] });
    const precios={"4":7821.96,"20":9208.24,"5":10747.57,"49":1709.09}; let valor=0;
    Object.keys(Object.assign({},items,camara)).forEach(id=>{ const sb=sabores.find(x=>x.id===id); const pr=precios[id]; if(!pr||!sb) return; const kg=(sb.tipo==="v"&&sb.familia==="vasquetas")||sb.tipo==="k"; const c=camara[id]||{}; valor+=((kg?(+c.k||0):(+c.u||0))+(+items[id]||0))*pr });
    const inv={id:String(db.inv.length+1),ts:Date.now(),fecha:"2026-11-10",local:b.local,empleado:"Gabi Busquets",items,camara,aprox:Object.values(camara).some(c=>c.ap),cambios:[],precios,valor_total:Math.round(valor)};
    db.inv.push(inv); console.log("INVENTARIO",JSON.stringify({items,camaraKg:b.camaraKg})); return {ok:true,inventario:inv};
  }
  if(a==="corregirInventario"){
    const inv=db.inv.find(x=>x.id===String(b.inventarioId)); if(!inv) return {ok:false,error:"No se encontró ese inventario."};
    if(!String(b.motivo||"").trim()) return {ok:false,error:"Escribí el motivo de la corrección."};
    const antes=+inv.items[b.saborId]||0, nuevo=+b.valor; if(antes===nuevo) return {ok:true,sinCambios:true,inventario:inv};
    if(nuevo>0) inv.items[b.saborId]=nuevo; else delete inv.items[b.saborId];
    inv.cambios.push({ts:Date.now(),q:"Gabi Busquets",s:String(b.saborId),antes,despues:nuevo,mot:b.motivo});
    console.log("CORREGIR",JSON.stringify({s:b.saborId,antes,nuevo,mot:b.motivo})); return {ok:true,inventario:inv};
  }
  if(a==="pedirConteoParcial"||a==="pedirConteoFinal"||a==="pedirConteoInicial"){ db.pedidos=db.pedidos||[]; const ya=db.pedidos.find(q=>q.local===b.local&&q.estado==="pendiente"); if(ya) return {ok:true,repetido:true,pedido:ya}; const q={id:String(db.pedidos.length+1),local:b.local,ts:Date.now(),por:"Gabi Busquets",estado:"pendiente",tipo:a==="pedirConteoFinal"?"final":a==="pedirConteoInicial"?"inicial":"parcial"}; db.pedidos.push(q); return {ok:true,pedido:q}; }
  if(a==="cancelarPedidoConteo"){ (db.pedidos||[]).forEach(q=>{ if(q.local===b.local&&q.estado==="pendiente") q.estado="cancelado" }); return {ok:true}; }
  if(a==="pedirConteoMasivo"){ db.pedidos=db.pedidos||[]; let n=0; const rep=[]; (b.locales||[]).forEach(l=>{ if(db.pedidos.find(q=>q.local===l&&q.estado==="pendiente")) rep.push(l); else { db.pedidos.push({id:String(db.pedidos.length+1),local:l,ts:Date.now(),por:"Gabi Busquets",estado:"pendiente",tipo:b.tipo==="final"?"final":"parcial"}); n++ } }); console.log("MASIVO",JSON.stringify({tipo:b.tipo,n:(b.locales||[]).length})); return {ok:true,pedidos:n,repetidos:rep,errores:[]}; }
  if(a==="cancelarPedidosMasivo"){ let n=0; (db.pedidos||[]).forEach(q=>{ if((b.locales||[]).includes(q.local)&&q.estado==="pendiente"){ q.estado="cancelado"; n++ } }); return {ok:true,cancelados:n}; }
  if(a==="gruposConteo"){ db.grupos=db.grupos||[{id:"g0",nombre:"CABA de Laura",locales:["Recoleta CABA"],ownerId:"otra",owner:"Laura Gómez"}]; const mio=db.grupos.filter(g=>g.ownerId==="yo"); const u=mio.find(g=>g.nombre==="__ultimo__"); return {ok:true,ultimo:u?u.locales:[],grupos:db.grupos.filter(g=>g.nombre!=="__ultimo__").map(g=>Object.assign({propio:g.ownerId==="yo"},g))}; }
  if(a==="guardarGrupoConteo"){ db.grupos=db.grupos||[{id:"g0",nombre:"CABA de Laura",locales:["Recoleta CABA"],ownerId:"otra",owner:"Laura Gómez"}]; const i=db.grupos.findIndex(g=>g.ownerId==="yo"&&g.nombre.toLowerCase()===String(b.nombre).toLowerCase()); const g={id:i>=0?db.grupos[i].id:"g"+(db.grupos.length+1),nombre:b.nombre,locales:b.locales,ownerId:"yo",owner:"Gabi Busquets"}; if(i>=0) db.grupos[i]=g; else db.grupos.push(g); return {ok:true}; }
  if(a==="borrarGrupoConteo"){ db.grupos=(db.grupos||[]).filter(g=>g.id!==b.id); return {ok:true}; }
  if(a==="pedidoConteo") return {ok:true,pedido:(db.pedidos||[]).find(q=>q.local===b.local&&q.estado==="pendiente")||null};
  if(a==="desbloquearInventario"){ if(b.pin!=="1234") return {ok:false,pidePin:true,error:"PIN incorrecto."}; console.log("DESBLOQUEAR",JSON.stringify({inv:b.inventarioId,mot:b.motivo})); db.desb=(db.desb||0)+1; return {ok:true,desbloqueado_hasta:Date.now()+864e5}; }
  if(a==="desbloquearConteoCamara"){ if(b.pin!=="1234") return {ok:false,pidePin:true,error:"PIN incorrecto."}; db.camDesb=true; console.log("DESB_CAMARA",JSON.stringify({local:b.local,mot:b.motivo})); return {ok:true,desbloqueado_hasta:Date.now()+864e5}; }
  if(a==="liberarInventario"){ if(b.pin!=="1234") return {ok:false,pidePin:true,error:"PIN incorrecto."}; db.vis=db.vis||{}; db.vis[String(b.inventarioId)]=b.mostrar?Date.now():0; console.log("LIBERAR",JSON.stringify({inv:b.inventarioId,mostrar:b.mostrar})); return {ok:true,visible_resp_ts:db.vis[String(b.inventarioId)]}; }
  if(a==="controlStock"){ const pend=(db.pedidos||[]).filter(q=>q.estado==="pendiente"); const T=Date.now();
    const res=(id,tipo,dias,cam)=>({id,tipo,ts:T-dias*864e5,empleado:"Laura",camKg:cam,camU:1240,locKg:26.5,locU:96});
    return {ok:true,locales:[
      {local:"Local prueba",grupo:"Propios",region:"CABA",estado:pend.find(q=>q.local==="Local prueba")?"pedido":"controlado",pedido:pend.find(q=>q.local==="Local prueba")||null,base:res("7","inicial",20,201.3),conteos:[res("8","parcial",5,188.9),res("9","final",1,170)],difKg:-18.9,difU:0,pctKg:-9.4,pctU:null},
      {local:"Obelisco CABA",grupo:"Propios",region:"CABA",estado:pend.find(q=>q.local==="Obelisco CABA")?"pedido":"sin_inicial",pedido:pend.find(q=>q.local==="Obelisco CABA")||null,base:null,conteos:[],difKg:0,difU:0,pctKg:null,pctU:null},
      {local:"Santa Rosa La Pampa",grupo:"Franquicias",region:"La Pampa",estado:pend.find(q=>q.local==="Santa Rosa La Pampa")?"pedido":"sin_inicial",pedido:pend.find(q=>q.local==="Santa Rosa La Pampa")||null,base:null,conteos:[],difKg:0,difU:0,pctKg:null,pctU:null},
      {local:"Recoleta CABA",grupo:"Propios",region:"CABA",estado:pend.find(q=>q.local==="Recoleta CABA")?"pedido":"sin_pedir",pedido:pend.find(q=>q.local==="Recoleta CABA")||null,base:res("11","inicial",20,288.5),conteos:[],difKg:0,difU:0,pctKg:null,pctU:null}]}; }
  if(a==="controlDetalle"){ const T=Date.now(); const sel=String(b.inventarioId||"9");
    const mk=(id,tipo,dias,cam,fijo)=>({id,tipo,ts:T-dias*864e5,empleado:"Laura",fijo:fijo!==false&&!db.desb,desbloqueado_hasta:db.desb?T+864e5:0,visible_resp_ts:(db.vis&&db.vis[id])||0,libera_ts:tipo==="final"?T+36e5:0,camKg:cam,camU:1240,locKg:26.5,locU:96,correcciones:({"7":{"4":{n:1,antes:23,sup:false}},"8":{"4":{n:1,antes:21,sup:true}},"9":{"20":{n:2,antes:12,sup:false}}})[id]||{}});
    const conteos=[mk("7","inicial",20,201.3),mk("8","parcial",5,188.9),mk("9","final",1,170)];
    const c=conteos.find(x=>x.id===sel)||conteos[2]; const esCmp=c.tipo!=="inicial";
    const prod=(id,n,cam,loc,e,ini,ing,sal,mer)=>({id,nombre:n,kg:true,cam,loc,tot:cam+loc,esperado:esCmp?e:null,dif:esCmp?Math.round((cam+loc-e)*100)/100:null,ini:esCmp?ini:null,ing:esCmp?ing:null,sal:esCmp?sal:null,merma:esCmp?mer:null,difCam:esCmp?Math.round((cam-(e-1))*100)/100:null,locIni:esCmp?1:null});
    return {ok:true,local:b.local,conteos,conteo:c,base:esCmp?conteos[0]:null,pedido:(db.pedidos||[]).find(q=>q.local===b.local&&q.estado==="pendiente")||null,
      dif:esCmp?{kg:-18.9,u:0,pctKg:-9.4,pctU:null}:null,
      camaraCont:{ts:T-10*864e5,empleado:"Laura",desbloqueado_hasta:db.camDesb?T+864e5:0},
      mov:esCmp?{ing:{n:2,kg:210,u:0,lista:[{ts:T-4*864e5,remito:"00079-3492",kg:110,u:0,empleado:"Laura",sub:""},{ts:T-2*864e5,remito:"00079-3511",kg:100,u:0,empleado:"Pedro",sub:""}]},sal:{n:9,kg:183.2,u:0,semanas:[{ts:T-6*864e5,n:4,kg:61.4,u:0},{ts:T-1*864e5,n:5,kg:121.8,u:0}]},merma:{n:2,kg:2.19,lista:[{ts:T-3*864e5,kg:0.19,lugar:"local",motivo:"Se cayó un cucurucho",empleado:"Pedro"},{ts:T-2*864e5,kg:2,lugar:"cámara",motivo:"Vasqueta rota",empleado:"Laura"}]},anulados:[{ts:T-3*864e5,tipo:"ingreso",kg:12,u:0,empleado:"Pedro",anulado_por:"Pedro",motivo:"error de carga"}]}:null,
      grupos:[{g:"vasquetas",kg:true,cam:c.camKg,loc:26.5,tot:c.camKg+26.5,esperado:esCmp?188.9:null,dif:esCmp?-18.9:null,pct:esCmp?-9.4:null,productos:[prod("4","Banana Split",20.5,2,23.7,25,5,6,0.3),prod("20","Frutilla",9.8,1,9.5,8,4,2,0.5)],ini:33,ing:9,sal:8,merma:0.8,locIni:2},
        {g:"icepops",kg:false,cam:1240,loc:96,tot:1336,esperado:esCmp?1240:null,dif:esCmp?0:null,pct:esCmp?0:null,productos:[{id:"49",nombre:"Frutilla icepop",kg:false,cam:1240,loc:96,tot:1336,esperado:esCmp?1336:null,dif:esCmp?0:null,ini:esCmp?1300:null,ing:esCmp?300:null,sal:esCmp?264:null,merma:esCmp?0:null}],ini:1300,ing:300,sal:264,merma:0}],varLocal:esCmp?{kg:1.5,u:-4}:null}; }
  if(a==="inventarios") return {ok:true,verValor:true,verDiferencias:true,inventarios:db.inv.filter(x=>x.local===b.local).slice().reverse()};
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
  if(q.method==="POST"){let d="";q.on("data",c=>d+=c);q.on("end",()=>{let b={};try{b=JSON.parse(d)}catch(e){}const o=resp(b);o.backendVersion="1.61.0";r.setHeader("Content-Type","application/json");setTimeout(()=>r.end(JSON.stringify(o)),b.accion==="preciosStock"?1500:0)});return}
  let p=q.url.split("?")[0];if(p.endsWith("/"))p+="index.html";const f=path.join(ROOT,p);
  fs.readFile(f,(e,x)=>{if(e){r.statusCode=404;r.end("no");return}r.setHeader("Content-Type",MIME[path.extname(f)]||"application/octet-stream");if(p.endsWith("/index.html"))x=Buffer.from(x.toString().replace(/const API_URL = "[^"]+"/,'const API_URL = "/exec"'));r.end(x)});
}).listen(8999,()=>console.log("up9"));
