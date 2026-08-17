/* ============================================================================
 * EXPORTAR · SEP GROUP  (Comercial · Contador · Nivel de Inglés)
 * ----------------------------------------------------------------------------
 * QUÉ HACE
 *   El botón ⬇ de la cabecera de las tres vistas abre un modal para sacar:
 *     · EXCEL (.xlsx) → los DATOS. Hoja "Datos" con formato + hoja "Resumen".
 *     · PDF            → un INFORME: portada, totales con barras y anexo de
 *                        listado con máximo 8 columnas.
 *
 * REGLAS QUE VIENEN DE ARRIBA (no cambiarlas sin pedirlo)
 *   · Solo SUPERUSUARIO y DESARROLLADOR ven el botón (el backend lo vuelve
 *     a comprobar en cada ruta: aquí solo se esconde el botón).
 *   · El archivo SOLO SE DESCARGA. Nada se guarda en Drive.
 *   · CLAVE_ACCESO no aparece: el backend ni siquiera la manda.
 *   · El modal arranca heredando los filtros que ya estén puestos en la
 *     pantalla, y todo se puede cambiar.
 *   · La última selección de columnas se recuerda por usuario y por vista
 *     (en este navegador, con localStorage).
 *
 * INSTALACIÓN
 *   <link rel="stylesheet" href="css/exportar.css">
 *   <script src="js/exportar.js"></script>   (después de app.js)
 *   y un botón por vista con id exp-btn-comercial / exp-btn-contador /
 *   exp-btn-nivel.
 *
 * ExcelJS se baja del CDN la PRIMERA vez que se exporta a Excel, no al
 * abrir la app. Si no hay internet en ese momento, se avisa y no se rompe
 * nada más.
 * ========================================================================== */
(function () {
  'use strict';

  if (window.__sepExportar) return;
  window.__sepExportar = true;

  var EXCELJS_CDN = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  var AZUL = 'FF263143', LIMA = 'FFD6DA09';

  var VISTAS = {
    comercial: { btn: 'exp-btn-comercial', titulo: 'Comercial' },
    contador:  { btn: 'exp-btn-contador',  titulo: 'Contador' },
    nivel:     { btn: 'exp-btn-nivel',     titulo: 'Nivel de Inglés' }
  };

  var E = {
    vista: '', init: null, formato: 'xlsx',
    cols: {}, anexo: [], filtros: {}, secciones: {},
    fechaCol: '', desde: '', hasta: '', rangoNum: { min: '', max: '' },
    heredado: []
  };

  function q(s, c) { return (c || document).querySelector(s); }
  function qq(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /* OJO: app.js declara `let currentUser`, y `let` NO crea propiedad en
     window. Hay que leerlo como IDENTIFICADOR del ámbito global; window
     queda solo de respaldo por si algún día se expone. */
  function usuario_() {
    try { if (typeof currentUser !== 'undefined' && currentUser) return currentUser; } catch (e) { /* aún no existe */ }
    return window.currentUser || null;
  }
  function rol_() { var u = usuario_(); return String((u && u.rol) || '').toUpperCase(); }
  function puede_() { return rol_() === 'DESARROLLADOR' || rol_() === 'SUPERUSUARIO'; }
  function uid_() { var u = usuario_(); return (u && u.id) || ''; }

  /* ------------------------------------------------------------------
     BOTONES DE LA CABECERA
     ------------------------------------------------------------------ */
  function pintarBotones_() {
    Object.keys(VISTAS).forEach(function (v) {
      var b = document.getElementById(VISTAS[v].btn);
      if (!b) return;
      b.style.display = puede_() ? '' : 'none';
      if (!b.getAttribute('data-exp')) {
        b.setAttribute('data-exp', '1');
        b.addEventListener('click', function () { abrir_(v); });
      }
    });
  }
  document.addEventListener('click', function () { setTimeout(pintarBotones_, 0); }, true);
  document.addEventListener('DOMContentLoaded', pintarBotones_);
  setTimeout(pintarBotones_, 800);

  /* ------------------------------------------------------------------
     FILTROS QUE YA ESTÁN EN PANTALLA
     ------------------------------------------------------------------
     Solo se hereda lo que corresponde 1 a 1 con una columna de la hoja.
     La "etapa" del Contador se calcula, no es una columna: no se hereda. */
  function pantalla_(vista) {
    var out = {};
    try {
      if (vista === 'comercial' && typeof COM !== 'undefined' && COM) {
        if (COM.filtroAsesor && COM.filtroAsesor !== '__ALL__') out.ASESOR = [limpio_(COM.filtroAsesor)];
        if (COM.filtroPrograma && COM.filtroPrograma !== '__ALL__') out.PROGRAMA = [limpio_(COM.filtroPrograma)];
        if (COM.filtroEstado && COM.filtroEstado !== '__ALL__') out.ESTADO = [COM.filtroEstado];
      } else if (vista === 'contador' && typeof CONTA !== 'undefined' && CONTA) {
        if (CONTA.filtroAsesor && CONTA.filtroAsesor !== '__ALL__') out.ASESOR = [limpio_(CONTA.filtroAsesor)];
        if (CONTA.filtroPlan && CONTA.filtroPlan !== '__ALL__') out.TIPO_PLAN = [limpio_(CONTA.filtroPlan)];
      } else if (vista === 'nivel' && typeof NIVE !== 'undefined' && NIVE) {
        if (NIVE.filtroNivel && NIVE.filtroNivel !== '__ALL__') out.NIVEL = [limpio_(NIVE.filtroNivel)];
        if (NIVE.filtroEstado && NIVE.filtroEstado !== '__ALL__') out.GRUPO_RESULTADO = [NIVE.filtroEstado];
      }
    } catch (e) { /* si una vista no está cargada, no se hereda nada */ }
    return out;
  }
  /* Las etiquetas "— Sin asesor —" del tablero son el hueco de la hoja. */
  function limpio_(v) { return /^—\s*Sin/i.test(String(v)) ? '(vacío)' : String(v); }

  /* ------------------------------------------------------------------
     MODAL
     ------------------------------------------------------------------ */
  function montar_() {
    if (document.getElementById('exp-modal')) return;
    var d = document.createElement('div');
    d.id = 'exp-modal';
    d.className = 'modal-overlay hidden';
    d.innerHTML =
      '<div class="modal-card modal-card--xl exp-card" role="dialog" aria-modal="true" aria-labelledby="exp-title">' +
        '<div class="modal-head">' +
          '<div><h2 id="exp-title">Exportar</h2><div id="exp-sub" class="conta-sub"></div></div>' +
          '<button id="exp-close" class="modal-x" aria-label="Cerrar">✕</button>' +
        '</div>' +
        '<div class="modal-body" id="exp-body"></div>' +
        '<div class="modal-foot exp-foot">' +
          '<div class="exp-live" id="exp-live" aria-live="polite"></div>' +
          '<button id="exp-cancel" class="btn btn-ghost">Cancelar</button>' +
          '<button id="exp-go" class="btn btn-primary">⬇ Exportar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(d);
    q('#exp-close').addEventListener('click', cerrar_);
    q('#exp-cancel').addEventListener('click', cerrar_);
    q('#exp-go').addEventListener('click', exportar_);
    d.addEventListener('click', function (ev) { if (ev.target === d) cerrar_(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !d.classList.contains('hidden')) cerrar_();
    });
  }

  function cerrar_() { var m = document.getElementById('exp-modal'); if (m) m.classList.add('hidden'); }

  async function abrir_(vista) {
    if (!puede_()) {
      Swal.fire({ icon: 'warning', title: 'Sin permiso', text: 'Exportar es solo para SUPERUSUARIO y DESARROLLADOR.' });
      return;
    }
    montar_();
    E.vista = vista;
    E.init = null;
    q('#exp-title').textContent = 'Exportar · ' + VISTAS[vista].titulo;
    q('#exp-sub').textContent = 'Preparando las opciones…';
    q('#exp-body').innerHTML = '';
    q('#exp-live').textContent = '';
    document.getElementById('exp-modal').classList.remove('hidden');

    var d;
    try {
      d = await apiGet('exportInit', { usuarioId: uid_(), vista: vista });
    } catch (e) {
      cerrar_();
      Swal.fire({ icon: 'error', title: 'No se pudo preparar la exportación', text: String(e && e.message ? e.message : e) });
      return;
    }

    E.init = d;
    E.formato = 'xlsx';
    E.fechaCol = (d.fechas[0] && d.fechas[0].k) || '';
    E.desde = ''; E.hasta = '';
    E.rangoNum = { min: '', max: '' };
    E.secciones = {};
    (d.totales || []).forEach(function (t) { E.secciones['tot_' + t.k] = true; });
    E.secciones.anexo = true;

    var heredados = pantalla_(vista);
    E.filtros = {};
    E.heredado = [];
    (d.filtros || []).forEach(function (f) {
      if (heredados[f.k]) {
        var validos = heredados[f.k].filter(function (v) {
          return f.opciones.some(function (o) { return o.valor === v; });
        });
        if (validos.length) { E.filtros[f.k] = validos; E.heredado.push(f.label + ': ' + validos.join(', ')); }
      }
    });

    E.cols = {};
    var guardadas = recordadas_(vista, 'xlsx');
    var base = guardadas && guardadas.length ? guardadas : d.sugeridas;
    d.columnas.forEach(function (c) { E.cols[c.k] = base.indexOf(c.k) >= 0; });
    var anexoGuardado = recordadas_(vista, 'pdf');
    E.anexo = (anexoGuardado && anexoGuardado.length ? anexoGuardado : d.sugeridas).slice(0, d.anexoMax);

    q('#exp-sub').textContent = d.total + ' registros en la hoja · el archivo solo se descarga, no se guarda en Drive';
    pintar_();
  }

  /* ------------------------------------------------------------------
     MEMORIA DE COLUMNAS (por usuario y vista, en este navegador)
     ------------------------------------------------------------------ */
  function llave_(vista, formato) { return 'sepExpCols:' + uid_() + ':' + vista + ':' + formato; }
  function recordadas_(vista, formato) {
    try {
      var v = JSON.parse(localStorage.getItem(llave_(vista, formato)) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function recordar_(vista, formato, arr) {
    try { localStorage.setItem(llave_(vista, formato), JSON.stringify(arr)); } catch (e) { /* modo privado */ }
  }

  /* ------------------------------------------------------------------
     PINTAR EL MODAL
     ------------------------------------------------------------------ */
  function pintar_() {
    var d = E.init;
    if (!d) return;
    var h = [];

    /* Paso 1 — formato */
    h.push('<div class="exp-paso"><div class="exp-paso__t"><span class="exp-num">1</span> Formato</div>');
    h.push('<div class="exp-formatos">');
    h.push(tarjetaFormato_('xlsx', '📊', 'Excel (.xlsx)', 'Los datos, columna por columna. Hoja «Datos» con filtros y formato, más una hoja «Resumen».'));
    h.push(tarjetaFormato_('pdf', '📄', 'PDF (informe)', 'Portada con el rango y los filtros, totales con barras y un anexo de listado de hasta ' + d.anexoMax + ' columnas.'));
    h.push('</div></div>');

    /* Paso 2 — alcance */
    h.push('<div class="exp-paso"><div class="exp-paso__t"><span class="exp-num">2</span> Alcance</div>');
    if (E.heredado.length) {
      h.push('<div class="exp-hered">Heredado de lo que tienes en pantalla: <b>' + esc(E.heredado.join(' · ')) + '</b>' +
             ' <button type="button" class="exp-mini" id="exp-limpiar">Empezar desde cero</button></div>');
    }
    h.push('<div class="exp-campo"><label for="exp-fecha">Filtrar por fecha de</label>');
    h.push('<select id="exp-fecha" class="exp-sel"><option value="">— Sin filtro de fechas —</option>');
    var grupoAbierto = '';
    (d.fechas || []).forEach(function (f) {
      var g = f.grupo || '';
      if (g !== grupoAbierto) {
        if (grupoAbierto) h.push('</optgroup>');
        if (g) h.push('<optgroup label="' + esc(g) + '">');
        grupoAbierto = g;
      }
      h.push('<option value="' + esc(f.k) + '"' + (E.fechaCol === f.k ? ' selected' : '') + '>' +
             esc(f.label) + ' (' + f.conDatos + ')</option>');
    });
    if (grupoAbierto) h.push('</optgroup>');
    h.push('</select></div>');

    h.push('<div class="exp-atajos">');
    [['hoy', 'Hoy'], ['7', '7 días'], ['mes', 'Este mes'], ['mes-1', 'Mes pasado'], ['todo', 'Todo']].forEach(function (a) {
      h.push('<button type="button" class="exp-chip exp-atajo" data-atajo="' + a[0] + '">' + a[1] + '</button>');
    });
    h.push('</div>');
    h.push('<div class="exp-fechas">' +
      '<label>Desde <input type="date" id="exp-desde" value="' + esc(E.desde) + '"></label>' +
      '<label>Hasta <input type="date" id="exp-hasta" value="' + esc(E.hasta) + '"></label></div>');

    if (d.rangoNum) {
      h.push('<div class="exp-fechas"><label>' + esc(d.rangoNum.label) + ' desde ' +
        '<input type="number" step="0.01" min="' + d.rangoNum.min + '" max="' + d.rangoNum.max + '" id="exp-nmin" value="' + esc(E.rangoNum.min) + '"></label>' +
        '<label>hasta <input type="number" step="0.01" min="' + d.rangoNum.min + '" max="' + d.rangoNum.max + '" id="exp-nmax" value="' + esc(E.rangoNum.max) + '"></label></div>');
    }

    (d.filtros || []).forEach(function (f) {
      var sel = E.filtros[f.k] || [];
      h.push('<div class="exp-filtro"><div class="exp-filtro__t">' + esc(f.label) +
             '<span class="exp-cuenta">' + (sel.length ? sel.length + ' seleccionados' : 'todos') + '</span></div>');
      h.push('<div class="exp-chips">');
      f.opciones.forEach(function (o) {
        h.push('<button type="button" class="exp-chip' + (sel.indexOf(o.valor) >= 0 ? ' on' : '') +
               '" data-filtro="' + esc(f.k) + '" data-valor="' + esc(o.valor) + '">' +
               esc(o.label) + ' <i>' + o.n + '</i></button>');
      });
      h.push('</div></div>');
    });
    h.push('</div>');

    /* Paso 3 — columnas o secciones */
    h.push('<div class="exp-paso"><div class="exp-paso__t"><span class="exp-num">3</span> ' +
           (E.formato === 'xlsx' ? 'Columnas del Excel' : 'Contenido del informe') + '</div>');

    if (E.formato === 'xlsx') {
      h.push('<div class="exp-atajos">' +
        '<button type="button" class="exp-chip" data-preset="todas">Todas</button>' +
        '<button type="button" class="exp-chip" data-preset="datos">Solo con datos</button>' +
        '<button type="button" class="exp-chip" data-preset="basicas">Básicas</button>' +
        '<button type="button" class="exp-chip" data-preset="ninguna">Ninguna</button></div>');
      var grupos = [];
      d.columnas.forEach(function (c) { if (grupos.indexOf(c.grupo) < 0) grupos.push(c.grupo); });
      grupos.forEach(function (g) {
        h.push('<div class="exp-filtro"><div class="exp-filtro__t">' + esc(g) + '</div><div class="exp-chips">');
        d.columnas.filter(function (c) { return c.grupo === g; }).forEach(function (c) {
          h.push('<button type="button" class="exp-chip' + (E.cols[c.k] ? ' on' : '') +
                 (c.conDatos ? '' : ' vacia') + '" data-expcol="' + esc(c.k) + '" title="' + esc(c.k) + '">' +
                 esc(c.label) + ' <i>' + (c.conDatos ? c.conDatos : 'sin datos') + '</i></button>');
        });
        h.push('</div></div>');
      });
    } else {
      h.push('<div class="exp-filtro"><div class="exp-filtro__t">Secciones</div><div class="exp-chips">');
      (d.totales || []).forEach(function (t) {
        h.push('<button type="button" class="exp-chip' + (E.secciones['tot_' + t.k] !== false ? ' on' : '') +
               '" data-sec="tot_' + esc(t.k) + '">' + esc(t.label) + '</button>');
      });
      h.push('<button type="button" class="exp-chip' + (E.secciones.anexo !== false ? ' on' : '') +
             '" data-sec="anexo">Anexo de listado</button>');
      h.push('</div></div>');
      h.push('<div class="exp-filtro"><div class="exp-filtro__t">Columnas del anexo' +
             '<span class="exp-cuenta" id="exp-anexo-n">' + E.anexo.length + ' de ' + d.anexoMax + '</span></div><div class="exp-chips">');
      d.columnas.forEach(function (c) {
        h.push('<button type="button" class="exp-chip' + (E.anexo.indexOf(c.k) >= 0 ? ' on' : '') +
               (c.conDatos ? '' : ' vacia') + '" data-anexo="' + esc(c.k) + '">' + esc(c.label) + '</button>');
      });
      h.push('</div></div>');
    }
    h.push('</div>');

    q('#exp-body').innerHTML = h.join('');
    cablear_();
    contar_();
  }

  function tarjetaFormato_(k, ic, tit, txt) {
    return '<button type="button" class="exp-fmt' + (E.formato === k ? ' on' : '') + '" data-fmt="' + k + '">' +
      '<div class="exp-fmt__ic">' + ic + '</div><div><b>' + tit + '</b><span>' + txt + '</span></div></button>';
  }

  function cablear_() {
    /* OJO: todo se busca DENTRO del modal. La app ya usa data-col en la
       rueda de fechas de iOS, y un selector suelto cablearía botones
       que no son de aquí. */
    var raiz = document.getElementById('exp-modal');
    function qqm(sel) { return qq(sel, raiz); }
    qqm('[data-fmt]').forEach(function (b) {
      b.addEventListener('click', function () { E.formato = b.getAttribute('data-fmt'); pintar_(); });
    });
    var lim = q('#exp-limpiar');
    if (lim) lim.addEventListener('click', function () { E.filtros = {}; E.heredado = []; pintar_(); });

    var f = q('#exp-fecha');
    if (f) f.addEventListener('change', function () { E.fechaCol = f.value; contar_(); });
    ['desde', 'hasta'].forEach(function (k) {
      var el = q('#exp-' + k);
      if (el) el.addEventListener('change', function () { E[k] = el.value; contar_(); });
    });
    ['nmin', 'nmax'].forEach(function (k) {
      var el = q('#exp-' + k);
      if (el) el.addEventListener('change', function () {
        E.rangoNum[k === 'nmin' ? 'min' : 'max'] = el.value; contar_();
      });
    });
    qqm('[data-atajo]').forEach(function (b) {
      b.addEventListener('click', function () { atajo_(b.getAttribute('data-atajo')); });
    });
    qqm('[data-filtro]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-filtro'), v = b.getAttribute('data-valor');
        var arr = E.filtros[k] || [];
        var i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1); else arr.push(v);
        E.filtros[k] = arr;
        b.classList.toggle('on');
        var cont = b.parentNode.parentNode.querySelector('.exp-cuenta');
        if (cont) cont.textContent = arr.length ? arr.length + ' seleccionados' : 'todos';
        contar_();
      });
    });
    qqm('[data-expcol]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-expcol');
        E.cols[k] = !E.cols[k];
        b.classList.toggle('on');
        contar_();
      });
    });
    qqm('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () { preset_(b.getAttribute('data-preset')); });
    });
    qqm('[data-sec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sec');
        E.secciones[k] = E.secciones[k] === false;
        b.classList.toggle('on');
        contar_();   // quitar el anexo cambia el aviso de páginas
      });
    });
    qqm('[data-anexo]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-anexo');
        var i = E.anexo.indexOf(k);
        if (i >= 0) E.anexo.splice(i, 1);
        else {
          if (E.anexo.length >= E.init.anexoMax) {
            Swal.fire({ icon: 'info', title: 'Tope del anexo',
              text: 'El anexo del PDF admite máximo ' + E.init.anexoMax + ' columnas. Quita una para poder añadir otra.' });
            return;
          }
          E.anexo.push(k);
        }
        b.classList.toggle('on');
        var n = q('#exp-anexo-n');
        if (n) n.textContent = E.anexo.length + ' de ' + E.init.anexoMax;
        contar_();
      });
    });
  }

  function preset_(p) {
    var d = E.init;
    d.columnas.forEach(function (c) {
      if (p === 'todas') E.cols[c.k] = true;
      else if (p === 'ninguna') E.cols[c.k] = false;
      else if (p === 'datos') E.cols[c.k] = c.conDatos > 0;
      else if (p === 'basicas') E.cols[c.k] = d.sugeridas.indexOf(c.k) >= 0;
    });
    pintar_();
  }

  function iso_(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function atajo_(a) {
    var hoy = new Date();
    if (a === 'todo') { E.desde = ''; E.hasta = ''; }
    else if (a === 'hoy') { E.desde = iso_(hoy); E.hasta = iso_(hoy); }
    else if (a === '7') { var d7 = new Date(hoy.getTime() - 6 * 864e5); E.desde = iso_(d7); E.hasta = iso_(hoy); }
    else if (a === 'mes') {
      E.desde = iso_(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); E.hasta = iso_(hoy);
    } else if (a === 'mes-1') {
      E.desde = iso_(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
      E.hasta = iso_(new Date(hoy.getFullYear(), hoy.getMonth(), 0));
    }
    if (q('#exp-desde')) q('#exp-desde').value = E.desde;
    if (q('#exp-hasta')) q('#exp-hasta').value = E.hasta;
    contar_();
  }

  /* ------------------------------------------------------------------
     CONTADOR EN VIVO (con el índice liviano, sin volver al servidor)
     ------------------------------------------------------------------ */
  function cuantas_() {
    var d = E.init;
    if (!d || !d.indice) return 0;
    var idx = d.indice;
    var iFecha = E.fechaCol ? idx.fechas.indexOf(E.fechaCol) : -1;
    var base = idx.filtros.length;
    var nCol = idx.rangoNum ? base + idx.fechas.length : -1;
    var n = 0;
    for (var i = 0; i < idx.filas.length; i++) {
      var fila = idx.filas[i], ok = true;
      if (E.fechaCol && (E.desde || E.hasta)) {
        var v = iFecha >= 0 ? fila[base + iFecha] : '';
        if (!v) ok = false;
        else {
          if (E.desde && v < E.desde) ok = false;
          if (E.hasta && v > E.hasta) ok = false;
        }
      }
      if (ok) {
        for (var j = 0; j < idx.filtros.length; j++) {
          var sel = E.filtros[idx.filtros[j]];
          if (sel && sel.length && sel.indexOf(fila[j]) < 0) { ok = false; break; }
        }
      }
      if (ok && nCol >= 0 && (E.rangoNum.min !== '' || E.rangoNum.max !== '')) {
        var num = fila[nCol];
        if (num === '') ok = false;
        else {
          if (E.rangoNum.min !== '' && Number(num) < Number(E.rangoNum.min)) ok = false;
          if (E.rangoNum.max !== '' && Number(num) > Number(E.rangoNum.max)) ok = false;
        }
      }
      if (ok) n++;
    }
    return n;
  }

  function contar_() {
    var d = E.init;
    if (!d) return;
    var n = cuantas_();
    var cols = E.formato === 'xlsx'
      ? d.columnas.filter(function (c) { return E.cols[c.k]; }).length
      : E.anexo.length;
    var txt = n + ' de ' + d.total + ' registros · ' + cols + (E.formato === 'xlsx' ? ' columnas · Excel' : ' columnas en el anexo · PDF');
    /* Aviso de tamaño: un anexo de cientos de filas son muchas páginas
       y el informe tarda en generarse. Mejor decirlo antes. */
    if (E.formato === 'pdf' && E.secciones.anexo !== false && n > 300) {
      txt += ' · ⚠️ el anexo saldrá con unas ' + (Math.ceil(n / 45) + 2) + ' páginas';
    }
    var live = q('#exp-live');
    if (live) live.textContent = txt;
    var go = q('#exp-go');
    if (go) go.disabled = (n === 0) || (E.formato === 'xlsx' && cols === 0);
  }

  /* ------------------------------------------------------------------
     CUERPO QUE VIAJA AL BACKEND
     ------------------------------------------------------------------ */
  function cuerpo_() {
    var filtros = {};
    Object.keys(E.filtros).forEach(function (k) { if (E.filtros[k] && E.filtros[k].length) filtros[k] = E.filtros[k]; });
    return {
      usuarioId: uid_(), vista: E.vista,
      fechaCol: E.fechaCol, desde: E.desde, hasta: E.hasta,
      filtros: filtros,
      rangoNum: { min: E.rangoNum.min, max: E.rangoNum.max }
    };
  }

  /* ------------------------------------------------------------------
     EXPORTAR
     ------------------------------------------------------------------ */
  async function exportar_() {
    var go = q('#exp-go');
    var textoOriginal = go.textContent;
    go.disabled = true;
    go.textContent = '⏳ Generando…';
    try {
      if (E.formato === 'xlsx') await excel_();
      else await pdf_();
      cerrar_();
      Swal.fire({ icon: 'success', title: 'Archivo descargado', timer: 1400, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'No se pudo exportar', text: String(e && e.message ? e.message : e) });
    } finally {
      go.disabled = false;
      go.textContent = textoOriginal;
    }
  }

  function bajar_(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function cargarExcelJs_() {
    if (window.ExcelJS) return Promise.resolve();
    return new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = EXCELJS_CDN;
      s.onload = function () { window.ExcelJS ? ok() : mal(new Error('ExcelJS no cargó')); };
      s.onerror = function () { mal(new Error('No se pudo bajar la librería de Excel. Revisa la conexión.')); };
      document.head.appendChild(s);
    });
  }

  /* '@F2026-08-17T15:43:12' → Date. Cualquier otra cosa se deja igual. */
  function valorXls_(v) {
    if (typeof v === 'string' && v.substring(0, 2) === '@F') {
      var m = v.substring(2).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    }
    return v;
  }

  async function excel_() {
    var cols = E.init.columnas.filter(function (c) { return E.cols[c.k]; }).map(function (c) { return c.k; });
    if (!cols.length) throw new Error('Elige al menos una columna.');
    recordar_(E.vista, 'xlsx', cols);

    var body = cuerpo_();
    body.columnas = cols;
    var d = await apiPost('exportDatos', body);
    await cargarExcelJs_();

    var wb = new ExcelJS.Workbook();
    wb.creator = 'SEP GROUP';
    wb.created = new Date();

    var ws = wb.addWorksheet('Datos', {
      views: [{ state: 'frozen', ySplit: 1 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    ws.columns = d.encabezados.map(function (h) {
      return { header: h.label, key: h.k, width: anchoDe_(h) };
    });
    var cab = ws.getRow(1);
    cab.height = 24;
    cab.eachCell(function (c) {
      c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
      c.alignment = { vertical: 'middle', horizontal: 'left' };
      c.border = { bottom: { style: 'thick', color: { argb: LIMA } } };
    });

    d.filas.forEach(function (fila) {
      ws.addRow(fila.map(valorXls_));
    });

    d.encabezados.forEach(function (h, i) {
      var col = ws.getColumn(i + 1);
      if (h.tipo === 'fecha') col.numFmt = 'dd/mm/yyyy hh:mm';
      else if (h.tipo === 'moneda') col.numFmt = '#,##0';
      else if (h.tipo === 'telefono') col.numFmt = '@';
      col.font = { name: 'Arial', size: 10 };
    });
    ws.getRow(1).font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: d.encabezados.length } };

    /* Fila de totales de las columnas de dinero o numéricas. */
    var totales = d.encabezados.map(function (h, i) {
      if (h.tipo !== 'moneda') return i === 0 ? 'TOTAL' : '';
      var letra = ws.getColumn(i + 1).letter;
      return { formula: 'SUM(' + letra + '2:' + letra + (d.filas.length + 1) + ')' };
    });
    if (d.filas.length) {
      var fT = ws.addRow(totales);
      fT.font = { name: 'Arial', bold: true };
      fT.eachCell(function (c) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6F9' } };
        c.border = { top: { style: 'medium', color: { argb: AZUL } } };
      });
    }

    hojaResumen_(wb, d);

    var buf = await wb.xlsx.writeBuffer();
    bajar_(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), d.nombre);
  }

  function anchoDe_(h) {
    if (h.tipo === 'fecha') return 19;
    if (h.tipo === 'url') return 34;
    if (h.tipo === 'moneda' || h.tipo === 'numero') return 14;
    if (h.tipo === 'telefono') return 15;
    return Math.min(34, Math.max(12, String(h.label).length + 4));
  }

  function hojaResumen_(wb, d) {
    var r = d.resumen;
    var ws = wb.addWorksheet('Resumen');
    ws.columns = [{ width: 34 }, { width: 26 }, { width: 14 }, { width: 12 }];

    function titulo(t) {
      var f = ws.addRow([t]);
      f.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      f.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
      ws.mergeCells(f.number, 1, f.number, 4);
      f.height = 20;
    }
    function par(k, v) {
      var f = ws.addRow([k, v]);
      f.getCell(1).font = { name: 'Arial', color: { argb: 'FF8893A4' } };
      f.getCell(2).font = { name: 'Arial', bold: true };
    }

    titulo('SEP GROUP · ' + d.titulo);
    par('Generado', r.generado + '  ·  ' + r.por);
    par('Registros exportados', r.registros);
    par('Rango', (r.desde || r.hasta)
      ? (r.fechaLabel || 'Fecha') + ': ' + (r.desde || 'inicio') + ' — ' + (r.hasta || 'hoy')
      : 'Sin filtro de fechas');
    (r.filtros || []).forEach(function (f) { par(f.label, f.valores.join(', ')); });
    if (r.conversion) par(r.conversion.label, r.conversion.n + '  (' + r.conversion.pct + ' %)');
    ws.addRow([]);

    (r.dinero || []).forEach(function (m, i) {
      if (!i) titulo('Totales de dinero');
      var f = ws.addRow([m.label, m.suma, m.filas + ' registros']);
      f.getCell(2).numFmt = m.moneda === 'USD' ? '"US$" #,##0.00' : '"$" #,##0';
      f.getCell(2).font = { name: 'Arial', bold: true };
    });
    if ((r.dinero || []).length) ws.addRow([]);

    (r.totales || []).forEach(function (t) {
      if (!t.filas.length) return;
      titulo(t.label);
      t.filas.forEach(function (x) {
        var f = ws.addRow([x.valor, x.n, r.registros ? x.n / r.registros : 0]);
        f.getCell(3).numFmt = '0.0%';
      });
      ws.addRow([]);
    });
  }

  async function pdf_() {
    if (!E.anexo.length && E.secciones.anexo !== false) E.secciones.anexo = false;
    recordar_(E.vista, 'pdf', E.anexo);
    var body = cuerpo_();
    body.anexo = E.anexo;
    body.secciones = E.secciones;
    var d = await apiPost('exportPdf', body);
    var bin = atob(d.pdf);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    bajar_(new Blob([bytes], { type: 'application/pdf' }), d.nombre);
  }

  /* Se expone para las pruebas y para poder abrirlo desde otro sitio. */
  window.SEPExportar = { abrir: abrir_, botones: pintarBotones_, _E: E, _cuantas: cuantas_ };
})();
