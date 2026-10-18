/* =============================================================
 * SEP GROUP — VISOR DE ARCHIVOS PRIVADOS (pieza única · Fase 6.10 · 17/10/2026)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario. Modificarlo anula la garantía de funcionamiento.
 * -------------------------------------------------------------
 * La MISMA pieza vive en SEP-GROUP y en SEP-AGENDA (js/archivo-visor.js).
 * Muestra dentro de la app un archivo que sigue PRIVADO en Drive: el
 * servidor revisa el permiso y entrega el archivo (decisión de Oss,
 * 17/10/2026); aquí se arma en memoria y se ve sin iniciar sesión en
 * Google, con su botón Descargar.
 *   · PDF  → páginas pintadas con pdf.js (cdnjs, solo la primera vez que
 *            se abre un PDF; funciona igual en el teléfono).
 *   · Imagen → tal cual.
 *   · Otro tipo → solo Descargar.
 * Uso: SEPArchivo.abrir('Título', function () { return Promise<{nombre, mime, b64}> })
 * Cerrar o abrir otro corta lo anterior (nada pisa al visor nuevo).
 * ============================================================= */
(function () {
  'use strict';
  if (window.SEPArchivo) return;

  var PDF_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var PDF_MAX_PAG = 40;
  var V = { el: null, url: null, gen: 0, cargaPdf: null };

  var CSS =
    '.sav-ov{position:fixed;inset:0;z-index:9600;background:rgba(8,15,30,.62);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.sav-ov.sav-oculto{display:none}' +
    '.sav-box{background:var(--bg-card,var(--bg-base,#fff));color:var(--text-main,#0f172a);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.35);width:min(920px,100%);height:min(92vh,1100px);display:flex;flex-direction:column;overflow:hidden}' +
    '.sav-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border,#e2e8f0)}' +
    '.sav-tit{flex:1;min-width:0;margin:0;font-size:1rem;font-weight:800;color:var(--primary,#0b3b7a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.sav-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:10px;border:1px solid var(--border,#e2e8f0);background:transparent;color:inherit;font:inherit;font-size:.85rem;font-weight:700;text-decoration:none;cursor:pointer;white-space:nowrap}' +
    '.sav-btn[aria-disabled="true"]{opacity:.45;pointer-events:none}' +
    '.sav-x{width:36px;height:36px;border-radius:50%;border:0;background:var(--bg-soft,#f1f5f9);color:inherit;font-size:1rem;cursor:pointer;flex:none}' +
    '.sav-body{flex:1;overflow:auto;padding:12px;background:var(--bg-soft,#f1f5f9);-webkit-overflow-scrolling:touch}' +
    '.sav-body canvas,.sav-body img{display:block;width:100%;height:auto;margin:0 auto 12px;background:#fff;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.12)}' +
    '.sav-body img{max-width:100%;width:auto}' +
    '.sav-esq{height:100%;min-height:260px;border-radius:10px;background:linear-gradient(90deg,rgba(148,163,184,.18) 25%,rgba(148,163,184,.32) 50%,rgba(148,163,184,.18) 75%);background-size:200% 100%;animation:savEsq 1.2s linear infinite}' +
    '@keyframes savEsq{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
    '.sav-msg{padding:28px 16px;text-align:center;font-weight:600;line-height:1.5}' +
    '.sav-msg.err{color:var(--error,#b91c1c)}' +
    '@media (max-width:600px){.sav-ov{padding:0}.sav-box{width:100%;height:100%;border-radius:0}.sav-btn span{display:none}}';

  var IC_BAJAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function montar() {
    if (V.el) return V.el;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var ov = document.createElement('div');
    ov.className = 'sav-ov sav-oculto';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="sav-box"><div class="sav-head"><h2 class="sav-tit"></h2>' +
      '<a class="sav-btn sav-bajar" aria-disabled="true" href="#">' + IC_BAJAR + '<span>Descargar</span></a>' +
      '<button type="button" class="sav-x" aria-label="Cerrar">✕</button></div><div class="sav-body"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.sav-x').addEventListener('click', cerrar);
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ov.classList.contains('sav-oculto')) cerrar(); });
    V.el = ov;
    return ov;
  }

  function cerrar() {
    V.gen++;
    if (!V.el) return;
    V.el.classList.add('sav-oculto');
    V.el.querySelector('.sav-body').innerHTML = '';
    if (V.url) { try { URL.revokeObjectURL(V.url); } catch (_) {} V.url = null; }
  }

  function pdfLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (V.cargaPdf) return V.cargaPdf;
    V.cargaPdf = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = PDF_LIB; s.async = true;
      s.onload = function () {
        if (!window.pdfjsLib) { V.cargaPdf = null; no(new Error('pdf.js')); return; }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
        ok(window.pdfjsLib);
      };
      s.onerror = function () { V.cargaPdf = null; no(new Error('pdf.js')); };
      document.head.appendChild(s);
    });
    return V.cargaPdf;
  }

  function bytesDe(b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  /* Páginas en orden, una tras otra; si se cierra el visor se corta. */
  function pintarPdf(cuerpo, u8, g) {
    return pdfLib().then(function (lib) { return lib.getDocument({ data: u8 }).promise; }).then(function (pdf) {
      if (g !== V.gen) return;
      cuerpo.innerHTML = '';
      var ancho = Math.max(280, cuerpo.clientWidth - 24);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var n = Math.min(pdf.numPages, PDF_MAX_PAG);
      var cadena = Promise.resolve();
      for (var i = 1; i <= n; i++) {
        (function (k) {
          cadena = cadena.then(function () {
            if (g !== V.gen) return;
            return pdf.getPage(k).then(function (p) {
              var v1 = p.getViewport({ scale: 1 });
              var vp = p.getViewport({ scale: (ancho / v1.width) * dpr });
              var c = document.createElement('canvas');
              c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
              cuerpo.appendChild(c);
              return p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            });
          });
        })(i);
      }
      return cadena.then(function () {
        if (g === V.gen && pdf.numPages > n) cuerpo.insertAdjacentHTML('beforeend', '<p class="sav-msg">Se muestran las primeras ' + n + ' páginas. Descárgalo para verlo completo.</p>');
      });
    }).catch(function () {
      if (g !== V.gen) return;
      /* Sin pdf.js (red) el navegador lo intenta con su propio visor. */
      cuerpo.innerHTML = '<iframe title="Vista previa" src="' + V.url + '" style="width:100%;height:100%;min-height:70vh;border:0;background:#fff;border-radius:6px"></iframe>';
    });
  }

  /* pedir(): Promise<{ nombre, mime, b64 }> */
  function abrir(titulo, pedir) {
    var ov = montar();
    cerrar();
    var g = ++V.gen;
    ov.classList.remove('sav-oculto');
    ov.querySelector('.sav-tit').textContent = titulo || 'Documento';
    var bajar = ov.querySelector('.sav-bajar');
    bajar.setAttribute('aria-disabled', 'true'); bajar.removeAttribute('download'); bajar.href = '#';
    var cuerpo = ov.querySelector('.sav-body');
    cuerpo.innerHTML = '<div class="sav-esq"></div>';
    var t0 = Date.now();
    return Promise.resolve().then(pedir).then(function (d) {
      if (g !== V.gen) return;
      if (!d || !d.b64) throw new Error('El archivo llegó vacío.');
      var u8 = bytesDe(d.b64);
      var mime = d.mime || 'application/octet-stream';
      V.url = URL.createObjectURL(new Blob([u8], { type: mime }));
      bajar.href = V.url; bajar.setAttribute('download', d.nombre || 'archivo'); bajar.setAttribute('aria-disabled', 'false');
      try { (window.__sepMed = window.__sepMed || []).push({ ruta: 'visorArchivo', ms: Date.now() - t0, kb: d.kb || 0, t: Date.now() }); } catch (_) {}
      if (/^image\//.test(mime)) { cuerpo.innerHTML = '<img alt="' + esc(d.nombre || '') + '" src="' + V.url + '" />'; return; }
      if (/pdf/.test(mime)) return pintarPdf(cuerpo, u8, g);
      cuerpo.innerHTML = '<p class="sav-msg">Este tipo de archivo no tiene vista previa. Usa <b>Descargar</b>.</p>';
    }).catch(function (e) {
      if (g !== V.gen) return;
      cuerpo.innerHTML = '<p class="sav-msg err">' + esc((e && e.message) || 'No se pudo abrir el archivo.') + '</p>';
    });
  }

  window.SEPArchivo = { abrir: abrir, cerrar: cerrar };
})();
