/* ============================================================================
 * CAPA 5 · ESQUELETOS DE CARGA  (parte JS · SEP GROUP)
 * ----------------------------------------------------------------------------
 * QUÉ HACE
 *   Quita el girador de pantalla completa en las LECTURAS y pone en su lugar
 *   siluetas grises con la forma de lo que va a llegar. El girador sigue
 *   saliendo tal cual en GUARDAR, SUBIR, ELIMINAR, INICIAR SESIÓN y en las
 *   acciones del bot: ahí sí hay que bloquear la pantalla.
 *
 * INSTALACIÓN (una línea al final del <body>, DESPUÉS de app.js)
 *   <script src="js/capa-5-esqueletos.js"></script>
 *
 * PAREJA
 *   css/capa-5-esqueletos.css  (obligatoria)
 *
 * CÓMO SE ENGANCHA
 *   `apiGet` y `apiPost` son declaraciones de función globales de app.js, así
 *   que se pueden envolver por su nombre sin tocar una línea del original.
 *   La envoltura mira la acción:
 *     · Acción de LECTURA y llamada visible  → esqueleto + `silent:true`
 *       (el `silent:true` es lo que impide que salga el girador).
 *     · Acción de LECTURA pero la llamada YA venía con `silent:true`
 *       → no se pinta nada. Son los refrescos de segundo plano (sondeo cada
 *       12 s, señal de Firebase, volver a la pestaña): ahí ya hay datos en
 *       pantalla y taparlos con siluetas sería peor.
 *     · Cualquier otra acción → pasa intacta, con su girador de siempre.
 *
 * LECTURAS MAPEADAS (ids reales de esta app, todos rellenados con innerHTML)
 *   listComercial        → #com-cards
 *   contadorInit         → #conta-resumen (KPIs) + #conta-cards   (Fase 4)
 *   listContador         → #conta-resumen (KPIs) + #conta-cards   (Fase 4)
 *   listUsuarios         → #usr-cards
 *   verComercial         → #com-detalle
 *   getConfigFull        → los 6 paneles #cfg-*
 *   dashboard            → #dsh-kpis #dsh-rend #dsh-estados #dsh-ventas #dsh-alertas
 *   listArchivosPrograma → #arch-list
 *   bootstrap · me · getCatalogoComercial · getUbicaciones → sin silueta, solo
 *   sin girador (no pintan ningún contenedor; son de fondo).
 *
 * LO QUE NO TOCA
 *   · #loader sigue existiendo y sigue saliendo en las acciones de escritura.
 *   · Los modales, el visor y el chat flotante.
 *
 * NOTAS
 *   · No toca index.html, app.js ni styles.css. Se quita borrando la línea.
 *   · La silueta se retira SIEMPRE al terminar la llamada, salga bien o mal,
 *     así que nunca puede quedarse una pantalla congelada en gris.
 * ========================================================================== */
(function () {
  'use strict';

  if (window.__sep5Esqueletos) return;
  window.__sep5Esqueletos = true;

  /* ---- Piezas ----------------------------------------------------------- */
  function l(w, tit) { return '<span class="sep-sk sep-sk-l' + (tit ? ' tit' : '') + ' sep-sk-w' + w + '"></span>'; }
  function card(inner, extra) { return '<div class="sep-sk-card' + (extra ? ' ' + extra : '') + '">' + inner + '</div>'; }
  function rep(html, n) { var s = ''; for (var i = 0; i < n; i++) s += html; return s; }

  /* ---- Formas ----------------------------------------------------------- */
  var FORMAS = {
    /* Tarjeta de lead del tablero Comercial (con su franja de color) */
    lead: function () {
      return card(
        '<div class="sep-sk-top">' + l(60, true) + '<span style="flex:1"></span><span class="sep-sk sep-sk-badge" style="width:92px"></span></div>' +
        '<div class="sep-sk-rows">' + l(45) + l(80) + '</div>' +
        '<div class="sep-sk-acts">' + rep('<span class="sep-sk sep-sk-btn"></span>', 3) + '</div>',
        'rayada'
      );
    },
    /* Tarjeta de usuario del equipo */
    persona: function () {
      return card(
        '<div class="sep-sk-top"><span class="sep-sk sep-sk-av"></span>' +
        '<span class="sep-sk-id">' + l(60, true) + l(45) + '</span></div>' +
        '<div class="sep-sk-badges"><span class="sep-sk sep-sk-badge"></span></div>' +
        '<div class="sep-sk-acts">' + rep('<span class="sep-sk sep-sk-btn"></span>', 2) + '</div>'
      );
    },
    /* Ficha de detalle de un lead */
    detalle: function () {
      return card(
        '<div class="sep-sk-top">' + l(45, true) + '<span style="flex:1"></span><span class="sep-sk sep-sk-badge"></span></div>' +
        '<div class="sep-sk-grid" style="margin-top:16px">' + rep('<span class="sep-sk sep-sk-field"></span>', 8) + '</div>' +
        '<div class="sep-sk-rows">' + l(95) + l(80) + l(60) + '</div>' +
        '<div class="sep-sk-acts">' + rep('<span class="sep-sk sep-sk-btn"></span>', 3) + '</div>'
      );
    },
    /* Rejilla de campos de un formulario de configuración */
    campos: function () {
      return card(
        l(30, true) +
        '<div class="sep-sk-grid" style="margin-top:14px">' + rep('<span class="sep-sk sep-sk-field"></span>', 6) + '</div>'
      );
    },
    /* Tarjeta genérica de configuración (programas, promos, plantillas…) */
    tarjeta: function () {
      return card(
        '<div class="sep-sk-top">' + l(45, true) + '<span style="flex:1"></span><span class="sep-sk sep-sk-ico"></span></div>' +
        '<div class="sep-sk-rows">' + l(95) + l(60) + '</div>' +
        '<div class="sep-sk-acts">' + rep('<span class="sep-sk sep-sk-btn"></span>', 2) + '</div>'
      );
    },
    /* Fila de archivo dentro del modal de brochures / condiciones */
    archivo: function () {
      return card(
        '<div class="sep-sk-top"><span class="sep-sk-id">' + l(80, true) + l(45) + '</span>' +
        '<span class="sep-sk sep-sk-btn" style="flex:0 0 72px"></span>' +
        '<span class="sep-sk sep-sk-btn" style="flex:0 0 72px"></span></div>'
      );
    },
    /* Bloque de KPIs del tablero (sin tarjeta alrededor: ya es una rejilla) */
    kpis: function () {
      return '<div class="sep-sk-grid">' + rep('<span class="sep-sk sep-sk-kpi"></span>', 5) + '</div>';
    },
    /* Tabla corta dentro de una tarjeta del tablero */
    tabla: function () {
      return '<div class="sep-sk-rows" style="margin-top:0">' + l(95, true) + l(95) + l(80) + l(80) + l(60) + '</div>';
    },
    /* Barras horizontales (estado de los leads) */
    barras: function () {
      return '<div class="sep-sk-rows" style="margin-top:0">' +
        l(95) + l(80) + l(60) + l(45) + l(30) + '</div>';
    },
    texto: function () {
      return '<div class="sep-sk-rows" style="margin-top:0">' + l(95) + l(80) + l(45) + '</div>';
    }
  };

  /* ---- Mapa: acción de lectura → [contenedor, forma, cuántas] ------------ */
  var LECTURAS = {
    comercialInit:        [['com-cards', 'lead', 4]],
    listComercial:        [['com-cards', 'lead', 4]],
    listUsuarios:         [['usr-cards', 'persona', 4]],
    verComercial:         [['com-detalle', 'detalle', 1]],
    listArchivosPrograma: [['arch-list', 'archivo', 3]],
    /* Fase 4 — la vista Contador ya no usa girador: silueta como el resto */
    contadorInit:         [['conta-resumen', 'kpis', 1], ['conta-cards', 'lead', 4]],
    listContador:         [['conta-resumen', 'kpis', 1], ['conta-cards', 'lead', 4]],
    getConfigFull: [
      ['cfg-general', 'campos', 1],
      ['cfg-programas', 'tarjeta', 3],
      ['cfg-promos', 'tarjeta', 2],
      ['cfg-agenda', 'campos', 1],
      ['cfg-plantillas', 'tarjeta', 2],
      ['cfg-avanzado', 'campos', 1]
    ],
    dashboard: [
      ['dsh-kpis', 'kpis', 1],
      ['dsh-rend', 'tabla', 1],
      ['dsh-estados', 'barras', 1],
      ['dsh-ventas', 'tabla', 1],
      ['dsh-alertas', 'texto', 1]
    ],
    /* Lecturas de fondo: sin girador y sin silueta (no pintan contenedor) */
    bootstrap: [],
    me: [],
    getCatalogoComercial: [],
    getUbicaciones: []
  };

  /* Avisos de "no hay nada" que deben esconderse mientras se pinta la silueta */
  var VACIOS = { 'com-cards': 'com-empty', 'usr-cards': 'usr-empty', 'conta-cards': 'conta-empty' };

  /* ---- Pintar / retirar -------------------------------------------------- */
  function pintar(plan) {
    var puestos = [], restaurar = [];

    plan.forEach(function (t) {
      var cont = document.getElementById(t[0]);
      if (!cont) return;

      var forma = FORMAS[t[1]] || FORMAS.texto;
      var wrap = document.createElement('div');
      wrap.className = 'sep-sk-wrap';
      wrap.setAttribute('aria-busy', 'true');
      wrap.setAttribute('aria-label', 'Cargando');
      wrap.innerHTML = rep(forma(), t[2]);

      cont.innerHTML = '';
      cont.appendChild(wrap);
      puestos.push(wrap);

      var vacioId = VACIOS[t[0]];
      if (vacioId) {
        var vacio = document.getElementById(vacioId);
        if (vacio && !vacio.classList.contains('hidden')) {
          vacio.classList.add('hidden');
          restaurar.push(vacio);
        }
      }
    });

    return function retirar() {
      puestos.forEach(function (w) { if (w.parentNode) w.parentNode.removeChild(w); });
      restaurar.forEach(function (el) { el.classList.remove('hidden'); });
    };
  }

  /* ---- Envoltura de apiGet / apiPost ------------------------------------- */
  function envolver(nombre) {
    var original = window[nombre];
    if (typeof original !== 'function') return;

    window[nombre] = function (accion, datos, opts) {
      var plan = LECTURAS[accion];
      var yaSilencioso = !!(opts && opts.silent);

      if (!plan) return original.apply(this, arguments);   // escritura: girador de siempre

      var nuevasOpts = {};
      for (var k in (opts || {})) nuevasOpts[k] = opts[k];
      nuevasOpts.silent = true;                            // esto es lo que apaga el girador

      var retirar = (yaSilencioso || !plan.length) ? null : pintar(plan);

      var p = original.call(this, accion, datos, nuevasOpts);
      if (!retirar) return p;

      return p.then(
        function (r) { retirar(); return r; },
        function (e) { retirar(); throw e; }
      );
    };
  }

  envolver('apiGet');
  envolver('apiPost');
})();
