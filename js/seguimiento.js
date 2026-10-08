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
 * Usa de app.js: apiGet, showView, esc_, currentUser, estPartCargar_,
 * EST_PART, procesoChipHtml_; de temporada.js: TEMP.
 * ============================================================= */

const SEG = {
  todos: [], registros: [], catalogo: null, cargado: false, cargando: false,
  ctrl: null, texto: '', filtros: {}, pintadas: 0, lista: [], obs: null
};
const SEG_TANDA = 80;
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
    segPintarTodo_();
    segMed_('seguimientoPintado', t0);
  } catch (e) {
    if (segAbortado_(e)) return;
    Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: String(e.message || e) });
  } finally {
    if (SEG.ctrl === ctrl) { SEG.ctrl = null; SEG.cargando = false; }
  }
}

function recargarSeguimiento_() { SEG.cargado = false; cargarSeguimiento_(); }

function segSalir_() {
  try { SEG.ctrl && SEG.ctrl.abort(); } catch (_) {}
  SEG.ctrl = null; SEG.cargando = false;
  try { SEG.obs && SEG.obs.disconnect(); } catch (_) {}
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

/* Para la Entrega C (Estadísticas): abrir Seguimiento ya filtrado. */
function segAbrirFiltrado_(filtros) {
  SEG.filtros = Object.assign({}, filtros || {});
  SEG.texto = ''; const s = segQ_('#seg-search'); if (s) s.value = '';
  abrirSeguimiento_();
}

/* ============================================================
   PINTADO
   ============================================================ */
function segPintarTodo_() { segPintarPills_(); segPintarLeyenda_(); segPintarTabla_(); }

function segPintarPills_() {
  const cont = segQ_('#seg-filters'); if (!cont) return;
  const activos = Object.keys(SEG.filtros).length;
  cont.innerHTML = SEG_PILLS.map(f => {
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
    '<span class="seg-ley seg-ley--nota">Los hitos se marcan solos desde su módulo. Pasa el mouse sobre un hito para ver de dónde sale.</span>';
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

/* ---------- tabla ---------- */
function segFecha_(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(segTxt_(s));
  return m ? (m[3] + '/' + m[2] + '/' + m[1].slice(2) + (m[4] && m[4] + m[5] !== '0000' ? ' ' + m[4] + ':' + m[5] : '')) : '';
}
function segCabecera_() {
  const hs = segHitos_(), bs = segBloques_();
  const grupos = bs.map(b => {
    const n = hs.filter(h => h.b === b.k).length;
    return n ? `<th colspan="${n}" class="seg-g" style="--g:${b.color}">${esc_(b.l)}</th>` : '';
  }).join('');
  const cols = hs.map(h => {
    const b = bs.find(x => x.k === h.b) || {};
    return `<th class="seg-hc" style="--g:${b.color || '#64748b'}" title="${esc_(h.l + ' — ' + h.f)}">${esc_(h.c)}</th>`;
  }).join('');
  return `<thead><tr class="seg-grupos">
      <th class="seg-fija seg-fija--1" rowspan="2">Participante · Estado · Acción futura</th>
      <th class="seg-fija seg-fija--2" rowspan="2">Sponsor · Empleador · Plan · Proceso</th>
      <th colspan="7" class="seg-g" style="--g:#475569">Datos</th>${grupos}</tr>
    <tr><th>Asesor</th><th>Asesor procesos</th><th>Nivel de Inglés</th><th>Teléfono</th><th>Correo</th><th>Identificación</th><th>Últ. actualización</th>${cols}</tr></thead>`;
}
function segEstadoHtml_(r) {
  const e = segEst_(r);
  if (!e) return '<span class="seg-sinest">Sin estado · falta el comprobante de inscripción</span>';
  const p = r.estPrev && EST_PART.porClave[r.estPrev];
  return `<span class="seg-est" style="--e:${esc_(e.color)}">${e.ic} ${esc_(e.nombre)}</span>` +
    (p ? `<span class="seg-prev">${r.est === 'INACTIVO' ? 'vuelve a' : 'estaba en'} ${esc_(p.nombre)}</span>` : '') +
    `<span class="seg-acc">➡️ ${esc_(e.accion)}</span>`;
}
function segFilaHtml_(r) {
  const hs = segHitos_();
  const celdas = hs.map((h, i) => {
    const v = SEG_VAL[segHito_(r, i)] || SEG_VAL['0'];
    return `<td class="seg-hcell"><span class="seg-h seg-h--${v.c}" title="${esc_(h.l + ': ' + v.t)}" aria-label="${esc_(h.l + ': ' + v.t)}">${v.ic}</span></td>`;
  }).join('');
  const av = segAvance_(r);
  return `<tr data-sn="${r.n}">
    <th class="seg-fija seg-fija--1" scope="row">
      <button class="seg-nom" data-seg-ver="${r.n}" title="Ver el detalle">
        <span class="seg-id">#${r.n}</span> ${esc_((r.nom + ' ' + r.ape).trim() || '(sin nombre)')}</button>
      <div class="seg-estbox">${segEstadoHtml_(r)}</div>
      <div class="seg-bar" title="${av}% de los hitos que aplican"><i style="width:${av}%"></i></div>
    </th>
    <td class="seg-fija seg-fija--2">
      <div class="seg-l"><b>🏢</b> ${esc_(r.spo || '—')}${r.spoC ? ' <small title="Sin oferta: es el sponsor que registró el Contador">(Contador)</small>' : ''}</div>
      <div class="seg-l"><b>💼</b> ${esc_(r.emp || '—')}</div>
      <div class="seg-l">${r.plan ? `<span class="seg-plan">🎯 ${esc_(r.plan)}</span>` : ''} ${typeof procesoChipHtml_ === 'function' ? procesoChipHtml_(r.pro, r.ret) : esc_(r.pro || '')}</div>
    </td>
    <td class="seg-d">${esc_(r.ase || '—')}</td>
    <td class="seg-d">${esc_(r.aseP || '—')}</td>
    <td class="seg-d">${r.niv ? esc_(r.niv) + (r.pun !== '' && r.pun != null ? ` <small>${esc_(r.pun)}</small>` : '') : '—'}</td>
    <td class="seg-d">${esc_(r.tel || '—')}</td>
    <td class="seg-d seg-d--mail" title="${esc_(r.cor || '')}">${esc_(r.cor || '—')}</td>
    <td class="seg-d">${esc_(r.doc || '—')}</td>
    <td class="seg-d">${esc_(segFecha_(r.act) || '—')}</td>
    ${celdas}</tr>`;
}

function segPintarTabla_() {
  const cont = segQ_('#seg-tabla'), vacio = segQ_('#seg-empty');
  if (!cont) return;
  const t0 = Date.now();
  try { SEG.obs && SEG.obs.disconnect(); } catch (_) {}
  const l = segVisibles_();
  SEG.lista = l; SEG.pintadas = 0;
  const cnt = segQ_('#seg-count');
  if (cnt) cnt.textContent = l.length + ' de ' + SEG.registros.length + ' participantes · ' + (typeof TEMP !== 'undefined' ? TEMP.etiqueta() : '');
  vacio?.classList.toggle('hidden', l.length > 0);
  cont.classList.toggle('hidden', !l.length);
  if (!l.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = `<table class="seg-tabla">${segCabecera_()}<tbody id="seg-tbody"></tbody></table><div id="seg-mas" class="seg-mas"></div>`;
  segTanda_();
  if (typeof IntersectionObserver === 'function') {
    SEG.obs = new IntersectionObserver(ent => { if (ent.some(x => x.isIntersecting)) segTanda_(); }, { root: cont, rootMargin: '400px' });
    SEG.obs.observe(segQ_('#seg-mas'));
  }
  segMed_('seguimientoTabla', t0);
}
function segTanda_() {
  const tb = segQ_('#seg-tbody'); if (!tb) return;
  const desde = SEG.pintadas, hasta = Math.min(SEG.lista.length, desde + SEG_TANDA);
  if (desde >= hasta) return;
  tb.insertAdjacentHTML('beforeend', SEG.lista.slice(desde, hasta).map(segFilaHtml_).join(''));
  SEG.pintadas = hasta;
  const mas = segQ_('#seg-mas');
  if (mas) mas.innerHTML = hasta < SEG.lista.length
    ? `<button class="btn btn-ghost btn-sm" data-seg-mas>Ver ${Math.min(SEG_TANDA, SEG.lista.length - hasta)} más (${SEG.lista.length - hasta} restantes)</button>` : '';
}

/* ============================================================
   DETALLE (cabecera inmediata con lo que ya trae la fila)
   ============================================================ */
function segVerDetalle_(n) {
  const r = SEG.todos.find(x => String(x.n) === String(n)); if (!r) return;
  const hs = segHitos_(), bs = segBloques_();
  const bloques = bs.map(b => {
    const items = hs.map((h, i) => ({ h, i })).filter(x => x.h.b === b.k);
    if (!items.length) return '';
    return `<div class="seg-db" style="--g:${b.color}"><h4>${esc_(b.l)}</h4>${items.map(x => {
      const v = SEG_VAL[segHito_(r, x.i)] || SEG_VAL['0'];
      return `<div class="seg-di"><span class="seg-h seg-h--${v.c}">${v.ic}</span>
        <span class="seg-di__t">${esc_(x.h.l)}<small>${esc_(x.h.f)}</small></span>
        <span class="seg-di__v seg-di__v--${v.c}">${v.t}</span></div>`;
    }).join('')}</div>`;
  }).join('');
  const html = `<div class="seg-det">
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
    <div class="seg-det__bloques">${bloques}</div></div>`;
  Swal.fire({ html: html, width: 760, showConfirmButton: false, showCloseButton: true,
              customClass: { popup: 'seg-pop' } });
}

/* ============================================================
   EVENTOS (delegados)
   ============================================================ */
document.addEventListener('click', e => {
  const p = e.target.closest('[data-segp]');
  if (p) { segAbrirSheet_(p.dataset.segp); return; }
  if (e.target.closest('[data-seg-limpiar]')) { SEG.filtros = {}; segPintarPills_(); segPintarTabla_(); return; }
  if (e.target.closest('[data-seg-fsheet-close]')) { segCerrarSheet_(); return; }
  if (e.target.closest('[data-seg-mas]')) { segTanda_(); return; }
  const v = e.target.closest('[data-seg-ver]');
  if (v) { segVerDetalle_(v.dataset.segVer); return; }
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
