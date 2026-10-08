/* =============================================================
 * SEP GROUP — ESTADÍSTICAS (Fase 5 · Subfase 5.4 · Entrega C)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula
 * la garantía de funcionamiento.
 * ------------------------------------------------------------
 * QUÉ ES (pliego 5.4.5 + respuesta 7 de Javier)
 *   Módulo principal visible para todos los roles. Lectura gerencial
 *   de la temporada: Reclutamiento, Pagos, Placement / Procesos, Visas
 *   y Especiales. Filtros: Programa, Año (selector único TEMP), Asesor,
 *   Sponsor y Mes de inscripción. Cada indicador con lista abre
 *   Seguimiento filtrado exactamente con esas personas.
 *   · COP y USD nunca se suman en una sola cifra.
 *   · Los valores ($) solo llegan del servidor a Contador, Superadmin y
 *     Desarrollador; los demás ven estados e hitos de pago sin valores.
 *   · Inscritos totales de la temporada ≠ Estado actual = Inscrito.
 *   · Los pagos cuentan desde el comprobante cargado (no esperan banco).
 *
 * RENDIMIENTO
 *   · NO tiene ruta propia: usa la MISMA carga de Seguimiento
 *     (seguimientoInit). Si Seguimiento ya cargó, pinta al instante sin
 *     viajar; si no, dispara esa misma carga (y Seguimiento la hereda).
 *   · Filtros y año son locales. Cálculo en una sola pasada.
 *   · Tiempos en window.__sepMed (estadisticasPintado).
 *
 * Usa de seguimiento.js: SEG, cargarSeguimiento_, segAbrirFiltrado_,
 * segHitos_, segTxt_, segNorm_, segMed_, SEG_SIN; de app.js: showView,
 * esc_; de temporada.js: TEMP.
 * ============================================================= */

const EST = { filtros: {}, ultimo: null };

const EST_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
                   'septiembre', 'octubre', 'noviembre', 'diciembre'];
function estMesTxt_(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || '');
  if (!m) return 'Sin fecha de inscripción';
  const t = EST_MESES[+m[2] - 1] || m[2];
  return t.charAt(0).toUpperCase() + t.slice(1) + ' ' + m[1];
}

/* Filtros (pliego 5.4.5). El Año es el selector TEMP de la cabecera. */
const EST_PILLS = [
  { k: 'prog', ic: '🎓', color: '#7c3aed', all: 'Programa', tit: 'Programa',
    v: r => segTxt_(r.prog) || SEG_SIN, lead: g => g.prog || SEG_SIN },
  { k: 'ase',  ic: '👤', color: '#2563eb', all: 'Asesor', tit: 'Asesor comercial',
    v: r => segTxt_(r.ase) || SEG_SIN, lead: g => g.ase || SEG_SIN },
  { k: 'spo',  ic: '🏢', color: '#0d9488', all: 'Sponsor', tit: 'Sponsor',
    v: r => segTxt_(r.spo) || SEG_SIN, lead: null },
  { k: 'mes',  ic: '📅', color: '#b45309', all: 'Mes de inscripción', tit: 'Mes de inscripción',
    v: r => estMesTxt_(segTxt_(r.fins).slice(0, 7)), lead: g => estMesTxt_(g.ym) }
];
function estPill_(k) { return EST_PILLS.find(p => p.k === k); }

/* ============================================================
   ENTRADA — misma carga que Seguimiento
   ============================================================ */
function abrirEstadisticas_() {
  showView('estadisticas');                       // navegación primero
  if (SEG.cargado) { estPintar_(); return; }
  if (!SEG.cargando) cargarSeguimiento_();        // al llegar llama estAlCargar_
}
function estVisible_() {
  const v = document.querySelector('#view-estadisticas');
  return !!(v && v.classList.contains('active'));
}
/* Lo llama cargarSeguimiento_ cuando llega la carga. */
function estAlCargar_() { if (estVisible_()) estPintar_(); }
function estAlError_(msg) {
  const c = document.querySelector('#est-cuerpo');
  if (c && estVisible_()) c.innerHTML = `<div class="seg-err">No se pudo cargar: ${esc_(msg)}
    <button class="btn btn-ghost btn-sm" data-est-reintentar>Reintentar</button></div>`;
}
if (typeof TEMP !== 'undefined') TEMP.alCambiar(() => { if (SEG.cargado && estVisible_()) estPintar_(); });

/* ============================================================
   UNIVERSO Y FILTROS (locales)
   ============================================================ */
function estBase_(salvo) {
  let l = SEG.registros;
  EST_PILLS.forEach(p => {
    if (p.k === salvo) return;
    const val = EST.filtros[p.k];
    if (val === undefined) return;
    l = l.filter(r => p.v(r) === val);
  });
  return l;
}
function estOpciones_(k) {
  const p = estPill_(k), c = {};
  estBase_(k).forEach(r => { const v = p.v(r); c[v] = (c[v] || 0) + 1; });
  const ks = Object.keys(c);
  if (k === 'mes') {
    const llave = v => { const i = EST_MESES.findIndex(m => v.toLowerCase().startsWith(m)); const a = (/\d{4}/.exec(v) || ['0000'])[0]; return i < 0 ? '0' : a + String(i + 10); };
    ks.sort((a, b) => llave(b).localeCompare(llave(a)));
  } else ks.sort((a, b) => a.localeCompare(b));
  return ks.map(v => ({ valor: v, count: c[v] }));
}

/* Leads de COMERCIAL (agregado sin datos personales) con los mismos
   filtros. El Sponsor no aplica a un lead: con ese filtro → null. */
function estLeads_() {
  const L = SEG.catalogo && SEG.catalogo.leads;
  if (!L || !Array.isArray(L.g)) return null;
  if (EST.filtros.spo !== undefined) return null;
  const anio = (typeof TEMP !== 'undefined' && !TEMP.esTodos()) ? TEMP.anio : null;
  let n = 0;
  L.g.forEach(x => {
    const g = { anio: L.dic.anio[x[0]] || '', prog: L.dic.prog[x[1]] || '', ase: L.dic.ase[x[2]] || '', ym: x[3] || '' };
    if (anio && g.anio && g.anio !== anio) return;
    for (const p of EST_PILLS) {
      const val = EST.filtros[p.k];
      if (val === undefined || !p.lead) continue;
      if (p.lead(g) !== val) return;
    }
    n += x[4];
  });
  return n;
}

/* ============================================================
   CÁLCULO — una sola pasada sobre el universo filtrado
   ============================================================ */
const EST_VISA_HITOS = ['DS160_INT', 'SISTEMA_VISA', 'CITA', 'DS2019', 'DS160_REAL', 'SEVIS', 'ASESORIA', 'CARPETA'];

function estCalcular_(U) {
  const hs = segHitos_();
  const ix = {}; hs.forEach((h, i) => { ix[h.k] = i; });
  const h = (r, k) => (ix[k] === undefined ? '0' : ((r.h || '').charAt(ix[k]) || '0'));
  const L = {};                                   // clave → [n]
  const add = (k, r) => { (L[k] = L[k] || []).push(r.n); };
  const fin = { recCop: 0, recUsd: 0, penUsd: 0, conPrecio: 0, sinPrecio: 0, ins: 0, ofCop: 0, ofUsd: 0, totCop: 0, totUsd: 0 };
  let hayFin = false;

  U.forEach(r => {
    const est = r.est || '', ret = !!r.ret || est === 'RETIRADO';
    const pg = String(r.pg || '');
    const insc = pg ? pg.charAt(0) === '1' : h(r, 'INSCRITO') === '1';
    const ofe  = pg ? pg.charAt(1) === '1' : h(r, 'PAGO_OFERTA') === '1';
    const tot  = pg ? pg.charAt(2) === '1' : h(r, 'PAGO_TOTAL') === '1';

    /* Reclutamiento */
    if (insc) add('inscritos', r);
    if (est === 'INSCRITO') add('estInscrito', r);

    /* Pagos (desde comprobante cargado) */
    if (insc) add('pInsc', r);
    if (ofe) add('pOferta', r);
    if (tot) add('pTotal', r);
    if (insc && !tot && !ret) add('conSaldo', r);

    /* Valores: texto "ins,ofCOP,ofUSD,totCOP,totUSD,precioUSD" (ceros vacíos). */
    const val = typeof r.$ === 'string' ? r.$.split(',') : (Array.isArray(r.$) ? r.$ : null);
    if (val) {
      hayFin = true;
      const v = i => Number(val[i]) || 0;
      fin.ins += v(0); fin.ofCop += v(1); fin.ofUsd += v(2); fin.totCop += v(3); fin.totUsd += v(4);
      if (!ret && insc) {
        if (v(5) > 0) { fin.conPrecio++; if (!tot || v(4) < v(5)) fin.penUsd += Math.max(0, v(5) - v(4)); }
        else if (!tot) fin.sinPrecio++;
      }
    } else if (!ret && insc && !tot) fin.sinPrecio++;

    /* Placement / Procesos (estado actual; hitos sin retirados) */
    if (est === 'FORMULARIO_COMPLETO') add('placePend', r);
    if (est === 'OFERTA_ELEGIDA') add('ofertaElegida', r);
    if (!ret && h(r, 'CONTRATADO') === '1') {
      add('contratados', r);
      add(h(r, 'DOCS_SPONSOR') === '1' ? 'spoOk' : 'spoPend', r);
      add(h(r, 'DS2019') === '1' ? 'ds2019Ok' : 'ds2019Pend', r);
    }

    /* Visas (estado actual) */
    if (est === 'CONTRATADO') add(EST_VISA_HITOS.some(k => h(r, k) === '1' || h(r, k) === 'p') ? 'visaProc' : 'visaPend', r);
    if (est === 'VISA_AGENDADA') add('visaAgendada', r);
    if (est === 'DOC_CONSULAR_LISTA') add('visaConsular', r);
    if (est === 'EMBAJADA') add('visaEmbajada', r);
    if (est === 'VISA_APROBADA') add('visaAprobada', r);
    if (est === 'VISA_NEGADA') add('visaNegada', r);
    if (est === 'PROCESO_ADMIN') add('visaAdmin', r);
    if (est === 'VERIF_REDES') add('visaRedes', r);

    /* Especiales */
    if (est === 'INACTIVO') add('inactivos', r);
    if (ret) add('retirados', r);
    const pro = segNorm_(r.pro);
    if (!ret && pro === 'repitente') add('repitentes', r);
    if (!ret && pro === 'aplazado') add('aplazados', r);
    if (est === 'PROGRAMA_COMPLETADO') add('completados', r);
    if (h(r, 'RIFA') === '1') add('rifa', r);
  });
  fin.recCop = fin.ins + fin.ofCop + fin.totCop;
  fin.recUsd = fin.ofUsd + fin.totUsd;
  return { L, fin: hayFin || (SEG.catalogo && SEG.catalogo.fin) ? fin : null, total: U.length };
}

/* ============================================================
   PINTADO
   ============================================================ */
const EST_SECC = [
  { k: 'rec', t: 'Reclutamiento', ic: '📣', color: '#2563eb', items: [
    { k: 'leads', l: 'Leads', d: 'Registros en Comercial' },
    { k: 'inscritos', l: 'Inscritos totales', d: 'De la temporada (con comprobante de inscripción)' },
    { k: 'conversion', l: 'Conversión Lead → Inscrito', d: 'Inscritos totales ÷ leads' },
    { k: 'estInscrito', l: 'Estado actual = Inscrito', d: 'Aún deben firmar contrato' }
  ] },
  { k: 'pag', t: 'Pagos', ic: '💳', color: '#16a34a', items: [
    { k: 'pInsc', l: 'Inscripción pagada', d: 'Comprobante cargado' },
    { k: 'pOferta', l: 'Oferta pagada', d: 'Comprobante cargado' },
    { k: 'pTotal', l: 'Programa completo', d: 'Pago total con comprobante' },
    { k: 'conSaldo', l: 'Participantes con saldo', d: 'Inscritos sin el pago total (sin retirados)' }
  ] },
  { k: 'pla', t: 'Placement / Procesos', ic: '💼', color: '#7c3aed', items: [
    { k: 'placePend', l: 'Placement pendiente', d: 'Formulario completo, sin oferta elegida' },
    { k: 'ofertaElegida', l: 'Oferta elegida / En proceso', d: 'Esperando la entrevista' },
    { k: 'contratados', l: 'Contratados', d: 'Entrevista aprobada (sin retirados)' },
    { k: 'spoPend', l: 'Docs Sponsor pendientes', d: 'De los contratados' },
    { k: 'spoOk', l: 'Docs Sponsor completos', d: 'De los contratados' },
    { k: 'ds2019Pend', l: 'DS-2019 pendientes', d: 'De los contratados' },
    { k: 'ds2019Ok', l: 'DS-2019 recibidos', d: 'Documento aprobado' }
  ] },
  { k: 'vis', t: 'Visas', ic: '🛂', color: '#d97706', items: [
    { k: 'visaPend', l: 'Pendientes', d: 'Contratados sin ningún paso de visa' },
    { k: 'visaProc', l: 'En proceso', d: 'Contratados con pasos de visa en curso' },
    { k: 'visaAgendada', l: 'Agendadas', d: 'Estado Visa agendada' },
    { k: 'visaConsular', l: 'Documentación consular lista', d: 'Estado actual' },
    { k: 'visaEmbajada', l: 'Embajada Americana', d: 'Estado actual' },
    { k: 'visaAprobada', l: 'Visa aprobada', d: 'Estado actual' },
    { k: 'visaNegada', l: 'Visa negada', d: 'Estado actual' },
    { k: 'visaAdmin', l: 'Proceso administrativo', d: 'Estado actual' },
    { k: 'visaRedes', l: 'Verificación de redes', d: 'Estado actual' }
  ] },
  { k: 'esp', t: 'Especiales', ic: '⭐', color: '#be123c', items: [
    { k: 'inactivos', l: 'Inactivos', d: 'Dejaron de responder' },
    { k: 'retirados', l: 'Retirados', d: 'Salieron del programa' },
    { k: 'repitentes', l: 'Repitentes', d: 'Proceso = Repitente' },
    { k: 'aplazados', l: 'Aplazados', d: 'Proceso = Aplazado' },
    { k: 'completados', l: 'Programas completados', d: 'Estado actual' },
    { k: 'rifa', l: 'Elegibles para rifa', d: 'Vuelo cargado ≤ 72 h' }
  ] }
];

function estNum_(n) { return Number(n || 0).toLocaleString('es-CO'); }
function estDinero_(n, mon) {
  const v = Math.round(Number(n) || 0);
  return (mon === 'USD' ? 'US$ ' : '$ ') + v.toLocaleString('es-CO');
}

function estPintar_() {
  const t0 = Date.now();
  if (typeof TEMP !== 'undefined') TEMP.montar('estadisticas');
  estPintarPills_();
  const cuerpo = document.querySelector('#est-cuerpo'); if (!cuerpo) return;
  const U = estBase_(null);
  const C = estCalcular_(U);
  EST.ultimo = C;
  const leads = estLeads_();
  const n = k => (C.L[k] || []).length;
  const cnt = document.querySelector('#est-count');
  if (cnt) cnt.textContent = U.length + ' de ' + SEG.registros.length + ' participantes · ' +
    (typeof TEMP !== 'undefined' ? TEMP.etiqueta() : '');

  const valor = it => {
    if (it.k === 'leads') return leads === null ? null : leads;
    if (it.k === 'conversion') {
      if (leads === null || !leads) return null;
      return Math.round(n('inscritos') * 1000 / leads) / 10;
    }
    return n(it.k);
  };
  const tile = (it, sec) => {
    const v = valor(it);
    const lista = !(it.k === 'leads' || it.k === 'conversion');
    const pct = lista && C.total ? Math.round(n(it.k) * 100 / C.total) : 0;
    let num, nota = '';
    if (v === null) {
      num = '—';
      nota = EST.filtros.spo !== undefined ? 'No aplica con filtro de Sponsor (un lead no tiene sponsor)'
        : (SEG.catalogo && SEG.catalogo.leads ? 'Sin leads' : 'Actualiza el servidor para ver los leads');
    } else num = it.k === 'conversion' ? String(v).replace('.', ',') + ' %' : estNum_(v);
    const cuerpoT = `<span class="est-k__n">${num}</span>
        <span class="est-k__l">${esc_(it.l)}</span>
        <span class="est-k__d">${esc_(nota || it.d)}</span>
        ${lista ? `<span class="est-k__bar" aria-hidden="true"><i style="width:${pct}%"></i></span>` : ''}`;
    return lista && n(it.k)
      ? `<button class="est-k est-k--btn" style="--c:${sec.color}" data-est-ver="${it.k}" title="Ver estas ${n(it.k)} personas en Seguimiento">${cuerpoT}<span class="est-k__ir" aria-hidden="true">Ver en Seguimiento ›</span></button>`
      : `<div class="est-k ${lista ? 'is-cero' : 'est-k--info'}" style="--c:${sec.color}">${cuerpoT}</div>`;
  };

  let html = '';
  EST_SECC.forEach(sec => {
    html += `<section class="est-sec" style="--c:${sec.color}">
      <h2 class="est-sec__t"><span aria-hidden="true">${sec.ic}</span> ${esc_(sec.t)}</h2>
      <div class="est-grid">${sec.items.map(it => tile(it, sec)).join('')}</div>
      ${sec.k === 'pag' ? estFinHtml_(C) : ''}
      ${sec.k === 'vis' || sec.k === 'pla' ? '<p class="est-nota">Muestra el estado actual de cada persona (regla no acumulativa): nadie cuenta en dos estados.</p>' : ''}
    </section>`;
  });
  cuerpo.innerHTML = html;
  segMed_('estadisticasPintado', t0);
}

/* Valores: solo si el servidor los mandó (roles financieros). */
function estFinHtml_(C) {
  if (!C.fin) {
    return `<div class="est-fin est-fin--oculto">🔒 Los valores en pesos y dólares solo los ven Contador, Superadmin y Desarrollador. Aquí ves los hitos de pago.</div>`;
  }
  const f = C.fin;
  return `<div class="est-fin">
    <div class="est-mon">
      <h3>🇨🇴 Pesos (COP)</h3>
      <div class="est-mon__f"><span>Total recaudado</span><b>${estDinero_(f.recCop, 'COP')}</b></div>
      <div class="est-mon__s"><span>Inscripción</span><span>${estDinero_(f.ins, 'COP')}</span></div>
      <div class="est-mon__s"><span>Pago de oferta</span><span>${estDinero_(f.ofCop, 'COP')}</span></div>
      <div class="est-mon__s"><span>Programa completo</span><span>${estDinero_(f.totCop, 'COP')}</span></div>
      <div class="est-mon__f est-mon__f--pen"><span>Total pendiente</span><b>No se calcula</b></div>
      <small>No hay precio del programa en pesos: el saldo en COP no tiene contra qué restarse.</small>
    </div>
    <div class="est-mon">
      <h3>🇺🇸 Dólares (USD)</h3>
      <div class="est-mon__f"><span>Total recaudado</span><b>${estDinero_(f.recUsd, 'USD')}</b></div>
      <div class="est-mon__s"><span>Pago de oferta</span><span>${estDinero_(f.ofUsd, 'USD')}</span></div>
      <div class="est-mon__s"><span>Programa completo</span><span>${estDinero_(f.totUsd, 'USD')}</span></div>
      <div class="est-mon__f est-mon__f--pen"><span>Total pendiente</span><b>${estDinero_(f.penUsd, 'USD')}</b></div>
      <small>Precio del programa − pago total, en ${estNum_(f.conPrecio)} inscritos con precio digitado${f.sinPrecio ? ` · ${estNum_(f.sinPrecio)} con saldo sin precio digitado no entran` : ''}.</small>
    </div>
    <p class="est-nota">Valores digitados por el Contador; se cuentan desde que el comprobante está cargado. COP y USD nunca se suman entre sí.</p>
  </div>`;
}

function estPintarPills_() {
  const cont = document.querySelector('#est-filters'); if (!cont) return;
  const activos = Object.keys(EST.filtros).length;
  cont.innerHTML = EST_PILLS.map(f => {
    const val = EST.filtros[f.k], on = val !== undefined;
    return `<button class="fpill ${on ? 'is-on' : ''}" data-estp="${f.k}" style="--fp:${f.color}" aria-haspopup="dialog" title="${esc_(f.tit)}">
      <span class="fpill__ic">${f.ic}</span><span class="fpill__label">${esc_(on ? val : f.all)}</span>
      <svg class="fpill__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>`;
  }).join('') + (activos ? `<button class="fpill seg-limpiar" data-est-limpiar>✕ Limpiar filtros (${activos})</button>` : '');
}

function estAbrirSheet_(k) {
  const f = estPill_(k); if (!f) return;
  const sheet = document.querySelector('#est-fsheet'), lista = document.querySelector('#est-fsheet-list');
  if (!sheet || !lista) return;
  document.querySelector('#est-fsheet-title').textContent = 'Filtrar por ' + f.tit;
  const actual = EST.filtros[k];
  const opt = (valor, label, n, sel, all) => `<button class="fopt ${sel ? 'is-sel' : ''} ${all ? 'is-all' : ''}" data-valor="${esc_(valor)}"${all ? ' data-all="1"' : ''}>
      <span class="fopt__ic">${f.ic}</span><span class="fopt__label">${esc_(label)}</span>
      <span class="fopt__count">${n}</span><span class="fopt__check">✓</span></button>`;
  lista.innerHTML = opt('', f.all, estBase_(k).length, actual === undefined, true) +
    estOpciones_(k).map(o => opt(o.valor, o.valor, o.count, actual === o.valor, false)).join('');
  lista.onclick = e => {
    const b = e.target.closest('.fopt'); if (!b) return;
    if (b.dataset.all) delete EST.filtros[k]; else EST.filtros[k] = b.dataset.valor;
    estCerrarSheet_(); estPintar_();
  };
  sheet.classList.remove('hidden'); sheet.setAttribute('aria-hidden', 'false');
}
function estCerrarSheet_() {
  const s = document.querySelector('#est-fsheet'); if (!s) return;
  s.classList.add('hidden'); s.setAttribute('aria-hidden', 'true');
}

/* Indicador → Seguimiento filtrado con exactamente esas personas. */
function estVer_(k) {
  const C = EST.ultimo; if (!C) return;
  const ids = C.L[k] || []; if (!ids.length) return;
  let it = null; EST_SECC.some(s => (it = s.items.find(x => x.k === k)));
  const extra = EST_PILLS.filter(p => EST.filtros[p.k] !== undefined).map(p => EST.filtros[p.k]);
  segAbrirFiltrado_({}, { l: (it ? it.l : k) + (extra.length ? ' · ' + extra.join(' · ') : ''), ids: ids });
}

document.addEventListener('click', e => {
  const p = e.target.closest('[data-estp]');
  if (p) { estAbrirSheet_(p.dataset.estp); return; }
  if (e.target.closest('[data-est-limpiar]')) { EST.filtros = {}; estPintar_(); return; }
  if (e.target.closest('[data-est-fsheet-close]')) { estCerrarSheet_(); return; }
  const v = e.target.closest('[data-est-ver]');
  if (v) { estVer_(v.dataset.estVer); return; }
  if (e.target.closest('[data-est-reintentar]') || e.target.closest('#est-refresh')) {
    if (typeof recargarSeguimiento_ === 'function') recargarSeguimiento_();
  }
});
