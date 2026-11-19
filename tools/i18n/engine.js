/* ===== i18n: español (base) → francés (y más idiomas después) =====
   El código sigue escribiendo todo en español. Acá se traducen los textos que llegan a la pantalla
   (nodos de texto, placeholder/title/aria-label), los avisos y los confirm/prompt, con un diccionario
   por idioma (I18N_DIC). Idioma: el que eligió la persona (botón ES/FR) o, si no, el del país del local. */
const I18N = { lang:"es", dic: (window.I18N_DIC||{}), cache:{}, reg:{} };
const I18N_PAIS = { "Marruecos":"fr" };          // país del local → idioma
const I18N_IDIOMAS = ["es","fr"];                // los que se pueden elegir con el botón (sumar "en" cuando esté el diccionario)
const I18N_PALABRAS = { // respaldo palabra por palabra para textos con números o nombres pegados
  fr:{ "vasquetas":"gelatos","vasqueta":"gelato","cajas":"cartons","caja":"carton","unidades":"unités","unidad":"unité","sabores":"parfums","sabor":"parfum","días":"jours","día":"jour","semanas":"semaines","semana":"semaine","horas":"heures","hace":"il y a","ayer":"hier","hoy":"aujourd'hui","mañana":"demain","local":"magasin","cámara":"chambre froide","pedido":"commande","salida":"sortie","salidas":"sorties","ingreso":"entrée","ingresos":"entrées","devolución":"retour","desperdicio":"perte","vence":"périme","vencido":"périmé","lote":"lot","lotes":"lots","sin":"sans","con":"avec","de":"de","en":"en","y":"et","o":"ou","kilos":"kilos","total":"total","hay":"il y a","solo":"seulement","pendiente":"en attente","por":"par","desde":"depuis","hasta":"jusqu'à","según":"selon","lun":"lun","mié":"mer","jue":"jeu","vie":"ven","sáb":"sam","dom":"dim","ene":"janv","feb":"févr","abr":"avr","may":"mai","jun":"juin","jul":"juil","ago":"août","sep":"sept","dic":"déc","todavía":"encore","menos":"moins","más":"plus","pesado":"pesé","prueba":"test" }
};
const I18N_TOK=/[\p{L}\p{N}]+|[^\s]/uy, I18N_ALNUM=/[\p{L}\p{N}]/u;
function i18nIndice(lang){ // primer «token» de cada frase del diccionario → frases (las más largas primero)
  if(I18N.reg[lang]) return I18N.reg[lang];
  const d=I18N.dic[lang]||{}, idx=new Map();
  Object.keys(d).forEach(k=>{ if(k.length<4) return; I18N_TOK.lastIndex=0; const m=I18N_TOK.exec(k); if(!m) return; (idx.get(m[0])||idx.set(m[0],[]).get(m[0])).push(k) });
  idx.forEach(l=>l.sort((x,y)=>y.length-x.length));
  return (I18N.reg[lang]=idx);
}
function i18nSubst(core,lang){ // cambia cada frase conocida que aparece dentro del texto
  const d=I18N.dic[lang], idx=i18nIndice(lang); let out="", i=0; const n=core.length;
  while(i<n){
    if(i===0||!I18N_ALNUM.test(core[i-1])){
      I18N_TOK.lastIndex=i; const m=I18N_TOK.exec(core), l=m&&idx.get(m[0]);
      if(l){ let hit=null; for(const k of l){ if(core.startsWith(k,i)){ const e=i+k.length; if(!I18N_ALNUM.test(k[k.length-1])||e>=n||!I18N_ALNUM.test(core[e])){ hit=k; break } } }
        if(hit){ out+=d[hit]; i+=hit.length; continue } }
    }
    out+=core[i++];
  }
  return out;
}
function i18nPalabras(t,lang){
  const w=I18N_PALABRAS[lang]; if(!w) return t;
  if(lang==="fr") t=t.replace(/(\d)(\s+)al(\s+)(\d)/g,"$1$2au$3$4"); // «16/11 al 22/11»
  return t.replace(/[\p{L}]+/gu,m=>{ const r=w[m.toLowerCase()]; if(r===undefined) return m; return m[0]!==m[0].toLowerCase()?r[0].toUpperCase()+r.slice(1):r });
}
function i18nCore(core,lang){
  const d=I18N.dic[lang]; if(!d) return core;
  const c=(I18N.cache[lang]=I18N.cache[lang]||{});
  if(c[core]!==undefined) return c[core];
  let r;
  if(d[core]!==undefined) r=d[core];
  else {
    r=i18nSubst(core,lang);
    r=i18nPalabras(r,lang);
  }
  if(Object.keys(c).length>6000) I18N.cache[lang]={};
  return (I18N.cache[lang][core]=r);
}
const I18N_LETRA=/\p{L}/u;
function tr(s){
  if(I18N.lang==="es"||s==null) return s;
  s=String(s);
  const t=s.trim(); if(!t||!I18N_LETRA.test(t)) return s;
  const r=i18nCore(t,I18N.lang);
  if(r===t) return s;
  const i=s.indexOf(t);
  return s.slice(0,i)+r+s.slice(i+t.length);
}
const I18N_ATTRS=["placeholder","title","aria-label","alt"];
function i18nNodo(n){
  if(I18N.lang==="es") return;
  if(n.nodeType===3){ const p=n.parentNode; if(p&&(p.nodeName==="SCRIPT"||p.nodeName==="STYLE"||p.nodeName==="TEXTAREA")) return; const v=n.nodeValue, t=tr(v); if(t!==v) n.nodeValue=t; return }
  if(n.nodeType!==1) return;
  if(n.nodeName==="SCRIPT"||n.nodeName==="STYLE"||n.hasAttribute("data-notr")) return;
  for(const a of I18N_ATTRS){ if(n.hasAttribute(a)){ const v=n.getAttribute(a), t=tr(v); if(t!==v) n.setAttribute(a,t) } }
  if(n.nodeName==="INPUT"&&/^(button|submit)$/i.test(n.type||"")){ const v=n.value, t=tr(v); if(t!==v) n.value=t }
  for(let c=n.firstChild;c;c=c.nextSibling) i18nNodo(c);
}
function i18nIdiomaDePais(pais){ return I18N_PAIS[String(pais||"").trim()]||"es" }
function i18nIdiomaActual(){
  let manual=""; try{ manual=localStorage.getItem("idioma")||"" }catch(e){}
  if(manual && I18N_IDIOMAS.includes(manual)) return manual;
  try{
    const nom = (typeof S!=="undefined") && ((S.auth&&S.auth.local) || S.local || S.deviceLocal);
    if(nom){ const l=(S.locales||[]).find(x=>x.nombre===nom); if(l&&l.pais) return i18nIdiomaDePais(l.pais); if(S.paisLocal && nom===S.local) return i18nIdiomaDePais(S.paisLocal) }
  }catch(e){}
  return "es";
}
function i18nSet(lang){
  if(lang===I18N.lang) return false;
  I18N.lang=lang; document.documentElement.lang=lang; return true;
}
function i18nCiclar(){
  const i=I18N_IDIOMAS.indexOf(I18N.lang), sig=I18N_IDIOMAS[(i+1)%I18N_IDIOMAS.length];
  try{ localStorage.setItem("idioma",sig) }catch(e){}
  i18nSet(sig);
}
(function(){
  const _c=window.confirm.bind(window), _a=window.alert.bind(window), _p=window.prompt.bind(window);
  window.confirm=m=>_c(tr(m)); window.alert=m=>_a(tr(m)); window.prompt=(m,d)=>_p(tr(m),d);
  const mo=new MutationObserver(recs=>{ if(I18N.lang==="es") return; for(const r of recs){ for(const n of r.addedNodes) i18nNodo(n); if(r.type==="characterData") i18nNodo(r.target) } });
  const iniciar=()=>mo.observe(document.body,{childList:true,subtree:true,characterData:true});
  if(document.body) iniciar(); else document.addEventListener("DOMContentLoaded",iniciar);
})();
