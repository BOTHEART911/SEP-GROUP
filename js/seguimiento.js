/* =============================================================
 * SEP GROUP — SEGUIMIENTO DEL PARTICIPANTE (Fase 5 · Subfase 5.4 · Entrega A)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula
 * la garantía de funcionamiento.
 * ------------------------------------------------------------
 * QUÉ ES (pliego 5.4.1 a 5.4.4 + respuesta 7 de Javier)
 *   Módulo principal "Seguimiento", visible para todos los roles. Ver
 *   sin abrir a nadie dónde está cada participante (estado), qué debe
 *   hacer (acción futura), qué completó y qué le falta (27 hitos en 8
 *   bloques). Los hitos NO se editan aquí: llegan de su módulo fuente
 *   (SegParticipante.gs). No confundir con el seguimiento COMERCIAL de
 *   leads.
 *
 * RENDIMIENTO (reglas de la casa)
 *   · Una vista, un viaje (seguimientoInit: catálogo + lista, fmt=2 +
 *     gzip + diccionario de textos repetidos).
 *   · Carga única por sesión; año, filtros y búsqueda son locales.
 *   · La tabla se pinta por tandas (80 filas y luego al hacer scroll):
 *     452 participantes × 37 columnas no bloquean la pantalla.
 *   · La lectura se corta al salir (AbortController). Respuesta de una
 *     sesión vieja nunca pisa la nueva. Tiempos en window.__sepMed.
 *
 * ENTREGA B (08/10/2026) — pliego 5.4.6 y 5.4.7:
 *   · Detalle: la cabecera se pinta al instante con la fila; el
 *     HISTORIAL (línea de tiempo) y la SINCRONIZACIÓN del participante
 *     llegan de fondo en UN viaje (seguimientoDetalle), se recuerdan en
 *     la sesión y la lectura se corta al cerrar el detalle o salir.
 *   · Botón "Sincronización" (cabecera): de dónde sale cada dato (viene
 *     en el catálogo, se pinta al instante) + verificador de desfases
 *     de solo lectura (seguimientoSincronizacion, a pedido).
 *
 * ENTREGA C (08/10/2026) — Estadísticas (js/estadisticas.js) usa ESTA
 *   misma carga: cargarSeguimiento_ avisa a estAlCargar_ y la lectura no
 *   se corta al pasar entre Seguimiento y Estadísticas (herencia). Un
 *   indicador abre Seguimiento con SEG.esp = { l, ids } (lista exacta).
 *
 * Usa de app.js: apiGet, showView, esc_, currentUser, estPartCargar_,
 * EST_PART, procesoChipHtml_; de temporada.js: TEMP.
 * ============================================================= */

const SEG = {
  todos: [], registros: [], catalogo: null, cargado: false, cargando: false,
  ctrl: null, texto: '', filtros: {}, pintadas: 0, lista: [], obs: null,
  /* 5.4-B — detalle (historial + sincronización) y verificador global.
     Recuerdo por sesión; se limpia al Actualizar. */
  det: {}, detCtrl: null, detN: null, detTab: 'hist', detBloque: '',
  sinc: null, sincCtrl: null, sincTipo: '',
  /* 5.4-C — lista exacta que llega de un indicador de Estadísticas. */
  esp: null
};
const SEG_TANDA = 24;   /* 5.5-A — tarjetas: tandas de 24 al hacer scroll */
const SEG_SIN = '— Sin dato —';

function segTxt_(v) { return String(v == null ? '' : v).trim(); }
function segQ_(s) { return document.querySelector(s); }
function segMed_(ruta, t0) {
  try {
    const ms = Date.now() - t0;
    (window.__sepMed = window.__sepMed || []).push({ ruta: ruta, ms: ms, t: Date.now() });
    if (window.console) console.info('[med] ' + ruta + ' ' + ms + ' ms');
  } catch (_) {}
}
function segAbortado_(e) { return !!(e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')))); }
function segNorm_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

/* Deshace el diccionario del servidor: cada campo de SPT_DIC llega como
   posición en catalogo.dic[campo]. */
function segDecodificar_(regs, dic) {
  const ks = Object.keys(dic || {});
  if (!ks.length) return regs || [];
  return (regs || []).map(r => {
    ks.forEach(k => { if (r[k] !== undefined && r[k] !== null && typeof r[k] === 'number') r[k] = dic[k][r[k]]; });
    return r;
  });
}

/* ============================================================
   ENTRADA
   ============================================================ */
function abrirSeguimiento_() {
  showView('seguimiento');                 // navegación primero
  if (SEG.cargado) { segPintarTodo_(); return; }
  if (!SEG.cargando) cargarSeguimiento_();
}

async function cargarSeguimiento_() {
  SEG.cargando = true;
  try { SEG.ctrl && SEG.ctrl.abort(); } catch (_) {}
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  SEG.ctrl = ctrl;
  const quien = currentUser && currentUser.id;
  const t0 = Date.now();
  try {
    const d = await apiGet('seguimientoInit', { usuarioId: quien }, ctrl ? { signal: ctrl.signal } : {});
    if (!currentUser || currentUser.id !== quien) return;          // sesión vieja
    segMed_('seguimientoInit', t0);
    SEG.catalogo = d.catalogo || {};
    if (typeof estPartCargar_ === 'function') estPartCargar_(SEG.catalogo.estadosPart);
    if (typeof TEMP !== 'undefined') { TEMP.set(d.temporadas); TEMP.montar('seguimiento'); }
    SEG.todos = segDecodificar_(d.registros || [], SEG.catalogo.dic);
    SEG.registros = (typeof TEMP !== 'undefined') ? TEMP.filtrar(SEG.todos) : SEG.todos.slice();
    SEG.cargado = true;
    /* 5.4-C — si la carga la pidió Estadísticas, la tabla se pinta al
       entrar a Seguimiento (abrirSeguimiento_), no antes. */
    const vSeg = document.getElementById('view-seguimiento');
    if (!vSeg || vSeg.classList.contains('active')) { segPintarTodo_(); segMed_('seguimientoPintado', t0); }
    if (typeof estAlCargar_ === 'function') estAlCargar_();          // 5.4-C — misma carga
  } catch (e) {
    if (segAbortado_(e)) return;
    if (typeof estAlError_ === 'function') estAlError_(String(e.message || e));
    Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: String(e.message || e) });
  } finally {
    if (SEG.ctrl === ctrl) { SEG.ctrl = null; SEG.cargando = false; }
  }
}

function recargarSeguimiento_() { SEG.cargado = false; SEG.det = {}; SEG.sinc = null; cargarSeguimiento_(); }

function segSalir_() {
  try { SEG.ctrl && SEG.ctrl.abort(); } catch (_) {}
  SEG.ctrl = null; SEG.cargando = false;
  try { SEG.obs && SEG.obs.disconnect(); } catch (_) {}
  segCortarDet_(); segCortarSinc_();
}

if (typeof TEMP !== 'undefined') {
  TEMP.alCambiar(() => {
    if (!SEG.cargado) return;
    SEG.registros = TEMP.filtrar(SEG.todos);
    try { segPintarTodo_(); } catch (e) { console.error(e); }
  });
}

/* ============================================================
   HITOS
   ============================================================ */
const SEG_VAL = {
  '1': { c: 'ok',   ic: '✓', t: 'Cumplido' },
  'p': { c: 'proc', ic: '◐', t: 'En proceso' },
  'x': { c: 'no',   ic: '✕', t: 'No cumplido' },
  '0': { c: 'pend', ic: '',  t: 'Pendiente' },
  '-': { c: 'na',   ic: '–', t: 'No aplica' }
};
function segHitos_() { return (SEG.catalogo && SEG.catalogo.hitos) || []; }
function segBloques_() { return (SEG.catalogo && SEG.catalogo.bloques) || []; }
function segHito_(r, i) { return (r.h || '').charAt(i) || '0'; }
function segAvance_(r) {
  const h = r.h || ''; let si = 0, de = 0;
  for (let i = 0; i < h.length; i++) { if (h[i] === '-') continue; de++; if (h[i] === '1') si++; }
  return de ? Math.round(si * 100 / de) : 0;
}

/* ============================================================
   FILTROS (todos locales, combinados con Y)
   ============================================================ */
function segEst_(r) { return (typeof EST_PART !== 'undefined' && r.est) ? EST_PART.porClave[r.est] : null; }
function segRifa_(r) {
  const i = segHitos_().findIndex(h => h.k === 'RIFA');
  const v = i >= 0 ? segHito_(r, i) : '-';
  return v === '1' ? 'Elegible' : (v === 'x' ? 'No elegible' : (v === '0' ? 'Pendiente de vuelo' : SEG_SIN));
}
const SEG_PILLS = [
  { k: 'ase',  ic: '👤', color: '#2563eb', all: 'Asesor',  tit: 'Asesor comercial',        v: r => segTxt_(r.ase) || SEG_SIN },
  { k: 'aseP', ic: '🧭', color: '#7c3aed', all: 'Asesor procesos',  tit: 'Asesor de Procesos',      v: r => segTxt_(r.aseP) || SEG_SIN },
  { k: 'est',  ic: '📍', color: '#0f766e', all: 'Estado',   tit: 'Estado actual',           v: r => { const e = segEst_(r); return e ? e.nombre : 'Sin estado'; } },
  { k: 'acc',  ic: '➡️', color: '#0369a1', all: 'Acción futura',       tit: 'Acción futura',           v: r => { const e = segEst_(r); return e ? e.accion : SEG_SIN; } },
  { k: 'spo',  ic: '🏢', color: '#0d9488', all: 'Sponsor',  tit: 'Sponsor',                 v: r => segTxt_(r.spo) || SEG_SIN },
  { k: 'emp',  ic: '💼', color: '#1d4ed8', all: 'Empleador',           tit: 'Empleador',               v: r => segTxt_(r.emp) || SEG_SIN },
  { k: 'plan', ic: '🎯', color: '#b45309', all: 'Plan',   tit: 'Plan del programa',       v: r => segTxt_(r.plan) || SEG_SIN },
  { k: 'niv',  ic: '🗣️', color: '#0891b2', all: 'Nivel inglés',     tit: 'Nivel de Inglés',         v: r => segTxt_(r.niv) || 'Sin test' },
  { k: 'pro',  ic: '🔖', color: '#475569', all: 'Proceso',             tit: 'Proceso',                 v: r => r.ret ? 'Retirado' : (segTxt_(r.pro) || SEG_SIN) },
  { k: 'rifa', ic: '🎟️', color: '#c026d3', all: 'Rifa 72 h',           tit: 'Elegible para rifa',      v: segRifa_ }
];
function segPill_(k) { return SEG_PILLS.find(p => p.k === k); }

/* Base con TODOS los filtros menos `salvo` (para contar opciones). */
function segBase_(salvo) {
  let l = SEG.registros;
  if (SEG.esp && SEG.esp.set) l = l.filter(r => SEG.esp.set.has(Number(r.n)));
  SEG_PILLS.forEach(p => {
    if (p.k === salvo) return;
    const val = SEG.filtros[p.k];
    if (val === undefined) return;
    l = l.filter(r => p.v(r) === val);
  });
  return l;
}
function segVisibles_() {
  let l = segBase_(null);
  const q = segNorm_(SEG.texto.trim());
  if (q) l = l.filter(r =>
    segNorm_(r.nom + ' ' + r.ape).includes(q) || String(r.doc || '').includes(q) ||
    String(r.tel || '').includes(q) || segNorm_(r.cor).includes(q) || String(r.n) === q ||
    segNorm_(r.emp).includes(q) || segNorm_(r.spo).includes(q));
  return l;
}
function segOpciones_(k) {
  const p = segPill_(k), c = {};
  segBase_(k).forEach(r => { const v = p.v(r); c[v] = (c[v] || 0) + 1; });
  return Object.keys(c).sort((a, b) => a.localeCompare(b)).map(v => ({ valor: v, count: c[v] }));
}

/* Entrega C (Estadísticas): abrir Seguimiento ya filtrado. `esp` =
   { l: 'etiqueta', ids: [n…] } — la lista exacta del indicador. */
function segAbrirFiltrado_(filtros, esp) {
  SEG.filtros = Object.assign({}, filtros || {});
  SEG.esp = (esp && Array.isArray(esp.ids)) ? { l: String(esp.l || 'Estadísticas'), set: new Set(esp.ids.map(Number)) } : null;
  SEG.texto = ''; const s = segQ_('#seg-search'); if (s) s.value = '';
  abrirSeguimiento_();
}

/* ============================================================
   PINTADO
   ============================================================ */
function segPintarTodo_() { segPintarPills_(); segPintarLeyenda_(); segPintarTabla_(); }

function segPintarPills_() {
  const cont = segQ_('#seg-filters'); if (!cont) return;
  const activos = Object.keys(SEG.filtros).length + (SEG.esp ? 1 : 0);
  cont.innerHTML = (SEG.esp ? `<button class="fpill is-on seg-esp" data-seg-esp-quitar style="--fp:#be123c" title="Viene de Estadísticas. Toca para quitar esta lista.">
      <span class="fpill__ic">📊</span><span class="fpill__label">${esc_(SEG.esp.l)} (${SEG.esp.set.size})</span><span aria-hidden="true">✕</span></button>` : '') +
    SEG_PILLS.map(f => {
    const val = SEG.filtros[f.k], on = val !== undefined;
    return `<button class="fpill ${on ? 'is-on' : ''}" data-segp="${f.k}" style="--fp:${f.color}" aria-haspopup="dialog"
        title="${esc_(f.tit)}">
      <span class="fpill__ic">${f.ic}</span><span class="fpill__label">${esc_(on ? val : f.all)}</span>
      <svg class="fpill__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>`;
  }).join('') + (activos ? `<button class="fpill seg-limpiar" data-seg-limpiar>✕ Limpiar filtros (${activos})</button>` : '');
}

function segPintarLeyenda_() {
  const c = segQ_('#seg-leyenda'); if (!c || c.dataset.ok) return;
  c.dataset.ok = '1';
  c.innerHTML = ['1', 'p', 'x', '0', '-'].map(v =>
    `<span class="seg-ley"><span class="seg-h seg-h--${SEG_VAL[v].c}">${SEG_VAL[v].ic}</span>${SEG_VAL[v].t}</span>`).join('') +
    '<span class="seg-ley seg-ley--nota">Los hitos se marcan solos desde su módulo. Cada tarjeta muestra los 8 bloques con su avance; pasa el mouse sobre un hito para ver de dónde sale.</span>';
}

function segAbrirSheet_(k) {
  const f = segPill_(k); if (!f) return;
  const sheet = segQ_('#seg-fsheet'), lista = segQ_('#seg-fsheet-list');
  if (!sheet || !lista) return;
  segQ_('#seg-fsheet-title').textContent = 'Filtrar por ' + f.tit;
  const actual = SEG.filtros[k];
  const total = segBase_(k).length;
  const opt = (valor, label, n, sel, all) => `<button class="fopt ${sel ? 'is-sel' : ''} ${all ? 'is-all' : ''}" data-valor="${esc_(valor)}"${all ? ' data-all="1"' : ''}>
      <span class="fopt__ic">${f.ic}</span><span class="fopt__label">${esc_(label)}</span>
      <span class="fopt__count">${n}</span><span class="fopt__check">✓</span></button>`;
  lista.innerHTML = opt('', f.all, total, actual === undefined, true) +
    segOpciones_(k).map(o => opt(o.valor, o.valor, o.count, actual === o.valor, false)).join('');
  lista.onclick = e => {
    const b = e.target.closest('.fopt'); if (!b) return;
    if (b.dataset.all) delete SEG.filtros[k]; else SEG.filtros[k] = b.dataset.valor;
    segCerrarSheet_(); segPintarPills_(); segPintarTabla_();
  };
  sheet.classList.remove('hidden'); sheet.setAttribute('aria-hidden', 'false');
}
function segCerrarSheet_() {
  const s = segQ_('#seg-fsheet'); if (!s) return;
  s.classList.add('hidden'); s.setAttribute('aria-hidden', 'true');
}

/* ---------- tarjetas (5.5-A: cero tablas) ----------
   Cada participante es una tarjeta del mismo lenguaje de Comercial y
   Contador (franja de color del estado, nombre, insignia, chips). Los 27
   hitos se leen SIN abrir el detalle: "ruta" de 8 bloques, cada uno con
   su avance n/total y sus hitos como chips con el código corto y el
   estado (✓ ◐ ✕ · –). Pintado por tandas al hacer scroll de la página. */
function segFecha_(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(segTxt_(s));
  return m ? (m[3] + '/' + m[2] + '/' + m[1].slice(2) + (m[4] && m[4] + m[5] !== '0000' ? ' ' + m[4] + ':' + m[5] : '')) : '';
}
function segEstadoHtml_(r) {
  const e = segEst_(r);
  if (!e) return '<span class="seg-sinest">Sin estado · falta el comprobante de inscripción</span>';
  const p = r.estPrev && EST_PART.porClave[r.estPrev];
  return `<span class="seg-est" style="--e:${esc_(e.color)}">${e.ic} ${esc_(e.nombre)}</span>` +
    (p ? `<span class="seg-prev">${r.est === 'INACTIVO' ? 'vuelve a' : 'estaba en'} ${esc_(p.nombre)}</span>` : '') +
    `<span class="seg-acc">➡️ ${esc_(e.accion)}</span>`;
}
/* Ruta de hitos: 8 bloques con su avance y los hitos como chips. */
function segRutaHtml_(r) {
  const hs = segHitos_();
  return '<div class="seg-ruta">' + segBloques_().map(b => {
    let si = 0, de = 0, neg = 0, proc = 0;
    const chips = [];
    hs.forEach((h, i) => {
      if (h.b !== b.k) return;
      const c = segHito_(r, i), v = SEG_VAL[c] || SEG_VAL['0'];
      if (c !== '-') { de++; if (c === '1') si++; else if (c === 'x') neg++; else if (c === 'p') proc++; }
      chips.push(`<span class="seg-hp seg-hp--${v.c}" title="${esc_(h.l + ': ' + v.t + ' · ' + h.f)}" aria-label="${esc_(h.l + ': ' + v.t)}"><i aria-hidden="true">${v.ic || '·'}</i>${esc_(h.c)}</span>`);
    });
    if (!chips.length) return '';
    const est = !de ? 'na' : (neg ? 'no' : (si === de ? 'ok' : (si || proc ? 'proc' : 'pend')));
    return `<div class="seg-blq seg-blq--${est}" style="--g:${b.color}">
      <div class="seg-blq__h"><span>${esc_(b.l)}</span><b>${de ? si + '/' + de : '—'}</b></div>
      <div class="seg-blq__hs">${chips.join('')}</div></div>`;
  }).join('') + '</div>';
}
function segCardHtml_(r) {
  const e = segEst_(r), av = segAvance_(r);
  const color = e ? e.color : '#94a3b8';
  const nombre = (r.nom + ' ' + r.ape).trim() || '(sin nombre)';
  const chip = (ic, v, tit) => v ? `<span title="${esc_(tit)}">${ic} ${esc_(v)}</span>` : '';
  return `<article class="com-card seg-card${r.ret ? ' seg-card--ret' : ''}" data-sn="${r.n}" style="--e:${esc_(color)}">
    <div class="com-card__stripe" style="background:${esc_(color)}"></div>
    <div class="com-card__top">
      <div class="com-card__head">
        <h3 class="com-card__name"><button class="seg-nom" data-seg-ver="${r.n}" title="Ver el detalle">${esc_(nombre)}</button></h3>
        <div class="seg-card__sub"><span class="com-card__id">N° ${r.n}</span>${r.anio ? `<span>📅 ${esc_(r.anio)}</span>` : ''}${r.act ? `<span title="Última actualización">🕒 ${esc_(segFecha_(r.act))}</span>` : ''}</div>
      </div>
      <div class="seg-ring" style="--p:${av}" role="img" aria-label="${av}% de los hitos que le aplican" title="${av}% de los hitos que le aplican"><b>${av}<small>%</small></b></div>
    </div>
    <div class="seg-estbox">${segEstadoHtml_(r)}</div>
    <div class="com-card__meta">
      ${chip('🪪', r.doc, 'Identificación')}${chip('📱', r.tel, 'Teléfono')}${chip('✉️', r.cor, 'Correo')}
      ${chip('👤', r.ase, 'Asesor comercial')}${chip('🧭', r.aseP, 'Asesor de Procesos')}
      ${r.niv ? `<span title="Nivel de Inglés">🗣️ ${esc_(r.niv)}${r.pun !== '' && r.pun != null ? ' · ' + esc_(r.pun) : ''}</span>` : ''}
      ${r.spo ? `<span title="${r.spoC ? 'Sin oferta: sponsor que registró el Contador' : 'Sponsor'}">🏢 ${esc_(r.spo)}${r.spoC ? ' <small>(Contador)</small>' : ''}</span>` : ''}
      ${chip('💼', r.emp, 'Empleador')}
      ${r.plan ? `<span class="seg-plan">🎯 ${esc_(r.plan)}</span>` : ''}
      ${typeof procesoChipHtml_ === 'function' ? procesoChipHtml_(r.pro, r.ret) : ''}
    </div>
    ${segRutaHtml_(r)}
    <div class="com-card__actions">
      <button class="act-btn act-ver" data-seg-ver="${r.n}">📋 Detalle</button>
      <button class="act-btn" data-seg-ver="${r.n}" data-seg-ir="hist">🕒 Historial</button>
      <button class="act-btn" data-seg-ver="${r.n}" data-seg-ir="sync">🔗 Sincronización</button>
    </div>
  </article>`;
}

function segPintarTabla_() {
  const cont = segQ_('#seg-cards'), vacio = segQ_('#seg-empty');
  if (!cont) return;
  const t0 = Date.now();
  try { SEG.obs && SEG.obs.disconnect(); } catch (_) {}
  const l = segVisibles_();
  SEG.lista = l; SEG.pintadas = 0;
  const cnt = segQ_('#seg-count');
  if (cnt) cnt.textContent = l.length + ' de ' + SEG.registros.length + ' participantes · ' + (typeof TEMP !== 'undefined' ? TEMP.etiqueta() : '');
  vacio?.classList.toggle('hidden', l.length > 0);
  cont.classList.toggle('hidden', !l.length);
  const mas = segQ_('#seg-mas');
  cont.innerHTML = '';
  if (mas) mas.innerHTML = '';
  if (!l.length) return;
  segTanda_();
  if (typeof IntersectionObserver === 'function' && mas) {
    SEG.obs = new IntersectionObserver(ent => { if (ent.some(x => x.isIntersecting)) segTanda_(); }, { rootMargin: '600px' });
    SEG.obs.observe(mas);
  }
  segMed_('seguimientoTarjetas', t0);
}
function segTanda_() {
  const cont = segQ_('#seg-cards'); if (!cont) return;
  const desde = SEG.pintadas, hasta = Math.min(SEG.lista.length, desde + SEG_TANDA);
  if (desde >= hasta) return;
  cont.insertAdjacentHTML('beforeend', SEG.lista.slice(desde, hasta).map(segCardHtml_).join(''));
  SEG.pintadas = hasta;
  const mas = segQ_('#seg-mas');
  if (mas) mas.innerHTML = hasta < SEG.lista.length
    ? `<button class="btn btn-ghost btn-sm" data-seg-mas>Ver ${Math.min(SEG_TANDA, SEG.lista.length - hasta)} más (${SEG.lista.length - hasta} restantes)</button>` : '';
}

/* ============================================================
   DETALLE — cabecera inmediata (la fila) + historial y
   sincronización de fondo (5.4-B, un viaje: seguimientoDetalle)
   ============================================================ */
function segColorBloque_(k) {
  const b = segBloques_().find(x => x.k === k) || ((SEG.catalogo && SEG.catalogo.bloqueEsp && SEG.catalogo.bloqueEsp.k === k) ? SEG.catalogo.bloqueEsp : null);
  return b ? b.color : '#64748b';
}
function segNombreBloque_(k) {
  const b = segBloques_().find(x => x.k === k) || ((SEG.catalogo && SEG.catalogo.bloqueEsp && SEG.catalogo.bloqueEsp.k === k) ? SEG.catalogo.bloqueEsp : null);
  return b ? b.l : k;
}
function segDesfDef_(k) { return ((SEG.catalogo && SEG.catalogo.desfasesDef) || []).find(d => d.k === k) || { k: k, l: k, n: 'media', c: '' }; }
const SEG_NIVEL = { alta: { t: 'Contradicción', c: '#dc2626' }, media: { t: 'Falta un dato', c: '#d97706' }, info: { t: 'Para revisar', c: '#2563eb' } };

function segHitosHtml_(r) {
  const hs = segHitos_(), bs = segBloques_();
  return bs.map(b => {
    const items = hs.map((h, i) => ({ h, i })).filter(x => x.h.b === b.k);
    if (!items.length) return '';
    return `<div class="seg-db" style="--g:${b.color}"><h4>${esc_(b.l)}</h4>${items.map(x => {
      const v = SEG_VAL[segHito_(r, x.i)] || SEG_VAL['0'];
      return `<div class="seg-di"><span class="seg-h seg-h--${v.c}">${v.ic}</span>
        <span class="seg-di__t">${esc_(x.h.l)}<small>${esc_(x.h.f)}</small></span>
        <span class="seg-di__v seg-di__v--${v.c}">${v.t}</span></div>`;
    }).join('')}</div>`;
  }).join('');
}

function segVerDetalle_(n, tab) {
  const r = SEG.todos.find(x => String(x.n) === String(n)); if (!r) return;
  SEG.detN = String(r.n); SEG.detTab = tab || 'hist'; SEG.detBloque = '';
  const mio = SEG.detN;
  const tabs = [['hist', '🕒 Historial'], ['hitos', '✅ Hitos'], ['sync', '🔗 Sincronización']];
  const html = `<div class="seg-det" data-seg-det="${r.n}">
    <div class="seg-det__cab">
      <div class="seg-det__nom">#${r.n} · ${esc_((r.nom + ' ' + r.ape).trim())}</div>
      <div class="seg-estbox">${segEstadoHtml_(r)}</div>
      <div class="seg-det__datos">
        <span>🪪 ${esc_(r.doc || '—')}</span><span>📱 ${esc_(r.tel || '—')}</span><span>✉️ ${esc_(r.cor || '—')}</span>
        <span>👤 ${esc_(r.ase || '—')}</span><span>🧭 ${esc_(r.aseP || '—')}</span>
        <span>🗣️ ${esc_(r.niv || 'Sin test')}${r.pun !== '' && r.pun != null ? ' (' + esc_(r.pun) + ')' : ''}</span>
        <span>🏢 ${esc_(r.spo || '—')}</span><span>💼 ${esc_(r.emp || '—')}</span>
        <span>🎯 ${esc_(r.plan || '—')}</span><span>🔖 ${esc_(r.ret ? 'Retirado' : (r.pro || '—'))}</span>
        <span>📅 ${esc_(r.anio || '—')}</span><span>🕒 ${esc_(segFecha_(r.act) || '—')}</span>
      </div>
      <div class="seg-bar seg-bar--det"><i style="width:${segAvance_(r)}%"></i></div>
      <small class="seg-muted">${segAvance_(r)}% de los hitos que le aplican</small>
    </div>
    <div class="seg-tabs" role="tablist">${tabs.map(t =>
      `<button class="seg-tab ${SEG.detTab === t[0] ? 'is-on' : ''}" role="tab" aria-selected="${SEG.detTab === t[0]}" data-seg-tab="${t[0]}">${t[1]}<span class="seg-tab__n" id="seg-tabn-${t[0]}"></span></button>`).join('')}</div>
    <div class="seg-panel ${SEG.detTab === 'hist' ? '' : 'hidden'}" data-seg-panel="hist" id="seg-p-hist"></div>
    <div class="seg-panel ${SEG.detTab === 'hitos' ? '' : 'hidden'}" data-seg-panel="hitos"><div class="seg-det__bloques">${segHitosHtml_(r)}</div></div>
    <div class="seg-panel ${SEG.detTab === 'sync' ? '' : 'hidden'}" data-seg-panel="sync" id="seg-p-sync"></div>
  </div>`;
  Swal.fire({ html: html, width: 860, showConfirmButton: false, showCloseButton: true,
              customClass: { popup: 'seg-pop' },
              didClose: () => { if (SEG.detN === mio) { segCortarDet_(); SEG.detN = null; } } });
  if (SEG.det[SEG.detN]) segPintarDet_(); else { segEsqueletoDet_(); segCargarDet_(SEG.detN); }
}

function segDetTab_(t) {
  SEG.detTab = t;
  document.querySelectorAll('[data-seg-tab]').forEach(b => {
    const on = b.dataset.segTab === t; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('[data-seg-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.segPanel !== t));
}

function segEsqueletoDet_() {
  const sk = n => Array.from({ length: n }, () => '<div class="seg-sk"><i></i><span></span></div>').join('');
  const h = segQ_('#seg-p-hist'), y = segQ_('#seg-p-sync');
  if (h) h.innerHTML = `<div class="seg-sks" aria-busy="true">${sk(5)}</div>`;
  if (y) y.innerHTML = segSkScards_(4);
}

/* Silueta con la forma de las tarjetas de sincronización (5.5-A). */
function segSkScards_(n) {
  return '<div class="seg-scards" aria-busy="true" aria-label="Cargando">' + Array.from({ length: n }, () =>
    '<div class="seg-scard seg-scard--sk"><span class="sep-sk sep-sk-l sep-sk-w60"></span><span class="sep-sk sep-sk-l tit sep-sk-w80"></span><span class="sep-sk sep-sk-l sep-sk-w45"></span></div>').join('') + '</div>';
}

function segCortarDet_() { try { SEG.detCtrl && SEG.detCtrl.abort(); } catch (_) {} SEG.detCtrl = null; }

async function segCargarDet_(n) {
  segCortarDet_();
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  SEG.detCtrl = ctrl;
  const quien = currentUser && currentUser.id;
  const t0 = Date.now();
  try {
    const d = await apiGet('seguimientoDetalle', { usuarioId: quien, n: n }, Object.assign({ silent: true }, ctrl ? { signal: ctrl.signal } : {}));
    if (!currentUser || currentUser.id !== quien) return;           // sesión vieja
    SEG.det[String(n)] = d;
    segMed_('seguimientoDetalle', t0);
    if (SEG.detN === String(n)) segPintarDet_();                    // sigue abierto el mismo
  } catch (e) {
    if (segAbortado_(e)) return;
    if (SEG.detN !== String(n)) return;
    const msg = `<div class="seg-err">No se pudo traer el historial: ${esc_(String(e.message || e))}
      <button class="btn btn-ghost btn-sm" data-seg-det-reintentar>Reintentar</button></div>`;
    ['#seg-p-hist', '#seg-p-sync'].forEach(id => { const el = segQ_(id); if (el) el.innerHTML = msg; });
  } finally { if (SEG.detCtrl === ctrl) SEG.detCtrl = null; }
}

function segPintarDet_() { segPintarHist_(); segPintarSyncDet_(); }

/* ---------- historial (línea de tiempo) ---------- */
function segDia_(f) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || '');
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  try { return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  catch (_) { return m[3] + '/' + m[2] + '/' + m[1]; }
}
function segHora_(f) { const m = / (\d{2}):(\d{2})$/.exec(f || ''); return m && m[1] + m[2] !== '0000' ? m[1] + ':' + m[2] : ''; }

function segPintarHist_() {
  const el = segQ_('#seg-p-hist'); const d = SEG.det[SEG.detN];
  if (!el || !d) return;
  const t0 = Date.now();
  const ev = d.historial || [];
  const n = segQ_('#seg-tabn-hist'); if (n) n.textContent = ev.length ? ' ' + ev.length : '';
  if (!ev.length) {
    el.innerHTML = '<div class="seg-vacio">Todavía no hay eventos: el participante no tiene comprobante de inscripción ni movimientos en las fuentes.</div>';
    return;
  }
  const bloques = [...new Set(ev.map(e => e.b))];
  const chips = `<div class="seg-hchips">
      <button class="seg-hchip ${!SEG.detBloque ? 'is-on' : ''}" data-seg-hb="">Todo <b>${ev.length}</b></button>
      ${bloques.map(b => `<button class="seg-hchip ${SEG.detBloque === b ? 'is-on' : ''}" data-seg-hb="${esc_(b)}" style="--g:${segColorBloque_(b)}">${esc_(segNombreBloque_(b))} <b>${ev.filter(e => e.b === b).length}</b></button>`).join('')}
    </div>`;
  const vis = SEG.detBloque ? ev.filter(e => e.b === SEG.detBloque) : ev;
  let html = '', dia = null;
  vis.forEach(e => {
    const dd = e.f ? segDia_(e.f) : 'Sin fecha registrada';
    if (dd !== dia) { html += (dia === null ? '' : '</ol>') + `<h5 class="seg-tl__dia">${esc_(dd)}</h5><ol class="seg-tl">`; dia = dd; }
    const meta = [segHora_(e.f), e.q ? 'por ' + e.q : '', e.o === 'P' ? 'participante' : ''].filter(Boolean).join(' · ');
    html += `<li class="seg-tl__ev ${e.neg ? 'is-neg' : ''} ${e.der ? 'is-der' : ''}" style="--g:${segColorBloque_(e.b)}">
        <span class="seg-tl__dot" aria-hidden="true"></span>
        <div class="seg-tl__c">
          <div class="seg-tl__t">${esc_(e.l)}${e.der ? ' <small class="seg-tag">calculado</small>' : ''}</div>
          ${e.d ? `<div class="seg-tl__d">${esc_(e.d)}</div>` : ''}
          <div class="seg-tl__m"><span class="seg-tl__b">${esc_(segNombreBloque_(e.b))}</span>${meta ? ' · ' + esc_(meta) : ''}</div>
        </div></li>`;
  });
  el.innerHTML = chips + html + '</ol>' +
    '<p class="seg-muted seg-nota">Línea de tiempo armada con las fechas que ya guarda cada módulo (no es una hoja aparte). Lo que su módulo no fecha sale en "Sin fecha registrada".</p>';
  segMed_('seguimientoHistorialPintado', t0);
}

/* ---------- sincronización del participante ---------- */
function segDesfChip_(k) {
  const def = segDesfDef_(k), nv = SEG_NIVEL[def.n] || SEG_NIVEL.media;
  return `<span class="seg-desf" style="--d:${nv.c}" title="${esc_(nv.t + ' · Se corrige en: ' + def.c)}">⚠️ ${esc_(def.l)}</span>`;
}
function segPintarSyncDet_() {
  const el = segQ_('#seg-p-sync'); const d = SEG.det[SEG.detN];
  if (!el || !d) return;
  const fu = (SEG.catalogo && SEG.catalogo.fuentes) || [];
  const al = (d.desfases || []).length;
  const n = segQ_('#seg-tabn-sync'); if (n) n.textContent = al ? ' ⚠️' + al : '';
  const val = {}; (d.sync || []).forEach(x => { val[x.k] = x; });
  const det = {}; (d.desfases || []).forEach(x => { det[x.k] = x.d; });
  el.innerHTML = `<div class="seg-sres ${al ? 'is-al' : 'is-ok'}">${al
      ? '⚠️ ' + al + (al === 1 ? ' dato no coincide' : ' datos no coinciden') + ' entre módulos. Se muestra dónde se corrige; aquí no se edita nada.'
      : '✅ Todas las fuentes de este participante coinciden.'}</div>
    <div class="seg-scards">
      ${fu.map(f => {
        const x = val[f.k] || {};
        return `<div class="seg-scard ${x.al && x.al.length ? 'is-al' : ''}">
          <div class="seg-scard__dato">${esc_(f.d)}</div>
          <div class="seg-scard__v">${esc_(x.v || '—')}</div>
          ${(x.al || []).map(k => '<div class="seg-scard__al">' + segDesfChip_(k) + (det[k] ? `<small class="seg-desf__d">${esc_(det[k])}</small>` : '') + '</div>').join('')}
          <div class="seg-scard__f"><span>📍 ${esc_(f.f)}</span><span class="seg-mono" title="Quién lo escribe: ${esc_(f.e)}">${esc_(f.h)}</span></div>
        </div>`;
      }).join('')}
    </div>`;
}

/* ============================================================
   SINCRONIZACIÓN GLOBAL (botón de la cabecera)
   ============================================================ */
function segCortarSinc_() { try { SEG.sincCtrl && SEG.sincCtrl.abort(); } catch (_) {} SEG.sincCtrl = null; }

function segAbrirSinc_() {
  if (!SEG.catalogo) return;
  const fu = SEG.catalogo.fuentes || [];
  const html = `<div class="seg-sinc">
    <h3 class="seg-sinc__h">🔗 De dónde sale cada dato</h3>
    <p class="seg-muted">Seguimiento y Estadísticas solo consultan estas fuentes; no guardan copias.</p>
    <div class="seg-scards">
      ${fu.map(f => `<div class="seg-scard">
        <div class="seg-scard__dato">${esc_(f.d)}</div>
        <div class="seg-scard__v">📍 ${esc_(f.f)}</div>
        <div class="seg-scard__q">✍️ ${esc_(f.e)}</div>
        <div class="seg-scard__f"><span class="seg-mono">${esc_(f.h)}</span></div>
      </div>`).join('')}
    </div>
    <h3 class="seg-sinc__h">🧭 Verificador de desfases <small class="seg-muted">${esc_(typeof TEMP !== 'undefined' ? TEMP.etiqueta() : '')}</small></h3>
    <div id="seg-sinc-res">${segSkScards_(4)}</div>
  </div>`;
  Swal.fire({ html: html, width: 980, showConfirmButton: false, showCloseButton: true,
              customClass: { popup: 'seg-pop' }, didClose: () => segCortarSinc_() });
  if (SEG.sinc) segPintarSinc_(); else segCargarSinc_();
}

async function segCargarSinc_() {
  segCortarSinc_();
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  SEG.sincCtrl = ctrl;
  const quien = currentUser && currentUser.id;
  const t0 = Date.now();
  try {
    const d = await apiGet('seguimientoSincronizacion', { usuarioId: quien }, Object.assign({ silent: true }, ctrl ? { signal: ctrl.signal } : {}));
    if (!currentUser || currentUser.id !== quien) return;
    SEG.sinc = d;
    segMed_('seguimientoSincronizacion', t0);
    segPintarSinc_();
  } catch (e) {
    if (segAbortado_(e)) return;
    const el = segQ_('#seg-sinc-res');
    if (el) el.innerHTML = `<div class="seg-err">No se pudo revisar: ${esc_(String(e.message || e))}
      <button class="btn btn-ghost btn-sm" data-seg-sinc-reintentar>Reintentar</button></div>`;
  } finally { if (SEG.sincCtrl === ctrl) SEG.sincCtrl = null; }
}

function segPintarSinc_() {
  const el = segQ_('#seg-sinc-res'); const d = SEG.sinc;
  if (!el || !d) return;
  const todos = (typeof TEMP !== 'undefined') ? TEMP.filtrar(d.desfases || []) : (d.desfases || []);
  const defs = (SEG.catalogo && SEG.catalogo.desfasesDef) || [];
  const cuenta = {}; todos.forEach(x => { cuenta[x.k] = (cuenta[x.k] || 0) + 1; });
  const conDesf = defs.filter(x => cuenta[x.k]);
  const lista = SEG.sincTipo ? todos.filter(x => x.k === SEG.sincTipo) : todos;
  if (!todos.length) {
    el.innerHTML = `<div class="seg-sres is-ok">✅ Sin desfases: las fuentes coinciden en los ${d.revisados} participantes revisados.</div>`;
    return;
  }
  el.innerHTML = `<div class="seg-sres is-al">⚠️ ${todos.length} ${todos.length === 1 ? 'desfase' : 'desfases'} en ${d.revisados} participantes revisados. Solo lectura: cada uno dice dónde se corrige.</div>
    <div class="seg-dtipos">${conDesf.map(x => {
      const nv = SEG_NIVEL[x.n] || SEG_NIVEL.media;
      return `<button class="seg-dtipo ${SEG.sincTipo === x.k ? 'is-on' : ''}" data-seg-sinc-tipo="${x.k}" style="--d:${nv.c}">
        <b>${cuenta[x.k]}</b><span>${esc_(x.l)}</span><small>${esc_(nv.t)} · se corrige en ${esc_(x.c)}</small></button>`;
    }).join('')}</div>
    <div class="seg-dlista">${lista.slice(0, 400).map(x => {
      const def = segDesfDef_(x.k), nv = SEG_NIVEL[def.n] || SEG_NIVEL.media;
      const quien = x.n ? `<button class="seg-nom" data-seg-sinc-ver="${x.n}"><span class="seg-id">#${x.n}</span> ${esc_(x.nom || '(sin nombre)')}</button>`
                        : `<span class="seg-nom seg-nom--sin">${esc_(x.nom || '(sin nombre)')}</span>`;
      return `<div class="seg-dcard" style="--d:${nv.c}">${quien}<span class="seg-dcard__l">⚠️ ${esc_(def.l)}</span><span class="seg-dcard__d">${esc_(x.d || '')}</span><small class="seg-dcard__c">Se corrige en ${esc_(def.c)}</small></div>`;
    }).join('')}${lista.length > 400 ? `<p class="seg-muted">Se muestran 400 de ${lista.length}. Filtra por tipo para ver el resto.</p>` : ''}</div>`;
}

/* ============================================================
   EVENTOS (delegados)
   ============================================================ */
document.addEventListener('click', e => {
  const p = e.target.closest('[data-segp]');
  if (p) { segAbrirSheet_(p.dataset.segp); return; }
  if (e.target.closest('[data-seg-limpiar]')) { SEG.filtros = {}; SEG.esp = null; segPintarPills_(); segPintarTabla_(); return; }
  if (e.target.closest('[data-seg-esp-quitar]')) { SEG.esp = null; segPintarPills_(); segPintarTabla_(); return; }
  if (e.target.closest('[data-seg-fsheet-close]')) { segCerrarSheet_(); return; }
  if (e.target.closest('[data-seg-mas]')) { segTanda_(); return; }
  const v = e.target.closest('[data-seg-ver]');
  if (v) { segVerDetalle_(v.dataset.segVer, v.dataset.segIr); return; }
  const tb = e.target.closest('[data-seg-tab]');
  if (tb) { segDetTab_(tb.dataset.segTab); return; }
  const bq = e.target.closest('[data-seg-hb]');
  if (bq) { SEG.detBloque = bq.dataset.segHb; segPintarHist_(); return; }
  const sv = e.target.closest('[data-seg-sinc-ver]');
  if (sv) { const n = sv.dataset.segSincVer; Swal.close(); setTimeout(() => segVerDetalle_(n, 'sync'), 0); return; }
  const st = e.target.closest('[data-seg-sinc-tipo]');
  if (st) { SEG.sincTipo = st.dataset.segSincTipo === SEG.sincTipo ? '' : st.dataset.segSincTipo; segPintarSinc_(); return; }
  if (e.target.closest('[data-seg-sinc-reintentar]')) { SEG.sinc = null; segCargarSinc_(); return; }
  if (e.target.closest('[data-seg-det-reintentar]')) { const n = SEG.detN; delete SEG.det[n]; segCargarDet_(n); return; }
  if (e.target.closest('#seg-sinc')) { segAbrirSinc_(); return; }
  if (e.target.closest('#seg-refresh')) { recargarSeguimiento_(); }
});
(function () {
  let t = null;
  document.addEventListener('input', e => {
    if (e.target.id !== 'seg-search') return;
    clearTimeout(t);
    t = setTimeout(() => { SEG.texto = e.target.value || ''; segPintarTabla_(); }, 160);
  });
})();
