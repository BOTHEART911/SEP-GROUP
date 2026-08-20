/* ============================================================
 * SEP GROUP — VISTA NIVEL DE INGLÉS (Fase 3 SEP · Entrega 5 · 17/08/2026)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula
 * la garantía de funcionamiento.
 * ------------------------------------------------------------
 * Qué es: la pantalla donde se registra el resultado del SET (SEP
 * English Test). Vive dentro de "Procesos" y solo entran
 * SUPERUSUARIO y DESARROLLADOR.
 *
 * Cómo funciona, igual que la vista Contador para que no haya que
 * aprender nada nuevo:
 *   · Resumen tocable arriba (los 5 estados) que filtra al tocarlo.
 *   · Pastillas de filtro (Estado · Nivel) con hoja inferior.
 *   · Buscador por nombre, documento, WhatsApp, N° o correo.
 *   · Tarjetas con la foto del estudiante (mientras no exista, el
 *     avatar genérico que ya usa la app) y su estado.
 *   · Vista EN VIVO: escucha /meta/nivel_rev en Firebase y, si no
 *     hay Firebase, sondea cada 12 s.
 *
 * FASE 3.3 · TANDA B (20/08/2026) — PAGO DE LA OFERTA. La tarjeta
 * muestra quién ya pagó la oferta de empleo (y cuándo se le validó), y
 * hay una CUARTA pastilla de filtro para ver de una a los que pagaron
 * o a los que faltan. El dato no vive en esta hoja: lo escribe el
 * contador en su vista y el backend lo lee de CONTADOR, así que aquí
 * no hay nada que marcar ni que guardar.
 *
 * ENTREGA 5 (17/08/2026) — se encendió todo lo que hasta ayer se
 * pintaba apagado:
 *   · El check "Aprobado" crea la hoja de vida en PDF y le reenvía al
 *     estudiante el mensaje de las ofertas de empleo.
 *   · Desmarcarlo no desmarca: abre la reapertura de bloques, para
 *     devolverle al estudiante solo lo que hay que corregir.
 *   · "Ver formulario" abre su formulario completo en solo lectura y
 *     "Ver HV" abre la hoja de vida sin salir de la app.
 * Todo eso vive en js/nivel-perfil.js (el módulo NPERFIL), que se
 * carga JUSTO DESPUÉS de este archivo. Aquí solo se le llama, y
 * siempre comprobando que exista: si el archivo no cargó, la
 * pantalla del puntaje sigue funcionando igual.
 *
 * Usa de app.js: apiGet, apiPost, showView, esc_, currentUser,
 * driveImg_, USR_FOTO_FALLBACK.
 * ============================================================ */

const NIVE = {
  registros: [], catalogo: null, actual: null, sheetKey: null,
  filtroEstado: '__ALL__', filtroNivel: '__ALL__',
  /* AJUSTE 3 (19/08/2026) */
  filtroInvitacion: '__ALL__',
  /* FASE 3.3 · tanda B (20/08/2026) — pago de la oferta de empleo. */
  filtroOferta: '__ALL__',
  filtroTexto: '', cargado: false
};

const NIVE_SIN_NIVEL = '— Sin puntaje —';

const NIVE_FILTROS = [
  { key: 'estado', allLabel: 'Todos los resultados', titulo: 'Filtrar por resultado', ic: '🏷️', color: '#263143' },
  { key: 'nivel',  allLabel: 'Todos los niveles',    titulo: 'Filtrar por nivel',     ic: '🗣️', color: '#0891b2' },
  /* AJUSTE 3 (19/08/2026) — pastilla propia de la invitación. */
  { key: 'invitacion', allLabel: 'Todas las invitaciones', titulo: 'Filtrar por invitación', ic: '✉️', color: '#7c3aed' },
  /* FASE 3.3 · tanda B (20/08/2026) — cuarta pastilla: quién pagó ya la
     oferta de empleo. El dato viene de la vista Contador (check "Pago
     oferta OK" + su comprobante), no de esta hoja. */
  { key: 'oferta', allLabel: 'Todos los pagos', titulo: 'Filtrar por pago de la oferta', ic: '💵', color: '#0f766e' }
];

/* AJUSTE 3 — valores del filtro de invitación. */
const NIVE_INV = {
  SI: { valor: 'SI', label: 'Con invitación', ic: '✉️', color: '#7c3aed' },
  NO: { valor: 'NO', label: 'Sin invitación', ic: '📭', color: '#94a3b8' }
};

/* FASE 3.3 · tanda B — valores del filtro del pago de la oferta.
   "Pagada" es la pareja completa: el check Y el comprobante. Es la
   misma regla que le abre el formulario al estudiante, así que la
   pastilla dice exactamente quién ya puede llenarlo. */
const NIVE_OFE = {
  SI: { valor: 'SI', label: 'Oferta pagada',  ic: '💵', color: '#0f766e' },
  NO: { valor: 'NO', label: 'Sin pago de oferta', ic: '⏳', color: '#94a3b8' }
};

/* ============================================================
   ENTRADA
   ============================================================ */
/* FASE 3.1 — la puerta mira TODOS los roles del usuario, no solo el
   principal. Hasta hoy comparaba únicamente currentUser.rol, así que
   el rol PROCESOS (creado en la Entrega 1 de esta fase) llegaba al
   tile de Procesos y aquí se estrellaba, y un COMERCIAL+PROCESOS
   tampoco entraba. El backend ya los deja pasar (requireNivel_). */
function niveMisRoles_() {
  if (typeof misRoles_ === 'function') return misRoles_(currentUser) || [];
  const u = currentUser || {};
  const lista = (Array.isArray(u.roles) && u.roles.length) ? u.roles : [u.rol];
  return lista.map(r => String(r || '').toUpperCase()).filter(Boolean);
}
function nivePuedeEntrar_() {
  const mios = niveMisRoles_();
  return ['DESARROLLADOR', 'SUPERUSUARIO', 'PROCESOS'].some(r => mios.indexOf(r) >= 0);
}

async function abrirNivel_() {
  if (!nivePuedeEntrar_()) {
    Swal.fire({ icon: 'warning', title: 'Sin permiso', text: 'Solo SUPERUSUARIO o DESARROLLADOR entran a Nivel de Inglés.' });
    return;
  }
  showView('nivel');
  if (!NIVE.cargado) await cargarNivel_();
  else { renderNiveFiltros_(); renderNiveCards_(); recargarNivel_(true); }
}

async function cargarNivel_() {
  try {
    const d = await apiGet('nivelInit', { usuarioId: currentUser.id });
    NIVE.catalogo  = d.catalogo;
    NIVE.registros = d.registros || [];
    NIVE.cargado   = true;
    renderNiveFiltros_(); renderNiveCards_(); renderNiveResumen_();
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: String(e.message || e) });
  }
}

async function recargarNivel_(silencioso) {
  try {
    NIVE.registros = await apiGet('listNivel', { usuarioId: currentUser.id }, { silent: !!silencioso });
    renderNiveFiltros_(); renderNiveCards_(); renderNiveResumen_();
  } catch (e) {
    if (!silencioso) Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: String(e.message || e) });
  }
}

/* ============================================================
   FILTROS EN CASCADA (mismo motor que el Contador)
   ============================================================ */
function niveNivelDe_(r) { return String(r.nivel || '').trim() || NIVE_SIN_NIVEL; }

function niveValFiltro_(k) {
  if (k === 'estado') return NIVE.filtroEstado;
  if (k === 'nivel')  return NIVE.filtroNivel;
  if (k === 'oferta') return NIVE.filtroOferta;   // FASE 3.3 · tanda B
  return NIVE.filtroInvitacion;   // AJUSTE 3
}
function niveSetFiltro_(k, v) {
  /* Cada pastilla reinicia las que van después, igual que ya hacía
     la de resultado con la de nivel: los conteos de la derecha se
     calculan sobre lo que dejó la de la izquierda. */
  if (k === 'estado') {
    NIVE.filtroEstado = v; NIVE.filtroNivel = '__ALL__';
    NIVE.filtroInvitacion = '__ALL__'; NIVE.filtroOferta = '__ALL__';
  } else if (k === 'nivel') {
    NIVE.filtroNivel = v; NIVE.filtroInvitacion = '__ALL__'; NIVE.filtroOferta = '__ALL__';
  } else if (k === 'invitacion') {
    NIVE.filtroInvitacion = v; NIVE.filtroOferta = '__ALL__';
  } else NIVE.filtroOferta = v;
}
function niveBaseEstado_() {
  if (NIVE.filtroEstado === '__ALL__') return NIVE.registros;
  return NIVE.registros.filter(r => r.estado === NIVE.filtroEstado);
}
function niveBaseNivel_() {
  const b = niveBaseEstado_();
  if (NIVE.filtroNivel === '__ALL__') return b;
  return b.filter(r => niveNivelDe_(r) === NIVE.filtroNivel);
}
/* AJUSTE 3 — última capa: con / sin invitación. */
function niveInvDe_(r) { return r && r.invitacion ? 'SI' : 'NO'; }
function niveBaseInvitacion_() {
  const b = niveBaseNivel_();
  if (NIVE.filtroInvitacion === '__ALL__') return b;
  return b.filter(r => niveInvDe_(r) === NIVE.filtroInvitacion);
}
/* FASE 3.3 · tanda B — última capa: pagó / no pagó la oferta. */
function niveOfeDe_(r) { return r && r.pagoOferta ? 'SI' : 'NO'; }
function niveBaseOferta_() {
  const b = niveBaseInvitacion_();
  if (NIVE.filtroOferta === '__ALL__') return b;
  return b.filter(r => niveOfeDe_(r) === NIVE.filtroOferta);
}
function niveEstadoDef_(clave) {
  return (NIVE.catalogo?.estados || []).find(e => e.clave === clave) ||
         { clave: clave, label: clave, color: '#6b7280', ic: '•' };
}

function niveOpciones_(key) {
  const c = {};
  if (key === 'invitacion') {
    /* AJUSTE 3 — siempre se muestran las dos, aunque una vaya en 0:
       así se ve de un vistazo cuántos faltan por invitar. */
    niveBaseNivel_().forEach(r => { const k = niveInvDe_(r); c[k] = (c[k] || 0) + 1; });
    return ['SI', 'NO'].map(k => ({
      valor: k, label: NIVE_INV[k].label, count: c[k] || 0, ic: NIVE_INV[k].ic
    }));
  }
  if (key === 'oferta') {
    /* FASE 3.3 · tanda B — igual que la de invitación: las dos siempre
       a la vista, aunque una vaya en cero. */
    niveBaseInvitacion_().forEach(r => { const k = niveOfeDe_(r); c[k] = (c[k] || 0) + 1; });
    return ['SI', 'NO'].map(k => ({
      valor: k, label: NIVE_OFE[k].label, count: c[k] || 0, ic: NIVE_OFE[k].ic
    }));
  }
  if (key === 'estado') {
    NIVE.registros.forEach(r => { c[r.estado] = (c[r.estado] || 0) + 1; });
    return (NIVE.catalogo?.estados || []).filter(e => c[e.clave])
      .map(e => ({ valor: e.clave, label: e.label, count: c[e.clave], color: e.color }));
  }
  niveBaseEstado_().forEach(r => { const k = niveNivelDe_(r); c[k] = (c[k] || 0) + 1; });
  /* Los niveles se listan en el orden de la escala (de menor a mayor
     puntaje), no alfabético: así se leen como una regla. */
  const orden = (NIVE.catalogo?.escala || []).map(e => e.nivel);
  return Object.keys(c).sort((a, b) => {
    const ia = orden.indexOf(a), ib = orden.indexOf(b);
    if (ia < 0 && ib < 0) return a.localeCompare(b);
    if (ia < 0) return 1;
    if (ib < 0) return -1;
    return ia - ib;
  }).map(k => ({ valor: k, label: k, count: c[k], ic: '🗣️' }));
}
function niveTotalFiltro_(k) {
  if (k === 'estado') return NIVE.registros.length;
  if (k === 'nivel')  return niveBaseEstado_().length;
  if (k === 'oferta') return niveBaseInvitacion_().length;   // FASE 3.3 · tanda B
  return niveBaseNivel_().length;                       // AJUSTE 3
}
function niveConteoPill_(k) {
  if (k === 'estado') return niveBaseEstado_().length;
  if (k === 'nivel')  return niveBaseNivel_().length;
  if (k === 'oferta') return niveBaseOferta_().length;       // FASE 3.3 · tanda B
  return niveBaseInvitacion_().length;                  // AJUSTE 3
}

function renderNiveFiltros_() {
  const cont = document.querySelector('#nive-filters'); if (!cont) return;
  cont.innerHTML = NIVE_FILTROS.map(nivePillHtml_).join('');
  NIVE_FILTROS.forEach(f =>
    document.querySelector('#nfp-' + f.key)?.addEventListener('click', () => abrirNiveSheet_(f.key)));
}
function nivePillHtml_(f) {
  const val = niveValFiltro_(f.key);
  const on = val !== '__ALL__';
  let label = f.allLabel, color = f.color, ic = `<span class="fpill__ic">${f.ic}</span>`;
  if (on) {
    if (f.key === 'estado') {
      const e = niveEstadoDef_(val); label = e.label; color = e.color;
      ic = `<span class="fpill__dot"></span>`;
    } else if (f.key === 'invitacion') {                 // AJUSTE 3
      const d = NIVE_INV[val] || NIVE_INV.NO;
      label = d.label; color = d.color;
      ic = `<span class="fpill__ic">${d.ic}</span>`;
    } else if (f.key === 'oferta') {                     // FASE 3.3 · tanda B
      const d = NIVE_OFE[val] || NIVE_OFE.NO;
      label = d.label; color = d.color;
      ic = `<span class="fpill__ic">${d.ic}</span>`;
    } else label = val;
  }
  return `<button class="fpill ${on ? 'is-on' : ''}" id="nfp-${f.key}" style="--fp:${color}"
      title="${esc_(on ? val : f.allLabel)}" aria-haspopup="dialog">
    ${ic}<span class="fpill__label">${esc_(label)}</span>
    <span class="fpill__count">${niveConteoPill_(f.key)}</span>
    <svg class="fpill__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
  </button>`;
}

function abrirNiveSheet_(key) {
  const f = NIVE_FILTROS.find(x => x.key === key); if (!f) return;
  const sheet = document.querySelector('#nive-fsheet'), lista = document.querySelector('#nive-fsheet-list');
  if (!sheet || !lista) return;
  NIVE.sheetKey = key;
  document.querySelector('#nive-fsheet-title').textContent = f.titulo;

  const actual = niveValFiltro_(key);
  let html = niveOptHtml_({ valor: '__ALL__', label: f.allLabel, count: niveTotalFiltro_(key), ic: f.ic }, actual === '__ALL__', true);
  niveOpciones_(key).forEach(o => { html += niveOptHtml_(o, actual === o.valor, false); });
  lista.innerHTML = html; lista.scrollTop = 0;

  lista.querySelectorAll('.fopt').forEach(b => b.addEventListener('click', () => {
    niveSetFiltro_(key, b.dataset.valor);
    cerrarNiveSheet_(); renderNiveFiltros_(); renderNiveCards_();
  }));
  sheet.classList.remove('hidden'); sheet.setAttribute('aria-hidden', 'false');
}
function niveOptHtml_(o, sel, esAll) {
  const ic = o.color ? `<span class="fopt__dot" style="background:${o.color}"></span>`
                     : `<span class="fopt__ic">${o.ic || '•'}</span>`;
  return `<button class="fopt ${sel ? 'is-sel' : ''} ${esAll ? 'is-all' : ''}" data-valor="${esc_(o.valor)}">
    ${ic}<span class="fopt__label">${esc_(o.label)}</span>
    <span class="fopt__count">${o.count}</span><span class="fopt__check">✓</span></button>`;
}
function cerrarNiveSheet_() {
  const s = document.querySelector('#nive-fsheet'); if (!s) return;
  s.classList.add('hidden'); s.setAttribute('aria-hidden', 'true'); NIVE.sheetKey = null;
}
document.addEventListener('click', e => { if (e.target.closest('[data-nive-fsheet-close]')) cerrarNiveSheet_(); });

/* ============================================================
   RESUMEN SUPERIOR — los 5 estados, tocables
   ============================================================ */
function renderNiveResumen_() {
  const cont = document.querySelector('#nive-resumen'); if (!cont) return;
  const estados = NIVE.catalogo?.estados || [];
  const c = {};
  NIVE.registros.forEach(r => { c[r.estado] = (c[r.estado] || 0) + 1; });

  let html = estados.map(e => `<button class="conta-kpi" data-estado="${e.clave}" style="--k:${e.color}">
      <span class="conta-kpi__n">${c[e.clave] || 0}</span>
      <span class="conta-kpi__t">${e.ic} ${esc_(e.label)}</span></button>`).join('');

  /* Promedio del grupo: solo entre los que ya tienen puntaje. */
  const conP = NIVE.registros.filter(r => r.puntaje !== '' && r.puntaje !== null && r.puntaje !== undefined);
  if (conP.length) {
    const prom = conP.reduce((s, r) => s + Number(r.puntaje), 0) / conP.length;
    html += `<div class="conta-kpi" style="--k:#7c3aed">
      <span class="conta-kpi__n">${prom.toFixed(2)}</span>
      <span class="conta-kpi__t">📊 Puntaje promedio</span></div>`;
  }
  cont.innerHTML = html;

  cont.querySelectorAll('[data-estado]').forEach(b => b.addEventListener('click', () => {
    niveSetFiltro_('estado', NIVE.filtroEstado === b.dataset.estado ? '__ALL__' : b.dataset.estado);
    renderNiveFiltros_(); renderNiveCards_();
  }));
}

/* ============================================================
   TARJETAS
   ============================================================ */
function niveNormBusq_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function nivePuntajeTexto_(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v); if (isNaN(n)) return '';
  return n.toFixed(2);
}
/* Foto del estudiante. Mientras la Entrega 4 no la suba, avatar
   genérico (lo pidió así el usuario: genérico, no iniciales). */
function niveFoto_(r) {
  const u = String(r.fotoUrl || '').trim();
  if (!u) return USR_FOTO_FALLBACK;
  return (typeof driveImg_ === 'function') ? driveImg_(u) : u;
}

function renderNiveCards_() {
  const cont = document.querySelector('#nive-cards'), vacio = document.querySelector('#nive-empty');
  if (!cont) return;
  const txt = niveNormBusq_(NIVE.filtroTexto.trim());
  let list = niveBaseOferta_().slice().sort((a, b) => b.n - a.n);
  if (txt) list = list.filter(r =>
    niveNormBusq_(r.nombres + ' ' + r.apellidos).includes(txt) ||
    String(r.documento || '').includes(txt) ||
    String(r.whatsapp || '').includes(txt) ||
    String(r.n).includes(txt) ||
    niveNormBusq_(r.correo).includes(txt));

  vacio?.classList.toggle('hidden', list.length > 0);
  cont.innerHTML = list.map(niveCardHtml_).join('');
  list.forEach((r, i) => {
    const card = document.querySelector('#nive-card-i' + i); if (!card) return;
    card.querySelector('[data-act="abrir"]')?.addEventListener('click', () => abrirModalNivel_(r));
    card.querySelector('[data-act="foto"]')?.addEventListener('click', () => abrirFotoNivel_(r));
    card.querySelector('[data-act="formulario"]')?.addEventListener('click', () => niveVerFormulario_(r));
    card.querySelector('[data-act="hv"]')?.addEventListener('click', () => niveVerHv_(r));
    card.querySelector('[data-act="documento"]')?.addEventListener('click', () => niveVerDocumento_(r));
    /* AJUSTE 3 y 4 (19/08/2026) */
    card.querySelector('[data-act="invitacion"]')?.addEventListener('click', () => niveInvitacion_(r));
    card.querySelector('[data-act="eliminar"]')?.addEventListener('click', () => niveEliminar_(r));
  });
}

/* ENTREGA 5 — puentes hacia NPERFIL (js/nivel-perfil.js). Se
   comprueba que el módulo exista para que un archivo que no cargó no
   deje la pantalla sin explicación. */
function niveHayPerfil_() { return (typeof NPERFIL !== 'undefined') && !!NPERFIL; }
function niveSinModulo_() {
  Swal.fire({
    icon: 'error', title: 'Falta una parte de la app',
    html: 'No se cargó <b>js/nivel-perfil.js</b>. Recarga la pantalla; si sigue igual, avísale al desarrollador.'
  });
}
function niveVerFormulario_(r) { niveHayPerfil_() ? NPERFIL.abrirFormulario(r) : niveSinModulo_(); }
function niveVerHv_(r)         { niveHayPerfil_() ? NPERFIL.verHv(r)         : niveSinModulo_(); }
/* FASE 3.1 · ajuste 7 — la copia del documento de identidad. */
function niveVerDocumento_(r)  { niveHayPerfil_() ? NPERFIL.verDocumento(r)  : niveSinModulo_(); }
function niveAprobarPerfil_(r) { niveHayPerfil_() ? NPERFIL.aprobar(r)       : niveSinModulo_(); }
function niveRegenerarHv_(r)   { niveHayPerfil_() ? NPERFIL.regenerar(r)     : niveSinModulo_(); }

/* EDAD a partir de la fecha de nacimiento (AJUSTE 16/08/2026).
   Aquí la fecha llega como TEXTO dd/mm/yyyy —así queda guardada en
   NIVEL_INGLES—, no como ISO, así que hay que partirla a mano. Misma
   cuenta que contaEdad_ de la vista Contador: se compara el día de hoy
   con el cumpleaños. */
function niveEdad_(dmy) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dmy || '').trim());
  if (!m) return '';
  const d = +m[1], mes = +m[2], a = +m[3];
  const f = new Date(a, mes - 1, d);
  if (f.getFullYear() !== a || f.getMonth() !== mes - 1 || f.getDate() !== d) return '';
  const hoy = new Date();
  let edad = hoy.getFullYear() - a;
  if (hoy.getMonth() < mes - 1 || (hoy.getMonth() === mes - 1 && hoy.getDate() < d)) edad--;
  return (edad >= 0 && edad < 120) ? edad : '';
}

function niveCardHtml_(r, i) {
  const p = nivePuntajeTexto_(r.puntaje);
  /* AJUSTE 3 (19/08/2026) — la tarjeta invitada va encerrada en su
     color propio (morado), sin tocar la franja del resultado. */
  return `<div class="com-card nive-card${r.invitacion ? ' nive-card--inv' : ''}" id="nive-card-i${i}" data-n="${r.n}">
    <div class="com-card__stripe" style="background:${r.estadoColor}"></div>
    <div class="nive-card__top">
      <button type="button" class="nive-foto" data-act="foto" title="Ver la foto en grande">
        <img src="${esc_(niveFoto_(r))}" alt="Foto de ${esc_(r.nombres)}" loading="lazy"
             onerror="this.onerror=null;this.src='${USR_FOTO_FALLBACK}';" />
      </button>
      <div class="com-card__head">
        <h3 class="com-card__name">${esc_(r.nombres)} ${esc_(r.apellidos)}</h3>
        ${r.correo ? `<div class="com-card__email">📧 ${esc_(r.correo)}</div>` : ''}
        <div class="com-card__meta">
          ${r.documento ? `<span>🆔 ${esc_(r.documento)}</span>` : ''}
          <span>📱 ${esc_(r.whatsapp)}</span>
          ${r.nacimiento ? `<span>🎂 ${esc_(r.nacimiento)}${niveEdad_(r.nacimiento) !== '' ? ' · ' + niveEdad_(r.nacimiento) + ' años' : ''}</span>` : ''}
        </div>
      </div>
      <div class="com-card__tag">
        <span class="com-badge" style="background:${r.estadoColor}">${r.estadoIc} ${esc_(r.estadoLabel)}</span>
        <span class="com-card__id">N° ${r.n}</span>
      </div>
    </div>

    <div class="nive-res">
      ${p ? `<span class="nive-res__p">📊 <b>${p}</b><small>/9</small></span>
             <span class="nive-res__n">🗣️ ${esc_(r.nivel)}</span>
             ${r.nivelHv ? `<span class="nive-res__hv">🆔 ${esc_(r.nivelHv)}</span>`
                         : `<span class="nive-res__hv falta" title="Se elige al guardar el Puntaje SEA. Es el nivel que sale impreso en la hoja de vida.">🆔 sin nivel de HV</span>`}
             ${r.envios > 1 ? `<span class="nive-res__re">🔁 ${r.envios} envíos</span>` : ''}
             ${r.fechaPuntaje ? `<span class="nive-res__f">🕒 ${esc_(r.fechaPuntaje)}</span>` : ''}`
          : `<span class="nive-res__vacio">Sin Puntaje SEA registrado</span>`}
      ${niveFlagHtml_(r)}
      ${niveInvHtml_(r)}
      ${niveOfertaHtml_(r)}
      <span class="nive-res__form">📝 Formulario: ${esc_(r.formularioEstado)}</span>
    </div>

    <div class="com-card__actions">
      <button class="act-btn act-editar" data-act="abrir">📊 Puntaje SEA</button>
      <button class="act-btn" data-act="formulario">📝 Ver formulario</button>
      <button class="act-btn" data-act="documento" ${r.documentoUrl ? '' : 'disabled title="No tiene la copia del documento de identidad en su ficha."'}>📄 Documento</button>
      <button class="act-btn" data-act="hv" ${r.hvUrl ? '' : 'disabled title="Todavía no tiene hoja de vida: se crea al marcar Aprobado."'}>🆔 Ver HV</button>
      <button class="act-btn${r.invitacion ? ' act-btn--inv-on' : ''}" data-act="invitacion"
        title="${r.invitacion ? 'Quitar la marca de invitación' : 'Marcar como invitado'}">✉️ ${r.invitacion ? 'Invitado' : 'Invitación'}</button>
      ${nivePuedePurgar_() ? '<button class="act-btn act-btn--rojo" data-act="eliminar">🗑️ Eliminar</button>' : ''}
    </div>
  </div>`;
}

/* AJUSTE 3 — sello de la invitación dentro de la franja de resultado:
   quién la marcó y cuándo, sin abrir la tarjeta. */
function niveInvHtml_(r) {
  if (!r || !r.invitacion) return '';
  const quien = String(r.invitacionPor || '').trim();
  const cuando = String(r.invitacionFecha || '').trim();
  const detalle = (quien ? quien : 'Marcada') + (cuando ? ' · ' + cuando : '');
  return `<span class="nive-flag inv" title="Invitación marcada por ${esc_(detalle)}">✉️ Invitación · ${esc_(detalle)}</span>`;
}

/* FASE 3.3 · tanda B (20/08/2026) — el pago de la OFERTA DE EMPLEO,
   dentro de la misma franja de resultado. El dato lo pone el contador
   en su vista y aquí solo se muestra:
     · verde  → check "Pago oferta OK" Y comprobante: ya pagó y el
                formulario se le abrió;
     · ámbar  → solo el check, sin comprobante: NO pasa la puerta del
                formulario. Sin este aviso, la tarjeta diría "sin pago"
                y nadie sabría que lo que falta es subir el soporte.
   Sin nada de eso, no se pinta: la tarjeta queda como siempre. */
function niveOfertaHtml_(r) {
  if (!r) return '';
  if (r.pagoOferta) {
    const cuando = String(r.pagoOfertaFecha || '').trim();
    return `<span class="nive-flag pago" title="Pago de la oferta de empleo validado en la vista Contador${cuando ? ' el ' + esc_(cuando) : ''}. Ya tiene abierto el formulario.">💵 Oferta pagada${cuando ? ' · ' + esc_(cuando) : ''}</span>`;
  }
  if (r.pagoOfertaCheck && !r.pagoOfertaComprobante) {
    return `<span class="nive-flag pagofalta" title="En la vista Contador está marcado el check del pago de la oferta, pero falta subir el comprobante. Mientras falte, el estudiante NO puede entrar al formulario.">💵 Oferta sin comprobante</span>`;
  }
  return '';
}

/* ENTREGA 5 — marca del perfil dentro de la franja de resultado.
   Son dos avisos que el ADMIN tiene que ver sin abrir la tarjeta:
   a quién le reabrieron bloques y quién ya los corrigió y está
   esperando que le vuelvan a marcar Aprobado. */
function niveFlagHtml_(r) {
  const e = String(r && r.estadoPerfil || '').toUpperCase();
  if (e === 'REABIERTO') {
    return `<span class="nive-flag reab" title="${esc_(r.motivoReapertura || 'Bloques devueltos al estudiante para corregir')}">↩️ Bloques reabiertos</span>`;
  }
  if (e === 'CORREGIDO') {
    /* Si nunca llegó a tener hoja de vida, no hay nada que "re-aprobar":
       lo que falta es revisarlo (FASE 3.1 · ajuste 9, ahora se pueden
       reabrir bloques de un perfil que todavía no está aprobado). */
    return r.hvUrl
      ? `<span class="nive-flag corr" title="El estudiante ya corrigió: falta volver a marcar Aprobado.">✅ Corregido · falta reaprobar</span>`
      : `<span class="nive-flag corr" title="El estudiante ya corrigió lo que se le devolvió: falta revisarlo.">✅ Corregido · pendiente de revisión</span>`;
  }
  return '';
}

/* ============================================================
   AJUSTE 3 (19/08/2026) — INTERRUPTOR "INVITACIÓN"
   ============================================================
   Marca o desmarca la tarjeta. No manda ningún mensaje: solo deja
   escrito quién la marcó y cuándo. Lo pueden usar los mismos que
   entran a la vista (PROCESOS, SUPERUSUARIO y DESARROLLADOR), así
   que el botón no se esconde a nadie que ya esté aquí. */
async function niveInvitacion_(r) {
  const marcar = !r.invitacion;
  try {
    const out = await apiPost('nivelInvitacion', {
      usuarioId: currentUser.id, n: r.n, documento: r.documento, marcar: marcar
    });
    /* Se actualiza en memoria y se repinta: no hace falta ir por toda
       la lista otra vez. */
    if (out && out.registro) {
      const i = NIVE.registros.findIndex(x => x.n === r.n);
      if (i >= 0) NIVE.registros[i] = out.registro;
    } else {
      r.invitacion = marcar;
    }
    renderNiveFiltros_(); renderNiveResumen_(); renderNiveCards_();
    Swal.fire({ icon: 'success', title: marcar ? 'Invitación marcada' : 'Invitación quitada',
      timer: 1100, showConfirmButton: false });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo cambiar la invitación', text: String(e.message || e) });
  }
}

/* ============================================================
   AJUSTE 4 (19/08/2026) — ELIMINAR CON PURGA
   ============================================================
   Borra la fila de NIVEL_INGLES, la de FORMULARIO_SUMMER y los
   archivos de las dos (foto, hoja de vida, documento, pasaporte,
   certificados, antecedentes), de forma DEFINITIVA. No toca
   CONTADOR ni COMERCIAL: el estudiante sigue en el embudo.
   Se confirma escribiendo el DOCUMENTO del estudiante. */
function nivePuedePurgar_() {
  if (!currentUser) return false;
  if (currentUser.puedePurgar) return true;
  /* Respaldo por si el usuario tiene la sesión vieja en el navegador
     (sin el campo nuevo): se mira por rol. */
  const roles = niveMisRoles_();
  return ['DESARROLLADOR', 'SUPERUSUARIO', 'PROCESOS'].some(x => roles.indexOf(x) >= 0);
}

async function niveEliminar_(r) {
  if (!nivePuedePurgar_()) return;
  const doc = String(r.documento || '').trim();
  if (!doc) {
    Swal.fire({ icon: 'warning', title: 'Sin documento',
      html: 'Esta ficha no tiene número de documento, que es lo que se pide para confirmar el borrado.<br>' +
            'Digítalo primero en la vista Contador.' });
    return;
  }
  const avisos = [];
  if (r.hvUrl) avisos.push('ya tiene <b>hoja de vida generada</b>');
  if (r.aprobado) avisos.push('está <b>aprobado</b>');

  const res = await Swal.fire({
    icon: 'warning', title: 'Eliminar definitivamente',
    html: `Se borra a <b>${esc_(r.nombres + ' ' + r.apellidos)}</b> de <b>NIVEL DE INGLÉS</b>, ` +
          `su fila del <b>formulario</b> y <b>todos sus archivos</b> (foto, hoja de vida, documento, ` +
          `pasaporte, certificados y antecedentes).<br><br>` +
          (avisos.length ? `<small>⚠️ Ojo: este estudiante ${avisos.join(' y ')}.</small><br><br>` : '') +
          `<small>Los archivos <b>no van a la papelera</b>: se borran para siempre. ` +
          `El estudiante sigue en <b>Contador</b> y en <b>Comercial</b>.<br>` +
          `Escribe el documento <b>${esc_(doc)}</b> para confirmar.</small>`,
    input: 'text', inputPlaceholder: 'Documento del estudiante',
    showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc2626', focusCancel: true,
    inputValidator: v => (String(v || '').replace(/[\s.]/g, '') === doc.replace(/[\s.]/g, '')
      ? undefined : 'Escribe el documento ' + doc)
  });
  if (!res.isConfirmed) return;

  try {
    Swal.fire({ title: 'Eliminando…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const out = await apiPost('purgarNivel', {
      usuarioId: currentUser.id, n: r.n, documento: r.documento, confirmar: res.value
    });
    await recargarNivel_(true);
    const fallidos = (out.archivos && out.archivos.fallidos) ? out.archivos.fallidos.length : 0;
    Swal.fire({
      icon: fallidos ? 'warning' : 'success', title: 'Estudiante eliminado',
      html: `Se borró su fila${out.filas.formulario ? ', la de su formulario' : ''} y ` +
            `${out.archivos.borrados} archivo(s) de Drive.` +
            (fallidos ? `<br><small>${fallidos} archivo(s) no se pudieron borrar de Drive.</small>` : '')
    });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: String(e.message || e) });
  }
}

/* ============================================================
   FOTO CON ZOOM
   ============================================================
   Rueda del ratón, pellizco en móvil, botones y arrastre. Mientras
   no haya foto real se ve el avatar genérico (y el zoom funciona
   igual, así el día que llegue la foto no hay que tocar nada). */
const NIVEZ = { escala: 1, x: 0, y: 0, arrastra: false, x0: 0, y0: 0, d0: 0 };

function abrirFotoNivel_(r) {
  const ov = document.querySelector('#nive-foto-modal'); if (!ov) return;
  document.querySelector('#nive-foto-title').textContent =
    (r.nombres + ' ' + r.apellidos).trim() + ' · N° ' + r.n;
  const img = document.querySelector('#nive-foto-img');
  img.onerror = function () { this.onerror = null; this.src = USR_FOTO_FALLBACK; };
  img.src = niveFoto_(r);
  document.querySelector('#nive-foto-nota').innerHTML = String(r.fotoUrl || '').trim()
    ? ''
    : 'Todavía no hay foto: el estudiante la sube en el <b>Bloque 14</b> de su formulario y aparece aquí en el acto.';
  niveZoomReset_();
  ov.classList.remove('hidden');
}
function cerrarFotoNivel_() {
  document.querySelector('#nive-foto-modal')?.classList.add('hidden');
  const img = document.querySelector('#nive-foto-img'); if (img) img.src = '';
}
function niveZoomAplicar_() {
  const img = document.querySelector('#nive-foto-img'); if (!img) return;
  img.style.transform = `translate(${NIVEZ.x}px, ${NIVEZ.y}px) scale(${NIVEZ.escala})`;
  const et = document.querySelector('#nive-zoom-nivel');
  if (et) et.textContent = Math.round(NIVEZ.escala * 100) + ' %';
}
function niveZoom_(delta) {
  NIVEZ.escala = Math.min(6, Math.max(1, Math.round((NIVEZ.escala + delta) * 100) / 100));
  if (NIVEZ.escala === 1) { NIVEZ.x = 0; NIVEZ.y = 0; }
  niveZoomAplicar_();
}
function niveZoomReset_() { NIVEZ.escala = 1; NIVEZ.x = 0; NIVEZ.y = 0; niveZoomAplicar_(); }

/* ============================================================
   MODAL DEL PUNTAJE SEA
   ============================================================ */
/* Puntaje escrito → número con DOS decimales, exactamente como lo hace
   nivPuntaje_ en el backend. Sin este redondeo, un 4.499 se clasificaba
   aquí como "Limitado · No aceptado" y el servidor lo guardaba como
   4.50 "Básico · Aceptado con condición": la confirmación mostraría un
   resultado y al estudiante le llegaría otro. */
/* FASE 3.1 · ajuste 5 — las 4 opciones del "Nivel de Inglés HV".
   Vienen del backend (catálogo de nivelInit); el respaldo local es
   para que la pantalla no se quede sin lista si el backend todavía
   no está publicado. */
const NIVE_HV_RESPALDO = ['PRE-INTERMEDIATE', 'INTERMEDIATE', 'UPPER-INTERMEDIATE', 'ADVANCED'];
function niveOpcionesHv_() {
  const lista = NIVE.catalogo && NIVE.catalogo.nivelesHv;
  return (Array.isArray(lista) && lista.length) ? lista : NIVE_HV_RESPALDO;
}

function nivePuntajeNum_(v) {
  if (v === '' || v === null || v === undefined) return '';
  const s = String(v).replace(',', '.').replace(/[^\d.\-]/g, '').trim();
  if (!/\d/.test(s)) return '';
  const n = Number(s);
  if (!isFinite(n)) return '';
  return Math.round(n * 100) / 100;
}

function niveNivelDePuntaje_(p) {
  const esc = NIVE.catalogo?.escala || [];
  const n = nivePuntajeNum_(p);
  if (n === '') return null;
  if (n < 0 || n > 9) return null;
  for (let i = 0; i < esc.length; i++) {
    const e = esc[i];
    const dentro = (i === esc.length - 1) ? (n >= e.min && n <= 9) : (n >= e.min && n < e.max);
    if (dentro) return e;
  }
  const previos = esc.filter(e => n >= e.min).sort((a, b) => b.min - a.min);
  return previos.length ? previos[0] : null;
}
function niveGrupoLabel_(grupo) {
  return niveEstadoDef_(grupo).label;
}

function abrirModalNivel_(r) {
  NIVE.actual = r;
  const p = nivePuntajeTexto_(r.puntaje);

  document.querySelector('#nive-modal-title').textContent = 'N° ' + r.n + ' · ' + r.nombres + ' ' + r.apellidos;
  document.querySelector('#nive-modal-sub').innerHTML =
    `<span class="com-badge" style="background:${r.estadoColor}">${r.estadoIc} ${esc_(r.estadoLabel)}</span>
     ${r.claveAcceso ? `<span class="conta-clave">🔑 ${esc_(r.claveAcceso)}</span>` : ''}`;

  document.querySelector('#nive-modal-body').innerHTML = `
    <div class="nive-ficha">
      <button type="button" class="nive-foto nive-foto--lg" id="nive-modal-foto" title="Ver la foto en grande">
        <img src="${esc_(niveFoto_(r))}" alt="Foto de ${esc_(r.nombres)}"
             onerror="this.onerror=null;this.src='${USR_FOTO_FALLBACK}';" />
      </button>
      <div class="nive-ficha__datos">
        <div><span>Documento</span><b>${esc_(r.documento || '—')}</b></div>
        <div><span>WhatsApp</span><b>${esc_(r.whatsapp || '—')}</b></div>
        <div><span>Correo</span><b>${esc_(r.correo || '—')}</b></div>
        <div><span>Nacimiento</span><b>${esc_(r.nacimiento || '—')}</b></div>
        <div class="full"><span>Dirección</span><b>${esc_(r.direccion || '—')}</b></div>
        <div><span>Migrado</span><b>${esc_(r.fechaMigracion || '—')}</b></div>
        <div><span>Formulario</span><b>${esc_(r.formularioEstado)}</b></div>
        <div class="full nive-ficha__doc">
          <button type="button" class="btn btn-ghost" id="nive-modal-doc"
            ${r.documentoUrl ? '' : 'disabled title="No tiene la copia del documento de identidad en su ficha."'}>📄 Ver documento de identidad</button>
        </div>
      </div>
    </div>

    <details class="conta-bloque" open>
      <summary>📊 Resultado del SET · SEP English Test</summary>
      <div class="form-grid">
        <div class="fld">
          <label>Puntaje SEA <small>(0.00 a 9.00)</small></label>
          <input id="nive-puntaje" type="text" inputmode="decimal" autocomplete="off"
                 value="${p}" placeholder="Ej.: 5.75" />
          <small class="conta-hint">Se acepta punto o coma. Dos decimales.</small>
        </div>
        <div class="fld">
          <label>Nivel de inglés <small>(automático)</small></label>
          <div class="nive-nivel-auto" id="nive-nivel-auto">—</div>
          <small class="conta-hint" id="nive-nivel-hint">El nivel y el mensaje salen de la escala de Configuración → Nivel y SEA.</small>
        </div>
        <div class="fld">
          <label>Nivel de Inglés HV <small>(obligatorio)</small></label>
          <select id="nive-nivelhv">
            <option value="">— Elige uno —</option>
            ${niveOpcionesHv_().map(o => `<option value="${esc_(o)}" ${r.nivelHv === o ? 'selected' : ''}>${esc_(o)}</option>`).join('')}
          </select>
          <small class="conta-hint">Es el que se imprime en la <b>hoja de vida</b>. No es el automático de arriba.</small>
        </div>
        <div class="fld fld-full">
          <small class="conta-hint">
            ${r.envios ? `Ya se le envió el resultado <b>${r.envios}</b> ${r.envios === 1 ? 'vez' : 'veces'}${r.fechaPuntaje ? ' · última: <b>' + esc_(r.fechaPuntaje) + '</b>' : ''}.
                          Volver a guardar el puntaje <b>reenvía</b> el mensaje.`
                       : 'Al guardar se le envía al estudiante el mensaje que corresponda a su resultado, por WhatsApp y correo.'}
          </small>
        </div>
      </div>
    </details>

    ${niveAprobacionHtml_(r)}`;

  const inp = document.querySelector('#nive-puntaje');
  const repintar = () => niveRepintarNivel_(inp.value);
  inp.addEventListener('input', repintar);
  repintar();
  document.querySelector('#nive-modal-foto')?.addEventListener('click', () => abrirFotoNivel_(r));
  document.querySelector('#nive-modal-doc')?.addEventListener('click', () => niveVerDocumento_(r));
  niveCablearAprobacion_(r);

  document.querySelector('#modal-nivel').classList.remove('hidden');
  setTimeout(() => inp.focus(), 60);
}

/* ============================================================
   ENTREGA 5 — BLOQUE "APROBACIÓN DEL PERFIL"
   ============================================================
   El check ya no es decorativo: marcarlo crea la hoja de vida y le
   manda al estudiante el mensaje de las ofertas; desmarcarlo es
   siempre una REAPERTURA de bloques, nunca un simple "quitar la
   palomita". Por eso el evento de desmarcar no desmarca: abre la
   pantalla de reapertura y deja el check como estaba hasta que esa
   operación termine bien. */
function nivePuedeAprobar_() {
  return !!(NIVE.catalogo && NIVE.catalogo.permisos && NIVE.catalogo.permisos.aprobar);
}

function niveAprobacionHtml_(r) {
  const puede = nivePuedeAprobar_();
  const hay = !!r.hvUrl;
  const reabierto = String(r.estadoPerfil || '').toUpperCase() === 'REABIERTO';

  return `
    <details class="conta-bloque" ${r.aprobado || reabierto ? 'open' : ''}>
      <summary>✅ Aprobación del perfil</summary>
      <div class="form-grid">
        <div class="fld fld-full">
          <label class="conta-chk ${puede ? '' : 'bloqueado'}">
            <input type="checkbox" id="nive-aprobado" ${puede ? '' : 'disabled'} ${r.aprobado ? 'checked' : ''} />
            <span>Aprobado (crea la hoja de vida y avisa de las ofertas)</span></label>
          <small class="conta-hint">${puede
            ? 'Al marcarlo se crea la hoja de vida en PDF y se le reenvía al estudiante el mensaje de las ofertas de empleo. Para desmarcarlo hay que decirle qué bloques debe corregir.'
            : 'Tu rol no puede aprobar perfiles: solo SUPERUSUARIO y DESARROLLADOR.'}</small>

          ${niveFlagHtml_(r) ? `<div class="nive-aprob__marca">${niveFlagHtml_(r)}</div>` : ''}

          ${reabierto ? `<div class="nive-aprob__reab">
              <b>↩️ Bloques devueltos para corregir</b>
              <div class="nive-aprob__motivo">${esc_(r.motivoReapertura || '— sin motivo escrito —')}</div>
              ${r.fechaReapertura ? `<small class="conta-hint">Se le avisó el ${esc_(r.fechaReapertura)}.</small>` : ''}
            </div>` : ''}

          ${hay ? `<div class="nive-aprob__hv">🆔 Hoja de vida generada el <b>${esc_(r.fechaHv || '—')}</b>${
                    (Number(r.hvVersiones) > 1) ? ` · versión <b>${Number(r.hvVersiones)}</b>` : ''}</div>` : ''}

          <div class="nive-aprob__btns">
            <button type="button" class="btn btn-ghost" data-nive="formulario">📝 Ver formulario</button>
            <button type="button" class="btn btn-ghost" data-nive="hv" ${hay ? '' : 'disabled title="Todavía no tiene hoja de vida: se crea al marcar Aprobado."'}>🆔 Ver HV</button>
            <button type="button" class="btn btn-ghost" data-nive="regenerar" ${hay ? '' : 'disabled title="Todavía no hay hoja de vida que regenerar."'}>🔄 Regenerar HV</button>
          </div>
          <small class="conta-hint">Al regenerar, la hoja de vida se reemplaza <b>en el mismo enlace</b>: quien ya lo tenga verá la nueva y de la anterior <b>no queda copia</b>.</small>
        </div>
      </div>
    </details>`;
}

/* El cableado va SIEMPRE después del innerHTML del modal, y sobre
   elementos recién creados: no hay forma de que queden escuchas
   repetidas de una apertura anterior. */
function niveCablearAprobacion_(r) {
  document.querySelector('#nive-modal-body [data-nive="formulario"]')
    ?.addEventListener('click', () => niveVerFormulario_(r));
  document.querySelector('#nive-modal-body [data-nive="hv"]')
    ?.addEventListener('click', () => niveVerHv_(r));
  document.querySelector('#nive-modal-body [data-nive="regenerar"]')
    ?.addEventListener('click', () => niveRegenerarHv_(r));

  const chk = document.querySelector('#nive-aprobado');
  if (!chk || chk.disabled) return;

  chk.addEventListener('change', async () => {
    if (!niveHayPerfil_()) { chk.checked = !!r.aprobado; niveSinModulo_(); return; }

    /* ── DE NO MARCADO A MARCADO: aprobar ── */
    if (chk.checked) {
      const destinos = [];
      if (r.whatsapp) destinos.push('WhatsApp <b>' + esc_(r.whatsapp) + '</b>');
      if (r.correo)   destinos.push('correo <b>' + esc_(r.correo) + '</b>');
      const conf = await Swal.fire({
        icon: 'question',
        title: r.aprobado ? '¿Volver a aprobar el perfil?' : '¿Aprobar el perfil?',
        html: `<div class="nive-conf">
            <div class="nive-conf__q"><b>${esc_(r.nombres + ' ' + r.apellidos)}</b> · N° ${r.n}</div>
            <div class="nive-conf__d">Al aprobar se hacen dos cosas de una vez:</div>
            <ul class="nive-conf__ul">
              <li>Se <b>crea su hoja de vida en PDF</b> con lo que llenó en el formulario y su foto.</li>
              <li>Se le envía el <b>mensaje de las ofertas de empleo</b>${destinos.length ? ' por ' + destinos.join(' y ') : ''}.</li>
            </ul>
            ${destinos.length ? '' : '<div class="nive-conf__re">No tiene WhatsApp ni correo: la hoja de vida se crea pero no sale mensaje.</div>'}
          </div>`,
        showCancelButton: true,
        confirmButtonText: 'Sí, aprobar y enviar',
        cancelButtonText: 'Cancelar',
        focusCancel: true
      });
      if (!conf.isConfirmed) { chk.checked = false; return; }
      const ok = await NPERFIL.aprobar(r);
      if (!ok) chk.checked = false;
      return;
    }

    /* ── DE MARCADO A NO MARCADO: reabrir bloques ──
       El check vuelve a su sitio y solo se queda desmarcado si la
       reapertura se completó de verdad. */
    chk.checked = true;
    const hecho = await NPERFIL.abrirReapertura(r);
    if (hecho) chk.checked = false;
  });
}

function niveRepintarNivel_(valor) {
  const caja = document.querySelector('#nive-nivel-auto');
  const hint = document.querySelector('#nive-nivel-hint');
  if (!caja) return;
  const crudo = String(valor || '').trim();
  if (!crudo) {
    caja.textContent = '—'; caja.style.background = '';
    if (hint) hint.textContent = 'Escribe el puntaje y el nivel sale solo.';
    return;
  }
  const n = nivePuntajeNum_(crudo);
  if (n === '' || n < 0 || n > 9) {
    caja.textContent = 'Fuera de rango'; caja.style.background = '#dc2626';
    if (hint) hint.textContent = 'El Puntaje SEA va de 0.00 a 9.00.';
    return;
  }
  const e = niveNivelDePuntaje_(n);
  if (!e) {
    caja.textContent = 'Sin nivel'; caja.style.background = '#dc2626';
    if (hint) hint.textContent = 'Ese puntaje no cae en ningún nivel: revisa la escala en Configuración.';
    return;
  }
  const def = niveEstadoDef_(e.grupo);
  caja.textContent = e.nivel;
  caja.style.background = def.color;
  if (hint) hint.innerHTML = 'Resultado: <b>' + esc_(def.label) + '</b> · rango ' + e.min + ' a ' + e.max + '.';
}

function cerrarModalNivel_() {
  document.querySelector('#modal-nivel')?.classList.add('hidden');
  NIVE.actual = null;
}

/* ── Guardar el puntaje, con confirmación previa ── */
async function guardarPuntajeNivel_() {
  const r = NIVE.actual; if (!r) return;
  const crudo = String(document.querySelector('#nive-puntaje')?.value || '').trim();
  if (!crudo) {
    Swal.fire({ icon: 'warning', title: 'Falta el puntaje', text: 'Escribe el Puntaje SEA (de 0.00 a 9.00).' });
    return;
  }
  const n = nivePuntajeNum_(crudo);
  if (n === '' || n < 0 || n > 9) {
    Swal.fire({ icon: 'warning', title: 'Puntaje fuera de rango', text: 'El Puntaje SEA va de 0.00 a 9.00.' });
    return;
  }
  const e = niveNivelDePuntaje_(n);
  if (!e) {
    Swal.fire({ icon: 'warning', title: 'Sin nivel', text: 'Ese puntaje no cae en ningún nivel. Revisa la escala en Configuración → Nivel y SEA.' });
    return;
  }

  /* FASE 3.1 · ajuste 5 — sin el Nivel de Inglés HV no se guarda (el
     backend lo exige igual; aquí se avisa antes de gastar el viaje). */
  const hv = String(document.querySelector('#nive-nivelhv')?.value || '').trim();
  if (!hv) {
    Swal.fire({
      icon: 'warning', title: 'Falta el Nivel de Inglés HV',
      html: 'Elige el nivel que va impreso en la <b>hoja de vida</b>.<br><small>Es distinto del nivel automático del puntaje.</small>'
    });
    document.querySelector('#nive-nivelhv')?.focus();
    return;
  }

  /* Confirmación previa: el usuario la pidió expresamente. Un
     puntaje mal digitado dispara un correo y un WhatsApp que no se
     pueden recoger. */
  const def = niveEstadoDef_(e.grupo);
  const destinos = [];
  if (r.whatsapp) destinos.push('WhatsApp <b>' + esc_(r.whatsapp) + '</b>');
  if (r.correo)   destinos.push('correo <b>' + esc_(r.correo) + '</b>');
  const res = await Swal.fire({
    title: r.envios ? '¿Volver a enviar el resultado?' : '¿Guardar y enviar el resultado?',
    html: `<div class="nive-conf">
        <div class="nive-conf__q"><b>${esc_(r.nombres + ' ' + r.apellidos)}</b> · N° ${r.n}</div>
        <div class="nive-conf__p">Puntaje SEA <b>${n.toFixed(2)}</b> / 9</div>
        <div class="nive-conf__n" style="background:${def.color}">${esc_(e.nivel)} · ${esc_(def.label)}</div>
        <div class="nive-conf__hv">Nivel de Inglés HV: <b>${esc_(hv)}</b> <small>(el que sale en la hoja de vida)</small></div>
        <div class="nive-conf__d">${destinos.length
          ? 'Se le envía a ' + destinos.join(' y ') + '.'
          : '<span style="color:#dc2626">No tiene WhatsApp ni correo: el puntaje se guarda pero no sale mensaje.</span>'}</div>
        ${r.envios ? `<div class="nive-conf__re">Ya se le había enviado ${r.envios} ${r.envios === 1 ? 'vez' : 'veces'}: este sería el envío ${r.envios + 1}.</div>` : ''}
      </div>`,
    showCancelButton: true,
    confirmButtonText: r.envios ? 'Sí, reenviar' : 'Sí, guardar y enviar',
    cancelButtonText: 'Cancelar',
    focusCancel: true
  });
  if (!res.isConfirmed) return;

  try {
    const out = await apiPost('guardarPuntaje', {
      usuarioId: currentUser.id, n: r.n, documento: r.documento, puntaje: crudo, nivelHv: hv
    });
    cerrarModalNivel_();
    await recargarNivel_(true);
    const a = out.aviso || {};
    if (a.enviado) {
      const canal = a.canal === 'EMAIL' ? 'correo' : (a.canal === 'WHATSAPP' ? 'WhatsApp' : 'correo y WhatsApp');
      /* Si el mensaje llevaba el enlace del video guía y ese enlace no
         está configurado, el estudiante lo recibió en blanco. Mejor
         decirlo ahora que enterarse por él. */
      const faltaVideo = (out.grupo !== 'NO_ACEPTADO') && a.video === false;
      Swal.fire({
        icon: faltaVideo ? 'warning' : 'success',
        title: out.reenvio ? 'Resultado reenviado' : 'Resultado enviado',
        html: `<b>${esc_(out.nombres + ' ' + out.apellidos)}</b> quedó en <b>${esc_(out.nivel)}</b> (${esc_(out.estadoLabel)}).<br>
               Se le avisó por <b>${canal}</b>.` +
              (faltaVideo
                ? `<br><br><small>⚠️ El mensaje salió con el <b>Video Guía para el formulario</b> en blanco:
                   está sin llenar en Configuración → Programas → Summer.</small>`
                : '')
      });
    } else {
      Swal.fire({
        icon: 'warning', title: 'Puntaje guardado, pero sin aviso',
        html: `El puntaje quedó registrado, pero el mensaje no salió.<br><small>${esc_(a.motivo || '')}</small>`
      });
    }
  } catch (e2) {
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: String(e2.message || e2) });
  }
}

/* ============================================================
   VISTA EN VIVO (mismo motor que el Contador)
   ============================================================
   El backend escribe un número en /meta/nivel_rev cada vez que
   cambia algo del proceso. Aquí se escucha SOLO ese número. Sin
   Firebase, sondeo cada 12 s. */
const FBNI = { ref: null, primed: false, refrescoTimer: null, pollTimer: null, cargando: false };

function niveOverlayAbierto_() {
  const abierto = sel => { const e = document.querySelector(sel); return !!e && !e.classList.contains('hidden'); };
  /* ENTREGA 5 — el visor de la hoja de vida, el formulario en solo
     lectura y la reapertura de bloques también son pantallas: si el
     refresco en vivo repinta mientras están abiertas, el usuario ve
     cómo se le mueve todo por debajo. */
  if (abierto('#modal-nivel') || abierto('#nive-foto-modal') || abierto('#nive-fsheet') ||
      abierto('#nive-visor')  || abierto('#modal-nform')     || abierto('#modal-nreab')) return true;
  return !!(window.Swal && Swal.isVisible && Swal.isVisible());
}
async function niveRefrescarVivo_() {
  if (document.hidden) return;
  if (FBNI.cargando) return;
  if (niveOverlayAbierto_()) {
    clearTimeout(FBNI.refrescoTimer);
    FBNI.refrescoTimer = setTimeout(niveRefrescarVivo_, 1500);
    return;
  }
  FBNI.cargando = true;
  try { await recargarNivel_(true); } catch (e) {} finally { FBNI.cargando = false; }
}
function niveAgendarRefresco_() {
  clearTimeout(FBNI.refrescoTimer);
  FBNI.refrescoTimer = setTimeout(niveRefrescarVivo_, 400);
}
function niveEscuchar_() {
  if (!window.firebase || !firebase.database) return false;
  niveDejarDeEscuchar_();
  FBNI.primed = false;
  FBNI.ref = firebase.database().ref('meta/nivel_rev');
  FBNI.ref.on('value',
    () => { if (!FBNI.primed) { FBNI.primed = true; return; } niveAgendarRefresco_(); },
    err => {
      console.warn('RT /meta/nivel_rev no disponible, uso sondeo:', err && err.message || err);
      niveDejarDeEscuchar_();
      niveIniciarSondeo_();
    });
  return true;
}
function niveDejarDeEscuchar_() {
  if (FBNI.ref) { try { FBNI.ref.off(); } catch (e) {} FBNI.ref = null; }
  clearTimeout(FBNI.refrescoTimer); FBNI.refrescoTimer = null;
}
function niveIniciarSondeo_() {
  niveDetenerSondeo_();
  FBNI.pollTimer = setInterval(niveRefrescarVivo_, 12000);
}
function niveDetenerSondeo_() {
  if (FBNI.pollTimer) { clearInterval(FBNI.pollTimer); FBNI.pollTimer = null; }
}
async function niveLiveOn_() {
  try {
    if (typeof fbAsegurarSesion_ === 'function') await fbAsegurarSesion_();
    niveDetenerSondeo_();
    if (!niveEscuchar_()) niveIniciarSondeo_();
  } catch (e) {
    console.warn('Nivel en vivo sin Firebase, uso sondeo cada 12 s:', e && e.message || e);
    niveIniciarSondeo_();
  }
}
function niveLiveOff_() { niveDejarDeEscuchar_(); niveDetenerSondeo_(); }

/* ============================================================
   EVENTOS FIJOS
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#nive-search')?.addEventListener('input', e => {
    NIVE.filtroTexto = e.target.value; renderNiveCards_();
  });
  document.querySelector('#nive-refresh')?.addEventListener('click', () => recargarNivel_(false));
  document.querySelector('#nive-modal-close')?.addEventListener('click', cerrarModalNivel_);
  document.querySelector('#nive-cancel')?.addEventListener('click', cerrarModalNivel_);
  document.querySelector('#nive-save')?.addEventListener('click', guardarPuntajeNivel_);

  document.querySelector('#nive-foto-close')?.addEventListener('click', cerrarFotoNivel_);
  document.querySelector('#nive-foto-modal')?.addEventListener('click', e => {
    if (e.target && e.target.id === 'nive-foto-modal') cerrarFotoNivel_();
  });
  document.querySelector('#nive-zoom-mas')?.addEventListener('click', () => niveZoom_(0.25));
  document.querySelector('#nive-zoom-menos')?.addEventListener('click', () => niveZoom_(-0.25));
  document.querySelector('#nive-zoom-reset')?.addEventListener('click', niveZoomReset_);

  const marco = document.querySelector('#nive-foto-marco');
  if (marco) {
    marco.addEventListener('wheel', e => {
      e.preventDefault();
      niveZoom_(e.deltaY < 0 ? 0.2 : -0.2);
    }, { passive: false });
    marco.addEventListener('dblclick', () => (NIVEZ.escala > 1 ? niveZoomReset_() : niveZoom_(1)));
    marco.addEventListener('pointerdown', e => {
      if (NIVEZ.escala <= 1) return;
      NIVEZ.arrastra = true; NIVEZ.x0 = e.clientX - NIVEZ.x; NIVEZ.y0 = e.clientY - NIVEZ.y;
      try { marco.setPointerCapture(e.pointerId); } catch (_) {}
    });
    marco.addEventListener('pointermove', e => {
      if (!NIVEZ.arrastra) return;
      NIVEZ.x = e.clientX - NIVEZ.x0; NIVEZ.y = e.clientY - NIVEZ.y0;
      niveZoomAplicar_();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
      marco.addEventListener(ev, () => { NIVEZ.arrastra = false; }));
  }

  /* Tile de la vista Procesos. */
  document.querySelector('#proc-tile-nivel')?.addEventListener('click', abrirNivel_);
});

/* Puerta para las pruebas automatizadas (igual que window.__sep11). */
window.__sepNivel = {
  estado: NIVE,
  cards: renderNiveCards_,
  filtros: renderNiveFiltros_,
  resumen: renderNiveResumen_,
  nivelDe: niveNivelDePuntaje_,
  base: () => niveBaseNivel_(),
  /* ENTREGA 5 */
  cardHtml: niveCardHtml_,
  flagHtml: niveFlagHtml_,
  aprobacionHtml: niveAprobacionHtml_,
  puedeAprobar: nivePuedeAprobar_,
  abrirModal: abrirModalNivel_,
  cerrarModal: cerrarModalNivel_,
  overlayAbierto: niveOverlayAbierto_,
  perfil: () => (typeof NPERFIL !== 'undefined' ? NPERFIL : null)
};
