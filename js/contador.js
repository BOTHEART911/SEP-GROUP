/* ============================================================
 * SEP GROUP — VISTA CONTADOR (Fase 2 · 10/08/2026)
 * 12/08/2026: en el bloque del contrato se ve la fecha y hora en que el
 * estudiante aceptó el Acuerdo de firma electrónica (CONTADOR.FECHA_ACEPTA,
 * la misma que queda impresa bajo las firmas del PDF).
 *
 * Fase 4 (11/08/2026): validación del contrato con aviso al estudiante,
 * comprobante pegable con Ctrl+V y refresco de fondo de verdad silencioso.
 * Fase 5 (11/08/2026): vista EN VIVO, tarjetas de la más reciente a la más
 * antigua, zona de archivo que de verdad acepta arrastrar/pegar/adjuntar,
 * Ver·Descargar·Reemplazar en todo archivo guardado, tres comprobantes
 * opcionales más (oferta, pago total y adicionales) y botón Eliminar
 * (purga definitiva) para ADMIN y DESARROLLADOR.
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
  filtroTexto: '', cargado: false,
  zonaActiva: null            // FASE 5 — última zona de archivo usada (para el pegado)
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
  /* FASE 5 — de la más reciente a la más antigua. El backend ya manda
     así la lista; esto es la red de seguridad del front. */
  let list = contaBasePlan_().slice().sort((a, b) => b.n - a.n);
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
    card.querySelector('[data-act="eliminar"]')?.addEventListener('click', () => eliminarInscripcion_(r));
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
  /* FASE 5 — los tres comprobantes opcionales. */
  if (r.comprobanteOfertaUrl) archivos.push(`<button class="act-btn" data-ver="${esc_(r.comprobanteOfertaUrl)}" data-titulo="Comprobante de pago de oferta">💵 Comp. oferta</button>`);
  if (r.comprobanteTotalUrl)  archivos.push(`<button class="act-btn" data-ver="${esc_(r.comprobanteTotalUrl)}" data-titulo="Comprobante de pago total">🏦 Comp. pago total</button>`);
  (r.comprobantesExtra || []).forEach((u, i) =>
    archivos.push(`<button class="act-btn" data-ver="${esc_(u)}" data-titulo="Comprobante adicional ${i + 1}">📎 Adicional ${i + 1}</button>`));

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
      ${contaPuedeEliminar_() ? '<button class="act-btn act-btn--rojo" data-act="eliminar">🗑️ Eliminar</button>' : ''}
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
  /* FASE 5 — descarga directa desde el propio visor. */
  const dl = document.querySelector('#conta-visor-bajar');
  if (dl) dl.href = id ? 'https://drive.google.com/uc?export=download&id=' + id : url;
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
/* AJUSTE 11/08 — las listas se editan en Configuración › Listas. Si el
   administrador quita una opción, la ficha que YA la tenía guardada la
   sigue mostrando (marcada como fuera de lista) para no perder el dato
   al guardar otra cosa del formulario. */
function contaSelect_(id, opciones, valor, vacio) {
  const lista = (opciones || []).slice();
  const v = String(valor == null ? '' : valor).trim();
  const fuera = v && !lista.some(o => String(o) === v);
  const ops = ['<option value="">' + (vacio || '— Selecciona —') + '</option>']
    .concat(lista.map(o => `<option value="${esc_(o)}"${String(valor) === String(o) ? ' selected' : ''}>${esc_(o)}</option>`));
  if (fuera) ops.push(`<option value="${esc_(v)}" selected>${esc_(v)} (ya no está en la lista)</option>`);
  return `<select id="${id}">${ops.join('')}</select>`;
}

/* Adds-on: los de la lista viva + los que ya trae guardados esta ficha
   aunque se hayan retirado de la lista (AJUSTE 11/08). */
function contaAddsOn_(lista, guardados) {
  const ops = (lista || []).slice();
  (guardados || []).forEach(g => { if (g && ops.indexOf(g) < 0) ops.push(g); });
  return ops.map(a =>
    `<label class="conta-chk"><input type="checkbox" class="c-adds" value="${esc_(a)}"${(guardados || []).indexOf(a) >= 0 ? ' checked' : ''}/><span>${esc_(a)}${(lista || []).indexOf(a) < 0 ? ' <small>(fuera de lista)</small>' : ''}</span></label>`).join('');
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
          <div class="conta-checks">${contaAddsOn_(op.addsOn, r.addsOn)}</div></div>
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
        ${contaZonaHtml_('ins', 'Comprobante de pago de inscripción', {
          tipo: 'inscripcion', titulo: 'Comprobante de inscripción', urls: [r.comprobanteUrl],
          nota: 'Al guardar el comprobante el estudiante pasa a <b>INSCRITO</b>.' })}
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
          ${r.fechaAcepta ? `<span class="conta-hint conta-acepta">🔐 Aceptado: <b>${esc_(r.fechaAcepta)}</b></span>` : ''}
          ${r.documentoUrl ? `<button type="button" class="btn btn-ghost" data-ver="${esc_(r.documentoUrl)}" data-titulo="Documento del estudiante">🆔 Ver documento</button>` : ''}
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
        ${contaZonaHtml_('ofe', 'Comprobante pago de oferta', {
          tipo: 'oferta', titulo: 'Comprobante de pago de oferta', opcional: true,
          urls: [r.comprobanteOfertaUrl] })}
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
        ${contaZonaHtml_('tot', 'Comprobante pago total', {
          tipo: 'total', titulo: 'Comprobante de pago total', opcional: true,
          urls: [r.comprobanteTotalUrl] })}
      </div>
    </details>

    <details class="conta-bloque">
      <summary>🎓 Bloque 4 · SEVIS y recargos</summary>
      <div class="form-grid">
        <div class="fld"><label class="conta-chk"><input type="checkbox" id="c-pagoSevis"${r.pagoSevis ? ' checked' : ''}/><span>Pago del SEVIS</span></label>
          <small class="conta-hint">${r.fechaSevis ? 'Pagado el ' + contaFechaTexto_(r.fechaSevis) : 'La fecha se pone sola'}</small></div>
        <div class="fld"><label>Valor del SEVIS (COP)</label><input id="c-sevisCop" type="text" inputmode="numeric" value="${r.sevisCop}" /></div>
        <div class="fld"><label>Recargo por incumplimientos (USD)</label><input id="c-recargo" type="text" inputmode="decimal" value="${r.recargo}" /></div>
        ${contaZonaHtml_('ext', 'Comprobantes adicionales', {
          tipo: 'extra', titulo: 'Comprobante adicional', opcional: true, multiple: true,
          urls: r.comprobantesExtra || [],
          nota: 'Puedes cargar varios: se guardan todos en esta misma tarjeta.' })}
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
  /* FASE 5 — las cuatro zonas de archivo (arrastrar · pegar · adjuntar). */
  CONTA.zonaActiva = 'ins';
  ['ins', 'ofe', 'tot', 'ext'].forEach(contaZonaCablear_);
  document.querySelectorAll('#conta-modal-body [data-ver]').forEach(b =>
    b.addEventListener('click', () => abrirVisorConta_(b.dataset.ver, b.dataset.titulo)));

  document.querySelector('#modal-contador').classList.remove('hidden');
}

function cerrarModalContador_() {
  document.querySelector('#modal-contador')?.classList.add('hidden');
  CONTA.actual = null;
}

/* ============================================================
   FASE 5 (11/08/2026) — ZONA DE ARCHIVO: arrastrar · pegar · adjuntar
   ============================================================
   Por qué existe: el pegado con Ctrl+V solo llega al navegador cuando
   el foco está en un elemento EDITABLE. Escuchando en el documento
   funcionaba a veces (imagen copiada de una página) y no funcionaba
   nunca copiando un ARCHIVO desde el explorador de Windows, y el
   menú del clic derecho ni siquiera ofrecía "Pegar".
   La solución es una caja editable de verdad: recibe el foco, acepta
   el pegado del sistema, ofrece "Pegar" en el clic derecho y además
   acepta arrastrar y soltar. Lo que se pegue que no sea archivo se
   descarta (la caja nunca se queda con texto dentro).

   Cada zona guarda su estado en CFZ y no depende de inputs ocultos:
   guardarContador_ lee de aquí. */

const CFZ = {};                 // id → { tipo, multiple, urls, titulo }
const CFZ_MAX_MB = 5;

/* Estructura de una zona. urls es SIEMPRE arreglo (aunque acepte uno). */
function contaZonaInit_(id, cfg) {
  CFZ[id] = {
    tipo: cfg.tipo, multiple: !!cfg.multiple, titulo: cfg.titulo,
    urls: (cfg.urls || []).map(u => String(u || '').trim()).filter(Boolean)
  };
}

function contaZonaHtml_(id, etiqueta, cfg) {
  contaZonaInit_(id, cfg);
  const z = CFZ[id];
  return `<div class="fld fld-full">
    <label>${esc_(etiqueta)}${cfg.opcional ? ' <small>(opcional)</small>' : ''}</label>
    <div class="cfz" id="cfz-${id}" data-zona="${id}">
      <input type="file" class="cfz-file" id="cfz-file-${id}" accept=".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf"${z.multiple ? ' multiple' : ''} hidden />
      <div class="cfz-drop" id="cfz-drop-${id}" contenteditable="true" spellcheck="false"
           role="button" tabindex="0" aria-label="Arrastra, pega o adjunta ${esc_(etiqueta)}"></div>
      <div class="cfz-list" id="cfz-list-${id}"></div>
    </div>
    ${cfg.nota ? `<small class="conta-hint">${cfg.nota}</small>` : ''}
  </div>`;
}

/* La caja editable no debe quedarse con texto: se repinta siempre. */
function contaZonaPintarCaja_(id) {
  const drop = document.querySelector('#cfz-drop-' + id);
  if (!drop) return;
  drop.innerHTML = '<span class="cfz-msg">📎 <b>Arrastra</b> el archivo, <b>pega</b> con Ctrl+V o <b>haz clic</b> para elegirlo' +
    '<small>Imagen o PDF · máx. ' + CFZ_MAX_MB + ' MB</small></span>';
}

function contaZonaPintarLista_(id) {
  const cont = document.querySelector('#cfz-list-' + id);
  const z = CFZ[id]; if (!cont || !z) return;
  if (!z.urls.length) { cont.innerHTML = '<span class="cfz-vacio">Sin archivo cargado</span>'; return; }
  cont.innerHTML = z.urls.map((u, i) => `
    <div class="cfz-item">
      <span class="cfz-item__ic">${/\.pdf(\?|$)/i.test(u) ? '📄' : '🧾'}</span>
      <span class="cfz-item__t">${esc_(z.titulo)}${z.multiple ? ' ' + (i + 1) : ''}</span>
      <span class="cfz-item__b">
        <button type="button" class="act-btn" data-cfz="ver" data-i="${i}">👁 Ver</button>
        <button type="button" class="act-btn" data-cfz="reemplazar" data-i="${i}">♻️ Reemplazar</button>
        ${z.multiple ? `<button type="button" class="act-btn act-btn--rojo" data-cfz="quitar" data-i="${i}">✕ Quitar</button>` : ''}
      </span>
    </div>`).join('');
  cont.querySelectorAll('[data-cfz]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i, url = CFZ[id].urls[i];
    if (b.dataset.cfz === 'ver') abrirVisorConta_(url, CFZ[id].titulo);
    else if (b.dataset.cfz === 'reemplazar') contaZonaElegir_(id, i);
    else if (b.dataset.cfz === 'quitar') {
      CFZ[id].urls.splice(i, 1); contaZonaPintarLista_(id);
      contaZonaAviso_(id, 'Quitado de la lista. Pulsa <b>Guardar</b> para dejarlo registrado.');
    }
  }));
}

/* Descargar sin abrir el visor: enlace directo de Drive. */
function contaDescargar_(url) {
  const id = contaDriveId_(url);
  const href = id ? 'https://drive.google.com/uc?export=download&id=' + id : url;
  const a = document.createElement('a');
  a.href = href; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}

function contaZonaAviso_(id, html) {
  const drop = document.querySelector('#cfz-drop-' + id);
  if (!drop) return;
  drop.innerHTML = '<span class="cfz-msg cfz-msg--ok">' + html + '</span>';
  setTimeout(() => contaZonaPintarCaja_(id), 3500);
}

function contaZonaElegir_(id, idx) {
  const inp = document.querySelector('#cfz-file-' + id);
  if (!inp) return;
  inp.dataset.reemplaza = (idx === undefined || idx === null) ? '' : String(idx);
  inp.click();
}

/* Cablea una zona: clic, teclado, arrastre y pegado propio. */
function contaZonaCablear_(id) {
  const caja = document.querySelector('#cfz-' + id);
  const drop = document.querySelector('#cfz-drop-' + id);
  const inp  = document.querySelector('#cfz-file-' + id);
  if (!caja || !drop || !inp) return;

  contaZonaPintarCaja_(id);
  contaZonaPintarLista_(id);

  drop.addEventListener('click', () => { CONTA.zonaActiva = id; contaZonaElegir_(id); });
  drop.addEventListener('focus', () => { CONTA.zonaActiva = id; });
  drop.addEventListener('keydown', e => {
    /* La caja es editable solo para poder pegar: nadie debe escribir en
       ella. Se deja pasar Ctrl/Cmd+V y las teclas de navegación. */
    const combo = e.ctrlKey || e.metaKey;
    if (combo) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); contaZonaElegir_(id); return; }
    if (e.key === 'Tab' || e.key === 'Escape') return;
    e.preventDefault();
  });
  drop.addEventListener('input', () => contaZonaPintarCaja_(id));   // red de seguridad

  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation(); drop.classList.add('is-drag');
  }));
  ['dragleave', 'dragend'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('is-drag')));
  drop.addEventListener('drop', async e => {
    e.preventDefault(); e.stopPropagation(); drop.classList.remove('is-drag');
    CONTA.zonaActiva = id;
    const files = contaArchivosDe_(e.dataTransfer);
    if (!files.length) { contaZonaAviso_(id, '❌ Eso que soltaste no es una imagen ni un PDF.'); return; }
    await contaZonaSubirVarios_(id, files, null);
  });

  drop.addEventListener('paste', async e => {
    CONTA.zonaActiva = id;
    const files = contaArchivosDe_(e.clipboardData);
    e.preventDefault();                        // nunca se pega texto dentro
    if (!files.length) {
      contaZonaAviso_(id, '❌ En el portapapeles no hay una imagen ni un PDF. Copia el archivo o la imagen y vuelve a pegar.');
      return;
    }
    await contaZonaSubirVarios_(id, files, null);
  });

  inp.addEventListener('change', async e => {
    const files = Array.from(e.target.files || []);
    const idx = e.target.dataset.reemplaza;
    e.target.value = ''; e.target.dataset.reemplaza = '';
    if (!files.length) return;
    await contaZonaSubirVarios_(id, files, idx === '' ? null : +idx);
  });
}

/* Archivos de un portapapeles o de un arrastre. Sirve tanto para la
   imagen copiada de una página como para el ARCHIVO copiado desde el
   explorador de Windows (que llega en dt.files, no en dt.items). */
function contaArchivosDe_(dt) {
  if (!dt) return [];
  const out = [];
  const admite = f => f && (/^image\//.test(f.type) || f.type === 'application/pdf' ||
                            /\.(pdf|png|jpe?g|webp)$/i.test(f.name || ''));
  if (dt.items) {
    Array.from(dt.items).forEach(it => {
      if (it.kind !== 'file') return;
      const f = it.getAsFile();
      if (admite(f)) out.push(f);
    });
  }
  if (!out.length && dt.files) Array.from(dt.files).forEach(f => { if (admite(f)) out.push(f); });
  return out;
}

/* Nombre para lo que llega sin nombre (pegar una imagen no lo trae). */
function contaNombreDe_(file, n) {
  if (file.name && /\.[a-z0-9]{2,5}$/i.test(file.name)) return file.name;
  const ext = file.type === 'application/pdf' ? 'pdf'
            : (String(file.type).split('/')[1] || 'png').replace('jpeg', 'jpg');
  return 'comprobante' + (n ? '-' + n : '') + '.' + (['pdf', 'png', 'jpg', 'webp'].indexOf(ext) >= 0 ? ext : 'png');
}

async function contaZonaSubirVarios_(id, files, reemplazaIdx) {
  const z = CFZ[id]; if (!z) return;
  const lista = z.multiple ? files : files.slice(0, 1);
  for (let i = 0; i < lista.length; i++) {
    const ok = await contaZonaSubir_(id, lista[i], i === 0 ? reemplazaIdx : null);
    if (!ok) break;
  }
}

async function contaZonaSubir_(id, file, reemplazaIdx) {
  const z = CFZ[id], r = CONTA.actual;
  if (!z || !r) return false;
  if (file.size > CFZ_MAX_MB * 1024 * 1024) {
    Swal.fire({ icon: 'warning', title: 'Archivo muy pesado', text: 'No puede pasar de ' + CFZ_MAX_MB + ' MB.' });
    return false;
  }

  /* Confirmación con vista previa: un pegado sin querer no puede
     cambiarle un comprobante a un estudiante. */
  let previa = '';
  if (/^image\//.test(file.type)) { try { previa = URL.createObjectURL(file); } catch (e) {} }
  const res = await Swal.fire({
    title: (reemplazaIdx === null || reemplazaIdx === undefined) ? '¿Subir este archivo?' : '¿Reemplazar el archivo?',
    html: '<div style="font-size:13px;margin-bottom:8px;">' + esc_(z.titulo) + ' · N° ' + r.n +
          ' · <b>' + esc_(r.nombres + ' ' + r.apellidos) + '</b></div>' +
          (previa ? '<img src="' + previa + '" style="max-width:100%;max-height:300px;border-radius:10px;border:1px solid #e3e9f2;" />'
                  : '<div style="font-size:13px;">📄 ' + esc_(file.name || 'Archivo PDF') + '</div>'),
    showCancelButton: true, confirmButtonText: 'Subir', cancelButtonText: 'Cancelar', focusCancel: true
  });
  if (previa) { try { URL.revokeObjectURL(previa); } catch (e) {} }
  if (!res.isConfirmed) return false;

  try {
    Swal.fire({ title: 'Subiendo…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const base64 = await contaBase64_(file);
    const out = await apiPost('subirComprobante', {
      usuarioId: currentUser.id, n: r.n, tipo: z.tipo,
      filename: contaNombreDe_(file, z.multiple ? z.urls.length + 1 : 0),
      mime: file.type || '', base64: base64
    });
    Swal.close();
    if (reemplazaIdx !== null && reemplazaIdx !== undefined && z.urls[reemplazaIdx] !== undefined) z.urls[reemplazaIdx] = out.url;
    else if (z.multiple) z.urls.push(out.url);
    else z.urls = [out.url];
    contaZonaPintarLista_(id);
    contaZonaAviso_(id, '✅ Archivo cargado. Pulsa <b>Guardar</b> para dejarlo registrado.');
    return true;
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo subir', text: String(e.message || e) });
    return false;
  }
}

function contaBase64_(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1]);
    fr.onerror = () => rej(new Error('No se pudo leer el archivo'));
    fr.readAsDataURL(file);
  });
}

function contaZonaUrls_(id) { return (CFZ[id] && CFZ[id].urls) ? CFZ[id].urls.slice() : []; }
function contaZonaUrl_(id)  { return contaZonaUrls_(id)[0] || ''; }

/* ============================================================
   FASE 5 — ELIMINAR UNA INSCRIPCIÓN (solo ADMIN y DEV)
   ============================================================ */
function contaPuedeEliminar_() {
  const rol = String(currentUser?.rol || '').toUpperCase();
  return rol === 'DESARROLLADOR' || rol === 'SUPERUSUARIO';
}

async function eliminarInscripcion_(r) {
  if (!contaPuedeEliminar_()) return;
  const archivos = [r.comprobanteUrl, r.comprobanteOfertaUrl, r.comprobanteTotalUrl,
                    r.contratoUrl, r.documentoUrl, r.cedulaUrl]
    .concat(r.comprobantesExtra || []).filter(Boolean).length;

  const res = await Swal.fire({
    icon: 'warning',
    title: 'Eliminar definitivamente',
    html: `Se borra la inscripción <b>N° ${r.n}</b> de <b>${esc_(r.nombres + ' ' + r.apellidos)}</b> ` +
          `de la hoja CONTADOR${archivos ? ` y sus <b>${archivos} archivo(s)</b> de Drive` : ''}.<br><br>` +
          `<small>Esto <b>no se puede deshacer</b> y los archivos no van a la papelera. ` +
          `El lead sigue en COMERCIAL con su estado.<br>` +
          `Escribe <b>${r.n}</b> para confirmar.</small>`,
    input: 'text', inputPlaceholder: 'N° de la inscripción',
    showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc2626', focusCancel: true,
    inputValidator: v => (String(v || '').trim() === String(r.n) ? undefined : 'Escribe el N° ' + r.n)
  });
  if (!res.isConfirmed) return;

  try {
    Swal.fire({ title: 'Eliminando…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const out = await apiPost('eliminarContador', { usuarioId: currentUser.id, n: r.n });
    await recargarContador_(true);
    const fallidos = (out.archivos && out.archivos.fallidos) ? out.archivos.fallidos.length : 0;
    Swal.fire({
      icon: fallidos ? 'warning' : 'success',
      title: 'Inscripción eliminada',
      html: `Se borró la fila y ${out.archivos.borrados} archivo(s).` +
            (fallidos ? `<br><small>${fallidos} archivo(s) no se pudieron borrar de Drive.</small>` : '')
    });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: String(e.message || e) });
  }
}

/* ============================================================
   FASE 5 — VISTA EN VIVO (mismo motor que el tablero Comercial)
   ============================================================
   El backend escribe un número en /meta/contador_rev cada vez que
   cambia algo de la hoja CONTADOR. Aquí se escucha SOLO ese número
   (nunca datos) y al verlo cambiar se recarga la lista ya filtrada
   por el servidor. Si Firebase no está disponible, se cae al sondeo
   cada 12 s, igual que en Comercial. */
const FBCO = { ref: null, primed: false, refrescoTimer: null, pollTimer: null, cargando: false };

/* Con un modal/visor/rueda abierto NO se repinta: se reintenta luego. */
function contaOverlayAbierto_() {
  const abierto = sel => { const e = document.querySelector(sel); return !!e && !e.classList.contains('hidden'); };
  if (abierto('#modal-contador') || abierto('#conta-visor') || abierto('#conta-picker') || abierto('#conta-fsheet')) return true;
  return !!(window.Swal && Swal.isVisible && Swal.isVisible());
}

async function contaRefrescarVivo_() {
  if (document.hidden) return;
  if (FBCO.cargando) return;
  if (contaOverlayAbierto_()) {
    clearTimeout(FBCO.refrescoTimer);
    FBCO.refrescoTimer = setTimeout(contaRefrescarVivo_, 1500);
    return;
  }
  FBCO.cargando = true;
  try { await recargarContador_(true); } catch (e) {} finally { FBCO.cargando = false; }
}
function contaAgendarRefresco_() {
  clearTimeout(FBCO.refrescoTimer);
  FBCO.refrescoTimer = setTimeout(contaRefrescarVivo_, 400);   // agrupa cambios seguidos
}

function contaEscuchar_() {
  /* Sin SDK de Firebase no hay tiempo real: se avisa para que quien
     llama arranque el sondeo (si no, la vista se quedaría quieta). */
  if (!window.firebase || !firebase.database) return false;
  contaDejarDeEscuchar_();
  FBCO.primed = false;
  FBCO.ref = firebase.database().ref('meta/contador_rev');
  FBCO.ref.on('value',
    () => { if (!FBCO.primed) { FBCO.primed = true; return; } contaAgendarRefresco_(); },
    err => {
      console.warn('RT /meta/contador_rev no disponible, uso sondeo:', err && err.message || err);
      contaDejarDeEscuchar_();
      contaIniciarSondeo_();
    });
  return true;
}
function contaDejarDeEscuchar_() {
  if (FBCO.ref) { try { FBCO.ref.off(); } catch (e) {} FBCO.ref = null; }
  clearTimeout(FBCO.refrescoTimer); FBCO.refrescoTimer = null;
}
function contaIniciarSondeo_() {
  contaDetenerSondeo_();
  FBCO.pollTimer = setInterval(contaRefrescarVivo_, 12000);
}
function contaDetenerSondeo_() {
  if (FBCO.pollTimer) { clearInterval(FBCO.pollTimer); FBCO.pollTimer = null; }
}

async function contaLiveOn_() {
  try {
    if (typeof fbAsegurarSesion_ === 'function') await fbAsegurarSesion_();
    contaDetenerSondeo_();
    if (!contaEscuchar_()) contaIniciarSondeo_();   // sin SDK → sondeo
  } catch (e) {
    console.warn('Contador en vivo sin Firebase, uso sondeo cada 12 s:', e && e.message || e);
    contaIniciarSondeo_();
  }
}
function contaLiveOff_() { contaDejarDeEscuchar_(); contaDetenerSondeo_(); }

/* Respaldo del pegado a nivel de documento: si el foco no está en una
   zona (por ejemplo justo al abrir el modal), el Ctrl+V se enruta a la
   última zona usada, y si no hay ninguna, a la del comprobante de
   inscripción. Las zonas ya atienden su propio pegado, así que aquí
   solo llegan los que nadie atendió. */
function contaModalAbierto_() {
  const m = document.querySelector('#modal-contador');
  return !!(m && !m.classList.contains('hidden') && CONTA.actual);
}

async function contaPegarEnDocumento_(ev) {
  if (!contaModalAbierto_()) return;
  if (ev.target && ev.target.closest && ev.target.closest('.cfz-drop')) return;   // ya lo atendió la zona
  const files = contaArchivosDe_(ev.clipboardData);
  if (!files.length) return;                       // pegar texto sigue siendo normal
  ev.preventDefault();
  const id = (CONTA.zonaActiva && CFZ[CONTA.zonaActiva]) ? CONTA.zonaActiva : 'ins';
  await contaZonaSubirVarios_(id, files, null);
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
    comprobanteUrl: contaZonaUrl_('ins'),
    comprobanteOfertaUrl: contaZonaUrl_('ofe'),
    comprobanteTotalUrl: contaZonaUrl_('tot'),
    comprobantesExtra: contaZonaUrls_('ext'),

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
  /* Fase 5 — respaldo del pegado: las zonas atienden el suyo, esto
     recoge el Ctrl+V hecho fuera de ellas con el modal abierto. */
  document.addEventListener('paste', contaPegarEnDocumento_);
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
