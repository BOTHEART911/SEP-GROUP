/* ============================================================
 * SEP GROUP — VISTA CONTADOR (Fase 2 · 10/08/2026)
 * Fase 4 (11/08/2026): validación del contrato con aviso al estudiante,
 * comprobante pegable con Ctrl+V y refresco de fondo de verdad silencioso.
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula
 * la garantía de funcionamiento.
 * ------------------------------------------------------------
 * Vive en su propio archivo a propósito: app.js ya pesa 150 KB y
 * esta vista crece con las fases siguientes.
 *
 * Usa de app.js: apiGet, apiPost, showView, esc_, currentUser,
 * abrirRuedaFecha_ (rueda iOS de día/mes con año automático).
 * La rueda de FECHA DE NACIMIENTO es propia: necesita columna de
 * año y fechas pasadas, cosa que la rueda de la agenda no hace.
 * ============================================================ */

const CONTA = {
  registros: [], catalogo: null, actual: null, sheetKey: null,
  filtroAsesor: '__ALL__', filtroEtapa: '__ALL__', filtroPlan: '__ALL__',
  filtroTexto: '', cargado: false
};

const CONTA_SIN_ASESOR = '— Sin asesor —';
const CONTA_SIN_PLAN   = '— Sin plan —';

const CONTA_FILTROS = [
  { key: 'asesor', allLabel: 'Todos los asesores', titulo: 'Filtrar por asesor', ic: '👤', color: '#263143' },
  { key: 'etapa',  allLabel: 'Todas las etapas',   titulo: 'Filtrar por etapa',  ic: '🧭', color: '#0891b2' },
  { key: 'plan',   allLabel: 'Todos los planes',   titulo: 'Filtrar por plan',   ic: '🎯', color: '#263143' }
];

/* ============================================================
   ENTRADA
   ============================================================ */
async function abrirContador_() {
  const rol = String(currentUser?.rol || '').toUpperCase();
  if (['DESARROLLADOR', 'SUPERUSUARIO', 'CONTADOR'].indexOf(rol) < 0) {
    Swal.fire({ icon: 'warning', title: 'Sin permiso', text: 'Solo CONTADOR, SUPERUSUARIO o DESARROLLADOR entran a esta vista.' });
    return;
  }
  showView('contador');
  if (!CONTA.cargado) await cargarContador_();
  else { renderContaFiltros_(); renderContaCards_(); recargarContador_(true); }
}

async function cargarContador_() {
  try {
    const d = await apiGet('contadorInit', { usuarioId: currentUser.id });
    CONTA.catalogo  = d.catalogo;
    CONTA.registros = d.registros || [];
    CONTA.cargado   = true;
    renderContaFiltros_(); renderContaCards_(); renderContaResumen_();
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: String(e.message || e) });
  }
}

async function recargarContador_(silencioso) {
  try {
    /* Fase 4 — el refresco de fondo va SILENCIOSO de verdad: sin esto
       salía el girador (y ahora saldría el esqueleto) encima de datos
       que ya están pintados. */
    CONTA.registros = await apiGet('listContador', { usuarioId: currentUser.id }, { silent: !!silencioso });
    renderContaFiltros_(); renderContaCards_(); renderContaResumen_();
  } catch (e) {
    if (!silencioso) Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: String(e.message || e) });
  }
}

/* ============================================================
   FILTROS EN CASCADA (mismas pastillas que Comercial)
   ============================================================ */
function contaAsesorDe_(r) { return String(r.asesor || '').trim() || CONTA_SIN_ASESOR; }
function contaPlanDe_(r)   { return String(r.tipoPlan || '').trim() || CONTA_SIN_PLAN; }

function contaValFiltro_(k) {
  return k === 'asesor' ? CONTA.filtroAsesor : k === 'etapa' ? CONTA.filtroEtapa : CONTA.filtroPlan;
}
/* Cambiar un nivel superior reinicia los de abajo (evita filtros huérfanos). */
function contaSetFiltro_(k, v) {
  if (k === 'asesor') { CONTA.filtroAsesor = v; CONTA.filtroEtapa = '__ALL__'; CONTA.filtroPlan = '__ALL__'; }
  else if (k === 'etapa') { CONTA.filtroEtapa = v; CONTA.filtroPlan = '__ALL__'; }
  else CONTA.filtroPlan = v;
}
function contaBaseAsesor_() {
  if (CONTA.filtroAsesor === '__ALL__') return CONTA.registros;
  return CONTA.registros.filter(r => contaAsesorDe_(r) === CONTA.filtroAsesor);
}
function contaBaseEtapa_() {
  const b = contaBaseAsesor_();
  if (CONTA.filtroEtapa === '__ALL__') return b;
  return b.filter(r => r.etapa === CONTA.filtroEtapa);
}
function contaBasePlan_() {
  const b = contaBaseEtapa_();
  if (CONTA.filtroPlan === '__ALL__') return b;
  return b.filter(r => contaPlanDe_(r) === CONTA.filtroPlan);
}
function contaEtapaDef_(clave) {
  return (CONTA.catalogo?.etapas || []).find(e => e.clave === clave) ||
         { clave: clave, label: clave, color: '#6b7280', ic: '•' };
}

function contaOpciones_(key) {
  const c = {};
  if (key === 'asesor') {
    CONTA.registros.forEach(r => { const k = contaAsesorDe_(r); c[k] = (c[k] || 0) + 1; });
    return Object.keys(c).sort((a, b) => a.localeCompare(b))
      .map(k => ({ valor: k, label: k, count: c[k], ic: '👤' }));
  }
  if (key === 'etapa') {
    contaBaseAsesor_().forEach(r => { c[r.etapa] = (c[r.etapa] || 0) + 1; });
    return (CONTA.catalogo?.etapas || []).filter(e => c[e.clave])
      .map(e => ({ valor: e.clave, label: e.label, count: c[e.clave], color: e.color }));
  }
  contaBaseEtapa_().forEach(r => { const k = contaPlanDe_(r); c[k] = (c[k] || 0) + 1; });
  return Object.keys(c).sort((a, b) => a.localeCompare(b))
    .map(k => ({ valor: k, label: k, count: c[k], ic: '🎯' }));
}
function contaTotalFiltro_(k) {
  return k === 'asesor' ? CONTA.registros.length
       : k === 'etapa'  ? contaBaseAsesor_().length
       :                  contaBaseEtapa_().length;
}
function contaConteoPill_(k) {
  return k === 'asesor' ? contaBaseAsesor_().length
       : k === 'etapa'  ? contaBaseEtapa_().length
       :                  contaBasePlan_().length;
}

function renderContaFiltros_() {
  const cont = document.querySelector('#conta-filters'); if (!cont) return;
  cont.innerHTML = CONTA_FILTROS.map(contaPillHtml_).join('');
  CONTA_FILTROS.forEach(f =>
    document.querySelector('#cfp-' + f.key)?.addEventListener('click', () => abrirContaSheet_(f.key)));
}
function contaPillHtml_(f) {
  const val = contaValFiltro_(f.key);
  const on = val !== '__ALL__';
  let label = f.allLabel, color = f.color, ic = `<span class="fpill__ic">${f.ic}</span>`;
  if (on) {
    if (f.key === 'etapa') {
      const e = contaEtapaDef_(val); label = e.label; color = e.color;
      ic = `<span class="fpill__dot"></span>`;
    } else if (f.key === 'asesor') {
      label = String(val).split(/\s+/).slice(0, 2).join(' ');
    } else label = val;
  }
  return `<button class="fpill ${on ? 'is-on' : ''}" id="cfp-${f.key}" style="--fp:${color}"
      title="${esc_(on ? val : f.allLabel)}" aria-haspopup="dialog">
    ${ic}<span class="fpill__label">${esc_(label)}</span>
    <span class="fpill__count">${contaConteoPill_(f.key)}</span>
    <svg class="fpill__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
  </button>`;
}

function abrirContaSheet_(key) {
  const f = CONTA_FILTROS.find(x => x.key === key); if (!f) return;
  const sheet = document.querySelector('#conta-fsheet'), lista = document.querySelector('#conta-fsheet-list');
  if (!sheet || !lista) return;
  CONTA.sheetKey = key;
  document.querySelector('#conta-fsheet-title').textContent = f.titulo;

  const actual = contaValFiltro_(key);
  let html = contaOptHtml_({ valor: '__ALL__', label: f.allLabel, count: contaTotalFiltro_(key), ic: f.ic }, actual === '__ALL__', true);
  contaOpciones_(key).forEach(o => { html += contaOptHtml_(o, actual === o.valor, false); });
  lista.innerHTML = html; lista.scrollTop = 0;

  lista.querySelectorAll('.fopt').forEach(b => b.addEventListener('click', () => {
    contaSetFiltro_(key, b.dataset.valor);
    cerrarContaSheet_(); renderContaFiltros_(); renderContaCards_();
  }));
  sheet.classList.remove('hidden'); sheet.setAttribute('aria-hidden', 'false');
}
function contaOptHtml_(o, sel, esAll) {
  const ic = o.color ? `<span class="fopt__dot" style="background:${o.color}"></span>`
                     : `<span class="fopt__ic">${o.ic || '•'}</span>`;
  return `<button class="fopt ${sel ? 'is-sel' : ''} ${esAll ? 'is-all' : ''}" data-valor="${esc_(o.valor)}">
    ${ic}<span class="fopt__label">${esc_(o.label)}</span>
    <span class="fopt__count">${o.count}</span><span class="fopt__check">✓</span></button>`;
}
function cerrarContaSheet_() {
  const s = document.querySelector('#conta-fsheet'); if (!s) return;
  s.classList.add('hidden'); s.setAttribute('aria-hidden', 'true'); CONTA.sheetKey = null;
}
document.addEventListener('click', e => { if (e.target.closest('[data-conta-fsheet-close]')) cerrarContaSheet_(); });

/* ============================================================
   RESUMEN SUPERIOR — lo que el contador necesita de un vistazo
   ============================================================ */
function renderContaResumen_() {
  const cont = document.querySelector('#conta-resumen'); if (!cont) return;
  const etapas = CONTA.catalogo?.etapas || [];
  const c = {};
  CONTA.registros.forEach(r => { c[r.etapa] = (c[r.etapa] || 0) + 1; });
  const vencidos = CONTA.registros.filter(r => r.alertaOferta === 'vencido' || r.alertaTotal === 'vencido').length;
  const pronto   = CONTA.registros.filter(r => r.alertaOferta === 'pronto'  || r.alertaTotal === 'pronto').length;

  let html = etapas.map(e => `<button class="conta-kpi" data-etapa="${e.clave}" style="--k:${e.color}">
      <span class="conta-kpi__n">${c[e.clave] || 0}</span>
      <span class="conta-kpi__t">${e.ic} ${esc_(e.label)}</span></button>`).join('');
  if (vencidos) html += `<div class="conta-kpi conta-kpi--alerta" style="--k:#dc2626">
      <span class="conta-kpi__n">${vencidos}</span><span class="conta-kpi__t">⏰ Vencidos</span></div>`;
  if (pronto) html += `<div class="conta-kpi" style="--k:#f59e0b">
      <span class="conta-kpi__n">${pronto}</span><span class="conta-kpi__t">🔔 Vencen pronto</span></div>`;
  cont.innerHTML = html;

  cont.querySelectorAll('[data-etapa]').forEach(b => b.addEventListener('click', () => {
    CONTA.filtroAsesor = '__ALL__';
    contaSetFiltro_('etapa', CONTA.filtroEtapa === b.dataset.etapa ? '__ALL__' : b.dataset.etapa);
    renderContaFiltros_(); renderContaCards_();
  }));
}

/* ============================================================
   TARJETAS
   ============================================================ */
function contaNormBusq_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function contaMoneda_(v, simbolo) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v); if (isNaN(n)) return '';
  return (simbolo || '$ ') + n.toLocaleString('es-CO');
}
function contaFechaTexto_(iso) {
  if (!iso) return '';
  const p = String(iso).split('-'); if (p.length < 3) return iso;
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return Number(p[2]) + ' de ' + (meses[Number(p[1]) - 1] || '') + ' de ' + p[0];
}

function renderContaCards_() {
  const cont = document.querySelector('#conta-cards'), vacio = document.querySelector('#conta-empty');
  if (!cont) return;
  const txt = contaNormBusq_(CONTA.filtroTexto.trim());
  let list = contaBasePlan_().slice();
  if (txt) list = list.filter(r =>
    contaNormBusq_(r.nombres + ' ' + r.apellidos).includes(txt) ||
    String(r.documento || '').includes(txt) ||
    String(r.whatsapp || '').includes(txt) ||
    String(r.n).includes(txt) ||
    contaNormBusq_(r.correo).includes(txt));

  vacio?.classList.toggle('hidden', list.length > 0);
  cont.innerHTML = list.map(contaCardHtml_).join('');
  list.forEach(r => {
    const card = document.querySelector('#conta-card-' + r.n); if (!card) return;
    card.querySelector('[data-act="editar"]')?.addEventListener('click', () => abrirModalContador_(r));
    card.querySelectorAll('[data-ver]').forEach(b =>
      b.addEventListener('click', () => abrirVisorConta_(b.dataset.ver, b.dataset.titulo)));
  });
}

function contaPaso_(ok, ic, titulo) {
  return `<span class="conta-step ${ok ? 'is-ok' : ''}" title="${esc_(titulo)}">${ic}</span>`;
}

function contaCardHtml_(r) {
  const alerta = (r.alertaOferta === 'vencido' || r.alertaTotal === 'vencido') ? 'vencido'
               : (r.alertaOferta === 'pronto'  || r.alertaTotal === 'pronto')  ? 'pronto' : '';
  const avisos = [];
  if (r.alertaOferta) avisos.push(`<span class="conta-aviso conta-aviso--${r.alertaOferta}">⏰ Oferta: ${contaFechaTexto_(r.ofertaMax)}</span>`);
  if (r.alertaTotal)  avisos.push(`<span class="conta-aviso conta-aviso--${r.alertaTotal}">⏰ Pago total: ${contaFechaTexto_(r.totalMax)}</span>`);

  const archivos = [];
  if (r.comprobanteUrl) archivos.push(`<button class="act-btn" data-ver="${esc_(r.comprobanteUrl)}" data-titulo="Comprobante de inscripción">🧾 Comprobante</button>`);
  if (r.contratoUrl)    archivos.push(`<button class="act-btn" data-ver="${esc_(r.contratoUrl)}" data-titulo="Contrato firmado">📄 Contrato</button>`);
  if (r.documentoUrl)   archivos.push(`<button class="act-btn" data-ver="${esc_(r.documentoUrl)}" data-titulo="Documento del estudiante">🪪 Documento</button>`);
  if (r.cedulaUrl)      archivos.push(`<button class="act-btn" data-ver="${esc_(r.cedulaUrl)}" data-titulo="Cédula del deudor solidario">🧑‍🤝‍🧑 Cédula deudor</button>`);

  return `<div class="com-card conta-card${alerta ? ' conta-card--' + alerta : ''}" id="conta-card-${r.n}">
    <div class="com-card__stripe" style="background:${r.etapaColor}"></div>
    <div class="com-card__top">
      <div class="com-card__head">
        <h3 class="com-card__name">${esc_(r.nombres)} ${esc_(r.apellidos)}</h3>
        ${r.correo ? `<div class="com-card__email">📧 ${esc_(r.correo)}</div>` : ''}
      </div>
      <div class="com-card__tag">
        <span class="com-badge" style="background:${r.etapaColor}">${r.etapaIc} ${esc_(r.etapaLabel)}</span>
        <span class="com-card__id">N° ${r.n}</span>
      </div>
    </div>
    <div class="com-card__meta">
      ${r.documento ? `<span>🪪 ${esc_(r.documento)}${r.edad !== '' ? ' · ' + r.edad + ' años' : ''}</span>` : ''}
      <span>📱 ${esc_(r.whatsapp)}</span>
      ${r.tipoPlan ? `<span>🎯 ${esc_(r.tipoPlan)}</span>` : ''}
      ${r.sponsor ? `<span>🤝 ${esc_(r.sponsor)}</span>` : ''}
      ${r.planPrograma ? `<span>📦 ${esc_(r.planPrograma)}</span>` : ''}
      ${r.proceso ? `<span>🔖 ${esc_(r.proceso)}</span>` : ''}
      ${r.asesor ? `<span>👤 ${esc_(r.asesor)}</span>` : ''}
    </div>
    <div class="conta-steps">
      ${contaPaso_(!!r.comprobanteUrl, '💳', 'Comprobante de inscripción')}
      ${contaPaso_(!!r.contratoUrl, '📄', 'Contrato creado')}
      ${contaPaso_(!!r.contratoOk, '✅', 'Contrato validado')}
      ${contaPaso_(!!r.pagoOferta, '💵', 'Pago de la oferta')}
      ${contaPaso_(!!r.pagoTotal, '🏦', 'Pago total')}
      ${contaPaso_(!!r.pagoSevis, '🎓', 'Pago del SEVIS')}
      ${r.valorInscrip !== '' ? `<span class="conta-monto">${contaMoneda_(r.valorInscrip)}</span>` : ''}
    </div>
    ${avisos.length ? `<div class="conta-avisos">${avisos.join('')}</div>` : ''}
    <div class="com-card__actions">
      <button class="act-btn act-editar" data-act="editar">✏️ Abrir</button>
      ${archivos.join('')}
    </div>
  </div>`;
}

/* ============================================================
   VISOR DE ARCHIVOS (sin abrir pestaña)
   ============================================================ */
function contaDriveId_(url) {
  const m = String(url || '').match(/[-\w]{25,}/);
  return m ? m[0] : '';
}
function abrirVisorConta_(url, titulo) {
  const id = contaDriveId_(url);
  const src = id ? 'https://drive.google.com/file/d/' + id + '/preview' : url;
  document.querySelector('#conta-visor-title').textContent = titulo || 'Archivo';
  document.querySelector('#conta-visor-frame').src = src;
  const a = document.querySelector('#conta-visor-abrir'); if (a) a.href = url;
  document.querySelector('#conta-visor').classList.remove('hidden');
}
function cerrarVisorConta_() {
  document.querySelector('#conta-visor')?.classList.add('hidden');
  const f = document.querySelector('#conta-visor-frame'); if (f) f.src = 'about:blank';
}

/* ============================================================
   RUEDA DE FECHA DE NACIMIENTO (día · mes · AÑO)
   ============================================================
   La rueda de la agenda tiene el año fijo y no deja fechas
   pasadas; para el nacimiento hace falta lo contrario. */
const CPICK = { onOk: null, dias: [], meses: [], anios: [], H: 42 };
const CPICK_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function cpickBuild_(colEl, items, initIdx, onSettle) {
  colEl.innerHTML = '<div class="iosp-pad"></div>' +
    items.map((t, i) => `<div class="iosp-item" data-i="${i}">${t}</div>`).join('') +
    '<div class="iosp-pad"></div>';
  colEl.scrollTop = Math.max(0, initIdx) * CPICK.H;
  cpickMarcar_(colEl);
  let to = null;
  colEl.onscroll = () => {
    cpickMarcar_(colEl);
    if (to) clearTimeout(to);
    to = setTimeout(() => {
      const i = cpickSel_(colEl);
      colEl.scrollTo({ top: i * CPICK.H, behavior: 'smooth' });
      if (onSettle) onSettle(i);
    }, 90);
  };
  colEl.querySelectorAll('.iosp-item').forEach(el => {
    el.addEventListener('click', () => {
      const i = +el.dataset.i;
      colEl.scrollTop = i * CPICK.H;
      cpickMarcar_(colEl);
      if (onSettle) onSettle(i);
    });
  });
}
function cpickSel_(colEl) { return Math.max(0, Math.round(colEl.scrollTop / CPICK.H)); }
function cpickMarcar_(colEl) {
  const i = cpickSel_(colEl);
  colEl.querySelectorAll('.iosp-item').forEach(el => el.classList.toggle('sel', +el.dataset.i === i));
}
function cpickDiasMes_(mesIdx, anio) { return new Date(anio, mesIdx + 1, 0).getDate(); }
function cpickRebuildDias_() {
  const mes  = cpickSel_(document.querySelector('#cpick-mes'));
  const anio = CPICK.anios[Math.min(cpickSel_(document.querySelector('#cpick-anio')), CPICK.anios.length - 1)];
  const total = cpickDiasMes_(mes, anio);
  const pos = Math.min(cpickSel_(document.querySelector('#cpick-dia')), total - 1);
  CPICK.dias = []; for (let d = 1; d <= total; d++) CPICK.dias.push(d);
  cpickBuild_(document.querySelector('#cpick-dia'), CPICK.dias.map(String), Math.max(0, pos));
}

/* Años admitidos: los que dan una edad entre el mínimo y el máximo. */
function abrirRuedaNacimiento_(valorISO, onOk) {
  CPICK.onOk = onOk;
  const min = CONTA.catalogo?.edad?.min || 17;
  const max = CONTA.catalogo?.edad?.max || 28;
  const hoy = new Date();
  CPICK.anios = [];
  for (let a = hoy.getFullYear() - max; a <= hoy.getFullYear() - min; a++) CPICK.anios.push(a);

  let d = valorISO ? new Date(valorISO + 'T12:00:00') : null;
  if (!d || isNaN(d.getTime())) d = new Date(CPICK.anios[CPICK.anios.length - 1], 0, 1);
  let anioPos = CPICK.anios.indexOf(d.getFullYear());
  if (anioPos < 0) anioPos = CPICK.anios.length - 1;

  document.querySelector('#conta-picker').classList.remove('hidden');
  const total = cpickDiasMes_(d.getMonth(), CPICK.anios[anioPos]);
  CPICK.dias = []; for (let i = 1; i <= total; i++) CPICK.dias.push(i);

  cpickBuild_(document.querySelector('#cpick-dia'), CPICK.dias.map(String), d.getDate() - 1);
  cpickBuild_(document.querySelector('#cpick-mes'),
    CPICK_MESES.map(m => m.charAt(0).toUpperCase() + m.slice(1)), d.getMonth(), cpickRebuildDias_);
  cpickBuild_(document.querySelector('#cpick-anio'), CPICK.anios.map(String), anioPos, cpickRebuildDias_);
}

/* ============================================================
   MODAL — cuatro bloques, un solo botón Guardar
   ============================================================ */
function contaSelect_(id, opciones, valor, vacio) {
  const ops = ['<option value="">' + (vacio || '— Selecciona —') + '</option>']
    .concat((opciones || []).map(o => `<option value="${esc_(o)}"${String(valor) === String(o) ? ' selected' : ''}>${esc_(o)}</option>`));
  return `<select id="${id}">${ops.join('')}</select>`;
}

function abrirModalContador_(r) {
  CONTA.actual = r;
  const op = CONTA.catalogo?.opciones || {};
  const procesoCerrado = (op.proceso || []).indexOf(r.proceso) >= 0 || !r.proceso;

  document.querySelector('#conta-modal-title').textContent = 'N° ' + r.n + ' · ' + r.nombres + ' ' + r.apellidos;
  document.querySelector('#conta-modal-sub').innerHTML =
    `<span class="com-badge" style="background:${r.etapaColor}">${r.etapaIc} ${esc_(r.etapaLabel)}</span>
     <span class="com-badge" style="background:${r.estadoColor}">${esc_(r.estadoLabel)}</span>
     ${r.claveAcceso ? `<span class="conta-clave">🔑 ${esc_(r.claveAcceso)}</span>` : ''}`;

  document.querySelector('#conta-modal-body').innerHTML = `
    <details class="conta-bloque" open>
      <summary>👤 Datos del estudiante</summary>
      <div class="form-grid">
        <div class="fld"><label>Proceso</label>${contaSelect_('c-proceso', op.proceso, procesoCerrado ? r.proceso : 'Otro')}</div>
        <div class="fld" id="c-proceso-otro-fld" style="${procesoCerrado ? 'display:none' : ''}">
          <label>¿Cuál?</label><input id="c-proceso-otro" type="text" value="${esc_(procesoCerrado ? '' : r.proceso)}" placeholder="Escribe el proceso" /></div>
        <div class="fld"><label>N° de documento</label><input id="c-documento" type="text" inputmode="numeric" value="${esc_(r.documento)}" placeholder="6 a 10 dígitos" /></div>
        <div class="fld"><label>Fecha de nacimiento</label>
          <button type="button" class="btn btn-ghost conta-fecha" id="c-nac-btn">
            <span id="c-nac-text">${r.nacimiento ? esc_(contaFechaTexto_(r.nacimiento)) : 'Seleccionar'}</span></button>
          <input id="c-nacimiento" type="hidden" value="${esc_(r.nacimiento)}" />
          <small class="conta-hint" id="c-edad">${r.edad !== '' ? r.edad + ' años' : ''}</small></div>
        <div class="fld"><label>Tipo de plan</label>${contaSelect_('c-tipoPlan', op.tipoPlan, r.tipoPlan)}</div>
        <div class="fld"><label>Sponsor</label>${contaSelect_('c-sponsor', op.sponsor, r.sponsor)}</div>
        <div class="fld"><label>Plan del programa</label>${contaSelect_('c-planPrograma', op.planPrograma, r.planPrograma)}</div>
        <div class="fld fld-full"><label>Adds-on <small>(varios)</small></label>
          <div class="conta-checks">${(op.addsOn || []).map((a, i) =>
            `<label class="conta-chk"><input type="checkbox" class="c-adds" value="${esc_(a)}"${r.addsOn.indexOf(a) >= 0 ? ' checked' : ''}/><span>${esc_(a)}</span></label>`).join('')}</div></div>
      </div>
    </details>

    <details class="conta-bloque" open>
      <summary>💳 Bloque 1 · Inscripción</summary>
      <div class="form-grid">
        <div class="fld"><label>Precio del programa (USD)</label><input id="c-precioUsd" type="text" inputmode="decimal" value="${r.precioUsd}" placeholder="2200" /></div>
        <div class="fld"><label>Valor inscripción (COP)</label><input id="c-valorInscrip" type="text" inputmode="numeric" value="${r.valorInscrip}" placeholder="200000" /></div>
        <div class="fld"><label>Método de pago</label>${contaSelect_('c-metodoInscrip', op.metodo, r.metodoInscrip)}</div>
        <div class="fld"><label>Cuenta de banco</label>${contaSelect_('c-cuentaInscrip', op.cuenta, r.cuentaInscrip)}</div>
        <div class="fld"><label>Concepto de promo</label><input type="text" value="${esc_(r.promo)}" disabled /></div>
        <div class="fld"><label>Fecha de inscripción</label><input type="text" value="${esc_(contaFechaTexto_(r.fechaInscripcion))}" disabled placeholder="Automática" /></div>
        <div class="fld fld-full"><label>Comprobante de pago (imagen o PDF)</label>
          <div class="conta-file">
            <input type="file" id="c-comprobante-file" accept=".pdf,image/*" hidden />
            <button type="button" class="btn btn-ghost" id="c-comprobante-btn">📎 Subir comprobante</button>
            ${r.comprobanteUrl ? `<button type="button" class="btn btn-ghost" id="c-comprobante-ver">👁 Ver</button>` : ''}
            <span class="conta-hint" id="c-comprobante-est">${r.comprobanteUrl ? 'Cargado' : 'Sin cargar'}</span>
          </div>
          <input id="c-comprobanteUrl" type="hidden" value="${esc_(r.comprobanteUrl)}" />
          <div class="conta-paste" id="c-comprobante-paste">🖼️ <span>También puedes <b>pegar la imagen</b> aquí con <b>Ctrl+V</b> (Cmd+V en Mac) sin descargarla.</span></div>
          <small class="conta-hint">Al guardar el comprobante el estudiante pasa a <b>INSCRITO</b>.</small></div>
      </div>
    </details>

    <details class="conta-bloque">
      <summary>📄 Bloque 2 · Contrato, deudor y oferta</summary>
      <div class="form-grid">
        <div class="fld fld-full">
          <label class="conta-chk${r.contratoUrl ? '' : ' bloqueado'}">
            <input type="checkbox" id="c-contratoOk"${r.contratoOk ? ' checked' : ''}${r.contratoUrl ? '' : ' disabled'}/>
            <span>Contrato OK (revisado y correcto)</span></label>
          <small class="conta-hint" id="c-contratoOk-hint">${r.contratoUrl
            ? 'Al guardarlo marcado se le avisa al estudiante por correo y WhatsApp que puede seguir con la prueba de inglés.'
            : 'Se habilita cuando el estudiante firme su contrato en la Zona de Estudiantes.'}</small></div>
        <div class="fld fld-full conta-archivos">
          ${r.contratoUrl  ? `<button type="button" class="btn btn-ghost" data-ver="${esc_(r.contratoUrl)}" data-titulo="Contrato firmado">📄 Ver contrato</button>` : '<span class="conta-hint">Contrato aún no creado por el estudiante</span>'}
          ${r.documentoUrl ? `<button type="button" class="btn btn-ghost" data-ver="${esc_(r.documentoUrl)}" data-titulo="Documento del estudiante">🪪 Ver documento</button>` : ''}
          ${r.cedulaUrl    ? `<button type="button" class="btn btn-ghost" data-ver="${esc_(r.cedulaUrl)}" data-titulo="Cédula del deudor">🧑‍🤝‍🧑 Ver cédula</button>` : ''}
        </div>
        <div class="fld"><label>Nombre del deudor solidario</label><input id="c-nombreDeudor" type="text" value="${esc_(r.nombreDeudor)}" /></div>
        <div class="fld"><label>Cédula del deudor</label><input id="c-cedulaDeudor" type="text" inputmode="numeric" value="${esc_(r.cedulaDeudor)}" /></div>
        <div class="fld"><label>Fecha máxima de pago de oferta</label>
          <button type="button" class="btn btn-ghost conta-fecha" id="c-ofertaMax-btn">
            <span id="c-ofertaMax-text">${r.ofertaMax ? esc_(contaFechaTexto_(r.ofertaMax)) : 'Seleccionar'}</span></button>
          <input id="c-ofertaMax" type="hidden" value="${esc_(r.ofertaMax)}" /></div>
        <div class="fld"><label class="conta-chk"><input type="checkbox" id="c-pagoOferta"${r.pagoOferta ? ' checked' : ''}/><span>Pago oferta OK</span></label>
          <small class="conta-hint">${r.fechaOferta ? 'Pagado el ' + contaFechaTexto_(r.fechaOferta) : 'La fecha se pone sola'}</small></div>
        <div class="fld"><label>Método de pago oferta</label>${contaSelect_('c-metodoOferta', op.metodo, r.metodoOferta)}</div>
        <div class="fld"><label>Cuenta de banco oferta</label>${contaSelect_('c-cuentaOferta', op.cuenta, r.cuentaOferta)}</div>
        <div class="fld"><label>Valor oferta (USD)</label><input id="c-ofertaUsd" type="text" inputmode="decimal" value="${r.ofertaUsd}" /></div>
        <div class="fld"><label>Valor oferta (COP)</label><input id="c-ofertaCop" type="text" inputmode="numeric" value="${r.ofertaCop}" /></div>
      </div>
    </details>

    <details class="conta-bloque">
      <summary>🏦 Bloque 3 · Pago total</summary>
      <div class="form-grid">
        <div class="fld"><label>Fecha máxima de pago total</label>
          <button type="button" class="btn btn-ghost conta-fecha" id="c-totalMax-btn">
            <span id="c-totalMax-text">${r.totalMax ? esc_(contaFechaTexto_(r.totalMax)) : 'Seleccionar'}</span></button>
          <input id="c-totalMax" type="hidden" value="${esc_(r.totalMax)}" /></div>
        <div class="fld"><label class="conta-chk"><input type="checkbox" id="c-pagoTotal"${r.pagoTotal ? ' checked' : ''}/><span>Pago total OK</span></label>
          <small class="conta-hint">${r.fechaTotal ? 'Pagado el ' + contaFechaTexto_(r.fechaTotal) : 'La fecha se pone sola'}</small></div>
        <div class="fld"><label>Método de pago total</label>${contaSelect_('c-metodoTotal', op.metodo, r.metodoTotal)}</div>
        <div class="fld"><label>Cuenta de banco total</label>${contaSelect_('c-cuentaTotal', op.cuenta, r.cuentaTotal)}</div>
        <div class="fld"><label>Valor total (USD)</label><input id="c-totalUsd" type="text" inputmode="decimal" value="${r.totalUsd}" /></div>
        <div class="fld"><label>Valor total (COP)</label><input id="c-totalCop" type="text" inputmode="numeric" value="${r.totalCop}" /></div>
      </div>
    </details>

    <details class="conta-bloque">
      <summary>🎓 Bloque 4 · SEVIS y recargos</summary>
      <div class="form-grid">
        <div class="fld"><label class="conta-chk"><input type="checkbox" id="c-pagoSevis"${r.pagoSevis ? ' checked' : ''}/><span>Pago del SEVIS</span></label>
          <small class="conta-hint">${r.fechaSevis ? 'Pagado el ' + contaFechaTexto_(r.fechaSevis) : 'La fecha se pone sola'}</small></div>
        <div class="fld"><label>Valor del SEVIS (COP)</label><input id="c-sevisCop" type="text" inputmode="numeric" value="${r.sevisCop}" /></div>
        <div class="fld"><label>Recargo por incumplimientos (USD)</label><input id="c-recargo" type="text" inputmode="decimal" value="${r.recargo}" /></div>
      </div>
    </details>`;

  /* Cableado */
  document.querySelector('#c-proceso')?.addEventListener('change', e => {
    document.querySelector('#c-proceso-otro-fld').style.display = (e.target.value === 'Otro') ? '' : 'none';
  });
  document.querySelector('#c-nac-btn')?.addEventListener('click', () => {
    abrirRuedaNacimiento_(document.querySelector('#c-nacimiento').value, (iso, texto, edad) => {
      document.querySelector('#c-nacimiento').value = iso;
      document.querySelector('#c-nac-text').textContent = texto;
      document.querySelector('#c-edad').textContent = edad + ' años';
    });
  });
  ['ofertaMax', 'totalMax'].forEach(k => {
    document.querySelector('#c-' + k + '-btn')?.addEventListener('click', () => {
      abrirRuedaFecha_(document.querySelector('#c-' + k).value, (iso, texto) => {
        document.querySelector('#c-' + k).value = iso;
        document.querySelector('#c-' + k + '-text').textContent = texto;
      }, { soloFecha: true });
    });
  });
  document.querySelector('#c-comprobante-btn')?.addEventListener('click', () => document.querySelector('#c-comprobante-file').click());
  document.querySelector('#c-comprobante-file')?.addEventListener('change', subirComprobante_);
  document.querySelector('#c-comprobante-ver')?.addEventListener('click', () =>
    abrirVisorConta_(document.querySelector('#c-comprobanteUrl').value, 'Comprobante de inscripción'));
  document.querySelectorAll('#conta-modal-body [data-ver]').forEach(b =>
    b.addEventListener('click', () => abrirVisorConta_(b.dataset.ver, b.dataset.titulo)));

  document.querySelector('#modal-contador').classList.remove('hidden');
}

function cerrarModalContador_() {
  document.querySelector('#modal-contador')?.classList.add('hidden');
  CONTA.actual = null;
}

/* ── Subida del comprobante ──
   El archivo puede venir de tres sitios: el botón (input file), el
   portapapeles (Ctrl+V) o un arrastre. Por eso la subida vive en una
   función que recibe el File y no el evento. */
async function subirComprobante_(e) {
  const file = e.target.files && e.target.files[0];
  try { if (file) await subirComprobanteArchivo_(file); }
  finally { e.target.value = ''; }
}

async function subirComprobanteArchivo_(file, nombreSugerido) {
  if (!CONTA.actual) return;
  if (file.size > 5 * 1024 * 1024) {
    Swal.fire({ icon: 'warning', title: 'Archivo muy pesado', text: 'El comprobante no puede pasar de 5 MB.' });
    return;
  }
  const nombre = nombreSugerido || file.name || 'comprobante.png';
  try {
    const base64 = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1]);
      fr.onerror = () => rej(new Error('No se pudo leer el archivo'));
      fr.readAsDataURL(file);
    });
    const r = await apiPost('subirComprobante', {
      usuarioId: currentUser.id, n: CONTA.actual.n,
      filename: nombre, mime: file.type, base64: base64
    });
    document.querySelector('#c-comprobanteUrl').value = r.url;
    const est = document.querySelector('#c-comprobante-est');
    if (est) est.textContent = 'Cargado — falta guardar';
    const zona = document.querySelector('#c-comprobante-paste');
    if (zona) { zona.classList.add('lista'); zona.innerHTML = '✅ <span>Comprobante cargado. <b>Pulsa Guardar</b> para dejarlo registrado.</span>'; }
    Swal.fire({ icon: 'success', title: 'Comprobante cargado', text: 'Pulsa Guardar para dejarlo registrado.', timer: 2200, showConfirmButton: false });
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'No se pudo subir', text: String(err.message || err) });
  }
}

/* ── Pegar la imagen con Ctrl+V (Fase 4) ──
   Escucha en el documento porque el pegado ocurre donde esté el foco.
   Solo actúa si el modal del Contador está abierto y lo que viene en el
   portapapeles es de verdad una imagen o un PDF: pegar texto en una
   casilla sigue funcionando como siempre. */
function contaModalAbierto_() {
  const m = document.querySelector('#modal-contador');
  return !!(m && !m.classList.contains('hidden') && CONTA.actual);
}

function contaArchivoDelPortapapeles_(dt) {
  if (!dt) return null;
  const items = dt.items ? Array.from(dt.items) : [];
  for (const it of items) {
    if (it.kind !== 'file') continue;
    const f = it.getAsFile();
    if (!f) continue;
    if (/^image\//.test(f.type) || f.type === 'application/pdf') return f;
  }
  const files = dt.files ? Array.from(dt.files) : [];
  return files.find(f => /^image\//.test(f.type) || f.type === 'application/pdf') || null;
}

function contaNombrePegado_(file) {
  const ext = file.type === 'application/pdf' ? 'pdf'
            : (String(file.type).split('/')[1] || 'png').replace('jpeg', 'jpg');
  return 'comprobante.' + (['pdf', 'png', 'jpg', 'webp'].indexOf(ext) >= 0 ? ext : 'png');
}

async function contaPegarComprobante_(ev) {
  if (!contaModalAbierto_()) return;
  const file = contaArchivoDelPortapapeles_(ev.clipboardData);
  if (!file) return;                       // no era imagen: pegado normal
  ev.preventDefault();

  /* Vista previa antes de subir: pegar sin querer no puede cambiarle el
     comprobante a un estudiante. */
  let previa = '';
  if (/^image\//.test(file.type)) { try { previa = URL.createObjectURL(file); } catch (e) {} }
  const r = CONTA.actual;
  const res = await Swal.fire({
    title: '¿Subir esta imagen como comprobante?',
    html: '<div style="font-size:13px;margin-bottom:8px;">N° ' + r.n + ' · <b>' + esc_(r.nombres + ' ' + r.apellidos) + '</b></div>' +
          (previa ? '<img src="' + previa + '" style="max-width:100%;max-height:320px;border-radius:10px;border:1px solid #e3e9f2;" />'
                  : '<div style="font-size:13px;">Archivo PDF pegado desde el portapapeles.</div>'),
    showCancelButton: true, confirmButtonText: 'Subir', cancelButtonText: 'Cancelar', focusCancel: true
  });
  if (previa) { try { URL.revokeObjectURL(previa); } catch (e) {} }
  if (!res.isConfirmed) return;

  await subirComprobanteArchivo_(file, contaNombrePegado_(file));
}

/* ── Guardar: un solo botón para los cuatro bloques ── */
async function guardarContador_() {
  const r = CONTA.actual; if (!r) return;
  const val = id => { const el = document.querySelector('#' + id); return el ? el.value : ''; };
  const chk = id => { const el = document.querySelector('#' + id); return el ? el.checked : false; };

  const procesoSel = val('c-proceso');
  const body = {
    usuarioId: currentUser.id, n: r.n,
    proceso: procesoSel === 'Otro' ? String(val('c-proceso-otro') || '').trim() : procesoSel,
    documento: val('c-documento'), nacimiento: val('c-nacimiento'),
    tipoPlan: val('c-tipoPlan'), sponsor: val('c-sponsor'), planPrograma: val('c-planPrograma'),
    addsOn: Array.from(document.querySelectorAll('.c-adds:checked')).map(c => c.value),

    precioUsd: val('c-precioUsd'), valorInscrip: val('c-valorInscrip'),
    metodoInscrip: val('c-metodoInscrip'), cuentaInscrip: val('c-cuentaInscrip'),
    comprobanteUrl: val('c-comprobanteUrl'),

    contratoOk: chk('c-contratoOk'),
    nombreDeudor: val('c-nombreDeudor'), cedulaDeudor: val('c-cedulaDeudor'),
    ofertaMax: val('c-ofertaMax'), pagoOferta: chk('c-pagoOferta'),
    metodoOferta: val('c-metodoOferta'), cuentaOferta: val('c-cuentaOferta'),
    ofertaUsd: val('c-ofertaUsd'), ofertaCop: val('c-ofertaCop'),

    totalMax: val('c-totalMax'), pagoTotal: chk('c-pagoTotal'),
    metodoTotal: val('c-metodoTotal'), cuentaTotal: val('c-cuentaTotal'),
    totalUsd: val('c-totalUsd'), totalCop: val('c-totalCop'),

    pagoSevis: chk('c-pagoSevis'), sevisCop: val('c-sevisCop'), recargo: val('c-recargo')
  };

  if (procesoSel === 'Otro' && !body.proceso) {
    Swal.fire({ icon: 'warning', title: 'Falta el proceso', text: 'Escribe cuál es el proceso.' }); return;
  }

  try {
    const out = await apiPost('guardarContador', body);
    cerrarModalContador_();
    await recargarContador_(true);
    if (out.paseAInscrito) {
      Swal.fire({ icon: 'success', title: '¡Inscrito!', html: `<b>${esc_(out.nombres)} ${esc_(out.apellidos)}</b> quedó en estado <b>INSCRITO</b>.` });
    } else if (out.avisoContrato) {
      /* Fase 4 — se acaba de validar el contrato. */
      const a = out.avisoContrato;
      if (a.enviado) {
        const canal = a.canal === 'EMAIL' ? 'correo' : (a.canal === 'WHATSAPP' ? 'WhatsApp' : 'correo y WhatsApp');
        Swal.fire({ icon: 'success', title: 'Contrato validado',
          html: `Se le avisó a <b>${esc_(out.nombres)} ${esc_(out.apellidos)}</b> por <b>${canal}</b> para que siga con la prueba de inglés.` });
      } else {
        Swal.fire({ icon: 'warning', title: 'Contrato validado, pero sin aviso',
          html: `El check quedó guardado, pero el mensaje no salió.<br><small>${esc_(a.motivo || '')}</small>` });
      }
    } else {
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1200, showConfirmButton: false });
    }
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: String(e.message || e) });
  }
}

/* ============================================================
   EVENTOS FIJOS
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#conta-search')?.addEventListener('input', e => {
    CONTA.filtroTexto = e.target.value; renderContaCards_();
  });
  document.querySelector('#conta-refresh')?.addEventListener('click', () => recargarContador_(false));
  document.querySelector('#conta-modal-close')?.addEventListener('click', cerrarModalContador_);
  document.querySelector('#conta-cancel')?.addEventListener('click', cerrarModalContador_);
  document.querySelector('#conta-save')?.addEventListener('click', guardarContador_);
  /* Fase 4 — pegar el comprobante con Ctrl+V estando abierto el modal. */
  document.addEventListener('paste', contaPegarComprobante_);
  document.querySelector('#conta-visor-close')?.addEventListener('click', cerrarVisorConta_);
  /* Tocar por fuera de la tarjeta también cierra el visor. */
  document.querySelector('#conta-visor')?.addEventListener('click', e => {
    if (e.target && e.target.id === 'conta-visor') cerrarVisorConta_();
  });
  document.querySelector('#cpick-cancel')?.addEventListener('click', () =>
    document.querySelector('#conta-picker').classList.add('hidden'));
  document.querySelector('#cpick-ok')?.addEventListener('click', () => {
    const dia  = CPICK.dias[Math.min(cpickSel_(document.querySelector('#cpick-dia')), CPICK.dias.length - 1)];
    const mes  = cpickSel_(document.querySelector('#cpick-mes'));
    const anio = CPICK.anios[Math.min(cpickSel_(document.querySelector('#cpick-anio')), CPICK.anios.length - 1)];
    document.querySelector('#conta-picker').classList.add('hidden');
    const pad = n => String(n).padStart(2, '0');
    const iso = anio + '-' + pad(mes + 1) + '-' + pad(dia);
    const hoy = new Date();
    let edad = hoy.getFullYear() - anio;
    if (hoy.getMonth() < mes || (hoy.getMonth() === mes && hoy.getDate() < dia)) edad--;
    if (CPICK.onOk) CPICK.onOk(iso, dia + ' de ' + CPICK_MESES[mes] + ' de ' + anio, edad);
  });
  document.querySelectorAll('.cpick-arrow').forEach(b => b.addEventListener('click', () => {
    const col = document.querySelector('#' + b.dataset.col); if (!col) return;
    const n = col.querySelectorAll('.iosp-item').length;
    const i = Math.min(Math.max(cpickSel_(col) + (+b.dataset.d), 0), n - 1);
    col.scrollTop = i * CPICK.H; cpickMarcar_(col);
    if (b.dataset.col !== 'cpick-dia') cpickRebuildDias_();
  }));
});
