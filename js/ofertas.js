/* ============================================================
 * SEP GROUP — OFERTAS DE EMPLEO (Fase 4 · Entrega 1 · 03/09/2026)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula
 * la garantía de funcionamiento.
 * ------------------------------------------------------------
 * QUÉ ES
 *   Las dos pantallas nuevas que cuelgan de "Procesos":
 *     · OFERTAS DE EMPLEO   → lista, alta, edición y estados.
 *     · CONFIGURACIÓN       → lo que no vive dentro de cada oferta.
 *
 * CÓMO FUNCIONA, igual que Contador y Nivel de Inglés para que no
 * haya que aprender nada nuevo:
 *   · Resumen tocable arriba (los 5 estados) que filtra al tocarlo.
 *   · Pastillas de filtro (Estado · Sponsor · State) con hoja inferior.
 *   · Buscador por empleador, posición, ciudad o estado.
 *   · Tarjetas con la foto principal, el estado y los cupos.
 *   · Vista EN VIVO: escucha /meta/ofertas_rev en Firebase y, si no
 *     hay Firebase, sondea cada 12 s. Nunca repinta con un modal
 *     abierto: se reintenta al cerrarlo.
 *
 * EL FORMULARIO NO ESTÁ ESCRITO AQUÍ. Los 7 bloques y sus campos
 * llegan del backend (ofertasInit → catalogo.campos), que es la misma
 * definición con la que se creó la hoja y con la que se valida el
 * guardado. Si mañana entra un campo nuevo, se agrega en Ofertas.gs y
 * aparece solo en esta pantalla.
 *
 * IDIOMA: las etiquetas de los campos van en inglés (es lo que se
 * digita y lo que sale después en el PDF); los botones, los estados
 * y los avisos, en español.
 *
 * Usa de app.js: apiGet, apiPost, showView, esc_, currentUser,
 *   tengoRol_, driveImg_. De js/contador.js: la rueda de fechas
 *   (CPICK) — si ese archivo no cargó, se cae a un campo de fecha
 *   normal y la pantalla sigue funcionando.
 * ============================================================ */

const OFE = {
  catalogo: null,
  config: null,
  registros: [],
  cargado: false,
  /* Un valor por pastilla (1.30). '__ALL__' = sin filtrar. */
  filtros: {},
  filtroTexto: '',
  /* Oferta que se está creando o editando: { id, datos, cuposTotal } */
  edit: null,
  fsheetKey: null,
  /* Entrega 3 — lo que está abierto en el modal de participantes:
     { datos, ofertaId, buscando, resultados, sel } */
  part: null
};

/* Los nueve filtros internos del punto 1.30. Ocho son pastillas y el
   noveno es el buscador general que ya estaba arriba.
   `campo` dice de dónde sale el valor de cada registro: así una
   pastilla nueva no obliga a tocar tres funciones. */
const OFE_FILTROS = [
  { key: 'estado',    campo: 'estado',    allLabel: 'Todos los estados',  titulo: 'Filtrar por estado de la oferta', ic: '🏷️', color: '#263143' },
  { key: 'empleador', campo: 'empleador', allLabel: 'Todos los empleadores', titulo: 'Filtrar por empleador', ic: '🏢', color: '#0f766e' },
  { key: 'posicion',  campo: 'posicion',  allLabel: 'Todas las posiciones', titulo: 'Filtrar por posición', ic: '💼', color: '#b45309' },
  { key: 'sponsor',   campo: 'sponsor',   allLabel: 'Todos los sponsors', titulo: 'Filtrar por sponsor', ic: '🤝', color: '#7c3aed' },
  { key: 'ciudad',    campo: 'ciudad',    allLabel: 'Todas las ciudades', titulo: 'Filtrar por ciudad', ic: '🏙️', color: '#be185d' },
  { key: 'estadoUsa', campo: 'estadoUsa', allLabel: 'Todos los estados de EE. UU.', titulo: 'Filtrar por State', ic: '📍', color: '#0891b2' },
  { key: 'cupos',     campo: '_cupos',    allLabel: 'Con y sin cupos', titulo: 'Filtrar por cupos', ic: '🎟️', color: '#16a34a' },
  { key: 'cierre',    campo: '_cierre',   allLabel: 'Cualquier fecha de cierre', titulo: 'Filtrar por fecha de cierre', ic: '⏰', color: '#64748b' }
];

/* Los dos filtros calculados. Se agrupan en tramos porque una pastilla
   con 40 fechas distintas no sirve para nada. */
function ofeBucketCupos_(r) {
  return (r.cupos && r.cupos.libres > 0) ? 'Con cupos' : 'Sin cupos';
}
function ofeBucketCierre_(r) {
  if (!r.fechaCierre) return 'Sin fecha de cierre';
  const f = new Date(r.fechaCierre + 'T00:00:00');
  if (isNaN(f.getTime())) return 'Sin fecha de cierre';
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((f - hoy) / 86400000);
  if (dias < 0)   return 'Ya vencida';
  if (dias <= 7)  return 'Cierra en 7 días';
  if (dias <= 30) return 'Cierra este mes';
  return 'Cierra después';
}

/* Cabecera del modal según lo que se esté haciendo. */
const OFE_SIN_DATO = '—';

/* ============================================================
   PERMISOS Y ARRANQUE
   ============================================================ */
function ofePuedeEntrar_() {
  return typeof tengoRol_ === 'function' &&
         tengoRol_('DESARROLLADOR', 'SUPERUSUARIO', 'PROCESOS');
}
function ofeEsAdmin_() {
  return typeof tengoRol_ === 'function' && tengoRol_('DESARROLLADOR', 'SUPERUSUARIO');
}

async function abrirOfertas_() {
  if (!ofePuedeEntrar_()) {
    Swal.fire({ icon: 'warning', title: 'Sin permiso', text: 'Solo PROCESOS, SUPERUSUARIO o DESARROLLADOR entran a Ofertas de Empleo.' });
    return;
  }
  showView('ofertas');
  if (!OFE.cargado) await cargarOfertas_();
  else { renderOfeFiltros_(); renderOfeCards_(); renderOfeResumen_(); recargarOfertas_(true); }
}

async function cargarOfertas_() {
  try {
    const d = await apiGet('ofertasInit', { usuarioId: currentUser.id });
    OFE.catalogo  = d.catalogo;
    OFE.config    = d.config;
    OFE.registros = d.registros || [];
    OFE.cargado   = true;
    renderOfeFiltros_(); renderOfeCards_(); renderOfeResumen_();
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: String(e.message || e) });
  }
}

async function recargarOfertas_(silencioso) {
  try {
    OFE.registros = await apiGet('listOfertas', { usuarioId: currentUser.id }, { silent: !!silencioso });
    renderOfeFiltros_(); renderOfeCards_(); renderOfeResumen_();
  } catch (e) {
    if (!silencioso) Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: String(e.message || e) });
  }
}

/* ============================================================
   RESUMEN POR ESTADO (tocable)
   ============================================================ */
function ofeConteoPorEstado_() {
  const out = {};
  (OFE.catalogo?.estados || []).forEach(e => { out[e.clave] = 0; });
  OFE.registros.forEach(r => {
    if (out[r.estado] === undefined) out[r.estado] = 0;
    out[r.estado]++;
  });
  return out;
}

function renderOfeResumen_() {
  const cont = document.querySelector('#ofe-resumen');
  if (!cont) return;
  const conteo = ofeConteoPorEstado_();
  const estados = OFE.catalogo?.estados || [];
  cont.innerHTML = estados.map(e => `<button class="conta-kpi" data-ofe-estado="${e.clave}" style="--k:${e.color}" title="${esc_(e.desc)}">
      <span class="conta-kpi__n">${conteo[e.clave] || 0}</span>
      <span class="conta-kpi__t">${e.ic} ${esc_(e.label)}</span></button>`).join('');
  cont.querySelectorAll('[data-ofe-estado]').forEach(b => {
    b.addEventListener('click', () => {
      const v = b.getAttribute('data-ofe-estado');
      ofeSetFiltro_('estado', ofeValFiltro_('estado') === v ? '__ALL__' : v);
      renderOfeFiltros_(); renderOfeCards_(); renderOfeResumen_();
    });
  });
}

/* ============================================================
   FILTROS
   ============================================================ */
function ofeValFiltro_(k) {
  const v = OFE.filtros[k];
  return v === undefined ? '__ALL__' : v;
}
function ofeSetFiltro_(k, v) { OFE.filtros[k] = v; }
function ofeCampoFiltro_(r, k) {
  const f = OFE_FILTROS.find(x => x.key === k);
  if (!f) return OFE_SIN_DATO;
  if (f.campo === '_cupos')  return ofeBucketCupos_(r);
  if (f.campo === '_cierre') return ofeBucketCierre_(r);
  const v = r[f.campo];
  return (v === '' || v === null || v === undefined) ? OFE_SIN_DATO : String(v);
}
function ofeEtiquetaFiltro_(k, valor) {
  if (k !== 'estado') return valor;
  const e = (OFE.catalogo?.estados || []).find(x => x.clave === valor);
  return e ? e.label : valor;
}

/* Opciones de una pastilla: lo que quedaría si SOLO se aplicaran las
   otras pastillas (cascada, igual que en el Contador). */
function ofeOpcionesFiltro_(k) {
  const base = OFE.registros.filter(r => OFE_FILTROS.every(f => {
    if (f.key === k) return true;
    const v = ofeValFiltro_(f.key);
    return v === '__ALL__' || ofeCampoFiltro_(r, f.key) === v;
  }));
  const mapa = {};
  base.forEach(r => {
    const v = ofeCampoFiltro_(r, k);
    mapa[v] = (mapa[v] || 0) + 1;
  });
  return Object.keys(mapa).sort().map(v => ({ valor: v, label: ofeEtiquetaFiltro_(k, v), n: mapa[v] }));
}

function ofeConteoPill_(k) {
  const v = ofeValFiltro_(k);
  if (v === '__ALL__') return OFE.registros.length;
  return OFE.registros.filter(r => ofeCampoFiltro_(r, k) === v).length;
}

function ofePillHtml_(f) {
  const val = ofeValFiltro_(f.key);
  const on = val !== '__ALL__';
  let label = f.allLabel, color = f.color, ic = `<span class="fpill__ic">${f.ic}</span>`;
  if (on) {
    label = ofeEtiquetaFiltro_(f.key, val);
    if (f.key === 'estado') {
      const e = (OFE.catalogo?.estados || []).find(x => x.clave === val);
      if (e) { color = e.color; ic = `<span class="fpill__ic">${e.ic}</span>`; }
    }
  }
  return `<button class="fpill ${on ? 'is-on' : ''}" id="ofp-${f.key}" style="--fp:${color}"
      title="${esc_(on ? label : f.allLabel)}" aria-haspopup="dialog">
    ${ic}<span class="fpill__label">${esc_(label)}</span>
    <span class="fpill__count">${ofeConteoPill_(f.key)}</span>
    <svg class="fpill__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
  </button>`;
}

function renderOfeFiltros_() {
  const cont = document.querySelector('#ofe-filters');
  if (!cont) return;
  cont.innerHTML = OFE_FILTROS.map(ofePillHtml_).join('');
  OFE_FILTROS.forEach(f =>
    document.querySelector('#ofp-' + f.key)?.addEventListener('click', () => abrirFsheetOfe_(f.key)));
}

function ofeOptHtml_(o, sel, esAll) {
  const ic = o.color ? `<span class="fopt__dot" style="background:${o.color}"></span>`
                     : `<span class="fopt__ic">${o.ic || '\u2022'}</span>`;
  return `<button class="fopt ${sel ? 'is-sel' : ''} ${esAll ? 'is-all' : ''}" data-valor="${esc_(o.valor)}">
    ${ic}<span class="fopt__label">${esc_(o.label)}</span>
    <span class="fopt__count">${o.n}</span><span class="fopt__check">\u2713</span></button>`;
}

function abrirFsheetOfe_(key) {
  const f = OFE_FILTROS.find(x => x.key === key);
  if (!f) return;
  const hoja = document.querySelector('#ofe-fsheet');
  const lista = document.querySelector('#ofe-fsheet-list');
  if (!hoja || !lista) return;
  OFE.fsheetKey = key;
  document.querySelector('#ofe-fsheet-title').textContent = f.titulo;

  const actual = ofeValFiltro_(key);
  let html = ofeOptHtml_({ valor: '__ALL__', label: f.allLabel, n: OFE.registros.length, ic: f.ic }, actual === '__ALL__', true);
  ofeOpcionesFiltro_(key).forEach(o => {
    const est = key === 'estado' ? (OFE.catalogo?.estados || []).find(x => x.clave === o.valor) : null;
    html += ofeOptHtml_({ valor: o.valor, label: o.label, n: o.n, ic: est ? est.ic : f.ic, color: est ? est.color : '' },
                        actual === o.valor, false);
  });
  lista.innerHTML = html; lista.scrollTop = 0;

  lista.querySelectorAll('.fopt').forEach(b => b.addEventListener('click', () => {
    ofeSetFiltro_(key, b.dataset.valor);
    cerrarFsheetOfe_(); renderOfeFiltros_(); renderOfeCards_(); renderOfeResumen_();
  }));
  hoja.classList.remove('hidden');
  hoja.setAttribute('aria-hidden', 'false');
}

function cerrarFsheetOfe_() {
  const hoja = document.querySelector('#ofe-fsheet');
  if (!hoja) return;
  hoja.classList.add('hidden');
  hoja.setAttribute('aria-hidden', 'true');
}

/* ============================================================
   TARJETAS
   ============================================================ */
function ofeNormalizar_(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function ofeFiltradas_() {
  const q = ofeNormalizar_(OFE.filtroTexto).trim();
  return OFE.registros.filter(r => {
    for (const f of OFE_FILTROS) {
      const v = ofeValFiltro_(f.key);
      if (v !== '__ALL__' && ofeCampoFiltro_(r, f.key) !== v) return false;
    }
    if (!q) return true;
    const heno = ofeNormalizar_([r.empleador, r.posicion, r.ciudad, r.estadoUsa, r.sponsor, r.id].join(' '));
    return heno.indexOf(q) >= 0;
  });
}

function ofeCuposHtml_(c) {
  const pct = c.total > 0 ? Math.round((c.ocupados / c.total) * 100) : 0;
  /* La etiqueta (Disponible · Pocos cupos · Sin cupos) ya va en la
     pastilla del estado: aquí solo los números del 1.14. */
  return `<div class="ofe-cupos">
    <div class="ofe-cupos__bar"><i style="width:${pct}%;background:${c.color};"></i></div>
    <div class="ofe-cupos__txt">
      <b style="color:${c.color};">${c.libres} disponible(s)</b>
      <span>${c.ocupados} consumidos de ${c.total}</span>
    </div>
  </div>`;
}

function ofeCardHtml_(o) {
  const foto = o.foto1 ? (typeof driveImg_ === 'function' ? driveImg_(o.foto1) : o.foto1) : '';
  return `<article class="com-card ofe-card" data-ofe-id="${esc_(o.id)}">
    <div class="ofe-card__foto">
      ${foto ? `<img src="${esc_(foto)}" alt="${esc_(o.empleador)}" loading="lazy" />`
             : '<div class="ofe-card__sinfoto">📷</div>'}
      <span class="ofe-badge" style="background:${o.estadoColor};">${o.estadoIc} ${esc_(o.estadoLabel)}</span>
    </div>
    <div class="ofe-card__body">
      <div class="ofe-card__emp">${esc_(o.empleador || '(sin empleador)')}</div>
      <h3 class="ofe-card__pos">${esc_(o.titulo)}</h3>
      <div class="ofe-card__lugar">📍 ${esc_(o.lugar || OFE_SIN_DATO)}</div>
      <div class="ofe-card__datos">
        <span><b>USD $${esc_(o.pagoHora || '0')}</b>/hour</span>
        <span>${esc_(o.horasSemana || OFE_SIN_DATO)} hours/week</span>
        <span>🗣️ ${esc_(o.nivelIngles || OFE_SIN_DATO)}</span>
        <span>🤝 ${esc_(o.sponsor || OFE_SIN_DATO)}</span>
      </div>
      ${o.fechaCierre ? `<div class="ofe-card__cierre">⏰ Cierra el ${esc_(ofeFechaTexto_(o.fechaCierre))}${o.vencida ? ' · vencida' : ''}</div>` : ''}
      ${ofeCuposHtml_(o.cupos)}
      <div class="ofe-card__acciones">
        <button class="btn btn-ghost" data-ofe-editar="${esc_(o.id)}">✏️ Editar</button>
        <button class="btn btn-ghost" data-ofe-estado="${esc_(o.id)}">🔁 Estado</button>
        <button class="btn btn-ghost" data-ofe-part="${esc_(o.id)}">👥 Participantes</button>
        ${OFE.catalogo?.permisos?.eliminar
          ? `<button class="btn btn-ghost ofe-del" data-ofe-borrar="${esc_(o.id)}">🗑️</button>` : ''}
      </div>
    </div>
  </article>`;
}

function renderOfeCards_() {
  const cont = document.querySelector('#ofe-cards');
  const vacio = document.querySelector('#ofe-empty');
  if (!cont) return;
  const lista = ofeFiltradas_();
  cont.innerHTML = lista.map(ofeCardHtml_).join('');
  if (vacio) vacio.classList.toggle('hidden', lista.length > 0);

  cont.querySelectorAll('[data-ofe-editar]').forEach(b =>
    b.addEventListener('click', () => abrirModalOferta_(b.getAttribute('data-ofe-editar'))));
  cont.querySelectorAll('[data-ofe-estado]').forEach(b =>
    b.addEventListener('click', () => abrirModalEstadoOferta_(b.getAttribute('data-ofe-estado'))));
  cont.querySelectorAll('[data-ofe-borrar]').forEach(b =>
    b.addEventListener('click', () => eliminarOferta_(b.getAttribute('data-ofe-borrar'))));
  cont.querySelectorAll('[data-ofe-part]').forEach(b =>
    b.addEventListener('click', () => abrirParticipantes_(b.getAttribute('data-ofe-part'))));
}

/* ============================================================
   MODAL DEL FORMULARIO — los 7 bloques
   ============================================================
   El HTML sale de la definición que manda el backend. Aquí no hay
   ni un campo escrito a mano: eso es lo que impide que la pantalla
   y la hoja se separen.
   ============================================================ */
function ofeCampoValor_(id) {
  return (OFE.edit && OFE.edit.datos && OFE.edit.datos[id] != null) ? String(OFE.edit.datos[id]) : '';
}

function ofeOpcionesDe_(c) {
  if (c.opciones && c.opciones.length) return c.opciones;
  if (c.lista) return (OFE.catalogo?.listas || {})[c.lista] || [];
  return [];
}

function ofeCampoHtml_(c) {
  const v = ofeCampoValor_(c.id);
  const req = c.req ? '<span class="ofe-req" title="Obligatorio">*</span>' : '';
  let ayuda = c.hint || '';
  /* 1.14 — la pantalla diferencia totales, consumidos y disponibles;
     los dos últimos no se digitan nunca. */
  if (c.id === 'cuposTotal' && OFE.edit && OFE.edit.id) {
    const oc = OFE.edit.ocupados || 0;
    const tot = parseInt(v, 10) || 0;
    ayuda += ` · Consumidos hoy: <b>${oc}</b> · Disponibles: <b>${Math.max(tot - oc, 0)}</b>`;
  }
  const hint = ayuda ? `<div class="ofe-hint">${ayuda}</div>` : '';
  let control = '';

  if (c.tipo === 'imagen') {
    const src = v ? (typeof driveImg_ === 'function' ? driveImg_(v) : v) : '';
    control = `<div class="ofe-img" data-ofe-img="${c.id}">
      ${src ? `<img src="${esc_(src)}" alt="${esc_(c.label)}" />`
            : '<div class="ofe-img__vacio">Sin imagen</div>'}
      <div class="ofe-img__btns">
        <button type="button" class="btn btn-ghost" data-ofe-subir="${c.id}">⬆ Subir</button>
        ${v ? `<button type="button" class="btn btn-ghost" data-ofe-quitar="${c.id}">Quitar</button>` : ''}
      </div>
      <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" id="ofe-file-${c.id}" />
    </div>`;
  } else if (c.tipo === 'textarea') {
    control = `<textarea id="ofe-f-${c.id}" rows="3" class="ofe-input">${esc_(v)}</textarea>`;
  } else if (c.tipo === 'select') {
    const ops = ofeOpcionesDe_(c);
    control = `<select id="ofe-f-${c.id}" class="ofe-input">
      <option value="">— Seleccionar —</option>
      ${ops.map(o => `<option value="${esc_(o)}"${o === v ? ' selected' : ''}>${esc_(o)}</option>`).join('')}
    </select>`;
  } else if (c.tipo === 'fecha') {
    control = `<button type="button" class="ofe-input ofe-fecha" id="ofe-f-${c.id}"
                 data-ofe-fecha="${c.id}" data-iso="${esc_(v)}">${esc_(ofeFechaTexto_(v))}</button>`;
  } else if (c.tipo === 'numero' || c.tipo === 'decimal') {
    control = `<input id="ofe-f-${c.id}" class="ofe-input" type="text" inputmode="decimal" value="${esc_(v)}" />`;
  } else if (c.tipo === 'url') {
    control = `<input id="ofe-f-${c.id}" class="ofe-input" type="url" placeholder="https://…" value="${esc_(v)}" />`;
  } else {
    const ops = ofeOpcionesDe_(c);
    const dl = ops.length ? `list="ofe-dl-${c.id}"` : '';
    control = `<input id="ofe-f-${c.id}" class="ofe-input" type="text" ${dl} value="${esc_(v)}" />` +
      (ops.length ? `<datalist id="ofe-dl-${c.id}">${ops.map(o => `<option value="${esc_(o)}"></option>`).join('')}</datalist>` : '');
  }

  return `<div class="ofe-campo" data-campo="${c.id}">
    <label for="ofe-f-${c.id}">${esc_(c.label)}${req}</label>
    ${control}${hint}
  </div>`;
}

function ofeFechaTexto_(iso) {
  if (!iso) return 'Seleccionar fecha';
  const p = String(iso).split('-');
  if (p.length !== 3) return String(iso);
  return p[2] + '/' + p[1] + '/' + p[0];
}

function ofeFormHtml_() {
  const bloques = OFE.catalogo?.bloques || [];
  const campos = OFE.catalogo?.campos || [];
  return bloques.map((b, i) => {
    const suyos = campos.filter(c => c.bloque === b.clave);
    return `<div class="ofe-bloque" data-bloque="${b.clave}">
      <button type="button" class="ofe-bloque__cab" data-ofe-acc="${b.clave}">
        <span>${b.ic}</span><b>${b.n}. ${esc_(b.titulo)}</b>
        <span class="ofe-bloque__flecha">${i === 0 ? '▾' : '▸'}</span>
      </button>
      <div class="ofe-bloque__body${i === 0 ? '' : ' hidden'}">
        ${suyos.map(ofeCampoHtml_).join('')}
      </div>
    </div>`;
  }).join('');
}

async function abrirModalOferta_(id) {
  if (!OFE.catalogo) { await cargarOfertas_(); if (!OFE.catalogo) return; }
  try {
    if (id) {
      const o = await apiGet('verOferta', { usuarioId: currentUser.id, id });
      OFE.edit = { id: o.id, datos: o, cuposTotal: o.cupos.total, ocupados: o.cupos.ocupados };
      OFE.edit.datos.cuposTotal = String(o.cupos.total || '');
      document.querySelector('#ofe-modal-title').textContent = 'Editar oferta';
      document.querySelector('#ofe-modal-sub').textContent =
        o.id + ' · ' + o.estadoLabel + (o.empleador ? ' · ' + o.empleador : '');
    } else {
      OFE.edit = { id: '', datos: {}, cuposTotal: 1, ocupados: 0 };
      document.querySelector('#ofe-modal-title').textContent = 'Nueva oferta';
      document.querySelector('#ofe-modal-sub').textContent =
        'Nace Desactivada: no la ve ningún participante hasta que la actives.';
    }
    document.querySelector('#ofe-modal-body').innerHTML = ofeFormHtml_();
    ofeEngancharForm_();
    document.querySelector('#modal-oferta').classList.remove('hidden');
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo abrir', text: String(e.message || e) });
  }
}

function cerrarModalOferta_() {
  document.querySelector('#modal-oferta')?.classList.add('hidden');
  OFE.edit = null;
}
function ofeModalAbierto_() {
  return !!document.querySelector('#modal-oferta:not(.hidden)') ||
         !!document.querySelector('#modal-oferta-estado:not(.hidden)');
}

function ofeEngancharForm_() {
  const cuerpo = document.querySelector('#ofe-modal-body');
  if (!cuerpo) return;

  cuerpo.querySelectorAll('[data-ofe-acc]').forEach(b => {
    b.addEventListener('click', () => {
      const body = b.parentElement.querySelector('.ofe-bloque__body');
      const flecha = b.querySelector('.ofe-bloque__flecha');
      const abierto = !body.classList.contains('hidden');
      body.classList.toggle('hidden', abierto);
      if (flecha) flecha.textContent = abierto ? '▸' : '▾';
    });
  });

  cuerpo.querySelectorAll('[data-ofe-subir]').forEach(b => {
    const id = b.getAttribute('data-ofe-subir');
    b.addEventListener('click', () => document.querySelector('#ofe-file-' + id)?.click());
  });
  cuerpo.querySelectorAll('input[type=file]').forEach(inp => {
    inp.addEventListener('change', e => subirFotoOferta_(e.target));
  });
  cuerpo.querySelectorAll('[data-ofe-quitar]').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-ofe-quitar');
      ofeGuardarEnMemoria_();
      OFE.edit.datos[id] = '';
      document.querySelector('#ofe-modal-body').innerHTML = ofeFormHtml_();
      ofeEngancharForm_();
    });
  });

  cuerpo.querySelectorAll('[data-ofe-fecha]').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-ofe-fecha');
      abrirRuedaOferta_(b.getAttribute('data-iso'), (iso) => {
        b.setAttribute('data-iso', iso);
        b.textContent = ofeFechaTexto_(iso);
      });
    });
  });
}

/* Rueda de fechas: la misma del Contador, pero con años del actual en
   adelante (las ofertas son del verano que viene). Si contador.js no
   está cargado, se cae a un input de fecha del navegador. */
const OFE_ANIOS_ADELANTE = 2;

function abrirRuedaOferta_(valorISO, onOk) {
  if (typeof CPICK === 'undefined' || typeof cpickBuild_ !== 'function' ||
      !document.querySelector('#conta-picker')) {
    const v = window.prompt('Fecha (aaaa-mm-dd)', valorISO || '');
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) onOk(v.trim());
    return;
  }
  CPICK.onOk = onOk;
  const hoy = new Date();
  const base = hoy.getFullYear();
  CPICK.anios = [];
  for (let a = base; a <= base + OFE_ANIOS_ADELANTE; a++) CPICK.anios.push(a);

  let d = valorISO ? new Date(valorISO + 'T12:00:00') : null;
  if (!d || isNaN(d.getTime())) d = hoy;
  let anioPos = CPICK.anios.indexOf(d.getFullYear());
  if (anioPos < 0) { anioPos = 0; d = hoy; }

  if (typeof cpickTitulo_ === 'function') cpickTitulo_('Fecha');
  document.querySelector('#conta-picker').classList.remove('hidden');
  const total = cpickDiasMes_(d.getMonth(), CPICK.anios[anioPos]);
  CPICK.dias = []; for (let i = 1; i <= total; i++) CPICK.dias.push(i);
  cpickBuild_(document.querySelector('#cpick-dia'), CPICK.dias.map(String), d.getDate() - 1);
  cpickBuild_(document.querySelector('#cpick-mes'),
    CPICK_MESES.map(m => m.charAt(0).toUpperCase() + m.slice(1)), d.getMonth(), cpickRebuildDias_);
  cpickBuild_(document.querySelector('#cpick-anio'), CPICK.anios.map(String), anioPos, cpickRebuildDias_);
}

/* Lee la pantalla y la vuelca en OFE.edit.datos. Se llama antes de
   repintar el formulario (subir foto, quitar foto) para no perder lo
   que ya estaba escrito, y al guardar. */
function ofeGuardarEnMemoria_() {
  if (!OFE.edit) return {};
  const campos = OFE.catalogo?.campos || [];
  campos.forEach(c => {
    if (c.tipo === 'imagen') return;   // vive en memoria, no en un input
    const el = document.querySelector('#ofe-f-' + c.id);
    if (!el) return;
    OFE.edit.datos[c.id] = (c.tipo === 'fecha')
      ? (el.getAttribute('data-iso') || '')
      : String(el.value || '').trim();
  });
  OFE.edit.cuposTotal = parseInt(String(OFE.edit.datos.cuposTotal || '').replace(/\D/g, ''), 10) || 0;
  return OFE.edit.datos;
}

/* Misma validación que el backend, con la misma definición. Lo que
   pasa aquí pasa allá; esto solo evita el viaje. */
function ofeValidarFront_(datos) {
  const errores = [];
  const campos = OFE.catalogo?.campos || [];
  const d = datos || {};
  campos.forEach(c => {
    const v = String(d[c.id] || '').trim();
    if (c.req && !v) { errores.push({ id: c.id, label: c.label, motivo: 'Obligatorio' }); return; }
    if (!v) return;
    if ((c.tipo === 'numero' || c.tipo === 'decimal') && !/^\d+([.,]\d+)?$/.test(v)) {
      errores.push({ id: c.id, label: c.label, motivo: 'Debe ser un número' });
    }
    if (c.tipo === 'url' && !/^https?:\/\//i.test(v)) {
      errores.push({ id: c.id, label: c.label, motivo: 'Debe empezar por http:// o https://' });
    }
  });
  /* 1.9 — con cierre, la fecha es obligatoria. */
  if (String(d.tieneCierre || '').toUpperCase() === 'YES' && !String(d.fechaCierre || '').trim()) {
    errores.push({ id: 'fechaCierre', label: 'Closing date', motivo: 'Obligatoria cuando la oferta tiene cierre' });
  }
  /* 1.4 — capacidad mínima 1. */
  if (String(d.cuposTotal || '').trim() && !(parseInt(d.cuposTotal, 10) > 0)) {
    errores.push({ id: 'cuposTotal', label: 'Total slots', motivo: 'Debe ser 1 o más' });
  }
  const f = k => (d[k]) ? new Date(d[k] + 'T12:00:00') : null;
  const iMin = f('inicioMin'), iMax = f('inicioMax'), sMin = f('salidaMin'), sMax = f('salidaMax');
  if (iMin && iMax && iMin > iMax) errores.push({ id: 'inicioMax', label: 'Latest start date', motivo: 'Anterior a la más temprana' });
  if (sMin && sMax && sMin > sMax) errores.push({ id: 'salidaMax', label: 'Latest end date', motivo: 'Anterior a la más temprana' });
  if (iMin && sMax && iMin > sMax) errores.push({ id: 'salidaMax', label: 'Latest end date', motivo: 'Anterior al inicio' });
  return errores;
}

async function subirFotoOferta_(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const campo = input.id.replace('ofe-file-', '');
  if (file.size > 6 * 1024 * 1024) {
    Swal.fire({ icon: 'warning', title: 'Imagen muy pesada', text: 'Máximo 6 MB por foto.' });
    input.value = ''; return;
  }
  try {
    const base64 = await ofeLeerBase64_(file);
    const r = await apiPost('subirFotoOferta', {
      usuarioId: currentUser.id, id: OFE.edit?.id || '', campo,
      filename: file.name, base64
    });
    ofeGuardarEnMemoria_();
    OFE.edit.datos[campo] = r.url;
    document.querySelector('#ofe-modal-body').innerHTML = ofeFormHtml_();
    ofeEngancharForm_();
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo subir', text: String(e.message || e) });
  } finally { input.value = ''; }
}

function ofeLeerBase64_(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

async function guardarOferta_() {
  if (!OFE.edit) return;
  const datos = ofeGuardarEnMemoria_();
  const errores = ofeValidarFront_(datos);
  if (errores.length) {
    Swal.fire({
      icon: 'warning', title: 'Faltan datos',
      html: '<div style="text-align:left">' +
        errores.slice(0, 10).map(e => `• <b>${esc_(e.label)}</b>: ${esc_(e.motivo)}`).join('<br>') +
        (errores.length > 10 ? `<br>… y ${errores.length - 10} más` : '') + '</div>'
    });
    return;
  }
  try {
    await apiPost('guardarOferta', { usuarioId: currentUser.id, id: OFE.edit.id || '', datos });
    cerrarModalOferta_();
    await recargarOfertas_(false);
    Swal.fire({ icon: 'success', title: 'Guardado', timer: 1100, showConfirmButton: false });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: String(e.message || e) });
  }
}

/* ============================================================
   MODAL DE ESTADO
   ============================================================ */
function ofeAcciones_(situacion) {
  const sit = String(situacion || 'DESACTIVADA').toUpperCase();
  return (OFE.catalogo?.acciones || []).filter(a => a.situacion !== sit);
}

function abrirModalEstadoOferta_(id) {
  const o = OFE.registros.find(x => x.id === id);
  if (!o) return;
  const acciones = ofeAcciones_(o.situacion);
  const cuerpo = document.querySelector('#ofe-estado-body');
  document.querySelector('#ofe-estado-title').textContent = 'Estado de la oferta';
  document.querySelector('#ofe-estado-sub').textContent =
    o.id + ' · ' + (o.empleador || '') + ' · hoy está ' + o.estadoLabel;
  cuerpo.innerHTML =
    `<p class="muted" style="margin:0 0 10px;">
       ${o.estadoIc} <b>${esc_(o.estadoLabel)}</b> — ${esc_(ofeEstadoDesc_(o.estado))}
       ${o.vencida ? '<br>⏰ Su fecha de cierre ya pasó.' : ''}
     </p>` +
    acciones.map(a => `<button class="ofe-estado-op" data-ofe-accion="${a.clave}" style="--c:${a.color};">
         <span class="ofe-estado-op__ic">${a.ic}</span>
         <span><b>${esc_(a.label)}</b><i>${esc_(a.desc)}</i></span>
       </button>`).join('');
  cuerpo.querySelectorAll('[data-ofe-accion]').forEach(b => {
    b.addEventListener('click', () => cambiarEstadoOferta_(o.id, b.getAttribute('data-ofe-accion')));
  });
  document.querySelector('#modal-oferta-estado').classList.remove('hidden');
}

function ofeEstadoDesc_(clave) {
  const e = (OFE.catalogo?.estados || []).find(x => x.clave === clave);
  return e ? e.desc : '';
}

function cerrarModalEstadoOferta_() {
  document.querySelector('#modal-oferta-estado')?.classList.add('hidden');
}

async function cambiarEstadoOferta_(id, accion) {
  try {
    await apiPost('estadoOferta', { usuarioId: currentUser.id, id, accion });
    cerrarModalEstadoOferta_();
    await recargarOfertas_(false);
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo cambiar', text: String(e.message || e) });
  }
}

async function eliminarOferta_(id) {
  const o = OFE.registros.find(x => x.id === id);
  if (!o) return;
  const r = await Swal.fire({
    icon: 'warning', title: '¿Eliminar la oferta?',
    html: `<b>${esc_(o.empleador || o.id)}</b><br>${esc_(o.titulo)}<br><br>Esto no se puede deshacer.`,
    showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar'
  });
  if (!r.isConfirmed) return;
  try {
    await apiPost('eliminarOferta', { usuarioId: currentUser.id, id });
    await recargarOfertas_(false);
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: String(e.message || e) });
  }
}

/* ============================================================
   VISTA: CONFIGURACIÓN DE OFERTAS
   ============================================================ */
const OFECFG = { data: null, listas: null, puedeEditar: false };

async function abrirOfertasConfig_() {
  if (!ofePuedeEntrar_()) {
    Swal.fire({ icon: 'warning', title: 'Sin permiso', text: 'Solo PROCESOS, SUPERUSUARIO o DESARROLLADOR entran aquí.' });
    return;
  }
  showView('ofertas-config');
  try {
    const d = await apiGet('ofertasConfig', { usuarioId: currentUser.id });
    OFECFG.data = d.config;
    OFECFG.listas = d.listas;
    OFECFG.puedeEditar = !!d.puedeEditar;
    OFECFG.politicas = d.politicasCupo || [];
    pintarOfertasConfig_();
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: String(e.message || e) });
  }
}

function ofeCfgCampo_(id, label, valor, sub, tipo) {
  const dis = OFECFG.puedeEditar ? '' : ' disabled';
  const control = (tipo === 'textarea')
    ? `<textarea id="ofecfg-${id}" rows="3" class="ofe-input"${dis}>${esc_(valor || '')}</textarea>`
    : `<input id="ofecfg-${id}" class="ofe-input" type="text" value="${esc_(valor || '')}"${dis} />`;
  return `<div class="ofe-campo">
    <label for="ofecfg-${id}">${esc_(label)}</label>
    ${control}
    ${sub ? `<div class="ofe-hint">${sub}</div>` : ''}
  </div>`;
}

function pintarOfertasConfig_() {
  const c = OFECFG.data || {};
  const cont = document.querySelector('#ofecfg-body');
  if (!cont) return;

  const pol = (OFECFG.politicas || []).map(p =>
    `<option value="${p.clave}"${c.politicaCupo === p.clave ? ' selected' : ''}>${esc_(p.label)}</option>`).join('');

  cont.innerHTML = `
    <div class="ofe-cfg-card">
      <h3>📄 Plantilla del PDF</h3>
      <p class="muted">El PDF de la oferta que descarga el estudiante (Entrega 4). Pega aquí el ID o la URL de la presentación de Google.</p>
      ${ofeCfgCampo_('plantillaPdf', 'ID de la plantilla', c.plantillaPdf,
        c.plantillaPdfUrl ? `<a href="${esc_(c.plantillaPdfUrl)}" target="_blank" rel="noopener">Abrir la plantilla</a>` : 'Todavía sin plantilla.')}
    </div>

    <div class="ofe-cfg-card">
      <h3>🗂️ Archivos y programa</h3>
      ${ofeCfgCampo_('carpetaFotos', 'Carpeta de Drive para las fotos', c.carpetaFotos, 'Si se deja vacía se usa la carpeta OFERTAS_FOTOS del Drive de SEP.')}
      ${ofeCfgCampo_('programa', 'Programa', c.programa, 'Programa al que pertenecen estas ofertas.')}
      ${ofeCfgCampo_('temporada', 'Temporada', c.temporada, 'Fija para todas las ofertas. Hoy: SUMMER.')}
    </div>

    <div class="ofe-cfg-card">
      <h3>🎟️ Cupos</h3>
      <div class="ofe-campo">
        <label>Umbral de "Pocos cupos"</label>
        <div class="ofe-fijo">${c.umbralPocos || 4} o más libres = Disponible · 1 a 3 = Pocos cupos · 0 = Sin cupos</div>
        <div class="ofe-hint">No es configurable (decisión del 03/09/2026).</div>
      </div>
      <div class="ofe-campo">
        <label for="ofecfg-politicaCupo">Valor por defecto de "¿el cupo vuelve a estar disponible?"</label>
        <select id="ofecfg-politicaCupo" class="ofe-input"${OFECFG.puedeEditar ? '' : ' disabled'}>${pol}</select>
        <div class="ofe-hint">Con esto nace cada oferta nueva. La regla que manda es la de <b>cada oferta</b>,
        que se elige en el bloque Features del formulario. Lo aplica la Entrega 3.</div>
      </div>
    </div>

    <div class="ofe-cfg-card">
      <h3>📋 Catálogos</h3>
      ${ofeCfgCampo_('listaEstadosUsa', 'Estados de EE. UU. (uno por línea)', (OFECFG.listas?.estadosUsa || []).join('\n'), 'Alimenta el selector "State" del formulario.', 'textarea')}
      ${ofeCfgCampo_('listaPosiciones', 'Posiciones de trabajo (una por línea)', (OFECFG.listas?.posiciones || []).join('\n'), 'Son sugerencias: en el formulario se puede escribir una que no esté.', 'textarea')}
      <div class="ofe-campo">
        <label>Sponsors</label>
        <div class="ofe-fijo">${esc_((OFECFG.listas?.sponsors || []).join(' · '))}</div>
        <div class="ofe-hint">Se toman de Configuración → Listas (LISTA_SPONSOR), la misma lista del Contador.</div>
      </div>
      <div class="ofe-campo">
        <label>Niveles de inglés</label>
        <div class="ofe-fijo">${esc_((OFECFG.listas?.niveles || []).join(' · '))}</div>
        <div class="ofe-hint">Salen de la escala del Puntaje SEA, para que oferta y prueba hablen del mismo nivel.</div>
      </div>
    </div>

    <div class="ofe-cfg-card">
      <h3>💬 Textos que ve el estudiante</h3>
      ${OFE_CFG_TEXTOS.map(x => ofeCfgCampo_(x[0], x[1], c[x[0]], x[2], 'textarea')).join('')}
    </div>`;

  const btn = document.querySelector('#ofecfg-save');
  if (btn) btn.style.display = OFECFG.puedeEditar ? '' : 'none';
}

/* ============================================================
   TEXTOS QUE VE EL PARTICIPANTE (Fase 4 · Entrega 2 · 03/09/2026)
   ============================================================
   Antes eran "Motivo de bloqueo 1..6" y no se sabía cuál era cuál.
   Ahora cada texto dice para qué sirve, y están los tres que
   faltaban del plan (fecha de inicio, fecha de fin y cierre) más
   las puertas del participante y la casilla obligatoria.
   El orden de esta lista es el orden en que salen en pantalla. */
const OFE_CFG_TEXTOS = [
  ['txtConfirmar', 'Modal de confirmación', 'Mensaje principal que lee el participante antes de confirmar.'],
  ['txtSponsor', 'Advertencia del Sponsor', 'Donde escribas [SPONSOR] se pone el de la oferta.'],
  ['txtCasilla', 'Casilla obligatoria', 'Sin marcarla, el botón de confirmar no se habilita.'],
  ['txtPuertaPago', 'Puerta · sin pago de la oferta', 'Todavía no tiene validado el pago de la oferta de empleo.'],
  ['txtPuertaForm', 'Puerta · formulario sin aprobar', 'El formulario no está terminado y aprobado por SEP.'],
  ['txtPuertaOtra', 'Puerta · ya tiene una oferta', 'Solo puede tener una oferta seleccionada a la vez.'],
  ['txtPuertaFechas', 'Puerta · sin fechas de disponibilidad', 'En su formulario faltan las fechas para viajar.'],
  ['txtBloqNivel', 'Motivo · nivel de inglés', 'Su nivel está por debajo del que exige la oferta.'],
  ['txtBloqInicio', 'Motivo · fecha de inicio', 'Su fecha de inicio no cae en el rango de la oferta.'],
  ['txtBloqFin', 'Motivo · fecha de finalización', 'Su fecha de salida no cae en el rango de la oferta.'],
  ['txtBloqGenero', 'Motivo · género', 'La oferta está dirigida a otro género.'],
  ['txtBloqCupos', 'Motivo · sin cupos', 'La oferta se quedó sin cupos disponibles.'],
  ['txtBloqCierre', 'Motivo · periodo cerrado', 'La oferta se cerró o se le pasó la fecha de cierre.']
];

async function guardarOfertasConfig_() {
  if (!OFECFG.puedeEditar) return;
  const claves = ['plantillaPdf', 'carpetaFotos', 'programa', 'temporada', 'politicaCupo',
    'listaEstadosUsa', 'listaPosiciones'].concat(OFE_CFG_TEXTOS.map(x => x[0]));
  const config = {};
  claves.forEach(k => {
    const el = document.querySelector('#ofecfg-' + k);
    if (el) config[k] = String(el.value || '').trim();
  });
  try {
    const d = await apiPost('guardarOfertasConfig', { usuarioId: currentUser.id, config });
    OFECFG.data = d;
    /* La configuración cambia los catálogos del formulario: se
       invalida la carga de la lista para que los vuelva a pedir. */
    OFE.cargado = false;
    Swal.fire({ icon: 'success', title: 'Configuración guardada', timer: 1100, showConfirmButton: false });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: String(e.message || e) });
  }
}

/* ============================================================
   PARTICIPANTES DE LA OFERTA — Entrega 3 (1.26 a 1.31)
   ============================================================
   Un solo modal con dos pantallas: la LISTA de participantes de la
   oferta y el BUSCADOR para aplicar a uno internamente. Las tres
   acciones que piden datos (entrevista, resultado y habilitación)
   salen en Swal, igual que el resto de la app.

   La máquina de estados NO se repite aquí: cada fila llega del
   backend con su objeto `puede`, y esta pantalla solo pinta los
   botones que ese objeto autoriza.
   ============================================================ */
function ofePartAbierto_() {
  return !document.querySelector('#modal-ofe-part')?.classList.contains('hidden');
}

function cerrarParticipantes_() {
  document.querySelector('#modal-ofe-part')?.classList.add('hidden');
  OFE.part = null;
}

async function abrirParticipantes_(id) {
  const modal = document.querySelector('#modal-ofe-part');
  if (!modal) return;
  OFE.part = { ofertaId: id, datos: null, pantalla: 'lista', resultados: [], buscado: '' };
  modal.classList.remove('hidden');
  document.querySelector('#ofe-part-body').innerHTML =
    '<p class="muted center" style="padding:26px 0">Cargando participantes…</p>';
  await recargarParticipantes_();
}

async function recargarParticipantes_(silencioso) {
  if (!OFE.part) return;
  try {
    OFE.part.datos = await apiGet('ofertaParticipantes',
      { usuarioId: currentUser.id, id: OFE.part.ofertaId }, { silent: !!silencioso });
    renderParticipantes_();
  } catch (e) {
    document.querySelector('#ofe-part-body').innerHTML =
      `<p class="muted center" style="padding:22px 0">${esc_(String(e.message || e))}</p>`;
  }
}

function ofePartCabecera_() {
  const d = OFE.part.datos;
  const c = d.cupos;
  const avisoBot = d.botProcesos ? '' :
    `<div class="ofe-part__aviso">⚠️ El número de <b>Procesos</b> todavía no está conectado
       (claves <code>BB2_*</code> en Configuración → Avanzado). Los avisos de esta pantalla
       saldrán <b>solo por correo</b>.</div>`;
  return `<div class="ofe-part__head">
      <div class="ofe-part__oferta">
        <b>${esc_(d.oferta.empleador || '(sin empleador)')}</b>
        <span>${esc_(d.oferta.posicion || '')}${d.oferta.lugar ? ' · ' + esc_(d.oferta.lugar) : ''}</span>
        <span>🤝 ${esc_(d.oferta.sponsor || OFE_SIN_DATO)} · 🎟️ ${c.libres} de ${c.total} libres
          · política del cupo: ${esc_(d.oferta.cupoVuelve === 'Yes' ? 'se libera' : 'se pierde')}</span>
      </div>
      <button class="btn btn-primary" id="ofe-part-aplicar">➕ Aplicar participante</button>
    </div>${avisoBot}`;
}

function ofePartFilaHtml_(p) {
  const acciones = [];
  if (p.puede.aplicarSponsor) acciones.push(`<button class="btn btn-ghost" data-pact="sponsor" data-id="${esc_(p.id)}">📤 Aplicada al Sponsor</button>`);
  if (p.puede.agendar)   acciones.push(`<button class="btn btn-ghost" data-pact="entrevista" data-id="${esc_(p.id)}">🗓️ ${p.entrevista.fecha ? 'Reprogramar' : 'Agendar'} entrevista</button>`);
  if (p.puede.resultado) acciones.push(`<button class="btn btn-ghost" data-pact="resultado" data-id="${esc_(p.id)}">⚖️ Resultado</button>`);
  if (p.puede.habilitar) acciones.push(`<button class="btn btn-ghost" data-pact="habilitar" data-id="${esc_(p.id)}">🔓 Habilitar selección</button>`);
  acciones.push(`<button class="btn btn-ghost" data-pact="historial" data-id="${esc_(p.id)}">🕘 Historial</button>`);

  const ent = p.entrevista.fecha
    ? `<div class="ofe-part__ent">🗓️ Entrevista: <b>${esc_(p.entrevista.fecha)} ${esc_(p.entrevista.hora)}</b>
        ${p.entrevista.link ? ` · <a href="${esc_(p.entrevista.link)}" target="_blank" rel="noopener">enlace</a>` : ''}
        ${p.entrevista.observaciones ? `<br><span class="muted">Obs.: ${esc_(p.entrevista.observaciones)}</span>` : ''}</div>`
    : '';
  const res = p.resultado
    ? `<div class="ofe-part__res">⚖️ ${esc_(p.resultado === 'APROBADA' ? 'Aprobado' : 'No aprobado')}
        el ${esc_(p.resultadoFecha)} por ${esc_(p.resultadoPor)}
        ${p.resultadoNota ? `<br><span class="muted">${esc_(p.resultadoNota)}</span>` : ''}</div>`
    : '';
  const exc = p.excepcion
    ? `<div class="ofe-part__exc">⚠️ Excepción administrativa: ${esc_(p.motivoExcepcion)}</div>` : '';
  const hab = p.motivoHabilitacion
    ? `<div class="ofe-part__exc">🔓 Habilitada de nuevo: ${esc_(p.motivoHabilitacion)}</div>` : '';

  return `<article class="ofe-part__card" data-pid="${esc_(p.id)}">
    <div class="ofe-part__top">
      <div>
        <b>${esc_(p.nombre)}</b>
        <span class="muted">${esc_(p.documento || OFE_SIN_DATO)} · ${esc_(p.idRegistro)}</span>
      </div>
      <span class="ofe-badge" style="background:${p.estadoColor};">${p.estadoIc} ${esc_(p.estadoLabel)}</span>
    </div>
    <div class="ofe-part__meta">
      <span>${p.origen === 'SEP' ? '🏛️' : '🙋'} ${esc_(p.origenLabel)}</span>
      <span>📅 ${esc_(p.fecha)} ${esc_(p.hora)}</span>
      <span>🎟️ ${p.cupoConsumido && !p.cupoDevuelto ? 'cupo consumido' : (p.cupoDevuelto ? 'cupo devuelto' : 'sin cupo')}</span>
    </div>
    ${ent}${res}${exc}${hab}
    <div class="ofe-part__acts">${acciones.join('')}</div>
  </article>`;
}

function renderParticipantes_() {
  const cont = document.querySelector('#ofe-part-body');
  const d = OFE.part.datos;
  if (!cont || !d) return;

  if (OFE.part.pantalla === 'buscar') { renderPartBuscador_(); return; }

  const lista = d.participantes;
  const cuerpo = lista.length
    ? lista.map(ofePartFilaHtml_).join('')
    : `<p class="muted center" style="padding:22px 0">Todavía no hay participantes en esta oferta.</p>`;

  cont.innerHTML = ofePartCabecera_() + `<div class="ofe-part__list">${cuerpo}</div>`;

  document.querySelector('#ofe-part-aplicar')?.addEventListener('click', () => {
    OFE.part.pantalla = 'buscar'; OFE.part.resultados = []; OFE.part.buscado = '';
    renderParticipantes_();
  });
  cont.querySelectorAll('[data-pact]').forEach(b => b.addEventListener('click', () =>
    ofePartAccion_(b.getAttribute('data-pact'), b.getAttribute('data-id'))));
}

/* ── Buscador para aplicar internamente (1.26) ─────────────── */
function renderPartBuscador_() {
  const cont = document.querySelector('#ofe-part-body');
  const d = OFE.part.datos;
  const res = OFE.part.resultados;

  const filas = res.length
    ? res.map(r => {
        const problemas = (r.puertas || []).concat(r.motivos || []);
        const veredicto = r.cumple
          ? '<div class="ofe-part__ok">✅ Cumple todos los requisitos</div>'
          : `<div class="ofe-part__no">🚫 No cumple:<ul>${
              problemas.map(m => `<li>${esc_(m.texto)}</li>`).join('')}</ul></div>`;
        const ya = r.yaTiene
          ? `<div class="ofe-part__exc">📌 Ya tiene una oferta activa: ${esc_(r.yaTiene.empleador)}
              (${esc_(r.yaTiene.estadoLabel)}). Habilítale primero la selección.</div>` : '';
        return `<article class="ofe-part__card">
          <div class="ofe-part__top">
            <div><b>${esc_(r.nombre)}</b>
              <span class="muted">${esc_(r.documento || OFE_SIN_DATO)} · ${esc_(r.idRegistro)}</span></div>
          </div>
          <div class="ofe-part__meta">
            <span>🗣️ ${esc_(r.nivel || OFE_SIN_DATO)}</span>
            <span>⚧ ${esc_(r.genero || OFE_SIN_DATO)}</span>
            <span>📆 ${esc_(r.desde || '—')} → ${esc_(r.hasta || '—')}</span>
          </div>
          ${veredicto}${ya}
          <div class="ofe-part__acts">
            ${r.yaTiene ? '' : `<button class="btn ${r.cumple ? 'btn-primary' : 'btn-ghost'}"
                data-paplicar="${esc_(r.idRegistro)}">${r.cumple ? '✅ Aplicar a esta oferta' : 'Aplicar…'}</button>`}
          </div>
        </article>`;
      }).join('')
    : (OFE.part.buscado
        ? '<p class="muted center" style="padding:22px 0">Sin resultados para esa búsqueda.</p>'
        : '<p class="muted center" style="padding:22px 0">Busca por nombre, documento, correo, WhatsApp o ID interno.</p>');

  cont.innerHTML = `<div class="ofe-part__head">
      <div class="ofe-part__oferta">
        <b>Aplicar un participante</b>
        <span>${esc_(d.oferta.empleador)} · ${esc_(d.oferta.posicion)} · 🎟️ ${d.cupos.libres} libre(s)</span>
      </div>
      <button class="btn btn-ghost" id="ofe-part-volver">← Volver</button>
    </div>
    <div class="conta-search"><input id="ofe-part-q" type="search"
      placeholder="Nombre, documento, correo, WhatsApp o ID interno…" autocomplete="off"
      value="${esc_(OFE.part.buscado)}" /></div>
    <div class="ofe-part__list">${filas}</div>`;

  document.querySelector('#ofe-part-volver')?.addEventListener('click', () => {
    OFE.part.pantalla = 'lista'; renderParticipantes_();
  });
  const input = document.querySelector('#ofe-part-q');
  input?.addEventListener('input', () => {
    clearTimeout(OFE.part._t);
    OFE.part._t = setTimeout(() => buscarParticipantes_(input.value), 350);
  });
  input?.focus();
  cont.querySelectorAll('[data-paplicar]').forEach(b =>
    b.addEventListener('click', () => aplicarParticipante_(b.getAttribute('data-paplicar'))));
}

async function buscarParticipantes_(q) {
  if (!OFE.part) return;
  OFE.part.buscado = q || '';
  if (String(q || '').trim().length < 2) { OFE.part.resultados = []; renderPartBuscador_(); return; }
  try {
    const d = await apiGet('buscarParticipantes',
      { usuarioId: currentUser.id, id: OFE.part.ofertaId, q: q }, { silent: true });
    OFE.part.resultados = d.resultados || [];
  } catch (e) { OFE.part.resultados = []; }
  renderPartBuscador_();
}

async function aplicarParticipante_(idRegistro) {
  const r = (OFE.part.resultados || []).find(x => x.idRegistro === idRegistro);
  if (!r) return;
  const puedeExcepcion = !!OFE.part.datos.permisos.excepcion;

  /* Antes de confirmar hay que ver participante, oferta, Sponsor y
     cupos (1.26, penúltimo punto). */
  const d = OFE.part.datos;
  const resumen =
    `<div style="text-align:left;font-size:14px;line-height:1.6">
      <b>${esc_(r.nombre)}</b><br><span style="color:#64748b">${esc_(r.documento || '')} · ${esc_(r.idRegistro)}</span>
      <hr style="border:0;border-top:1px solid #e6e9ee;margin:10px 0">
      🏢 <b>${esc_(d.oferta.empleador)}</b> — ${esc_(d.oferta.posicion)}<br>
      🤝 Sponsor: <b>${esc_(d.oferta.sponsor || '—')}</b><br>
      🎟️ Cupos disponibles: <b>${d.cupos.libres}</b>
    </div>`;

  if (!r.cumple) {
    const problemas = (r.puertas || []).concat(r.motivos || [])
      .map(m => '<li>' + esc_(m.texto) + '</li>').join('');
    if (!puedeExcepcion) {
      Swal.fire({ icon: 'warning', title: 'No cumple los requisitos',
        html: `<div style="text-align:left"><ul>${problemas}</ul></div>
               <p style="font-size:13px;color:#64748b">Solo SUPERUSUARIO o DESARROLLADOR pueden aplicar de todas formas.</p>` });
      return;
    }
    const ex = await Swal.fire({
      icon: 'warning', title: 'Aplicar de todas formas',
      html: `${resumen}<div style="text-align:left;margin-top:10px"><b>No cumple:</b><ul>${problemas}</ul></div>`,
      input: 'textarea', inputLabel: 'Motivo de la excepción (obligatorio)',
      inputPlaceholder: 'Por qué se aplica igual…',
      inputValidator: v => (!v || v.trim().length < 5) ? 'Escribe el motivo (mínimo 5 caracteres).' : undefined,
      showCancelButton: true, confirmButtonText: 'Aplicar de todas formas', cancelButtonText: 'Cancelar'
    });
    if (!ex.isConfirmed) return;
    await enviarAplicacion_(idRegistro, true, ex.value);
    return;
  }

  const ok = await Swal.fire({
    icon: 'question', title: 'Confirmar la aplicación', html: resumen,
    showCancelButton: true, confirmButtonText: 'Aplicar', cancelButtonText: 'Cancelar'
  });
  if (ok.isConfirmed) await enviarAplicacion_(idRegistro, false, '');
}

async function enviarAplicacion_(idRegistro, excepcion, motivo) {
  try {
    const d = await apiPost('aplicarParticipante', {
      usuarioId: currentUser.id, id: OFE.part.ofertaId,
      idRegistro: idRegistro, excepcion: !!excepcion, motivoExcepcion: motivo || ''
    });
    OFE.part.pantalla = 'lista';
    await recargarParticipantes_(true);
    await recargarOfertas_(true);
    Swal.fire({ icon: 'success', title: 'Participante aplicado', text: ofeTextoAviso_(d.aviso) });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo aplicar', text: String(e.message || e) });
  }
}

/* Qué se le dice al usuario sobre el aviso: la verdad, no un "listo"
   genérico. Si el WhatsApp no salió, se dice y por qué. */
function ofeTextoAviso_(a) {
  if (!a) return '';
  if (a.whatsapp && a.correo) return 'Se le avisó por WhatsApp y correo.';
  if (a.whatsapp) return 'Se le avisó por WhatsApp.';
  if (a.correo)   return 'Se le avisó por correo. El WhatsApp no salió' + (a.motivo ? ' (' + a.motivo + ').' : '.');
  return 'No se envió ningún aviso' + (a.motivo ? ' (' + a.motivo + ').' : '.');
}

/* ── Las cuatro acciones sobre una fila ────────────────────── */
async function ofePartAccion_(accion, id) {
  const p = (OFE.part.datos.participantes || []).find(x => x.id === id);
  if (!p) return;
  if (accion === 'historial')  return ofePartHistorial_(p);
  if (accion === 'sponsor')    return ofePartSponsor_(p);
  if (accion === 'entrevista') return ofePartEntrevista_(p);
  if (accion === 'resultado')  return ofePartResultado_(p);
  if (accion === 'habilitar')  return ofePartHabilitar_(p);
}

function ofePartHistorial_(p) {
  const filas = (p.historial || []).slice().reverse().map(h =>
    `<li><b>${esc_(h.a || h.q || '')}</b> — ${esc_(h.d || '')}<br>
      <span style="color:#64748b;font-size:12px">${esc_(h.f || '')} · ${esc_(h.q || '')}</span></li>`).join('');
  Swal.fire({
    title: 'Historial de ' + p.nombre, width: 640,
    html: `<ul style="text-align:left;font-size:13.5px;line-height:1.5">${filas || '<li>Sin movimientos.</li>'}</ul>`
  });
}

async function ofePartSponsor_(p) {
  const r = await Swal.fire({
    icon: 'question', title: 'Aplicación con el Sponsor',
    text: 'Marca que SEP ya aplicó a ' + p.nombre + ' con ' + (p.sponsor || 'el Sponsor') + '.',
    input: 'text', inputLabel: 'Nota (opcional)',
    showCancelButton: true, confirmButtonText: 'Marcar como aplicada', cancelButtonText: 'Cancelar'
  });
  if (!r.isConfirmed) return;
  await ofePartLlamar_('marcarAplicadaSponsor', { id: p.id, nota: r.value || '' }, 'Aplicación registrada');
}

async function ofePartEntrevista_(p) {
  const e = p.entrevista || {};
  const r = await Swal.fire({
    title: (e.fecha ? 'Reprogramar' : 'Agendar') + ' entrevista', width: 620,
    html: `<div style="text-align:left;font-size:14px">
        <label>Fecha (dd/mm/aaaa)</label>
        <input id="sw-ent-f" class="swal2-input" placeholder="05/09/2026" value="${esc_(e.fecha || '')}">
        <label>Hora (HH:mm, 24 h)</label>
        <input id="sw-ent-h" class="swal2-input" placeholder="09:30" value="${esc_(e.hora || '')}">
        <label>Enlace de la entrevista (opcional)</label>
        <input id="sw-ent-l" class="swal2-input" placeholder="https://…" value="${esc_(e.link || '')}">
        <label>Instrucciones para el participante</label>
        <textarea id="sw-ent-i" class="swal2-textarea" placeholder="Qué debe tener listo, cómo conectarse…">${esc_(e.instrucciones || '')}</textarea>
        <label>Observaciones internas (no las ve el participante)</label>
        <textarea id="sw-ent-o" class="swal2-textarea">${esc_(e.observaciones || '')}</textarea>
      </div>`,
    showCancelButton: true, confirmButtonText: 'Guardar y avisar', cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const f = document.querySelector('#sw-ent-f').value.trim();
      const h = document.querySelector('#sw-ent-h').value.trim();
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(f)) { Swal.showValidationMessage('La fecha va en dd/mm/aaaa.'); return false; }
      if (!/^\d{1,2}:\d{2}$/.test(h)) { Swal.showValidationMessage('La hora va en HH:mm (24 horas).'); return false; }
      return {
        fecha: f, hora: h,
        link: document.querySelector('#sw-ent-l').value.trim(),
        instrucciones: document.querySelector('#sw-ent-i').value.trim(),
        observaciones: document.querySelector('#sw-ent-o').value.trim()
      };
    }
  });
  if (!r.isConfirmed) return;
  await ofePartLlamar_('agendarEntrevista', Object.assign({ id: p.id }, r.value), 'Entrevista registrada');
}

async function ofePartResultado_(p) {
  const r = await Swal.fire({
    title: 'Resultado de la entrevista', width: 600,
    html: `<div style="text-align:left;font-size:14px">
        <p><b>${esc_(p.nombre)}</b> · ${esc_(p.empleador)} — ${esc_(p.posicion)}</p>
        <label><input type="radio" name="sw-res" value="APROBADA" checked> ✅ Aprobado</label><br>
        <label><input type="radio" name="sw-res" value="NO_APROBADA"> ❌ No aprobado</label>
        <p style="font-size:12.5px;color:#64748b;margin-top:10px">
          Al aprobar, el Sponsor <b>${esc_(p.sponsor || '—')}</b> queda escrito en la ficha del participante.
          Al no aprobar, el cupo se trata según la política de esta oferta.</p>
        <label>Nota interna (opcional)</label>
        <textarea id="sw-res-n" class="swal2-textarea"></textarea>
      </div>`,
    showCancelButton: true, confirmButtonText: 'Guardar y avisar', cancelButtonText: 'Cancelar',
    preConfirm: () => ({
      resultado: (document.querySelector('input[name="sw-res"]:checked') || {}).value || 'APROBADA',
      nota: document.querySelector('#sw-res-n').value.trim()
    })
  });
  if (!r.isConfirmed) return;
  await ofePartLlamar_('resultadoEntrevista', Object.assign({ id: p.id }, r.value), 'Resultado registrado');
}

async function ofePartHabilitar_(p) {
  const r = await Swal.fire({
    icon: 'warning', title: 'Habilitar nuevamente la selección', width: 600,
    html: `<div style="text-align:left;font-size:14px">
        <p>${esc_(p.nombre)} volverá a poder escoger oferta y se recalculan todas sus validaciones.</p>
        <label>Motivo (obligatorio)</label>
        <textarea id="sw-hab-m" class="swal2-textarea"></textarea>
        <label style="display:block;margin-top:8px">
          <input type="checkbox" id="sw-hab-c" ${p.politicaCupo === 'Yes' ? 'checked' : ''}>
          Devolver el cupo a la oferta</label>
      </div>`,
    showCancelButton: true, confirmButtonText: 'Habilitar', cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const m = document.querySelector('#sw-hab-m').value.trim();
      if (m.length < 5) { Swal.showValidationMessage('Escribe el motivo (mínimo 5 caracteres).'); return false; }
      return { motivo: m, devolverCupo: document.querySelector('#sw-hab-c').checked };
    }
  });
  if (!r.isConfirmed) return;
  await ofePartLlamar_('habilitarSeleccion', Object.assign({ id: p.id }, r.value), 'Selección habilitada');
}

async function ofePartLlamar_(accion, datos, titulo) {
  try {
    const d = await apiPost(accion, Object.assign({ usuarioId: currentUser.id }, datos));
    await recargarParticipantes_(true);
    await recargarOfertas_(true);
    Swal.fire({ icon: 'success', title: titulo, text: ofeTextoAviso_(d && d.aviso) });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: String(e.message || e) });
  }
}

/* ============================================================
   DESDE LA FICHA DEL PARTICIPANTE (1.26, segundo camino)
   ============================================================
   Lo llama js/nivel.js. Abre el mismo modal, pero al revés: en vez
   de "qué participantes tiene esta oferta", muestra "qué ofertas le
   sirven a este participante" y permite asignarle una.
   ============================================================ */
async function abrirOfertasDeParticipante_(idRegistro, nombre) {
  if (!ofePuedeEntrar_()) {
    Swal.fire({ icon: 'warning', title: 'Sin permiso',
      text: 'Solo PROCESOS, SUPERUSUARIO o DESARROLLADOR pueden asignar ofertas.' });
    return;
  }
  if (!idRegistro) {
    Swal.fire({ icon: 'info', title: 'Sin ID de registro',
      text: 'Esta fila no tiene ID_REGISTRO, así que no se puede cruzar con las ofertas.' });
    return;
  }
  const modal = document.querySelector('#modal-ofe-part');
  if (!modal) return;
  OFE.part = { modo: 'participante', idRegistro: idRegistro, nombre: nombre || '', datos: null };
  modal.classList.remove('hidden');
  document.querySelector('#ofe-part-body').innerHTML =
    '<p class="muted center" style="padding:26px 0">Buscando ofertas para este participante…</p>';
  await recargarOfertasDeParticipante_();
}

async function recargarOfertasDeParticipante_(silencioso) {
  if (!OFE.part || OFE.part.modo !== 'participante') return;
  try {
    OFE.part.datos = await apiGet('ofertasParaParticipante',
      { usuarioId: currentUser.id, idRegistro: OFE.part.idRegistro }, { silent: !!silencioso });
    renderOfertasDeParticipante_();
  } catch (e) {
    document.querySelector('#ofe-part-body').innerHTML =
      `<p class="muted center" style="padding:22px 0">${esc_(String(e.message || e))}</p>`;
  }
}

function renderOfertasDeParticipante_() {
  const cont = document.querySelector('#ofe-part-body');
  const d = OFE.part.datos;
  if (!cont || !d) return;
  const p = d.participante;

  const puertas = (d.puertas || []).length
    ? `<div class="ofe-part__no">🚫 Este participante todavía no puede tomar ofertas:
        <ul>${d.puertas.map(m => `<li>${esc_(m.texto)}</li>`).join('')}</ul></div>` : '';

  const mia = d.mia
    ? `<div class="ofe-part__ent">📌 Ya tiene <b>${esc_(d.mia.empleador)}</b> — ${esc_(d.mia.posicion)}
        (${esc_(d.mia.estadoLabel)}). Para cambiarla, habilítale la selección desde la oferta.</div>` : '';

  const filas = (d.ofertas || []).map(o => {
    const veredicto = o.cumple
      ? '<div class="ofe-part__ok">✅ Cumple todos los requisitos</div>'
      : `<div class="ofe-part__no">🚫 No cumple:<ul>${
          o.motivos.map(m => `<li>${esc_(m.texto)}</li>`).join('')}</ul></div>`;
    return `<article class="ofe-part__card">
      <div class="ofe-part__top">
        <div><b>${esc_(o.empleador)}</b><span class="muted">${esc_(o.posicion)}${o.lugar ? ' · ' + esc_(o.lugar) : ''}</span></div>
        <span class="ofe-badge" style="background:${o.estadoColor};">${esc_(o.estadoLabel)}</span>
      </div>
      <div class="ofe-part__meta">
        <span>🤝 ${esc_(o.sponsor || OFE_SIN_DATO)}</span>
        <span>💵 USD $${esc_(o.pagoHora || '0')}/h</span>
        <span>🎟️ ${o.cuposLibres} de ${o.cuposTotal} libres</span>
      </div>
      ${veredicto}
      <div class="ofe-part__acts">
        ${d.mia ? '' : `<button class="btn ${o.cumple ? 'btn-primary' : 'btn-ghost'}"
          data-pofe="${esc_(o.id)}">${o.cumple ? '✅ Asignar esta oferta' : 'Asignar…'}</button>`}
      </div>
    </article>`;
  }).join('');

  cont.innerHTML = `<div class="ofe-part__head">
      <div class="ofe-part__oferta">
        <b>${esc_(p.nombre)}</b>
        <span>${esc_(p.documento || OFE_SIN_DATO)} · ${esc_(p.idRegistro)}</span>
        <span>🗣️ ${esc_(p.nivel || OFE_SIN_DATO)} · ⚧ ${esc_(p.genero || OFE_SIN_DATO)}
          · 📆 ${esc_(p.desde || '—')} → ${esc_(p.hasta || '—')}</span>
      </div>
    </div>
    ${puertas}${mia}
    <div class="ofe-part__list">${filas ||
      '<p class="muted center" style="padding:22px 0">No hay ofertas publicadas.</p>'}</div>`;

  cont.querySelectorAll('[data-pofe]').forEach(b =>
    b.addEventListener('click', () => asignarOfertaAParticipante_(b.getAttribute('data-pofe'))));
}

async function asignarOfertaAParticipante_(ofertaId) {
  const d = OFE.part.datos;
  const o = (d.ofertas || []).find(x => x.id === ofertaId);
  if (!o) return;
  const resumen = `<div style="text-align:left;font-size:14px;line-height:1.6">
      <b>${esc_(d.participante.nombre)}</b><br>
      <span style="color:#64748b">${esc_(d.participante.documento || '')} · ${esc_(d.participante.idRegistro)}</span>
      <hr style="border:0;border-top:1px solid #e6e9ee;margin:10px 0">
      🏢 <b>${esc_(o.empleador)}</b> — ${esc_(o.posicion)}<br>
      🤝 Sponsor: <b>${esc_(o.sponsor || '—')}</b><br>
      🎟️ Cupos disponibles: <b>${o.cuposLibres}</b>
    </div>`;

  const problemas = (d.puertas || []).concat(o.motivos || []);
  let excepcion = false, motivo = '';
  if (problemas.length) {
    if (!d.permisos.excepcion) {
      Swal.fire({ icon: 'warning', title: 'No cumple los requisitos',
        html: `<div style="text-align:left"><ul>${problemas.map(m => '<li>' + esc_(m.texto) + '</li>').join('')}</ul></div>
               <p style="font-size:13px;color:#64748b">Solo SUPERUSUARIO o DESARROLLADOR pueden aplicar de todas formas.</p>` });
      return;
    }
    const ex = await Swal.fire({
      icon: 'warning', title: 'Aplicar de todas formas',
      html: `${resumen}<div style="text-align:left;margin-top:10px"><b>No cumple:</b>
             <ul>${problemas.map(m => '<li>' + esc_(m.texto) + '</li>').join('')}</ul></div>`,
      input: 'textarea', inputLabel: 'Motivo de la excepción (obligatorio)',
      inputValidator: v => (!v || v.trim().length < 5) ? 'Escribe el motivo (mínimo 5 caracteres).' : undefined,
      showCancelButton: true, confirmButtonText: 'Aplicar de todas formas', cancelButtonText: 'Cancelar'
    });
    if (!ex.isConfirmed) return;
    excepcion = true; motivo = ex.value;
  } else {
    const ok = await Swal.fire({ icon: 'question', title: 'Confirmar la asignación', html: resumen,
      showCancelButton: true, confirmButtonText: 'Asignar', cancelButtonText: 'Cancelar' });
    if (!ok.isConfirmed) return;
  }

  try {
    const r = await apiPost('aplicarParticipante', {
      usuarioId: currentUser.id, id: ofertaId, idRegistro: OFE.part.idRegistro,
      excepcion: excepcion, motivoExcepcion: motivo
    });
    await recargarOfertasDeParticipante_(true);
    if (OFE.cargado) await recargarOfertas_(true);
    Swal.fire({ icon: 'success', title: 'Oferta asignada', text: ofeTextoAviso_(r.aviso) });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo asignar', text: String(e.message || e) });
  }
}

/* ============================================================
   EN VIVO (/meta/ofertas_rev)
   ============================================================ */
const FBOF = { ref: null, primed: false, pollTimer: null, refrescoTimer: null };

function ofeAgendarRefresco_() {
  clearTimeout(FBOF.refrescoTimer);
  FBOF.refrescoTimer = setTimeout(ofeRefrescarVivo_, 400);
}
function ofeRefrescarVivo_() {
  /* Entrega 3 — el modal de participantes cuenta igual que el del
     formulario: nunca se repinta por debajo de algo abierto. */
  if (ofeModalAbierto_() || ofePartAbierto_()) { ofeAgendarRefresco_(); return; }
  if (!document.querySelector('#view-ofertas.active')) return;
  recargarOfertas_(true);
}
function ofeEscuchar_() {
  if (!window.firebase || !firebase.database) return false;
  ofeDejarDeEscuchar_();
  FBOF.primed = false;
  FBOF.ref = firebase.database().ref('meta/ofertas_rev');
  FBOF.ref.on('value',
    () => { if (!FBOF.primed) { FBOF.primed = true; return; } ofeAgendarRefresco_(); },
    err => {
      console.warn('RT /meta/ofertas_rev no disponible, uso sondeo:', err && err.message || err);
      ofeDejarDeEscuchar_(); ofeIniciarSondeo_();
    });
  return true;
}
function ofeDejarDeEscuchar_() {
  if (FBOF.ref) { try { FBOF.ref.off(); } catch (e) {} FBOF.ref = null; }
  clearTimeout(FBOF.refrescoTimer); FBOF.refrescoTimer = null;
}
function ofeIniciarSondeo_() { ofeDetenerSondeo_(); FBOF.pollTimer = setInterval(ofeRefrescarVivo_, 12000); }
function ofeDetenerSondeo_() { if (FBOF.pollTimer) { clearInterval(FBOF.pollTimer); FBOF.pollTimer = null; } }

async function ofeLiveOn_() {
  try {
    if (typeof fbAsegurarSesion_ === 'function') await fbAsegurarSesion_();
    ofeDetenerSondeo_();
    if (!ofeEscuchar_()) ofeIniciarSondeo_();
  } catch (e) {
    console.warn('Ofertas en vivo sin Firebase, uso sondeo cada 12 s:', e && e.message || e);
    ofeIniciarSondeo_();
  }
}
function ofeLiveOff_() { ofeDejarDeEscuchar_(); ofeDetenerSondeo_(); }

/* ============================================================
   EVENTOS FIJOS
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  /* Los dos tiles de la vista Procesos. */
  document.querySelector('#proc-tile-ofertas')?.addEventListener('click', abrirOfertas_);
  document.querySelector('#proc-tile-ofertas-config')?.addEventListener('click', abrirOfertasConfig_);

  document.querySelector('#ofe-search')?.addEventListener('input', e => {
    OFE.filtroTexto = e.target.value; renderOfeCards_();
  });
  document.querySelector('#ofe-refresh')?.addEventListener('click', () => recargarOfertas_(false));
  document.querySelector('#ofe-nueva')?.addEventListener('click', () => abrirModalOferta_(null));

  document.querySelector('#ofe-modal-close')?.addEventListener('click', cerrarModalOferta_);
  document.querySelector('#ofe-cancel')?.addEventListener('click', cerrarModalOferta_);
  document.querySelector('#ofe-save')?.addEventListener('click', guardarOferta_);

  document.querySelector('#ofe-estado-close')?.addEventListener('click', cerrarModalEstadoOferta_);
  document.querySelector('#ofe-estado-cancel')?.addEventListener('click', cerrarModalEstadoOferta_);

  document.querySelectorAll('[data-ofe-fsheet-close]').forEach(b =>
    b.addEventListener('click', cerrarFsheetOfe_));

  document.querySelector('#ofecfg-save')?.addEventListener('click', guardarOfertasConfig_);

  /* Entrega 3 — modal de participantes. */
  document.querySelector('#ofe-part-close')?.addEventListener('click', cerrarParticipantes_);
  document.querySelector('#ofe-part-cerrar')?.addEventListener('click', cerrarParticipantes_);
});

/* Puerta para las pruebas automatizadas (igual que window.__sepNivel). */
window.__sepOfertas = {
  estado: OFE,
  cards: renderOfeCards_,
  cardHtml: ofeCardHtml_,
  filtros: renderOfeFiltros_,
  resumen: renderOfeResumen_,
  conteo: ofeConteoPorEstado_,
  filtradas: ofeFiltradas_,
  opcionesFiltro: ofeOpcionesFiltro_,
  pillHtml: ofePillHtml_,
  conteoPill: ofeConteoPill_,
  formHtml: ofeFormHtml_,
  campoHtml: ofeCampoHtml_,
  validar: ofeValidarFront_,
  acciones: ofeAcciones_,
  cuposHtml: ofeCuposHtml_,
  fechaTexto: ofeFechaTexto_,
  normalizar: ofeNormalizar_,
  config: OFECFG,
  pintarConfig: pintarOfertasConfig_,
  /* Entrega 3 */
  bucketCupos: ofeBucketCupos_,
  bucketCierre: ofeBucketCierre_,
  campoFiltro: ofeCampoFiltro_,
  partCabecera: ofePartCabecera_,
  partFilaHtml: ofePartFilaHtml_,
  partRender: renderParticipantes_,
  partBuscador: renderPartBuscador_,
  textoAviso: ofeTextoAviso_
};
