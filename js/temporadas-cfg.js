/* ============================================================
 * SEP GROUP — CONFIGURACIÓN → TEMPORADAS (Fase 5.1 · Entrega A)
 * SEP Colombia Group SAS
 * ------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * ------------------------------------------------------------
 * Solo Superadmin (y Desarrollador): crear, activar, reabrir y
 * archivar temporadas (Programa + Año) y mover un registro puntual
 * de temporada. La pestaña se carga la primera vez que se abre (la
 * Configuración no paga este viaje si nadie entra aquí).
 * ============================================================ */
const TCFG = { datos: null, cargando: false, ocupado: false };

const TCFG_ESTADO = {
  ACTIVA:    { label: 'Activa',    cls: 'tcfg-chip--activa',    ayuda: 'Recibe los leads nuevos de este programa.' },
  ABIERTA:   { label: 'Abierta',   cls: 'tcfg-chip--abierta',   ayuda: 'Sigue operando; ya no recibe leads nuevos.' },
  ARCHIVADA: { label: 'Archivada', cls: 'tcfg-chip--archivada', ayuda: 'Solo consulta: nadie escribe salvo Superadmin.' }
};

async function tcfgAbrir_(forzar){
  const cont = document.getElementById('cfg-temporadas'); if (!cont) return;
  if (TCFG.datos && !forzar){ tcfgPintar_(); return; }
  if (TCFG.cargando) return;
  TCFG.cargando = true;
  cont.innerHTML = `<div class="sep-sk-wrap">${[1, 2, 3].map(() => `<div class="sep-sk-card">
    <span class="sep-sk sep-sk-l tit sep-sk-w45"></span>
    <div class="sep-sk-rows"><span class="sep-sk sep-sk-l sep-sk-w95"></span><span class="sep-sk sep-sk-l sep-sk-w80"></span></div>
    </div>`).join('')}</div>`;
  try{
    TCFG.datos = await apiGet('temporadas', { usuarioId: currentUser.id }, { silent: true });
    tcfgPintar_();
  }catch(e){
    cont.innerHTML = `<div class="cfg-card"><p class="cfg-hint">No se pudieron cargar las temporadas: ${esc_(e.message || e)}</p>
      <button class="btn btn-primary" id="tcfg-reintentar">Reintentar</button></div>`;
    document.getElementById('tcfg-reintentar')?.addEventListener('click', ()=> tcfgAbrir_(true));
  }finally{ TCFG.cargando = false; }
}

/* Los conteos solo llegan en la carga completa: tras crear o cambiar
   estado el servidor devuelve el catálogo sin recontar y aquí se
   conservan los que ya había (una temporada nueva nace en cero). */
function tcfgMezclar_(meta){
  const previos = {};
  (TCFG.datos?.lista || []).forEach(t => { previos[t.programa + '|' + t.anio] = t; });
  meta.lista.forEach(t => {
    const p = previos[t.programa + '|' + t.anio];
    t.leads = p ? p.leads : 0; t.inscritos = p ? p.inscritos : 0;
  });
  meta.programas = TCFG.datos?.programas || [];
  TCFG.datos = meta;
  if (typeof TEMP !== 'undefined') { TEMP.meta = Object.assign({}, TEMP.meta || {}, meta); TEMP.pintar(); }
}

function tcfgPintar_(){
  const cont = document.getElementById('cfg-temporadas'); if (!cont || !TCFG.datos) return;
  const d = TCFG.datos;
  const porProg = {};
  d.lista.forEach(t => { (porProg[t.programa] = porProg[t.programa] || []).push(t); });
  Object.keys(porProg).forEach(p => porProg[p].sort((a, b) => Number(b.anio) - Number(a.anio)));
  const anioSug = String(Number(d.anioDefecto || new Date().getFullYear()) + 1);

  const filas = Object.keys(porProg).sort().map(p => `
    <div class="tcfg-prog">
      <div class="tcfg-prog__nom">${esc_(p)}</div>
      ${porProg[p].map(t => {
        const e = TCFG_ESTADO[t.estado] || TCFG_ESTADO.ABIERTA;
        const bot = [];
        if (t.estado !== 'ACTIVA')    bot.push(`<button class="btn btn-sm tcfg-btn" data-tcfg="ACTIVA" data-p="${esc_(t.programa)}" data-a="${t.anio}">Activar</button>`);
        if (t.estado === 'ARCHIVADA') bot.push(`<button class="btn btn-sm tcfg-btn" data-tcfg="ABIERTA" data-p="${esc_(t.programa)}" data-a="${t.anio}">Reabrir</button>`);
        else if (t.estado !== 'ACTIVA') bot.push(`<button class="btn btn-sm tcfg-btn tcfg-btn--gris" data-tcfg="ARCHIVADA" data-p="${esc_(t.programa)}" data-a="${t.anio}">Archivar</button>`);
        return `<div class="tcfg-row">
          <span class="tcfg-anio">${t.anio}</span>
          <span class="tcfg-chip ${e.cls}" title="${esc_(e.ayuda)}">${e.label}</span>
          <span class="tcfg-cnt">${Number(t.leads || 0).toLocaleString('es-CO')} leads · ${Number(t.inscritos || 0).toLocaleString('es-CO')} inscritos</span>
          <span class="tcfg-acc">${bot.join('')}</span>
        </div>`;
      }).join('')}
    </div>`).join('');

  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card__title">📅 Temporadas (Programa + Año)</h3>
      <p class="cfg-card__sub">Cada temporada es independiente: participantes, pagos, contratos, ofertas, documentos y estados no se mezclan entre años.
        La <b>activa</b> recibe los leads nuevos; para cerrar una activa, activa primero la siguiente. Una <b>archivada</b> queda solo para consulta.</p>
      <div class="tcfg-lista">${filas || '<p class="cfg-hint">Todavía no hay temporadas.</p>'}</div>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card__title">➕ Nueva temporada</h3>
      <div class="cfg-grid">
        <div class="cfg-field"><label>Programa</label>
          <select id="tcfg-prog">${(d.programas || []).map(p => `<option value="${esc_(p)}">${esc_(p)}</option>`).join('')}</select></div>
        <div class="cfg-field"><label>Año</label>
          <input id="tcfg-anio" type="number" inputmode="numeric" min="2020" max="2100" value="${anioSug}"></div>
        <div class="cfg-field full"><label class="tcfg-check"><input id="tcfg-activar" type="checkbox"> Dejarla <b>activa</b> (desde ya recibe los leads nuevos de ese programa)</label></div>
      </div>
      <button class="btn btn-primary" id="tcfg-crear">Crear temporada</button>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card__title">🔀 Mover un registro de temporada</h3>
      <p class="cfg-card__sub">Corrección puntual: pasa un lead (y su ficha del Contador) a otra temporada de su mismo programa.
        No se permite si en el año destino ya hay otro registro con el mismo WhatsApp.</p>
      <div class="cfg-grid">
        <div class="cfg-field"><label>ID del registro</label><input id="tcfg-mid" type="text" placeholder="COM000123" autocomplete="off"></div>
        <div class="cfg-field"><label>Año destino</label>
          <select id="tcfg-manio">${(d.anios || []).map(a => `<option value="${a}">${a}</option>`).join('')}</select></div>
      </div>
      <button class="btn btn-primary" id="tcfg-mover">Mover</button>
    </div>`;

  cont.querySelectorAll('[data-tcfg]').forEach(b => b.addEventListener('click', () => tcfgEstado_(b)));
  document.getElementById('tcfg-crear')?.addEventListener('click', tcfgCrear_);
  document.getElementById('tcfg-mover')?.addEventListener('click', tcfgMover_);
}

/* Escudo: un solo guardado a la vez y el botón ocupado desde el
   primer toque (el rid que pone apiPost hace el resto). */
async function tcfgGuardar_(boton, fn){
  if (TCFG.ocupado) return;
  TCFG.ocupado = true;
  const txt = boton ? boton.textContent : '';
  if (boton){ boton.disabled = true; boton.textContent = 'Guardando…'; }
  try { await fn(); }
  catch (e){ Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: String(e.message || e) }); }
  finally {
    TCFG.ocupado = false;
    if (boton && boton.isConnected){ boton.disabled = false; boton.textContent = txt; }
  }
}

async function tcfgEstado_(b){
  const estado = b.dataset.tcfg, programa = b.dataset.p, anio = b.dataset.a;
  const textos = {
    ACTIVA: `¿Activar <b>${esc_(programa)} ${anio}</b>? Desde ya recibe los leads nuevos de ese programa y la que estaba activa queda abierta.`,
    ABIERTA: `¿Reabrir <b>${esc_(programa)} ${anio}</b>? Se vuelve a poder trabajar en sus expedientes.`,
    ARCHIVADA: `¿Archivar <b>${esc_(programa)} ${anio}</b>? Queda solo para consulta: nadie podrá escribir en sus expedientes salvo el Superadmin.`
  };
  const ok = await Swal.fire({ icon: 'question', title: 'Temporada', html: textos[estado],
    showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'Cancelar' });
  if (!ok.isConfirmed) return;
  await tcfgGuardar_(b, async () => {
    const meta = await apiPost('estadoTemporada', { usuarioId: currentUser.id, programa, anio, estado });
    tcfgMezclar_(meta); tcfgPintar_();
    Swal.fire({ icon: 'success', title: 'Listo', timer: 1100, showConfirmButton: false });
  });
}

async function tcfgCrear_(){
  const b = document.getElementById('tcfg-crear');
  const programa = document.getElementById('tcfg-prog').value;
  const anio = String(document.getElementById('tcfg-anio').value || '').trim();
  const activar = document.getElementById('tcfg-activar').checked;
  if (!/^\d{4}$/.test(anio)) return Swal.fire({ icon: 'warning', title: 'Escribe un año de 4 dígitos' });
  await tcfgGuardar_(b, async () => {
    const meta = await apiPost('crearTemporada', { usuarioId: currentUser.id, programa, anio, activar });
    tcfgMezclar_(meta); tcfgPintar_();
    Swal.fire({ icon: 'success', title: 'Temporada creada', text: programa + ' ' + anio + (activar ? ' · activa' : ''), timer: 1400, showConfirmButton: false });
  });
}

async function tcfgMover_(){
  const b = document.getElementById('tcfg-mover');
  const id = String(document.getElementById('tcfg-mid').value || '').trim().toUpperCase();
  const anio = document.getElementById('tcfg-manio').value;
  if (!/^COM\d+$/.test(id)) return Swal.fire({ icon: 'warning', title: 'Escribe el ID del registro', text: 'Ejemplo: COM000123' });
  const ok = await Swal.fire({ icon: 'question', title: 'Mover de temporada', html: `¿Pasar <b>${esc_(id)}</b> a la temporada <b>${anio}</b>?`,
    showCancelButton: true, confirmButtonText: 'Mover', cancelButtonText: 'Cancelar' });
  if (!ok.isConfirmed) return;
  await tcfgGuardar_(b, async () => {
    const r = await apiPost('moverTemporada', { usuarioId: currentUser.id, id, anio });
    /* Se parcha en memoria el año de ese registro en las listas que ya
       estén cargadas (Comercial y Contador), sin recargarlas. */
    [typeof COM !== 'undefined' ? COM.todos : null, typeof CONTA !== 'undefined' ? CONTA.todos : null].forEach(lista => {
      (lista || []).forEach(x => { if (x && x.id === r.id) x.anio = r.anio; });
    });
    if (typeof TEMP !== 'undefined') TEMP.oyentes.forEach(fn => { try { fn(TEMP.anio); } catch (_) {} });
    Swal.fire({ icon: 'success', title: r.cambio ? 'Registro movido' : 'Ya estaba en ese año', text: id + ' → ' + r.anio, timer: 1500, showConfirmButton: false });
  });
}
