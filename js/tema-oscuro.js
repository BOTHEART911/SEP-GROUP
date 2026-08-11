/* ============================================================================
 * SEP GROUP — MODO OSCURO (parte JS) · 11/08/2026
 * SEP Colombia Group SAS
 * ----------------------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario. Modificarlo anula la garantía de funcionamiento.
 * ----------------------------------------------------------------------------
 * QUÉ HACE
 *   · Pinta el botón 🌙/☀️ fijo arriba a la derecha, en todas las vistas.
 *   · Guarda la elección en el dispositivo (llave sep.tema.v1).
 *   · SIN elección guardada SIGUE AL SISTEMA, y cambia solo si el sistema
 *     cambia (de día a noche) mientras la app está abierta.
 *   · Repinta las gráficas del Dashboard: Chart.js dibuja sobre un canvas,
 *     así que el CSS no las alcanza. Sin esto, los textos de los ejes y el
 *     borde blanco de los donuts se quedaban del tema anterior.
 *
 * INSTALACIÓN
 *   <link rel="stylesheet" href="css/tema-oscuro.css" />   (en el <head>)
 *   <script src="js/tema-oscuro.js"></script>              (el ÚLTIMO del body)
 *   + el guion antiparpadeo que ya va dentro del <head> del index.html.
 *
 * NO TOCA app.js ni styles.css.
 * ========================================================================== */
(function () {
  'use strict';

  var LLAVE = 'sep.tema.v1';
  var OSCURO = 'oscuro', CLARO = 'claro';

  function leerGuardado() {
    try { var v = localStorage.getItem(LLAVE); return (v === OSCURO || v === CLARO) ? v : ''; }
    catch (e) { return ''; }
  }
  function guardar(t) { try { localStorage.setItem(LLAVE, t); } catch (e) {} }

  function sistemaOscuro() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function temaActual() {
    return document.documentElement.getAttribute('data-tema') === OSCURO ? OSCURO : CLARO;
  }

  /* La barra del navegador y el color de la app instalada. */
  function pintarMeta(t) {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === OSCURO ? '#0e141c' : '#263143');
  }

  function pintarBoton(t) {
    var b = document.getElementById('tema-btn');
    if (!b) return;
    var oscuro = (t === OSCURO);
    b.textContent = oscuro ? '☀️' : '🌙';
    b.title = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', oscuro ? 'true' : 'false');
  }

  function aplicar(t, opts) {
    var tema = (t === OSCURO) ? OSCURO : CLARO;
    document.documentElement.setAttribute('data-tema', tema);
    pintarMeta(tema);
    pintarBoton(tema);
    if (!opts || !opts.silencioso) repintarGraficas();
  }

  /* ── Gráficas del tablero ────────────────────────────────────────────────
     Chart.js pinta en canvas: hay que rehacerlas para que cojan los colores
     del tema. Solo se repintan si la vista del tablero está a la vista y ya
     hay datos cargados; si no, se pintarán solas la próxima vez. */
  function repintarGraficas() {
    try {
      if (typeof Chart === 'undefined') return;
      var oscuro = (temaActual() === OSCURO);
      Chart.defaults.color       = oscuro ? '#b7c3d2' : '#666';
      Chart.defaults.borderColor = oscuro ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.1)';
      var vista = document.getElementById('view-dashboard');
      var visible = vista && getComputedStyle(vista).display !== 'none';
      if (visible && typeof dashRenderAll_ === 'function' &&
          typeof DASH !== 'undefined' && DASH && DASH.data) {
        dashRenderAll_(DASH.data);
      }
    } catch (e) { /* el tema nunca debe tumbar la app */ }
  }

  /* ── Botón ───────────────────────────────────────────────────────────── */
  function crearBoton() {
    if (document.getElementById('tema-btn')) return;
    var b = document.createElement('button');
    b.id = 'tema-btn';
    b.type = 'button';
    b.className = 'tema-btn';
    b.setAttribute('data-salida', '1');   // por si algún día entra la capa anti doble clic
    b.addEventListener('click', function () {
      var nuevo = (temaActual() === OSCURO) ? CLARO : OSCURO;
      guardar(nuevo);
      aplicar(nuevo);
    });
    document.body.appendChild(b);
    pintarBoton(temaActual());
  }

  /* ── Arranque ────────────────────────────────────────────────────────── */
  function iniciar() {
    crearBoton();
    /* El guion del <head> ya dejó puesto data-tema antes del primer pintado;
       aquí solo se sincroniza el botón y la barra del navegador. */
    aplicar(temaActual(), { silencioso: true });

    /* Sin elección propia, la app sigue al sistema en caliente. */
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var alCambiar = function () {
        if (leerGuardado()) return;                 // el usuario ya decidió
        aplicar(sistemaOscuro() ? OSCURO : CLARO);
      };
      if (mq.addEventListener) mq.addEventListener('change', alCambiar);
      else if (mq.addListener) mq.addListener(alCambiar);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  /* Puerta para las pruebas y para el resto de la app. */
  window.SEPTema = {
    actual: temaActual,
    aplicar: aplicar,
    alternar: function () { var n = (temaActual() === OSCURO) ? CLARO : OSCURO; guardar(n); aplicar(n); return n; },
    seguirSistema: function () { try { localStorage.removeItem(LLAVE); } catch (e) {} aplicar(sistemaOscuro() ? OSCURO : CLARO); },
    repintarGraficas: repintarGraficas
  };
})();
