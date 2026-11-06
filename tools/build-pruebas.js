// Genera la carpeta pruebas/ (LogiStock PRUEBAS) a partir de index.html, sw.js y
// manifest.json de la raíz. Uso: node tools/build-pruebas.js
//
// Qué cambia respecto de producción (todo lo demás es idéntico):
//  - API_URL apunta al Apps Script de pruebas (tools/pruebas.config.json).
//  - Título, color, íconos y manifest propios (se instala como otra app).
//  - Una franja naranja «ENTORNO DE PRUEBAS» para que nadie lo confunda.
//  - localStorage con prefijo «pruebas:» — el origen (siscap-luccianos.github.io)
//    es el mismo que el de producción, así que sin esto compartirían sesión,
//    equipoId, local fijado, cola offline y caché de datos.
//  - Service worker con su propio nombre de caché y alcance /pruebas/.
//  - Fotos, media y vendor se leen de la raíz (../), no se duplican.
const fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..");
const out = path.join(raiz, "pruebas");
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "pruebas.config.json"), "utf8"));
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8");
function reemplazar(txt, buscado, nuevo, veces = 1) {
  const n = txt.split(buscado).length - 1;
  if (n !== veces) throw new Error(`Se esperaban ${veces} coincidencias de «${buscado.slice(0, 60)}» y hay ${n}`);
  return txt.split(buscado).join(nuevo);
}

let h = leer("index.html");
h = h.replace(/const API_URL = "[^"]*";/, `const API_URL = ${JSON.stringify(cfg.apiUrl)};`);
h = reemplazar(h, "<title>LogiStock Lucciano's</title>", "<title>LogiStock PRUEBAS</title>");
h = reemplazar(h, '<meta name="theme-color" content="#5E7A3F">', '<meta name="theme-color" content="#C2410C">');
h = reemplazar(h, 'src="fotos/${id}.jpg"', 'src="../fotos/${id}.jpg"');
h = reemplazar(h, 'src="icons/wordmark-dorado.png"', 'src="../icons/wordmark-dorado.png"');
h = reemplazar(h, 'src="icons/wordmark-blanco.png"', 'src="../icons/wordmark-blanco.png"');
h = reemplazar(h, 'src="media/bienvenida-lucciano.jpg"', 'src="../media/bienvenida-lucciano.jpg"');
h = reemplazar(h, 'ZXING_SRC="vendor/', 'ZXING_SRC="../vendor/');
h = reemplazar(h, 'ZXING_WASM="vendor/', 'ZXING_WASM="../vendor/');

const shim = `<script>/* PRUEBAS: localStorage aislado de producción (mismo origen) */
(function(){try{var P="pruebas:",L=window.localStorage,mias=function(){return Object.keys(L).filter(function(k){return k.indexOf(P)===0})},
w={getItem:function(k){return L.getItem(P+k)},setItem:function(k,v){L.setItem(P+k,v)},removeItem:function(k){L.removeItem(P+k)},
key:function(i){var m=mias();return m[i]?m[i].slice(P.length):null},clear:function(){mias().forEach(function(k){L.removeItem(k)})}};
Object.defineProperty(w,"length",{get:function(){return mias().length}});
Object.defineProperty(window,"localStorage",{value:w,configurable:true});}catch(e){}})();</script>
<style>
#bannerPruebas{background:#C2410C;color:#fff;font:700 12px/1.3 system-ui,sans-serif;letter-spacing:.06em;text-align:center;padding:5px 78px 5px 10px;text-transform:uppercase;position:relative;z-index:9998}
#cintaPruebas{position:fixed;top:0;right:0;z-index:9999;background:#C2410C;color:#fff;font:800 10px/1 system-ui,sans-serif;letter-spacing:.1em;padding:4px 8px;border-radius:0 0 0 8px;pointer-events:none}
@media print{#bannerPruebas{display:none!important}#cintaPruebas{background:#C2410C!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>`;
h = reemplazar(h, "<head>", "<head>\n" + shim);
h = h.replace(/<body([^>]*)>/, (m) => m + '\n<div id="bannerPruebas">Entorno de pruebas · datos no reales</div><div id="cintaPruebas">PRUEBAS</div>');
fs.mkdirSync(path.join(out, "icons"), { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), h);

let sw = leer("sw.js");
sw = sw.replace(/const CACHE_VERSION = "logistock-shell-([^"]*)";/, 'const CACHE_VERSION = "logistock-pruebas-shell-$1";');
sw = reemplazar(sw, '  "icons/wordmark-dorado.png",\n', '  "../icons/wordmark-dorado.png",\n');
fs.writeFileSync(path.join(out, "sw.js"), sw);

const m = JSON.parse(leer("manifest.json"));
m.name = "LogiStock PRUEBAS"; m.short_name = "Pruebas";
m.description = "Entorno de pruebas de LogiStock Lucciano's — no usar para cargar datos reales.";
m.id = "/camara-luccianos/pruebas/"; m.start_url = "./"; m.scope = "./";
m.background_color = "#C2410C"; m.theme_color = "#C2410C";
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(m, null, 2) + "\n");
console.log("pruebas/ generada · API_URL:", cfg.apiUrl.slice(0, 50));
