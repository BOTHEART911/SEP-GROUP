/* =============================================================
 * SEP GROUP — SERVICE WORKER
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario. Modificarlo anula la garantía de funcionamiento.
 * -------------------------------------------------------------
 * v4 (07/08) — RENDIMIENTO
 *   Antes: network-first para TODO. Cada visita volvía a bajar por red las
 *   imágenes, el CSS y el JS; la caché solo servía de respaldo sin conexión.
 *   Con 9,4 MB de imágenes eso era el grueso de la lentitud.
 *
 *   Ahora hay dos estrategias, según lo que se pida:
 *   · NAVEGACIÓN (abrir la app) → network-first. Se sigue trayendo siempre el
 *     index.html más reciente, así que un despliegue nuevo se ve al instante.
 *   · ESTÁTICOS (img/, css/, js/, styles.css, app.js, manifest y las
 *     librerías de CDN) → cache-first con revalidación en segundo plano: se
 *     pintan al momento desde la caché y, en paralelo, se baja la copia nueva
 *     para la próxima vez. Nunca dejan la pantalla esperando.
 *
 *   version.js NUNCA se cachea: es el que dispara la recarga automática cuando
 *   subes APP_VERSION, y servirlo viejo dejaría la app clavada en una versión
 *   antigua. Tampoco se cachea nada que lleve query string.
 * ============================================================ */
const SEP_CACHE = 'sep-group-v12';

const SHELL = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './css/capa-0-avisos.css', './css/capa-1-micro.css', './css/capa-4-transicion.css',
  './css/capa-5-esqueletos.css', './css/capa-7-ripple.css', './css/tema-oscuro.css',
  './css/capa-11-insights.css',
  './js/capa-4-transicion.js', './js/capa-5-esqueletos.js', './js/capa-7-ripple.js',
  './js/tema-oscuro.js', './js/capa-11-insights.js',
  './js/contador.js',
  './css/nivel.css', './js/nivel.js', './js/nivel-perfil.js',
  './css/exportar.css', './js/exportar.js',
  './css/programas-auditoria.css', './js/programas-auditoria.js',
  './img/sep_logo.png'
];

/* Lo que se sirve desde la caché primero */
const ESTATICO = /\.(?:css|js|png|jpe?g|webp|gif|svg|ico|woff2?)$/i;
const CDN = /^https:\/\/(?:cdn\.jsdelivr\.net|www\.gstatic\.com)\//;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SEP_CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SEP_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // El API, Firebase y Google: nunca se tocan.
  if (/script\.google\.com|firebaseio\.com|googleapis\.com/.test(req.url)) return;

  // El vigía de versión y cualquier cosa con query string: siempre por red.
  if (url.search || /version\.js$/.test(url.pathname)) return;

  const mismaCasa = url.origin === self.location.origin;

  /* ---- 1. Estáticos: caché primero, y se revalida por detrás ------------ */
  if ((mismaCasa && ESTATICO.test(url.pathname)) || CDN.test(req.url)) {
    e.respondWith(
      caches.match(req).then((guardado) => {
        const red = fetch(req).then((resp) => {
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(SEP_CACHE).then((c) => c.put(req, copia)).catch(() => {});
          }
          return resp;
        }).catch(() => guardado);
        return guardado || red;
      })
    );
    return;
  }

  /* ---- 2. Todo lo demás (navegación incluida): red primero -------------- */
  e.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.ok && mismaCasa) {
          const copia = resp.clone();
          caches.open(SEP_CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
