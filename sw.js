// Service worker de LogiStock — permite abrir la app sin señal (tablet en la
// cámara, sin wifi, que de vez en cuando se conecta a un celular compartido).
// Guarda el "cascarón" (index.html/manifest/íconos) en caché del dispositivo
// la primera vez que hay señal, y lo sirve de ahí cuando no la hay. Los datos
// (sabores/stock/registros) NO se tocan acá — eso ya lo cachea el propio
// index.html en localStorage (ver _datosCacheKey en el código principal) y
// sigue andando igual, con o sin service worker.
//
// Subir una versión nueva: cambiar CACHE_VERSION junto con FRONTEND_VERSION
// en index.html (no hace falta que sea el mismo número, alcanza con que
// cambie) — así el navegador descarta la caché vieja sola.
const CACHE_VERSION = "logistock-shell-v1.100.2";
const SHELL_KEY = "./";
const PRECACHE = [
  "./",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/favicon-32.png",
  "icons/apple-touch-icon.png",
  "icons/wordmark-dorado.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function esCascaron(url) {
  return url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
}
function esManifest(url) {
  return url.pathname.endsWith("/manifest.json");
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Nunca tocar: llamadas a Apps Script (otro origen), fuentes de Google
  // (otro origen, se degradan solas a la fuente de respaldo si no hay red),
  // ni nada que no sea un GET.
  if (url.origin !== self.location.origin || req.method !== "GET") return;
  // El chequeo de "hay una versión nueva" pide expresamente sin caché
  // (?nocache=...) — si lo interceptáramos para guardarlo, se nos llenaría
  // la caché de una entrada distinta cada 5 minutos sin servir para nada.
  if (url.searchParams.has("nocache")) return;

  if (esCascaron(url) || esManifest(url)) {
    const clave = esManifest(url) ? "manifest.json" : SHELL_KEY;
    // cache:"no-cache" = siempre revalidar con el servidor. GitHub Pages manda
    // max-age=600, así que sin esto el navegador podía servir una copia de
    // hasta 10 minutos de antigüedad aunque ya estuviera publicada la nueva.
    e.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((res) => {
          caches.open(CACHE_VERSION).then((c) => c.put(clave, res.clone()));
          return res;
        })
        .catch(async () => {
          // Si no hay red Y tampoco hay nada guardado todavía (primera vez
          // que se abre sin señal, antes de que la app se haya podido
          // guardar alguna vez), respondWith() TIENE que devolver una
          // Response igual — dejarlo en undefined funciona en Chrome, pero
          // en Safari/iOS tira "FetchEvent.respondWith received an error:
          // Returned response is null" y corta la página entera (el error
          // que reportó Gabi).
          const cacheado = await caches.match(clave);
          return cacheado || new Response(
            "<!doctype html><meta charset=utf-8><body style=\"font-family:system-ui;padding:32px;color:#333\">" +
            "No hay señal y esta app todavía no se guardó una copia en este dispositivo para usarla sin conexión. " +
            "Abrila una vez con wifi o datos y volvé a intentar.</body>",
            { status: 503, headers: { "Content-Type": "text/html;charset=utf-8" } }
          );
        })
    );
    return;
  }

  // Fotos e íconos: primero lo que ya tengamos guardado (no cambian casi
  // nunca y así no gastan datos de más); si es la primera vez, se van
  // guardando solos a medida que se piden.
  e.respondWith(
    caches.match(req).then((cacheado) => {
      if (cacheado) return cacheado;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(CACHE_VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => new Response("", { status: 504 })); // nunca undefined, mismo motivo que arriba
    })
  );
});
