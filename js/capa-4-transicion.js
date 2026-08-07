/* ============================================================================
 * CAPA 4 · TRANSICIÓN LATERAL ENTRE PANTALLAS  (parte JS)
 * ----------------------------------------------------------------------------
 * QUÉ HACE
 *   Envuelve `showView()` de app.js y marca la vista que entra con la clase
 *   que toca: `sep-tx-in` si vas hacia adelante, `sep-tx-back` si vuelves.
 *
 * INSTALACIÓN (una línea al final del <body>, DESPUÉS de app.js)
 *   <script src="js/capa-4-transicion.js"></script>
 *
 * PAREJA
 *   css/capa-4-transicion.css  (obligatoria)
 *
 * CÓMO SABE SI VAS O VUELVES
 *   Lleva una pila con el recorrido. Si la vista pedida es la anterior de la
 *   pila, es una vuelta (entra desde la izquierda) y se desapila; si no, es una
 *   ida (entra desde la derecha) y se apila. `inicio` y `login` reinician la
 *   pila, porque desde ahí siempre se empieza de cero.
 *
 * NOTAS
 *   · No toca index.html, app.js ni styles.css. Se quita borrando la línea.
 *   · `showView` es una declaración de función global de app.js, así que se
 *     puede reemplazar por su nombre; todas las llamadas de app.js pasan por
 *     esta envoltura sin tocar una sola línea del original.
 *   · Si el sistema pide "reducir movimiento", la capa se queda inactiva.
 * ========================================================================== */
(function () {
  'use strict';

  if (window.__sep4Transicion) return;
  window.__sep4Transicion = true;

  if (typeof window.showView !== 'function') return;   // app.js no cargó: nada que hacer

  var reduce = false;
  try {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduce = mq.matches;
    if (mq.addEventListener) mq.addEventListener('change', function (e) { reduce = e.matches; });
  } catch (e) { /* navegador viejo */ }

  var RAIZ = { inicio: 1, login: 1, instalar: 1 };
  var pila = [];
  var original = window.showView;
  var temporizador = null;

  window.showView = function (id) {
    var atras = false;

    if (RAIZ[id]) {
      pila = [id];
    } else if (pila.length > 1 && pila[pila.length - 2] === id) {
      pila.pop();
      atras = true;
    } else if (pila[pila.length - 1] !== id) {
      pila.push(id);
    }

    var r = original.apply(this, arguments);
    if (reduce) return r;

    var el = document.getElementById('view-' + id) || document.getElementById(id);
    if (!el) return r;

    el.classList.remove('sep-tx-in', 'sep-tx-back');
    void el.offsetWidth;                        // reinicia la animación
    el.classList.add(atras ? 'sep-tx-back' : 'sep-tx-in');

    document.documentElement.classList.add('sep-tx-anim');
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(function () {
      document.documentElement.classList.remove('sep-tx-anim');
      temporizador = null;
    }, 320);

    return r;
  };
})();
