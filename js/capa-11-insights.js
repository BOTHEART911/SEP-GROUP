/* ============================================================
 * SEP GROUP — CAPA 11 · INSIGHTS (11/08/2026)
 * SEP Colombia Group SAS
 * ------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales
 * Contacto: +57 310 323 0712
 * ------------------------------------------------------------
 * Software propietario. Cualquier modificación de este archivo
 * por terceros anula automáticamente la garantía de
 * funcionamiento.
 * ------------------------------------------------------------
 * QUÉ HACE
 *   Pone un botón flotante en COMERCIAL, DASHBOARD y CONTADOR.
 *   Al tocarlo abre un chat SIN campo de texto: abajo hay botones
 *   fijos y cada uno responde con un informe escrito, con efecto
 *   "escribiendo", lectura en voz, Copiar y enviar por WhatsApp.
 *   NADA se lanza solo: el panel se abre y espera.
 *
 * DE DÓNDE SALEN LOS NÚMEROS
 *   NO hay ninguna IA. Cada informe se calcula AQUÍ, en el
 *   navegador, con las MISMAS listas que ya están pintadas y
 *   RESPETANDO los filtros y el buscador que tenga puestos el
 *   usuario. Por eso salen al instante, no viaja ni un dato a
 *   terceros y siempre cuadran con lo que se ve en pantalla.
 *   Se reutilizan los helpers de app.js (basePrograma_,
 *   normAsesor_, contaBasePlan_…) para que informe y tarjetas no
 *   puedan discrepar.
 *
 * QUIÉN LO VE
 *   Todos los roles. Cada uno sobre SUS datos: el COMERCIAL solo
 *   tiene sus leads en pantalla, así que su informe es el suyo.
 *
 * VOZ
 *   Inworld, por dos endpoints del backend (vozEstado / vozHablar)
 *   que guardan la clave en la hoja CONFIGURACION. Se manda a leer
 *   SOLO el resumen en cifras: ni nombres, ni documentos, ni
 *   correos, ni teléfonos salen hacia el proveedor de voz.
 *   La petición usa fetch propio a propósito: pasar por apiGet
 *   encendería el girador de la app.
 *   REGLA DURA: el campo `voz` de cada informe lleva SOLO cifras. Ni
 *   nombres de estudiantes ni nombres del equipo. Hay una prueba que
 *   se pone roja si se cuela cualquiera de los dos.
 *
 * iPhone
 *   Safari solo deja sonar audio si hubo un gesto antes. El audio
 *   se desbloquea en el mismo toque que abre el panel y en cada
 *   toque de un botón.
 *
 * INSTALACIÓN (al final del <body>, después de las capas)
 *   <script src="js/capa-11-insights.js"></script>
 * PAREJA
 *   css/capa-11-insights.css (en el <head>, tras css/tema-oscuro.css)
 *
 * No toca app.js ni js/contador.js.
 * ============================================================ */
(function () {
  'use strict';

  if (window.__sep11Insights) return;
  window.__sep11Insights = true;

  /* ---------------- iconos ---------------- */
  var ROBOT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="4" y="8" width="16" height="11" rx="3.5"/><path d="M12 8V4.5"/><circle cx="12" cy="3.2" r="1.3"/>' +
    '<path d="M1.8 12.5v3M22.2 12.5v3"/><circle cx="9" cy="13" r="1.15" fill="currentColor" stroke="none"/>' +
    '<circle cx="15" cy="13" r="1.15" fill="currentColor" stroke="none"/><path d="M9.5 16.3h5"/></svg>';
  var CERRAR = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var WA = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.42 1.32 4.9L2 22l5.4-1.42a9.8 9.8 0 0 0 4.64 1.18h.01c5.43 0 9.84-4.4 9.84-9.84C21.89 6.4 17.48 2 12.04 2zm0 17.96h-.01a8.2 8.2 0 0 1-4.16-1.14l-.3-.18-3.09.81.82-3.01-.2-.31a8.14 8.14 0 0 1-1.25-4.35c0-4.51 3.67-8.18 8.19-8.18 2.19 0 4.24.85 5.79 2.4a8.13 8.13 0 0 1 2.4 5.79c0 4.51-3.68 8.17-8.19 8.17z"/></svg>';
  var BOCINA = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9.5h3l4-3v11l-4-3H5z"/><path d="M16 9.2a4 4 0 0 1 0 5.6"/><path d="M18.6 6.8a7.5 7.5 0 0 1 0 10.4"/></svg>';
  var STOP = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>';

  /* WAV mudo: deja el <audio> "activado" dentro del gesto del usuario,
     que es lo que exige Safari en iPhone. */
  var SILENCIO = 'data:audio/wav;base64,UklGRqQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

  /* ---------------- estado ---------------- */
  var fab = null;
  var abierta = false;
  var cerrarHoja = null;
  var vozCfg = null, pidiendoVoz = null;

  /* ============================================================
     UTILIDADES
     ============================================================ */
  function limpio(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nodo(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  }
  function reducido() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function avisar(msg) {
    try {
      if (window.Swal && Swal.fire) Swal.fire({ icon: 'error', title: msg, timer: 2200, showConfirmButton: false });
    } catch (e) {}
  }
  /* app.js declara COM, DASH y CONTA con let/const: NO cuelgan de window,
     pero sí se ven desde otro script clásico. Se leen siempre así, con
     respaldo, para que la capa no se caiga si algo aún no existe. */
  function leer(f, porDefecto) {
    try { var v = f(); return (v == null) ? porDefecto : v; } catch (e) { return porDefecto; }
  }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function etiq(v) { var s = txt(v); return s || 'Sin dato'; }
  function num(n) {
    try { return Number(n || 0).toLocaleString('es-CO'); } catch (e) { return String(n || 0); }
  }
  function b(n) { return '**' + num(n) + '**'; }
  function pct(a, t) { return t ? Math.round(a * 100 / t) : 0; }
  function bp(a, t) { return '**' + pct(a, t) + ' %**'; }
  function plural(n, uno, varios) { return n === 1 ? uno : varios; }
  function pesos(n) { return '$ ' + num(Math.round(Number(n) || 0)); }
  function usd(n) {
    var v = Number(n);
    if (!v && v !== 0) return '—';
    try { return 'US$ ' + v.toLocaleString('en-US'); } catch (e) { return 'US$ ' + v; }
  }
  function llano(s) {
    var t = String(s == null ? '' : s).trim().toUpperCase();
    try { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { return t; }
  }

  /* ---------------- fechas ----------------
     Del backend llegan en ISO corto ("2026-08-11"); también se aceptan
     dd/MM/yyyy e ISO con hora, por si alguna hoja trae otro formato. */
  function fecha(s) {
    var t = txt(s);
    if (!t) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    var d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  }
  function hoy0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function dias(desde, hasta) {
    if (!desde) return null;
    var a = new Date(desde); a.setHours(0, 0, 0, 0);
    var z = hasta ? new Date(hasta) : hoy0(); z.setHours(0, 0, 0, 0);
    return Math.round((z - a) / 86400000);
  }
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIASEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function mesLargo(d) { return MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
  function claveMes(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function fechaCorta(d) { return d ? d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear() : '—'; }

  /* ---------------- conteos ---------------- */
  function contar(lista, fn) {
    var m = {};
    lista.forEach(function (r) {
      var k = fn(r);
      if (k === null || k === undefined || k === '') k = 'Sin dato';
      m[k] = (m[k] || 0) + 1;
    });
    return Object.keys(m).map(function (k) { return { k: k, n: m[k] }; })
      .sort(function (a, b2) { return b2.n - a.n || String(a.k).localeCompare(String(b2.k)); });
  }
  function sumar(lista, fn) {
    var t = 0;
    lista.forEach(function (r) { var v = Number(fn(r)); if (!isNaN(v)) t += v; });
    return t;
  }
  /* Ranking en viñetas. `tope` limita y avisa de cuántos quedaron fuera. */
  function ranking(pares, total, tope, sufijo) {
    tope = tope || 8;
    var l = pares.slice(0, tope).map(function (p) {
      return '- ' + p.k + ': ' + b(p.n) + (total ? ' (' + pct(p.n, total) + ' %)' : '') + (sufijo ? ' ' + sufijo : '');
    });
    if (pares.length > tope) l.push('- _y ' + (pares.length - tope) + ' ' + plural(pares.length - tope, 'más', 'más') + '_');
    return l.join('\n');
  }
  function vacio(titulo) {
    return {
      titulo: titulo,
      texto: 'No hay nada que analizar con los filtros que tienes puestos.\n\nQuita algún filtro o borra el buscador y vuelve a tocar el botón.',
      voz: 'No hay datos con los filtros puestos.'
    };
  }

  /* ============================================================
     RED (voz) — fetch propio: NO pasa por apiGet/apiPost para no
     encender el girador de la app en cada trozo de audio.
     ============================================================ */
  function base() {
    try { if (typeof API_BASE === 'string' && API_BASE) return API_BASE; } catch (e) {}
    return '';
  }
  function uid() {
    return leer(function () { return currentUser && currentUser.id; }, '') || '';
  }
  function rolActual() {
    return String(leer(function () { return currentUser && currentUser.rol; }, '') || '').toUpperCase();
  }
  function haySesion() { return !!leer(function () { return currentUser; }, null); }

  function pedirGet(accion, params) {
    var u = base();
    if (!u) return Promise.reject(new Error('Sin conexión configurada.'));
    var p = params || {}; p.action = accion;
    return fetch(u + '?' + new URLSearchParams(p).toString(), { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || 'Error del servidor'); return j.data; });
  }
  function pedirPost(accion, cuerpo) {
    var u = base();
    if (!u) return Promise.reject(new Error('Sin conexión configurada.'));
    return fetch(u + '?action=' + encodeURIComponent(accion), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo || {})
    }).then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || 'Error del servidor'); return j.data; });
  }
  function pedirVoz() {
    if (vozCfg) return Promise.resolve(vozCfg);
    if (pidiendoVoz) return pidiendoVoz;
    pidiendoVoz = pedirGet('vozEstado', { usuarioId: uid() })
      .then(function (r) { vozCfg = r || { configurada: false }; return vozCfg; })
      .catch(function () { vozCfg = { configurada: false, error: true }; return vozCfg; })
      .then(function (v) { pidiendoVoz = null; mostrarBotonesVoz(); return v; });
    return pidiendoVoz;
  }
  function mostrarBotonesVoz() {
    var hay = !!(vozCfg && vozCfg.configurada);
    var bs = document.querySelectorAll('.iq-voz');
    for (var k = 0; k < bs.length; k++) bs[k].style.display = hay ? '' : 'none';
  }

  /* ============================================================
     REPRODUCTOR DE VOZ
     ============================================================ */
  var Repro = (function () {
    var audio = null, cola = [], i = 0, sig = null, activo = false, dueno = null;

    function el() {
      if (!audio) {
        audio = document.createElement('audio');
        audio.setAttribute('playsinline', '');
        audio.preload = 'auto';
        audio.style.display = 'none';
        document.body.appendChild(audio);
      }
      return audio;
    }
    function desbloquear() {
      var a = el();
      try {
        if (!a.dataset.libre) {
          a.src = SILENCIO;
          var p = a.play();
          if (p && p.then) p.then(function () { a.dataset.libre = '1'; }).catch(function () {});
          else a.dataset.libre = '1';
        }
      } catch (e) {}
    }
    /* Sin lookbehind a propósito: Safari viejo lanza SyntaxError al cargar
       el archivo y eso tumbaría la capa entera, no solo la voz. */
    function frasear(t) {
      var out = [], act = '';
      for (var k = 0; k < t.length; k++) {
        var c = t.charAt(k);
        act += c;
        if ('.!?\u2026:;\n'.indexOf(c) >= 0) {
          while (k + 1 < t.length && /[\s"\u201d\u00bb)]/.test(t.charAt(k + 1))) { act += t.charAt(++k); }
          out.push(act); act = '';
        }
      }
      if (act.trim()) out.push(act);
      return out.length ? out : [t];
    }
    function trocear(t2) {
      var t = String(t2 || '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/^\s*#{1,6}\s*/gm, '')
        .replace(/^\s*[-*•]\s+/gm, '')
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2190-\u2BFF\uFE0F]/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
      if (!t) return [];
      var frases = frasear(t), out = [], act = '';
      for (var k = 0; k < frases.length; k++) {
        var f = frases[k].trim();
        if (!f) continue;
        while (f.length > 900) { out.push(f.slice(0, 900)); f = f.slice(900); }
        if ((act + ' ' + f).trim().length > 420 && act) { out.push(act.trim()); act = f; }
        else { act = (act ? act + ' ' : '') + f; }
      }
      if (act.trim()) out.push(act.trim());
      return out;
    }
    function pedir(t) {
      return pedirPost('vozHablar', { usuarioId: uid(), texto: t }).then(function (r) {
        if (!r || r.ok === false) throw new Error((r && r.msg) || 'No se pudo generar la voz.');
        return 'data:' + (r.mime || 'audio/mpeg') + ';base64,' + r.base64;
      });
    }
    function siguiente() {
      if (!activo) return;
      if (i >= cola.length) return parar();
      var p = sig || pedir(cola[i]);
      sig = null;
      p.then(function (src) {
        if (!activo) return;
        var a = el();
        a.src = src;
        var pl = a.play();
        if (pl && pl.catch) pl.catch(function () { parar(); });
        if (i + 1 < cola.length) sig = pedir(cola[i + 1]).catch(function () { return null; });
        i++;
      }).catch(function (err) {
        parar();
        avisar((err && err.message) || 'No se pudo generar la voz.');
      });
    }
    function hablar(t, quien) {
      parar();
      cola = trocear(t);
      if (!cola.length) return;
      i = 0; sig = null; activo = true; dueno = quien || null;
      var a = el();
      a.onended = function () { if (activo) siguiente(); };
      a.onerror = function () { parar(); };
      siguiente();
      repintar();
    }
    function parar() {
      activo = false; cola = []; i = 0; sig = null;
      try { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } } catch (e) {}
      dueno = null;
      repintar();
    }
    function repintar() {
      var bs = document.querySelectorAll('.iq-voz');
      for (var k = 0; k < bs.length; k++) {
        var on = activo && bs[k] === dueno;
        bs[k].classList.toggle('on', on);
        bs[k].innerHTML = on ? (STOP + ' Detener') : (BOCINA + ' Escuchar');
        bs[k].setAttribute('aria-label', on ? 'Detener la lectura' : 'Escuchar la respuesta');
      }
    }
    return {
      desbloquear: desbloquear, hablar: hablar, parar: parar, trocear: trocear,
      suena: function () { return activo; }, dueno: function () { return dueno; }
    };
  })();

  /* ============================================================
     DATOS DE PANTALLA
     ------------------------------------------------------------
     Se llaman las MISMAS funciones que usa cada vista para pintar,
     así los filtros y el buscador se respetan sin duplicar lógica.
     ============================================================ */

  /* COMERCIAL — tras los 3 filtros (asesor · programa · estado) y el
     buscador, exactamente como renderCards_. */
  function comercial() {
    var lista = leer(function () { return baseEstado_(); }, null);
    if (!lista) lista = leer(function () { return COM.registros; }, []) || [];
    var t = leer(function () { return COM.filtroTexto; }, '') || '';
    t = String(t).trim();
    if (!t) return lista.slice();
    var q = leer(function () { return normBusq_(t); }, llano(t));
    return lista.filter(function (r) {
      var n = leer(function () { return normBusq_(r.nombres + ' ' + r.apellidos); }, llano(r.nombres + ' ' + r.apellidos));
      return n.indexOf(q) >= 0 ||
        String(r.whatsapp || '').indexOf(q) >= 0 ||
        llano(r.correo).indexOf(q) >= 0;
    });
  }
  function comFiltrosPuestos() {
    var f = [];
    var a = leer(function () { return COM.filtroAsesor; }, '__ALL__');
    var p = leer(function () { return COM.filtroPrograma; }, '__ALL__');
    var e = leer(function () { return COM.filtroEstado; }, '__ALL__');
    var t = txt(leer(function () { return COM.filtroTexto; }, ''));
    if (a && a !== '__ALL__') f.push('asesor ' + a);
    if (p && p !== '__ALL__') f.push('programa ' + p);
    if (e && e !== '__ALL__') f.push('estado ' + e);
    if (t) f.push('búsqueda "' + t + '"');
    return f;
  }

  /* CONTADOR — tras asesor · etapa · plan y el buscador, como
     renderContaCards_. */
  function contador() {
    var lista = leer(function () { return contaBasePlan_(); }, null);
    if (!lista) lista = leer(function () { return CONTA.registros; }, []) || [];
    var t = txt(leer(function () { return CONTA.filtroTexto; }, ''));
    if (!t) return lista.slice();
    var q = leer(function () { return contaNormBusq_(t); }, llano(t));
    return lista.filter(function (r) {
      var n = leer(function () { return contaNormBusq_(r.nombres + ' ' + r.apellidos); }, llano(r.nombres + ' ' + r.apellidos));
      return n.indexOf(q) >= 0 ||
        String(r.documento || '').indexOf(q) >= 0 ||
        String(r.whatsapp || '').indexOf(q) >= 0 ||
        String(r.n).indexOf(q) >= 0 ||
        llano(r.correo).indexOf(q) >= 0;
    });
  }
  function contaFiltrosPuestos() {
    var f = [];
    var a = leer(function () { return CONTA.filtroAsesor; }, '__ALL__');
    var e = leer(function () { return CONTA.filtroEtapa; }, '__ALL__');
    var p = leer(function () { return CONTA.filtroPlan; }, '__ALL__');
    var t = txt(leer(function () { return CONTA.filtroTexto; }, ''));
    if (a && a !== '__ALL__') f.push('asesor ' + a);
    if (e && e !== '__ALL__') f.push('etapa ' + e);
    if (p && p !== '__ALL__') f.push('plan ' + p);
    if (t) f.push('búsqueda "' + t + '"');
    return f;
  }

  /* DASHBOARD — el tablero ya viene agregado del servidor. */
  function tablero() { return leer(function () { return DASH.data; }, null); }
  function dashRango() {
    var r = leer(function () { return DASH.rango; }, 'mes_actual');
    var m = {
      hoy: 'hoy', semana: 'esta semana', mes_actual: 'este mes',
      mes_pasado: 'el mes pasado', anio: 'este año', historico: 'todo el histórico'
    };
    return m[r] || String(r || '').replace(/_/g, ' ');
  }

  function pie(filtros, cuantos, que) {
    var l = '\n\n_Sobre ' + num(cuantos) + ' ' + que + ' en pantalla';
    l += filtros.length ? ' con ' + filtros.join(', ') + '.' : ' (sin filtros).';
    l += ' Mueve o quita los filtros y vuelve a preguntar._';
    return l;
  }

  /* ============================================================
     CATÁLOGO DE CONSULTAS
     El primero de cada lista es la portada.
     ============================================================ */
  var PANELES = {
    'view-comercial': {
      titulo: 'Consultas de Comercial', sub: 'Leads en pantalla',
      botones: [
        { id: 'resumen',    et: 'Lo que estoy viendo',   ic: '👀' },
        { id: 'estado',     et: 'Por estado',            ic: '🏷️' },
        { id: 'embudo',     et: 'Embudo de conversión',  ic: '🫗' },
        { id: 'asesor',     et: 'Por asesor',            ic: '👤' },
        { id: 'programa',   et: 'Por programa',          ic: '🎓' },
        { id: 'fuente',     et: 'De dónde llegan',       ic: '📣' },
        { id: 'ciudad',     et: 'Por ciudad',            ic: '📍' },
        { id: 'frios',      et: 'Leads fríos',           ic: '🥶' },
        { id: 'agenda',     et: 'Asesorías agendadas',   ic: '📅' },
        { id: 'mes',        et: 'Entradas por mes',      ic: '📈' },
        { id: 'semana',     et: 'Día de la semana',      ic: '📆' },
        { id: 'nuevos',     et: 'De hoy y de la semana', ic: '🗓️' },
        { id: 'contacto',   et: 'Datos incompletos',     ic: '📇' },
        { id: 'referidos',  et: 'Referidos',             ic: '🤝' },
        { id: 'promo',      et: 'Promos aplicadas',      ic: '🏷' },
        { id: 'sinasesor',  et: 'Sin asesor',            ic: '🆓' }
      ]
    },
    'view-dashboard': {
      titulo: 'Consultas del tablero', sub: 'Indicadores del negocio',
      botones: [
        { id: 'resumen',    et: 'Lo que estoy viendo',  ic: '👀' },
        { id: 'meta',       et: 'Meta del mes',         ic: '🎯' },
        { id: 'equipo',     et: 'Rendimiento del equipo', ic: '👥' },
        { id: 'mejor',      et: 'Quién va adelante',    ic: '🏆' },
        { id: 'ventas',     et: 'Ventas por programa',  ic: '💰' },
        { id: 'programas',  et: 'Inscripciones por programa', ic: '🎓' },
        { id: 'fuente',     et: 'De dónde llegan',      ic: '📣' },
        { id: 'estados',    et: 'Estado de los leads',  ic: '🏷️' },
        { id: 'alertas',    et: 'Alertas del día',      ic: '🚨' },
        { id: 'meses',      et: 'Mes a mes',            ic: '📈' },
        { id: 'tendencia',  et: 'Tendencia',            ic: '🔮' },
        { id: 'conversion', et: 'Conversión',           ic: '⚡' }
      ]
    },
    'view-contador': {
      titulo: 'Consultas del Contador', sub: 'Inscritos en pantalla',
      botones: [
        { id: 'resumen',    et: 'Lo que estoy viendo',   ic: '👀' },
        { id: 'etapa',      et: 'Por etapa del proceso', ic: '🚦' },
        { id: 'cartera',    et: 'Plata recaudada',       ic: '💰' },
        { id: 'vencidos',   et: 'Vencidos y por vencer', ic: '⏰' },
        { id: 'contratos',  et: 'Contratos por validar', ic: '📄' },
        { id: 'papeles',    et: 'Papeles que faltan',    ic: '📎' },
        { id: 'plan',       et: 'Por plan y sponsor',    ic: '🧾' },
        { id: 'addson',     et: 'Adds-on vendidos',      ic: '➕' },
        { id: 'metodo',     et: 'Métodos de pago',       ic: '💳' },
        { id: 'oferta',     et: 'Pago de oferta',        ic: '💵' },
        { id: 'total',      et: 'Pago total y SEVIS',    ic: '🏦' },
        { id: 'asesor',     et: 'Por asesor',            ic: '👤' },
        { id: 'mes',        et: 'Inscripciones por mes', ic: '📈' },
        { id: 'edad',       et: 'Edades',                ic: '🎂' },
        { id: 'claves',     et: 'Acceso al portal',      ic: '🔑' },
        { id: 'siguiente',  et: 'Qué hago ahora',        ic: '✅' }
      ]
    }
  };

  /* ============================================================
     INFORMES — COMERCIAL
     ============================================================ */
  function infComercial(id) {
    var L = comercial();
    var F = comFiltrosPuestos();
    var T = L.length;
    var cola = pie(F, T, plural(T, 'lead', 'leads'));
    if (!T) return vacio('Comercial');

    var INSCRITO = function (r) { return r.estado === 'INSCRITO'; };
    var CERRADOS = ['INSCRITO', 'NO_INTERESADO', 'PERFIL_NO_APTO', 'APLAZADO'];

    if (id === 'resumen') {
      var ins = L.filter(INSCRITO).length;
      var age = L.filter(function (r) { return txt(r.fechaHoraAgendadaRaw); }).length;
      var asesores = contar(L, function (r) { return etiq(r.asesor); });
      var progs = contar(L, function (r) { return etiq(r.programa); });
      var estados = contar(L, function (r) { return etiq(r.estadoLabel); });
      var sinAse = L.filter(function (r) { return !txt(r.asesor); }).length;
      return {
        titulo: '👀 Lo que estoy viendo · Comercial',
        texto: 'Tienes ' + b(T) + ' ' + plural(T, 'lead', 'leads') + ' en pantalla.\n\n' +
          '- Inscritos: ' + b(ins) + ' (' + pct(ins, T) + ' % de conversión)\n' +
          '- Con asesoría agendada: ' + b(age) + '\n' +
          '- Sin asesor asignado: ' + b(sinAse) + '\n' +
          '- Asesores distintos: ' + b(asesores.length) + ' · programas: ' + b(progs.length) + '\n\n' +
          'El estado que más pesa es **' + estados[0].k + '** con ' + b(estados[0].n) + ' (' + pct(estados[0].n, T) + ' %).' +
          (progs.length ? '\nEl programa más pedido es **' + progs[0].k + '** con ' + b(progs[0].n) + '.' : '') + cola,
        voz: 'Tienes ' + T + ' leads en pantalla. ' + ins + ' inscritos, o sea ' + pct(ins, T) +
             ' por ciento de conversión. ' + age + ' con asesoría agendada y ' + sinAse + ' sin asesor.'
      };
    }

    if (id === 'estado') {
      var c = contar(L, function (r) { return etiq(r.estadoLabel); });
      return {
        titulo: '🏷️ Por estado',
        texto: 'Así se reparten los ' + b(T) + ' leads:\n\n' + ranking(c, T, 14) + cola,
        voz: 'Por estado: ' + c.slice(0, 5).map(function (x) { return x.k + ', ' + x.n; }).join('; ') + '.'
      };
    }

    if (id === 'embudo') {
      /* El embudo mide CUÁN LEJOS LLEGÓ cada lead, no en qué estado está
         hoy: un lead con asesoría hecha que hoy figura como SIN_RESPUESTA
         igual pasó por la asesoría. Los pasos se arman de abajo arriba y
         cada uno incluye al siguiente, así que por construcción nunca
         puede haber un paso mayor que el de arriba (antes sí pasaba:
         "agendados" salía por encima de "perfil apto"). */
      var llego = {};
      var marcar = function (r, desde) { llego[r.id] = Math.max(llego[r.id] || 0, desde); };
      L.forEach(function (r) {
        var e = r.estado;
        if (e === 'INSCRITO') return marcar(r, 5);
        if (e === 'PENDIENTE_PAGO') return marcar(r, 4);
        if (e === 'ASESORIA_REALIZADA' || txt(r.fechaAsesoria)) return marcar(r, 3);
        if (e === 'ASESORIA_AGENDADA' || txt(r.fechaHoraAgendadaRaw)) return marcar(r, 3);
        if (e === 'PERFIL_APTO') return marcar(r, 2);
        if (e === 'NUEVO_LEAD') return marcar(r, 0);
        marcar(r, 1);            /* calificación, seguimientos y cerrados */
      });
      /* Un cerrado que llegó lejos conserva su marca; el resto se queda
         donde su estado indique. */
      L.forEach(function (r) {
        if (txt(r.fechaHoraAgendadaRaw) || txt(r.fechaAsesoria)) marcar(r, 3);
        if (r.estado === 'INSCRITO') marcar(r, 5);
      });
      var cuantos = function (min) {
        var n = 0;
        L.forEach(function (r) { if ((llego[r.id] || 0) >= min) n++; });
        return n;
      };
      var pasos = [
        { et: 'Entraron', n: T },
        { et: 'Contactados', n: cuantos(1) },
        { et: 'Perfil apto', n: cuantos(2) },
        { et: 'Llegaron a la asesoría', n: cuantos(3) },
        { et: 'Pendientes de pago', n: cuantos(4) },
        { et: 'Inscritos', n: cuantos(5) }
      ];
      var lin = pasos.map(function (p, i) {
        var antes = i ? pasos[i - 1].n : 0;
        return '- ' + p.et + ': ' + b(p.n) + (i ? ' (' + pct(p.n, antes) + ' % del paso anterior)' : '');
      }).join('\n');
      /* El escalón donde más gente se queda por el camino. */
      var peor = 0, caida = -1;
      for (var q = 1; q < pasos.length; q++) {
        var pierde = pasos[q - 1].n - pasos[q].n;
        if (pierde > caida) { caida = pierde; peor = q; }
      }
      return {
        titulo: '🫗 Embudo de conversión',
        texto: 'Hasta dónde llegó cada lead:\n\n' + lin + '\n\nDe punta a punta conviertes ' + bp(pasos[5].n, T) + '.' +
          (caida > 0 ? '\n\nDonde más gente se queda es al pasar de **' + pasos[peor - 1].et.toLowerCase() +
            '** a **' + pasos[peor].et.toLowerCase() + '**: se pierden ' + b(caida) + '.' : '') +
          '\n\n_Cuenta lo más lejos que llegó cada lead, no su estado de hoy._' + cola,
        voz: 'Embudo: ' + pasos.map(function (p) { return p.et + ', ' + p.n; }).join('; ') + '. Conversión total, ' + pct(pasos[5].n, T) + ' por ciento.'
      };
    }

    if (id === 'asesor') {
      var m = {};
      L.forEach(function (r) {
        var k = txt(r.asesor) || 'Sin asesor';
        if (!m[k]) m[k] = { k: k, n: 0, ins: 0, age: 0 };
        m[k].n++;
        if (INSCRITO(r)) m[k].ins++;
        if (txt(r.fechaHoraAgendadaRaw)) m[k].age++;
      });
      var arr = Object.keys(m).map(function (k) { return m[k]; })
        .sort(function (a, b2) { return b2.ins - a.ins || b2.n - a.n; });
      var lin = arr.map(function (x) {
        return '- ' + x.k + ': ' + b(x.n) + ' ' + plural(x.n, 'lead', 'leads') + ', ' + b(x.ins) + ' ' +
               plural(x.ins, 'inscrito', 'inscritos') + ' (' + pct(x.ins, x.n) + ' %), ' + b(x.age) + ' con agenda';
      }).join('\n');
      var top = arr[0];
      return {
        titulo: '👤 Por asesor',
        texto: lin + (arr.length > 1 && top ? '\n\nVa adelante **' + top.k + '** con ' + b(top.ins) + ' ' + plural(top.ins, 'inscrito', 'inscritos') + '.' : '') + cola,
        /* A la voz NO va ningún nombre propio (ver el aviso de arriba): solo
           cifras. Los nombres se quedan en la pantalla. */
        voz: 'Hay ' + arr.length + ' asesores con leads en pantalla. El que más inscritos tiene lleva ' +
             (top ? top.ins : 0) + ' de ' + (top ? top.n : 0) + ' leads.'
      };
    }

    if (id === 'programa') {
      var m2 = {};
      L.forEach(function (r) {
        var k = txt(r.programa) || 'Sin programa';
        if (!m2[k]) m2[k] = { k: k, n: 0, ins: 0 };
        m2[k].n++; if (INSCRITO(r)) m2[k].ins++;
      });
      var arr2 = Object.keys(m2).map(function (k) { return m2[k]; }).sort(function (a, b2) { return b2.n - a.n; });
      var lin2 = arr2.map(function (x) {
        return '- ' + x.k + ': ' + b(x.n) + ' ' + plural(x.n, 'lead', 'leads') + ' · ' + b(x.ins) + ' ' +
               plural(x.ins, 'inscrito', 'inscritos') + ' (' + pct(x.ins, x.n) + ' %)';
      }).join('\n');
      var mejor = arr2.slice().filter(function (x) { return x.n >= 5; })
        .sort(function (a, b2) { return pct(b2.ins, b2.n) - pct(a.ins, a.n); })[0];
      return {
        titulo: '🎓 Por programa',
        texto: lin2 + (mejor ? '\n\nEl que mejor convierte (con al menos 5 leads) es **' + mejor.k + '**, con ' + bp(mejor.ins, mejor.n) + '.' : '') + cola,
        voz: 'Por programa: ' + arr2.slice(0, 5).map(function (x) { return x.k + ', ' + x.n; }).join('; ') + '.'
      };
    }

    if (id === 'fuente') {
      var m3 = {};
      L.forEach(function (r) {
        var k = txt(r.fuente) || 'Sin fuente';
        if (!m3[k]) m3[k] = { k: k, n: 0, ins: 0 };
        m3[k].n++; if (INSCRITO(r)) m3[k].ins++;
      });
      var arr3 = Object.keys(m3).map(function (k) { return m3[k]; }).sort(function (a, b2) { return b2.n - a.n; });
      var lin3 = arr3.map(function (x) {
        return '- ' + x.k + ': ' + b(x.n) + ' (' + pct(x.n, T) + ' %) · ' + b(x.ins) + ' ' + plural(x.ins, 'inscrito', 'inscritos');
      }).join('\n');
      var rent = arr3.filter(function (x) { return x.n >= 5; })
        .sort(function (a, b2) { return pct(b2.ins, b2.n) - pct(a.ins, a.n); })[0];
      return {
        titulo: '📣 De dónde llegan',
        texto: lin3 + (rent ? '\n\nLa fuente que mejor convierte (con al menos 5 leads) es **' + rent.k + '**: ' + bp(rent.ins, rent.n) + '.' : '') + cola,
        voz: 'Las fuentes principales son ' + arr3.slice(0, 4).map(function (x) { return x.k + ' con ' + x.n; }).join(', ') + '.'
      };
    }

    if (id === 'ciudad') {
      var ciudades = contar(L, function (r) { return txt(r.municipio) || 'Sin ciudad'; });
      var deptos = contar(L, function (r) { return txt(r.departamento) || 'Sin departamento'; });
      return {
        titulo: '📍 Por ciudad',
        texto: 'Departamentos:\n' + ranking(deptos, T, 6) +
          '\n\nCiudades:\n' + ranking(ciudades, T, 10) + cola,
        voz: 'Las ciudades que más aportan son ' + ciudades.slice(0, 4).map(function (x) { return x.k + ' con ' + x.n; }).join(', ') + '.'
      };
    }

    if (id === 'frios') {
      var abiertos = L.filter(function (r) { return CERRADOS.indexOf(r.estado) < 0; });
      var conFecha = abiertos.map(function (r) {
        var f = fecha(r.fechaActualizacion) || fecha(r.fechaIngreso);
        return { r: r, d: dias(f) };
      }).filter(function (x) { return x.d !== null; });
      if (!conFecha.length) {
        return {
          titulo: '🥶 Leads fríos',
          texto: 'No hay fechas de contacto en los leads de pantalla, así que no puedo medir cuánto llevan sin moverse.' + cola,
          voz: 'No hay fechas de contacto para medir los leads fríos.'
        };
      }
      var m7 = conFecha.filter(function (x) { return x.d > 7; });
      var m15 = conFecha.filter(function (x) { return x.d > 15; });
      var m30 = conFecha.filter(function (x) { return x.d > 30; });
      var peores = conFecha.slice().sort(function (a, b2) { return b2.d - a.d; }).slice(0, 8);
      return {
        titulo: '🥶 Leads fríos',
        texto: 'De ' + b(abiertos.length) + ' leads todavía abiertos:\n\n' +
          '- Más de 7 días sin movimiento: ' + b(m7.length) + '\n' +
          '- Más de 15 días: ' + b(m15.length) + '\n' +
          '- Más de 30 días: ' + b(m30.length) + '\n\n' +
          'Los más olvidados:\n' + peores.map(function (x) {
            return '- ' + txt(x.r.nombres + ' ' + x.r.apellidos) + ' · ' + x.d + ' días · ' + etiq(x.r.estadoLabel);
          }).join('\n') + cola,
        voz: 'De ' + abiertos.length + ' leads abiertos, ' + m7.length + ' llevan más de 7 días sin movimiento, ' +
             m15.length + ' más de 15 y ' + m30.length + ' más de 30.',
        lista: peores.map(function (x) { return { nombre: txt(x.r.nombres + ' ' + x.r.apellidos), contacto: x.r.whatsapp }; })
      };
    }

    if (id === 'agenda') {
      var age2 = L.filter(function (r) { return txt(r.fechaHoraAgendadaRaw); });
      if (!age2.length) {
        return { titulo: '📅 Asesorías agendadas', texto: 'Ninguno de los leads en pantalla tiene asesoría agendada.' + cola, voz: 'No hay asesorías agendadas en pantalla.' };
      }
      var ahora = new Date();
      var fut = [], pas = [];
      age2.forEach(function (r) {
        var d = new Date(String(r.fechaHoraAgendadaRaw).replace(' ', 'T'));
        if (isNaN(d.getTime())) return;
        (d >= ahora ? fut : pas).push({ r: r, d: d });
      });
      fut.sort(function (a, b2) { return a.d - b2.d; });
      var conMeet = age2.filter(function (r) { return txt(r.meetLink); }).length;
      var insAge = age2.filter(INSCRITO).length;
      return {
        titulo: '📅 Asesorías agendadas',
        texto: b(age2.length) + ' ' + plural(age2.length, 'lead tiene', 'leads tienen') + ' asesoría agendada (' + pct(age2.length, T) + ' % de lo que ves).\n\n' +
          '- Por venir: ' + b(fut.length) + '\n' +
          '- Ya pasaron: ' + b(pas.length) + '\n' +
          '- Con enlace de Meet: ' + b(conMeet) + '\n' +
          '- Que terminaron inscribiéndose: ' + b(insAge) + ' (' + pct(insAge, age2.length) + ' %)\n' +
          (fut.length ? '\nLas próximas:\n' + fut.slice(0, 6).map(function (x) {
            return '- ' + txt(x.r.nombres + ' ' + x.r.apellidos) + ' · ' + fechaCorta(x.d) + ' a las ' +
                   ('0' + x.d.getHours()).slice(-2) + ':' + ('0' + x.d.getMinutes()).slice(-2);
          }).join('\n') : '') + cola,
        voz: age2.length + ' leads con asesoría agendada. ' + fut.length + ' por venir y ' + pas.length +
             ' ya pasadas. De las agendadas se inscribió el ' + pct(insAge, age2.length) + ' por ciento.'
      };
    }

    if (id === 'mes') {
      var conF = L.map(function (r) { return fecha(r.fechaIngreso); }).filter(Boolean);
      if (!conF.length) {
        return { titulo: '📈 Entradas por mes', texto: 'Los leads de pantalla no traen fecha de ingreso.' + cola, voz: 'No hay fechas de ingreso.' };
      }
      var m4 = {};
      conF.forEach(function (d) { var k = claveMes(d); m4[k] = (m4[k] || 0) + 1; });
      var claves = Object.keys(m4).sort();
      var lin4 = claves.slice(-12).map(function (k) {
        var p = k.split('-');
        return '- ' + MESES[+p[1] - 1] + ' ' + p[0] + ': ' + b(m4[k]);
      }).join('\n');
      var mejorMes = claves.slice().sort(function (a, b2) { return m4[b2] - m4[a]; })[0];
      var pm = mejorMes.split('-');
      return {
        titulo: '📈 Entradas por mes',
        texto: lin4 + '\n\nEl mes más movido fue **' + MESES[+pm[1] - 1] + ' ' + pm[0] + '** con ' + b(m4[mejorMes]) + '.' +
          '\nPromedio: ' + b(Math.round(conF.length / claves.length)) + ' leads al mes.' + cola,
        voz: 'El mes más movido fue ' + MESES[+pm[1] - 1] + ' de ' + pm[0] + ' con ' + m4[mejorMes] +
             ' leads. El promedio es de ' + Math.round(conF.length / claves.length) + ' al mes.'
      };
    }

    if (id === 'semana') {
      var conF2 = L.map(function (r) { return fecha(r.fechaIngreso); }).filter(Boolean);
      if (!conF2.length) {
        return { titulo: '📆 Día de la semana', texto: 'Los leads de pantalla no traen fecha de ingreso.' + cola, voz: 'No hay fechas de ingreso.' };
      }
      var d7 = [0, 0, 0, 0, 0, 0, 0];
      conF2.forEach(function (d) { d7[d.getDay()]++; });
      var pares = d7.map(function (n, i) { return { k: DIASEM[i], n: n }; })
        .sort(function (a, b2) { return b2.n - a.n; });
      return {
        titulo: '📆 Día de la semana',
        texto: 'Cuándo entran los leads:\n\n' + [1, 2, 3, 4, 5, 6, 0].map(function (i) {
          return '- ' + DIASEM[i] + ': ' + b(d7[i]) + ' (' + pct(d7[i], conF2.length) + ' %)';
        }).join('\n') + '\n\nEl día fuerte es el **' + pares[0].k + '**.' + cola,
        voz: 'El día que más entran leads es el ' + pares[0].k + ', con ' + pares[0].n + '.'
      };
    }

    if (id === 'nuevos') {
      var h = hoy0(), sem = new Date(h); sem.setDate(sem.getDate() - 6);
      var mes0 = new Date(h.getFullYear(), h.getMonth(), 1);
      var deHoy = 0, deSem = 0, deMes = 0, conFecha3 = 0;
      L.forEach(function (r) {
        var d = fecha(r.fechaIngreso); if (!d) return;
        conFecha3++;
        if (d >= h) deHoy++;
        if (d >= sem) deSem++;
        if (d >= mes0) deMes++;
      });
      if (!conFecha3) {
        return { titulo: '🗓️ De hoy y de la semana', texto: 'Los leads de pantalla no traen fecha de ingreso.' + cola, voz: 'No hay fechas de ingreso.' };
      }
      return {
        titulo: '🗓️ De hoy y de la semana',
        texto: '- Entraron hoy: ' + b(deHoy) + '\n' +
          '- En los últimos 7 días: ' + b(deSem) + '\n' +
          '- En lo que va de ' + MESES[h.getMonth()] + ': ' + b(deMes) + '\n\n' +
          'Ritmo de la semana: ' + b(Math.round(deSem / 7 * 10) / 10) + ' leads por día.' + cola,
        voz: 'Hoy entraron ' + deHoy + ' leads, ' + deSem + ' en los últimos siete días y ' + deMes + ' en lo que va del mes.'
      };
    }

    if (id === 'contacto') {
      var sinWa = L.filter(function (r) { return !txt(r.whatsapp); }).length;
      var sinCorreo = L.filter(function (r) { return !txt(r.correo); }).length;
      var sinCiudad = L.filter(function (r) { return !txt(r.municipio); }).length;
      var sinPrograma = L.filter(function (r) { return !txt(r.programa); }).length;
      var sinFuente = L.filter(function (r) { return !txt(r.fuente); }).length;
      var completos = L.filter(function (r) { return txt(r.whatsapp) && txt(r.correo) && txt(r.municipio) && txt(r.programa); }).length;
      return {
        titulo: '📇 Datos incompletos',
        texto: 'De ' + b(T) + ' leads, ' + b(completos) + ' (' + pct(completos, T) + ' %) tienen la ficha completa.\n\nLo que falta:\n' +
          '- Sin WhatsApp: ' + b(sinWa) + '\n' +
          '- Sin correo: ' + b(sinCorreo) + '\n' +
          '- Sin ciudad: ' + b(sinCiudad) + '\n' +
          '- Sin programa: ' + b(sinPrograma) + '\n' +
          '- Sin fuente: ' + b(sinFuente) +
          (sinCorreo ? '\n\n_Sin correo no se les puede mandar el contrato ni la clave del portal._' : '') + cola,
        voz: 'De ' + T + ' leads, ' + completos + ' tienen la ficha completa. Faltan ' + sinWa +
             ' WhatsApp, ' + sinCorreo + ' correos y ' + sinPrograma + ' programas.'
      };
    }

    if (id === 'referidos') {
      var conRef = L.filter(function (r) { return txt(r.referido); });
      if (!conRef.length) {
        return { titulo: '🤝 Referidos', texto: 'Ninguno de los leads en pantalla llegó por referido.' + cola, voz: 'No hay referidos en pantalla.' };
      }
      var quien = contar(conRef, function (r) { return txt(r.referido); });
      var insRef = conRef.filter(INSCRITO).length;
      var insResto = L.filter(function (r) { return !txt(r.referido) && INSCRITO(r); }).length;
      return {
        titulo: '🤝 Referidos',
        texto: b(conRef.length) + ' ' + plural(conRef.length, 'lead llegó', 'leads llegaron') + ' por referido (' + pct(conRef.length, T) + ' % del total).\n\n' +
          'Quién refiere más:\n' + ranking(quien, conRef.length, 8) + '\n\n' +
          'Convierten al ' + bp(insRef, conRef.length) + ', frente al ' + bp(insResto, T - conRef.length) + ' del resto.' + cola,
        voz: conRef.length + ' leads por referido, que convierten al ' + pct(insRef, conRef.length) +
             ' por ciento frente al ' + pct(insResto, T - conRef.length) + ' del resto.'
      };
    }

    if (id === 'promo') {
      var conP = L.filter(function (r) { return txt(r.promo); });
      if (!conP.length) {
        return { titulo: '🏷 Promos aplicadas', texto: 'Ningún lead en pantalla tiene promo aplicada.' + cola, voz: 'No hay promos aplicadas.' };
      }
      var pr = contar(conP, function (r) { return txt(r.promo); });
      var insP = conP.filter(INSCRITO).length;
      return {
        titulo: '🏷 Promos aplicadas',
        texto: b(conP.length) + ' de ' + b(T) + ' leads llevan promo (' + pct(conP.length, T) + ' %).\n\n' +
          ranking(pr, conP.length, 8) + '\n\nDe los que llevan promo se inscribió el ' + bp(insP, conP.length) + '.' + cola,
        voz: conP.length + ' leads con promo, de los que se inscribió el ' + pct(insP, conP.length) + ' por ciento.'
      };
    }

    if (id === 'sinasesor') {
      var sin = L.filter(function (r) { return !txt(r.asesor); });
      if (!sin.length) {
        return { titulo: '🆓 Sin asesor', texto: '¡Todos los leads en pantalla tienen asesor asignado! 🎉' + cola, voz: 'Todos los leads tienen asesor asignado.' };
      }
      var porEstado = contar(sin, function (r) { return etiq(r.estadoLabel); });
      var viejos = sin.map(function (r) { return { r: r, d: dias(fecha(r.fechaIngreso)) }; })
        .filter(function (x) { return x.d !== null; })
        .sort(function (a, b2) { return b2.d - a.d; }).slice(0, 8);
      return {
        titulo: '🆓 Sin asesor',
        texto: b(sin.length) + ' ' + plural(sin.length, 'lead está', 'leads están') + ' en el pozo común, sin asesor (' + pct(sin.length, T) + ' % de lo que ves).\n\n' +
          'En qué estado están:\n' + ranking(porEstado, sin.length, 8) +
          (viejos.length ? '\n\nLos que llevan más esperando:\n' + viejos.map(function (x) {
            return '- ' + txt(x.r.nombres + ' ' + x.r.apellidos) + ' · ' + x.d + ' días';
          }).join('\n') : '') + cola,
        voz: sin.length + ' leads sin asesor asignado, el ' + pct(sin.length, T) + ' por ciento de lo que ves.',
        lista: viejos.map(function (x) { return { nombre: txt(x.r.nombres + ' ' + x.r.apellidos), contacto: x.r.whatsapp }; })
      };
    }

    return vacio('Comercial');
  }

  /* ============================================================
     INFORMES — DASHBOARD
     ============================================================ */
  function infDashboard(id) {
    var d = tablero();
    if (!d) {
      return {
        titulo: 'Tablero',
        texto: 'El tablero todavía no ha terminado de cargar. Espera a que se pinten los indicadores y vuelve a preguntar.',
        voz: 'El tablero aún no ha cargado.'
      };
    }
    var k = d.kpis || {};
    var asesorF = txt(d.asesor);
    var marco = '\n\n_Datos del tablero para ' + dashRango() + (asesorF ? ', filtrando por ' + asesorF : ', con todo el equipo') + '. Cambia el rango o el asesor arriba y vuelve a preguntar._';

    if (id === 'resumen') {
      return {
        titulo: '👀 Lo que estoy viendo · Tablero',
        texto: 'Indicadores de ' + dashRango() + (asesorF ? ' para ' + asesorF : '') + ':\n\n' +
          '- Leads totales: ' + b(k.leadsTotales) + '\n' +
          '- Asesorías agendadas: ' + b(k.asesoriasAgendadas) + ' · realizadas: ' + b(k.asesoriasRealizadas) + '\n' +
          '- Inscripciones: ' + b(k.inscripciones) + '\n' +
          '- Conversión: **' + (k.conversion || 0) + ' %**\n' +
          '- Ventas: **' + pesos(k.ventasTotales) + '**\n\n' +
          'Meta del mes: ' + b((d.meta || {}).inscripciones) + ' de ' + b((d.meta || {}).objetivo) +
          ' (**' + ((d.meta || {}).cumplimiento || 0) + ' %**).' + marco,
        voz: 'Leads totales ' + (k.leadsTotales || 0) + ', inscripciones ' + (k.inscripciones || 0) +
             ', conversión ' + (k.conversion || 0) + ' por ciento y ventas por ' + pesos(k.ventasTotales) + '.'
      };
    }

    if (id === 'meta') {
      var m = d.meta || { objetivo: 0, inscripciones: 0, cumplimiento: 0 };
      var faltan = Math.max(0, m.objetivo - m.inscripciones);
      var hoyD = new Date();
      var ultimo = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 0).getDate();
      var quedan = ultimo - hoyD.getDate() + 1;
      var ritmo = faltan ? Math.ceil(faltan / Math.max(1, quedan)) : 0;
      return {
        titulo: '🎯 Meta del mes',
        texto: 'Vas en ' + b(m.inscripciones) + ' inscripciones de una meta de ' + b(m.objetivo) + ': **' + m.cumplimiento + ' %**.\n\n' +
          (faltan
            ? '- Faltan: ' + b(faltan) + '\n- Días que quedan en el mes: ' + b(quedan) +
              '\n- Ritmo necesario: **' + ritmo + '** ' + plural(ritmo, 'inscripción', 'inscripciones') + ' por día'
            : '¡Meta cumplida! 🎉') +
          '\n\n_La meta se cambia en Configuración._',
        voz: faltan
          ? 'Vas en ' + m.inscripciones + ' de ' + m.objetivo + ', el ' + m.cumplimiento + ' por ciento. Faltan ' +
            faltan + ' en ' + quedan + ' días: ' + ritmo + ' por día.'
          : 'Meta cumplida: ' + m.inscripciones + ' de ' + m.objetivo + '.'
      };
    }

    if (id === 'equipo') {
      var r = d.rendimiento || [];
      if (!r.length) return { titulo: '👥 Rendimiento del equipo', texto: 'No hay actividad del equipo en este rango.' + marco, voz: 'No hay actividad del equipo en este rango.' };
      var tot = d.rendimientoTotal || { leads: 0, asesorias: 0, inscripciones: 0, conversion: 0 };
      return {
        titulo: '👥 Rendimiento del equipo',
        texto: r.map(function (x) {
          return '- ' + x.asesor + ': ' + b(x.leads) + ' ' + plural(x.leads, 'lead', 'leads') + ' · ' +
                 b(x.asesorias) + ' ' + plural(x.asesorias, 'asesoría', 'asesorías') + ' · ' +
                 b(x.inscripciones) + ' ' + plural(x.inscripciones, 'inscripción', 'inscripciones') +
                 ' (**' + x.conversion + ' %**)';
        }).join('\n') + '\n\nTotal del equipo: ' + b(tot.leads) + ' leads, ' + b(tot.inscripciones) +
          ' inscripciones, **' + tot.conversion + ' %** de conversión.' + marco,
        voz: 'El equipo suma ' + tot.leads + ' leads y ' + tot.inscripciones + ' inscripciones, con ' +
             tot.conversion + ' por ciento de conversión.'
      };
    }

    if (id === 'mejor') {
      var r2 = (d.rendimiento || []).slice();
      if (!r2.length) return { titulo: '🏆 Quién va adelante', texto: 'No hay actividad del equipo en este rango.' + marco, voz: 'No hay actividad del equipo en este rango.' };
      var porIns = r2.slice().sort(function (a, b2) { return b2.inscripciones - a.inscripciones; })[0];
      var porConv = r2.filter(function (x) { return x.leads >= 5; })
        .sort(function (a, b2) { return b2.conversion - a.conversion; })[0];
      var porLeads = r2.slice().sort(function (a, b2) { return b2.leads - a.leads; })[0];
      var flojos = r2.filter(function (x) { return x.leads >= 5 && x.inscripciones === 0; });
      return {
        titulo: '🏆 Quién va adelante',
        texto: '- Más inscripciones: **' + porIns.asesor + '** con ' + b(porIns.inscripciones) + '\n' +
          '- Más leads atendidos: **' + porLeads.asesor + '** con ' + b(porLeads.leads) + '\n' +
          (porConv ? '- Mejor conversión (con al menos 5 leads): **' + porConv.asesor + '** con **' + porConv.conversion + ' %**\n' : '') +
          (flojos.length ? '\nOjo: ' + flojos.map(function (x) { return '**' + x.asesor + '**'; }).join(', ') +
            ' ' + plural(flojos.length, 'lleva', 'llevan') + ' 5 o más leads sin cerrar ninguno.' : '') + marco,
        voz: 'El primero del equipo lleva ' + porIns.inscripciones + ' inscripciones' +
             (porConv ? ' y la mejor conversión del equipo es del ' + porConv.conversion + ' por ciento' : '') +
             (flojos.length ? '. Hay ' + flojos.length + ' con cinco o más leads sin cerrar ninguno' : '') + '.'
      };
    }

    if (id === 'ventas') {
      var v = d.ventasPorPrograma || [];
      if (!v.length) return { titulo: '💰 Ventas por programa', texto: 'No hay ventas en este rango.' + marco, voz: 'No hay ventas en este rango.' };
      var tv = d.ventasPorProgramaTotal || { inscritos: 0, ventas: 0 };
      var lider = v[0];
      return {
        titulo: '💰 Ventas por programa',
        texto: v.map(function (x) {
          return '- ' + x.programa + ': **' + pesos(x.ventas) + '** · ' + b(x.inscritos) + ' ' +
                 plural(x.inscritos, 'inscrito', 'inscritos') + ' (' + pct(x.ventas, tv.ventas) + ' % de la plata)';
        }).join('\n') + '\n\nTotal: **' + pesos(tv.ventas) + '** con ' + b(tv.inscritos) + ' inscritos.' +
          '\nTicket promedio: **' + pesos(tv.inscritos ? tv.ventas / tv.inscritos : 0) + '**.' +
          '\n\n**' + lider.programa + '** aporta ' + bp(lider.ventas, tv.ventas) + ' de la venta.' + marco,
        voz: 'Ventas por ' + pesos(tv.ventas) + ' con ' + tv.inscritos + ' inscritos. El ticket promedio es de ' +
             pesos(tv.inscritos ? tv.ventas / tv.inscritos : 0) + '.'
      };
    }

    if (id === 'programas') {
      var ip = d.inscripcionesPorPrograma || [];
      var lp = d.leadsPorPrograma || [];
      if (!ip.length && !lp.length) return { titulo: '🎓 Inscripciones por programa', texto: 'No hay datos por programa en este rango.' + marco, voz: 'No hay datos por programa.' };
      var mapaLeads = {};
      lp.forEach(function (x) { mapaLeads[x.label] = x.valor; });
      return {
        titulo: '🎓 Inscripciones por programa',
        texto: (ip.length ? ip.map(function (x) {
          var le = mapaLeads[x.label] || 0;
          return '- ' + x.label + ': ' + b(x.valor) + ' ' + plural(x.valor, 'inscripción', 'inscripciones') +
                 (le ? ' de ' + b(le) + ' leads (' + pct(x.valor, le) + ' %)' : '');
        }).join('\n') : 'Sin inscripciones en el rango.') +
          '\n\nLeads por programa:\n' + lp.map(function (x) { return '- ' + x.label + ': ' + b(x.valor) + ' (' + x.pct + ' %)'; }).join('\n') + marco,
        voz: ip.length ? ('Inscripciones por programa: ' + ip.slice(0, 4).map(function (x) { return x.label + ', ' + x.valor; }).join('; ') + '.')
                       : 'No hubo inscripciones en el rango.'
      };
    }

    if (id === 'fuente') {
      var lf = d.leadsPorFuente || [];
      if (!lf.length) return { titulo: '📣 De dónde llegan', texto: 'No hay datos de fuente en este rango.' + marco, voz: 'No hay datos de fuente.' };
      var totF = lf.reduce(function (t, x) { return t + x.valor; }, 0);
      return {
        titulo: '📣 De dónde llegan',
        texto: lf.map(function (x) { return '- ' + x.label + ': ' + b(x.valor) + ' (' + x.pct + ' %)'; }).join('\n') +
          '\n\n**' + lf[0].label + '** trae ' + bp(lf[0].valor, totF) + ' de los leads.' + marco,
        voz: 'La fuente principal es ' + lf[0].label + ' con ' + lf[0].valor + ' leads, el ' + pct(lf[0].valor, totF) + ' por ciento.'
      };
    }

    if (id === 'estados') {
      var es = d.estadoLeads || [];
      if (!es.length) return { titulo: '🏷️ Estado de los leads', texto: 'No hay leads en este rango.' + marco, voz: 'No hay leads en este rango.' };
      var totE = es.reduce(function (t, x) { return t + x.valor; }, 0);
      return {
        titulo: '🏷️ Estado de los leads',
        texto: es.map(function (x) { return '- ' + x.label + ': ' + b(x.valor) + ' (' + pct(x.valor, totE) + ' %)'; }).join('\n') +
          '\n\nTotal en el rango: ' + b(totE) + '.' + marco,
        voz: 'Por estado: ' + es.slice(0, 5).map(function (x) { return x.label + ', ' + x.valor; }).join('; ') + '.'
      };
    }

    if (id === 'alertas') {
      var a = d.alertas || { sinContacto3: 0, sinContacto7: 0, seguimientosVencidos: 0 };
      var total = a.sinContacto3 + a.seguimientosVencidos;
      return {
        titulo: '🚨 Alertas del día',
        texto: (total
          ? 'Hay cosas que atender:\n\n'
          : 'Todo tranquilo por ahora:\n\n') +
          '- Leads sin contacto por más de 3 días: ' + b(a.sinContacto3) + '\n' +
          '- Leads sin contacto por más de 7 días: ' + b(a.sinContacto7) + '\n' +
          '- Seguimientos vencidos: ' + b(a.seguimientosVencidos) +
          (a.sinContacto7 ? '\n\n_Los de más de 7 días son los que más rápido se enfrían: empieza por ahí._' : '') +
          '\n\n_Las alertas NO dependen del rango: siempre miran la foto de hoy._',
        voz: a.sinContacto3 + ' leads sin contacto por más de tres días, ' + a.sinContacto7 +
             ' por más de siete y ' + a.seguimientosVencidos + ' seguimientos vencidos.'
      };
    }

    if (id === 'meses') {
      var s = d.inscripcionesPorMes || { anio: '', labels: [], data: [] };
      if (!s.data.length) return { titulo: '📈 Mes a mes', texto: 'No hay serie de meses todavía.' + marco, voz: 'No hay serie de meses.' };
      var totalA = s.data.reduce(function (t, x) { return t + x; }, 0);
      var mejorI = 0;
      s.data.forEach(function (x, i) { if (x > s.data[mejorI]) mejorI = i; });
      var conDatos = s.data.filter(function (x) { return x > 0; }).length;
      return {
        titulo: '📈 Mes a mes',
        texto: 'Inscripciones de ' + s.anio + ':\n\n' + s.labels.map(function (l, i) {
          return '- ' + l + ': ' + b(s.data[i]);
        }).join('\n') + '\n\nTotal del año: ' + b(totalA) + '. El mejor mes fue **' + s.labels[mejorI] +
          '** con ' + b(s.data[mejorI]) + '.' +
          (conDatos ? '\nPromedio de los meses con actividad: ' + b(Math.round(totalA / conDatos)) + '.' : ''),
        voz: 'En ' + s.anio + ' llevas ' + totalA + ' inscripciones. El mejor mes fue ' + s.labels[mejorI] + ' con ' + s.data[mejorI] + '.'
      };
    }

    if (id === 'tendencia') {
      var s2 = d.inscripcionesPorMes || { labels: [], data: [] };
      if (s2.data.length < 2) return { titulo: '🔮 Tendencia', texto: 'Todavía no hay meses suficientes para ver tendencia.' + marco, voz: 'No hay meses suficientes para ver tendencia.' };
      var mesAct = new Date().getMonth();
      var actual = s2.data[mesAct] || 0;
      var previo = mesAct > 0 ? (s2.data[mesAct - 1] || 0) : 0;
      var dif = actual - previo;
      var ult3 = s2.data.slice(Math.max(0, mesAct - 2), mesAct + 1);
      var prom3 = ult3.length ? Math.round(ult3.reduce(function (t, x) { return t + x; }, 0) / ult3.length) : 0;
      var hoyD2 = new Date();
      var diaMes = hoyD2.getDate();
      var ultimo2 = new Date(hoyD2.getFullYear(), hoyD2.getMonth() + 1, 0).getDate();
      var proyeccion = diaMes ? Math.round(actual / diaMes * ultimo2) : 0;
      return {
        titulo: '🔮 Tendencia',
        texto: 'Este mes (' + s2.labels[mesAct] + ') llevas ' + b(actual) + ' ' + plural(actual, 'inscripción', 'inscripciones') + '.\n\n' +
          '- El mes pasado: ' + b(previo) + '\n' +
          '- Diferencia: **' + (dif >= 0 ? '+' : '') + num(dif) + '** ' + (dif > 0 ? '📈' : (dif < 0 ? '📉' : '➖')) + '\n' +
          '- Promedio de los últimos meses: ' + b(prom3) + '\n' +
          '- Al ritmo de hoy, cerrarías el mes en **' + num(proyeccion) + '**\n\n' +
          (dif > 0 ? 'Vas mejor que el mes pasado.' : (dif < 0 ? 'Vas por debajo del mes pasado.' : 'Vas igual que el mes pasado.')) +
          '\n\n_La proyección es una regla de tres con los días transcurridos, no una promesa._',
        voz: 'Este mes llevas ' + actual + ' inscripciones frente a ' + previo + ' del mes pasado. Al ritmo de hoy cerrarías en ' + proyeccion + '.'
      };
    }

    if (id === 'conversion') {
      var conv = k.conversion || 0;
      var r3 = d.rendimiento || [];
      var mejor2 = r3.filter(function (x) { return x.leads >= 5; }).sort(function (a, b2) { return b2.conversion - a.conversion; })[0];
      var agen = k.asesoriasAgendadas || 0, real = k.asesoriasRealizadas || 0, ins2 = k.inscripciones || 0;
      return {
        titulo: '⚡ Conversión',
        texto: 'De ' + b(k.leadsTotales) + ' leads se inscribieron ' + b(ins2) + ': **' + conv + ' %**.\n\n' +
          '- Agendadas: ' + b(agen) + (k.leadsTotales ? ' (' + pct(agen, k.leadsTotales) + ' % de los leads)' : '') + '\n' +
          '- Realizadas: ' + b(real) + (agen ? ' (' + pct(real, agen) + ' % de las agendadas)' : '') + '\n' +
          '- Inscritos: ' + b(ins2) + (real ? ' (' + pct(ins2, real) + ' % de las realizadas)' : '') + '\n\n' +
          (mejor2 ? 'El mejor del equipo convierte al **' + mejor2.conversion + ' %** (' + mejor2.asesor + ').' : '') +
          (agen && real < agen ? '\n\nSe están perdiendo ' + b(agen - real) + ' ' + plural(agen - real, 'asesoría agendada', 'asesorías agendadas') + ' sin realizar.' : '') + marco,
        voz: 'La conversión es del ' + conv + ' por ciento: ' + ins2 + ' inscritos de ' + (k.leadsTotales || 0) + ' leads.'
      };
    }

    return { titulo: 'Tablero', texto: 'Esa consulta no está disponible.', voz: '' };
  }

  /* ============================================================
     INFORMES — CONTADOR
     ============================================================ */
  function infContador(id) {
    var L = contador();
    var F = contaFiltrosPuestos();
    var T = L.length;
    var cola = pie(F, T, plural(T, 'inscrito', 'inscritos'));
    if (!T) return vacio('Contador');

    var conValor = function (r) { return Number(r.valorInscrip) || 0; };

    if (id === 'resumen') {
      var etapas = contar(L, function (r) { return etiq(r.etapaLabel); });
      var conComp = L.filter(function (r) { return txt(r.comprobanteUrl); }).length;
      var conContrato = L.filter(function (r) { return txt(r.contratoUrl); }).length;
      var validados = L.filter(function (r) { return r.contratoOk; }).length;
      var recaudo = sumar(L, conValor);
      var vencidos = L.filter(function (r) { return r.alertaOferta === 'vencido' || r.alertaTotal === 'vencido'; }).length;
      return {
        titulo: '👀 Lo que estoy viendo · Contador',
        texto: 'Tienes ' + b(T) + ' ' + plural(T, 'inscrito', 'inscritos') + ' en pantalla.\n\n' +
          '- Con comprobante de inscripción: ' + b(conComp) + ' (' + pct(conComp, T) + ' %)\n' +
          '- Con contrato firmado: ' + b(conContrato) + ' · validados: ' + b(validados) + '\n' +
          '- Oferta pagada: ' + b(L.filter(function (r) { return r.pagoOferta; }).length) +
          ' · pago total: ' + b(L.filter(function (r) { return r.pagoTotal; }).length) +
          ' · SEVIS: ' + b(L.filter(function (r) { return r.pagoSevis; }).length) + '\n' +
          '- Recaudo de inscripción registrado: **' + pesos(recaudo) + '**\n' +
          (vencidos ? '- ⚠️ Con fecha de pago vencida: ' + b(vencidos) + '\n' : '') +
          '\nLa etapa donde más gente hay es **' + etapas[0].k + '** con ' + b(etapas[0].n) + ' (' + pct(etapas[0].n, T) + ' %).' + cola,
        voz: 'Tienes ' + T + ' inscritos. ' + conComp + ' con comprobante, ' + conContrato + ' con contrato firmado y ' +
             validados + ' validados. El recaudo de inscripción suma ' + pesos(recaudo) + '.'
      };
    }

    if (id === 'etapa') {
      var e = contar(L, function (r) { return etiq(r.etapaLabel); });
      var completos = L.filter(function (r) { return r.etapa === 'COMPLETO'; }).length;
      return {
        titulo: '🚦 Por etapa del proceso',
        texto: 'Cómo van los ' + b(T) + ' inscritos:\n\n' + ranking(e, T, 8) +
          '\n\nProceso terminado (con SEVIS): ' + b(completos) + ' (' + pct(completos, T) + ' %).' + cola,
        voz: 'Por etapa: ' + e.slice(0, 5).map(function (x) { return x.k + ', ' + x.n; }).join('; ') + '.'
      };
    }

    if (id === 'cartera') {
      var ins = sumar(L, conValor);
      var of = sumar(L, function (r) { return Number(r.ofertaCop) || 0; });
      var tot = sumar(L, function (r) { return Number(r.totalCop) || 0; });
      var sev = sumar(L, function (r) { return Number(r.sevisCop) || 0; });
      var rec = sumar(L, function (r) { return Number(r.recargo) || 0; });
      var usdT = sumar(L, function (r) { return Number(r.precioUsd) || 0; });
      var conIns = L.filter(function (r) { return conValor(r) > 0; }).length;
      return {
        titulo: '💰 Plata recaudada',
        texto: 'Lo que hay registrado en las fichas que ves:\n\n' +
          '- Inscripciones: **' + pesos(ins) + '** (en ' + b(conIns) + ' ' + plural(conIns, 'ficha', 'fichas') + ')\n' +
          '- Pagos de oferta: **' + pesos(of) + '**\n' +
          '- Pagos totales: **' + pesos(tot) + '**\n' +
          '- SEVIS: **' + pesos(sev) + '**\n' +
          (rec ? '- Recargos: **' + pesos(rec) + '**\n' : '') +
          '\nSuma de todo lo registrado: **' + pesos(ins + of + tot + sev + rec) + '**.\n' +
          (usdT ? 'Valor de los programas: **' + usd(usdT) + '**.\n' : '') +
          '\nPromedio de inscripción: **' + pesos(conIns ? ins / conIns : 0) + '**.' +
          '\n\n_Son los valores digitados en cada ficha, no un estado de cuenta del banco._' + cola,
        voz: 'Inscripciones por ' + pesos(ins) + ', oferta por ' + pesos(of) + ' y pagos totales por ' + pesos(tot) +
             '. Todo junto suma ' + pesos(ins + of + tot + sev + rec) + '.'
      };
    }

    if (id === 'vencidos') {
      var vOf = L.filter(function (r) { return r.alertaOferta === 'vencido'; });
      var pOf = L.filter(function (r) { return r.alertaOferta === 'pronto'; });
      var vTo = L.filter(function (r) { return r.alertaTotal === 'vencido'; });
      var pTo = L.filter(function (r) { return r.alertaTotal === 'pronto'; });
      if (!vOf.length && !pOf.length && !vTo.length && !pTo.length) {
        return {
          titulo: '⏰ Vencidos y por vencer',
          texto: 'Ninguna fecha máxima de pago está vencida ni a punto de vencer. 🎉' + cola,
          voz: 'No hay fechas de pago vencidas ni próximas a vencer.'
        };
      }
      var listar = function (arr) {
        return arr.slice(0, 8).map(function (r) {
          return '- N° ' + r.n + ' · ' + txt(r.nombres + ' ' + r.apellidos) +
                 (txt(r.ofertaMax) || txt(r.totalMax) ? ' · vence ' + fechaCorta(fecha(r.ofertaMax || r.totalMax)) : '');
        }).join('\n');
      };
      var texto = '';
      if (vOf.length) texto += '**Oferta vencida** (' + num(vOf.length) + '):\n' + listar(vOf) + '\n\n';
      if (vTo.length) texto += '**Pago total vencido** (' + num(vTo.length) + '):\n' + listar(vTo) + '\n\n';
      if (pOf.length) texto += 'Oferta por vencer pronto: ' + b(pOf.length) + '\n';
      if (pTo.length) texto += 'Pago total por vencer pronto: ' + b(pTo.length) + '\n';
      return {
        titulo: '⏰ Vencidos y por vencer',
        texto: texto + cola,
        voz: vOf.length + ' con la oferta vencida y ' + vTo.length + ' con el pago total vencido. ' +
             (pOf.length + pTo.length) + ' están por vencer.',
        lista: vOf.concat(vTo).slice(0, 10).map(function (r) {
          return { nombre: txt(r.nombres + ' ' + r.apellidos), contacto: r.whatsapp };
        })
      };
    }

    if (id === 'contratos') {
      var sinFirmar = L.filter(function (r) { return txt(r.comprobanteUrl) && !txt(r.contratoUrl); });
      var porValidar = L.filter(function (r) { return txt(r.contratoUrl) && !r.contratoOk; });
      var ok = L.filter(function (r) { return r.contratoOk; }).length;
      return {
        titulo: '📄 Contratos por validar',
        texto: '- Firmados y validados: ' + b(ok) + '\n' +
          '- Firmados **esperando tu revisión**: ' + b(porValidar.length) + '\n' +
          '- Con comprobante pero sin firmar todavía: ' + b(sinFirmar.length) + '\n\n' +
          (porValidar.length ? 'Los que esperan revisión:\n' + porValidar.slice(0, 10).map(function (r) {
            return '- N° ' + r.n + ' · ' + txt(r.nombres + ' ' + r.apellidos);
          }).join('\n') + '\n\n_Al marcar "Contrato OK" se le avisa al estudiante por correo y WhatsApp._' : '') + cola,
        voz: porValidar.length + ' contratos esperan tu revisión, ' + ok + ' ya están validados y ' +
             sinFirmar.length + ' no se han firmado.',
        lista: porValidar.slice(0, 10).map(function (r) {
          return { nombre: txt(r.nombres + ' ' + r.apellidos), contacto: r.whatsapp };
        })
      };
    }

    if (id === 'papeles') {
      var sinComp = L.filter(function (r) { return !txt(r.comprobanteUrl); }).length;
      var sinDoc = L.filter(function (r) { return !txt(r.documentoUrl); }).length;
      var sinCed = L.filter(function (r) { return !txt(r.cedulaUrl); }).length;
      var sinDeudor = L.filter(function (r) { return !txt(r.nombreDeudor); }).length;
      var sinDocumento = L.filter(function (r) { return !txt(r.documento); }).length;
      var sinNac = L.filter(function (r) { return !txt(r.nacimiento); }).length;
      var completos2 = L.filter(function (r) {
        return txt(r.comprobanteUrl) && txt(r.documentoUrl) && txt(r.cedulaUrl) && txt(r.nombreDeudor);
      }).length;
      return {
        titulo: '📎 Papeles que faltan',
        texto: b(completos2) + ' de ' + b(T) + ' ' + plural(completos2, 'ficha tiene', 'fichas tienen') + ' todo el papeleo (' + pct(completos2, T) + ' %).\n\nLo que falta:\n' +
          '- Sin comprobante de inscripción: ' + b(sinComp) + '\n' +
          '- Sin PDF del documento: ' + b(sinDoc) + '\n' +
          '- Sin PDF de la cédula del deudor: ' + b(sinCed) + '\n' +
          '- Sin nombre del deudor: ' + b(sinDeudor) + '\n' +
          '- Sin número de documento: ' + b(sinDocumento) + '\n' +
          '- Sin fecha de nacimiento: ' + b(sinNac) + cola,
        voz: completos2 + ' de ' + T + ' fichas tienen todo el papeleo. Faltan ' + sinComp +
             ' comprobantes, ' + sinDoc + ' documentos y ' + sinCed + ' cédulas del deudor.'
      };
    }

    if (id === 'plan') {
      var planes = contar(L, function (r) { return etiq(r.tipoPlan); });
      var sponsors = contar(L, function (r) { return etiq(r.sponsor); });
      var pp = contar(L, function (r) { return etiq(r.planPrograma); });
      var proc = contar(L, function (r) { return etiq(r.proceso); });
      return {
        titulo: '🧾 Por plan y sponsor',
        texto: 'Tipo de plan:\n' + ranking(planes, T, 6) +
          '\n\nSponsor:\n' + ranking(sponsors, T, 8) +
          '\n\nPlan del programa:\n' + ranking(pp, T, 6) +
          '\n\nTipo de proceso:\n' + ranking(proc, T, 6) + cola,
        voz: 'El plan más común es ' + planes[0].k + ' con ' + planes[0].n + ' y el sponsor principal es ' + sponsors[0].k + '.'
      };
    }

    if (id === 'addson') {
      var m = {};
      var conAdds = 0;
      L.forEach(function (r) {
        var a = r.addsOn || [];
        if (a.length) conAdds++;
        a.forEach(function (x) { var k = txt(x); if (k) m[k] = (m[k] || 0) + 1; });
      });
      var arr = Object.keys(m).map(function (k) { return { k: k, n: m[k] }; })
        .sort(function (a, b2) { return b2.n - a.n; });
      if (!arr.length) {
        return { titulo: '➕ Adds-on vendidos', texto: 'Ninguna ficha en pantalla tiene adds-on marcados.' + cola, voz: 'No hay adds-on marcados.' };
      }
      return {
        titulo: '➕ Adds-on vendidos',
        texto: b(conAdds) + ' de ' + b(T) + ' ' + plural(conAdds, 'inscrito lleva', 'inscritos llevan') + ' al menos un adds-on (' + pct(conAdds, T) + ' %).\n\n' +
          arr.map(function (x) { return '- ' + x.k + ': ' + b(x.n) + ' (' + pct(x.n, T) + ' % de los inscritos)'; }).join('\n') +
          '\n\nEl más vendido es **' + arr[0].k + '**. Promedio: **' +
          (Math.round(arr.reduce(function (t, x) { return t + x.n; }, 0) / T * 100) / 100) + '** adds-on por inscrito.' + cola,
        voz: conAdds + ' inscritos llevan adds-on. El más vendido es ' + arr[0].k + ' con ' + arr[0].n + '.'
      };
    }

    if (id === 'metodo') {
      var mi = contar(L.filter(function (r) { return txt(r.metodoInscrip); }), function (r) { return txt(r.metodoInscrip); });
      var mo = contar(L.filter(function (r) { return txt(r.metodoOferta); }), function (r) { return txt(r.metodoOferta); });
      var mt = contar(L.filter(function (r) { return txt(r.metodoTotal); }), function (r) { return txt(r.metodoTotal); });
      var cu = contar(L.filter(function (r) { return txt(r.cuentaInscrip); }), function (r) { return txt(r.cuentaInscrip); });
      var sinMetodo = L.filter(function (r) { return txt(r.comprobanteUrl) && !txt(r.metodoInscrip); }).length;
      return {
        titulo: '💳 Métodos de pago',
        texto: 'Inscripción:\n' + (mi.length ? ranking(mi, T, 8) : '- Sin método registrado') +
          (mo.length ? '\n\nPago de oferta:\n' + ranking(mo, T, 8) : '') +
          (mt.length ? '\n\nPago total:\n' + ranking(mt, T, 8) : '') +
          (cu.length ? '\n\nCuentas usadas:\n' + ranking(cu, T, 6) : '') +
          (sinMetodo ? '\n\n⚠️ ' + b(sinMetodo) + ' ' + plural(sinMetodo, 'ficha tiene', 'fichas tienen') + ' comprobante pero no método de pago.' : '') + cola,
        voz: mi.length ? ('El método de inscripción más usado es ' + mi[0].k + ' con ' + mi[0].n + '.') : 'No hay métodos de pago registrados.'
      };
    }

    if (id === 'oferta') {
      var pag = L.filter(function (r) { return r.pagoOferta; });
      var conFecha = L.filter(function (r) { return txt(r.ofertaMax); });
      var monto = sumar(L, function (r) { return Number(r.ofertaCop) || 0; });
      var usdO = sumar(L, function (r) { return Number(r.ofertaUsd) || 0; });
      return {
        titulo: '💵 Pago de oferta',
        texto: b(pag.length) + ' de ' + b(T) + ' ' + plural(pag.length, 'inscrito ha pagado', 'inscritos han pagado') + ' la oferta (' + pct(pag.length, T) + ' %).\n\n' +
          '- Con fecha máxima puesta: ' + b(conFecha.length) + '\n' +
          '- Vencidos: ' + b(L.filter(function (r) { return r.alertaOferta === 'vencido'; }).length) +
          ' · por vencer: ' + b(L.filter(function (r) { return r.alertaOferta === 'pronto'; }).length) + '\n' +
          '- Recaudado en ofertas: **' + pesos(monto) + '**' + (usdO ? ' (' + usd(usdO) + ')' : '') + '\n' +
          '- Con comprobante de oferta cargado: ' + b(L.filter(function (r) { return txt(r.comprobanteOfertaUrl); }).length) +
          '\n\nFaltan por pagar: ' + b(T - pag.length) + '.' + cola,
        voz: pag.length + ' de ' + T + ' han pagado la oferta, que suma ' + pesos(monto) + '. Faltan ' + (T - pag.length) + '.'
      };
    }

    if (id === 'total') {
      var pt = L.filter(function (r) { return r.pagoTotal; });
      var ps = L.filter(function (r) { return r.pagoSevis; });
      var montoT = sumar(L, function (r) { return Number(r.totalCop) || 0; });
      var montoS = sumar(L, function (r) { return Number(r.sevisCop) || 0; });
      return {
        titulo: '🏦 Pago total y SEVIS',
        texto: '- Pago total hecho: ' + b(pt.length) + ' de ' + b(T) + ' (' + pct(pt.length, T) + ' %) · **' + pesos(montoT) + '**\n' +
          '- SEVIS pagado: ' + b(ps.length) + ' (' + pct(ps.length, T) + ' %) · **' + pesos(montoS) + '**\n' +
          '- Con comprobante de pago total cargado: ' + b(L.filter(function (r) { return txt(r.comprobanteTotalUrl); }).length) + '\n' +
          '- Vencidos en pago total: ' + b(L.filter(function (r) { return r.alertaTotal === 'vencido'; }).length) + '\n\n' +
          'Proceso completo (todo pagado, con SEVIS): ' + b(L.filter(function (r) { return r.etapa === 'COMPLETO'; }).length) + '.' + cola,
        voz: pt.length + ' con pago total por ' + pesos(montoT) + ' y ' + ps.length + ' con SEVIS pagado.'
      };
    }

    if (id === 'asesor') {
      var m5 = {};
      L.forEach(function (r) {
        var k = txt(r.asesor) || 'Sin asesor';
        if (!m5[k]) m5[k] = { k: k, n: 0, plata: 0, comp: 0, comple: 0 };
        m5[k].n++;
        m5[k].plata += conValor(r);
        if (txt(r.comprobanteUrl)) m5[k].comp++;
        if (r.etapa === 'COMPLETO') m5[k].comple++;
      });
      var arr5 = Object.keys(m5).map(function (k) { return m5[k]; })
        .sort(function (a, b2) { return b2.n - a.n; });
      return {
        titulo: '👤 Por asesor',
        texto: arr5.map(function (x) {
          return '- ' + x.k + ': ' + b(x.n) + ' ' + plural(x.n, 'inscrito', 'inscritos') + ' · ' +
                 b(x.comp) + ' con comprobante · **' + pesos(x.plata) + '**';
        }).join('\n') + '\n\nVa adelante **' + arr5[0].k + '** con ' + b(arr5[0].n) + '.' + cola,
        voz: 'Hay ' + arr5.length + ' asesores con inscritos en pantalla. El primero lleva ' +
             arr5[0].n + ' inscritos.'
      };
    }

    if (id === 'mes') {
      var conF = L.map(function (r) { return fecha(r.fechaInscripcion); }).filter(Boolean);
      if (!conF.length) {
        return {
          titulo: '📈 Inscripciones por mes',
          texto: 'Ninguna ficha en pantalla tiene fecha de inscripción registrada.\n\n_La fecha se pone sola cuando entra el comprobante._' + cola,
          voz: 'No hay fechas de inscripción registradas.'
        };
      }
      var m6 = {};
      conF.forEach(function (d) { var k = claveMes(d); m6[k] = (m6[k] || 0) + 1; });
      var claves = Object.keys(m6).sort();
      var mejor = claves.slice().sort(function (a, b2) { return m6[b2] - m6[a]; })[0];
      var pm = mejor.split('-');
      return {
        titulo: '📈 Inscripciones por mes',
        texto: claves.slice(-12).map(function (k) {
          var p = k.split('-');
          return '- ' + MESES[+p[1] - 1] + ' ' + p[0] + ': ' + b(m6[k]);
        }).join('\n') + '\n\nEl mejor mes fue **' + MESES[+pm[1] - 1] + ' ' + pm[0] + '** con ' + b(m6[mejor]) + '.' +
          '\nSin fecha de inscripción: ' + b(T - conF.length) + '.' + cola,
        voz: 'El mejor mes fue ' + MESES[+pm[1] - 1] + ' de ' + pm[0] + ' con ' + m6[mejor] + ' inscripciones.'
      };
    }

    if (id === 'edad') {
      var edades = L.map(function (r) { return Number(r.edad); }).filter(function (n) { return n > 0; });
      if (!edades.length) {
        return { titulo: '🎂 Edades', texto: 'Ninguna ficha en pantalla tiene fecha de nacimiento.' + cola, voz: 'No hay fechas de nacimiento.' };
      }
      var suma = edades.reduce(function (t, x) { return t + x; }, 0);
      var orden = edades.slice().sort(function (a, b2) { return a - b2; });
      var mediana = orden[Math.floor(orden.length / 2)];
      var rangos = { '17 a 19': 0, '20 a 22': 0, '23 a 25': 0, '26 a 28': 0 };
      edades.forEach(function (e) {
        if (e <= 19) rangos['17 a 19']++;
        else if (e <= 22) rangos['20 a 22']++;
        else if (e <= 25) rangos['23 a 25']++;
        else rangos['26 a 28']++;
      });
      return {
        titulo: '🎂 Edades',
        texto: 'De ' + b(edades.length) + ' fichas con fecha de nacimiento:\n\n' +
          '- Promedio: **' + (Math.round(suma / edades.length * 10) / 10) + ' años**\n' +
          '- Mediana: **' + mediana + ' años**\n' +
          '- Más joven: **' + orden[0] + '** · mayor: **' + orden[orden.length - 1] + '**\n\n' +
          Object.keys(rangos).map(function (k) {
            return '- ' + k + ' años: ' + b(rangos[k]) + ' (' + pct(rangos[k], edades.length) + ' %)';
          }).join('\n') +
          '\n\nSin fecha de nacimiento: ' + b(T - edades.length) + '.' + cola,
        voz: 'La edad promedio es de ' + (Math.round(suma / edades.length * 10) / 10) + ' años, entre ' +
             orden[0] + ' y ' + orden[orden.length - 1] + '.'
      };
    }

    if (id === 'claves') {
      var conClave = L.filter(function (r) { return txt(r.claveAcceso); }).length;
      var sinClave = L.filter(function (r) { return !txt(r.claveAcceso); });
      var listos = L.filter(function (r) { return txt(r.claveAcceso) && txt(r.comprobanteUrl); }).length;
      return {
        titulo: '🔑 Acceso al portal',
        texto: b(conClave) + ' de ' + b(T) + ' ' + plural(conClave, 'inscrito tiene', 'inscritos tienen') + ' clave de acceso (' + pct(conClave, T) + ' %).\n\n' +
          '- Listos para firmar (clave + comprobante): ' + b(listos) + '\n' +
          '- **Sin clave**: ' + b(sinClave.length) + '\n\n' +
          (sinClave.length
            ? 'Sin clave no pueden entrar a la Zona de Estudiantes ni firmar el contrato.\n' +
              sinClave.slice(0, 8).map(function (r) { return '- N° ' + r.n + ' · ' + txt(r.nombres + ' ' + r.apellidos); }).join('\n')
            : 'Todos pueden entrar al portal. 🎉') + cola,
        voz: conClave + ' de ' + T + ' tienen clave de acceso. ' + listos + ' están listos para firmar y ' +
             sinClave.length + ' no tienen clave.'
      };
    }

    if (id === 'siguiente') {
      var a1 = L.filter(function (r) { return !txt(r.comprobanteUrl); }).length;
      var a2 = L.filter(function (r) { return txt(r.comprobanteUrl) && !txt(r.contratoUrl); }).length;
      var a3 = L.filter(function (r) { return txt(r.contratoUrl) && !r.contratoOk; }).length;
      var a4 = L.filter(function (r) { return r.alertaOferta === 'vencido' || r.alertaTotal === 'vencido'; }).length;
      var a5 = L.filter(function (r) { return r.alertaOferta === 'pronto' || r.alertaTotal === 'pronto'; }).length;
      var a6 = L.filter(function (r) { return r.contratoOk && !r.pagoOferta; }).length;
      var a7 = L.filter(function (r) { return r.pagoTotal && !r.pagoSevis; }).length;
      var tareas = [];
      if (a3) tareas.push('- **Revisar ' + num(a3) + ' ' + plural(a3, 'contrato firmado', 'contratos firmados') + '** que están esperando tu validación');
      if (a4) tareas.push('- **Cobrar ' + num(a4) + ' ' + plural(a4, 'pago vencido', 'pagos vencidos') + '**');
      if (a5) tareas.push('- Avisar a ' + num(a5) + ' que ' + plural(a5, 'está', 'están') + ' por vencer');
      if (a1) tareas.push('- Subir ' + num(a1) + ' ' + plural(a1, 'comprobante de inscripción', 'comprobantes de inscripción'));
      if (a2) tareas.push('- Recordar la firma del contrato a ' + num(a2));
      if (a6) tareas.push('- Seguir el pago de oferta de ' + num(a6) + ' con el contrato ya validado');
      if (a7) tareas.push('- Gestionar el SEVIS de ' + num(a7) + ' que ya pagaron todo');
      return {
        titulo: '✅ Qué hago ahora',
        texto: (tareas.length
          ? 'Por orden de urgencia, sobre lo que tienes en pantalla:\n\n' + tareas.join('\n')
          : 'No hay nada pendiente con los filtros que tienes puestos. 🎉') + cola,
        voz: tareas.length
          ? ('Lo urgente: ' + a3 + ' contratos por revisar, ' + a4 + ' pagos vencidos y ' + a5 + ' por vencer.')
          : 'No hay pendientes con los filtros puestos.'
      };
    }

    return vacio('Contador');
  }

  function informe(vista, id) {
    if (vista === 'view-comercial') return infComercial(id);
    if (vista === 'view-dashboard') return infDashboard(id);
    if (vista === 'view-contador') return infContador(id);
    return vacio('Consultas');
  }

  /* ============================================================
     BOTÓN FLOTANTE
     ============================================================ */
  function vistaActiva() {
    var v = document.querySelector('.view.active');
    return v ? v.id : '';
  }

  function montar() {
    var v = vistaActiva();
    if (!PANELES[v] || !haySesion()) return quitar();
    if (fab) {
      if (fab.dataset.vista !== v) {
        fab.dataset.vista = v;
        if (abierta && cerrarHoja) cerrarHoja();
      }
      return;
    }
    fab = nodo(
      '<button class="iq-fab" type="button" aria-label="Consultas" title="Tócalo para consultar. Mantenlo pulsado para moverlo.">' +
      '<span class="iq-fab-ring" aria-hidden="true"></span>' +
      '<span class="iq-fab-ic">' + ROBOT + '</span>' +
      '<span class="iq-fab-tx">Consultar</span>' +
      '</button>'
    );
    fab.dataset.vista = v;
    if (reducido()) fab.classList.add('iq-sin-motor');
    fab.addEventListener('click', function (ev) {
      if (fab.dataset.arrastro === '1') { fab.dataset.arrastro = ''; ev.preventDefault(); return; }
      Repro.desbloquear();
      abrir(fab.dataset.vista);
    });
    arrastrable(fab);
    document.body.appendChild(fab);
  }
  function quitar() {
    if (fab) { fab.remove(); fab = null; }
    if (abierta && cerrarHoja) cerrarHoja();
  }

  /* Clic sostenido para mover. No se guarda la posición: al cambiar de
     vista el nodo se destruye y el siguiente nace en su esquina. */
  function arrastrable(el) {
    var ESPERA = 420, TOLERA = 10;
    var temp = null, listo = false, x0 = 0, y0 = 0, dx = 0, dy = 0, pid = null;

    function fijar(izq, arr) {
      var w = el.offsetWidth, h = el.offsetHeight, m = 8;
      izq = Math.max(m, Math.min(izq, window.innerWidth - w - m));
      arr = Math.max(m, Math.min(arr, window.innerHeight - h - m));
      el.style.left = izq + 'px'; el.style.top = arr + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto';
    }
    function soltar() {
      clearTimeout(temp); temp = null;
      if (listo) { el.classList.remove('iq-fab-mov'); try { el.releasePointerCapture(pid); } catch (e) {} }
      listo = false; pid = null;
    }
    el.addEventListener('pointerdown', function (ev) {
      if (ev.button != null && ev.button > 0) return;
      pid = ev.pointerId; x0 = ev.clientX; y0 = ev.clientY; el.dataset.arrastro = '';
      temp = setTimeout(function () {
        var c = el.getBoundingClientRect();
        dx = x0 - c.left; dy = y0 - c.top; listo = true;
        el.classList.add('iq-fab-mov');
        try { el.setPointerCapture(pid); } catch (e) {}
        try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
        fijar(c.left, c.top);
      }, ESPERA);
    });
    el.addEventListener('pointermove', function (ev) {
      if (!listo) {
        if (temp && (Math.abs(ev.clientX - x0) > TOLERA || Math.abs(ev.clientY - y0) > TOLERA)) { clearTimeout(temp); temp = null; }
        return;
      }
      ev.preventDefault();
      el.dataset.arrastro = '1';
      fijar(ev.clientX - dx, ev.clientY - dy);
    });
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', function () { el.dataset.arrastro = ''; soltar(); });
    el.__fijar = fijar;
  }

  /* Un solo listener global: el FAB se crea y se destruye a cada rato y
     uno por FAB sería una fuga silenciosa. */
  window.addEventListener('resize', function () {
    if (!fab || !fab.parentNode || !fab.__fijar || !fab.style.left) return;
    fab.__fijar(parseFloat(fab.style.left) || 0, parseFloat(fab.style.top) || 0);
  });

  /* ============================================================
     HOJA DE CONSULTAS
     ============================================================ */
  function abrir(vista) {
    if (abierta) return;
    var cfg = PANELES[vista];
    if (!cfg) return;
    abierta = true;

    var hoja = nodo(
      '<div class="iq-wrap" role="dialog" aria-modal="true" aria-label="' + limpio(cfg.titulo) + '">' +
      '  <div class="iq-fondo"></div>' +
      '  <section class="iq-hoja">' +
      '    <header class="iq-h">' +
      '      <span class="iq-h-ic">' + ROBOT + '</span>' +
      '      <div class="iq-h-tx"><b>' + limpio(cfg.titulo) + '</b><small>' + limpio(cfg.sub) + '</small></div>' +
      '      <button class="iq-x" type="button" aria-label="Cerrar">' + CERRAR + '</button>' +
      '    </header>' +
      '    <div class="iq-body" id="iq-body"></div>' +
      '    <div class="iq-pie" id="iq-pie" role="group" aria-label="Consultas disponibles"></div>' +
      '  </section>' +
      '</div>'
    );
    document.body.appendChild(hoja);
    requestAnimationFrame(function () { hoja.classList.add('iq-on'); });

    var body = hoja.querySelector('#iq-body');
    var pieEl = hoja.querySelector('#iq-pie');

    function cerrar() {
      abierta = false; cerrarHoja = null;
      Repro.parar();
      hoja.classList.remove('iq-on');
      setTimeout(function () { hoja.remove(); }, reducido() ? 0 : 260);
      document.removeEventListener('keydown', esc);
    }
    cerrarHoja = cerrar;
    function esc(ev) { if (ev.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', esc);
    hoja.querySelector('.iq-x').addEventListener('click', cerrar);
    hoja.querySelector('.iq-fondo').addEventListener('click', cerrar);

    cfg.botones.forEach(function (bt) {
      var el = nodo('<button class="iq-chip" type="button" data-id="' + bt.id + '"><span aria-hidden="true">' + bt.ic + '</span> ' + limpio(bt.et) + '</button>');
      el.addEventListener('click', function () {
        var ch = pieEl.querySelectorAll('.iq-chip');
        for (var k = 0; k < ch.length; k++) ch[k].classList.toggle('on', ch[k] === el);
        Repro.desbloquear();
        lanzar(body, vista, bt);
      });
      pieEl.appendChild(el);
    });

    pedirVoz();
    /* NADA se lanza solo: el panel se abre y espera a que el usuario
       toque el botón que quiera. */
    pintarAviso(body, 'Toca 👀 Lo que estoy viendo para el resumen, o cualquier otra consulta de abajo. Los números salen de lo que tienes en pantalla ahora mismo, con los filtros puestos.');
  }

  function irAbajo(body) { body.scrollTop = body.scrollHeight; }

  function pintarAviso(body, t) {
    var el = nodo('<div class="iq-hint"></div>');
    el.textContent = t;
    body.appendChild(el);
    return el;
  }

  function lanzar(body, vista, boton) {
    Repro.parar();
    var mio = nodo('<div class="iq-msg iq-yo"></div>');
    mio.textContent = boton.ic + ' ' + boton.et;
    body.appendChild(mio);
    irAbajo(body);

    var cargando = nodo(
      '<div class="iq-msg iq-bot iq-cargando">' +
      '<span class="iq-pts"><i></i><i></i><i></i></span>' +
      '<span class="iq-carga-tx">Leyendo lo que tienes en pantalla…</span>' +
      '</div>'
    );
    body.appendChild(cargando);
    irAbajo(body);

    var t0 = Date.now();
    var r;
    try { r = informe(vista, boton.id); }
    catch (err) {
      if (cargando.parentNode) cargando.remove();
      var e = nodo('<div class="iq-msg iq-err"></div>');
      e.textContent = 'No se pudo armar la consulta: ' + ((err && err.message) || err);
      body.appendChild(e); irAbajo(body);
      return;
    }
    /* Que el "escribiendo" se vea aunque el cálculo sea instantáneo. */
    var espera = Math.max(0, 420 - (Date.now() - t0));
    setTimeout(function () {
      if (!cargando.parentNode) return;      /* cerraron la hoja */
      cargando.remove();
      pintar(body, r);
    }, espera);
  }

  function pintar(body, r) {
    var el = nodo('<div class="iq-msg iq-bot"></div>');
    var caja = nodo('<div class="iq-tx"></div>');
    el.appendChild(caja);
    body.appendChild(el);
    irAbajo(body);

    escribiendo(caja, r.texto, function () {
      if (r.lista && r.lista.length) el.appendChild(listaPersonas(r.lista));
      el.appendChild(botonera(r));
      irAbajo(body);
      leerSiToca(el, r.voz || r.texto);
    }, function () { irAbajo(body); });
    return el;
  }

  /* Efecto "escribiendo": se revela el texto plano y al terminar se
     cambia por el HTML con negritas y viñetas. Un toque lo salta. */
  function escribiendo(caja, texto, fin, tick) {
    var t = String(texto || '');
    function acabar() {
      caja.innerHTML = aHtml(t);
      caja.classList.remove('iq-escribiendo');
      caja.onclick = null;
      if (fin) fin();
    }
    if (reducido() || t.length < 2) { acabar(); return; }
    caja.classList.add('iq-escribiendo');
    var i = 0;
    var paso = Math.max(2, Math.ceil(t.length / 70));      /* ~1,4 s pase lo que pase */
    var timer = setInterval(function () {
      if (!caja.isConnected) { clearInterval(timer); return; }
      i += paso;
      caja.textContent = t.slice(0, i);
      if (tick) tick();
      if (i >= t.length) { clearInterval(timer); acabar(); }
    }, 20);
    caja.onclick = function () { clearInterval(timer); acabar(); };
  }

  /* Texto plano → HTML mínimo (párrafos, viñetas, **negrita**). */
  function aHtml(t) {
    var lineas = String(t || '').split(/\r?\n/);
    var out = [], lista = [];
    function cerrarLista() { if (lista.length) { out.push('<ul>' + lista.join('') + '</ul>'); lista = []; } }
    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i].trim();
      if (!l) { cerrarLista(); continue; }
      var m = /^[-*•]\s+(.*)$/.exec(l);
      if (m) { lista.push('<li>' + realce(limpio(m[1])) + '</li>'); continue; }
      cerrarLista();
      var clase = /^_/.test(l) ? ' class="iq-muted"' : '';
      out.push('<p' + clase + '>' + realce(limpio(l.replace(/^_/, '').replace(/_$/, '').replace(/^#{1,6}\s*/, ''))) + '</p>');
    }
    cerrarLista();
    return out.join('') || '<p class="iq-muted">Sin datos.</p>';
  }
  function realce(s) { return s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }

  function listaPersonas(lista) {
    var caja = nodo('<div class="iq-personas"></div>');
    lista.forEach(function (p) {
      var n = '';
      try { n = String(p.contacto || '').replace(/\D/g, ''); } catch (e) {}
      var fila = nodo('<div class="iq-per"><span class="iq-per-n"></span></div>');
      fila.querySelector('.iq-per-n').textContent = String(p.nombre || '').trim();
      if (n) {
        var bt = nodo('<button class="iq-per-wa" type="button" aria-label="Escribir por WhatsApp">' + WA + '</button>');
        bt.addEventListener('click', function () {
          window.open('https://wa.me/' + (n.length === 10 ? '57' + n : n), '_blank');
        });
        fila.appendChild(bt);
      }
      caja.appendChild(fila);
    });
    return caja;
  }

  function botonera(r) {
    var caja = nodo('<div class="iq-acts"></div>');

    var voz = nodo('<button class="iq-act iq-voz" type="button" aria-label="Escuchar la respuesta">' + BOCINA + ' Escuchar</button>');
    if (!(vozCfg && vozCfg.configurada)) voz.style.display = 'none';
    voz.addEventListener('click', function () {
      if (Repro.suena() && Repro.dueno() === voz) return Repro.parar();
      Repro.desbloquear();
      Repro.hablar(r.voz || r.texto, voz);
    });
    caja.appendChild(voz);

    var cop = nodo('<button class="iq-act" type="button">Copiar</button>');
    cop.addEventListener('click', function () {
      var t = (r.titulo ? r.titulo + '\n\n' : '') + String(r.texto || '').replace(/\*\*/g, '');
      try {
        navigator.clipboard.writeText(t);
        cop.textContent = 'Copiado ✓';
        setTimeout(function () { cop.textContent = 'Copiar'; }, 1600);
      } catch (e) { avisar('No se pudo copiar.'); }
    });
    caja.appendChild(cop);

    var wa = nodo('<button class="iq-act" type="button">' + WA + ' WhatsApp</button>');
    wa.addEventListener('click', function () { compartir(r); });
    caja.appendChild(wa);

    return caja;
  }

  /* WhatsApp sin número: abre el selector de contactos. Se recorta
     porque una URL gigante no la abre ni el móvil ni el web. */
  function compartir(r) {
    var cab = (r.titulo ? r.titulo + '\n\n' : '');
    var cuerpo = String(r.texto || '').replace(/\*\*/g, '*');
    var TOPE = 1500;
    if (cab.length + cuerpo.length > TOPE) {
      cuerpo = cuerpo.slice(0, TOPE - cab.length - 20).replace(/\s+\S*$/, '') + '…';
    }
    var t = encodeURIComponent(cab + cuerpo);
    var movil = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    window.open((movil ? 'whatsapp://send?text=' : 'https://api.whatsapp.com/send?text=') + t, '_blank');
  }

  /* Lectura automática: solo si el backend dice que hay clave y el
     interruptor de Configuración → Avanzado está en SÍ. */
  function leerSiToca(burbuja, texto) {
    pedirVoz().then(function (v) {
      if (!v || !v.configurada || !v.auto) return;
      if (!burbuja || !burbuja.parentNode) return;
      Repro.hablar(texto, burbuja.querySelector('.iq-voz'));
    });
  }

  /* ============================================================
     ARRANQUE
     ------------------------------------------------------------
     app.js expone showView; se envuelve (mismo patrón de las otras
     capas) en vez de vigilar el DOM entero. Queda un respaldo por si
     alguna vista se activa sin pasar por showView.
     ============================================================ */
  var pendiente = null;
  function revisar() {
    if (pendiente) return;
    pendiente = setTimeout(function () {
      pendiente = null;
      if (PANELES[vistaActiva()] && haySesion()) montar(); else quitar();
    }, 90);
  }

  function arrancar() {
    var original = window.showView;
    if (typeof original === 'function') {
      window.showView = function () {
        var r = original.apply(this, arguments);
        revisar();
        return r;
      };
    }
    try {
      var raiz = document.body;
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].type === 'attributes') { revisar(); return; }
        }
      }).observe(raiz, { attributes: true, attributeFilter: ['class'], subtree: true });
    } catch (e) {}
    window.addEventListener('hashchange', revisar);
    revisar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  /* Puerta para las pruebas (la app no la usa). */
  window.__sep11 = {
    informe: informe, PANELES: PANELES, aHtml: aHtml, fecha: fecha, pct: pct,
    comercial: comercial, contador: contador, tablero: tablero,
    trocear: Repro.trocear, compartir: compartir,
    montar: montar, quitar: quitar, revisar: revisar, abrir: abrir,
    cerrar: function () { if (cerrarHoja) cerrarHoja(); },
    fab: function () { return fab; }, abierta: function () { return abierta; },
    vozCfg: function (v) { if (v !== undefined) vozCfg = v; return vozCfg; }
  };
})();
