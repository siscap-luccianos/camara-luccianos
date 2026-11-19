// Extrae del index.html los textos visibles en español (trozos entre etiquetas y ${...}) para el diccionario.
const fs=require("fs");
const src=fs.readFileSync(__dirname+"/../../index.html","utf8");
const out=new Map();
function add(t){
  t=t.replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
  if(t.length<2||!/[A-Za-zÁÉÍÓÚáéíóúñÑ]{2}/.test(t)) return;
  if(/^[a-z0-9_\-:.#\[\]=,"'()>\/ ]+$/.test(t)&&!/ /.test(t)) return; // ids/clases
  if(/^[a-z]+[A-Z]\w*$/.test(t)) return; // camelCase
  if(/[{};]|=>|function|\bconst\b|\bvar\b|\breturn\b|querySelector|\.length|https?:/.test(t)) return;
  const f=/[áéíóúñÁÉÍÓÚÑ¿¡]/.test(t)||/ /.test(t)||/^[A-ZÁÉÍÓÚ]/.test(t);
  if(!f) return;
  out.set(t,(out.get(t)||0)+1);
}
function trozos(s){
  // quita ${...} balanceado
  let r="",i=0;
  while(i<s.length){
    if(s[i]==="$"&&s[i+1]==="{"){ let d=1; i+=2; while(i<s.length&&d>0){ if(s[i]==="{")d++; else if(s[i]==="}")d--; i++ } r+="\u0001"; continue }
    r+=s[i++];
  }
  // atributos traducibles
  r.replace(/\b(placeholder|title|aria-label|alt)="([^"<>]*)"/g,(m,a,v)=>{ v.split("\u0001").forEach(add); return m });
  r=r.replace(/<[^>]*>/g,"\u0001").replace(/<[^>]*$/,"\u0001");
  r.split("\u0001").forEach(add);
}
// literales: "..." '...' `...` (y, dentro de las plantillas, lo que hay en cada ${...})
function escanear(src){
  let i=0;
  while(i<src.length){
    const c=src[i];
    if(c==='"'||c==="'"||c==="`"){
      let j=i+1,buf="";
      while(j<src.length){
        if(src[j]==="\\"){ buf+=src[j]+src[j+1]; j+=2; continue }
        if(c==="`"&&src[j]==="$"&&src[j+1]==="{"){ let d=1,ini=j+2; buf+="${"; j+=2; while(j<src.length&&d>0){ if(src[j]==="{")d++; else if(src[j]==="}")d--; buf+=src[j]; j++ } escanear(src.slice(ini,j-1)); continue }
        if(src[j]===c) break;
        if(c!=="`"&&src[j]==="\n") break;
        buf+=src[j]; j++;
      }
      if(src[j]===c){ trozos(buf.replace(/\\n/g," ").replace(/\\(["'`])/g,"$1")); i=j+1; continue }
    }
    i++;
  }
}
const ini0=src.indexOf("/*I18N_END*/");
escanear(src.slice(ini0>0?ini0:0));
// texto HTML estático fuera del <script>
const ini=src.indexOf("<script>");
src.slice(0,ini).replace(/<style[\s\S]*?<\/style>/g,"").split(/<[^>]*>/).forEach(add);
const l=[...out.keys()].sort();
fs.writeFileSync(__dirname+"/candidatos.json",JSON.stringify(l,null,0));
console.log(l.length+" candidatos");
