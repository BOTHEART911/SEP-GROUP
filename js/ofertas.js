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
  filtroEstado: '__ALL__',
  filtroSponsor: '__ALL__',
  filtroEstadoUsa: '__ALL__',
  filtroTexto: '',
  /* Oferta que se está creando o editando: { id, datos, cuposTotal } */
  edit: null,
  fsheetKey: null
};

const OFE_FILTROS = [
  { key: 'estado',    allLabel: 'Todos los estados',  titulo: 'Filtrar por estado',  ic: '🏷️', color: '#263143' },
  { key: 'sponsor',   allLabel: 'Todos los sponsors', titulo: 'Filtrar por sponsor', ic: '🤝', color: '#7c3aed' },
  { key: 'estadoUsa', allLabel: 'Todos los estados de EE. UU.', titulo: 'Filtrar por State', ic: '📍', color: '#0891b2' }
];

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
      OFE.filtroEstado = (OFE.filtroEstado === v) ? '__ALL__' : v;
      renderOfeFiltros_(); renderOfeCards_(); renderOfeResumen_();
    });
  });
}

/* ============================================================
   FILTROS
   ============================================================ */
function ofeValFiltro_(k) {
  if (k === 'estado')  return OFE.filtroEstado;
  if (k === 'sponsor') return OFE.filtroSponsor;
  return OFE.filtroEstadoUsa;
}
function ofeSetFiltro_(k, v) {
  if (k === 'estado')       OFE.filtroEstado = v;
  else if (k === 'sponsor') OFE.filtroSponsor = v;
  else                      OFE.filtroEstadoUsa = v;
}
function ofeCampoFiltro_(r, k) {
  if (k === 'estado')  return r.estado;
  if (k === 'sponsor') return r.sponsor || OFE_SIN_DATO;
  return r.estadoUsa || OFE_SIN_DATO;
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
  return `<div class="ofe-cupos">
    <div class="ofe-cupos__bar"><i style="width:${pct}%;background:${c.color};"></i></div>
    <div class="ofe-cupos__txt">
      <b style="color:${c.color};">${esc_(c.label)}</b>
      <span>${c.libres} libre(s) · ${c.ocupados}/${c.total} ocupados</span>
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
    b.addEventListener('click', () => Swal.fire({
      icon: 'info', title: 'Participantes',
      text: 'La lista de participantes, la entrevista y el resultado llegan en la Entrega 3.'
    })));
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
  const hint = c.hint ? `<div class="ofe-hint">${esc_(c.hint)}</div>` : '';
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
  const cupos = OFE.edit?.cuposTotal != null ? OFE.edit.cuposTotal : 1;
  const ocupados = OFE.edit?.ocupados || 0;

  const cabecera = `<div class="ofe-bloque ofe-bloque--fijo">
    <div class="ofe-bloque__cab"><span>🎟️</span><b>Cupos</b></div>
    <div class="ofe-bloque__body">
      <div class="ofe-campo">
        <label for="ofe-cupos">Cupos totales<span class="ofe-req">*</span></label>
        <input id="ofe-cupos" class="ofe-input" type="text" inputmode="numeric" value="${esc_(String(cupos))}" />
        <div class="ofe-hint">Ocupados hoy: <b>${ocupados}</b>. No se puede bajar por debajo de ese número.
        4 o más libres = Disponible · 1 a 3 = Pocos cupos · 0 = Sin cupos.</div>
      </div>
    </div>
  </div>`;

  const cuerpo = bloques.map((b, i) => {
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

  return cabecera + cuerpo;
}

async function abrirModalOferta_(id) {
  if (!OFE.catalogo) { await cargarOfertas_(); if (!OFE.catalogo) return; }
  try {
    if (id) {
      const o = await apiGet('verOferta', { usuarioId: currentUser.id, id });
      OFE.edit = { id: o.id, datos: o, cuposTotal: o.cupos.total, ocupados: o.cupos.ocupados };
      document.querySelector('#ofe-modal-title').textContent = 'Editar oferta';
      document.querySelector('#ofe-modal-sub').textContent =
        o.id + ' · ' + o.estadoLabel + (o.empleador ? ' · ' + o.empleador : '');
    } else {
      OFE.edit = { id: '', datos: {}, cuposTotal: 1, ocupados: 0 };
      document.querySelector('#ofe-modal-title').textContent = 'Nueva oferta';
      document.querySelector('#ofe-modal-sub').textContent = 'Nace en Borrador. Se publica desde el botón Estado.';
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
  const cu = document.querySelector('#ofe-cupos');
  if (cu) OFE.edit.cuposTotal = parseInt(String(cu.value).replace(/\D/g, ''), 10) || 0;
  return OFE.edit.datos;
}

/* Misma validación que el backend, con la misma definición. Lo que
   pasa aquí pasa allá; esto solo evita el viaje. */
function ofeValidarFront_(datos, cuposTotal) {
  const errores = [];
  const campos = OFE.catalogo?.campos || [];
  campos.forEach(c => {
    const v = String((datos || {})[c.id] || '').trim();
    if (c.req && !v) { errores.push({ id: c.id, label: c.label, motivo: 'Obligatorio' }); return; }
    if (!v) return;
    if ((c.tipo === 'numero' || c.tipo === 'decimal') && !/^\d+([.,]\d+)?$/.test(v)) {
      errores.push({ id: c.id, label: c.label, motivo: 'Debe ser un número' });
    }
    if (c.tipo === 'url' && !/^https?:\/\//i.test(v)) {
      errores.push({ id: c.id, label: c.label, motivo: 'Debe empezar por http:// o https://' });
    }
  });
  const f = k => (datos && datos[k]) ? new Date(datos[k] + 'T12:00:00') : null;
  const iMin = f('inicioMin'), iMax = f('inicioMax'), sMin = f('salidaMin'), sMax = f('salidaMax');
  if (iMin && iMax && iMin > iMax) errores.push({ id: 'inicioMax', label: 'Latest start date', motivo: 'Anterior a la más temprana' });
  if (sMin && sMax && sMin > sMax) errores.push({ id: 'salidaMax', label: 'Latest end date', motivo: 'Anterior a la más temprana' });
  if (iMin && sMax && iMin > sMax) errores.push({ id: 'salidaMax', label: 'Latest end date', motivo: 'Anterior al inicio' });
  if (!(parseInt(cuposTotal, 10) > 0)) errores.push({ id: 'cupos', label: 'Cupos totales', motivo: 'Debe ser 1 o más' });
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
  const errores = ofeValidarFront_(datos, OFE.edit.cuposTotal);
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
    await apiPost('guardarOferta', {
      usuarioId: currentUser.id,
      id: OFE.edit.id || '',
      cuposTotal: OFE.edit.cuposTotal,
      datos
    });
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
function ofeDestinos_(estadoActual) {
  const trans = (OFE.catalogo?.transiciones || {})[estadoActual] || [];
  const estados = OFE.catalogo?.estados || [];
  return trans
    .map(c => estados.find(e => e.clave === c))
    .filter(e => e && e.manual !== false);
}

function abrirModalEstadoOferta_(id) {
  const o = OFE.registros.find(x => x.id === id);
  if (!o) return;
  const destinos = ofeDestinos_(o.estado);
  const cuerpo = document.querySelector('#ofe-estado-body');
  document.querySelector('#ofe-estado-title').textContent = 'Estado de la oferta';
  document.querySelector('#ofe-estado-sub').textContent =
    o.id + ' · ' + (o.empleador || '') + ' · hoy está ' + o.estadoLabel;
  cuerpo.innerHTML = destinos.length
    ? destinos.map(e => `<button class="ofe-estado-op" data-ofe-dest="${e.clave}" style="--c:${e.color};">
         <span class="ofe-estado-op__ic">${e.ic}</span>
         <span><b>${esc_(e.label)}</b><i>${esc_(e.desc)}</i></span>
       </button>`).join('')
    : '<p class="muted">Desde este estado no hay cambios disponibles.</p>';
  cuerpo.querySelectorAll('[data-ofe-dest]').forEach(b => {
    b.addEventListener('click', () => cambiarEstadoOferta_(o.id, b.getAttribute('data-ofe-dest')));
  });
  document.querySelector('#modal-oferta-estado').classList.remove('hidden');
}
function cerrarModalEstadoOferta_() {
  document.querySelector('#modal-oferta-estado')?.classList.add('hidden');
}

async function cambiarEstadoOferta_(id, estado) {
  try {
    await apiPost('estadoOferta', { usuarioId: currentUser.id, id, estado });
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
        <label for="ofecfg-politicaCupo">Si la entrevista NO se aprueba</label>
        <select id="ofecfg-politicaCupo" class="ofe-input"${OFECFG.puedeEditar ? '' : ' disabled'}>${pol}</select>
        <div class="ofe-hint">Qué pasa con el cupo que tenía reservado. Lo aplica la Entrega 3.</div>
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
      ${ofeCfgCampo_('txtConfirmar', 'Modal de confirmación', c.txtConfirmar, '', 'textarea')}
      ${ofeCfgCampo_('txtSponsor', 'Advertencia del Sponsor', c.txtSponsor, '', 'textarea')}
      ${[1, 2, 3, 4, 5, 6].map(i => ofeCfgCampo_('txtBloqueo' + i, 'Motivo de bloqueo ' + i, c['txtBloqueo' + i], '', 'textarea')).join('')}
    </div>`;

  const btn = document.querySelector('#ofecfg-save');
  if (btn) btn.style.display = OFECFG.puedeEditar ? '' : 'none';
}

async function guardarOfertasConfig_() {
  if (!OFECFG.puedeEditar) return;
  const claves = ['plantillaPdf', 'carpetaFotos', 'programa', 'temporada', 'politicaCupo',
    'txtConfirmar', 'txtSponsor', 'txtBloqueo1', 'txtBloqueo2', 'txtBloqueo3',
    'txtBloqueo4', 'txtBloqueo5', 'txtBloqueo6', 'listaEstadosUsa', 'listaPosiciones'];
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
   EN VIVO (/meta/ofertas_rev)
   ============================================================ */
const FBOF = { ref: null, primed: false, pollTimer: null, refrescoTimer: null };

function ofeAgendarRefresco_() {
  clearTimeout(FBOF.refrescoTimer);
  FBOF.refrescoTimer = setTimeout(ofeRefrescarVivo_, 400);
}
function ofeRefrescarVivo_() {
  if (ofeModalAbierto_()) { ofeAgendarRefresco_(); return; }
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
  destinos: ofeDestinos_,
  cuposHtml: ofeCuposHtml_,
  fechaTexto: ofeFechaTexto_,
  normalizar: ofeNormalizar_,
  config: OFECFG,
  pintarConfig: pintarOfertasConfig_
};
