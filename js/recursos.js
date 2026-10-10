/* =============================================================
 * SEP GROUP — RECURSOS (Ajustes Fase 5 · 09/10/2026)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula
 * la garantía de funcionamiento.
 * ------------------------------------------------------------
 * QUÉ ES (nota 3 de Javier)
 *   Procesos → Recursos: SEP crea recursos informativos (título,
 *   descripción y un video de YouTube) que aparecen en el portal del
 *   participante (SEP-AGENDA → tarjeta Recursos). Se pueden ocultar,
 *   ordenar (posición) y eliminar.
 *
 * RENDIMIENTO (reglas de la casa)
 *   · Una vista, un viaje (recursosInit). Carga única por sesión;
 *     filtros locales. Tras guardar se PARCHA la lista en memoria.
 *   · Del video viaja SOLO el ID; la miniatura sale directo de YouTube
 *     (i.ytimg.com), nunca por Apps Script.
 *   · La lectura se corta al salir (AbortController); los guardados no.
 *   · Toda escritura: escudo (Swal modal) desde el primer toque + rid.
 *
 * Usa de app.js: apiGet, apiPost, showView, esc_, currentUser, misRoles_.
 * ============================================================= */

const RCS = { lista: [], cargado: false, cargando: false, ctrl: null, ocupado: false, filtro: 'TODOS' };
const RCS_YT = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/i;

function rcsTxt_(v) { return String(v == null ? '' : v).trim(); }
function rcsMed_(ruta, t0) {
  try {
    const ms = Date.now() - t0;
    (window.__sepMed = window.__sepMed || []).push({ ruta: ruta, ms: ms, t: Date.now() });
    if (window.console) console.info('[med] ' + ruta + ' ' + ms + ' ms');
  } catch (_) {}
}
function rcsAbortado_(e) { return !!(e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')))); }
/* ID de YouTube de lo que pegue la persona ('' sin video, null si no es YouTube). */
function rcsVideoId_(v) {
  const s = rcsTxt_(v);
  if (!s) return '';
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = RCS_YT.exec(s);
  return m ? m[1] : null;
}
function rcsMini_(id) { return 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg'; }

/* ============================================================
   ENTRADA
   ============================================================ */
function rcsPuedeEntrar_() {
  const u = currentUser || {};
  const mios = ((typeof misRoles_ === 'function') ? (misRoles_(u) || [])
    : ((Array.isArray(u.roles) && u.roles.length) ? u.roles : [u.rol])).map(r => String(r || '').toUpperCase());
  return ['DESARROLLADOR', 'SUPERUSUARIO', 'PROCESOS'].some(r => mios.indexOf(r) >= 0);
}

function abrirRecursos_() {
  if (!rcsPuedeEntrar_()) {
    Swal.fire({ icon: 'warning', title: 'Sin permiso', text: 'Solo PROCESOS, SUPERUSUARIO o DESARROLLADOR administran los Recursos.' });
    return;
  }
  showView('recursos');                        // navegación primero
  if (RCS.cargado) { rcsPintar_(); return; }
  if (!RCS.cargando) rcsCargar_();
}

async function rcsCargar_() {
  RCS.cargando = true;
  try { RCS.ctrl && RCS.ctrl.abort(); } catch (_) {}
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  RCS.ctrl = ctrl;
  const quien = currentUser && currentUser.id;
  const t0 = Date.now();
  try {
    const d = await apiGet('recursosInit', { usuarioId: quien }, ctrl ? { signal: ctrl.signal } : {});
    if (!currentUser || currentUser.id !== quien) return;          // sesión vieja
    rcsMed_('recursosInit', t0);
    RCS.lista = d.recursos || [];
    RCS.hoja = d.hoja !== false;
    RCS.max = d.max || 60;
    RCS.cargado = true;
    rcsPintar_();
  } catch (e) {
    if (rcsAbortado_(e)) return;
    Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: String(e.message || e) });
  } finally {
    if (RCS.ctrl === ctrl) { RCS.ctrl = null; RCS.cargando = false; }
  }
}

function rcsSalir_() {
  try { RCS.ctrl && RCS.ctrl.abort(); } catch (_) {}
  RCS.ctrl = null; RCS.cargando = false;
}

/* ============================================================
   PINTAR
   ============================================================ */
function rcsOrdenar_(a, b) {
  const oa = a.o || 9999, ob = b.o || 9999;
  if (oa !== ob) return oa - ob;
  return b.id < a.id ? -1 : (b.id > a.id ? 1 : 0);
}
const RCS_FILTROS = [
  { k: 'TODOS',   l: 'Todos',              ic: '🎬', f: () => true },
  { k: 'ACTIVOS', l: 'Visibles en el portal', ic: '👁️', f: r => r.a },
  { k: 'OCULTOS', l: 'Ocultos',            ic: '🙈', f: r => !r.a }
];

function rcsCardHtml_(r) {
  const mini = r.v
    ? `<button class="rcs-mini" type="button" data-rcs-ver="${esc_(r.id)}" aria-label="Ver el video de ${esc_(r.t)}">
         <img src="${rcsMini_(r.v)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="rcs-play" aria-hidden="true">▶</span></button>`
    : `<div class="rcs-mini rcs-mini--sin" aria-hidden="true"><span>📝</span><small>Sin video</small></div>`;
  return `<article class="com-card rcs-card${r.a ? '' : ' rcs-card--oculto'}" id="rcs-${esc_(r.id)}">
    ${mini}
    <div class="rcs-cuerpo">
      <div class="rcs-chips">
        <span class="rcs-chip ${r.a ? 'rcs-chip--on' : 'rcs-chip--off'}">${r.a ? '👁️ Visible en el portal' : '🙈 Oculto'}</span>
        ${r.o ? `<span class="rcs-chip">Posición ${r.o}</span>` : ''}
      </div>
      <h3 class="rcs-titulo">${esc_(r.t)}</h3>
      ${r.d ? `<p class="rcs-desc">${esc_(r.d)}</p>` : ''}
      <div class="rcs-pie">${esc_(r.por || '')}${r.fecha ? ' · ' + esc_(r.fecha) : ''}</div>
      <div class="com-card__actions rcs-acts">
        <button class="act-btn act-editar" type="button" data-rcs-editar="${esc_(r.id)}">✏️ Editar</button>
        <button class="act-btn" type="button" data-rcs-alternar="${esc_(r.id)}">${r.a ? '🙈 Ocultar' : '👁️ Mostrar'}</button>
        <button class="act-btn act-eliminar" type="button" data-rcs-eliminar="${esc_(r.id)}">🗑 Eliminar</button>
      </div>
    </div>
  </article>`;
}

function rcsPintar_() {
  const cont = document.getElementById('rcs-cards');
  if (!cont) return;
  RCS.lista.sort(rcsOrdenar_);
  /* Pastillas con su conteo (texto completo, nunca recortado). */
  const fil = document.getElementById('rcs-filters');
  if (fil) {
    fil.innerHTML = RCS_FILTROS.map(f => {
      const n = RCS.lista.filter(f.f).length;
      return `<button class="fpill ${RCS.filtro === f.k ? 'is-on' : ''}" type="button" data-rcs-filtro="${f.k}" style="--fp:#2563eb">
        <span class="fpill__ic">${f.ic}</span><span class="fpill__label">${esc_(f.l)}</span><span class="fpill__count">${n}</span></button>`;
    }).join('');
  }
  const f = RCS_FILTROS.find(x => x.k === RCS.filtro) || RCS_FILTROS[0];
  const lista = RCS.lista.filter(f.f);
  cont.innerHTML = lista.map(rcsCardHtml_).join('');
  document.getElementById('rcs-empty')?.classList.toggle('hidden', RCS.lista.length > 0);
}

/* Un solo escuchador para toda la vista (delegación). */
function rcsClick_(e) {
  const t = e.target.closest('[data-rcs-filtro],[data-rcs-ver],[data-rcs-editar],[data-rcs-alternar],[data-rcs-eliminar]');
  if (!t) return;
  if (t.dataset.rcsFiltro) { RCS.filtro = t.dataset.rcsFiltro; rcsPintar_(); return; }
  const id = t.dataset.rcsVer || t.dataset.rcsEditar || t.dataset.rcsAlternar || t.dataset.rcsEliminar;
  const r = RCS.lista.find(x => x.id === id);
  if (!r) return;
  if (t.dataset.rcsVer) return rcsVerVideo_(r);
  if (t.dataset.rcsEditar) return rcsEditar_(r);
  if (t.dataset.rcsAlternar) return rcsGuardar_(Object.assign({}, rcsCuerpo_(r), { activo: !r.a }), r.a ? 'Recurso oculto' : 'Recurso visible');
  if (t.dataset.rcsEliminar) return rcsEliminar_(r);
}

/* El reproductor: youtube-nocookie, sin relacionados de otros canales. */
function rcsVerVideo_(r) {
  if (!r.v) return;
  Swal.fire({
    title: esc_(r.t), width: 760, showCloseButton: true, showConfirmButton: false,
    html: `<div class="rcs-video"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(r.v)}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3"
             title="${esc_(r.t)}" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen
             referrerpolicy="strict-origin-when-cross-origin"></iframe></div>${r.d ? `<p class="rcs-video-desc">${esc_(r.d)}</p>` : ''}`
  });
}

/* ============================================================
   CREAR / EDITAR / OCULTAR / ELIMINAR
   ============================================================ */
function rcsCuerpo_(r) {
  return { id: r.id, titulo: r.t, descripcion: r.d, video: r.v, orden: r.o || '', activo: r.a };
}

async function rcsEditar_(r) {
  if (RCS.ocupado) return;
  if (!r && RCS.lista.length >= (RCS.max || 60)) {
    Swal.fire({ icon: 'info', title: 'Llegaste al tope', text: 'Hay ' + RCS.lista.length + ' recursos: elimina o reutiliza alguno.' });
    return;
  }
  const v = r || { t: '', d: '', v: '', o: 0, a: true };
  const res = await Swal.fire({
    title: r ? '✏️ Editar recurso' : '🎬 Nuevo recurso',
    width: 620,
    html: `<div class="rcs-form">
      <label for="rcs-f-titulo">Título <small>(obligatorio)</small></label>
      <input id="rcs-f-titulo" class="swal2-input" maxlength="120" placeholder="Ej.: Cómo ir vestido a tu cita de visa" value="${esc_(v.t)}">
      <label for="rcs-f-desc">Descripción</label>
      <textarea id="rcs-f-desc" class="swal2-textarea" maxlength="1500" placeholder="Una descripción breve de lo que va a encontrar el participante.">${esc_(v.d)}</textarea>
      <label for="rcs-f-video">Video de YouTube <small>(enlace; opcional)</small></label>
      <input id="rcs-f-video" class="swal2-input" placeholder="https://youtu.be/… o https://www.youtube.com/watch?v=…" value="${v.v ? 'https://youtu.be/' + esc_(v.v) : ''}">
      <div id="rcs-f-vista" class="rcs-f-vista"></div>
      <div class="rcs-f-fila">
        <div><label for="rcs-f-orden">Posición <small>(1 = primero; vacío = al final)</small></label>
          <input id="rcs-f-orden" class="swal2-input" type="number" min="1" max="999" inputmode="numeric" value="${v.o || ''}"></div>
        <label class="rcs-f-check"><input id="rcs-f-activo" type="checkbox" ${v.a ? 'checked' : ''}> Visible en el portal</label>
      </div>
      <p class="rcs-f-nota">💡 Usa videos de YouTube <b>públicos</b> o <b>no listados</b>: los privados no se pueden ver en el portal.</p>
    </div>`,
    showCancelButton: true, confirmButtonText: r ? 'Guardar cambios' : 'Crear recurso', cancelButtonText: 'Cancelar',
    focusConfirm: false,
    didOpen: () => {
      const inp = document.getElementById('rcs-f-video');
      const vista = () => {
        const id = rcsVideoId_(inp.value);
        const caja = document.getElementById('rcs-f-vista');
        if (!caja) return;
        caja.innerHTML = id ? `<img src="${rcsMini_(id)}" alt="Miniatura del video" referrerpolicy="no-referrer">` :
          (id === null ? '<span class="rcs-f-error">Ese enlace no es de YouTube.</span>' : '');
      };
      inp.addEventListener('input', vista); vista();
    },
    preConfirm: () => {
      const titulo = rcsTxt_(document.getElementById('rcs-f-titulo').value);
      const video = rcsTxt_(document.getElementById('rcs-f-video').value);
      if (!titulo) { Swal.showValidationMessage('Escribe el título.'); return false; }
      if (rcsVideoId_(video) === null) { Swal.showValidationMessage('El video debe ser un enlace de YouTube.'); return false; }
      return {
        titulo: titulo,
        descripcion: rcsTxt_(document.getElementById('rcs-f-desc').value),
        video: video,
        orden: rcsTxt_(document.getElementById('rcs-f-orden').value),
        activo: !!document.getElementById('rcs-f-activo').checked
      };
    }
  });
  if (!res.isConfirmed) return;
  return rcsGuardar_(Object.assign(r ? { id: r.id } : {}, res.value), r ? 'Cambios guardados' : 'Recurso creado');
}

async function rcsGuardar_(cuerpo, okTxt) {
  if (RCS.ocupado) return;                      // escudo: nada de doble envío
  RCS.ocupado = true;
  Swal.fire({ title: 'Guardando…', allowOutsideClick: false, allowEscapeKey: false, didOpen: () => Swal.showLoading() });
  const t0 = Date.now();
  const quien = currentUser && currentUser.id;
  try {
    const out = await apiPost('recursoGuardar', Object.assign({ usuarioId: quien }, cuerpo), { silent: true });
    rcsMed_('recursoGuardar', t0);
    if (!currentUser || currentUser.id !== quien) return;
    const nuevo = out.recurso;
    const i = RCS.lista.findIndex(x => x.id === nuevo.id);
    if (i >= 0) RCS.lista[i] = nuevo; else RCS.lista.push(nuevo);
    rcsPintar_();
    Swal.fire({ icon: 'success', title: okTxt, text: nuevo.a ? 'Ya lo ven los participantes en su portal.' : 'Queda oculto: no aparece en el portal.',
      timer: 1500, showConfirmButton: false });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: String(e.message || e) });
  } finally { RCS.ocupado = false; }
}

async function rcsEliminar_(r) {
  if (RCS.ocupado) return;
  const ok = await Swal.fire({ icon: 'warning', title: '¿Eliminar este recurso?',
    html: '<b>' + esc_(r.t) + '</b><br><small>Deja de verse en el portal. Si solo quieres sacarlo un tiempo, usa <b>Ocultar</b>.</small>',
    showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626' });
  if (!ok.isConfirmed) return;
  RCS.ocupado = true;
  Swal.fire({ title: 'Eliminando…', allowOutsideClick: false, allowEscapeKey: false, didOpen: () => Swal.showLoading() });
  const t0 = Date.now();
  try {
    await apiPost('recursoEliminar', { usuarioId: currentUser.id, id: r.id }, { silent: true });
    rcsMed_('recursoEliminar', t0);
    RCS.lista = RCS.lista.filter(x => x.id !== r.id);
    rcsPintar_();
    Swal.fire({ icon: 'success', title: 'Recurso eliminado', timer: 1300, showConfirmButton: false });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: String(e.message || e) });
  } finally { RCS.ocupado = false; }
}

/* ============================================================
   ARRANQUE
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#proc-tile-recursos')?.addEventListener('click', abrirRecursos_);
  document.querySelector('#rcs-refresh')?.addEventListener('click', () => { if (!RCS.cargando) { RCS.cargado = false; rcsCargar_(); } });
  document.querySelector('#rcs-nuevo')?.addEventListener('click', () => rcsEditar_(null));
  document.querySelector('#view-recursos')?.addEventListener('click', rcsClick_);
});

/* Puerta para las pruebas automatizadas. */
window.__sepRecursos = { RCS, abrirRecursos_, rcsPintar_, rcsCardHtml_, rcsVideoId_, rcsGuardar_, rcsSalir_, RCS_FILTROS };
