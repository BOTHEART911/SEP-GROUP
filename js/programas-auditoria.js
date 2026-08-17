/* =============================================================================
 * AUDITORÍA DE PROGRAMAS · Configuración → Programas
 * -----------------------------------------------------------------------------
 * QUÉ HACE
 *   Después de que app.js pinta las tarjetas de Programas, marca EN ROJO lo
 *   que le falta a cada programa: qué variable está vacía, en qué plantilla
 *   se usa y qué va a salir en su lugar (el respaldo global o un hueco).
 *
 * POR QUÉ
 *   Las variables se llaman igual en todos los programas a propósito: se
 *   resuelven por el PROGRAMA del lead. El peligro está en el RESPALDO:
 *   si la columna del programa está vacía, varias lecturas caen a una llave
 *   global o a una constante del código, y ese programa termina mandando el
 *   enlace de otro. Aquí no se renombra nada ni se quita ningún respaldo:
 *   solo se avisa.
 *
 * CÓMO SE ENGANCHA
 *   `renderCfgProgramas_` es una función global de app.js, así que se
 *   envuelve por su nombre sin tocar una línea del original. Se quita
 *   borrando la línea del <script>.
 *
 * PAREJA
 *   css/programas-auditoria.css
 * ========================================================================== */
(function () {
  'use strict';

  if (window.__sepAudProgramas) return;
  window.__sepAudProgramas = true;

  var A = { datos: null, cargando: false, pedido: 0 };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Las 7 variables, con el id del campo en la tarjeta para poder
     marcar el recuadro que le falta a cada programa. */
  var CAMPO = {
    VIDEO_URL: 'pr-video-', VIDEO_TEST_URL: 'pr-videotest-',
    VIDEO_POST_PRUEBA_URL: 'pr-vpost-', VIDEO_OFERTA_URL: 'pr-voferta-',
    OFERTA_EMPLEO_URL: 'pr-oferta-', PLANTILLA_HV_ID: 'pr-hv-',
    PLANTILLA_CONTRATO_ID: 'pr-doc-'
  };

  function envolver() {
    var original = window.renderCfgProgramas_;
    if (typeof original !== 'function') return false;

    window.renderCfgProgramas_ = function () {
      var r = original.apply(this, arguments);
      try { pintar_(); } catch (e) { /* el aviso nunca puede tumbar la vista */ }
      return r;
    };
    return true;
  }

  /* Trae la auditoría (una sola vez por sesión de Configuración) y pinta. */
  function pintar_() {
    if (A.datos) { volcar_(); return; }
    if (A.cargando) return;
    A.cargando = true;
    var mio = ++A.pedido;
    apiGet('auditarProgramas', { usuarioId: (window.currentUser || {}).id || '' }, { silent: true })
      .then(function (d) {
        A.cargando = false;
        if (mio !== A.pedido) return;
        A.datos = d;
        volcar_();
      })
      .catch(function () { A.cargando = false; });
  }

  /* Se vuelve a pedir tras guardar un programa: los datos cambiaron. */
  function refrescar_() { A.datos = null; A.pedido++; pintar_(); }

  function volcar_() {
    var d = A.datos;
    if (!d) return;
    var cont = document.getElementById('cfg-programas');
    if (!cont) return;

    /* Resumen arriba del todo. */
    var viejo = document.getElementById('apr-resumen');
    if (viejo && viejo.parentNode) viejo.parentNode.removeChild(viejo);
    var conFalta = d.programas.filter(function (p) { return p.faltan.length; });
    var res = document.createElement('div');
    res.id = 'apr-resumen';
    res.className = conFalta.length ? 'apr-resumen apr-mal' : 'apr-resumen apr-bien';
    var h = [];
    if (conFalta.length) {
      h.push('<b>⚠️ ' + conFalta.length + ' de ' + d.programas.length +
             ' programas tienen variables sin llenar.</b> Cada tarjeta dice cuáles y qué sale en su lugar.');
    } else {
      h.push('<b>✅ Los ' + d.programas.length + ' programas tienen sus 7 variables llenas.</b>');
    }
    if (d.huerfanos && d.huerfanos.length) {
      h.push('<div class="apr-linea">🔴 Hay leads con un programa que <b>no existe en esta lista</b>: ' +
        d.huerfanos.map(function (x) { return esc(x.nombre) + ' (' + x.n + ')'; }).join(', ') +
        '. Esos siempre caen al respaldo global.</div>');
    }
    if (d.sinPrograma) {
      h.push('<div class="apr-linea">🟠 ' + d.sinPrograma +
             ' leads están <b>sin programa</b>: sus mensajes se resuelven con el respaldo global, no con el de un programa.</div>');
    }
    res.innerHTML = h.join('');
    cont.insertBefore(res, cont.firstChild);

    /* Aviso dentro de cada tarjeta. */
    d.programas.forEach(function (p) {
      var card = tarjetaDe_(p.nombre);
      if (!card) return;
      var i = card.id.replace('prog-card-', '');

      var previo = card.querySelector('.apr-card');
      if (previo && previo.parentNode) previo.parentNode.removeChild(previo);
      Array.prototype.forEach.call(card.querySelectorAll('.apr-falta'), function (el) {
        el.classList.remove('apr-falta');
      });

      if (!p.faltan.length) return;

      var caja = document.createElement('div');
      caja.className = 'apr-card';
      var l = ['<div class="apr-card__t">⚠️ A este programa le faltan ' + p.faltan.length +
               ' de 7 variables</div><ul class="apr-lista">'];
      p.faltan.forEach(function (f) {
        var cola = f.nivel === 'respaldo'
          ? '<span class="apr-tag apr-tag--rojo">sale el valor de ' + esc(f.origen) + ', el MISMO para todos los programas</span>'
          : '<span class="apr-tag apr-tag--naranja">el mensaje sale con el hueco en blanco</span>';
        l.push('<li><b>' + esc(f.label) + '</b> <code>' + esc(f.variable) + '</code> · plantilla ' +
               esc(f.plantillas) + '<br>' + cola + '</li>');
        var campo = document.getElementById(CAMPO[f.col] + i);
        if (campo) campo.classList.add('apr-falta');
      });
      l.push('</ul>');
      caja.innerHTML = l.join('');
      var grid = card.querySelector('.cfg-grid');
      if (grid && grid.parentNode) grid.parentNode.insertBefore(caja, grid);
      else card.appendChild(caja);
    });
  }

  /* La tarjeta se localiza por el NOMBRE que pinta app.js (el índice del
     arreglo puede cambiar si se activa o desactiva un programa). */
  function tarjetaDe_(nombre) {
    var cards = document.querySelectorAll('#cfg-programas .cfg-card');
    for (var i = 0; i < cards.length; i++) {
      var b = cards[i].querySelector('.prog-row b');
      if (b && b.textContent.trim() === String(nombre).trim()) return cards[i];
    }
    return null;
  }

  /* Guardar un programa vuelve a pintar la tarjeta: hay que releer. */
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[id^="pr-save-"]') : null;
    if (b) setTimeout(refrescar_, 1200);
  }, true);

  if (!envolver()) {
    var intentos = 0;
    var t = setInterval(function () {
      if (envolver() || ++intentos > 40) clearInterval(t);
    }, 250);
  }

  window.SEPAuditoriaProgramas = { refrescar: refrescar_, _pintar: volcar_, _estado: A };
})();
