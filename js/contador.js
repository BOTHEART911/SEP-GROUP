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
 * Fase 3.3 · tanda A (20/08/2026): lo que se pega con Ctrl+V ya cae en la
 * zona del bloque que está abierto (antes todo lo pegado fuera de la caja
 * se iba al comprobante de INSCRIPCIÓN, aunque se estuviera trabajando el
 * de la oferta); la zona activa se ve resaltada y, si no se puede saber
 * cuál es, se pregunta.
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula
 * la garantía de funcionamiento.
 * ------------------------------------------------------------
 * Vive en su propio archivo a propósito: app.js ya pesa 150 KB y
 * esta vista crece con las fases siguientes.
 *
 * Usa de app.js: apiGet, apiPost, showView, esc_, currentUser,
 * abrirRuedaFecha_ (fechas máximas). Todas las ruedas salen de la
 * pieza única js/rueda.js (RUEDA.abrir).
 * ============================================================ */

const CONTA = {
  registros: [], catalogo: null, actual: null, sheetKey: null,
  filtroAsesor: '__ALL__', filtroEtapa: '__ALL__', filtroPlan: '__ALL__',
  filtroTexto: '', cargado: false,
  zonaActiva: null,           // FASE 5 — última zona de archivo usada (para el pegado)
  /* FASE 4 · ENTREGA 5 (punto 2.2) — la vista principal muestra
     ACTIVOS. Los retirados no desaparecen: se ven con el interruptor
     "Retirados" del resumen. Nace apagado en cada entrada. */
  verRetirados: false
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
    const d = await apiGet('contadorInit', { usuarioId: currentUser.id, lig: '1' }, { vista: 'contador' });   // 07/10 — listado ligero
    CONTA.catalogo  = d.catalogo;
    estPartCargar_(d.catalogo && d.catalogo.estadosPart);         // FASE 5.1 · D
    TEMP.set(d.temporadas); TEMP.montar('contador');               // FASE 5.1
    CONTA.todos     = d.registros || [];
    CONTA.registros = TEMP.filtrar(CONTA.todos);
    CONTA.cargado   = true;
    renderContaFiltros_(); renderContaCards_(); renderContaResumen_();
  } catch (e) {
    if (esCorte_(e)) return;
    Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: String(e.message || e) });
  }
}

/* FASE 5.1 — cambio de año: se recalcula lo visible, sin viajar. */
TEMP.alCambiar(() => {
  if (!CONTA.cargado || !CONTA.todos) return;
  CONTA.registros = TEMP.filtrar(CONTA.todos);
  try { renderContaFiltros_(); renderContaCards_(); renderContaResumen_(); } catch (e) { console.error(e); }
});

async function recargarContador_(silencioso) {
  try {
    /* Fase 4 — el refresco de fondo va SILENCIOSO de verdad: sin esto
       salía el girador (y ahora saldría el esqueleto) encima de datos
       que ya están pintados. */
    CONTA.todos = await apiGet('listContador', { usuarioId: currentUser.id, lig: '1' }, { silent: !!silencioso, vista: 'contador' });
    CONTA.registros = TEMP.filtrar(CONTA.todos);                    // FASE 5.1
    renderContaFiltros_(); renderContaCards_(); renderContaResumen_();
  } catch (e) {
    if (!silencioso && !esCorte_(e)) Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: String(e.message || e) });
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
/* FASE 4 · ENTREGA 5 · 2.2 — la raíz de TODOS los filtros. Los
   retirados salen de la vista principal (ruido visual) y se ven
   aparte. Al ponerse aquí, y no en cada pastilla, los conteos de las
   tres pastillas y del resumen cuadran solos. */
function contaVisibles_() {
  return CONTA.registros.filter(r => !!r.retirado === !!CONTA.verRetirados);
}
/* 5.5-D — el buscador entra a la cascada: el número de cada pastilla y
   de cada opción es exactamente lo que queda en pantalla. Los KPIs del
   resumen siguen sobre contaVisibles_ (totales de la temporada). */
function contaTexto_() {
  const txt = contaNormBusq_(String(CONTA.filtroTexto || '').trim());
  const base = contaVisibles_();
  if (!txt) return base;
  return base.filter(r =>
    contaNormBusq_(r.nombres + ' ' + r.apellidos).includes(txt) ||
    String(r.documento || '').includes(txt) ||
    String(r.whatsapp || '').includes(txt) ||
    String(r.n).includes(txt) ||
    contaNormBusq_(r.correo).includes(txt));
}
function contaBaseAsesor_() {
  const base = contaTexto_();
  if (CONTA.filtroAsesor === '__ALL__') return base;
  return base.filter(r => contaAsesorDe_(r) === CONTA.filtroAsesor);
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
    contaTexto_().forEach(r => { const k = contaAsesorDe_(r); c[k] = (c[k] || 0) + 1; });
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
  return k === 'asesor' ? contaTexto_().length
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
  const base = contaVisibles_();
  base.forEach(r => { c[r.etapa] = (c[r.etapa] || 0) + 1; });
  const vencidos = base.filter(r => r.alertaOferta === 'vencido' || r.alertaTotal === 'vencido').length;
  const pronto   = base.filter(r => r.alertaOferta === 'pronto'  || r.alertaTotal === 'pronto').length;
  const retirados = CONTA.registros.filter(r => r.retirado).length;

  let html = etapas.map(e => `<button class="conta-kpi" data-etapa="${e.clave}" style="--k:${e.color}">
      <span class="conta-kpi__n">${c[e.clave] || 0}</span>
      <span class="conta-kpi__t">${e.ic} ${esc_(e.label)}</span></button>`).join('');
  if (vencidos) html += `<div class="conta-kpi conta-kpi--alerta" style="--k:#dc2626">
      <span class="conta-kpi__n">${vencidos}</span><span class="conta-kpi__t">⏰ Vencidos</span></div>`;
  if (pronto) html += `<div class="conta-kpi" style="--k:#f59e0b">
      <span class="conta-kpi__n">${pronto}</span><span class="conta-kpi__t">🔔 Vencen pronto</span></div>`;
  /* 2.2 — sección Retirados. Es un interruptor, no una pastilla más:
     el retiro no se combina con la etapa, la reemplaza. */
  html += `<button class="conta-kpi conta-kpi--retiro${CONTA.verRetirados ? ' is-on' : ''}" data-retirados="1" style="--k:#dc2626">
      <span class="conta-kpi__n">${retirados}</span>
      <span class="conta-kpi__t">🛑 Retirados</span></button>`;

  cont.innerHTML = html;

  cont.querySelector('[data-retirados]')?.addEventListener('click', () => {
    CONTA.verRetirados = !CONTA.verRetirados;
    CONTA.filtroAsesor = '__ALL__'; CONTA.filtroEtapa = '__ALL__'; CONTA.filtroPlan = '__ALL__';
    renderContaResumen_(); renderContaFiltros_(); renderContaCards_();
  });

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
/* FASE 5.1 · B — número escrito por el Contador → número. COP no
   lleva decimales ("6.000.000" = 6000000); USD acepta 2200.50 o
   2200,50. Vacío = vacío (no se inventa un 0). */
function contaNumTxt_(v, decimal) {
  const t = String(v == null ? '' : v).trim();
  if (!t) return '';
  if (!decimal) { const d = t.replace(/\D/g, ''); return d ? Number(d) : ''; }
  let x = t.replace(/[^\d.,]/g, '');
  const ult = Math.max(x.lastIndexOf('.'), x.lastIndexOf(','));
  if (ult >= 0 && x.length - ult - 1 <= 2) x = x.slice(0, ult).replace(/[.,]/g, '') + '.' + x.slice(ult + 1);
  else x = x.replace(/[.,]/g, '');
  const n = Number(x); return isNaN(n) ? '' : n;
}
function contaSuma_(a, b) {
  if (a === '' && b === '') return '';
  return (Number(a) || 0) + (Number(b) || 0);
}
function contaGranTotalHtml_(oUsd, pUsd, oCop, pCop) {
  const usd = contaSuma_(contaNumTxt_(oUsd, true), contaNumTxt_(pUsd, true));
  const cop = contaSuma_(contaNumTxt_(oCop, false), contaNumTxt_(pCop, false));
  const fmtUsd = usd === '' ? '—' : 'US$ ' + Number(usd).toLocaleString('es-CO', { maximumFractionDigits: 2 });
  const fmtCop = cop === '' ? '—' : contaMoneda_(cop);
  return `<span class="conta-grantotal__t">🧮 Gran total <small>(oferta + programa completo)</small></span>
    <span class="conta-grantotal__v"><b>${fmtUsd}</b><small>USD</small></span>
    <span class="conta-grantotal__v"><b>${fmtCop}</b><small>COP</small></span>`;
}
function contaPintarGranTotal_() {
  const v = id => (document.querySelector('#' + id) || {}).value || '';
  const el = document.querySelector('#c-grantotal'); if (!el) return;
  el.innerHTML = contaGranTotalHtml_(v('c-ofertaUsd'), v('c-totalUsd'), v('c-ofertaCop'), v('c-totalCop'));
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
  /* FASE 5 — de la más reciente a la más antigua. El backend ya manda
     así la lista; esto es la red de seguridad del front.
     5.5-D — contaBasePlan_ ya trae el buscador; se pinta por tandas. */
  const list = contaBasePlan_().slice().sort((a, b) => b.n - a.n);
  vacio?.classList.toggle('hidden', list.length > 0);
  tandaPintar_(cont, list, r => contaCardHtml_(r), r => {
    const card = document.querySelector('#conta-card-' + r.n); if (!card) return;
    card.querySelector('[data-act="editar"]')?.addEventListener('click', () => abrirModalContador_(r));
    card.querySelector('[data-act="eliminar"]')?.addEventListener('click', () => eliminarInscripcion_(r));
    card.querySelectorAll('[data-ver]').forEach(b =>
      b.addEventListener('click', () => abrirVisorConta_(b.dataset.ver, b.dataset.titulo)));
    card.querySelectorAll('[data-campo]').forEach(b =>
      b.addEventListener('click', () => contaVerArchivo_(r, b.dataset.campo, Number(b.dataset.i), b.dataset.titulo, b)));
  });
}

/* 07/10/2026 — LISTADO LIGERO. La fila de la lista trae lo que pinta la
   tarjeta; la ficha completa (datos, URLs, historiales) se pide UNA vez
   al abrirla y se queda en la fila. */
async function contaFilaCompleta_(r) {
  if (!r || !r.lig) return r;
  const f = await apiGet('verContador', { usuarioId: currentUser.id, n: r.n }, { silent: true, vista: 'contador' });
  Object.keys(f || {}).forEach(k => { r[k] = f[k]; });
  delete r.lig;
  return r;
}
async function contaVerArchivo_(r, campo, i, titulo, btn) {
  if (btn && btn.disabled) return;
  if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }
  try {
    const f = await contaFilaCompleta_(r);
    const v = f[campo];
    const url = Array.isArray(v) ? v[i] : v;
    if (typeof url === 'string' && url) abrirVisorConta_(url, titulo);
  } catch (e) {
    if (esCorte_(e)) return;
    Swal.fire({ icon: 'error', title: 'No se pudo abrir el archivo', text: String(e.message || e) });
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); }
  }
}

/* FASE 5.1 · B — `banco`: null = no hay comprobante (sin indicador);
   true = pago validado en banco (punto verde); false = comprobante
   cargado pero aún sin validar (punto gris). */
function contaPaso_(ok, ic, titulo, banco) {
  const b = (banco === true || banco === false)
    ? `<i class="conta-step__banco${banco ? ' is-ok' : ''}" aria-hidden="true"></i>` : '';
  const t = titulo + (banco === true ? ' · validado en banco' : banco === false ? ' · sin validar en banco' : '');
  return `<span class="conta-step ${ok ? 'is-ok' : ''}" title="${esc_(t)}"><span class="conta-step__ic">${ic}</span>${b}</span>`;
}

function contaCardHtml_(r) {
  const alerta = (r.alertaOferta === 'vencido' || r.alertaTotal === 'vencido') ? 'vencido'
               : (r.alertaOferta === 'pronto'  || r.alertaTotal === 'pronto')  ? 'pronto' : '';
  const avisos = [];
  if (r.alertaOferta) avisos.push(`<span class="conta-aviso conta-aviso--${r.alertaOferta}">⏰ Oferta: ${contaFechaTexto_(r.ofertaMax)}</span>`);
  if (r.alertaTotal)  avisos.push(`<span class="conta-aviso conta-aviso--${r.alertaTotal}">⏰ Pago total: ${contaFechaTexto_(r.totalMax)}</span>`);
  /* FASE 4 · ENTREGA 3 (03/09/2026) — el participante ya tiene una
     oferta APROBADA (y por lo tanto Sponsor definido), pero todavía
     no se le digitó el precio del programa. El precio lo sigue
     poniendo el Contador a mano: esto solo lo recuerda. */
  if (r.ofertaConfirmada) {
    avisos.push(r.precioPendiente
      ? `<span class="conta-aviso conta-aviso--pronto">💼 Oferta confirmada (${esc_(r.ofertaConfirmada.sponsor || '—')}) · precio del programa pendiente</span>`
      : `<span class="conta-aviso">💼 Oferta confirmada: ${esc_(r.ofertaConfirmada.empleador)}</span>`);
  }

  /* 07/10/2026 — en el listado ligero el archivo viaja como 1 (hay
     archivo): el botón lleva el campo y la URL se trae al tocarlo. */
  const archivos = [];
  const btnArch = (campo, i, url, titulo, txt) => (typeof url === 'string' && url)
    ? `<button class="act-btn" data-ver="${esc_(url)}" data-titulo="${titulo}">${txt}</button>`
    : `<button class="act-btn" data-campo="${campo}" data-i="${i}" data-titulo="${titulo}">${txt}</button>`;
  if (r.comprobanteUrl) archivos.push(btnArch('comprobanteUrl', -1, r.comprobanteUrl, 'Comprobante de inscripción', '🧾 Comprobante'));
  if (r.contratoUrl)    archivos.push(btnArch('contratoUrl', -1, r.contratoUrl, 'Contrato firmado', '📄 Contrato'));
  if (r.documentoUrl)   archivos.push(btnArch('documentoUrl', -1, r.documentoUrl, 'Documento del estudiante', '🆔 Documento'));
  if (r.cedulaUrl)      archivos.push(btnArch('cedulaUrl', -1, r.cedulaUrl, 'Cédula del deudor solidario', '🧑‍🤝‍🧑 Cédula deudor'));
  /* FASE 5 — los tres comprobantes opcionales. */
  if (r.comprobanteOfertaUrl) archivos.push(btnArch('comprobanteOfertaUrl', -1, r.comprobanteOfertaUrl, 'Comprobante de pago de oferta', '💵 Comp. oferta'));
  if (r.comprobanteTotalUrl)  archivos.push(btnArch('comprobanteTotalUrl', -1, r.comprobanteTotalUrl, 'Comprobante de pago total', '🏦 Comp. pago total'));
  (r.comprobantesExtra || []).forEach((u, i) =>
    archivos.push(btnArch('comprobantesExtra', i, u, 'Comprobante adicional ' + (i + 1), '📎 Adicional ' + (i + 1))));

  /* FASE 4 · ENTREGA 5 · 2.2 — identificación en rojo. */
  if (r.retirado) {
    avisos.unshift(`<span class="conta-aviso conta-aviso--retiro">🛑 RETIRADO${r.retiroFecha ? ' · ' + esc_(r.retiroFecha) : ''}${r.retiroMotivo ? ' · ' + esc_(r.retiroMotivo) : ''}</span>`);
  }

  return `<div class="com-card conta-card${alerta ? ' conta-card--' + alerta : ''}${r.retirado ? ' conta-card--retirado' : ''}" id="conta-card-${r.n}">
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
      ${r.documento ? `<span>🆔 ${esc_(r.documento)}${r.edad !== '' ? ' · ' + r.edad + ' años' : ''}</span>` : ''}
      <span>📱 ${esc_(r.whatsapp)}</span>
      ${r.tipoPlan ? `<span>🎯 ${esc_(r.tipoPlan)}</span>` : ''}
      ${r.sponsor ? `<span>🤝 ${esc_(r.sponsor)}</span>` : ''}
      ${r.planPrograma ? `<span>📦 ${esc_(r.planPrograma)}</span>` : ''}
      ${procesoChipHtml_(r.proceso, r.retirado)}
      ${r.asesor ? `<span>👤 ${esc_(r.asesor)}</span>` : ''}
      ${r.asesorProcesos ? `<span>🧭 ${esc_(r.asesorProcesos)}</span>` : ''}
    </div>
    ${estPartHtml_(r)}
    <div class="conta-steps">
      ${contaPaso_(!!r.comprobanteUrl, '💳', 'Comprobante de inscripción', r.comprobanteUrl ? !!r.bancoIns : null)}
      ${contaPaso_(!!r.contratoUrl, '📄', 'Contrato creado')}
      ${contaPaso_(!!r.contratoOk, '✅', 'Contrato validado')}
      ${contaPaso_(!!r.pagoOferta, '💵', 'Pago de la oferta', r.comprobanteOfertaUrl ? !!r.bancoOferta : null)}
      ${contaPaso_(!!r.pagoTotal, '🏦', 'Pago total', r.comprobanteTotalUrl ? !!r.bancoTotal : null)}
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
  const nota = document.querySelector('#conta-visor-nota');
  if (nota) nota.textContent = (typeof notaVisorPrivado_ === 'function') ? notaVisorPrivado_() : '';   // 07/10/2026
  document.querySelector('#conta-visor').classList.remove('hidden');
}
function cerrarVisorConta_() {
  document.querySelector('#conta-visor')?.classList.add('hidden');
  const f = document.querySelector('#conta-visor-frame'); if (f) f.src = 'about:blank';
}

/* ============================================================
   RUEDAS DE FECHA DEL CONTADOR (10/10/2026 · 2)
   ============================================================
   Antes eran una rueda propia (CPICK, #conta-picker); ahora usan la
   pieza única js/rueda.js con las mismas reglas:
     · Nacimiento: solo años que dan una edad del catálogo (17–28 por
       defecto), arranca el 1 de enero del año más reciente.
     · Inscripción y pago de oferta: fechas ya ocurridas — año actual y
       los CONTA_INSCRIP_ANIOS anteriores (ajuste 25/08), abre en hoy.
   onOk(iso 'aaaa-mm-dd', texto[, edad]) igual que siempre. */
const CPICK_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CONTA_INSCRIP_ANIOS = 3;

function cpickTexto_(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return d + ' de ' + CPICK_MESES[m - 1] + ' de ' + a;
}
/* 'aaaa-mm-dd' o 'dd/mm/aaaa' (como lo guarda la hoja a mano) → 'aaaa-mm-dd'. */
function cpickIso_(valorISO) {
  const v = String(valorISO || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return '';
}
/* Un valor solo se respeta si su año cabe en la rueda. */
function cpickValor_(valorISO, desde, hasta) {
  const v = cpickIso_(valorISO);
  if (!v) return '';
  const a = +v.slice(0, 4);
  return (a >= desde && a <= hasta) ? v : '';
}

function abrirRuedaNacimiento_(valorISO, onOk) {
  const min = CONTA.catalogo?.edad?.min || 17;
  const max = CONTA.catalogo?.edad?.max || 28;
  const y = new Date().getFullYear();
  const desde = y - max, hasta = y - min;
  /* Año fuera del rango: se conserva el día y el mes en el año más reciente. */
  let v = cpickIso_(valorISO);
  if (v && !cpickValor_(v, desde, hasta)) v = hasta + v.slice(4);
  RUEDA.abrir({
    modo: 'fecha', titulo: 'Nacimiento', desde, hasta,
    valor: v, fechaDef: hasta + '-01-01',
    onOk: iso => {
      if (!iso || !onOk) return;
      const [a, m, d] = iso.split('-').map(Number);
      const hoy = new Date();
      let edad = hoy.getFullYear() - a;
      if (hoy.getMonth() < m - 1 || (hoy.getMonth() === m - 1 && hoy.getDate() < d)) edad--;
      onOk(iso, cpickTexto_(iso), edad);
    }
  });
}

function abrirRuedaInscripcion_(valorISO, onOk) {
  return abrirRuedaFechaConta_(valorISO, onOk, 'Inscripción');
}

/* Cualquier fecha ya ocurrida del modal (inscripción y pago de oferta):
   año actual por defecto, sin cota inferior en hoy. */
function abrirRuedaFechaConta_(valorISO, onOk, titulo) {
  const y = new Date().getFullYear();
  const desde = y - CONTA_INSCRIP_ANIOS, hasta = y;
  RUEDA.abrir({
    modo: 'fecha', titulo: titulo || 'Inscripción', desde, hasta,
    valor: cpickValor_(valorISO, desde, hasta),
    onOk: iso => { if (iso && onOk) onOk(iso, cpickTexto_(iso)); }
  });
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

/* ============================================================
   FASE 4 · ENTREGA 5 — BLOQUE "PROCESOS" DE LA FICHA
   ============================================================
   Dos cosas que el plan pone juntas porque van juntas: quién es su
   Asesor de Procesos (3.1 y 3.3) y si está retirado (2.4 y 2.6).

   Si todavía no tiene asesor, aquí hay un selector: ese es el que
   pide el 3.1 al confirmar el comprobante de inscripción. Si ya lo
   tiene, se muestra el actual y —solo para Superadmin— el botón
   "Cambiar asesor", que es una acción aparte y con su motivo, no un
   campo más del formulario. */
function contaPuedeReasignar_() {
  return !!(CONTA.catalogo?.permisosE5?.reasignar);
}
function contaPuedeRetirar_() {
  return !!(CONTA.catalogo?.permisosE5?.retirar);
}
/* FASE 4.1 · punto 5 (04/09/2026) — reactivar quedó SOLO en
   Superadmin (y DESARROLLADOR, por la regla de la casa). Razón de
   Javier: antes de devolver a alguien al proceso, SEP revisa el caso. */
function contaPuedeReactivar_() {
  return !!(CONTA.catalogo?.permisosE5?.reactivar);
}
/* FASE 5.1 · D — Inactivo: lo marcan y lo reactivan Procesos y
   Superadmin (y DEV). El Contador solo lo ve. */
function contaPuedeInactivar_() {
  return !!(CONTA.catalogo?.permisosE5?.inactivar);
}
function contaInactivoHtml_(r) {
  if (r.retirado) return '';
  if (r.inactivo) {
    return `<div class="conta-retiro conta-inactivo is-on">
        <div><b>💤 Inactivo</b> <span class="conta-hint">— dejó de responder</span></div>
        <div class="conta-hint">${esc_(r.inactivoFecha || '')}${r.inactivoPor ? ' · ' + esc_(r.inactivoPor) : ''}</div>
        <div class="conta-hint">Motivo: ${esc_(r.inactivoMotivo || '—')}</div>
        <div class="conta-hint">Sigue recibiendo mensajes y conserva su oferta y su cupo.</div>
        ${contaPuedeInactivar_()
          ? '<button type="button" class="act-btn" id="c-reactivar-inactivo">▶️ Reactivar el proceso</button>'
          : '<div class="conta-hint conta-hint--aviso">▶️ Reactivarlo lo hacen Procesos o un Superadministrador.</div>'}
      </div>`;
  }
  return contaPuedeInactivar_()
    ? `<div class="conta-retiro conta-inactivo">
         <button type="button" class="act-btn" id="c-inactivo">💤 Marcar inactivo</button>
         <small class="conta-hint">Para quien dejó de responder. No es un retiro: no silencia ni libera la oferta.</small>
       </div>`
    : '';
}
async function contaInactivo_(r, marcar, btn) {
  const out = await estPartInactivo_(r.n, marcar, `${r.nombres} ${r.apellidos}`, btn);
  if (!out) return;
  /* Mismo objeto en la lista de todas las temporadas y en la visible. */
  const fila = (CONTA.todos || []).find(x => x.n === r.n);
  if (fila) estPartParcharInactivo_(fila, out);
  if (fila !== r) estPartParcharInactivo_(r, out);
  cerrarModalContador_();
  renderContaFiltros_(); renderContaCards_(); renderContaResumen_();
}

function contaBloqueProcesos_(r) {
  const asesores = CONTA.catalogo?.asesoresProcesos || [];
  const tiene = !!(r.asesorProcesos || r.asesorProcesosId);

  const asesorHtml = tiene
    ? `<div class="conta-asesor">
         <span class="conta-asesor__nombre">🧭 ${esc_(r.asesorProcesos)}</span>
         ${contaPuedeReasignar_()
            ? '<button type="button" class="act-btn" id="c-apr-cambiar">🔁 Cambiar asesor</button>'
            : '<small class="conta-hint">Solo SUPERUSUARIO o DESARROLLADOR pueden cambiarlo.</small>'}
       </div>`
    : `<select id="c-asesorProcesos">
         <option value="">— Elegir asesor —</option>
         ${asesores.map(a => `<option value="${esc_(a.id)}">${esc_(a.nombre)}</option>`).join('')}
       </select>
       <small class="conta-hint">Obligatorio para completar la inscripción: sin asesor no se puede
       guardar el comprobante de inscripción.${asesores.length ? '' :
       ' <b>No hay usuarios con rol PROCESOS, SUPERUSUARIO o DESARROLLADOR activos</b>: créalos en Configuración → Usuarios.'}</small>`;

  const retiroHtml = r.retirado
    ? `<div class="conta-retiro is-on">
         <div><b>🛑 Participante retirado</b></div>
         <div class="conta-hint">${esc_(r.retiroFecha || '')}${r.retiroPor ? ' · ' + esc_(r.retiroPor) : ''}</div>
         <div class="conta-hint">Motivo: ${esc_(r.retiroMotivo || '—')}</div>
         <div class="conta-hint">Está en silencio: no le sale ningún mensaje automático.</div>
         ${contaPuedeReactivar_()
           ? '<button type="button" class="act-btn" id="c-reactivar">♻️ Reactivar participante</button>'
           : '<div class="conta-hint conta-hint--aviso">♻️ <b>Reactivar solo lo hace un Superadministrador.</b> Antes de devolver a alguien al proceso, SEP revisa el caso: pídeselo a un Superadministrador de SEP.</div>'}
       </div>`
    : `<div class="conta-retiro">
         ${r.retiroFecha ? `<div class="conta-hint">Estuvo retirado el ${esc_(r.retiroFecha)}${r.reactivaFecha ? ' · reactivado el ' + esc_(r.reactivaFecha) : ''}.</div>` : ''}
         ${contaPuedeRetirar_() ? '<button type="button" class="act-btn act-btn--rojo" id="c-retirar">🛑 Retirar participante</button>' : ''}
         <small class="conta-hint">Retirar no elimina nada: conserva formulario, documentos, pagos, oferta e historial.</small>
       </div>`;

  return `<details class="conta-bloque" open>
      <summary>🧭 Procesos</summary>
      <div class="form-grid">
        <div class="fld"><label>Asesor de Procesos</label>${asesorHtml}</div>
        <div class="fld"><label>Estado del participante</label>${estPartHtml_(r)}${retiroHtml}${contaInactivoHtml_(r)}</div>
      </div>
    </details>`;
}

/* Pide el motivo y retira. El motivo es obligatorio (2.4) y lo vuelve
   a validar el backend: aquí solo se evita el viaje en balde. */
async function contaRetirar_(r) {
  const { value: motivo } = await Swal.fire({
    icon: 'warning', title: 'Retirar participante',
    html: `<b>${esc_(r.nombres)} ${esc_(r.apellidos)}</b> saldrá de la vista principal y dejará de recibir
           mensajes automáticos.<br><small>No se borra nada. Si tiene una oferta activa, se cancela y el cupo se libera.</small>`,
    input: 'textarea', inputLabel: 'Motivo del retiro (obligatorio)',
    inputPlaceholder: 'Escribe por qué se retira…',
    showCancelButton: true, confirmButtonText: 'Retirar', cancelButtonText: 'Cancelar',
    inputValidator: v => (String(v || '').trim().length < 5) && 'Escribe el motivo (mínimo 5 caracteres).'
  });
  if (!motivo) return;
  try {
    const out = await apiPost('retirarParticipante', { usuarioId: currentUser.id, n: r.n, motivo: motivo });
    cerrarModalContador_();
    await recargarContador_(true);
    Swal.fire({ icon: 'success', title: 'Participante retirado',
      html: (out.oferta && out.oferta.habia
              ? `Su oferta <b>${esc_(out.oferta.empleador || out.oferta.oferta)}</b> quedó cancelada y ${esc_(out.oferta.cupo)}.<br>`
              : '') +
            `<small>${esc_(out.comercial || '')}</small>` });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo retirar', text: String(e.message || e) });
  }
}

async function contaReactivar_(r) {
  const { value: motivo } = await Swal.fire({
    icon: 'question', title: 'Reactivar participante',
    html: `<b>${esc_(r.nombres)} ${esc_(r.apellidos)}</b> vuelve a las listas normales y se le apaga el silencio.
           <br><small>La oferta que tenía al retirarse NO se le devuelve: vuelve a escoger desde cero.</small>`,
    input: 'textarea', inputLabel: 'Motivo de la reactivación (obligatorio)',
    showCancelButton: true, confirmButtonText: 'Reactivar', cancelButtonText: 'Cancelar',
    inputValidator: v => (String(v || '').trim().length < 5) && 'Escribe el motivo (mínimo 5 caracteres).'
  });
  if (!motivo) return;
  try {
    await apiPost('reactivarParticipante', { usuarioId: currentUser.id, n: r.n, motivo: motivo });
    cerrarModalContador_();
    await recargarContador_(true);
    Swal.fire({ icon: 'success', title: 'Participante reactivado', timer: 1400, showConfirmButton: false });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo reactivar', text: String(e.message || e) });
  }
}

/* 3.3 — cambio de asesor (solo Superadmin). Pide el nuevo y el motivo
   en la misma pantalla. */
async function contaCambiarAsesor_(r) {
  const asesores = (CONTA.catalogo?.asesoresProcesos || []).filter(a => a.id !== r.asesorProcesosId);
  if (!asesores.length) {
    Swal.fire({ icon: 'info', title: 'No hay a quién pasarlo',
      text: 'No hay otro usuario activo con rol PROCESOS, SUPERUSUARIO o DESARROLLADOR.' });
    return;
  }
  const opciones = {};
  asesores.forEach(a => { opciones[a.id] = a.nombre; });
  const { value: elegido } = await Swal.fire({
    title: 'Cambiar Asesor de Procesos',
    html: `Asesor actual: <b>${esc_(r.asesorProcesos || '—')}</b>`,
    input: 'select', inputOptions: opciones, inputPlaceholder: 'Elige el nuevo asesor',
    showCancelButton: true, confirmButtonText: 'Continuar',
    inputValidator: v => !v && 'Elige el nuevo asesor.'
  });
  if (!elegido) return;
  const { value: motivo } = await Swal.fire({
    title: 'Motivo del cambio', input: 'textarea',
    inputPlaceholder: 'Opcional, pero queda en el historial…',
    showCancelButton: true, confirmButtonText: 'Cambiar asesor'
  });
  if (motivo === undefined) return;
  try {
    const out = await apiPost('asignarAsesorProcesos',
      { usuarioId: currentUser.id, n: r.n, asesorId: elegido, motivo: motivo || '' });
    cerrarModalContador_();
    await recargarContador_(true);
    Swal.fire({ icon: 'success', title: 'Asesor cambiado',
      html: `<b>${esc_(out.anterior || '—')}</b> → <b>${esc_(out.nuevo)}</b>` });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo cambiar', text: String(e.message || e) });
  }
}

/* FASE 5.1 — temporada de la ficha y, si la cédula participó en otros
   años, accesos a esos expedientes (solo consulta). Sale de la lista
   que ya está en memoria: cero viajes. */
function contaTemporadaHtml_(r) {
  const doc = String(r.documento || '').replace(/\D/g, '');
  const otras = doc.length >= 5 ? (CONTA.todos || []).filter(x =>
    String(x.documento || '').replace(/\D/g, '') === doc && x.n !== r.n && x.anio && x.anio !== r.anio) : [];
  otras.sort((a, b) => Number(b.anio) - Number(a.anio));
  return (r.anio ? `<span class="com-badge conta-temp-badge">📅 ${esc_(r.anio)}</span>` : '') +
    otras.map(o => `<button type="button" class="com-badge conta-temp-otra" data-conta-otra="${o.n}"
      title="Abrir el expediente de ${esc_(o.anio)} (solo consulta)">🔁 ${esc_(o.anio)} · N° ${o.n}</button>`).join('');
}

/* FASE 5.1 — tras guardar se parcha la fila en memoria con la ficha que
   devuelve el servidor (un solo viaje; antes se recargaba la lista). */
function contaParchar_(d) {
  if (!d || !d.n || !CONTA.todos) return false;
  const i = CONTA.todos.findIndex(x => x.n === d.n);
  if (i < 0) return false;
  /* FASE 5.1 · B — las marcas de banco solo viajan cuando están puestas:
     si se desmarcaron, hay que borrarlas antes de mezclar. */
  ['bancoIns', 'bancoOferta', 'bancoTotal', 'bancoExtra'].forEach(k => { delete CONTA.todos[i][k]; });
  Object.assign(CONTA.todos[i], d);
  if (!d.lig) delete CONTA.todos[i].lig;                           // 07/10 — ya es la ficha completa
  CONTA.registros = TEMP.filtrar(CONTA.todos);
  try { renderContaFiltros_(); renderContaCards_(); renderContaResumen_(); } catch (e) { return false; }
  return true;
}

/* 07/10/2026 — cabecera antes que datos: con la fila ligera se abre el
   modal con lo que ya se sabe y la ficha completa llega en un viaje. */
async function abrirModalContador_(r) {
  if (!r || !r.lig) return abrirModalContadorCompleto_(r);
  const pedido = CONTA.abriendo = r.n;
  CONTA.actual = null;
  document.querySelector('#conta-modal-title').textContent = 'N° ' + r.n + ' · ' + r.nombres + ' ' + r.apellidos;
  document.querySelector('#conta-modal-sub').innerHTML =
    `<span class="com-badge" style="background:${r.etapaColor}">${r.etapaIc} ${esc_(r.etapaLabel)}</span>`;
  document.querySelector('#conta-modal-body').innerHTML =
    /* 5.5-D — forma real de la ficha: secciones con campos en 2 columnas */
    ((window.SEPEsqueleto && SEPEsqueleto.html) ? SEPEsqueleto.html('formsec', 2) :
    '<div class="sep-sk-rows" role="status" aria-label="Cargando la ficha"><span class="sep-sk sep-sk-field"></span><span class="sep-sk sep-sk-field"></span><span class="sep-sk sep-sk-field"></span></div>');
  document.querySelector('#modal-contador').classList.remove('hidden');
  try {
    const f = await contaFilaCompleta_(r);
    if (CONTA.abriendo !== pedido || document.querySelector('#modal-contador').classList.contains('hidden')) return;
    abrirModalContadorCompleto_(f);
  } catch (e) {
    if (CONTA.abriendo !== pedido) return;
    cerrarModalContador_();
    if (esCorte_(e)) return;
    Swal.fire({ icon: 'error', title: 'No se pudo abrir la ficha', text: String(e.message || e) });
  }
}

function abrirModalContadorCompleto_(r) {
  CONTA.abriendo = r && r.n;
  CONTA.actual = r;
  const op = CONTA.catalogo?.opciones || {};
  const procesoCerrado = (op.proceso || []).indexOf(r.proceso) >= 0 || !r.proceso;

  document.querySelector('#conta-modal-title').textContent = 'N° ' + r.n + ' · ' + r.nombres + ' ' + r.apellidos;
  document.querySelector('#conta-modal-sub').innerHTML =
    `<span class="com-badge" style="background:${r.etapaColor}">${r.etapaIc} ${esc_(r.etapaLabel)}</span>
     <span class="com-badge" style="background:${r.estadoColor}">${esc_(r.estadoLabel)}</span>
     ${r.claveAcceso ? `<span class="conta-clave">🔑 ${esc_(r.claveAcceso)}</span>` : ''}
     ${contaTemporadaHtml_(r)}`;
  /* FASE 5.1 — abrir la ficha de otra temporada (solo consulta). */
  document.querySelectorAll('#conta-modal-sub [data-conta-otra]').forEach(b => b.addEventListener('click', () => {
    const otra = (CONTA.todos || []).find(x => String(x.n) === b.dataset.contaOtra);
    if (otra) abrirModalContador_(otra);
  }));

  document.querySelector('#conta-modal-body').innerHTML = `
    ${contaBloqueProcesos_(r)}

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
        <div class="fld"><label>Fecha de inscripción</label>
          <button type="button" class="btn btn-ghost conta-fecha" id="c-fechaIns-btn">
            <span id="c-fechaIns-text">${r.fechaInscripcion ? esc_(contaFechaTexto_(r.fechaInscripcion)) : 'Automática'}</span></button>
          <input id="c-fechaInscripcion" type="hidden" value="${esc_(r.fechaInscripcion)}" />
          <small class="conta-hint">Se pone sola al entrar el comprobante. Escríbela si el pago fue antes.
            <span id="c-fechaIns-clear" role="button" tabindex="0"
                  style="cursor:pointer;text-decoration:underline">Quitar</span></small></div>
        ${contaZonaHtml_('ins', 'Comprobante de pago de inscripción', {
          tipo: 'inscripcion', titulo: 'Comprobante de inscripción', urls: [r.comprobanteUrl],
          banco: r.bancoIns ? [r.comprobanteUrl] : [],
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
        <div class="fld"><label>Fecha pago de oferta</label>
          <button type="button" class="btn btn-ghost conta-fecha" id="c-fechaOferta-btn">
            <span id="c-fechaOferta-text">${r.fechaOferta ? esc_(contaFechaTexto_(r.fechaOferta)) : 'Seleccionar'}</span></button>
          <input id="c-fechaOferta" type="hidden" value="${esc_(r.fechaOferta)}" />
          <small class="conta-hint">Con esta fecha el pago de la oferta queda registrado.
            <span id="c-fechaOferta-clear" role="button" tabindex="0"
                  style="cursor:pointer;text-decoration:underline">Quitar</span></small></div>
        <div class="fld"><label class="conta-chk"><input type="checkbox" id="c-notifOferta" /><span>🔔 Notificar</span></label>
          <small class="conta-hint">Solo marcándolo se le envía el mensaje del <b>pago de la oferta</b>,
            que es el que le abre el <b>formulario</b>. Sin marcarlo se guarda y no sale nada.
            Nace apagado cada vez que se abre la ficha y necesita la <b>fecha</b> y el
            <b>comprobante</b> de este bloque.</small></div>
        <div class="fld"><label>Método de pago oferta</label>${contaSelect_('c-metodoOferta', op.metodo, r.metodoOferta)}</div>
        <div class="fld"><label>Cuenta de banco oferta</label>${contaSelect_('c-cuentaOferta', op.cuenta, r.cuentaOferta)}</div>
        <div class="fld"><label>Valor oferta (USD)</label><input id="c-ofertaUsd" type="text" inputmode="decimal" value="${r.ofertaUsd}" /></div>
        <div class="fld"><label>Valor oferta (COP)</label><input id="c-ofertaCop" type="text" inputmode="numeric" value="${r.ofertaCop}" /></div>
        ${contaZonaHtml_('ofe', 'Comprobante pago de oferta', {
          tipo: 'oferta', titulo: 'Comprobante de pago de oferta', opcional: true,
          urls: [r.comprobanteOfertaUrl], banco: r.bancoOferta ? [r.comprobanteOfertaUrl] : [] })}
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
        <div class="fld"><label>Valor programa completo (USD)</label><input id="c-totalUsd" type="text" inputmode="decimal" value="${r.totalUsd}" /></div>
        <div class="fld"><label>Valor programa completo (COP)</label><input id="c-totalCop" type="text" inputmode="numeric" value="${r.totalCop}" /></div>
        ${contaZonaHtml_('tot', 'Comprobante pago total', {
          tipo: 'total', titulo: 'Comprobante de pago total', opcional: true,
          urls: [r.comprobanteTotalUrl], banco: r.bancoTotal ? [r.comprobanteTotalUrl] : [] })}
      </div>
    </details>

    <!-- FASE 5.1 · B — GRAN TOTAL (respuesta 5 de Javier): oferta +
         programa completo, COP y USD por separado. Se calcula aquí con
         lo que está escrito en los campos; no se guarda ni hay TRM. -->
    <div class="conta-grantotal" id="c-grantotal" aria-live="polite">${contaGranTotalHtml_(r.ofertaUsd, r.totalUsd, r.ofertaCop, r.totalCop)}</div>

    <details class="conta-bloque">
      <summary>🎓 Bloque 4 · SEVIS y recargos</summary>
      <div class="form-grid">
        <div class="fld"><label class="conta-chk"><input type="checkbox" id="c-pagoSevis"${r.pagoSevis ? ' checked' : ''}/><span>Pago del SEVIS</span></label>
          <small class="conta-hint">${r.fechaSevis ? 'Pagado el ' + contaFechaTexto_(r.fechaSevis) : 'La fecha se pone sola'}</small></div>
        <div class="fld"><label>Valor del SEVIS (COP)</label><input id="c-sevisCop" type="text" inputmode="numeric" value="${r.sevisCop}" /></div>
        <div class="fld"><label>Recargo por incumplimientos (USD)</label><input id="c-recargo" type="text" inputmode="decimal" value="${r.recargo}" /></div>
        ${contaZonaHtml_('ext', 'Comprobantes adicionales', {
          tipo: 'extra', titulo: 'Comprobante adicional', opcional: true, multiple: true,
          urls: r.comprobantesExtra || [], banco: r.bancoExtra || [],
          nota: 'Puedes cargar varios: se guardan todos en esta misma tarjeta.' })}
      </div>
    </details>

    <!-- AJUSTE 1 (19/08/2026) — GUARDAR EN SILENCIO.
         Nace SIEMPRE desmarcado (se pinta con el modal, no se guarda
         en la ficha) y solo afecta a ESE guardado. -->
    <div class="conta-silencio">
      <label class="conta-chk">
        <input type="checkbox" id="c-silencio" />
        <span>🔕 Guardar en silencio</span></label>
      <small class="conta-hint">No se envía ningún WhatsApp ni correo en este guardado
        (ni el de la inscripción, ni el del contrato validado, ni el del pago de la oferta).
        Sirve para montar procesos atrasados sin confundir al estudiante. Se apaga solo al terminar.</small>
    </div>`;

  /* Cableado */
  /* FASE 5.1 · B — el gran total se recalcula mientras se escribe. */
  ['c-ofertaUsd', 'c-totalUsd', 'c-ofertaCop', 'c-totalCop'].forEach(idc =>
    document.querySelector('#' + idc)?.addEventListener('input', contaPintarGranTotal_));
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
  document.querySelector('#c-fechaIns-btn')?.addEventListener('click', () => {
    abrirRuedaInscripcion_(document.querySelector('#c-fechaInscripcion').value, (iso, texto) => {
      document.querySelector('#c-fechaInscripcion').value = iso;
      document.querySelector('#c-fechaIns-text').textContent = texto;
    });
  });
  /* Quitar = vuelve a automático: el servidor la repone sola el día que
     entre un comprobante nuevo. */
  const limpiarFechaIns = () => {
    document.querySelector('#c-fechaInscripcion').value = '';
    document.querySelector('#c-fechaIns-text').textContent = 'Automática';
  };
  /* FASE 4 · ENTREGA 5 — botones del bloque Procesos. */
  document.querySelector('#c-retirar')?.addEventListener('click', () => contaRetirar_(r));
  document.querySelector('#c-reactivar')?.addEventListener('click', () => contaReactivar_(r));
  /* FASE 5.1 · D */
  document.querySelector('#c-inactivo')?.addEventListener('click', e => contaInactivo_(r, true, e.currentTarget));
  document.querySelector('#c-reactivar-inactivo')?.addEventListener('click', e => contaInactivo_(r, false, e.currentTarget));
  document.querySelector('#c-apr-cambiar')?.addEventListener('click', () => contaCambiarAsesor_(r));

  document.querySelector('#c-fechaIns-clear')?.addEventListener('click', limpiarFechaIns);
  document.querySelector('#c-fechaIns-clear')?.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); limpiarFechaIns(); }
  });
  document.querySelector('#c-fechaOferta-btn')?.addEventListener('click', () => {
    abrirRuedaFechaConta_(document.querySelector('#c-fechaOferta').value, (iso, texto) => {
      document.querySelector('#c-fechaOferta').value = iso;
      document.querySelector('#c-fechaOferta-text').textContent = texto;
    }, 'Pago oferta');
  });
  /* Quitar = el pago de la oferta deja de estar registrado. */
  const limpiarFechaOferta = () => {
    document.querySelector('#c-fechaOferta').value = '';
    document.querySelector('#c-fechaOferta-text').textContent = 'Seleccionar';
  };
  document.querySelector('#c-fechaOferta-clear')?.addEventListener('click', limpiarFechaOferta);
  document.querySelector('#c-fechaOferta-clear')?.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); limpiarFechaOferta(); }
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
  /* FASE 3.3 · tanda A (20/08/2026) — al abrir un bloque, su zona pasa a
     ser la zona activa: abrir "Bloque 2 · Contrato, deudor y oferta" y
     pegar tiene que dejar el archivo en el comprobante de la OFERTA,
     no en el de la inscripción (que es donde caía antes). */
  document.querySelectorAll('#conta-modal-body details.conta-bloque').forEach(det => {
    det.addEventListener('toggle', () => contaBloqueAbierto_(det));
  });
  contaZonasPintarFoco_();
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
    urls: (cfg.urls || []).map(u => String(u || '').trim()).filter(Boolean),
    /* FASE 5.1 · B — URLs validadas en banco. Va por URL (no por
       posición): si se reemplaza un archivo, el nuevo nace sin validar. */
    banco: new Set((cfg.banco || []).map(u => String(u || '').trim()).filter(Boolean))
  };
}
function contaZonaBanco_(id) {
  const z = CFZ[id]; if (!z) return [];
  return z.urls.filter(u => z.banco.has(u));
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
    <div class="cfz-item${z.banco.has(u) ? ' is-banco' : ''}">
      <span class="cfz-item__ic">${/\.pdf(\?|$)/i.test(u) ? '📄' : '🧾'}</span>
      <span class="cfz-item__t">${esc_(z.titulo)}${z.multiple ? ' ' + (i + 1) : ''}</span>
      <span class="cfz-item__b">
        <button type="button" class="act-btn" data-cfz="ver" data-i="${i}">👁 Ver</button>
        <button type="button" class="act-btn" data-cfz="reemplazar" data-i="${i}">♻️ Reemplazar</button>
        ${z.multiple ? `<button type="button" class="act-btn act-btn--rojo" data-cfz="quitar" data-i="${i}">✕ Quitar</button>` : ''}
      </span>
      <label class="cfz-banco"><input type="checkbox" data-cfz-banco="${i}"${z.banco.has(u) ? ' checked' : ''}/>
        <span>🏦 Pago validado en banco</span></label>
    </div>`).join('');
  cont.querySelectorAll('[data-cfz-banco]').forEach(c => c.addEventListener('change', () => {
    const u = CFZ[id].urls[+c.dataset.cfzBanco]; if (!u) return;
    if (c.checked) CFZ[id].banco.add(u); else CFZ[id].banco.delete(u);
    c.closest('.cfz-item').classList.toggle('is-banco', c.checked);
  }));
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

/* ============================================================
   FASE 3.3 · tanda A (20/08/2026) — A DÓNDE VA LO QUE SE PEGA
   ============================================================
   Qué pasaba: el Ctrl+V solo llega a su zona cuando el foco está
   DENTRO de esa caja. Cualquier otro pegado lo recogía el respaldo
   del documento y lo mandaba a CONTA.zonaActiva, que nacía en 'ins'
   y solo cambiaba si se TOCABA la caja... y tocarla abre de una el
   diálogo de archivos. Resultado: abrir el Bloque 2 y pegar el
   comprobante de la oferta lo subía al de INSCRIPCIÓN (y si se
   confirmaba, se lo pisaba al estudiante).

   Ahora la zona activa se marca sola —al abrir el bloque, al tocar
   cualquier parte de la zona o al darle el foco—, se ve resaltada en
   pantalla, y si de verdad no se puede saber a cuál va, se pregunta
   en vez de adivinar. */

/* Una zona está a la vista si su bloque está desplegado. */
function contaZonaVisible_(id) {
  const drop = document.querySelector('#cfz-drop-' + id);
  if (!drop || !CFZ[id]) return false;
  const det = drop.closest('details');
  return !det || !!det.open;
}

/* Resalta la zona que recibirá lo próximo que se pegue. Va en estilo
   en línea a propósito: no obliga a repasar styles.css ni el tema. */
function contaZonasPintarFoco_() {
  Object.keys(CFZ).forEach(k => {
    const drop = document.querySelector('#cfz-drop-' + k);
    if (!drop) return;
    const on = (k === CONTA.zonaActiva) && contaZonaVisible_(k);
    drop.style.borderColor = on ? '#0891b2' : '';
    drop.style.boxShadow   = on ? '0 0 0 3px rgba(8,145,178,.15)' : '';
  });
}

function contaZonaActivar_(id) {
  if (!CFZ[id]) return;
  CONTA.zonaActiva = id;
  contaZonasPintarFoco_();
}

/* Al desplegar un bloque, su zona manda. Al cerrarlo, si la activa era
   la suya, deja de haber activa (y se pregunta antes de subir nada). */
function contaBloqueAbierto_(det) {
  if (!det) return;
  const drop = det.querySelector('.cfz-drop');
  const id = drop ? String(drop.id || '').replace('cfz-drop-', '') : '';
  if (det.open) { if (id) contaZonaActivar_(id); return; }
  if (!contaZonaVisible_(CONTA.zonaActiva)) { CONTA.zonaActiva = ''; }
  contaZonasPintarFoco_();
}

/* Zona a la que va un pegado hecho FUERA de las cajas. Cadena vacía =
   no se puede saber, hay que preguntar. */
function contaZonaCandidata_() {
  const act = CONTA.zonaActiva;
  if (act && CFZ[act] && contaZonaVisible_(act)) return act;
  const visibles = Object.keys(CFZ).filter(contaZonaVisible_);
  return visibles.length === 1 ? visibles[0] : '';
}

/* Preguntar en vez de adivinar. Devuelve el id de la zona o ''. */
async function contaPreguntarZona_() {
  const visibles = Object.keys(CFZ).filter(contaZonaVisible_);
  if (!visibles.length) return '';
  const ops = {};
  visibles.forEach(k => { ops[k] = CFZ[k].titulo; });
  const res = await Swal.fire({
    title: '¿En cuál lo pego?',
    input: 'select', inputOptions: ops, inputValue: visibles[0],
    showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar'
  });
  return res.isConfirmed ? String(res.value || '') : '';
}

/* Cablea una zona: clic, teclado, arrastre y pegado propio. */
function contaZonaCablear_(id) {
  const caja = document.querySelector('#cfz-' + id);
  const drop = document.querySelector('#cfz-drop-' + id);
  const inp  = document.querySelector('#cfz-file-' + id);
  if (!caja || !drop || !inp) return;

  contaZonaPintarCaja_(id);
  contaZonaPintarLista_(id);

  /* FASE 3.3 — tocar CUALQUIER parte de la zona (no solo la caja) ya la
     deja marcada como activa, aunque el clic termine abriendo el
     diálogo de archivos y el foco se vaya. */
  caja.addEventListener('pointerdown', () => contaZonaActivar_(id));
  caja.addEventListener('mousedown',  () => contaZonaActivar_(id));
  drop.addEventListener('click', () => { contaZonaActivar_(id); contaZonaElegir_(id); });
  drop.addEventListener('focus', () => contaZonaActivar_(id));
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
    contaZonaActivar_(id);
    const files = contaArchivosDe_(e.dataTransfer);
    if (!files.length) { contaZonaAviso_(id, '❌ Eso que soltaste no es una imagen ni un PDF.'); return; }
    await contaZonaSubirVarios_(id, files, null);
  });

  drop.addEventListener('paste', async e => {
    contaZonaActivar_(id);
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
    /* 10/10/2026 — el avión cubre también la lectura del archivo. */
    const out = await SEPAvion.durante({ titulo: 'Subiendo el comprobante…', pasos: ['Leyendo el archivo…', 'Subiendo a Drive…', 'Guardando…'] }, async () => {
      const base64 = await contaBase64_(file);
      return apiPost('subirComprobante', {
        usuarioId: currentUser.id, n: r.n, tipo: z.tipo,
        filename: contaNombreDe_(file, z.multiple ? z.urls.length + 1 : 0),
        mime: file.type || '', base64: base64
      });
    });
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
/* AJUSTE 4 (19/08/2026) — el borrado con purga es de SUPERUSUARIO,
   DESARROLLADOR y PROCESOS. Se mira el permiso que manda el servidor
   y, si la sesión guardada en el navegador es vieja y no lo trae, se
   cae al listado de roles (multi-rol de la Fase 3.1). */
function contaPuedeEliminar_() {
  if (!currentUser) return false;
  if (currentUser.puedePurgar) return true;
  const roles = (typeof misRoles_ === 'function') ? (misRoles_(currentUser) || [])
              : [String(currentUser.rol || '').toUpperCase()];
  return ['DESARROLLADOR', 'SUPERUSUARIO', 'PROCESOS'].some(x => roles.indexOf(x) >= 0);
}

/* AJUSTE 4 (19/08/2026) — ahora la purga es EN CASCADA: además de la
   fila de CONTADOR y sus archivos, se lleva la fila de NIVEL_INGLES,
   la del FORMULARIO_SUMMER y los documentos del estudiante. El lead
   se queda en COMERCIAL tal como esté, y su chat NO se toca.
   Se confirma escribiendo el DOCUMENTO (o el N° si la ficha todavía
   no lo tiene digitado). */
async function eliminarInscripcion_(r) {
  if (!contaPuedeEliminar_()) return;
  const archivos = [r.comprobanteUrl, r.comprobanteOfertaUrl, r.comprobanteTotalUrl,
                    r.contratoUrl, r.documentoUrl, r.cedulaUrl]
    .concat(r.comprobantesExtra || []).filter(Boolean).length;

  const doc = String(r.documento || '').trim();
  const pedir = doc || String(r.n);
  const queEs = doc ? 'el documento del estudiante' : 'el N° de la inscripción';

  const res = await Swal.fire({
    icon: 'warning',
    title: 'Eliminar definitivamente',
    html: `Se borra a <b>${esc_(r.nombres + ' ' + r.apellidos)}</b> (inscripción <b>N° ${r.n}</b>) de ` +
          `<b>CONTADOR</b>, su ficha de <b>Nivel de Inglés</b>, su <b>formulario</b>, sus <b>documentos</b>, ` +
          `sus <b>ofertas</b> (el cupo vuelve a la oferta), su <b>visa</b> y su <b>verificación académica</b>` +
          `${archivos ? ` y <b>todos sus archivos</b> de Drive` : ''}.<br><br>` +
          `<small>Esto <b>no se puede deshacer</b> y los archivos no van a la papelera. ` +
          `El lead <b>sigue en Comercial</b> con su estado y sus notas.<br>` +
          `Escribe ${queEs} <b>${esc_(pedir)}</b> para confirmar.</small>`,
    input: 'text', inputPlaceholder: doc ? 'Documento del estudiante' : 'N° de la inscripción',
    showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc2626', focusCancel: true,
    inputValidator: v => (String(v || '').replace(/[\s.]/g, '') === pedir.replace(/[\s.]/g, '')
      ? undefined : 'Escribe ' + queEs + ': ' + pedir)
  });
  if (!res.isConfirmed) return;

  try {
    const out = await apiPost('purgarContador', { usuarioId: currentUser.id, n: r.n, confirmar: res.value });
    await recargarContador_(true);
    const fallidos = (out.archivos && out.archivos.fallidos) ? out.archivos.fallidos.length : 0;
    const arrastre = [];
    if (out.filas.nivel) arrastre.push('su ficha de Nivel de Inglés');
    if (out.filas.formulario) arrastre.push('su formulario');
    if (typeof purgaPartesExpediente_ === 'function') arrastre.push(...purgaPartesExpediente_(out.filas));
    Swal.fire({
      icon: fallidos ? 'warning' : 'success',
      title: 'Inscripción eliminada',
      html: `Se borró la fila${arrastre.length ? ', ' + arrastre.join(' y ') : ''} y ` +
            `${out.archivos.borrados} archivo(s) de Drive.` +
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
  if (abierto('#modal-contador') || abierto('#conta-visor') || abierto('#rueda-pk') || abierto('#conta-fsheet')) return true;
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
   zona ACTIVA —la del bloque que se acaba de abrir o la que se tocó—.
   Las zonas ya atienden su propio pegado, así que aquí solo llegan los
   que nadie atendió.
   FASE 3.3 · tanda A — ya NO se cae a 'ins' cuando no hay activa: eso
   era lo que mandaba el comprobante de la oferta al de inscripción. Si
   no se puede saber la zona, se pregunta. */
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
  let id = contaZonaCandidata_();
  if (!id) id = await contaPreguntarZona_();
  if (!id || !CFZ[id]) return;
  contaZonaActivar_(id);
  await contaZonaSubirVarios_(id, files, null);
}

/* ── Guardar: un solo botón para los cuatro bloques ── */
/* FASE 5.1 · B — escudo desde el primer toque: el botón queda ocupado
   y un segundo toque no dispara otro guardado (antes el escudo era el
   loader, que aparece a los 120 ms: un doble toque rápido mandaba dos
   escrituras con rid distinto). */
async function guardarContador_() {
  if (CONTA.guardando) return;
  CONTA.guardando = true;
  const btn = document.querySelector('#conta-save');
  if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  try { await guardarContadorUnaVez_(); }
  finally {
    CONTA.guardando = false;
    if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
  }
}
async function guardarContadorUnaVez_() {
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
    fechaInscripcion: val('c-fechaInscripcion'),
    comprobanteUrl: contaZonaUrl_('ins'),
    comprobanteOfertaUrl: contaZonaUrl_('ofe'),
    comprobanteTotalUrl: contaZonaUrl_('tot'),
    comprobantesExtra: contaZonaUrls_('ext'),
    /* FASE 5.1 · B — pago validado en banco, por comprobante. */
    bancoIns:    contaZonaBanco_('ins').length > 0,
    bancoOferta: contaZonaBanco_('ofe').length > 0,
    bancoTotal:  contaZonaBanco_('tot').length > 0,
    bancoExtra:  contaZonaBanco_('ext'),

    contratoOk: chk('c-contratoOk'),
    nombreDeudor: val('c-nombreDeudor'), cedulaDeudor: val('c-cedulaDeudor'),
    ofertaMax: val('c-ofertaMax'),
    /* AJUSTE 25/08/2026 — la fecha es el hecho; el check solo notifica. */
    fechaOferta: val('c-fechaOferta'), notificarOferta: chk('c-notifOferta'),
    metodoOferta: val('c-metodoOferta'), cuentaOferta: val('c-cuentaOferta'),
    ofertaUsd: val('c-ofertaUsd'), ofertaCop: val('c-ofertaCop'),

    totalMax: val('c-totalMax'), pagoTotal: chk('c-pagoTotal'),
    metodoTotal: val('c-metodoTotal'), cuentaTotal: val('c-cuentaTotal'),
    totalUsd: val('c-totalUsd'), totalCop: val('c-totalCop'),

    pagoSevis: chk('c-pagoSevis'), sevisCop: val('c-sevisCop'), recargo: val('c-recargo'),

    /* AJUSTE 1 (19/08/2026) — apaga los mensajes de ESTE guardado. */
    silencio: chk('c-silencio'),

    /* FASE 4 · ENTREGA 5 · 3.1 — el asesor elegido en el bloque
       Procesos. Solo existe si el participante todavía no tiene uno.
       Quien decide si es obligatorio es el backend, en el mismo
       guardado que sube el comprobante de inscripción. */
    asesorProcesosId: val('c-asesorProcesos')
  };

  if (procesoSel === 'Otro' && !body.proceso) {
    Swal.fire({ icon: 'warning', title: 'Falta el proceso', text: 'Escribe cuál es el proceso.' }); return;
  }

  try {
    const out = await apiPost('guardarContador', body);
    cerrarModalContador_();
    if (!contaParchar_(out)) await recargarContador_(true);          // FASE 5.1 — un viaje
    /* FASE 5.1 — Repitente automático: la cédula ya participó en otro año. */
    const avisoRep = out.repitenteAuto
      ? `<br><small>🔁 Esta cédula ya participó en otra temporada: el Proceso quedó en <b>${esc_(out.repitenteAuto)}</b>.</small>` : '';
    if (out.silencio) {
      /* AJUSTE 1 — se guardó todo, pero el estudiante no se enteró. */
      Swal.fire({ icon: 'success', title: 'Guardado en silencio',
        html: `Se guardó todo de <b>${esc_(out.nombres)} ${esc_(out.apellidos)}</b>, ` +
              `<b>sin enviar ningún mensaje</b>.` +
              (out.paseAInscrito ? '<br><small>Quedó en estado INSCRITO.</small>' : '') });
    } else if (out.avisoOferta) {
      /* AJUSTE 2 — pago de la oferta validado: se le abrió el formulario. */
      const a = out.avisoOferta;
      if (a.enviado) {
        const canal = a.canal === 'EMAIL' ? 'correo' : (a.canal === 'WHATSAPP' ? 'WhatsApp' : 'correo y WhatsApp');
        Swal.fire({ icon: 'success', title: 'Pago de la oferta validado',
          html: `Se le envió a <b>${esc_(out.nombres)} ${esc_(out.apellidos)}</b> por <b>${canal}</b> ` +
                `el acceso para llenar su <b>formulario</b>.` +
                (a.video ? '' : '<br><small>⚠️ El video guía del formulario está vacío en Configuración → Programas: ese renglón salió en blanco.</small>') });
      } else {
        Swal.fire({ icon: 'warning', title: 'Guardado, pero sin aviso',
          html: `El pago quedó guardado, pero el mensaje no salió.<br><small>${esc_(a.motivo || '')}</small>` });
      }
    } else if (out.paseAInscrito) {
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
    } else if (avisoRep) {
      Swal.fire({ icon: 'success', title: 'Guardado', html: avisoRep.replace('<br>', '') });
    } else {
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1200, showConfirmButton: false });
    }
  } catch (e) {
    /* 3.1 — la inscripción no se completa sin Asesor de Procesos. El
       backend lo dice con una marca reconocible para poder mandar al
       contador al campo exacto en vez de soltarle un error suelto. */
    const msg = String(e.message || e);
    if (msg.indexOf('FALTA_ASESOR_PROCESOS') >= 0) {
      Swal.fire({ icon: 'warning', title: 'Falta el Asesor de Procesos',
        html: 'Para completar la inscripción hay que asignarle un <b>Asesor de Procesos</b>.<br>' +
              '<small>Está en el primer bloque de la ficha, arriba del todo.</small>' })
        .then(() => {
          const sel = document.querySelector('#c-asesorProcesos');
          if (sel) { sel.closest('details')?.setAttribute('open', 'open'); sel.focus(); sel.scrollIntoView({ block: 'center' }); }
        });
      return;
    }
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: msg });
  }
}

/* ============================================================
   EVENTOS FIJOS
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#conta-search')?.addEventListener('input', e => {
    CONTA.filtroTexto = e.target.value; renderContaFiltros_(); renderContaCards_();
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
});
