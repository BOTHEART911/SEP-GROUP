/* =============================================================
 * SEP GROUP — VERIFICACIÓN ACADÉMICA (Fase 5 · Subfase 5.2 · Entrega A)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula
 * la garantía de funcionamiento.
 * ------------------------------------------------------------
 * QUÉ ES (pliego 5.2.2)
 *   Procesos → Verificación Académica. Lista de quienes ya tienen el
 *   formulario aprobado, con:
 *     · filtros superiores Pendiente | Pendiente de consentimiento |
 *       Revisado, y pastillas por Asesor y por Sponsor; el año sale
 *       del selector común de temporada (TEMP);
 *     · detalle: datos existentes, secciones 6 y 7 del formulario,
 *       certificados con Ver | Aprobar | Rechazar (la MISMA regla
 *       global de documentos: docRevisar), notas internas y resultado
 *       (Aprobado | Rechazado | Aprobado condicionalmente + ☐
 *       Consentimiento firmado).
 *
 * RENDIMIENTO (reglas de la casa)
 *   · Una vista, un viaje: verifInit trae catálogo + lista; el detalle
 *     es otro viaje (verifDetalle) y antes de que llegue se pinta la
 *     cabecera con lo que ya se sabe de la fila.
 *   · Lista cargada una vez por sesión; filtros y búsqueda locales.
 *     Tras guardar se PARCHA la fila en memoria: no se recarga nada.
 *   · Las lecturas se cortan (AbortController) al salir de la vista o
 *     cerrar el detalle; los guardados nunca se cortan.
 *   · Toda escritura: escudo desde el primer toque + rid (apiPost).
 *   · Respuesta de una sesión vieja nunca pisa la nueva (se compara el
 *     usuario con el que se despachó).
 *   · Tiempos de pantalla en window.__sepMed (regla de medición).
 *
 * Usa de app.js: apiGet, apiPost, showView, esc_, currentUser,
 * estPartCargar_, estPartHtml_, procesoChipHtml_; de temporada.js: TEMP;
 * de nivel-perfil.js: NPERFIL.visor.
 * ============================================================= */

const VERI = {
  todos: [], registros: [], catalogo: null, cargado: false, cargando: false,
  filtroTop: '__ALL__', filtroAsesor: '__ALL__', filtroSponsor: '__ALL__', texto: '',
  sheetKey: null,
  ctrl: null,          // AbortController de la lectura de la lista
  ctrlDet: null,       // AbortController de la lectura del detalle
  actual: null,        // fila abierta en el detalle
  det: null,           // respuesta de verifDetalle
  ocupado: false,      // escudo de escritura
  clave: ''            // clave del portal ya revelada en este detalle
};
const VERI_SIN = '— Sin asignar —';

function veriTxt_(v) { return String(v == null ? '' : v).trim(); }
function veriMed_(ruta, t0) {
  try {
    const ms = Date.now() - t0;
    (window.__sepMed = window.__sepMed || []).push({ ruta: ruta, ms: ms, t: Date.now() });
    if (window.console) console.info('[med] ' + ruta + ' ' + ms + ' ms');
  } catch (_) {}
}
function veriAbortado_(e) { return !!(e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')))); }

/* ============================================================
   ENTRADA
   ============================================================ */
function veriPuedeEntrar_() {
  const u = currentUser || {};
  const mios = ((typeof misRoles_ === 'function') ? (misRoles_(u) || [])
    : ((Array.isArray(u.roles) && u.roles.length) ? u.roles : [u.rol])).map(r => String(r || '').toUpperCase());
  return ['DESARROLLADOR', 'SUPERUSUARIO', 'PROCESOS'].some(r => mios.indexOf(r) >= 0);
}

function abrirVerif_() {
  if (!veriPuedeEntrar_()) {
    Swal.fire({ icon: 'warning', title: 'Sin permiso',
      text: 'Solo PROCESOS, SUPERUSUARIO o DESARROLLADOR entran a Verificación Académica.' });
    return;
  }
  /* Navegación primero: la vista se pinta ya; los datos llegan detrás. */
  showView('verif');
  if (VERI.cargado) { veriPintarTodo_(); return; }
  if (!VERI.cargando) cargarVerif_();
}

async function cargarVerif_() {
  VERI.cargando = true;
  try { VERI.ctrl && VERI.ctrl.abort(); } catch (_) {}
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  VERI.ctrl = ctrl;
  const quien = currentUser && currentUser.id;
  const t0 = Date.now();
  try {
    const d = await apiGet('verifInit', { usuarioId: quien }, ctrl ? { signal: ctrl.signal } : {});
    if (!currentUser || currentUser.id !== quien) return;          // sesión vieja
    veriMed_('verifInit', t0);
    VERI.catalogo = d.catalogo || {};
    if (typeof estPartCargar_ === 'function') estPartCargar_(VERI.catalogo.estadosPart);
    if (typeof TEMP !== 'undefined') { TEMP.set(d.temporadas); TEMP.montar('verif'); }
    VERI.todos = d.registros || [];
    VERI.registros = (typeof TEMP !== 'undefined') ? TEMP.filtrar(VERI.todos) : VERI.todos.slice();
    VERI.cargado = true;
    veriPintarTodo_();
  } catch (e) {
    if (veriAbortado_(e)) return;
    Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: String(e.message || e) });
  } finally {
    if (VERI.ctrl === ctrl) { VERI.ctrl = null; VERI.cargando = false; }
  }
}

/* Botón actualizar: única relectura a pedido (no hay relojes). */
function recargarVerif_() {
  VERI.cargado = false;
  cargarVerif_();
}

/* Al salir de la vista se corta la lectura en curso (nunca un guardado). */
function veriSalir_() {
  try { VERI.ctrl && VERI.ctrl.abort(); } catch (_) {}
  VERI.ctrl = null; VERI.cargando = false;
}

if (typeof TEMP !== 'undefined') {
  TEMP.alCambiar(() => {
    if (!VERI.cargado) return;
    VERI.registros = TEMP.filtrar(VERI.todos);
    try { veriPintarTodo_(); } catch (e) { console.error(e); }
  });
}

/* ============================================================
   FILTROS (todos locales)
   ============================================================ */
function veriVeTodos_() { return !!(VERI.catalogo && VERI.catalogo.permisos && VERI.catalogo.permisos.verTodos); }
function veriAsesorDe_(r) { return veriTxt_(r.asesorProcesos) || VERI_SIN; }
function veriSponsorDe_(r) { return veriTxt_(r.sponsor) || VERI_SIN; }
function veriFiltroDef_(clave) {
  return ((VERI.catalogo && VERI.catalogo.filtros) || []).find(f => f.clave === clave) ||
         { clave: clave, label: clave, ic: '•', color: '#64748b' };
}
function veriResDef_(clave) {
  return ((VERI.catalogo && VERI.catalogo.resultados) || []).find(f => f.clave === clave) || null;
}

/* Cascada: asesor → sponsor → filtro superior. Los conteos de cada
   capa se calculan sobre lo que dejó la anterior. */
function veriBaseAsesor_() {
  const b = VERI.registros;
  return VERI.filtroAsesor === '__ALL__' ? b : b.filter(r => veriAsesorDe_(r) === VERI.filtroAsesor);
}
function veriBaseSponsor_() {
  const b = veriBaseAsesor_();
  return VERI.filtroSponsor === '__ALL__' ? b : b.filter(r => veriSponsorDe_(r) === VERI.filtroSponsor);
}
function veriBaseTop_() {
  const b = veriBaseSponsor_();
  return VERI.filtroTop === '__ALL__' ? b : b.filter(r => r.filtro === VERI.filtroTop);
}

const VERI_PILLS = [
  { key: 'asesor',  allLabel: 'Todos los asesores', titulo: 'Filtrar por Asesor de Procesos', ic: '🧭', color: '#7c3aed', soloTodos: true },
  { key: 'sponsor', allLabel: 'Todos los sponsors', titulo: 'Filtrar por Sponsor',            ic: '🏢', color: '#0f766e' }
];
function veriPills_() { return VERI_PILLS.filter(p => !p.soloTodos || veriVeTodos_()); }
function veriValPill_(k) { return k === 'asesor' ? VERI.filtroAsesor : VERI.filtroSponsor; }
function veriSetPill_(k, v) {
  if (k === 'asesor') { VERI.filtroAsesor = v; VERI.filtroSponsor = '__ALL__'; }
  else VERI.filtroSponsor = v;
}
function veriOpciones_(k) {
  const c = {};
  const base = k === 'asesor' ? VERI.registros : veriBaseAsesor_();
  base.forEach(r => { const v = k === 'asesor' ? veriAsesorDe_(r) : veriSponsorDe_(r); c[v] = (c[v] || 0) + 1; });
  return Object.keys(c).sort((a, b) => a.localeCompare(b)).map(v => ({ valor: v, label: v, count: c[v] }));
}

/* ============================================================
   PINTADO DE LA VISTA
   ============================================================ */
function veriPintarTodo_() { veriPintarTop_(); veriPintarPills_(); veriPintarCards_(); }

function veriPintarTop_() {
  const cont = document.querySelector('#veri-resumen'); if (!cont) return;
  const base = veriBaseSponsor_();
  const c = {};
  base.forEach(r => { c[r.filtro] = (c[r.filtro] || 0) + 1; });
  const filtros = (VERI.catalogo && VERI.catalogo.filtros) || [];
  cont.innerHTML = filtros.map(f => `<button class="conta-kpi veri-top${VERI.filtroTop === f.clave ? ' is-on' : ''}"
      data-top="${f.clave}" style="--k:${f.color}" aria-pressed="${VERI.filtroTop === f.clave}">
      <span class="conta-kpi__n">${c[f.clave] || 0}</span>
      <span class="conta-kpi__t">${f.ic} ${esc_(f.label)}</span></button>`).join('');
  cont.querySelectorAll('[data-top]').forEach(b => b.addEventListener('click', () => {
    VERI.filtroTop = VERI.filtroTop === b.dataset.top ? '__ALL__' : b.dataset.top;
    veriPintarTop_(); veriPintarCards_();
  }));
}

function veriPintarPills_() {
  const cont = document.querySelector('#veri-filters'); if (!cont) return;
  cont.innerHTML = veriPills_().map(f => {
    const val = veriValPill_(f.key), on = val !== '__ALL__';
    const n = f.key === 'asesor' ? veriBaseAsesor_().length : veriBaseSponsor_().length;
    return `<button class="fpill ${on ? 'is-on' : ''}" id="vfp-${f.key}" style="--fp:${f.color}" aria-haspopup="dialog"
        title="${esc_(on ? val : f.allLabel)}">
      <span class="fpill__ic">${f.ic}</span><span class="fpill__label">${esc_(on ? val : f.allLabel)}</span>
      <span class="fpill__count">${n}</span>
      <svg class="fpill__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>`;
  }).join('');
  veriPills_().forEach(f => document.querySelector('#vfp-' + f.key)?.addEventListener('click', () => veriAbrirSheet_(f.key)));
}

function veriAbrirSheet_(key) {
  const f = veriPills_().find(x => x.key === key); if (!f) return;
  const sheet = document.querySelector('#veri-fsheet'), lista = document.querySelector('#veri-fsheet-list');
  if (!sheet || !lista) return;
  VERI.sheetKey = key;
  document.querySelector('#veri-fsheet-title').textContent = f.titulo;
  const actual = veriValPill_(key);
  const total = key === 'asesor' ? VERI.registros.length : veriBaseAsesor_().length;
  const opt = (o, sel, all) => `<button class="fopt ${sel ? 'is-sel' : ''} ${all ? 'is-all' : ''}" data-valor="${esc_(o.valor)}">
      <span class="fopt__ic">${f.ic}</span><span class="fopt__label">${esc_(o.label)}</span>
      <span class="fopt__count">${o.count}</span><span class="fopt__check">✓</span></button>`;
  lista.innerHTML = opt({ valor: '__ALL__', label: f.allLabel, count: total }, actual === '__ALL__', true) +
    veriOpciones_(key).map(o => opt(o, actual === o.valor, false)).join('');
  lista.querySelectorAll('.fopt').forEach(b => b.addEventListener('click', () => {
    veriSetPill_(key, b.dataset.valor);
    veriCerrarSheet_(); veriPintarTodo_();
  }));
  sheet.classList.remove('hidden'); sheet.setAttribute('aria-hidden', 'false');
}
function veriCerrarSheet_() {
  const s = document.querySelector('#veri-fsheet'); if (!s) return;
  s.classList.add('hidden'); s.setAttribute('aria-hidden', 'true'); VERI.sheetKey = null;
}
document.addEventListener('click', e => { if (e.target.closest('[data-veri-fsheet-close]')) veriCerrarSheet_(); });

function veriNorm_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

function veriVisibles_() {
  const q = veriNorm_(VERI.texto.trim());
  let l = veriBaseTop_();
  if (q) l = l.filter(r =>
    veriNorm_(r.nombres + ' ' + r.apellidos).includes(q) || String(r.documento || '').includes(q) ||
    String(r.whatsapp || '').includes(q) || veriNorm_(r.correo).includes(q) || String(r.n).includes(q));
  return l;
}

/* Sello de verificación de una fila: resultado + consentimiento. */
function veriSelloHtml_(r) {
  const f = veriFiltroDef_(r.filtro);
  const res = veriResDef_(r.resultado);
  let txt = res ? res.ic + ' ' + res.label : f.ic + ' ' + f.label;
  if (r.resultado === 'APROBADO_COND') txt += r.consentimiento ? ' · ✍️ consentimiento firmado' : ' · ✍️ falta el consentimiento';
  const color = res ? res.color : f.color;
  return `<span class="veri-sello" style="--k:${color}" title="${esc_(r.resultadoPor ? 'Por ' + r.resultadoPor + ' · ' + r.resultadoFecha : f.label)}">${esc_(txt)}</span>`;
}

function veriCardHtml_(r) {
  const f = veriFiltroDef_(r.filtro);
  const res = veriResDef_(r.resultado);
  return `<div class="com-card veri-card" data-id="${esc_(r.id)}">
    <div class="com-card__stripe" style="background:${res ? res.color : f.color}"></div>
    <div class="com-card__head">
      <h3 class="com-card__name">${esc_(r.nombres)} ${esc_(r.apellidos)}</h3>
      ${r.correo ? `<div class="com-card__email">📧 ${esc_(r.correo)}</div>` : ''}
      <div class="com-card__meta">
        ${r.documento ? `<span>🆔 ${esc_(r.documento)}</span>` : ''}
        ${r.whatsapp ? `<span>📱 ${esc_(r.whatsapp)}</span>` : ''}
        <span class="${r.asesorProcesos ? '' : 'veri-falta'}">🧭 ${esc_(r.asesorProcesos || 'sin asesor')}</span>
        ${r.sponsor ? `<span>🏢 ${esc_(r.sponsor)}</span>` : ''}
        ${typeof procesoChipHtml_ === 'function' ? procesoChipHtml_(r.proceso, false) : ''}
        ${r.n ? `<span class="com-card__id">N° ${r.n}</span>` : ''}
      </div>
      ${typeof estPartHtml_ === 'function' ? estPartHtml_(r) : ''}
    </div>
    <div class="veri-card__res">
      ${veriSelloHtml_(r)}
      ${r.tieneNotas ? '<span class="veri-nota-ic" title="Tiene notas internas">🗒️ con notas</span>' : ''}
    </div>
    <div class="com-card__actions">
      <button class="act-btn act-editar" data-veri-abrir="${esc_(r.id)}">🔎 Verificar</button>
    </div>
  </div>`;
}

function veriPintarCards_() {
  const cont = document.querySelector('#veri-cards'), vacio = document.querySelector('#veri-empty');
  if (!cont) return;
  const l = veriVisibles_();
  vacio?.classList.toggle('hidden', l.length > 0);
  cont.innerHTML = l.map(veriCardHtml_).join('');
}

/* Delegado: un solo oyente para todas las tarjetas. */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-veri-abrir]');
  if (!b) return;
  const r = VERI.todos.find(x => x.id === b.dataset.veriAbrir);
  if (r) veriAbrirDetalle_(r);
});

/* ============================================================
   DETALLE
   ============================================================ */
function veriQ_(s) { return document.querySelector(s); }

function veriAbrirDetalle_(r) {
  VERI.actual = r; VERI.det = null; VERI.clave = '';
  veriQ_('#veri-det-title').textContent = '🔎 Verificación Académica';
  veriQ_('#veri-det-sub').textContent = veriTxt_(r.nombres + ' ' + r.apellidos) + (r.documento ? ' · ' + r.documento : '');
  /* Cabecera antes que datos: lo que ya se sabe de la fila. */
  veriQ_('#veri-det-datos').innerHTML = veriDatosHtml_(r);
  veriQ_('#veri-det-res').innerHTML = veriResultadoHtml_(r, null);
  veriQ_('#veri-det-body').innerHTML = '';
  veriQ_('#modal-veri').classList.remove('hidden');
  veriCablearResultado_();
  veriCargarDetalle_(r);
}

function veriCerrarDetalle_() {
  try { VERI.ctrlDet && VERI.ctrlDet.abort(); } catch (_) {}
  VERI.ctrlDet = null;
  veriQ_('#modal-veri')?.classList.add('hidden');
  VERI.actual = null; VERI.det = null; VERI.clave = '';
}

async function veriCargarDetalle_(r) {
  try { VERI.ctrlDet && VERI.ctrlDet.abort(); } catch (_) {}
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  VERI.ctrlDet = ctrl;
  const quien = currentUser && currentUser.id;
  const t0 = Date.now();
  try {
    const d = await apiGet('verifDetalle', { usuarioId: quien, id: r.id }, ctrl ? { signal: ctrl.signal } : {});
    if (!currentUser || currentUser.id !== quien || VERI.actual !== r) return;
    veriMed_('verifDetalle', t0);
    VERI.det = d;
    veriPintarDetalle_();
  } catch (e) {
    if (veriAbortado_(e)) return;
    veriQ_('#veri-det-body').innerHTML = `<p class="conta-sub">${esc_(e.message || e)}</p>`;
  } finally {
    if (VERI.ctrlDet === ctrl) VERI.ctrlDet = null;
  }
}

function veriDatosHtml_(r) {
  const fila = (ic, l, v, falta) => `<div class="veri-dato"><span class="veri-dato__l">${ic} ${l}</span>
      <span class="veri-dato__v${falta ? ' veri-falta' : ''}">${esc_(v)}</span></div>`;
  return `<div class="veri-datos">
    ${fila('🧭', 'Asesor', r.asesorProcesos || 'Sin asesor asignado', !r.asesorProcesos)}
    ${fila('👤', 'Nombres', r.nombres || '—')}
    ${fila('👤', 'Apellidos', r.apellidos || '—')}
    ${fila('📱', 'Teléfono', r.whatsapp || '—')}
    ${fila('📧', 'Correo', r.correo || '—')}
    ${r.sponsor ? fila('🏢', 'Sponsor', r.sponsor) : ''}
  </div>`;
}

/* Resultado + consentimiento + notas. `v` = bloque verif del detalle
   (o null mientras llega: se pinta con lo que trae la fila). */
function veriResultadoHtml_(r, v) {
  const x = v || r;
  const res = (VERI.catalogo && VERI.catalogo.resultados) || [];
  const ocupado = VERI.ocupado ? ' disabled' : '';
  const radios = res.map(o => `<label class="veri-opt${x.resultado === o.clave ? ' is-on' : ''}" style="--k:${o.color}">
      <input type="radio" name="veri-res" value="${o.clave}"${x.resultado === o.clave ? ' checked' : ''}${ocupado}>
      <span>${o.ic} ${esc_(o.label)}</span></label>`).join('');
  const cond = x.resultado === 'APROBADO_COND';
  const notas = v ? v.notas : null;
  return `<section class="veri-sec">
      <h4 class="veri-sec__t">🏁 Resultado de la verificación</h4>
      <div class="veri-opts">${radios}</div>
      ${x.resultado ? `<p class="veri-meta">Registrado por ${esc_(x.resultadoPor || '—')} · ${esc_(x.resultadoFecha || '')}
          <button class="veri-link" id="veri-res-quitar"${ocupado}>↩️ Volver a pendiente</button></p>` : ''}
      ${cond ? `<label class="veri-consent${x.consentimiento ? ' is-on' : ''}">
          <input type="checkbox" id="veri-consent"${x.consentimiento ? ' checked' : ''}${ocupado}>
          <span>✍️ Consentimiento firmado</span></label>
          <p class="veri-meta">${x.consentimiento
            ? 'Marcado por ' + esc_(x.consentimientoPor || '—') + ' · ' + esc_(x.consentimientoFecha || '')
            : 'Mientras no esté marcado queda en <b>Pendiente de consentimiento</b>.'}</p>` : ''}
      <p class="veri-valida ${x.valida ? 'is-ok' : ''}">${x.valida
        ? '✅ Válido para la Documentación consular.'
        : '⏳ Todavía no cuenta para la Documentación consular (requiere Aprobado, o Aprobado condicionalmente con consentimiento).'}</p>
    </section>
    <section class="veri-sec">
      <h4 class="veri-sec__t">🗒️ Notas de Verificación Académica <small>(internas · el participante no las ve)</small></h4>
      ${notas === null ? '<div class="veri-cargando">Cargando notas…</div>' : `
        <textarea id="veri-notas" maxlength="3000" rows="4" placeholder="Escribe aquí lo que revisaste…"${ocupado}>${esc_(notas)}</textarea>
        <div class="veri-notas-pie">
          <span class="veri-meta">${v.notasPor ? 'Última edición: ' + esc_(v.notasPor) + ' · ' + esc_(v.notasFecha) : ''}</span>
          <button class="btn btn-primary" id="veri-notas-ok"${ocupado}>💾 Guardar notas</button>
        </div>`}
    </section>`;
}

function veriBloquesHtml_(d) {
  if (!d.formularioExiste) return '<p class="conta-sub">El participante todavía no tiene formulario guardado.</p>';
  return d.bloques.map(b => `<section class="veri-sec veri-form">
      <h4 class="veri-sec__t">${esc_(b.icono)} Sección ${b.n} · ${esc_(b.titulo)}</h4>
      ${b.campos.map(veriCampoHtml_).join('') || '<p class="conta-sub">Sin datos en esta sección.</p>'}
    </section>`).join('');
}

function veriCampoHtml_(c) {
  let v;
  if (c.t === 'lista') {
    v = c.filas.length
      ? `<div class="veri-tabla-w"><table class="veri-tabla"><thead><tr>${c.cols.map(x => `<th>${esc_(x.l)}</th>`).join('')}</tr></thead>
         <tbody>${c.filas.map(f => `<tr>${c.cols.map(x => `<td>${esc_(f[x.k] || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : '<span class="veri-falta">—</span>';
  } else if (c.t === 'chips') {
    v = c.v.length ? c.v.map(x => `<span class="veri-chip">${esc_(x)}</span>`).join('') : '<span class="veri-falta">—</span>';
  } else if (c.t === 'secreto') {
    if (!c.hay) v = '<span class="veri-falta">No la ha escrito</span>';
    else if (VERI.clave) v = `<code class="veri-clave">${esc_(VERI.clave)}</code> <button class="veri-link" id="veri-clave-ocultar">🙈 Ocultar</button>`;
    else v = `<span class="veri-oculta">••••••••</span> <button class="veri-link" id="veri-clave-ver"${VERI.ocupado ? ' disabled' : ''}>👁 Ver clave</button>
              <small class="veri-meta">Queda registrado quién la ve.</small>`;
  } else if (c.t === 'url' && c.v) {
    v = `<a href="${esc_(c.v)}" target="_blank" rel="noopener noreferrer">${esc_(c.v)}</a>`;
  } else {
    v = c.v ? esc_(c.v) : '<span class="veri-falta">—</span>';
  }
  return `<div class="veri-campo"><div class="veri-campo__l">${esc_(c.l)}</div><div class="veri-campo__v">${v}</div></div>`;
}

function veriCertsHtml_(d) {
  const reabrir = !!d.puedeReabrirDoc;
  return `<section class="veri-sec">
    <h4 class="veri-sec__t">🎓 Certificados académicos</h4>
    <p class="veri-meta">Se revisan con la regla de documentos: al aprobarlo queda bloqueado; si lo rechazas vuelve a pendiente con tu motivo y al participante le llega un correo.</p>
    ${d.certificados.map(c => {
      const acc = [];
      if (c.tieneArchivo) acc.push(`<button class="act-btn" data-cert-ver="${esc_(c.clave)}">👁 Ver</button>`);
      if (c.tieneArchivo && c.estado === 'EN_REVISION') {
        acc.push(`<button class="act-btn act-btn--ok" data-cert-ok="${esc_(c.clave)}"${VERI.ocupado ? ' disabled' : ''}>✅ Aprobar</button>`);
        acc.push(`<button class="act-btn act-btn--rojo" data-cert-no="${esc_(c.clave)}"${VERI.ocupado ? ' disabled' : ''}>✖ Rechazar</button>`);
      }
      if (c.bloqueado && reabrir) acc.push(`<button class="act-btn act-btn--rojo" data-cert-no="${esc_(c.clave)}"${VERI.ocupado ? ' disabled' : ''}>↩️ Reabrir (rechazar)</button>`);
      return `<div class="ndoc veri-cert">
        <div class="ndoc-h"><span class="ndoc-n">${esc_(c.nombre)}</span>
          <span class="ndoc-pill" style="background:${esc_(c.estadoColor)}">${esc_(c.estadoIc)} ${esc_(c.estadoLabel)}</span></div>
        <div class="ndoc-meta">${c.fechaCarga ? 'Cargado el ' + esc_(c.fechaCarga) : (c.porQue ? esc_(c.porQue) : 'Sin archivo')}
          ${c.revisadoPor ? ' · Revisó ' + esc_(c.revisadoPor) + (c.fechaRevision ? ' el ' + esc_(c.fechaRevision) : '') : ''}</div>
        ${c.estado === 'RECHAZADO' && c.nota ? `<div class="ndoc-nota"><b>Motivo del rechazo:</b> ${esc_(c.nota)}</div>` : ''}
        <div class="ndoc-acc">${acc.join('')}</div>
      </div>`;
    }).join('')}
  </section>`;
}

function veriHistHtml_(v) {
  const h = (v && v.historial) || [];
  if (!h.length) return '';
  return `<section class="veri-sec"><details class="ndoc-traza"><summary>🕓 Trazabilidad (${h.length})</summary><ol>
    ${h.map(x => `<li><b>${esc_(x.accion)}</b>${x.detalle ? ' · ' + esc_(x.detalle) : ''} · ${esc_(x.quien || '—')}
      · <span class="ndoc-traza-f">${esc_(x.fecha)}</span></li>`).join('')}</ol></details></section>`;
}

function veriPintarDetalle_() {
  const d = VERI.det, r = VERI.actual;
  if (!d || !r) return;
  veriQ_('#veri-det-res').innerHTML = veriResultadoHtml_(r, d.verif);
  veriQ_('#veri-det-body').innerHTML = veriCertsHtml_(d) + veriBloquesHtml_(d) + veriHistHtml_(d.verif);
  veriCablearResultado_();
  veriCablearBody_();
}

/* ============================================================
   CABLEADO DEL DETALLE
   ============================================================ */
function veriCablearResultado_() {
  const raiz = veriQ_('#veri-det-res'); if (!raiz) return;
  raiz.querySelectorAll('input[name="veri-res"]').forEach(i => i.addEventListener('change', () => {
    veriGuardar_({ resultado: i.value });
  }));
  raiz.querySelector('#veri-res-quitar')?.addEventListener('click', async () => {
    const c = await Swal.fire({ icon: 'question', title: '¿Volver a pendiente?',
      text: 'Se borra el resultado registrado (queda en la trazabilidad).',
      showCancelButton: true, confirmButtonText: 'Sí, volver', cancelButtonText: 'Cancelar' });
    if (c.isConfirmed) veriGuardar_({ resultado: '' });
  });
  raiz.querySelector('#veri-consent')?.addEventListener('change', e => veriGuardar_({ consentimiento: !!e.target.checked }));
  raiz.querySelector('#veri-notas-ok')?.addEventListener('click', () => {
    veriGuardar_({ notas: veriTxt_(raiz.querySelector('#veri-notas')?.value) }, 'Notas guardadas');
  });
}

function veriCablearBody_() {
  const raiz = veriQ_('#veri-det-body'); if (!raiz) return;
  raiz.querySelector('#veri-clave-ver')?.addEventListener('click', veriVerClave_);
  raiz.querySelector('#veri-clave-ocultar')?.addEventListener('click', () => { VERI.clave = ''; veriPintarDetalle_(); });
  raiz.querySelectorAll('[data-cert-ver]').forEach(b => b.addEventListener('click', () => {
    const c = veriCert_(b.dataset.certVer); if (!c || !c.url) return;
    if (typeof NPERFIL !== 'undefined' && NPERFIL.visor) NPERFIL.visor(c.url, c.nombre);
    else window.open(c.url, '_blank', 'noopener');
  }));
  raiz.querySelectorAll('[data-cert-ok]').forEach(b => b.addEventListener('click', () => veriRevisarCert_(b.dataset.certOk, 'APROBAR')));
  raiz.querySelectorAll('[data-cert-no]').forEach(b => b.addEventListener('click', () => veriRevisarCert_(b.dataset.certNo, 'RECHAZAR')));
}

function veriCert_(k) { return ((VERI.det && VERI.det.certificados) || []).find(c => c.clave === k) || null; }

/* Parche en memoria: la fila de la lista y el bloque del detalle. */
function veriParchar_(id, verif) {
  const campos = ['resultado', 'resultadoPor', 'resultadoFecha', 'consentimiento', 'consentimientoPor',
                  'consentimientoFecha', 'tieneNotas', 'filtro', 'valida'];
  VERI.todos.forEach(r => { if (r.id === id) campos.forEach(k => { r[k] = verif[k]; }); });
  if (VERI.det && VERI.det.id === id) VERI.det.verif = verif;
}

/* ============================================================
   ESCRITURAS (escudo + rid; nunca se cortan)
   ============================================================ */
async function veriGuardar_(cambio, okTxt) {
  const r = VERI.actual;
  if (!r || VERI.ocupado) return;
  VERI.ocupado = true;
  veriBloquear_(true);
  const t0 = Date.now();
  try {
    const out = await apiPost('verifGuardar', Object.assign({ usuarioId: currentUser.id, id: r.id }, cambio), { silent: true });
    veriMed_('verifGuardar', t0);
    veriParchar_(out.id, out.verif);
    VERI.ocupado = false;
    if (VERI.actual === r) veriPintarDetalle_();
    if (VERI.actual === r && !VERI.det) { veriQ_('#veri-det-res').innerHTML = veriResultadoHtml_(r, null); veriCablearResultado_(); }
    veriPintarTop_(); veriPintarCards_();
    if (okTxt && !out.yaEstaba) Swal.fire({ icon: 'success', title: okTxt, timer: 1200, showConfirmButton: false });
  } catch (e) {
    VERI.ocupado = false;
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: String(e.message || e) });
    if (VERI.actual === r) { VERI.det ? veriPintarDetalle_() : (veriQ_('#veri-det-res').innerHTML = veriResultadoHtml_(r, null), veriCablearResultado_()); }
  } finally {
    VERI.ocupado = false;
    veriBloquear_(false);
  }
}

/* Escudo visual: deshabilita todos los controles del detalle mientras
   escribe (además de VERI.ocupado). */
function veriBloquear_(on) {
  const m = veriQ_('#modal-veri'); if (!m) return;
  m.classList.toggle('is-ocupado', !!on);
  m.querySelectorAll('#veri-det-res input, #veri-det-res button, #veri-det-res textarea, #veri-det-body button')
    .forEach(el => { if (on) el.setAttribute('disabled', ''); });
}

async function veriVerClave_() {
  const r = VERI.actual;
  if (!r || VERI.ocupado) return;
  const c = await Swal.fire({ icon: 'warning', title: 'Ver la clave del portal académico',
    text: 'Quedará registrado que la viste, con tu nombre y la hora.',
    showCancelButton: true, confirmButtonText: 'Ver clave', cancelButtonText: 'Cancelar' });
  if (!c.isConfirmed || VERI.ocupado || VERI.actual !== r) return;
  VERI.ocupado = true; veriBloquear_(true);
  const t0 = Date.now();
  try {
    const out = await apiPost('verifVerClave', { usuarioId: currentUser.id, id: r.id }, { silent: true });
    veriMed_('verifVerClave', t0);
    if (VERI.actual !== r) return;
    VERI.clave = out.clave || '';
    if (VERI.det) VERI.det.verif = out.verif;
    VERI.ocupado = false;
    veriPintarDetalle_();
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo mostrar', text: String(e.message || e) });
  } finally {
    VERI.ocupado = false; veriBloquear_(false);
    if (VERI.actual === r && VERI.det) veriPintarDetalle_();
  }
}

/* Certificados: la MISMA acción docRevisar que usa Documentos del
   participante. El rechazo viaja como CORREGIR + nota (compatible con
   cualquier orden de publicación, igual que nivel-docs.js). */
async function veriRevisarCert_(clave, accion) {
  const r = VERI.actual, c = veriCert_(clave);
  if (!r || !c || VERI.ocupado) return;
  const sil = '<label class="ndoc-sil"><input type="checkbox" id="veri-sil"> No avisar al participante (en silencio)</label>';
  const cuerpo = { usuarioId: currentUser.id, id: r.id, doc: clave, accion: accion === 'RECHAZAR' ? 'CORREGIR' : 'APROBAR' };
  let resp;
  if (accion === 'RECHAZAR') {
    resp = await Swal.fire({ title: c.bloqueado ? '↩️ Reabrir certificado aprobado' : '✖ Rechazar certificado',
      html: '<b>' + esc_(c.nombre) + '</b><br><span style="color:#44546b">Vuelve a pendiente y se puede volver a cargar. ' +
            'El motivo es lo que verá el participante.</span>' + sil,
      input: 'textarea', inputPlaceholder: 'Motivo del rechazo…', showCancelButton: true,
      confirmButtonText: 'Rechazar', cancelButtonText: 'Volver',
      inputValidator: v => !veriTxt_(v) && 'Escribe el motivo del rechazo.',
      preConfirm: () => { cuerpo.silencio = !!(document.getElementById('veri-sil') || {}).checked; } });
    if (!resp.isConfirmed) return;
    cuerpo.motivo = cuerpo.nota = veriTxt_(resp.value);
  } else {
    resp = await Swal.fire({ icon: 'question', title: '¿Aprobar este certificado?',
      html: '<b>' + esc_(c.nombre) + '</b><br><span style="color:#44546b">Al aprobarlo queda bloqueado.</span>' + sil,
      showCancelButton: true, confirmButtonText: 'Sí, aprobar', cancelButtonText: 'Volver',
      preConfirm: () => { cuerpo.silencio = !!(document.getElementById('veri-sil') || {}).checked; } });
    if (!resp.isConfirmed) return;
  }
  if (VERI.ocupado || VERI.actual !== r) return;
  VERI.ocupado = true; veriBloquear_(true);
  Swal.fire({ title: 'Guardando…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  const t0 = Date.now();
  try {
    const out = await apiPost('docRevisar', cuerpo, { silent: true });
    veriMed_('docRevisar', t0);
    if (VERI.det && VERI.actual === r) {
      const nuevos = (out.documentos || []).filter(d => d.clave === 'CERT_ENE_JUL' || d.clave === 'CERT_AGO_DIC');
      if (nuevos.length) VERI.det.certificados = VERI.det.certificados.map(x => nuevos.find(n => n.clave === x.clave) || x);
    }
    VERI.ocupado = false;
    veriPintarDetalle_();
    Swal.fire({ icon: 'success', title: accion === 'APROBAR' ? 'Certificado aprobado' : 'Certificado rechazado',
      text: cuerpo.silencio ? 'Sin aviso al participante.' : 'Le llegará un correo al participante.',
      timer: 1500, showConfirmButton: false });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: String(e.message || e) });
  } finally {
    VERI.ocupado = false; veriBloquear_(false);
    if (VERI.actual === r && VERI.det) veriPintarDetalle_();
  }
}

/* ============================================================
   ARRANQUE
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#proc-tile-verif')?.addEventListener('click', abrirVerif_);
  document.querySelector('#veri-refresh')?.addEventListener('click', () => { if (!VERI.cargando) recargarVerif_(); });
  document.querySelector('#veri-search')?.addEventListener('input', e => { VERI.texto = e.target.value || ''; veriPintarCards_(); });
  document.querySelector('#veri-det-close')?.addEventListener('click', veriCerrarDetalle_);
});

/* Puerta para las pruebas automatizadas. */
window.__sepVerif = { VERI, abrirVerif_, veriAbrirDetalle_, veriCerrarDetalle_, veriGuardar_, veriPintarTodo_,
                      veriVisibles_, veriSalir_, veriParchar_ };
