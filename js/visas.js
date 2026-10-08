/* =============================================================
 * SEP GROUP — PANEL DE VISAS (Fase 5 · Subfase 5.2 · Entregas B y C)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula
 * la garantía de funcionamiento.
 * ------------------------------------------------------------
 * QUÉ ES (pliego 5.2.3 y 5.2.4)
 *   Procesos → Visas: una TARJETA por participante (5.5-B: cero
 *   tablas) con su proceso en bloques legibles, y la edición se hace EN
 *   LA TARJETA (casillas, números y fechas) sin entrar a otra pantalla.
 *   Cada casilla guarda quién y cuándo (se ve debajo de la casilla).
 *   · DS-160 Real, DS-2019 recibido y Pago SEVIS NO se marcan aquí:
 *     salen del documento APROBADO en Mis documentos (respuesta 2).
 *   · Pago del programa sale del Contador (Completado + Validado en banco).
 *   · DS-2019 solicitado solo se puede marcar con Documentos del
 *     Sponsor completos + pago total Completado (5.2.4).
 *   · Clave del Sistema de Visa: oculta; la ven y la escriben PROCESOS
 *     y SUPERUSUARIO, con registro (verClave, la misma pieza de la
 *     clave del portal académico).
 *   · 5.2-C: Documentación consular lista (automática, el backend dice
 *     qué condición falta), ☐ Carpeta entregada (solo con la
 *     documentación lista; el candado real está en el backend) y
 *     Resultado consular (solo SEP, con quién y cuándo).
 *
 * RENDIMIENTO (reglas de la casa)
 *   · Una vista, un viaje (visasInit: catálogo + lista, fmt=2 + gzip).
 *   · Carga única por sesión; filtros y búsqueda locales. Tras guardar
 *     se PARCHA la fila en memoria y se repinta SOLO esa tarjeta.
 *   · La lectura se corta al salir (AbortController); los guardados no.
 *   · Toda escritura: la fila queda ocupada desde el primer toque +
 *     rid (apiPost). Respuesta de una sesión vieja nunca pisa la nueva.
 *   · Tiempos de pantalla en window.__sepMed (van a MEDICION).
 *
 * Usa de app.js: apiGet, apiPost, showView, esc_, currentUser,
 * estPartCargar_, estPartHtml_, procesoChipHtml_; de temporada.js: TEMP.
 * ============================================================= */

const VIS = {
  todos: [], registros: [], catalogo: null, cargado: false, cargando: false,
  filtroTop: '__ALL__', filtroAsesor: '__ALL__', filtroSponsor: '__ALL__', texto: '',
  ctrl: null,
  ocupado: {},       // id → true mientras esa tarjeta escribe (escudo)
  lista: [], pintadas: 0, obs: null,   // 5.5-B — tandas de tarjetas
  clave: {}          // id → clave del Sistema de Visa ya revelada
};
const VIS_SIN = '— Sin asignar —';

function visTxt_(v) { return String(v == null ? '' : v).trim(); }
function visMed_(ruta, t0) {
  try {
    const ms = Date.now() - t0;
    (window.__sepMed = window.__sepMed || []).push({ ruta: ruta, ms: ms, t: Date.now() });
    if (window.console) console.info('[med] ' + ruta + ' ' + ms + ' ms');
  } catch (_) {}
}
function visAbortado_(e) { return !!(e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')))); }

/* ============================================================
   ENTRADA
   ============================================================ */
function visPuedeEntrar_() {
  const u = currentUser || {};
  const mios = ((typeof misRoles_ === 'function') ? (misRoles_(u) || [])
    : ((Array.isArray(u.roles) && u.roles.length) ? u.roles : [u.rol])).map(r => String(r || '').toUpperCase());
  return ['DESARROLLADOR', 'SUPERUSUARIO', 'PROCESOS'].some(r => mios.indexOf(r) >= 0);
}

function abrirVisas_() {
  if (!visPuedeEntrar_()) {
    Swal.fire({ icon: 'warning', title: 'Sin permiso',
      text: 'Solo PROCESOS, SUPERUSUARIO o DESARROLLADOR entran al Panel de Visas.' });
    return;
  }
  showView('visas');                     // navegación primero
  if (VIS.cargado) { visPintarTodo_(); return; }
  if (!VIS.cargando) cargarVisas_();
}

async function cargarVisas_() {
  VIS.cargando = true;
  try { VIS.ctrl && VIS.ctrl.abort(); } catch (_) {}
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  VIS.ctrl = ctrl;
  const quien = currentUser && currentUser.id;
  const t0 = Date.now();
  try {
    const d = await apiGet('visasInit', { usuarioId: quien }, ctrl ? { signal: ctrl.signal } : {});
    if (!currentUser || currentUser.id !== quien) return;          // sesión vieja
    visMed_('visasInit', t0);
    VIS.catalogo = d.catalogo || {};
    if (typeof estPartCargar_ === 'function') estPartCargar_(VIS.catalogo.estadosPart);
    if (typeof TEMP !== 'undefined') { TEMP.set(d.temporadas); TEMP.montar('visas'); }
    VIS.todos = d.registros || [];
    VIS.registros = (typeof TEMP !== 'undefined') ? TEMP.filtrar(VIS.todos) : VIS.todos.slice();
    VIS.cargado = true;
    visPintarTodo_();
  } catch (e) {
    if (visAbortado_(e)) return;
    Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: String(e.message || e) });
  } finally {
    if (VIS.ctrl === ctrl) { VIS.ctrl = null; VIS.cargando = false; }
  }
}

function recargarVisas_() { VIS.cargado = false; VIS.clave = {}; cargarVisas_(); }

function visSalir_() {
  try { VIS.ctrl && VIS.ctrl.abort(); } catch (_) {}
  VIS.ctrl = null; VIS.cargando = false; VIS.clave = {};
  try { VIS.obs && VIS.obs.disconnect(); } catch (_) {}
  VIS.obs = null;
}

if (typeof TEMP !== 'undefined') {
  TEMP.alCambiar(() => {
    if (!VIS.cargado) return;
    VIS.registros = TEMP.filtrar(VIS.todos);
    try { visPintarTodo_(); } catch (e) { console.error(e); }
  });
}

/* ============================================================
   FILTROS (todos locales)
   ============================================================ */
/* Indicadores superiores: cada uno es un filtro. */
const VIS_TOPS = [
  { clave: 'CONTRATADO',  label: 'Contratados',               ic: '🤝', color: '#15803d', f: r => r.est === 'CONTRATADO' },
  { clave: 'SPONSOR',     label: 'Docs Sponsor pendientes',   ic: '🏢', color: '#ca8a04', f: r => !r.spon },
  { clave: 'SOLICITAR',   label: 'DS-2019 por solicitar',     ic: '📨', color: '#2563eb', f: r => r.ds2019Puede && !r.ds2019Sol && !r.ds2019 },
  { clave: 'ESPERA',      label: 'DS-2019 en espera',         ic: '⏳', color: '#7c3aed', f: r => r.ds2019Sol && !r.ds2019 },
  { clave: 'CITA',        label: 'Cita agendada',             ic: '🗓️', color: '#d97706', f: r => !!r.cita },
  { clave: 'ASESORIA',    label: 'Asesoría pendiente',        ic: '🎓', color: '#0d9488', f: r => !!r.cita && !r.ase },
  /* 5.2-C */
  { clave: 'CONSULAR',    label: 'Doc. consular lista',       ic: '🗂️', color: '#0f766e', f: r => !!r.consular && !r.carpeta },
  { clave: 'EMBAJADA',    label: 'En Embajada',               ic: '🏛️', color: '#1e40af', f: r => !!r.carpeta && (!r.resultado || r.resultado === 'PENDIENTE') },
  { clave: 'APROBADA',    label: 'Visa aprobada',             ic: '🛂', color: '#16a34a', f: r => r.resultado === 'APROBADA' },
  /* 5.3-B — Pre-Arrival, vuelo, rifa de 72 h y estado 18. */
  { clave: 'PREARRIVAL',  label: 'Pre-Arrival pendiente',     ic: '✈️', color: '#0369a1', f: r => r.resultado === 'APROBADA' && !r.pre },
  { clave: 'VUELO_REV',   label: 'Vuelo por revisar',         ic: '🛫', color: '#2563eb', f: r => r.vuelo === 'EN_REVISION' },
  { clave: 'RIFA',        label: 'Elegibles rifa 72 h',       ic: '🎟️', color: '#c026d3', f: r => r.rifa === 'SI' },
  { clave: 'COMPLETADO',  label: 'Programa completado',       ic: '🎓', color: '#047857', f: r => r.est === 'PROGRAMA_COMPLETADO' }
];

function visVeTodos_() { return !!(VIS.catalogo && VIS.catalogo.permisos && VIS.catalogo.permisos.verTodos); }
function visPuedeClave_() { return !!(VIS.catalogo && VIS.catalogo.permisos && VIS.catalogo.permisos.clave); }
function visAsesorDe_(r) { return visTxt_(r.asesorProcesos) || VIS_SIN; }
function visSponsorDe_(r) { return visTxt_(r.sponsor) || VIS_SIN; }

function visBaseAsesor_() {
  const b = VIS.registros;
  return VIS.filtroAsesor === '__ALL__' ? b : b.filter(r => visAsesorDe_(r) === VIS.filtroAsesor);
}
function visBaseSponsor_() {
  const b = visBaseAsesor_();
  return VIS.filtroSponsor === '__ALL__' ? b : b.filter(r => visSponsorDe_(r) === VIS.filtroSponsor);
}
function visBaseTop_() {
  const b = visBaseSponsor_();
  const t = VIS_TOPS.find(x => x.clave === VIS.filtroTop);
  return t ? b.filter(t.f) : b;
}

const VIS_PILLS = [
  { key: 'asesor',  allLabel: 'Todos los asesores', titulo: 'Filtrar por Asesor de Procesos', ic: '🧭', color: '#7c3aed', soloTodos: true },
  { key: 'sponsor', allLabel: 'Todos los sponsors', titulo: 'Filtrar por Sponsor',            ic: '🏢', color: '#0f766e' }
];
function visPills_() { return VIS_PILLS.filter(p => !p.soloTodos || visVeTodos_()); }
function visValPill_(k) { return k === 'asesor' ? VIS.filtroAsesor : VIS.filtroSponsor; }
function visSetPill_(k, v) {
  if (k === 'asesor') { VIS.filtroAsesor = v; VIS.filtroSponsor = '__ALL__'; }
  else VIS.filtroSponsor = v;
}
function visOpciones_(k) {
  const c = {};
  const base = k === 'asesor' ? VIS.registros : visBaseAsesor_();
  base.forEach(r => { const v = k === 'asesor' ? visAsesorDe_(r) : visSponsorDe_(r); c[v] = (c[v] || 0) + 1; });
  return Object.keys(c).sort((a, b) => a.localeCompare(b)).map(v => ({ valor: v, label: v, count: c[v] }));
}

function visNorm_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function visVisibles_() {
  const q = visNorm_(VIS.texto.trim());
  let l = visBaseTop_();
  if (q) l = l.filter(r =>
    visNorm_(r.nombres + ' ' + r.apellidos).includes(q) || String(r.documento || '').includes(q) ||
    String(r.telefono || '').includes(q) || visNorm_(r.correo).includes(q) || String(r.n).includes(q) ||
    visNorm_(r.pasaporte).includes(q) || visNorm_(r.ds160iNum).includes(q) || visNorm_(r.ds160rNum).includes(q) ||
    visNorm_(r.sevisNum).includes(q));
  return l;
}

/* ============================================================
   PINTADO
   ============================================================ */
function visQ_(s) { return document.querySelector(s); }
function visPintarTodo_() { visPintarTop_(); visPintarPills_(); visPintarTabla_(); }

function visPintarTop_() {
  const cont = visQ_('#vis-resumen'); if (!cont) return;
  const base = visBaseSponsor_();
  cont.innerHTML = VIS_TOPS.map(t => `<button class="conta-kpi veri-top${VIS.filtroTop === t.clave ? ' is-on' : ''}"
      data-vtop="${t.clave}" style="--k:${t.color}" aria-pressed="${VIS.filtroTop === t.clave}">
      <span class="conta-kpi__n">${base.filter(t.f).length}</span>
      <span class="conta-kpi__t">${t.ic} ${esc_(t.label)}</span></button>`).join('');
  cont.querySelectorAll('[data-vtop]').forEach(b => b.addEventListener('click', () => {
    VIS.filtroTop = VIS.filtroTop === b.dataset.vtop ? '__ALL__' : b.dataset.vtop;
    visPintarTop_(); visPintarTabla_();
  }));
}

function visPintarPills_() {
  const cont = visQ_('#vis-filters'); if (!cont) return;
  cont.innerHTML = visPills_().map(f => {
    const val = visValPill_(f.key), on = val !== '__ALL__';
    const n = f.key === 'asesor' ? visBaseAsesor_().length : visBaseSponsor_().length;
    return `<button class="fpill ${on ? 'is-on' : ''}" id="visfp-${f.key}" style="--fp:${f.color}" aria-haspopup="dialog"
        title="${esc_(on ? val : f.allLabel)}">
      <span class="fpill__ic">${f.ic}</span><span class="fpill__label">${esc_(on ? val : f.allLabel)}</span>
      <span class="fpill__count">${n}</span>
      <svg class="fpill__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>`;
  }).join('');
  visPills_().forEach(f => visQ_('#visfp-' + f.key)?.addEventListener('click', () => visAbrirSheet_(f.key)));
}

function visAbrirSheet_(key) {
  const f = visPills_().find(x => x.key === key); if (!f) return;
  const sheet = visQ_('#vis-fsheet'), lista = visQ_('#vis-fsheet-list');
  if (!sheet || !lista) return;
  visQ_('#vis-fsheet-title').textContent = f.titulo;
  const actual = visValPill_(key);
  const total = key === 'asesor' ? VIS.registros.length : visBaseAsesor_().length;
  const opt = (o, sel, all) => `<button class="fopt ${sel ? 'is-sel' : ''} ${all ? 'is-all' : ''}" data-valor="${esc_(o.valor)}">
      <span class="fopt__ic">${f.ic}</span><span class="fopt__label">${esc_(o.label)}</span>
      <span class="fopt__count">${o.count}</span><span class="fopt__check">✓</span></button>`;
  lista.innerHTML = opt({ valor: '__ALL__', label: f.allLabel, count: total }, actual === '__ALL__', true) +
    visOpciones_(key).map(o => opt(o, actual === o.valor, false)).join('');
  lista.querySelectorAll('.fopt').forEach(b => b.addEventListener('click', () => {
    visSetPill_(key, b.dataset.valor);
    visCerrarSheet_(); visPintarTodo_();
  }));
  sheet.classList.remove('hidden'); sheet.setAttribute('aria-hidden', 'false');
}
function visCerrarSheet_() {
  const s = visQ_('#vis-fsheet'); if (!s) return;
  s.classList.add('hidden'); s.setAttribute('aria-hidden', 'true');
}
document.addEventListener('click', e => { if (e.target.closest('[data-vis-fsheet-close]')) visCerrarSheet_(); });

/* ============================================================
   TARJETAS (5.5-B · 08/10/2026) — CERO TABLAS
   Cada participante es una tarjeta del mismo lenguaje de Seguimiento
   (franja del estado, anillo de avance, estado + siguiente paso, chips)
   y su proceso de visa en BLOQUES legibles sin abrir nada: DS-160,
   Sistema de Visa, Cita, Sponsor, DS-2019, SEVIS, Pago del programa,
   Asesoría, Consular, Carpeta, Resultado, Pre-Arrival, Vuelo y Rifa.
   Cada bloque dice su estado en texto (Listo · En curso · Pendiente ·
   No aplica) y trae sus casillas/campos con QUIÉN y CUÁNDO a la vista.
   La edición es la de siempre (mismas reglas, escudo, rid y parche en
   memoria); se pinta por tandas de 24 al hacer scroll.
   ============================================================ */
const VIS_TANDA = 24;

function visFechaCorta_(s) {
  /* 'dd/mm/aaaa hh:mm:ss' (sello del servidor) → 'dd/mm hh:mm' */
  const m = /^(\d{2})\/(\d{2})\/\d{4}(?: (\d{2}):(\d{2}))?/.exec(visTxt_(s));
  return m ? (m[1] + '/' + m[2] + (m[3] ? ' ' + m[3] + ':' + m[4] : '')) : visTxt_(s);
}
function visIsoCorta_(s) {
  /* 'aaaa-mm-dd[ hh:mm]' → 'dd/mm/aaaa[ hh:mm]' */
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(visTxt_(s));
  return m ? (m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' ' + m[4] + ':' + m[5] : '')) : visTxt_(s);
}
/* Quién · cuándo, visible (no solo al pasar el mouse). */
function visSello_(q, f) {
  const t = [visTxt_(q), visFechaCorta_(f)].filter(Boolean).join(' · ');
  return t ? `<small class="vis-sello">${esc_(t)}</small>` : '';
}

/* Casilla editable: etiqueta legible + quién/cuándo. */
function visCheck_(r, k, etiqueta, extraDis, titulo) {
  const on = !!r[k];
  const dis = VIS.ocupado[r.id] || extraDis;
  const tip = on ? ('Marcado por ' + (r[k + 'Q'] || '—') + ' · ' + (r[k + 'F'] || '')) : (titulo || 'Sin marcar');
  return `<label class="vis-chk${on ? ' is-on' : ''}${dis ? ' is-dis' : ''}" title="${esc_(tip)}">
      <input type="checkbox" data-vk="${k}"${on ? ' checked' : ''}${dis ? ' disabled' : ''}>
      <span class="vis-chk__t">${esc_(etiqueta)}${on ? visSello_(r[k + 'Q'], r[k + 'F']) : ''}</span></label>`;
}
/* Casilla LEÍDA de un documento (no editable): estado en texto. */
function visLeida_(etiqueta, on, fecha, por, falta) {
  const tip = on ? ('Documento aprobado por ' + (por || '—') + ' · ' + (fecha || '')) : falta;
  return `<div class="vis-leida${on ? ' is-on' : ''}" title="${esc_(tip)}">
      <span class="vis-leida__ic" aria-hidden="true">${on ? '✓' : '⏳'}</span>
      <span class="vis-chk__t">${esc_(etiqueta)} <em>${on ? 'aprobado en Mis documentos' : 'se marca al aprobar el documento'}</em>
      ${on ? visSello_(por, fecha) : ''}</span></div>`;
}
function visInput_(r, k, tipo, etiqueta, ph) {
  const v = r[k] || '';
  const val = tipo === 'datetime-local' ? v.replace(' ', 'T') : v;
  const dis = VIS.ocupado[r.id] ? ' disabled' : '';
  const cls = tipo === 'text' ? 'vis-in vis-in--num' : 'vis-in vis-in--fecha';
  return `<label class="vis-campo"><span>${esc_(etiqueta)}</span>
      <input class="${cls}" type="${tipo}" data-vk="${k}" value="${esc_(val)}"${ph ? ` placeholder="${esc_(ph)}"` : ''}
      ${tipo === 'text' ? 'maxlength="30" autocapitalize="characters" spellcheck="false"' : ''}${dis}></label>`;
}
function visNota_(t) { return t ? `<small class="vis-falta">${esc_(t)}</small>` : ''; }

function visClaveHtml_(r) {
  const puede = visPuedeClave_();
  const dis = VIS.ocupado[r.id] ? ' disabled' : '';
  let v;
  if (!puede) v = `<span class="vis-muted" title="Solo PROCESOS y SUPERUSUARIO">${r.svHay ? '🔒 Guardada' : 'Sin clave'}</span>`;
  else if (VIS.clave[r.id]) {
    v = `<code class="veri-clave">${esc_(VIS.clave[r.id])}</code>
      <button class="veri-link" data-vclave-ocultar="${esc_(r.id)}">🙈 Ocultar</button>`;
  } else {
    v = `${r.svHay ? `<span class="veri-oculta">••••••</span>
      <button class="veri-link" data-vclave-ver="${esc_(r.id)}" title="Ver clave (queda registrado)"${dis}>👁 Ver</button>` : '<span class="vis-muted">Sin clave</span>'}
      <button class="veri-link" data-vclave-editar="${esc_(r.id)}" title="${r.svHay ? 'Cambiar la clave' : 'Guardar la clave'}"${dis}>🔑 ${r.svHay ? 'Cambiar' : 'Guardar'}</button>`;
  }
  return `<div class="vis-clave"><span class="vis-clave__l">Clave</span>${v}</div>`;
}

function visPagoHtml_(r) {
  return `<span class="vis-tag ${r.pagoTotal ? 'is-ok' : 'is-pend'}">${r.pagoTotal ? '✅ Pago total completado' : '⏳ Pago total pendiente'}</span>
    <span class="vis-tag ${r.bancoTotal ? 'is-ok' : 'is-pend'}" title="Validado en banco (Contador)">🏦 ${r.bancoTotal ? 'Validado en banco' : 'Sin validar en banco'}</span>`;
}

function visDs2019Html_(r) {
  if (r.ds2019) return '';
  const falta = [];
  if (!r.spon) falta.push('Docs Sponsor');
  if (!r.pagoTotal) falta.push('pago total');
  const dis = !r.ds2019Sol && !r.ds2019Puede;
  return visCheck_(r, 'ds2019Sol', 'Solicitado', dis, dis ? 'Falta: ' + falta.join(' y ') : 'Lista para solicitar') +
    (dis ? visNota_('Falta ' + falta.join(' y ')) : '');
}

const VIS_VUELO_TAG = {
  EN_REVISION: ['is-rev', '📤 Por revisar'], RECHAZADO: ['is-pend', '↩️ Rechazado'], APROBADO: ['is-ok', '✅ Aprobado']
};
function visVueloHtml_(r) {
  const t = VIS_VUELO_TAG[r.vuelo];
  const tag = t ? `<span class="vis-tag ${t[0]}" title="${esc_(r.vuelo === 'APROBADO' ? 'Aprobado por ' + (r.vueloQ || '—') + ' · ' + (r.vueloF || '') : 'Itinerario en Mis documentos')}">${t[1]}</span>`
              : `<span class="vis-muted">${r.pre ? 'Itinerario sin cargar' : 'Se carga después del Pre-Arrival'}</span>`;
  const btn = (r.vuelo || r.pre) && typeof NDOCS !== 'undefined'
    ? `<button class="veri-link vis-vuelo-btn" data-vvuelo="${esc_(r.id)}" title="Ver, aprobar o rechazar el itinerario">📁 ${r.vuelo === 'EN_REVISION' ? 'Revisar' : 'Ver'} itinerario</button>` : '';
  return tag + (r.vuelo === 'APROBADO' ? visSello_(r.vueloQ, r.vueloF) : '') + btn;
}
function visRifaHtml_(r) {
  if (!r.vueloCarga) return '<span class="vis-muted">Se mide al cargar el vuelo</span>';
  const h = visTxt_(r.rifaH);
  return `<span class="vis-tag ${r.rifa === 'SI' ? 'is-ok' : 'is-pend'}" title="Primera carga del vuelo vs. Pre-Arrival">${r.rifa === 'SI' ? '🎟️ Elegible' : 'No elegible'}</span>
    ${visNota_('Vuelo cargado ' + visFechaCorta_(r.vueloCarga) + (h && !isNaN(Number(h)) ? ' · ' + h.replace('.', ',') + ' h' : ''))}`;
}
function visConsularHtml_(r) {
  if (r.consular) return '<span class="vis-tag is-ok" title="Cumple las 7 condiciones">✅ Documentación lista</span>';
  const cat = (VIS.catalogo && VIS.catalogo.consular) || [];
  const faltan = (r.consularFaltan || []).map(k => (cat.find(c => c.k === k) || { l: k }).l);
  return `<span class="vis-tag is-pend">⏳ Faltan ${faltan.length} de ${cat.length || 7}</span>
    <ul class="vis-faltan">${faltan.map(f => `<li>${esc_(f)}</li>`).join('')}</ul>`;
}
function visCarpetaHtml_(r) {
  if (r.carpeta) {
    return visCheck_(r, 'carpeta', 'Carpeta entregada', !!r.resultado, 'Carpeta entregada') +
      (r.resultado ? visNota_('Quita el resultado para desmarcarla') : '');
  }
  return visCheck_(r, 'carpeta', 'Carpeta entregada', !r.consular, r.consular ? 'Lista para entregar' : 'Requiere la documentación consular lista') +
    (r.consular ? '' : visNota_('Requiere la documentación consular lista'));
}
function visResultadoHtml_(r) {
  const ops = (VIS.catalogo && VIS.catalogo.resultados) || [];
  const dis = VIS.ocupado[r.id] || !r.carpeta;
  const v = r.resultado || '';
  const tip = v ? ('Registrado por ' + (r.resultadoQ || '—') + ' · ' + (r.resultadoF || '')) : (r.carpeta ? 'Sin registrar' : 'Se registra con la carpeta entregada');
  return `<select class="vis-in vis-sel${v ? ' is-on vis-res--' + v.toLowerCase() : ''}" data-vk="resultado" title="${esc_(tip)}" aria-label="Resultado consular"${dis ? ' disabled' : ''}>
      <option value="">— Sin registrar —</option>
      ${ops.map(o => `<option value="${esc_(o.k)}"${o.k === v ? ' selected' : ''}>${esc_(o.ic + ' ' + o.l)}</option>`).join('')}
    </select>${v ? visSello_(r.resultadoQ, r.resultadoF) : (r.carpeta ? '' : visNota_('Se registra con la carpeta entregada'))}`;
}
function visPreHtml_(r) {
  if (r.pre) return visCheck_(r, 'pre', 'Completado', !!r.vueloCarga, 'Completado') + (r.vueloCarga ? visNota_('Ya cargó el vuelo') : '');
  const puede = r.resultado === 'APROBADA';
  return visCheck_(r, 'pre', 'Completado', !puede, puede ? 'Pendiente' : 'Se abre con la visa aprobada') +
    (puede ? '' : visNota_('Se abre con la visa aprobada'));
}

/* Los 14 bloques: título, estado (ok · proc · pend · no · na) y cuerpo. */
const VIS_EST_TXT = { ok: '✓ Listo', proc: '◐ En curso', pend: 'Pendiente', no: '✕ Negativo', na: 'No aplica' };
function visBloques_(r) {
  const b = (k, l, color, est, html) => ({ k, l, color, est, html });
  const res = r.resultado || '';
  return [
    b('ds160', 'DS-160', '#2563eb',
      r.ds160r && r.ds160rNum ? 'ok' : (r.ds160i || r.ds160iNum || r.ds160r || r.ds160rNum ? 'proc' : 'pend'),
      visCheck_(r, 'ds160i', 'Interno diligenciado') + visInput_(r, 'ds160iNum', 'text', 'N° interno', 'N°') +
      visLeida_('Real', r.ds160r, r.ds160rF, r.ds160rQ, 'Se marca cuando SEP aprueba el DS-160 (copia y confirmación) en Mis documentos') +
      visInput_(r, 'ds160rNum', 'text', 'N° real', 'N°')),
    b('sv', 'Sistema de Visa', '#0d9488',
      r.sv && r.pv ? 'ok' : (r.sv || r.pv || r.svHay ? 'proc' : 'pend'),
      visCheck_(r, 'sv', 'Cuenta creada') + visClaveHtml_(r) + visCheck_(r, 'pv', 'Pago de la visa')),
    b('cita', 'Cita', '#d97706',
      r.cita ? 'ok' : (r.cas || r.consul || r.start ? 'proc' : 'pend'),
      visCheck_(r, 'cita', 'Agendada', !r.cita && !(r.cas && r.consul), 'Requiere Fecha/Hora CAS y Consulado') +
      (!r.cita && !(r.cas && r.consul) ? visNota_('Requiere CAS y Consulado') : '') +
      visInput_(r, 'start', 'date', 'Start Date') + visInput_(r, 'cas', 'datetime-local', 'CAS') +
      visInput_(r, 'consul', 'datetime-local', 'Consulado')),
    b('spon', 'Sponsor', '#ca8a04', r.spon ? 'ok' : 'pend',
      `<div class="vis-dato-l">🏢 ${esc_(r.sponsor || 'Sin sponsor')}</div>` + visCheck_(r, 'spon', 'Documentos completos')),
    b('ds2019', 'DS-2019', '#7c3aed',
      r.ds2019 ? 'ok' : (r.ds2019Sol ? 'proc' : 'pend'),
      visDs2019Html_(r) + visLeida_('Recibido', r.ds2019, r.ds2019F, r.ds2019Q, 'Se marca cuando SEP aprueba el DS-2019 en Mis documentos')),
    b('sevis', 'SEVIS', '#0369a1',
      r.sevis ? 'ok' : (r.sevisNum ? 'proc' : 'pend'),
      visInput_(r, 'sevisNum', 'text', 'N° SEVIS', 'N°') +
      visLeida_('Pago', r.sevis, r.sevisF, r.sevisQ, 'Se marca cuando SEP aprueba la confirmación del pago SEVIS en Mis documentos')),
    b('pago', 'Pago del programa', '#15803d',
      r.pagoTotal && r.bancoTotal ? 'ok' : (r.pagoTotal || r.bancoTotal ? 'proc' : 'pend'), visPagoHtml_(r)),
    b('ase', 'Asesoría Visa', '#0f766e',
      r.ase ? 'ok' : (Number(r.pasosV) > 0 ? 'proc' : 'pend'),
      visCheck_(r, 'ase', 'Completada') +
      (r.pasosV != null ? `<div class="vis-pasosv${Number(r.pasosV) === 6 ? ' is-ok' : ''}" title="Pasos del módulo Visa que completó el participante en su portal">Portal del participante: ${Number(r.pasosV) || 0} de 6 pasos</div>` : '')),
    b('consular', 'Documentación consular', '#0f766e', r.consular ? 'ok' : 'pend', visConsularHtml_(r)),
    b('carpeta', 'Carpeta', '#1e40af', r.carpeta ? 'ok' : (r.consular ? 'pend' : 'na'), visCarpetaHtml_(r)),
    b('resultado', 'Resultado consular', '#16a34a',
      res === 'APROBADA' ? 'ok' : (res === 'NEGADA' ? 'no' : (res ? 'proc' : (r.carpeta ? 'pend' : 'na'))), visResultadoHtml_(r)),
    b('pre', 'Pre-Arrival', '#0369a1', r.pre ? 'ok' : (res === 'APROBADA' ? 'pend' : 'na'), visPreHtml_(r)),
    b('vuelo', 'Vuelo', '#2563eb',
      r.vuelo === 'APROBADO' ? 'ok' : (r.vuelo === 'RECHAZADO' ? 'no' : (r.vuelo === 'EN_REVISION' ? 'proc' : (r.pre ? 'pend' : 'na'))), visVueloHtml_(r)),
    b('rifa', 'Rifa 72 h', '#c026d3', !r.vueloCarga ? 'na' : (r.rifa === 'SI' ? 'ok' : 'no'), visRifaHtml_(r))
  ];
}

function visCardHtml_(r) {
  const oc = VIS.ocupado[r.id];
  const e = (typeof EST_PART !== 'undefined' && r.est) ? EST_PART.porClave[r.est] : null;
  const color = e ? e.color : '#94a3b8';
  const bl = visBloques_(r);
  const aplica = bl.filter(x => x.est !== 'na'), listos = aplica.filter(x => x.est === 'ok').length;
  const av = aplica.length ? Math.round(listos * 100 / aplica.length) : 0;
  const sig = aplica.find(x => x.est !== 'ok');
  const nombre = visTxt_(r.nombres + ' ' + r.apellidos) || '(sin nombre)';
  const chip = (ic, v, tit) => v ? `<span title="${esc_(tit)}">${ic} ${esc_(v)}</span>` : '';
  return `<article class="com-card vis-card${oc ? ' is-ocupado' : ''}${r.inactivo ? ' is-inactivo' : ''}" data-vid="${esc_(r.id)}" style="--e:${esc_(color)}" aria-busy="${oc ? 'true' : 'false'}">
    <div class="com-card__stripe" style="background:${esc_(color)}"></div>
    <div class="com-card__top">
      <div class="com-card__head">
        <h3 class="com-card__name">${esc_(nombre)}</h3>
        <div class="seg-card__sub">${r.n ? `<span class="com-card__id">N° ${r.n}</span>` : ''}${r.anio ? `<span>📅 ${esc_(r.anio)}</span>` : ''}
          <span class="${r.asesorProcesos ? '' : 'veri-falta'}" title="Asesor de Procesos">🧭 ${esc_(r.asesorProcesos || 'sin asesor')}</span></div>
      </div>
      <div class="seg-ring" style="--p:${av}" role="img" aria-label="${listos} de ${aplica.length} pasos de visa listos" title="${listos} de ${aplica.length} pasos de visa listos"><b>${listos}<small>/${aplica.length}</small></b></div>
    </div>
    ${typeof estPartHtml_ === 'function' ? estPartHtml_(r) : ''}
    ${sig ? `<div class="vis-sig">➡️ Siguiente: <b>${esc_(sig.l)}</b></div>` : '<div class="vis-sig is-ok">🎉 Proceso de visa completo</div>'}
    <div class="com-card__meta">
      ${chip('🪪', r.documento, 'Identificación')}${chip('📱', r.telefono, 'Teléfono')}${chip('✉️', r.correo, 'Correo')}
      ${chip('🎂', visIsoCorta_(r.nacimiento), 'Nacimiento')}${chip('🛂', r.pasaporte, 'Pasaporte')}
      ${r.pasaporte ? '' : '<span class="veri-falta" title="Pasaporte">🛂 sin pasaporte</span>'}
      ${typeof procesoChipHtml_ === 'function' ? procesoChipHtml_(r.proceso, false) : ''}
    </div>
    <div class="vis-blqs">${bl.map(x => `<section class="vis-blq vis-blq--${x.est}" style="--g:${x.color}" data-vblq="${x.k}">
        <div class="vis-blq__h"><span>${esc_(x.l)}</span><b>${VIS_EST_TXT[x.est]}</b></div>
        <div class="vis-blq__b">${x.html}</div></section>`).join('')}</div>
  </article>`;
}

function visPintarTabla_() {
  const cont = visQ_('#vis-cards'), vacio = visQ_('#vis-empty');
  if (!cont) return;
  const t0 = Date.now();
  try { VIS.obs && VIS.obs.disconnect(); } catch (_) {}
  const l = visVisibles_();
  VIS.lista = l; VIS.pintadas = 0;
  const cnt = visQ_('#vis-count'); if (cnt) cnt.textContent = l.length + ' de ' + VIS.registros.length + ' participantes';
  vacio?.classList.toggle('hidden', l.length > 0);
  cont.classList.toggle('hidden', !l.length);
  const mas = visQ_('#vis-mas');
  cont.innerHTML = '';
  if (mas) mas.innerHTML = '';
  if (!l.length) return;
  visTanda_();
  if (typeof IntersectionObserver === 'function' && mas) {
    VIS.obs = new IntersectionObserver(ent => { if (ent.some(x => x.isIntersecting)) visTanda_(); }, { rootMargin: '600px' });
    VIS.obs.observe(mas);
  }
  visMed_('visasTarjetas', t0);
}
function visTanda_() {
  const cont = visQ_('#vis-cards'); if (!cont) return;
  const desde = VIS.pintadas, hasta = Math.min(VIS.lista.length, desde + VIS_TANDA);
  if (desde >= hasta) return;
  cont.insertAdjacentHTML('beforeend', VIS.lista.slice(desde, hasta).map(visCardHtml_).join(''));
  VIS.pintadas = hasta;
  const mas = visQ_('#vis-mas');
  if (mas) mas.innerHTML = hasta < VIS.lista.length
    ? `<button class="btn btn-ghost btn-sm" data-vis-mas>Ver ${Math.min(VIS_TANDA, VIS.lista.length - hasta)} más (${VIS.lista.length - hasta} restantes)</button>` : '';
}
document.addEventListener('click', e => { if (e.target.closest('[data-vis-mas]')) visTanda_(); });

function visTarjeta_(id) { return document.querySelector('#vis-cards [data-vid="' + CSS.escape(id) + '"]'); }

/* Repinta SOLO una tarjeta (tras guardar o al ocupar/liberar). */
function visRepintarFila_(id) {
  const el = visTarjeta_(id);
  const r = VIS.todos.find(x => x.id === id);
  if (!el || !r) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = visCardHtml_(r);
  el.replaceWith(tmp.firstElementChild);
}

/* ============================================================
   EDICIÓN EN LA TARJETA (delegada: un oyente para toda la vista)
   ============================================================ */
function visFilaDe_(el) {
  const c = el.closest('[data-vid]');
  return c ? VIS.todos.find(x => x.id === c.dataset.vid) : null;
}

document.addEventListener('change', e => {
  const el = e.target.closest('#vis-cards [data-vk]');
  if (!el) return;
  const r = visFilaDe_(el); if (!r) return;
  const k = el.dataset.vk;
  if (el.type === 'checkbox') { visGuardar_(r, { [k]: !!el.checked }); return; }
  if (k === 'resultado') { visResultado_(r, visTxt_(el.value)); return; }
  let v = visTxt_(el.value);
  if (el.type === 'datetime-local') v = v.replace('T', ' ').slice(0, 16);
  if (el.type === 'text') { v = v.toUpperCase().replace(/[\s-]/g, ''); el.value = v; }
  if (v === visTxt_(r[k])) return;
  visGuardar_(r, { [k]: v });
});
/* Enter en un número = guardar (el change se dispara al salir). */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const el = e.target.closest('#vis-cards input[type="text"][data-vk]');
  if (el) { e.preventDefault(); el.blur(); }
});

document.addEventListener('click', e => {
  const ver = e.target.closest('[data-vclave-ver]');
  if (ver) { visVerClave_(ver.dataset.vclaveVer); return; }
  const ocu = e.target.closest('[data-vclave-ocultar]');
  if (ocu) { delete VIS.clave[ocu.dataset.vclaveOcultar]; visRepintarFila_(ocu.dataset.vclaveOcultar); return; }
  const ed = e.target.closest('[data-vclave-editar]');
  if (ed) { visEditarClave_(ed.dataset.vclaveEditar); return; }
  const vu = e.target.closest('[data-vvuelo]');
  if (vu) visAbrirVuelo_(vu.dataset.vvuelo);
});

/* 5.3-B — Ver | Aprobar | Rechazar el itinerario: el mismo modal de
   documentos (regla global, correo por la cola). La respuesta trae la
   fila del panel y se parcha en memoria (sin recargar la lista). */
function visAbrirVuelo_(id) {
  const r = VIS.todos.find(x => x.id === id);
  if (!r || VIS.ocupado[id] || typeof NDOCS === 'undefined') return;
  const quien = currentUser && currentUser.id;
  NDOCS.abrir(r, {
    conVisa: true, enfocar: 'ITINERARIO',
    alCambiar: fila => {
      if (!currentUser || currentUser.id !== quien) return;        // sesión vieja
      visParchar_(fila); visRepintarFila_(id); visPintarTop_();
    }
  });
}

/* Escudo de la fila: desde el primer toque hasta la respuesta. */
function visOcupar_(id, on) {
  if (on) VIS.ocupado[id] = true; else delete VIS.ocupado[id];
  const c = visTarjeta_(id);
  if (!c) return;
  c.classList.toggle('is-ocupado', !!on);
  c.setAttribute('aria-busy', on ? 'true' : 'false');
  if (on) c.querySelectorAll('input, button, select').forEach(x => x.setAttribute('disabled', ''));
}

async function visGuardar_(r, cambios) {
  if (!r || VIS.ocupado[r.id]) { if (r) visRepintarFila_(r.id); return; }
  const id = r.id;
  visOcupar_(id, true);
  const quien = currentUser && currentUser.id;
  const t0 = Date.now();
  try {
    const out = await apiPost('visasGuardar', { usuarioId: quien, id: id, cambios: cambios }, { silent: true });
    visMed_('visasGuardar', t0);
    if (!currentUser || currentUser.id !== quien) return;          // sesión vieja
    visParchar_(out.fila);
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: String(e.message || e) });
  } finally {
    visOcupar_(id, false);
    visRepintarFila_(id);
    visPintarTop_();
  }
}

/* 5.2-C — el resultado consular cambia lo que ve el participante: se
   confirma antes (el escudo empieza en visGuardar_). */
async function visResultado_(r, v) {
  if (v === visTxt_(r.resultado)) return;
  const op = ((VIS.catalogo && VIS.catalogo.resultados) || []).find(o => o.k === v);
  const c = await Swal.fire({ icon: 'question',
    title: v ? 'Registrar resultado consular' : 'Quitar el resultado consular',
    html: '<b>' + esc_(r.nombres + ' ' + r.apellidos) + '</b><br>' +
      (v ? 'Resultado: <b>' + esc_(op ? op.l : v) + '</b>. Quedará registrado con tu nombre y la hora, y el participante lo verá.'
         : 'El participante vuelve a quedar en Embajada Americana.'),
    showCancelButton: true, confirmButtonText: v ? 'Registrar' : 'Quitar', cancelButtonText: 'Cancelar' });
  if (!c.isConfirmed) { visRepintarFila_(r.id); return; }
  return visGuardar_(r, { resultado: v });
}

/* Parche en memoria: la fila trae todo lo que pinta el panel. */
function visParchar_(fila) {
  if (!fila || !fila.id) return;
  const i = VIS.todos.findIndex(x => x.id === fila.id);
  if (i < 0) return;
  const r = VIS.todos[i];
  Object.keys(r).forEach(k => { if (!(k in fila)) delete r[k]; });   // casillas desmarcadas pierden quién/cuándo
  Object.assign(r, fila);
}

async function visVerClave_(id) {
  const r = VIS.todos.find(x => x.id === id);
  if (!r || VIS.ocupado[id]) return;
  const c = await Swal.fire({ icon: 'warning', title: 'Ver la clave del Sistema de Visa',
    html: '<b>' + esc_(r.nombres + ' ' + r.apellidos) + '</b><br>Quedará registrado que la viste, con tu nombre y la hora.',
    showCancelButton: true, confirmButtonText: 'Ver clave', cancelButtonText: 'Cancelar' });
  if (!c.isConfirmed || VIS.ocupado[id]) return;
  visOcupar_(id, true);
  const quien = currentUser && currentUser.id;
  const t0 = Date.now();
  try {
    const out = await apiPost('verClave', { usuarioId: quien, tipo: 'SISTEMA_VISA', id: id }, { silent: true });
    visMed_('verClave', t0);
    if (currentUser && currentUser.id === quien) VIS.clave[id] = out.clave || '';
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo mostrar', text: String(e.message || e) });
  } finally {
    visOcupar_(id, false);
    visRepintarFila_(id);
  }
}

async function visEditarClave_(id) {
  const r = VIS.todos.find(x => x.id === id);
  if (!r || VIS.ocupado[id]) return;
  const res = await Swal.fire({
    title: r.svHay ? '🔑 Cambiar la clave del Sistema de Visa' : '🔑 Guardar la clave del Sistema de Visa',
    html: '<b>' + esc_(r.nombres + ' ' + r.apellidos) + '</b><br><small>Queda oculta: solo PROCESOS y SUPERUSUARIO la ven, con registro.</small>',
    input: 'password', inputAttributes: { maxlength: '100', autocomplete: 'new-password' },
    inputPlaceholder: 'Clave', showCancelButton: true,
    confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar',
    showDenyButton: !!r.svHay, denyButtonText: 'Borrar la clave',
    inputValidator: v => (!visTxt_(v) && 'Escribe la clave (o usa Borrar la clave).')
  });
  if (res.isDenied) {
    const ok = await Swal.fire({ icon: 'warning', title: '¿Borrar la clave guardada?', showCancelButton: true,
      confirmButtonText: 'Sí, borrar', cancelButtonText: 'Cancelar' });
    if (!ok.isConfirmed) return;
    delete VIS.clave[id];
    return visGuardar_(r, { svClave: '' });
  }
  if (!res.isConfirmed) return;
  delete VIS.clave[id];
  return visGuardar_(r, { svClave: visTxt_(res.value) });
}

/* ============================================================
   ARRANQUE
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#proc-tile-visas')?.addEventListener('click', abrirVisas_);
  document.querySelector('#vis-refresh')?.addEventListener('click', () => { if (!VIS.cargando) recargarVisas_(); });
  document.querySelector('#vis-search')?.addEventListener('input', e => { VIS.texto = e.target.value || ''; visPintarTabla_(); });
});

/* Puerta para las pruebas automatizadas. */
window.__sepVisas = { VIS, abrirVisas_, visPintarTodo_, visVisibles_, visSalir_, visParchar_, visGuardar_,
                      visCardHtml_, visBloques_, visRepintarFila_, VIS_TOPS, visResultado_, visAbrirVuelo_ };
