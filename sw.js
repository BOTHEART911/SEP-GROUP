/* ============================================================
 * SEP GROUP — SERVICE WORKER
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario. Modificarlo anula la garantía de funcionamiento.
 * FASE 1 — Comercial (Parte 1)
 * ------------------------------------------------------------
 * Estrategia: network-first para navegación (siempre la última
 * versión cuando hay red) y cache de respaldo del shell para que
 * la app abra estando instalada sin conexión.
 * ============================================================ */
const SEP_CACHE = 'sep-group-v1';
const SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest'];

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
  // No interceptar el API de Apps Script ni Firebase
  if (/script\.google\.com|firebaseio\.com|googleapis\.com/.test(req.url)) return;

  e.respondWith(
    fetch(req)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(SEP_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
