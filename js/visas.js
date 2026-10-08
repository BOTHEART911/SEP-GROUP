/* =============================================================
 * SEP GROUP — PANEL DE VISAS (Fase 5 · Subfase 5.2 · Entregas B y C)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula
 * la garantía de funcionamiento.
 * ------------------------------------------------------------
 * QUÉ ES (pliego 5.2.3 y 5.2.4)
 *   Procesos → Visas: una fila por participante, tipo Excel, y la
 *   edición se hace EN LA FILA (casillas, números y fechas) sin entrar
 *   a otra pantalla. Cada casilla guarda quién y cuándo (se ve al
 *   pasar el mouse y en la fecha corta debajo).
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
 *     se PARCHA la fila en memoria y se repinta SOLO esa fila.
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
  ocupado: {},       // id → true mientras esa fila escribe (escudo)
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
  { clave: 'APROBADA',    label: 'Visa aprobada',             ic: '🛂', color: '#16a34a', f: r => r.resultado === 'APROBADA' }
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

/* ---------- celdas ---------- */
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

/* Casilla editable con quién/cuándo. */
function visCheck_(r, k, extraDis, titulo) {
  const on = !!r[k];
  const dis = VIS.ocupado[r.id] || extraDis;
  const tip = on ? ('Marcado por ' + (r[k + 'Q'] || '—') + ' · ' + (r[k + 'F'] || '')) : (titulo || 'Sin marcar');
  return `<label class="vis-chk${on ? ' is-on' : ''}" title="${esc_(tip)}">
      <input type="checkbox" data-vk="${k}"${on ? ' checked' : ''}${dis ? ' disabled' : ''}>
      ${on && r[k + 'F'] ? `<small>${esc_(visFechaCorta_(r[k + 'F']))}</small>` : ''}</label>`;
}
/* Casilla LEÍDA de un documento (no editable). */
function visLeida_(on, fecha, por, falta) {
  const tip = on ? ('Documento aprobado por ' + (por || '—') + ' · ' + (fecha || '')) : falta;
  return `<span class="vis-leida${on ? ' is-on' : ''}" title="${esc_(tip)}">${on ? '✅' : '⏳'}
      ${on && fecha ? `<small>${esc_(visFechaCorta_(fecha))}</small>` : ''}</span>`;
}
function visInput_(r, k, tipo, ph) {
  const v = r[k] || '';
  const val = tipo === 'datetime-local' ? v.replace(' ', 'T') : v;
  const dis = VIS.ocupado[r.id] ? ' disabled' : '';
  const cls = tipo === 'text' ? 'vis-in vis-in--num' : 'vis-in vis-in--fecha';
  return `<input class="${cls}" type="${tipo}" data-vk="${k}" value="${esc_(val)}"${ph ? ` placeholder="${esc_(ph)}"` : ''}
      ${tipo === 'text' ? 'maxlength="30" autocapitalize="characters" spellcheck="false"' : ''}${dis}>`;
}

function visClaveCelda_(r) {
  const puede = visPuedeClave_();
  const dis = VIS.ocupado[r.id] ? ' disabled' : '';
  if (!puede) return `<span class="vis-muted" title="Solo PROCESOS y SUPERUSUARIO">${r.svHay ? '🔒 Guardada' : '—'}</span>`;
  if (VIS.clave[r.id]) {
    return `<code class="veri-clave">${esc_(VIS.clave[r.id])}</code>
      <button class="veri-link" data-vclave-ocultar="${esc_(r.id)}">🙈</button>`;
  }
  return `${r.svHay ? `<span class="veri-oculta">••••••</span>
      <button class="veri-link" data-vclave-ver="${esc_(r.id)}" title="Ver clave (queda registrado)"${dis}>👁</button>` : '<span class="vis-muted">Sin clave</span>'}
      <button class="veri-link" data-vclave-editar="${esc_(r.id)}" title="${r.svHay ? 'Cambiar la clave' : 'Guardar la clave'}"${dis}>🔑</button>`;
}

function visPagoCelda_(r) {
  return `<span class="vis-tag ${r.pagoTotal ? 'is-ok' : 'is-pend'}">${r.pagoTotal ? '✅ Completado' : '⏳ Pendiente'}</span>
    <span class="vis-tag ${r.bancoTotal ? 'is-ok' : 'is-pend'}" title="Validado en banco (Contador)">🏦 ${r.bancoTotal ? 'Sí' : 'No'}</span>`;
}

function visDs2019Celda_(r) {
  if (r.ds2019) return '<span class="vis-muted">Ya recibido</span>';
  const falta = [];
  if (!r.spon) falta.push('Docs Sponsor');
  if (!r.pagoTotal) falta.push('pago total');
  const dis = !r.ds2019Sol && !r.ds2019Puede;
  return visCheck_(r, 'ds2019Sol', dis, dis ? 'Falta: ' + falta.join(' y ') : 'Lista para solicitar') +
    (dis ? `<small class="vis-falta">Falta ${esc_(falta.join(' y '))}</small>` : '');
}

/* 5.3-A — avance del participante en su módulo Visa (pasos 1 a 6). */
function visPasosV_(r) {
  if (r.pasosV == null) return '';
  const n = Number(r.pasosV) || 0;
  return `<small class="vis-pasosv${n === 6 ? ' is-ok' : ''}" title="Pasos del módulo Visa que completó el participante en su portal">Portal ${n}/6</small>`;
}

/* 5.2-C — Documentación consular: lista o qué le falta (lo dice el backend). */
function visConsularCelda_(r) {
  if (r.consular) return '<span class="vis-tag is-ok" title="Cumple las 7 condiciones">✅ Lista</span>';
  const cat = (VIS.catalogo && VIS.catalogo.consular) || [];
  const faltan = (r.consularFaltan || []).map(k => (cat.find(c => c.k === k) || { l: k }).l);
  return `<span class="vis-tag is-pend" title="${esc_('Falta: ' + faltan.join(', '))}">⏳ Faltan ${faltan.length}</span>
    <small class="vis-falta vis-falta--lista">${faltan.map(esc_).join('<br>')}</small>`;
}
function visCarpetaCelda_(r) {
  if (r.carpeta) {
    return visCheck_(r, 'carpeta', !!r.resultado, 'Carpeta entregada') +
      (r.resultado ? '<small class="vis-falta">Quita el resultado para desmarcarla</small>' : '');
  }
  return visCheck_(r, 'carpeta', !r.consular, r.consular ? 'Lista para entregar' : 'Requiere la documentación consular lista') +
    (r.consular ? '' : '<small class="vis-falta">Requiere doc. lista</small>');
}
function visResultadoCelda_(r) {
  const ops = (VIS.catalogo && VIS.catalogo.resultados) || [];
  const dis = VIS.ocupado[r.id] || !r.carpeta;
  const v = r.resultado || '';
  const tip = v ? ('Registrado por ' + (r.resultadoQ || '—') + ' · ' + (r.resultadoF || '')) : (r.carpeta ? 'Sin registrar' : 'Se registra con la carpeta entregada');
  return `<select class="vis-in vis-sel${v ? ' is-on vis-res--' + v.toLowerCase() : ''}" data-vk="resultado" title="${esc_(tip)}"${dis ? ' disabled' : ''}>
      <option value="">— Sin registrar —</option>
      ${ops.map(o => `<option value="${esc_(o.k)}"${o.k === v ? ' selected' : ''}>${esc_(o.ic + ' ' + o.l)}</option>`).join('')}
    </select>${v && r.resultadoF ? `<small class="vis-falta">${esc_((r.resultadoQ || '') + ' · ' + visFechaCorta_(r.resultadoF))}</small>` : ''}`;
}

function visFilaHtml_(r) {
  const oc = VIS.ocupado[r.id];
  return `<tr data-vid="${esc_(r.id)}" class="${oc ? 'is-ocupado' : ''}${r.inactivo ? ' is-inactivo' : ''}">
    <th class="vis-sticky" scope="row">
      <div class="vis-nom">${esc_(r.nombres)} ${esc_(r.apellidos)}</div>
      <div class="vis-sub">${r.n ? 'N° ' + r.n + ' · ' : ''}${esc_(r.documento || '')}</div>
      <div class="vis-sub ${r.asesorProcesos ? '' : 'veri-falta'}">🧭 ${esc_(r.asesorProcesos || 'sin asesor')}</div>
      ${typeof estPartHtml_ === 'function' ? estPartHtml_(r) : ''}
    </th>
    <td class="vis-dato">${esc_(r.telefono || '—')}</td>
    <td class="vis-dato vis-dato--mail">${esc_(r.correo || '—')}</td>
    <td class="vis-dato">${esc_(visIsoCorta_(r.nacimiento) || '—')}</td>
    <td class="vis-dato">${esc_(r.pasaporte || '—')}</td>
    <td class="vis-dato">${esc_(r.sponsor || '—')}</td>
    <td class="g1">${visCheck_(r, 'ds160i')}</td>
    <td class="g1">${visInput_(r, 'ds160iNum', 'text', 'N°')}</td>
    <td class="g2">${visCheck_(r, 'sv')}</td>
    <td class="g2 vis-clave">${visClaveCelda_(r)}</td>
    <td class="g1">${visCheck_(r, 'pv')}</td>
    <td class="g2">${visCheck_(r, 'cita', !r.cita && !(r.cas && r.consul), 'Requiere Fecha/Hora CAS y Consulado')}</td>
    <td class="g2">${visInput_(r, 'start', 'date')}</td>
    <td class="g2">${visInput_(r, 'cas', 'datetime-local')}</td>
    <td class="g2">${visInput_(r, 'consul', 'datetime-local')}</td>
    <td class="g1">${visLeida_(r.ds160r, r.ds160rF, r.ds160rQ, 'Se marca cuando SEP aprueba el DS-160 (copia y confirmación) en Mis documentos')}</td>
    <td class="g1">${visInput_(r, 'ds160rNum', 'text', 'N°')}</td>
    <td class="g2">${visInput_(r, 'sevisNum', 'text', 'N°')}</td>
    <td class="g2">${visLeida_(r.sevis, r.sevisF, r.sevisQ, 'Se marca cuando SEP aprueba la confirmación del pago SEVIS en Mis documentos')}</td>
    <td class="g1 vis-pago">${visPagoCelda_(r)}</td>
    <td class="g2">${visCheck_(r, 'spon')}</td>
    <td class="g2">${visDs2019Celda_(r)}</td>
    <td class="g2">${visLeida_(r.ds2019, r.ds2019F, r.ds2019Q, 'Se marca cuando SEP aprueba el DS-2019 en Mis documentos')}</td>
    <td class="g1">${visCheck_(r, 'ase')}${visPasosV_(r)}</td>
    <td class="g1">${visCheck_(r, 'pre')}</td>
    <td class="g3 vis-cons">${visConsularCelda_(r)}</td>
    <td class="g3">${visCarpetaCelda_(r)}</td>
    <td class="g3">${visResultadoCelda_(r)}</td>
  </tr>`;
}

const VIS_CABECERA = `<thead>
  <tr class="vis-grupos">
    <th class="vis-sticky" rowspan="2">Participante</th>
    <th colspan="5">Datos existentes</th>
    <th colspan="2" class="g1">DS-160 interno</th>
    <th colspan="2" class="g2">Sistema Visa</th>
    <th class="g1">Pago Visa</th>
    <th colspan="4" class="g2">Cita</th>
    <th colspan="2" class="g1">DS-160 Real</th>
    <th colspan="2" class="g2">SEVIS</th>
    <th class="g1">Pago programa</th>
    <th colspan="3" class="g2">Sponsor y DS-2019</th>
    <th class="g1">Asesoría Visa</th>
    <th class="g1">Pre-Arrival</th>
    <th colspan="3" class="g3">Consular</th>
  </tr>
  <tr>
    <th>Teléfono</th><th>Correo</th><th>Nacimiento</th><th>Pasaporte</th><th>Sponsor</th>
    <th class="g1">☐</th><th class="g1">Número</th>
    <th class="g2">☐</th><th class="g2">Clave</th>
    <th class="g1">☐</th>
    <th class="g2">☐ Agendada</th><th class="g2">Start Date</th><th class="g2">CAS</th><th class="g2">Consulado</th>
    <th class="g1" title="Leído de Mis documentos">☑ (doc)</th><th class="g1">Número</th>
    <th class="g2">Número</th><th class="g2" title="Leído de Mis documentos">☑ Pago (doc)</th>
    <th class="g1">Contador</th>
    <th class="g2">☐ Docs Sponsor</th><th class="g2">☐ Solicitado</th><th class="g2" title="Leído de Mis documentos">☑ Recibido (doc)</th>
    <th class="g1">☐ Completada</th>
    <th class="g1">☐ Completado</th>
    <th class="g3" title="Automática: DS-2019, SEVIS, DS-160 Real con N°, pago Completado y validado, Verificación Académica y Asesoría">Documentación</th>
    <th class="g3">☐ Carpeta entregada</th><th class="g3" title="Solo SEP lo registra">Resultado</th>
  </tr></thead>`;

function visPintarTabla_() {
  const cont = visQ_('#vis-tabla'), vacio = visQ_('#vis-empty');
  if (!cont) return;
  const l = visVisibles_();
  vacio?.classList.toggle('hidden', l.length > 0);
  cont.classList.toggle('hidden', !l.length);
  if (!l.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = `<table class="vis-tabla">${VIS_CABECERA}<tbody>${l.map(visFilaHtml_).join('')}</tbody></table>`;
  const cnt = visQ_('#vis-count'); if (cnt) cnt.textContent = l.length + ' de ' + VIS.registros.length;
}

/* Repinta SOLO una fila (tras guardar o al ocupar/liberar). */
function visRepintarFila_(id) {
  const tr = document.querySelector('#vis-tabla tr[data-vid="' + CSS.escape(id) + '"]');
  const r = VIS.todos.find(x => x.id === id);
  if (!tr || !r) return;
  const tmp = document.createElement('tbody');
  tmp.innerHTML = visFilaHtml_(r);
  tr.replaceWith(tmp.firstElementChild);
}

/* ============================================================
   EDICIÓN EN LA FILA (delegada: un oyente para toda la tabla)
   ============================================================ */
function visFilaDe_(el) {
  const tr = el.closest('tr[data-vid]');
  return tr ? VIS.todos.find(x => x.id === tr.dataset.vid) : null;
}

document.addEventListener('change', e => {
  const el = e.target.closest('#vis-tabla [data-vk]');
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
  const el = e.target.closest('#vis-tabla input[type="text"][data-vk]');
  if (el) { e.preventDefault(); el.blur(); }
});

document.addEventListener('click', e => {
  const ver = e.target.closest('[data-vclave-ver]');
  if (ver) { visVerClave_(ver.dataset.vclaveVer); return; }
  const ocu = e.target.closest('[data-vclave-ocultar]');
  if (ocu) { delete VIS.clave[ocu.dataset.vclaveOcultar]; visRepintarFila_(ocu.dataset.vclaveOcultar); return; }
  const ed = e.target.closest('[data-vclave-editar]');
  if (ed) visEditarClave_(ed.dataset.vclaveEditar);
});

/* Escudo de la fila: desde el primer toque hasta la respuesta. */
function visOcupar_(id, on) {
  if (on) VIS.ocupado[id] = true; else delete VIS.ocupado[id];
  const tr = document.querySelector('#vis-tabla tr[data-vid="' + CSS.escape(id) + '"]');
  if (!tr) return;
  tr.classList.toggle('is-ocupado', !!on);
  if (on) tr.querySelectorAll('input, button').forEach(x => x.setAttribute('disabled', ''));
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
                      visFilaHtml_, VIS_TOPS, visResultado_ };
