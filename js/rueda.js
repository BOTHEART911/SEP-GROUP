/* ============================================================
 * SEP GROUP — RUEDA iOS (pieza única de fecha, hora y fecha-hora)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula la garantía.
 * ------------------------------------------------------------
 * 10/10/2026 — Reemplaza los campos nativos del navegador
 * (type=date, time y datetime-local) por la rueda tipo iOS de la app.
 *
 *   RUEDA.campo({ modo, valor, attrs, cls, titulo, ph, vaciable,
 *                 desde, hasta, disabled })  → HTML
 *     modo     'fecha' | 'hora' | 'fechahora'
 *     valor    'aaaa-mm-dd' | 'HH:MM' | 'aaaa-mm-dd HH:MM'  (24 h)
 *     attrs    atributos del input OCULTO (id, data-vk…): es el que
 *              lee el resto del código, con el mismo formato de siempre.
 *     cls      clases del campo visible (las del input que reemplaza,
 *              para que se vea igual).
 *     vaciable muestra "Quitar" para dejar el campo en blanco.
 *     desde/hasta  años de la columna de año (por defecto actual-1 a +2;
 *              siempre incluye el año del valor guardado).
 *
 *   RUEDA.fijar(inputOculto|selector, valor)  → cambia el valor por
 *     código y repinta el texto visible (sin disparar change).
 *
 * Al elegir, el input oculto recibe el valor y dispara 'input' y
 * 'change' (burbujean), así los oyentes que ya existían siguen igual.
 * Usa los estilos .iosp-* de la app (claro y oscuro) y css/rueda.css.
 * Las ruedas viejas (agenda, contador, ofertas) siguen como estaban.
 * ============================================================ */
var RUEDA = (function () {
  'use strict';

  var H = 42;
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var AP = ['a. m.', 'p. m.'];
  var S = { modo: 'fecha', anios: [], dias: [], hid: null, vis: null };

  function q(s, c) { return (c || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function p2(n) { return String(n).padStart(2, '0'); }

  /* ---------------- valores ---------------- */
  function leer(modo, v) {
    v = String(v == null ? '' : v).trim();
    var f = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    var h = /(?:^|[ T])(\d{1,2}):(\d{2})/.exec(v);
    var out = { ok: false };
    if (modo !== 'hora' && f) { out.a = +f[1]; out.m = +f[2] - 1; out.d = +f[3]; out.ok = true; }
    if (modo !== 'fecha' && h && +h[1] < 24 && +h[2] < 60) { out.h = +h[1]; out.mi = +h[2]; out.ok = true; }
    if (modo === 'fechahora' && !(f && h)) out.ok = !!f;
    return out;
  }
  function texto(modo, v) {
    var x = leer(modo, v);
    if (!x.ok) return '';
    var t = [];
    if (modo !== 'hora' && x.a != null) t.push(x.d + ' ' + MES_C[x.m] + ' ' + x.a);
    if (modo !== 'fecha' && x.h != null) {
      var h12 = x.h % 12; if (h12 === 0) h12 = 12;
      t.push(h12 + ':' + p2(x.mi) + ' ' + AP[x.h >= 12 ? 1 : 0]);
    }
    return t.join(' · ');
  }

  /* ---------------- campo ---------------- */
  function campo(o) {
    o = o || {};
    var modo = o.modo || 'fecha';
    var dis = o.disabled ? ' disabled' : '';
    var ph = o.ph || (modo === 'hora' ? 'Elegir hora' : modo === 'fecha' ? 'Elegir fecha' : 'Elegir fecha y hora');
    return '<input type="hidden" ' + (o.attrs || '') + ' value="' + esc(o.valor || '') + '"' + dis + '>' +
      '<input type="text" readonly inputmode="none" class="' + esc((o.cls || '') + ' rueda-vis') + '"' +
      ' data-rueda="' + modo + '"' +
      (o.titulo ? ' data-rueda-t="' + esc(o.titulo) + '"' : '') +
      (o.vaciable ? ' data-rueda-vac="1"' : '') +
      (o.desde ? ' data-rueda-d="' + o.desde + '"' : '') +
      (o.hasta ? ' data-rueda-h="' + o.hasta + '"' : '') +
      ' placeholder="' + esc(ph) + '" value="' + esc(texto(modo, o.valor)) + '"' + dis + '>';
  }
  function ocultoDe(vis) {
    var h = vis && vis.previousElementSibling;
    return h && h.type === 'hidden' ? h : null;
  }
  function visibleDe(hid) {
    var v = hid && hid.nextElementSibling;
    return v && v.classList && v.classList.contains('rueda-vis') ? v : null;
  }
  function fijar(hid, valor) {
    if (typeof hid === 'string') hid = q(hid);
    if (!hid) return;
    hid.value = valor == null ? '' : String(valor);
    var vis = visibleDe(hid);
    if (vis) vis.value = texto(vis.getAttribute('data-rueda'), hid.value);
  }

  /* ---------------- DOM de la rueda (se crea una sola vez) ---------------- */
  function col(id, lbl) {
    return '<div class="iosp-col" id="' + id + '" aria-label="' + lbl + '"></div>';
  }
  function fila(cls, cols) {
    var up = '', dn = '', ws = '';
    cols.forEach(function (c) {
      up += '<button type="button" class="iosp-arrow rueda-arrow" data-col="' + c[0] + '" data-d="-1" aria-label="' + c[1] + ' arriba">▲</button>';
      dn += '<button type="button" class="iosp-arrow rueda-arrow" data-col="' + c[0] + '" data-d="1" aria-label="' + c[1] + ' abajo">▼</button>';
      ws += col(c[0], c[1]);
    });
    return '<div class="rueda-fila ' + cls + '">' +
      '<div class="iosp-nav iosp-nav--up">' + up + '</div>' +
      '<div class="iosp-wheels"><div class="iosp-highlight"></div>' + ws + '</div>' +
      '<div class="iosp-nav iosp-nav--down">' + dn + '</div></div>';
  }
  function montar() {
    if (q('#rueda-pk')) return;
    var d = document.createElement('div');
    d.id = 'rueda-pk';
    d.className = 'iosp-overlay rueda-pk hidden';
    d.innerHTML = '<div class="iosp-card" role="dialog" aria-modal="true">' +
      '<div class="iosp-head">' +
      '  <button type="button" class="iosp-btn" id="rueda-cancel">Cancelar</button>' +
      '  <span class="iosp-year" id="rueda-tit">Elige la fecha</span>' +
      '  <button type="button" class="iosp-btn ok" id="rueda-ok">Listo</button>' +
      '</div>' +
      fila('rueda-f', [['rueda-dia', 'Día'], ['rueda-mes', 'Mes'], ['rueda-anio', 'Año']]) +
      fila('rueda-hm', [['rueda-h', 'Hora'], ['rueda-m', 'Minuto'], ['rueda-ap', 'a. m. o p. m.']]) +
      '<button type="button" class="rueda-quitar" id="rueda-quitar">Quitar</button>' +
      '</div>';
    document.body.appendChild(d);
    q('#rueda-cancel').addEventListener('click', cerrar);
    q('#rueda-ok').addEventListener('click', listo);
    q('#rueda-quitar').addEventListener('click', function () { cerrar(); entregar(''); });
    d.addEventListener('click', function (e) { if (e.target === d) cerrar(); });
    Array.prototype.forEach.call(d.querySelectorAll('.rueda-arrow'), function (b) {
      b.addEventListener('click', function () {
        var c = q('#' + b.getAttribute('data-col'));
        var n = c.querySelectorAll('.iosp-item').length;
        var i = Math.min(Math.max(sel(c) + (+b.getAttribute('data-d')), 0), n - 1);
        c.scrollTop = i * H; marcar(c);
        var id = c.id;
        if (id === 'rueda-mes' || id === 'rueda-anio') rehacerDias();
      });
    });
  }

  /* ---------------- columnas ---------------- */
  function sel(c) { return Math.max(0, Math.round(c.scrollTop / H)); }
  function marcar(c) {
    var i = sel(c);
    Array.prototype.forEach.call(c.querySelectorAll('.iosp-item'), function (el) {
      el.classList.toggle('sel', +el.getAttribute('data-i') === i);
    });
  }
  function build(c, items, idx, onSettle) {
    c.innerHTML = '<div class="iosp-pad"></div>' +
      items.map(function (t, i) { return '<div class="iosp-item" data-i="' + i + '">' + esc(t) + '</div>'; }).join('') +
      '<div class="iosp-pad"></div>';
    c.scrollTop = Math.max(0, Math.min(idx, items.length - 1)) * H;
    marcar(c);
    var to = null;
    c.onscroll = function () {
      marcar(c);
      if (to) clearTimeout(to);
      to = setTimeout(function () {
        var i = sel(c);
        c.scrollTo({ top: i * H, behavior: 'smooth' });
        if (onSettle) onSettle(i);
      }, 90);
    };
    Array.prototype.forEach.call(c.querySelectorAll('.iosp-item'), function (el) {
      el.addEventListener('click', function () {
        var i = +el.getAttribute('data-i');
        c.scrollTop = i * H; marcar(c);
        if (onSettle) onSettle(i);
      });
    });
  }
  function diasMes(m, a) { return new Date(a, m + 1, 0).getDate(); }
  function rehacerDias() {
    var m = Math.min(sel(q('#rueda-mes')), 11);
    var a = S.anios[Math.min(sel(q('#rueda-anio')), S.anios.length - 1)];
    var tot = diasMes(m, a);
    var pos = Math.min(sel(q('#rueda-dia')), tot - 1);
    S.dias = []; for (var d = 1; d <= tot; d++) S.dias.push(d);
    build(q('#rueda-dia'), S.dias.map(String), pos);
  }

  /* ---------------- abrir / cerrar ---------------- */
  function abrir(vis) {
    var hid = ocultoDe(vis);
    if (!hid || vis.disabled || hid.disabled) return;
    montar();
    S.vis = vis; S.hid = hid;
    S.modo = vis.getAttribute('data-rueda') || 'fecha';
    var x = leer(S.modo, hid.value);
    var hoy = new Date();
    var y = hoy.getFullYear();
    var desde = +vis.getAttribute('data-rueda-d') || (y - 1);
    var hasta = +vis.getAttribute('data-rueda-h') || (y + 2);
    if (x.a != null) { desde = Math.min(desde, x.a); hasta = Math.max(hasta, x.a); }
    desde = Math.min(desde, y); hasta = Math.max(hasta, y);
    S.anios = []; for (var a = desde; a <= hasta; a++) S.anios.push(a);

    var pk = q('#rueda-pk');
    var conF = S.modo !== 'hora', conH = S.modo !== 'fecha';
    pk.querySelector('.rueda-f').classList.toggle('hidden', !conF);
    pk.querySelector('.rueda-hm').classList.toggle('hidden', !conH);
    pk.classList.toggle('rueda-dos', conF && conH);
    q('#rueda-tit').textContent = vis.getAttribute('data-rueda-t') ||
      (S.modo === 'hora' ? 'Elige la hora' : S.modo === 'fecha' ? 'Elige la fecha' : 'Fecha y hora');
    q('#rueda-quitar').classList.toggle('hidden', !(vis.getAttribute('data-rueda-vac') && hid.value));
    /* Visible ANTES de construir: con display:none, scrollTop no surte efecto. */
    pk.classList.remove('hidden');

    if (conF) {
      var aa = x.a != null ? x.a : y, mm = x.m != null ? x.m : hoy.getMonth(), dd = x.d != null ? x.d : hoy.getDate();
      var tot = diasMes(mm, aa);
      S.dias = []; for (var i = 1; i <= tot; i++) S.dias.push(i);
      build(q('#rueda-dia'), S.dias.map(String), Math.min(dd, tot) - 1);
      build(q('#rueda-mes'), MESES.map(function (m) { return m.charAt(0).toUpperCase() + m.slice(1); }), mm, rehacerDias);
      build(q('#rueda-anio'), S.anios.map(String), S.anios.indexOf(aa), rehacerDias);
    }
    if (conH) {
      var hh = x.h != null ? x.h : 8, mi = x.mi != null ? x.mi : 0;
      var h12 = hh % 12; if (h12 === 0) h12 = 12;
      var hs = [], ms = [];
      for (var k = 1; k <= 12; k++) hs.push(String(k));
      for (var j = 0; j < 60; j++) ms.push(p2(j));
      build(q('#rueda-h'), hs, h12 - 1);
      build(q('#rueda-m'), ms, mi);
      build(q('#rueda-ap'), AP, hh >= 12 ? 1 : 0);
    }
    var ok = q('#rueda-ok'); if (ok) ok.focus({ preventScroll: true });
  }
  function cerrar() { var pk = q('#rueda-pk'); if (pk) pk.classList.add('hidden'); }
  function listo() {
    /* Todo se lee ANTES de cerrar (oculta, scrollTop vale 0). */
    var v = [];
    if (S.modo !== 'hora') {
      var d = S.dias[Math.min(sel(q('#rueda-dia')), S.dias.length - 1)];
      var m = Math.min(sel(q('#rueda-mes')), 11);
      var a = S.anios[Math.min(sel(q('#rueda-anio')), S.anios.length - 1)];
      v.push(a + '-' + p2(m + 1) + '-' + p2(d));
    }
    if (S.modo !== 'fecha') {
      var h = Math.min(sel(q('#rueda-h')), 11) + 1;
      var mi = Math.min(sel(q('#rueda-m')), 59);
      var pm = sel(q('#rueda-ap')) >= 1;
      v.push(p2((h % 12) + (pm ? 12 : 0)) + ':' + p2(mi));
    }
    cerrar();
    entregar(v.join(' '));
  }
  function entregar(valor) {
    var hid = S.hid; if (!hid) return;
    if (hid.value === valor) return;
    fijar(hid, valor);
    hid.dispatchEvent(new Event('input', { bubbles: true }));
    hid.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* Un solo oyente para toda la app (sirve para lo que se pinte después). */
  document.addEventListener('click', function (e) {
    var vis = e.target.closest && e.target.closest('.rueda-vis');
    if (vis) { e.preventDefault(); abrir(vis); }
  });
  document.addEventListener('keydown', function (e) {
    var pk = q('#rueda-pk');
    if (pk && !pk.classList.contains('hidden') && e.key === 'Escape') { cerrar(); return; }
    var vis = e.target.closest && e.target.closest('.rueda-vis');
    if (vis && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir(vis); }
  });

  return { campo: campo, fijar: fijar, texto: texto, _leer: leer };
})();
