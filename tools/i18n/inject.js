// Arma el diccionario a partir de tools/i18n/<idioma>-*.txt («español ⇒ idioma») y lo pega en index.html
// entre los marcadores, junto con el motor (engine.js). Uso: node tools/i18n/inject.js
const fs=require("fs"), path=require("path");
const dir=__dirname, ruta=path.join(dir,"..","..","index.html");
const dic={};
for(const f of fs.readdirSync(dir).sort()){
  const m=f.match(/^([a-z]{2})-.*\.txt$/); if(!m) continue;
  const d=(dic[m[1]]=dic[m[1]]||{});
  fs.readFileSync(path.join(dir,f),"utf8").split("\n").forEach((l,i)=>{
    if(!l.trim()) return; const k=l.indexOf(" ⇒ "); if(k<0){ console.error(`${f}:${i+1} sin « ⇒ »`); process.exit(1) }
    d[l.slice(0,k).trim()]=l.slice(k+3).trim();
  });
}
const engine=fs.readFileSync(path.join(dir,"engine.js"),"utf8");
const bloque=`<script>/*I18N_BEGIN*/window.I18N_DIC=${JSON.stringify(dic).replace(/</g,"\\u003c")};\n${engine}/*I18N_END*/</script>`;
let h=fs.readFileSync(ruta,"utf8");
const re=/<script>\/\*I18N_BEGIN\*\/[\s\S]*?\/\*I18N_END\*\/<\/script>/;
if(re.test(h)) h=h.replace(re,()=>bloque);
else h=h.replace("<script>\n(function(){ try{ if(/Android/i",()=>bloque+"\n<script>\n(function(){ try{ if(/Android/i");
fs.writeFileSync(ruta,h);
console.log("idiomas:",Object.keys(dic).map(k=>k+" "+Object.keys(dic[k]).length).join(", "));
