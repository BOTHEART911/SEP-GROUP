/* ============================================================================
 * SEP · AVIÓN DE ESCRITURA — pieza única (SEP-GROUP y SEP-AGENDA)
 * ----------------------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula la garantía.
 * ----------------------------------------------------------------------------
 * 10/10/2026 — El mismo efecto del aviso de guardado de CONTRATISTA-FLANDES
 * (cielo con estrellas que corren, estelas, barra que nunca pasa del 92 %
 * hasta que responde el servidor, un punto por paso, final en verde con
 * confeti), con el avión de SEP en vez del cohete. Este archivo es IDÉNTICO
 * en los dos repos: si se cambia en uno, se copia al otro.
 *
 * QUÉ ES Y QUÉ NO ES
 *   · Es el ÚNICO aviso de "guardando / procesando / enviando / generando".
 *   · Las vistas y los modales que LEEN cargan con el esqueleto (capa 5),
 *     nunca con esto.
 *   · No sustituye al escudo de cada botón ni al rid: los complementa.
 *
 * CÓMO SE USA
 *   1) Automático: apiPost lo toma y lo suelta solo (ver app.js).
 *        SEPAvion.tomar({ titulo, sub, pasos, auto:true }) → ficha
 *        SEPAvion.soltar(ficha, bienOMal)
 *      Varias escrituras seguidas comparten UN solo avión: se cierra
 *      cuando termina la última (con 120 ms de gracia entre una y otra).
 *   2) Alrededor de un trabajo que no es solo apiPost (leer un archivo y
 *      subirlo, por ejemplo):
 *        await SEPAvion.durante({ titulo:'Subiendo…' }, async () => {...});
 *   3) A mano (la creación del contrato de SEP-AGENDA):
 *        SEPAvion.abrir({...}); ... await SEPAvion.listo({...});
 *        SEPAvion.fallo(); SEPAvion.cerrar();
 *      Mientras está abierto a mano, las tomas automáticas no lo cierran.
 *
 * PAREJA: css/avion.css
 * ========================================================================== */
(function () {
  'use strict';
  if (window.SEPAvion) return;

  var PASOS = ['Preparando…', 'Enviando al servidor…', 'Guardando…', 'Casi listo…'];
  var RETRASO_AUTO = 150;   // una escritura que vuelve antes no alcanza a pintar
  var GRACIA = 120;         // entre dos escrituras seguidas no se cierra
  var ESPERA_LISTO = 650;   // verde breve: el mensaje de éxito de la app va después

  var capa = null, reloj = null, pct = 0, pasos = PASOS, paso = 0;
  var cuenta = 0, fichas = 0, manual = false, tAbrir = null, tCerrar = null;
  var texto = null, salir = null, cerrando = null;

  /* Avión (trazo de Material Icons "flight", Apache 2.0). */
  var AVION = '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" width="46" height="46" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="11" fill="rgba(255,255,255,.18)"/>' +
    '<path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function q(c) { return capa ? capa.querySelector('.sep-avion__' + c) : null; }

  function crear() {
    var estrellas = '', confeti = '', i;
    for (i = 0; i < 14; i++) estrellas += '<i class="s' + (i % 7) + '"></i>';
    for (i = 0; i < 12; i++) confeti += '<i class="c' + (i % 6) + '"></i>';
    var d = document.createElement('div');
    d.className = 'sep-avion';
    d.setAttribute('role', 'alertdialog');
    d.setAttribute('aria-live', 'assertive');
    d.setAttribute('aria-modal', 'true');
    d.innerHTML =
      '<div class="sep-avion__caja">' +
      '  <div class="sep-avion__cielo">' +
      '    <div class="sep-avion__estrellas" aria-hidden="true">' + estrellas + '</div>' +
      '    <span class="sep-avion__nave"><span class="sep-avion__avion">' + AVION +
      '      <i class="sep-avion__humo" aria-hidden="true"></i></span></span>' +
      '    <i class="sep-avion__estela e1"></i><i class="sep-avion__estela e2"></i><i class="sep-avion__estela e3"></i>' +
      '    <span class="sep-avion__ok">' + CHECK + '</span>' +
      '    <div class="sep-avion__confeti" aria-hidden="true">' + confeti + '</div>' +
      '  </div>' +
      '  <div class="sep-avion__t"></div>' +
      '  <div class="sep-avion__p"></div>' +
      '  <div class="sep-avion__pista"><i class="sep-avion__bar"></i></div>' +
      '  <div class="sep-avion__paso"></div>' +
      '  <div class="sep-avion__puntos" aria-hidden="true"></div>' +
      '</div>';
    document.body.appendChild(d);
    capa = d;
  }

  function puntos(n, hecho) {
    var caja = q('puntos'); if (!caja) return;
    if (caja.children.length !== n) { var h = ''; for (var i = 0; i < n; i++) h += '<i></i>'; caja.innerHTML = h; }
    for (var j = 0; j < caja.children.length; j++) {
      caja.children[j].classList.toggle('is-ok', j < hecho);
      caja.children[j].classList.toggle('is-ahora', j === hecho);
    }
  }

  function textos(op) {
    op = op || {};
    if (!capa) return;
    q('t').textContent = op.titulo || 'Guardando';
    q('p').innerHTML = op.sub || 'No cierres esta ventana hasta que termine.';
    var nuevos = (op.pasos && op.pasos.length) ? op.pasos : PASOS;
    if (nuevos !== pasos) { pasos = nuevos; paso = Math.min(paso, pasos.length - 1); }
    q('paso').textContent = pasos[paso];
    puntos(pasos.length, paso);
  }

  function noSalir(e) { e.preventDefault(); e.returnValue = salir || ''; return salir || ''; }

  function pintarAbierto(op) {
    op = op || {};
    if (!capa) crear();
    clearTimeout(cerrando); cerrando = null;
    capa.classList.remove('is-listo');
    capa.classList.add('is-on');
    document.documentElement.classList.add('sep-avion-abierto');
    pasos = (op.pasos && op.pasos.length) ? op.pasos : PASOS;
    paso = 0; pct = 0;
    textos(op);
    q('bar').style.width = '0%';
    if (reloj) clearInterval(reloj);
    /* Calibrada para Apps Script (2–8 s). Nunca pasa del 92 %: no promete
       un final que no controla. */
    reloj = setInterval(function () {
      pct += Math.max(0.6, (92 - pct) / 9);
      if (pct > 92) pct = 92;
      q('bar').style.width = pct.toFixed(1) + '%';
      var quiero = Math.min(pasos.length - 1, Math.floor(pct / (92 / pasos.length)));
      if (quiero !== paso) {
        paso = quiero;
        var nodo = q('paso');
        nodo.classList.add('is-cambia');
        setTimeout(function () { nodo.textContent = pasos[paso]; nodo.classList.remove('is-cambia'); }, 160);
        puntos(pasos.length, paso);
      }
    }, 260);
    if (op.noSalir) { salir = op.noSalir === true ? 'Se está guardando. Si sales ahora, se puede perder.' : String(op.noSalir); window.addEventListener('beforeunload', noSalir); }
  }

  function parar() {
    if (reloj) { clearInterval(reloj); reloj = null; }
    if (salir) { window.removeEventListener('beforeunload', noSalir); salir = null; }
  }

  function cerrar() {
    parar();
    clearTimeout(tAbrir); tAbrir = null;
    clearTimeout(cerrando); cerrando = null;
    manual = false;
    if (!capa) return;
    capa.classList.remove('is-on', 'is-listo');
    document.documentElement.classList.remove('sep-avion-abierto');
  }

  function abierto() { return !!(capa && capa.classList.contains('is-on')); }

  /* Final feliz: verde, 100 % y una pausa corta para que se vea. */
  function listo(op) {
    op = op || {};
    return new Promise(function (res) {
      parar();
      clearTimeout(tAbrir); tAbrir = null;
      if (!abierto()) { cerrar(); return res(); }
      capa.classList.add('is-listo');
      q('bar').style.width = '100%';
      q('t').textContent = op.titulo || '¡Listo!';
      q('p').innerHTML = op.sub || 'Quedó guardado.';
      q('paso').textContent = op.paso || 'Guardado correctamente';
      puntos(pasos.length, pasos.length);
      try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) {}
      cerrando = setTimeout(function () { cerrando = null; cerrar(); res(); }, op.espera || ESPERA_LISTO);
    });
  }

  /* Final triste: se cierra sin fiesta y la app muestra su error. */
  function fallo() {
    try { if (navigator.vibrate) navigator.vibrate([12, 60, 12]); } catch (e) {}
    cerrar();
  }

  /* ---- modo a mano ---- */
  function abrir(op) { manual = true; texto = null; pintarAbierto(op); }

  /* ---- modo contado (apiPost y durante) ---- */
  function tomar(op) {
    op = op || {};
    var ficha = ++fichas;
    cuenta++;
    clearTimeout(tCerrar); tCerrar = null;
    /* el texto explícito manda sobre el automático */
    if (!op.auto || !texto) texto = op;
    if (manual) return ficha;                      // lo maneja quien lo abrió
    if (abierto()) {
      if (capa.classList.contains('is-listo')) pintarAbierto(texto);   // vuelve a volar
      else if (!op.auto) textos(op);
      return ficha;
    }
    if (!tAbrir) {
      var r = (op.retraso != null) ? op.retraso : (op.auto ? RETRASO_AUTO : 0);
      if (r <= 0) pintarAbierto(texto);
      else tAbrir = setTimeout(function () { tAbrir = null; if (cuenta > 0 && !manual) pintarAbierto(texto); }, r);
    }
    return ficha;
  }

  function soltar(ficha, bien, opListo) {
    if (!ficha) return;
    if (cuenta > 0) cuenta--;
    if (bien === false) soltar._mal = true;
    if (cuenta > 0 || manual) return;
    clearTimeout(tCerrar);
    tCerrar = setTimeout(function () {
      tCerrar = null;
      if (cuenta > 0 || manual) return;
      var mal = !!soltar._mal; soltar._mal = false;
      var t = texto; texto = null;
      if (!abierto()) { clearTimeout(tAbrir); tAbrir = null; return; }
      if (mal) fallo();
      else listo(opListo || (t && t.listo) || {});
    }, GRACIA);
  }

  function durante(op, fn) {
    var f = tomar(op || {});
    var p;
    try { p = Promise.resolve(fn()); } catch (e) { soltar(f, false); return Promise.reject(e); }
    return p.then(function (v) { soltar(f, true); return v; }, function (e) { soltar(f, false); throw e; });
  }

  function mientras(promesa, op) {
    op = op || {};
    abrir(op);
    return Promise.resolve(promesa).then(
      function (v) { return listo(op.listo || {}).then(function () { return v; }); },
      function (e) { fallo(); throw e; }
    );
  }

  window.SEPAvion = {
    abrir: abrir, listo: listo, fallo: fallo, cerrar: cerrar, abierto: abierto,
    tomar: tomar, soltar: soltar, durante: durante, mientras: mientras,
    _estado: function () { return { cuenta: cuenta, manual: manual, abierto: abierto(), listo: !!(capa && capa.classList.contains('is-listo')) }; }
  };
}());
