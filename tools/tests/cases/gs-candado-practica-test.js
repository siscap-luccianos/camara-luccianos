// Período de práctica: antes del 30/11 el conteo cámara no queda con candado para el responsable.
const vm=require("vm"),fs=require("fs"),path=require("path"),assert=require("assert");
const src=fs.readFileSync(path.join(__dirname,"..","..","..","apps-script/Code.gs"),"utf8");
const sb={console,Date,JSON,Math,Object,Array,String,Number,Utilities:{formatDate:(d)=>new Date(d).toISOString()},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty(){},deleteProperty(){}})}};
vm.createContext(sb); vm.runInContext(src,sb);
vm.runInContext('_jornadaClave=function(ts){return new Date(ts).toISOString().slice(0,10)}',sb);
const casos=[["2026-11-17",false],["2026-11-29",false],["2026-11-30",true],["2026-12-02",true]];
for(const [d,esp] of casos){ vm.runInContext('Date.now=function(){return Date.parse("'+d+'T15:00:00Z")}',sb); assert.strictEqual(vm.runInContext('_candadoActivo()',sb),esp,d); }
console.log("OK candado práctica");
