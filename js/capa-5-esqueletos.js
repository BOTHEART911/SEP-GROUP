/* =============================================================================
 * CAPA 5 · ESQUELETOS DE CARGA  (parte JS · SEP GROUP)
 * -----------------------------------------------------------------------------
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
 * LECTURAS MAPEADAS — ver LECTURAS más abajo (fuente única).
 *   5.5-D (09/10/2026): auditoría completa. Cada lectura que pinta una vista
 *   o un modal tiene la forma de lo que llega y se pinta DENTRO de la
 *   rejilla real (formas "pieza": display contents), con los KPIs y las
 *   pastillas que la vista va a mostrar. Lecturas que se piden en silencio
 *   (búsquedas, detalles con corte propio) usan SEPEsqueleto.html(forma, n).
 *   bootstrap · me · getCatalogoComercial · getUbicaciones → sin silueta,
 *   solo sin girador (no pintan ningún contenedor; son de fondo).
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
    /* Ficha de detalle de un lead (5.5-D: forma real — pares rótulo/valor
       en 2 columnas, botones y el ciclo de seguimientos) */
    detalle: function () {
      var par = '<div class="sep-sk-campo">' + l(30) + l(60) + '</div>';
      return card(
        '<div class="sep-sk-campos sep-sk-campos--2" style="margin-top:4px">' + rep(par, 14) + '</div>' +
        '<div class="sep-sk-acts">' + rep('<span class="sep-sk sep-sk-btn sep-sk-btn--s"></span>', 4) + '</div>' +
        '<div class="sep-sk-rows">' + l(30, true) + '<span class="sep-sk sep-sk-input"></span><span class="sep-sk sep-sk-input"></span></div>'
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
    /* 5.5-C — tarjetas pequeñas del Dashboard (Rendimiento y Ventas):
       franja, nombre, anillo y la fila de cifras. */
    minis: function () {
      var una = '<div class="sep-sk-card rayada sep-sk-mini">' +
        '<div class="sep-sk-top">' + l(60, true) + '<span style="flex:1"></span><span class="sep-sk sep-sk-ring sep-sk-ring--s"></span></div>' +
        '<div class="sep-sk-chips">' + rep('<span class="sep-sk sep-sk-chip"></span>', 3) + '</div></div>';
      return '<div class="sep-sk-minis">' + rep(una, 3) + '</div>';
    },
    /* Tabla corta dentro de una tarjeta del tablero (ya no la usa nadie: 5.5-C) */
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
    },
    /* 5.5-A — tarjeta de Seguimiento: franja, nombre, anillo de avance,
       estado, chips y la ruta de 8 bloques de hitos. */
    seguimiento: function () {
      return card(
        '<div class="sep-sk-top">' + l(60, true) + '<span style="flex:1"></span><span class="sep-sk sep-sk-ring"></span></div>' +
        '<div class="sep-sk-rows">' + '<span class="sep-sk sep-sk-badge" style="width:150px"></span>' + l(45) + '</div>' +
        '<div class="sep-sk-chips">' + rep('<span class="sep-sk sep-sk-chip"></span>', 6) + '</div>' +
        '<div class="sep-sk-ruta">' + rep('<span class="sep-sk sep-sk-blq"></span>', 8) + '</div>' +
        '<div class="sep-sk-acts">' + rep('<span class="sep-sk sep-sk-btn"></span>', 3) + '</div>',
        'rayada'
      );
    },
    /* 5.5-B — tarjeta del Panel de Visas: franja, nombre, anillo n/14,
       estado, siguiente paso, chips y la rejilla de bloques del proceso. */
    visa: function () {
      return card(
        '<div class="sep-sk-top">' + l(60, true) + '<span style="flex:1"></span><span class="sep-sk sep-sk-ring"></span></div>' +
        '<div class="sep-sk-rows">' + '<span class="sep-sk sep-sk-badge" style="width:150px"></span>' + l(45) + '</div>' +
        '<div class="sep-sk-chips">' + rep('<span class="sep-sk sep-sk-chip"></span>', 5) + '</div>' +
        '<div class="sep-sk-vblqs">' + rep('<span class="sep-sk sep-sk-vblq"></span>', 8) + '</div>',
        'rayada'
      );
    },
    /* 5.5-B — tarjeta de Verificación Académica: nombre, correo, chips,
       sello del resultado y el botón Verificar. */
    verif: function () {
      return card(
        l(60, true) + '<div class="sep-sk-rows">' + l(45) + '</div>' +
        '<div class="sep-sk-chips">' + rep('<span class="sep-sk sep-sk-chip"></span>', 4) + '</div>' +
        '<div class="sep-sk-badges"><span class="sep-sk sep-sk-badge" style="width:170px"></span></div>' +
        '<div class="sep-sk-acts"><span class="sep-sk sep-sk-btn"></span></div>',
        'rayada'
      );
    },
    /* 5.5-B — cuerpo del detalle de Verificación: certificados (2 filas
       con su pastilla) + secciones del formulario con sus tarjetas. */
    verifdet: function () {
      var cert = '<div class="sep-sk-top" style="margin-top:12px">' + l(45) + '<span style="flex:1"></span><span class="sep-sk sep-sk-badge"></span></div>';
      return card(l(30, true) + cert + cert) +
        rep(card(l(45, true) + '<div class="sep-sk-grid" style="margin-top:12px">' + rep('<span class="sep-sk sep-sk-field"></span>', 3) + '</div>'), 2);
    },
    /* 5.5-A — sección de Estadísticas: título + rejilla de indicadores. */
    seccion: function () {
      return card(l(30, true) + '<div class="sep-sk-grid" style="margin-top:14px">' + rep('<span class="sep-sk sep-sk-kpi"></span>', 4) + '</div>');
    },
    /* 17/08/2026 — bloques del formulario del estudiante en solo lectura
       (modal "Ver formulario" de Nivel de Inglés). */
    bloque: function () {
      return card(
        '<div class="sep-sk-top">' + l(45, true) + '<span style="flex:1"></span><span class="sep-sk sep-sk-badge"></span></div>' +
        '<div class="sep-sk-grid" style="margin-top:12px">' + rep('<span class="sep-sk sep-sk-field"></span>', 4) + '</div>'
      );
    },

    /* ---- 5.5-D (09/10/2026) — formas medidas sobre la tarjeta real ----
       Las formas "pieza" (ver PIEZAS) se pintan como hijas directas del
       contenedor: la rejilla real (2 columnas en Comercial, 3 en Ofertas,
       KPIs en fila…) las acomoda igual que a las tarjetas que llegan. */
    /* Indicador de la fila de KPIs (.conta-kpi): número + rótulo */
    kpi: function () {
      return '<div class="sep-sk-card sep-sk-kpic">' + l(30, true) + '<span class="sep-sk sep-sk-l sep-sk-w80" style="height:10px"></span></div>';
    },
    /* Pastilla de filtro mientras llega el catálogo */
    pill: function () { return '<span class="sep-sk sep-sk-pill"></span>'; },
    /* Tarjeta de lead de Comercial: nombre + estado, correo, 4 datos y 5 botones */
    comercial: function () {
      return card(
        '<div class="sep-sk-top">' + l(60, true) + '<span style="flex:1"></span><span class="sep-sk sep-sk-badge" style="width:96px"></span></div>' +
        '<div class="sep-sk-rows" style="margin-top:8px">' + l(45) + '</div>' +
        '<div class="sep-sk-chips">' + rep('<span class="sep-sk sep-sk-chip"></span>', 4) + '</div>' +
        '<div class="sep-sk-acts">' + rep('<span class="sep-sk sep-sk-btn sep-sk-btn--s"></span>', 5) + '</div>',
        'rayada'
      );
    },
    /* Tarjeta del Contador: nombre + etapa, correo, datos, archivos y 2 botones */
    conta: function () {
      return card(
        '<div class="sep-sk-top">' + l(60, true) + '<span style="flex:1"></span><span class="sep-sk sep-sk-badge" style="width:110px"></span></div>' +
        '<div class="sep-sk-rows" style="margin-top:8px">' + l(45) + '</div>' +
        '<div class="sep-sk-chips">' + rep('<span class="sep-sk sep-sk-chip"></span>', 3) + '</div>' +
        '<div class="sep-sk-chips">' + rep('<span class="sep-sk sep-sk-dot"></span>', 6) + '</div>' +
        '<div class="sep-sk-acts">' + rep('<span class="sep-sk sep-sk-btn sep-sk-btn--s"></span>', 2) + '</div>',
        'rayada'
      );
    },
    /* Tarjeta de Nivel de Inglés: foto, nombre, datos, panel del puntaje,
       6 accesos y la fila de acciones */
    nivel: function () {
      return card(
        '<div class="sep-sk-top"><span class="sep-sk sep-sk-av"></span><span class="sep-sk-id">' + l(80, true) + l(60) + l(45) + '</span>' +
        '<span class="sep-sk sep-sk-badge" style="width:84px;align-self:flex-start"></span></div>' +
        '<span class="sep-sk sep-sk-panel"></span>' +
        '<div class="sep-sk-tiles">' + rep('<span class="sep-sk sep-sk-tile"></span>', 6) + '</div>' +
        '<div class="sep-sk-acts">' + rep('<span class="sep-sk sep-sk-btn sep-sk-btn--s"></span>', 4) + '</div>',
        'rayada'
      );
    },
    /* Tarjeta de oferta: foto 16:9, empleador, cargo, datos y botones */
    oferta: function () {
      return '<div class="sep-sk-card sep-sk-ofe"><span class="sep-sk sep-sk-foto"></span><div class="sep-sk-ofe__in">' +
        l(30) + l(60, true) + '<div class="sep-sk-chips">' + rep('<span class="sep-sk sep-sk-chip"></span>', 3) + '</div>' +
        '<div class="sep-sk-acts">' + rep('<span class="sep-sk sep-sk-btn sep-sk-btn--s"></span>', 3) + '</div></div></div>';
    },
    /* Tarjeta compacta de usuario del equipo: foto, nombre, dato, 2 insignias
       y los íconos a la derecha */
    persona: function () {
      return card(
        '<div class="sep-sk-top"><span class="sep-sk sep-sk-av"></span>' +
        '<span class="sep-sk-id">' + l(80, true) + l(60) + '<span class="sep-sk-chips" style="margin-top:2px">' +
        rep('<span class="sep-sk sep-sk-chip" style="width:52px"></span>', 2) + '</span></span>' +
        '<span class="sep-sk-col">' + rep('<span class="sep-sk sep-sk-ico" style="width:26px;height:26px"></span>', 2) + '</span></div>',
        'rayada sep-sk-persona'
      );
    },
    /* Sección de formulario de configuración: título + filas rótulo/campo */
    formsec: function () {
      var fila = '<div class="sep-sk-campo">' + l(30) + '<span class="sep-sk sep-sk-input"></span></div>';
      return card(l(30, true) + '<div class="sep-sk-campos">' + rep(fila, 4) + '</div>');
    },
    /* Leyenda de una dona del Dashboard: punto + nombre + cifra */
    leyenda: function () {
      var f = '<div class="sep-sk-ley"><span class="sep-sk sep-sk-dot" style="width:10px;height:10px"></span>' + l(60) + '<span class="sep-sk sep-sk-l" style="width:30px"></span></div>';
      return rep(f, 5);
    },
    anillo: function () { return '<span class="sep-sk sep-sk-ring sep-sk-ring--l"></span>'; },
    /* Cabecera de la oferta en "Participantes" + lista de participantes */
    participantes: function () {
      return card('<div class="sep-sk-top"><span class="sep-sk-id">' + l(45, true) + l(60) + l(45) + '</span><span class="sep-sk sep-sk-btn" style="flex:0 0 170px"></span></div>') +
        rep(card('<div class="sep-sk-top">' + l(60, true) + '<span style="flex:1"></span><span class="sep-sk sep-sk-badge"></span></div>' +
          '<div class="sep-sk-chips">' + rep('<span class="sep-sk sep-sk-chip"></span>', 3) + '</div>'), 2);
    },
    /* "Ofertas para este participante": cabecera, aviso y rejilla de ofertas */
    ofertasPart: function () {
      var o = '<div class="sep-sk-card" style="margin:0">' + l(45, true) + '<div class="sep-sk-rows" style="margin-top:8px">' + l(80) + l(60) + '</div>' +
        '<span class="sep-sk sep-sk-panel" style="height:64px"></span><div class="sep-sk-acts"><span class="sep-sk sep-sk-btn sep-sk-btn--s" style="flex:0 0 90px"></span></div></div>';
      return card(l(45, true) + '<div class="sep-sk-rows" style="margin-top:8px">' + l(60) + '</div><span class="sep-sk sep-sk-panel" style="height:56px"></span>') +
        '<div class="sep-sk-par">' + rep(o, 4) + '</div>';
    },
    /* Documentos del participante (modal): aviso, pestañas del panel y
       una fila por documento (nombre + estado, datos y botones) */
    ndoc: function () {
      return '<div class="sep-sk-rows" style="margin:0 0 10px">' + l(95) + l(60) + '</div>' +
        '<div class="sep-sk-chips" style="margin:0 0 12px">' + rep('<span class="sep-sk sep-sk-chip" style="width:70px;height:22px"></span>', 5) + '</div>' +
        rep(card('<div class="sep-sk-top">' + l(45, true) + '<span style="flex:1"></span><span class="sep-sk sep-sk-badge" style="width:130px"></span></div>' +
          '<div class="sep-sk-rows">' + l(45) + l(30) + '</div>' +
          '<div class="sep-sk-acts">' + rep('<span class="sep-sk sep-sk-btn sep-sk-btn--s"></span>', 4) + '</div>'), 4);
    },
    /* Detalle de oferta (modal): las 7 secciones plegables */
    acordeon: function () {
      return rep('<span class="sep-sk sep-sk-acc"></span>', 7);
    },
    /* Modal de exportar: formato (2 tarjetas) + alcance (fechas y chips) */
    exportar: function () {
      return card(l(30, true) + '<div class="sep-sk-par" style="margin-top:12px">' + rep('<span class="sep-sk sep-sk-field" style="height:70px"></span>', 2) + '</div>') +
        card(l(30, true) + '<span class="sep-sk sep-sk-input" style="margin-top:12px"></span>' +
          '<div class="sep-sk-chips">' + rep('<span class="sep-sk sep-sk-chip"></span>', 10) + '</div>');
    }
  };

  /* Formas que se pintan como hijas directas del contenedor (sin caja
     propia): así la rejilla real decide columnas y tamaños. */
  var PIEZAS = { kpi: 1, pill: 1, comercial: 1, conta: 1, nivel: 1, oferta: 1, persona: 1, visa: 1, verif: 1, seguimiento: 1, leyenda: 1, anillo: 1 };

  /* ---- Mapa: acción de lectura → [contenedor, forma, cuántas] ------------ */
  var LECTURAS = {
    /* 5.5-D — cada lectura con la forma de lo que llega, en su rejilla
       real, con las pastillas y los KPIs que la vista pinta. */
    comercialInit:        [['com-filters', 'pill', 3], ['com-cards', 'comercial', 6]],
    listComercial:        [['com-cards', 'comercial', 6]],
    listUsuarios:         [['usr-cards', 'persona', 9]],
    verComercial:         [['com-detalle-cuerpo', 'detalle', 1]],   /* 5.5-D la cabecera ya está pintada */
    listArchivosPrograma: [['arch-list', 'archivo', 3]],
    contadorInit:         [['conta-resumen', 'kpi', 8], ['conta-filters', 'pill', 3], ['conta-cards', 'conta', 6]],
    listContador:         [['conta-resumen', 'kpi', 8], ['conta-cards', 'conta', 6]],
    getConfigFull: [
      ['cfg-general', 'formsec', 3],
      ['cfg-programas', 'tarjeta', 3],
      ['cfg-promos', 'tarjeta', 2],
      ['cfg-agenda', 'formsec', 2],
      ['cfg-plantillas', 'tarjeta', 2],
      ['cfg-listas', 'formsec', 2],
      ['cfg-nivel', 'formsec', 2],
      ['cfg-avanzado', 'formsec', 2]
    ],
    dashboard: [
      ['@view-dashboard', 'marca'],                 /* las gráficas (canvas) brillan mientras llegan */
      ['dsh-kpis', 'kpi', 6],
      ['dsh-ctr-prog', 'anillo', 1], ['dsh-lg-prog', 'leyenda', 1],
      ['dsh-ctr-fuente', 'anillo', 1], ['dsh-lg-fuente', 'leyenda', 1],
      ['dsh-rend', 'minis', 1],
      ['dsh-estados', 'barras', 1],
      ['dsh-ventas', 'minis', 1],
      ['dsh-alertas', 'texto', 1]
    ],
    nivelInit:            [['nive-resumen', 'kpi', 6], ['nive-proc', 'kpi', 5], ['nive-filters', 'pill', 5], ['nive-cards', 'nivel', 4]],
    listNivel:            [['nive-resumen', 'kpi', 6], ['nive-proc', 'kpi', 5], ['nive-cards', 'nivel', 4]],
    nivelFormulario:      [['nform-body', 'bloque', 4]],
    exportInit:           [['exp-body', 'exportar', 1]],
    ofertasInit:             [['ofe-resumen', 'kpi', 5], ['ofe-filters', 'pill', 8], ['ofe-cards', 'oferta', 6]],
    listOfertas:             [['ofe-resumen', 'kpi', 5], ['ofe-cards', 'oferta', 6]],
    verOferta:               [['ofe-modal-body', 'acordeon', 1]],
    ofertasConfig:           [['ofecfg-body', 'formsec', 3]],
    ofertaParticipantes:     [['ofe-part-body', 'participantes', 1]],
    ofertasParaParticipante: [['ofe-part-body', 'ofertasPart', 1]],
    docsParticipante:        [['ndocs-body', 'ndoc', 1]],
    verifInit:               [['veri-resumen', 'kpi', 3], ['veri-filters', 'pill', 2], ['veri-cards', 'verif', 4]],
    verifDetalle:            [['veri-det-body', 'verifdet', 1]],
    visasInit:               [['vis-resumen', 'kpi', 13], ['vis-filters', 'pill', 2], ['vis-cards', 'visa', 2]],
    seguimientoInit:         [['seg-filters', 'pill', 10], ['seg-cards', 'seguimiento', 4], ['est-filters', 'pill', 4], ['est-cuerpo', 'seccion', 3]],
    /* Lecturas de fondo: sin girador y sin silueta (no pintan contenedor) */
    bootstrap: [],
    me: [],
    getCatalogoComercial: [],
    getUbicaciones: []
  };

  /* Avisos de "no hay nada" que deben esconderse mientras se pinta la silueta */
  var VACIOS = { 'com-cards': 'com-empty', 'usr-cards': 'usr-empty', 'conta-cards': 'conta-empty',
                 'nive-cards': 'nive-empty', 'ofe-cards': 'ofe-empty',
                 'veri-cards': 'veri-empty', 'seg-cards': 'seg-empty', 'vis-cards': 'vis-empty' };

  /* ---- Pintar / retirar -------------------------------------------------- */
  function pintar(plan) {
    var puestos = [], restaurar = [];

    plan.forEach(function (t) {
      /* '@id' + 'marca': no se pinta nada dentro; el elemento queda
         marcado y el CSS hace brillar lo que no admite silueta (canvas). */
      if (t[0].charAt(0) === '@') {
        var el = document.getElementById(t[0].slice(1));
        if (el) { el.classList.add('sep-sk-cargando'); restaurar.push({ quitarMarca: el }); }
        return;
      }
      var cont = document.getElementById(t[0]);
      if (!cont) return;

      var forma = FORMAS[t[1]] || FORMAS.texto;
      var wrap = document.createElement('div');
      wrap.className = 'sep-sk-wrap' + (PIEZAS[t[1]] ? ' sep-sk-piezas' : '');
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
      restaurar.forEach(function (el) {
        if (el.quitarMarca) el.quitarMarca.classList.remove('sep-sk-cargando');
        else el.classList.remove('hidden');
      });
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

  /* 5.5-D — para las lecturas que se piden en silencio (búsquedas,
     detalles con su propio corte): window.SEPEsqueleto.html('forma', n). */
  window.SEPEsqueleto = {
    html: function (forma, n) {
      var f = FORMAS[forma] || FORMAS.texto;
      return '<div class="sep-sk-wrap' + (PIEZAS[forma] ? ' sep-sk-piezas' : '') + '" aria-busy="true" aria-label="Cargando">' + rep(f(), n || 1) + '</div>';
    }
  };
})();
