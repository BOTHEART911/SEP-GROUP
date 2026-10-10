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
 *   RUEDA.abrir({ modo, valor, titulo, desde, hasta, min, max, conAnio,
 *                 horaDesde, horaHasta, paso, horaDef, fechaDef, onOk })
 *     → abre la rueda por código, sin campo (agenda de Comercial, fechas
 *     máximas, Contador y Ofertas). min/max 'aaaa-mm-dd' recortan meses
 *     y días; horaDesde/horaHasta/paso (minutos) dan una sola columna de
 *     bloques; conAnio:false quita la columna de año. onOk recibe el
 *     valor en el mismo formato de 'valor'.
 *
 * Al elegir, el input oculto recibe el valor y dispara 'input' y
 * 'change' (burbujean), así los oyentes que ya existían siguen igual.
 * Usa los estilos .iosp-* de la app (claro y oscuro) y css/rueda.css.
 * 10/10/2026 (2) — es la ÚNICA rueda de la app: las tres viejas
 * (IOSP de la agenda, CPICK del Contador y la de Ofertas) se borraron.
 * ============================================================ */
var RUEDA = (function () {
  'use strict';

  var H = 42;
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MES_L = MESES.map(function (m) { return m.charAt(0).toUpperCase() + m.slice(1); });
  var AP = ['a. m.', 'p. m.'];
  var S = { modo: 'fecha', anios: [], meses: [], dias: [], hid: null, vis: null, cfg: null,
            min: null, max: null, slots: null, conAnio: true, titulo: '' };

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
  /* minutos desde medianoche → '9:30 a. m.' */
  function textoMin(t) {
    var h = Math.floor(t / 60), h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + p2(t % 60) + ' ' + AP[h >= 12 ? 1 : 0];
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
        if (c.id === 'rueda-anio') rehacerMeses();
        else if (c.id === 'rueda-mes') rehacerDias();
      });
    });
  }
  /* Muestra u oculta una columna junto con sus dos flechas. */
  function verCol(id, si) {
    var c = q('#' + id); if (c) c.classList.toggle('hidden', !si);
    Array.prototype.forEach.call(document.querySelectorAll('#rueda-pk .rueda-arrow[data-col="' + id + '"]'),
      function (b) { b.classList.toggle('hidden', !si); });
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
  function aIso(a, m, d) { return a + '-' + p2(m + 1) + '-' + p2(d); }
  function pick(arr, c) { return arr[Math.min(sel(c), arr.length - 1)]; }

  /* Cotas de fecha (aaaa-mm-dd, opcionales): recortan meses y días en
     los años de borde. Fuera de esos años, todo vale. */
  function mesesDe(a) {
    var lo = 0, hi = 11, mn = S.min, mx = S.max;
    if (mn && mn.a === a) lo = mn.m;
    if (mx && mx.a === a) hi = mx.m;
    var r = []; for (var m = lo; m <= hi; m++) r.push(m);
    return r.length ? r : [lo];
  }
  function diasDe(m, a) {
    var lo = 1, hi = diasMes(m, a), mn = S.min, mx = S.max;
    if (mn && mn.a === a && mn.m === m) lo = mn.d;
    if (mx && mx.a === a && mx.m === m) hi = Math.min(hi, mx.d);
    var r = []; for (var d = lo; d <= hi; d++) r.push(d);
    return r.length ? r : [lo];
  }
  function rehacerDias() {
    var a = pick(S.anios, q('#rueda-anio'));
    var m = pick(S.meses, q('#rueda-mes'));
    var dAct = pick(S.dias, q('#rueda-dia'));
    S.dias = diasDe(m, a);
    var pos = S.dias.indexOf(dAct);
    if (pos < 0) pos = dAct < S.dias[0] ? 0 : S.dias.length - 1;
    build(q('#rueda-dia'), S.dias.map(String), pos);
  }
  function rehacerMeses() {
    var a = pick(S.anios, q('#rueda-anio'));
    if (!S.conAnio) q('#rueda-tit').textContent = S.titulo || String(a);
    var mAct = pick(S.meses, q('#rueda-mes'));
    S.meses = mesesDe(a);
    var pos = S.meses.indexOf(mAct);
    if (pos < 0) pos = mAct < S.meses[0] ? 0 : S.meses.length - 1;
    build(q('#rueda-mes'), S.meses.map(function (m) { return MES_L[m]; }), pos, rehacerDias);
    rehacerDias();
  }

  /* ---------------- abrir / cerrar ---------------- */
  /* Motor común. cfg:
       modo       'fecha' | 'hora' | 'fechahora'
       valor      'aaaa-mm-dd' | 'HH:MM' | 'aaaa-mm-dd HH:MM' (24 h)
       titulo     rótulo de la cabecera (sin columna de año y sin título,
                  la cabecera muestra el año)
       desde/hasta  años de la columna de año
       min/max    'aaaa-mm-dd': no deja elegir fuera (días y meses)
       conAnio    false = sin columna de año (se queda en el año de min
                  o en el actual)
       horaDesde/horaHasta/paso  minutos desde medianoche: con cualquiera
                  de los tres, la hora es UNA columna de bloques
                  (p. ej. 6:00 a. m. a 8:00 p. m. de 30 en 30)
       horaDef    minutos desde medianoche si no hay hora guardada
       vaciable   muestra "Quitar" (solo si hay valor)
       onOk(valor) recibe el valor en el formato de arriba ('' = Quitar) */
  function abrirCfg(cfg) {
    montar();
    S.cfg = cfg;
    S.modo = cfg.modo || 'fecha';
    S.titulo = cfg.titulo || '';
    S.conAnio = cfg.conAnio !== false;
    var x = leer(S.modo, cfg.valor);
    var hoy = new Date();
    var y = hoy.getFullYear();
    var mn = cfg.min ? leer('fecha', cfg.min) : null, mx = cfg.max ? leer('fecha', cfg.max) : null;
    S.min = mn && mn.ok ? mn : null; S.max = mx && mx.ok ? mx : null;

    var desde, hasta;
    if (S.conAnio) {
      desde = cfg.desde || (S.min ? S.min.a : y - 1);
      hasta = cfg.hasta || (S.max ? S.max.a : y + 2);
      /* Campos de RUEDA.campo: la columna siempre incluye el año guardado
         y el actual (como desde el 10/10). Por código, el rango es fijo. */
      if (cfg.libreAnio) {
        if (x.a != null) { desde = Math.min(desde, x.a); hasta = Math.max(hasta, x.a); }
        desde = Math.min(desde, y); hasta = Math.max(hasta, y);
      }
    } else {
      desde = hasta = S.min ? S.min.a : y;
    }
    S.anios = []; for (var a = desde; a <= hasta; a++) S.anios.push(a);

    /* Fecha de arranque: la guardada si cabe; si no, hoy; y siempre
       dentro de las cotas. */
    var dIni = (x.a != null && S.anios.indexOf(x.a) >= 0) ? { a: x.a, m: x.m, d: x.d } : null;
    if (!dIni) {
      var dh = cfg.fechaDef ? leer('fecha', cfg.fechaDef) : null;
      dIni = dh && dh.ok ? { a: dh.a, m: dh.m, d: dh.d } : { a: y, m: hoy.getMonth(), d: hoy.getDate() };
    }
    if (S.anios.indexOf(dIni.a) < 0) dIni = { a: S.anios[dIni.a < S.anios[0] ? 0 : S.anios.length - 1], m: dIni.m, d: dIni.d };
    var iso = aIso(dIni.a, dIni.m, dIni.d);
    if (S.min && iso < aIso(S.min.a, S.min.m, S.min.d)) dIni = { a: S.min.a, m: S.min.m, d: S.min.d };
    if (S.max && iso > aIso(S.max.a, S.max.m, S.max.d)) dIni = { a: S.max.a, m: S.max.m, d: S.max.d };

    /* Hora por bloques o libre (hora · minuto · a. m./p. m.). */
    S.slots = null;
    if (cfg.horaDesde != null || cfg.horaHasta != null || cfg.paso) {
      var hd = cfg.horaDesde != null ? cfg.horaDesde : 0;
      var hh_ = cfg.horaHasta != null ? cfg.horaHasta : 23 * 60 + 59;
      var ps = cfg.paso || 1;
      S.slots = []; for (var t = hd; t <= hh_; t += ps) S.slots.push(t);
    }

    var pk = q('#rueda-pk');
    var conF = S.modo !== 'hora', conH = S.modo !== 'fecha';
    pk.querySelector('.rueda-f').classList.toggle('hidden', !conF);
    pk.querySelector('.rueda-hm').classList.toggle('hidden', !conH);
    pk.classList.toggle('rueda-dos', conF && conH);
    verCol('rueda-anio', S.conAnio);
    verCol('rueda-m', !S.slots); verCol('rueda-ap', !S.slots);
    q('#rueda-tit').textContent = S.titulo || (!S.conAnio && conF ? String(dIni.a) :
      (S.modo === 'hora' ? 'Elige la hora' : S.modo === 'fecha' ? 'Elige la fecha' : 'Fecha y hora'));
    q('#rueda-quitar').classList.toggle('hidden', !(cfg.vaciable && cfg.valor));
    /* Visible ANTES de construir: con display:none, scrollTop no surte efecto. */
    pk.classList.remove('hidden');

    if (conF) {
      S.meses = mesesDe(dIni.a);
      S.dias = diasDe(dIni.m, dIni.a);
      build(q('#rueda-anio'), S.anios.map(String), S.anios.indexOf(dIni.a), rehacerMeses);
      build(q('#rueda-mes'), S.meses.map(function (m) { return MES_L[m]; }), Math.max(0, S.meses.indexOf(dIni.m)), rehacerDias);
      build(q('#rueda-dia'), S.dias.map(String), Math.max(0, S.dias.indexOf(Math.min(dIni.d, S.dias[S.dias.length - 1]))));
    }
    if (conH) {
      var def = cfg.horaDef != null ? cfg.horaDef : 8 * 60;
      var tm = x.h != null ? x.h * 60 + x.mi : def;
      if (S.slots) {
        /* Al bloque que contiene la hora; antes del primero, el de por
           defecto; después del último, el último. */
        var ix = -1;
        for (var k = 0; k < S.slots.length; k++) if (S.slots[k] <= tm) ix = k;
        if (ix < 0) ix = Math.max(0, S.slots.indexOf(def));
        build(q('#rueda-h'), S.slots.map(textoMin), ix);
      } else {
        var hh = Math.floor(tm / 60), mi = tm % 60;
        var h12 = hh % 12; if (h12 === 0) h12 = 12;
        var hs = [], ms = [];
        for (var k2 = 1; k2 <= 12; k2++) hs.push(String(k2));
        for (var j = 0; j < 60; j++) ms.push(p2(j));
        build(q('#rueda-h'), hs, h12 - 1);
        build(q('#rueda-m'), ms, mi);
        build(q('#rueda-ap'), AP, hh >= 12 ? 1 : 0);
      }
    }
    var ok = q('#rueda-ok'); if (ok) ok.focus({ preventScroll: true });
  }
  /* Desde un campo de RUEDA.campo: la configuración sale de sus data-. */
  function abrir(vis) {
    var hid = ocultoDe(vis);
    if (!hid || vis.disabled || hid.disabled) return;
    S.vis = vis; S.hid = hid;
    abrirCfg({
      modo: vis.getAttribute('data-rueda') || 'fecha',
      valor: hid.value,
      titulo: vis.getAttribute('data-rueda-t') || '',
      desde: +vis.getAttribute('data-rueda-d') || 0,
      hasta: +vis.getAttribute('data-rueda-h') || 0,
      vaciable: !!vis.getAttribute('data-rueda-vac'),
      libreAnio: true,
      onOk: entregarCampo
    });
  }
  /* Por código (sin campo): RUEDA.abrir(cfg). */
  function abrirCodigo(cfg) { S.vis = null; S.hid = null; abrirCfg(cfg || {}); }
  function cerrar() { var pk = q('#rueda-pk'); if (pk) pk.classList.add('hidden'); }
  function listo() {
    /* Todo se lee ANTES de cerrar (oculta, scrollTop vale 0). */
    var v = [];
    if (S.modo !== 'hora') {
      v.push(aIso(pick(S.anios, q('#rueda-anio')), pick(S.meses, q('#rueda-mes')), pick(S.dias, q('#rueda-dia'))));
    }
    if (S.modo !== 'fecha') {
      if (S.slots) {
        var t = pick(S.slots, q('#rueda-h'));
        v.push(p2(Math.floor(t / 60)) + ':' + p2(t % 60));
      } else {
        var h = Math.min(sel(q('#rueda-h')), 11) + 1;
        var mi = Math.min(sel(q('#rueda-m')), 59);
        var pm = sel(q('#rueda-ap')) >= 1;
        v.push(p2((h % 12) + (pm ? 12 : 0)) + ':' + p2(mi));
      }
    }
    cerrar();
    entregar(v.join(' '));
  }
  function entregar(valor) {
    var cfg = S.cfg;
    if (cfg && cfg.onOk) cfg.onOk(valor);
  }
  function entregarCampo(valor) {
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

  return { campo: campo, fijar: fijar, texto: texto, abrir: abrirCodigo, textoMin: textoMin, _leer: leer };
})();
