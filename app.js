/* ============================================================
 * SEP GROUP — APP FRONTEND (PWA)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario. Modificarlo anula la garantía de funcionamiento.
 * FASE ACTUAL: Fase 7 — Chat interno por lead (sondeo / polling)
 *   Hilo de colaboración del equipo por cada lead (NO participa el
 *   estudiante). Lee con historialChat (refresco periódico) y envía
 *   con enviarMensajeChat. Sin Firebase en el cliente.
 *   SEP-AGENDA queda intacta. Ver sección "CHAT INTERNO POR LEAD".
 * ============================================================ */

/* ================== CONFIGURACIÓN ================== */
// 👇 Pega aquí la URL /exec de tu Apps Script desplegado (Setup → Implementar)
const API_BASE = 'https://script.google.com/macros/s/AKfycbyrb7dXsicBPJwEkkMJJfojtkPhfKeBxiFKqMHac348M94apbwLsRaz0bhpL0sX8HoTSQ/exec';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

/* ================== LOADER ================== */
const loader = $('#loader');
let loadingCount = 0, loaderTimer = null;
function startLoading(){ loadingCount++; if (loadingCount === 1){ loaderTimer = setTimeout(()=>{ loader.classList.remove('hidden'); loaderTimer=null; }, 120); } }
function stopLoading(){ if (loadingCount===0) return; loadingCount--; if (loadingCount===0){ if (loaderTimer){clearTimeout(loaderTimer);loaderTimer=null;} loader.classList.add('hidden'); } }

/* ================== API (text/plain evita preflight CORS) ================== */
async function apiGet(action, params = {}){
  startLoading();
  try{
    const url = new URL(API_BASE);
    url.search = new URLSearchParams({ action, ...params }).toString();
    const r = await fetch(url.toString(), { method:'GET' });
    const j = await r.json();
    if(!j.ok) throw new Error(j.error || 'Error');
    return j.data;
  } finally { stopLoading(); }
}
async function apiPost(action, body = {}){
  startLoading();
  try{
    const url = API_BASE + '?action=' + encodeURIComponent(action);
    const r = await fetch(url, { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const j = await r.json();
    if(!j.ok) throw new Error(j.error || 'Error');
    return j.data;
  } finally { stopLoading(); }
}

/* ================== SESIÓN ================== */
let currentUser = null;
const SESSION_KEY = 'sepUser';
function guardarSesion_(u){ currentUser = u; try{ localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }catch(_){} }
function recuperarSesion_(){ try{ const s = localStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; }catch(_){ return null; } }
function cerrarSesion_(){ currentUser = null; try{ localStorage.removeItem(SESSION_KEY); }catch(_){} }

/* ================== VISTAS ================== */
function showView(id){
  $$('.view').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('view-' + id) || document.getElementById(id);
  el?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ================== BANNER DE CRÉDITOS ================== */
function pintarBanners_(){ /* el banner es un GIF estático en el HTML */ }

/* ================== PWA: INSTALACIÓN ================== */
let deferredPrompt = null;
function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: installed)').matches
      || window.navigator.standalone === true;
}
function isIOS(){ return /(iphone|ipad|ipod)/i.test(navigator.userAgent || ''); }
function isMarkedInstalled(){ try{ return localStorage.getItem('pwaInstalledFlag')==='1'; }catch(_){ return false; } }
function markInstalled(){ try{ localStorage.setItem('pwaInstalledFlag','1'); }catch(_){} }
function clearInstalledMark(){ try{ localStorage.removeItem('pwaInstalledFlag'); }catch(_){} }

async function detectInstalled(){
  if (isStandalone()) return true;
  if (typeof navigator.getInstalledRelatedApps === 'function'){
    try{
      const apps = await navigator.getInstalledRelatedApps();
      if (apps.some(a => a.platform === 'webapp')){ markInstalled(); return true; }
      clearInstalledMark();
    }catch(_){}
  }
  return isMarkedInstalled();
}

/* Muestra la sección Android o iOS según el dispositivo */
function updateInstallSection(){
  $('#install-android')?.classList.add('hidden');
  $('#install-ios')?.classList.add('hidden');
  if (isIOS()){
    $('#install-ios')?.classList.remove('hidden');
  } else {
    $('#install-android')?.classList.remove('hidden');
    const btn = $('#btn-install');
    if (btn) btn.style.display = deferredPrompt ? '' : 'none';
  }
}

window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e;
  if (!isMarkedInstalled() && !isStandalone()) updateInstallSection();
});
window.addEventListener('appinstalled', ()=>{ markInstalled(); deferredPrompt = null; });

function bindInstall_(){
  const btnInstall = $('#btn-install');
  if (btnInstall){
    btnInstall.addEventListener('click', async ()=>{
      if (isIOS()){
        Swal.fire({ icon:'info', title:'¡Para instalar en tu iPhone!',
          html:`<div style="text-align:center;margin-top:8px;">
            <div><b>1.</b> Toca <b>Compartir</b>.<br><b>2.</b> Elige <b>"Añadir a pantalla de inicio"</b>.<br><b>3.</b> Confirma <b>"Añadir"</b>.</div></div>` });
        return;
      }
      if (!deferredPrompt){ Swal.fire({icon:'info', title:'Instalación no disponible todavía'}); return; }
      const dp = deferredPrompt; dp.prompt();
      const choice = await dp.userChoice; deferredPrompt = null;
      if (choice.outcome === 'accepted'){
        markInstalled();
        Swal.fire({ icon:'success', title:'¡App instalándose!',
          html:`<div style="text-align:center;margin-top:8px;">
            <div class="spinner" style="margin:6px auto 14px;width:46px;height:46px;"></div>
            <div>Espera unos segundos mientras el sistema instala la App.</div>
            <div style="margin-top:10px;"><b>Al cerrarse este aviso, busca <span style="color:#263143;">SEP GROUP</span> en la pantalla de inicio de tu dispositivo.</b></div></div>`,
          timer: 11000, showConfirmButton: false, didOpen: ()=> pintarSpinnerSwal_() });
      } else {
        Swal.fire({ icon:'info', title:'Instalación cancelada' });
      }
      updateInstallSection();
    });
  }
  ['btn-cont-web','btn-cont-web-ios'].forEach(id=>{
    $('#'+id)?.addEventListener('click', ()=> showView('login'));
  });
}
/* arma las 12 barritas del spinner dentro del SweetAlert */
function pintarSpinnerSwal_(){
  const sp = document.querySelector('.swal2-popup .spinner');
  if (sp && !sp.children.length){ for(let i=0;i<12;i++) sp.appendChild(document.createElement('i')); }
}

/* ================== AUTO-UPDATE (version.js) ================== */
let APP_VERSION_LOADED = '';
let __verInFlight = false;
async function checkVersion(){
  if (__verInFlight) return; __verInFlight = true;
  try{
    const r = await fetch('./version.js?t=' + Date.now(), { cache:'no-store' });
    if (!r.ok) return;
    const raw = await r.text();
    let v = '';
    try { const j = JSON.parse(raw); v = String(j.version || j.v || '').trim(); }
    catch(_){ const m = raw.match(/['"]?version['"]?\s*[:=]\s*['"]([^'"]+)['"]/i) || raw.match(/(\d+\.\d+(?:\.\d+)?)/); if (m) v = String(m[1]).trim(); }
    if (!v) return;
    if (!APP_VERSION_LOADED){
      APP_VERSION_LOADED = v;
      $$('.app-version-line').forEach(el => el.textContent = 'Versión ' + v);
      return;
    }
    if (v !== APP_VERSION_LOADED){
      try{ const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }catch(_){}
      location.reload();
    }
  } finally { __verInFlight = false; }
}

/* ================== ARRANQUE ================== */
if ('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
window.addEventListener('load', initApp_);

async function initApp_(){
  pintarBanners_();
  bindInstall_();
  // versión: usa la global del <script> y luego confirma por red
  if (typeof APP_VERSION !== 'undefined' && APP_VERSION){
    APP_VERSION_LOADED = String(APP_VERSION);
    $$('.app-version-line').forEach(el => el.textContent = 'Versión ' + APP_VERSION);
  }
  checkVersion();
  setInterval(checkVersion, 60000);

  cargarBootstrap_();

  const installed = await detectInstalled();
  if (!installed){ showView('instalar'); updateInstallSection(); return; }

  const u = recuperarSesion_();
  if (u){ currentUser = u; irAInicio_(u); }
  else  { showView('login'); }
}

async function cargarBootstrap_(){
  try{
    const b = await apiGet('bootstrap');
    if (b?.config?.COLOR_PRIMARY) document.documentElement.style.setProperty('--primary', b.config.COLOR_PRIMARY);
    if (b?.config?.COLOR_ACCENT)  document.documentElement.style.setProperty('--accent',  b.config.COLOR_ACCENT);
  }catch(_){}
}

/* ================== LOGIN: tabs ================== */
$$('.login-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    $$('.login-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    $('#tab-doc').classList.toggle('hidden', which !== 'doc');
    $('#tab-pin').classList.toggle('hidden', which !== 'pin');
  });
});

/* ================== LOGIN: documento ================== */
function onlyDigits(s){ return String(s||'').replace(/\D/g,''); }
$('#login-doc')?.addEventListener('input', (e)=>{ e.target.value = onlyDigits(e.target.value).slice(0,12); });
$('#toggle-doc')?.addEventListener('click', ()=>{
  const el = $('#login-doc'); const oculto = el.type === 'password';
  el.type = oculto ? 'text' : 'password';
  $('#toggle-doc-img').src = oculto
    ? 'https://res.cloudinary.com/dqqeavica/image/upload/v1764084782/Ocultar_lgdxpd.png'
    : 'https://res.cloudinary.com/dqqeavica/image/upload/v1764084782/Mostrar_yymceh.png';
});
$('#btn-login-doc')?.addEventListener('click', async ()=>{
  const doc = onlyDigits($('#login-doc').value);
  if (!doc){ Swal.fire({icon:'warning', title:'Ingresa tu documento'}); return; }
  try{
    const u = await apiGet('login', { documento: doc });
    if (!u.encontrado){ Swal.fire({icon:'error', title:'Usuario no encontrado o inactivo'}); return; }
    entrar_(u);
  }catch(e){ manejarErrorLogin_(e); }
});

/* ================== LOGIN: PIN ================== */
let pinBuffer = '';
function pintarPinDots_(){ $$('.pin-dot').forEach((d,i)=> d.classList.toggle('filled', i < pinBuffer.length)); }
$$('.pin-key').forEach(key=>{
  key.addEventListener('click', async ()=>{
    const k = key.dataset.key;
    if (k === 'clear'){ pinBuffer=''; pintarPinDots_(); return; }
    if (k === 'back'){ pinBuffer = pinBuffer.slice(0,-1); pintarPinDots_(); return; }
    if (pinBuffer.length >= 4) return;
    pinBuffer += k; pintarPinDots_();
    if (pinBuffer.length === 4){
      const pin = pinBuffer;
      try{
        const u = await apiGet('loginPin', { pin });
        if (!u.encontrado){ Swal.fire({icon:'error', title:'PIN incorrecto'}); pinBuffer=''; pintarPinDots_(); return; }
        entrar_(u);
      }catch(e){ pinBuffer=''; pintarPinDots_(); manejarErrorLogin_(e); }
    }
  });
});

function manejarErrorLogin_(e){
  const msg = String(e.message || e);
  if (/horario|entre .* y/i.test(msg)) Swal.fire({ icon:'warning', title:'Fuera de horario', text: msg });
  else Swal.fire({ icon:'error', title:'No se pudo iniciar sesión', text: msg });
}

function entrar_(u){
  guardarSesion_(u);
  irAInicio_(u);
  Swal.fire({ icon:'success', title:'Bienvenido', text: u.nombre, timer:1100, showConfirmButton:false });
}

/* ================== INICIO: tiles por rol ================== */
const TILES = [
  { key:'comercial', titulo:'Comercial', desc:'Leads, seguimiento y dashboard',
    icono:'https://res.cloudinary.com/dqqeavica/image/upload/v1782391218/comercial_vlu9py.webp',
    roles:['DESARROLLADOR','SUPERUSUARIO','CONTADOR','COMERCIAL'], listo:true, view:'comercial' },
  { key:'usuarios', titulo:'Usuarios', desc:'Gestionar el equipo',
    icono:'https://res.cloudinary.com/dqqeavica/image/upload/v1776287377/usuarios_dkzfqk.webp',
    roles:['DESARROLLADOR','SUPERUSUARIO'], listo:false },
  { key:'config', titulo:'Configuración', desc:'Ajustes del sistema',
    icono:'https://res.cloudinary.com/dqqeavica/image/upload/v1778860851/base_de_datos_cty8xc.webp',
    roles:['DESARROLLADOR','SUPERUSUARIO'], listo:true },
  { key:'bot', titulo:'Mi Bot', desc:'WhatsApp y plantillas',
    icono:'https://res.cloudinary.com/dqqeavica/image/upload/v1776016986/chat_sueco4.webp',
    roles:['DESARROLLADOR','SUPERUSUARIO'], listo:false }
];

function irAInicio_(u){
  $('#welcome-name').textContent = (u.nombre || '').split(' ').slice(0,2).join(' ');
  $('#welcome-rol').textContent  = u.rol || '';
  if (u.fotoUrl) $('#welcome-avatar').src = u.fotoUrl;

  const rol = String(u.rol || '').toUpperCase();
  const visibles = (rol === 'DESARROLLADOR') ? TILES : TILES.filter(t => t.roles.indexOf(rol) >= 0);

  const grid = $('#inicio-menu-grid');
  grid.innerHTML = '';
  visibles.forEach(t => {
    const tile = document.createElement('button');
    tile.className = 'menu-tile' + (t.listo ? '' : ' soon');
    tile.innerHTML = `
      <img src="${t.icono}" alt="${t.titulo}" loading="lazy" />
      <div class="menu-tile__title">${t.titulo}</div>
      <div class="menu-tile__desc">${t.desc}</div>
      ${t.listo ? '' : '<span class="menu-tile__badge">PRONTO</span>'}`;
    tile.addEventListener('click', ()=>{
      if (!t.listo){
        Swal.fire({ icon:'info', title:t.titulo, text:'Disponible en la próxima fase.' });
        return;
      }
      if (t.key === 'comercial'){ abrirComercial_(); }
      else if (t.key === 'config'){ abrirConfig_(); }
    });
    grid.appendChild(tile);
  });

  showView('inicio');
}

$('#btn-logout')?.addEventListener('click', async ()=>{
  const r = await Swal.fire({ icon:'question', title:'¿Cerrar sesión?', showCancelButton:true, confirmButtonText:'Salir', cancelButtonText:'Cancelar' });
  if (!r.isConfirmed) return;
  cerrarSesion_(); pinBuffer=''; pintarPinDots_(); showView('login');
});

/* ============================================================
 * MÓDULO COMERCIAL (Parte 2)
 * ============================================================ */
let COM = { catalogo:null, ubic:null, registros:[], filtroTexto:'', filtroEstado:'__ALL__', editId:null };

/* Navegación por data-go (botones "volver") */
document.addEventListener('click', (e)=>{
  const b = e.target.closest('[data-go]');
  if (b){ showView(b.getAttribute('data-go')); }
});

async function abrirComercial_(){
  showView('comercial');
  try{
    if (!COM.catalogo){
      const [cat, ubic] = await Promise.all([ apiGet('getCatalogoComercial'), apiGet('getUbicaciones') ]);
      COM.catalogo = cat; COM.ubic = ubic;
    }
    await recargarComercial_();
  }catch(e){ Swal.fire({icon:'error', title:'No se pudo cargar', text:String(e.message||e)}); }
}

async function recargarComercial_(){
  COM.registros = await apiGet('listComercial');
  renderPills_(); renderCards_();
}

/* ── Pastillas por estado ── */
function renderPills_(){
  const cont = $('#com-pills'); if (!cont) return;
  const counts = {}; COM.registros.forEach(r => counts[r.estado] = (counts[r.estado]||0)+1);
  const estados = (COM.catalogo?.estados || []);
  let html = pill_('__ALL__', 'Todos', COM.registros.length, '#263143');
  estados.forEach(e => { if (counts[e.clave]) html += pill_(e.clave, e.label, counts[e.clave], e.color); });
  cont.innerHTML = html;
  $$('#com-pills .pill').forEach(p => p.addEventListener('click', ()=>{
    COM.filtroEstado = p.dataset.estado; renderPills_(); renderCards_();
  }));
}
function pill_(clave, label, count, color){
  const active = COM.filtroEstado === clave;
  const style = active ? `style="background:${color}"` : '';
  return `<button class="pill ${active?'active':''}" data-estado="${clave}" ${style}>
    <span class="pill__dot" style="background:${color}"></span>${label}
    <span class="pill__count">${count}</span></button>`;
}

/* ── Tarjetas ── */
function renderCards_(){
  const cont = $('#com-cards'); const empty = $('#com-empty'); if (!cont) return;
  const txt = COM.filtroTexto.trim().toLowerCase();
  let list = COM.registros.slice(); // ya viene más antiguas primero
  if (COM.filtroEstado !== '__ALL__') list = list.filter(r => r.estado === COM.filtroEstado);
  if (txt) list = list.filter(r =>
    (`${r.nombres} ${r.apellidos}`).toLowerCase().includes(txt) ||
    String(r.whatsapp||'').includes(txt) ||
    String(r.correo||'').toLowerCase().includes(txt));

  empty.classList.toggle('hidden', list.length > 0);
  cont.innerHTML = list.map(cardHtml_).join('');
  list.forEach(r => bindCard_(r));
}

function fuenteIcon_(nombre){
  const f = (COM.catalogo?.fuentes || []).find(x => x.nombre === nombre);
  return f && f.iconoUrl ? `<img src="${f.iconoUrl}" alt="">` : '';
}
function esc_(s){ return String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function cardHtml_(r){
  const puedeEliminar = currentUser && (currentUser.isSuper || currentUser.isDev);
  const verIc='https://res.cloudinary.com/dqqeavica/image/upload/v1764084782/Mostrar_yymceh.png';
  const editIc='https://res.cloudinary.com/dqqeavica/image/upload/v1778860851/base_de_datos_cty8xc.webp';
  const chatIc='https://res.cloudinary.com/dqqeavica/image/upload/v1776016986/chat_sueco4.webp';
  const delIc='https://res.cloudinary.com/dqqeavica/image/upload/v1778860851/base_de_datos_cty8xc.webp';
  return `<div class="com-card" id="card-${r.id}">
    <div class="com-card__stripe" style="background:${r.estadoColor}"></div>
    <div class="com-card__top">
      <h3 class="com-card__name">${esc_(r.nombres)} ${esc_(r.apellidos)}</h3>
      <span class="com-card__id">${r.id}</span>
    </div>
    <span class="com-badge" style="background:${r.estadoColor}">${esc_(r.estadoLabel)}</span>
    <div class="com-card__meta">
      <span>📱 ${esc_(r.whatsapp)}</span>
      ${r.programa?`<span>🎓 ${esc_(r.programa)}</span>`:''}
      ${r.fuente?`<span>${fuenteIcon_(r.fuente)} ${esc_(r.fuente)}</span>`:''}
      ${r.asesor?`<span>👤 ${esc_(r.asesor)}</span>`:''}
    </div>
    ${r.fechaHoraAgendada?`<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <span class="com-card__agenda">🗓️ ${esc_(r.fechaHoraAgendada)}</span>
      ${r.meetLink?`<a class="btn-meet" href="${esc_(r.meetLink)}" target="_blank" rel="noopener">▶ Entrar a Meet</a>`:''}
    </div>`:''}
    <div class="com-card__actions">
      <button class="act-btn act-ver" data-act="ver"><img src="${verIc}">Ver</button>
      <button class="act-btn act-editar" data-act="editar">✏️ Editar</button>
      <button class="act-btn act-chat" data-act="chat"><img src="${chatIc}">Chat</button>
      ${puedeEliminar?`<button class="act-btn act-eliminar" data-act="eliminar">🗑 Eliminar</button>`:''}
    </div>
  </div>`;
}

function bindCard_(r){
  const card = $('#card-'+r.id); if (!card) return;
  card.querySelector('[data-act="ver"]')?.addEventListener('click', ()=> verComercial_(r.id));
  card.querySelector('[data-act="editar"]')?.addEventListener('click', ()=> abrirModalComercial_(r));
  card.querySelector('[data-act="chat"]')?.addEventListener('click', ()=> abrirChat_(r));
  card.querySelector('[data-act="eliminar"]')?.addEventListener('click', ()=> eliminarComercial_(r));
}

/* ── Buscar ── */
$('#com-search')?.addEventListener('input', (e)=>{ COM.filtroTexto = e.target.value; renderCards_(); });
$('#com-dashboard-btn')?.addEventListener('click', ()=>{
  Swal.fire({icon:'info', title:'Dashboard', text:'El dashboard dinámico llega en una próxima parte.'});
});

/* ── Detalle (Ver) ── */
async function verComercial_(id){
  try{
    const r = await apiGet('verComercial', { id });
    COM.detalleActual = r;
    const puedeEliminar = currentUser && (currentUser.isSuper || currentUser.isDev);
    const d = (l,v)=>`<div class="d-item"><label>${l}</label><div class="d-val">${esc_(v)||'—'}</div></div>`;
    const traza = (r.trazabilidad||[]).map(t=>{
      const i = String(t).indexOf(',');
      const est = i>0 ? t.slice(0,i) : t; const fec = i>0 ? t.slice(i+1).trim() : '';
      return `<li><b>${esc_(est)}</b>${fec?` · ${esc_(fec)}`:''}</li>`;
    }).join('');
    const hayCiclo = r.enSeguimiento || (r.seguimientos||[]).some(s=>s.prog||s.enviado);
    const segHtml = !hayCiclo ? '' : `<div class="det-seg-box"><h4>🔔 Ciclo de seguimientos</h4><div class="det-seg-list">` +
      (r.seguimientos||[]).map(s=>`
        <div class="det-seg-row${s.actual?' actual':''}">
          <div class="det-seg-info">
            <b>${esc_(s.label)}${s.actual?' · actual':''}</b>
            <span class="det-seg-when">${s.prog?esc_(s.prog):'—'}</span>
          </div>
          <span class="seg-state${s.enviado?'':' pend'}">${s.enviado?'✅ enviado':(s.prog?'⏳ pendiente':'—')}</span>
        </div>`).join('') + `</div></div>`;
    $('#com-detalle').innerHTML = `
      <div class="detalle-card">
        <div class="detalle-hero">
          <h2>${esc_(r.nombres)} ${esc_(r.apellidos)}</h2>
          <span class="com-badge" style="background:${r.estadoColor}">${esc_(r.estadoLabel)}</span>
        </div>
        <div class="detalle-grid">
          ${d('ID', r.id)} ${d('Ingreso', r.fechaIngreso)}
          ${d('WhatsApp', r.whatsapp)} ${d('Teléfono', r.telefono)}
          <div class="d-item full">${d('Correo', r.correo)}</div>
          ${d('Departamento', r.departamento)} ${d('Municipio', r.municipio)}
          ${d('Fuente', r.fuente)} ${d('Asesor', r.asesor)}
          ${d('Programa', r.programa)} ${d('Promo', r.promo)}
          ${d('Clave de acceso', r.claveAcceso)} ${d('Asesoría agendada', r.fechaHoraAgendada)}
          ${d('Fecha realizada', r.fechaAsesoria)} ${d('Registró', r.usuario)}
        </div>
        ${r.meetLink?`<div style="padding:0 22px 8px;"><a class="btn-meet" href="${esc_(r.meetLink)}" target="_blank" rel="noopener">▶ Entrar a la reunión Meet</a></div>`:''}
        <div class="detalle-acciones">
          <button class="act-btn act-editar" id="det-editar">✏️ Editar</button>
          <button class="act-btn act-chat" id="det-chat">💬 Chat</button>
          ${puedeEliminar?`<button class="act-btn act-eliminar" id="det-eliminar">🗑 Eliminar</button>`:''}
        </div>
        ${segHtml}
        ${traza?`<div class="traza-box"><h4>📜 Trazabilidad</h4><ul class="traza-list">${traza}</ul></div>`:''}
      </div>`;
    $('#det-editar')?.addEventListener('click', ()=> abrirModalComercial_(r));
    $('#det-chat')?.addEventListener('click', ()=> abrirChat_(r));
    $('#det-eliminar')?.addEventListener('click', ()=> eliminarComercial_(r).then(()=> showView('comercial')));
    showView('comercial-detalle');
  }catch(e){ Swal.fire({icon:'error', title:'Error', text:String(e.message||e)}); }
}

/* ── Eliminar ── */
async function eliminarComercial_(r){
  const ok = await Swal.fire({ icon:'warning', title:'Eliminar lead',
    html:`¿Eliminar a <b>${esc_(r.nombres)} ${esc_(r.apellidos)}</b> (${r.id})?<br>Esta acción no se puede deshacer.`,
    showCancelButton:true, confirmButtonText:'Eliminar', cancelButtonText:'Cancelar', confirmButtonColor:'#dc2626' });
  if (!ok.isConfirmed) return;
  try{
    await apiPost('eliminarComercial', { id:r.id, usuarioId: currentUser.id });
    await recargarComercial_();
    Swal.fire({icon:'success', title:'Eliminado', timer:1000, showConfirmButton:false});
  }catch(e){ Swal.fire({icon:'error', title:'No se pudo eliminar', text:String(e.message||e)}); }
}

/* ============================================================
 *  CHAT INTERNO POR LEAD (Fase 7 — sondeo / polling)
 * ------------------------------------------------------------
 *  Hilo de colaboración del equipo por cada lead. El backend
 *  (hoja CHAT) es la fuente de verdad. El cliente LEE con
 *  historialChat (refresco cada CHAT.intervaloMs mientras el chat
 *  está abierto) y ENVÍA vía enviarMensajeChat. Sin Firebase en el
 *  cliente. El estudiante NO participa.
 * ============================================================ */
const CHAT = {
  leadId:null, leadNombre:'', yoUid:null,
  timer:null, intervaloMs:4000, cargando:false, sig:'', visible:true
};

/* Abre el chat para un lead (recibe el objeto del lead o su id). */
async function abrirChat_(lead){
  if (!currentUser){ Swal.fire({icon:'warning', title:'Inicia sesión'}); return; }
  const leadId = typeof lead === 'string' ? lead : lead.id;
  const nombre = typeof lead === 'string' ? leadId
               : ((lead.nombres||'')+' '+(lead.apellidos||'')).trim();
  CHAT.leadId = leadId; CHAT.leadNombre = nombre || leadId; CHAT.sig = '';

  $('#chat-lead-name').textContent = CHAT.leadNombre;
  $('#chat-msgs').innerHTML = `<div class="chat-empty">Cargando conversación…</div>`;
  chatStatus_('');
  chatAbrirUI_();

  try{
    await chatCargar_(true);   // primera carga (fuerza render)
    chatIniciarPolling_();     // refrescos periódicos
  }catch(e){
    $('#chat-msgs').innerHTML = `<div class="chat-empty">No se pudo cargar el chat.</div>`;
    chatStatus_(String(e && e.message || e));
  }
}

/* Trae el historial desde la hoja CHAT y repinta solo si cambió. */
async function chatCargar_(forzar){
  if (CHAT.cargando || !CHAT.leadId) return;
  CHAT.cargando = true;
  try{
    const hist = await apiPost('historialChat', { usuarioId: currentUser.id, leadId: CHAT.leadId });
    if (!CHAT.leadId) return; // se cerró mientras cargaba
    CHAT.yoUid = (hist.yo && hist.yo.uid) || CHAT.yoUid;
    const msgs = hist.mensajes || [];
    const sig  = msgs.length + '|' + (msgs.length ? (msgs[msgs.length-1].id + '|' + msgs[msgs.length-1].ts) : '0');
    if (forzar || sig !== CHAT.sig){
      CHAT.sig = sig;
      chatRender_(msgs);
    }
    chatStatus_('');
  } finally { CHAT.cargando = false; }
}

/* Arranca/recrea el ciclo de sondeo (se pausa si la pestaña no está visible). */
function chatIniciarPolling_(){
  chatDetenerPolling_();
  CHAT.timer = setInterval(()=>{
    if (document.hidden) return;        // ahorra cuota si la pestaña está oculta
    chatCargar_(false).catch(()=>{});
  }, CHAT.intervaloMs);
}
function chatDetenerPolling_(){
  if (CHAT.timer){ clearInterval(CHAT.timer); CHAT.timer = null; }
}

/* Pinta la lista de mensajes (burbujas; las propias a la derecha).
   Conserva la posición de lectura: solo baja al fondo si ya estabas
   cerca del fondo (para no interrumpir si estás leyendo arriba). */
function chatRender_(msgs){
  const box = $('#chat-msgs'); if (!box) return;
  if (!msgs || !msgs.length){
    box.innerHTML = `<div class="chat-empty">Aún no hay mensajes. ¡Inicia la conversación del equipo!</div>`;
    return;
  }
  const cercaDelFondo = (box.scrollHeight - box.scrollTop - box.clientHeight) < 80;
  const rolClase = { DESARROLLADOR:'dev', SUPERUSUARIO:'super', CONTADOR:'conta', COMERCIAL:'com' };
  box.innerHTML = msgs.map(m=>{
    const mio = m.uid && CHAT.yoUid && m.uid === CHAT.yoUid;
    const rc = rolClase[String(m.rol||'').toUpperCase()] || 'com';
    const hora = chatHora_(m.ts);
    return `<div class="chat-row ${mio?'mio':'otro'}">
      <div class="chat-bubble">
        ${mio?'':`<span class="chat-autor rol-${rc}">${esc_(m.autor||'—')}</span>`}
        <span class="chat-texto">${chatTexto_(m.texto)}</span>
        <span class="chat-hora">${esc_(hora)}</span>
      </div>
    </div>`;
  }).join('');
  if (cercaDelFondo) box.scrollTop = box.scrollHeight;
}

/* Envía un mensaje y refresca de inmediato. */
async function chatEnviar_(){
  const inp = $('#chat-input'); if (!inp) return;
  const txt = (inp.value||'').trim();
  if (!txt || !CHAT.leadId) return;
  inp.value=''; chatAutoGrow_();
  try{
    await apiPost('enviarMensajeChat', { usuarioId: currentUser.id, leadId: CHAT.leadId, texto: txt });
    await chatCargar_(true); // refleja el envío al instante
  }catch(e){
    inp.value = txt;
    Swal.fire({icon:'error', title:'No se envió', text:String(e && e.message || e)});
  }
}

/* ── UI helpers ── */
function chatAbrirUI_(){
  const ov = $('#sep-chat'); if (!ov) return;
  ov.classList.remove('hidden'); ov.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  setTimeout(()=> $('#chat-input')?.focus(), 50);
}
function chatCerrarUI_(){
  const ov = $('#sep-chat'); if (!ov) return;
  ov.classList.add('hidden'); ov.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  chatDetenerPolling_();
  CHAT.leadId = null;
}
function chatStatus_(txt){
  const el = $('#chat-status'); if (!el) return;
  if (txt){ el.textContent = txt; el.classList.remove('hidden'); }
  else { el.textContent=''; el.classList.add('hidden'); }
}
function chatHora_(ts){
  const d = ts ? new Date(Number(ts)) : null;
  if (!d || isNaN(d.getTime())) return '';
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2,'0');
  const ap = h>=12?'PM':'AM'; h = h%12; if (h===0) h=12;
  return h+':'+m+' '+ap;
}
function chatTexto_(s){
  // escapa y respeta saltos de línea y *negrita*
  return esc_(s).replace(/\*(.+?)\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
}
function chatAutoGrow_(){
  const inp = $('#chat-input'); if (!inp) return;
  inp.style.height='auto';
  inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
}

/* ── Eventos del overlay (se cablean una sola vez) ── */
$('#chat-close')?.addEventListener('click', chatCerrarUI_);
$('#sep-chat')?.addEventListener('click', (e)=>{ if (e.target.id==='sep-chat') chatCerrarUI_(); });
$('#chat-send')?.addEventListener('click', chatEnviar_);
$('#chat-input')?.addEventListener('input', chatAutoGrow_);
$('#chat-input')?.addEventListener('keydown', (e)=>{
  if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); chatEnviar_(); }
});
document.addEventListener('keydown', (e)=>{
  if (e.key==='Escape' && !$('#sep-chat')?.classList.contains('hidden')) chatCerrarUI_();
});
/* Al volver a la pestaña con el chat abierto, refresca de inmediato. */
document.addEventListener('visibilitychange', ()=>{
  if (!document.hidden && CHAT.leadId) chatCargar_(false).catch(()=>{});
});

/* ============================================================
 *  MODAL — Agregar / Editar
 * ============================================================ */
$('#com-add')?.addEventListener('click', ()=> abrirModalComercial_(null));
$('#com-modal-close')?.addEventListener('click', cerrarModalComercial_);
$('#com-cancel')?.addEventListener('click', cerrarModalComercial_);

function opt_(v, label, sel){ return `<option value="${esc_(v)}" ${sel===v?'selected':''}>${esc_(label||v)}</option>`; }

function abrirModalComercial_(r){
  COM.editId = r ? r.id : null;
  $('#com-modal-title').textContent = r ? 'Editar Registro' : 'Registro Comercial';
  $('#fld-id').style.display = r ? '' : 'none';
  $('#f-id').value = r ? r.id : '';

  // Departamentos
  const deptos = COM.ubic.departamentos;
  $('#f-departamento').innerHTML = '<option value="">— Seleccionar —</option>' + deptos.map(dp=>opt_(dp,dp, r?r.departamento:'')).join('');
  // Municipios (dependiente)
  poblarMunicipios_(r ? r.departamento : '', r ? r.municipio : '');

  // Fuentes
  $('#f-fuente').innerHTML = '<option value="">— Seleccionar —</option>' +
    (COM.catalogo.fuentes||[]).map(f=>opt_(f.nombre, f.nombre, r?r.fuente:'')).join('');
  // Asesores
  $('#f-asesor').innerHTML = '<option value="">— Sin asesor —</option>' +
    (COM.catalogo.asesores||[]).map(a=>opt_(a.nombre, `${a.nombre} (${a.rol})`, r?r.asesor:'')).join('');
  // Estados (seguimientos son automáticos: ocultos salvo el actual; en seguimiento solo salidas permitidas)
  const puedeInscribir = currentUser && (currentUser.isDev || currentUser.isSuper || String(currentUser.rol).toUpperCase()==='CONTADOR');
  const estadoActual = r ? r.estado : 'NUEVO_LEAD';
  const enSeg = /^SEGUIMIENTO_[1-4]$/.test(estadoActual);
  const SEG_SALIDA = ['PERFIL_NO_APTO','SIN_RESPUESTA','NO_INTERESADO','PENDIENTE_PAGO','INSCRITO'];
  $('#f-estado').innerHTML = (COM.catalogo.estados||[])
    .filter(e => {
      if (e.clave==='INSCRITO' && !puedeInscribir) return false;
      if (enSeg) return e.clave===estadoActual || SEG_SALIDA.indexOf(e.clave)>=0;
      return !/^SEGUIMIENTO_[1-4]$/.test(e.clave);
    })
    .map(e=>opt_(e.clave, e.label, estadoActual)).join('');
  // Programas / Promos
  $('#f-programa').innerHTML = '<option value="">— Ninguno —</option>' +
    (COM.catalogo.programas||[]).map(p=>opt_(p.nombre, p.nombre, r?r.programa:'')).join('');
  $('#f-promo').innerHTML = '<option value="">— Ninguna —</option>' +
    (COM.catalogo.promos||[]).map(p=>opt_(p.nombre, p.nombre, r?r.promo:'')).join('');

  // Campos de texto
  $('#f-nombres').value   = r ? r.nombres   : '';
  $('#f-apellidos').value = r ? r.apellidos : '';
  $('#f-whatsapp').value  = r ? r.whatsapp  : '';
  $('#f-telefono').value  = r ? r.telefono  : '';
  $('#f-correo').value    = r ? r.correo    : '';
  const fhRaw = r && r.fechaHoraAgendadaRaw ? r.fechaHoraAgendadaRaw : '';
  $('#f-fecha-hora-agendada').value = fhRaw;
  $('#f-agenda-text').textContent = (r && r.fechaHoraAgendada) ? r.fechaHoraAgendada : 'Seleccionar fecha y hora';

  actualizarVisibilidadEstado_();
  actualizarVisibilidadAgenda_();
  $('#modal-comercial').classList.remove('hidden');
}
function cerrarModalComercial_(){ $('#modal-comercial').classList.add('hidden'); }

function poblarMunicipios_(depto, sel){
  const lista = (depto && COM.ubic.mapa[String(depto).toUpperCase()]) || [];
  $('#f-municipio').innerHTML = '<option value="">— Seleccionar —</option>' + lista.map(m=>opt_(m,m,sel)).join('');
}

/* Estado visible solo si hay asesor */
function actualizarVisibilidadEstado_(){
  const hayAsesor = !!$('#f-asesor').value;
  $('#fld-estado').style.display = hayAsesor ? '' : 'none';
}
function actualizarVisibilidadAgenda_(){
  const est = $('#f-estado').value;
  $('#fld-agenda').style.display = est === 'ASESORIA_AGENDADA' ? '' : 'none';
}

$('#f-departamento')?.addEventListener('change', e => poblarMunicipios_(e.target.value, ''));
$('#f-asesor')?.addEventListener('change', actualizarVisibilidadEstado_);
$('#f-estado')?.addEventListener('change', actualizarVisibilidadAgenda_);
['f-nombres','f-apellidos'].forEach(id=> $('#'+id)?.addEventListener('input', e=>{ e.target.value = e.target.value.toUpperCase(); }));
['f-whatsapp','f-telefono'].forEach(id=> $('#'+id)?.addEventListener('input', e=>{ e.target.value = onlyDigits(e.target.value).slice(0,10); }));

$('#com-save')?.addEventListener('click', guardarComercial_);
async function guardarComercial_(){
  const body = {
    usuarioId: currentUser.id, usuario: currentUser.nombre,
    nombres: $('#f-nombres').value, apellidos: $('#f-apellidos').value,
    whatsapp: $('#f-whatsapp').value, telefono: $('#f-telefono').value,
    correo: $('#f-correo').value,
    departamento: $('#f-departamento').value, municipio: $('#f-municipio').value,
    fuente: $('#f-fuente').value, asesor: $('#f-asesor').value,
    estado: $('#f-asesor').value ? $('#f-estado').value : 'NUEVO_LEAD',
    fechaHoraAgendada: $('#f-fecha-hora-agendada').value,
    programa: $('#f-programa').value, promo: $('#f-promo').value
  };
  // Validación rápida en cliente
  if (!body.nombres.trim() || !body.apellidos.trim()) return Swal.fire({icon:'warning', title:'Nombres y apellidos obligatorios'});
  if (body.estado === 'ASESORIA_AGENDADA' && !body.fechaHoraAgendada) return Swal.fire({icon:'warning', title:'Selecciona la fecha y hora de la asesoría'});
  if (onlyDigits(body.whatsapp).length !== 10) return Swal.fire({icon:'warning', title:'WhatsApp debe tener 10 dígitos'});
  if (body.telefono && onlyDigits(body.telefono).length !== 10) return Swal.fire({icon:'warning', title:'Teléfono debe tener 10 dígitos'});
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.correo.trim())) return Swal.fire({icon:'warning', title:'Correo no válido'});
  if (!body.departamento || !body.municipio) return Swal.fire({icon:'warning', title:'Selecciona departamento y municipio'});
  if (!body.fuente) return Swal.fire({icon:'warning', title:'Selecciona la fuente del lead'});

  try{
    if (COM.editId){ await apiPost('editarComercial', Object.assign({id:COM.editId}, body)); }
    else { await apiPost('crearComercial', body); }
    cerrarModalComercial_();
    await recargarComercial_();
    Swal.fire({icon:'success', title: COM.editId?'Actualizado':'Registrado', timer:1100, showConfirmButton:false});
  }catch(e){ Swal.fire({icon:'error', title:'No se pudo guardar', text:String(e.message||e)}); }
}

/* ============================================================
 * MÓDULO CONFIGURACIÓN (Parte 3.1)
 * ============================================================ */
let CFG = { data:null };

async function abrirConfig_(){
  showView('config');
  try{
    CFG.data = await apiGet('getConfigFull', { usuarioId: currentUser.id });
    $('#cfg-tab-avanzado').style.display = CFG.data.esDev ? '' : 'none';
    renderCfgGeneral_(); renderCfgProgramas_(); renderCfgPromos_(); renderCfgAgenda_(); renderCfgPlantillas_(); renderCfgAvanzado_();
    activarCfgTab_('general');
  }catch(e){ Swal.fire({icon:'error', title:'No se pudo cargar', text:String(e.message||e)}); }
}

/* Tabs */
$$('.cfg-tab').forEach(t => t.addEventListener('click', ()=> activarCfgTab_(t.dataset.cfgtab)));
function activarCfgTab_(name){
  $$('.cfg-tab').forEach(t => t.classList.toggle('active', t.dataset.cfgtab === name));
  ['general','programas','promos','agenda','plantillas','avanzado'].forEach(p =>
    $('#cfg-'+p).classList.toggle('hidden', p !== name));
}

function field_(id, label, val, type, hint){
  return `<div class="cfg-field ${type==='full'?'full':''}">
    <label>${label}</label>
    <input id="${id}" type="${type==='full'?'text':type}" value="${esc_(val)}" />
    ${hint?`<div class="cfg-hint">${hint}</div>`:''}</div>`;
}

/* ── GENERAL ── */
function renderCfgGeneral_(){
  const g = CFG.data.general;
  $('#cfg-general').innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card__title">🏷️ Identidad</h3>
      <div class="cfg-grid">
        ${field_('cf-APP_NOMBRE','Nombre de la app', g.APP_NOMBRE, 'text')}
        ${field_('cf-LOGO_URL','Logo (URL)', g.LOGO_URL, 'text')}
        <div class="cfg-field"><label>Color primario</label><input id="cf-COLOR_PRIMARY" type="color" value="${esc_(g.COLOR_PRIMARY||'#263143')}"></div>
        <div class="cfg-field"><label>Color acento</label><input id="cf-COLOR_ACCENT" type="color" value="${esc_(g.COLOR_ACCENT||'#d6da09')}"></div>
      </div>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card__title">✉️ Correo</h3>
      <div class="cfg-grid">
        ${field_('cf-EMAIL_REMITENTE','Correo remitente', g.EMAIL_REMITENTE, 'text')}
        ${field_('cf-EMAIL_REMITENTE_NOMBRE','Nombre remitente', g.EMAIL_REMITENTE_NOMBRE, 'text')}
        <div class="cfg-field full cfg-banner-field">
          <label>🖼️ Banner de los correos (URL de imagen)</label>
          <input id="cf-EMAIL_BANNER_URL" type="text" value="${esc_(g.EMAIL_BANNER_URL)}" placeholder="https://res.cloudinary.com/.../banner.png" />
          <div class="cfg-hint">Aquí pegas la imagen del banner cuando la tengas. Encabezará todos los correos HTML automáticamente.</div>
        </div>
        ${field_('cf-EMAIL_FINANCIERO','Correo financiero (comprobantes)', g.EMAIL_FINANCIERO, 'full')}
      </div>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card__title">📅 Agenda y reunión</h3>
      <div class="cfg-grid">
        ${field_('cf-LINK_AGENDA','Link de agenda (Perfil Apto)', g.LINK_AGENDA, 'full')}
        ${field_('cf-LINK_MEET_RESPALDO','Link Meet de respaldo', g.LINK_MEET_RESPALDO, 'full', 'Se usa si la creación automática del evento de Calendar falla.')}
      </div>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card__title">⏰ Acceso del rol COMERCIAL</h3>
      <div class="cfg-grid">
        <div class="cfg-field"><label>Desde</label><input id="cf-COMERCIAL_ACCESO_INICIO" type="time" value="${esc_(g.COMERCIAL_ACCESO_INICIO||'07:00')}"></div>
        <div class="cfg-field"><label>Hasta</label><input id="cf-COMERCIAL_ACCESO_FIN" type="time" value="${esc_(g.COMERCIAL_ACCESO_FIN||'19:00')}"></div>
      </div>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card__title">🏦 Datos bancarios (mensaje de pago)</h3>
      <div class="cfg-grid">
        ${field_('cf-BANCO_NOMBRE','Banco', g.BANCO_NOMBRE, 'text')}
        ${field_('cf-BANCO_CUENTA','Cuenta', g.BANCO_CUENTA, 'text')}
        ${field_('cf-BANCO_TITULAR','Titular', g.BANCO_TITULAR, 'text')}
        ${field_('cf-BANCO_NIT','NIT', g.BANCO_NIT, 'text')}
      </div>
    </div>

    <div class="cfg-actions"><button class="btn btn-primary" id="cf-save-general">Guardar cambios</button></div>`;

  $('#cf-save-general').addEventListener('click', async ()=>{
    const claves = ['APP_NOMBRE','LOGO_URL','COLOR_PRIMARY','COLOR_ACCENT','EMAIL_REMITENTE','EMAIL_REMITENTE_NOMBRE',
      'EMAIL_BANNER_URL','EMAIL_FINANCIERO','LINK_AGENDA','LINK_MEET_RESPALDO','COMERCIAL_ACCESO_INICIO','COMERCIAL_ACCESO_FIN',
      'BANCO_NOMBRE','BANCO_CUENTA','BANCO_TITULAR','BANCO_NIT'];
    const cambios = {}; claves.forEach(k => cambios[k] = $('#cf-'+k).value);
    await guardarConfig_(cambios);
  });
}

async function guardarConfig_(cambios){
  try{
    await apiPost('saveConfig', { usuarioId: currentUser.id, cambios });
    Object.assign(CFG.data.general, cambios);
    Swal.fire({icon:'success', title:'Guardado', timer:900, showConfirmButton:false});
  }catch(e){ Swal.fire({icon:'error', title:'No se pudo guardar', text:String(e.message||e)}); }
}

/* ── PROGRAMAS ── */
function fmtCOP_(n){ return '$ ' + (Number(n)||0).toLocaleString('es-CO'); }
function renderCfgProgramas_(){
  const cont = $('#cfg-programas');
  cont.innerHTML = CFG.data.programas.map((p,i)=>`
    <div class="cfg-card" id="prog-card-${i}">
      <div class="prog-row"><img src="${esc_(p.iconoUrl)}"><b>${esc_(p.nombre)}</b></div>
      <div class="cfg-grid">
        <div class="cfg-field"><label>Precio (COP)</label><input id="pr-precio-${i}" type="text" inputmode="numeric" value="${p.precio||''}"></div>
        <div class="cfg-field"><label>Brochure (PDF)</label>
          <div class="brochure-line">
            ${p.brochureUrl?`<a class="file-btn" href="${esc_(p.brochureUrl)}" target="_blank">👁️ Ver actual</a>`:'<span class="cfg-hint">Sin brochure</span>'}
            <label class="file-btn">${p.brochureUrl?'♻️ Reemplazar':'⬆️ Subir PDF'}<input type="file" accept="application/pdf" style="display:none" id="pr-file-${i}"></label>
            <span class="brochure-ok" id="pr-ok-${i}"></span>
          </div>
        </div>
        <div class="cfg-field full"><label>Condiciones</label><textarea id="pr-cond-${i}" rows="3">${esc_(p.condiciones)}</textarea></div>
      </div>
      <div class="cfg-actions"><button class="btn btn-primary" id="pr-save-${i}">Guardar</button></div>
    </div>`).join('');

  CFG.data.programas.forEach((p,i)=>{
    $('#pr-precio-'+i).addEventListener('input', e=>{ e.target.value = onlyDigits(e.target.value); });
    $('#pr-save-'+i).addEventListener('click', async ()=>{
      try{
        const res = await apiPost('savePrograma', { usuarioId: currentUser.id, id:p.id,
          precio: onlyDigits($('#pr-precio-'+i).value), condiciones: $('#pr-cond-'+i).value });
        CFG.data.programas = res;
        Swal.fire({icon:'success', title:'Programa guardado', timer:900, showConfirmButton:false});
      }catch(e){ Swal.fire({icon:'error', title:'Error', text:String(e.message||e)}); }
    });
    $('#pr-file-'+i).addEventListener('change', async (ev)=>{
      const file = ev.target.files[0]; if (!file) return;
      if (file.type !== 'application/pdf'){ Swal.fire({icon:'warning', title:'Debe ser PDF'}); return; }
      try{
        $('#pr-ok-'+i).textContent = 'Subiendo…';
        const base64 = await fileBase64_(file);
        const res = await apiPost('uploadBrochure', { usuarioId: currentUser.id, id:p.id, filename:file.name, base64 });
        p.brochureUrl = res.url;
        $('#pr-ok-'+i).textContent = '✓ Subido';
        renderCfgProgramas_();
        Swal.fire({icon:'success', title:'Brochure actualizado', timer:1000, showConfirmButton:false});
      }catch(e){ $('#pr-ok-'+i).textContent=''; Swal.fire({icon:'error', title:'No se pudo subir', text:String(e.message||e)}); }
    });
  });
}
function fileBase64_(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=> res(String(r.result).split(',')[1]);
    r.onerror = ()=> rej(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

/* ── PROMOS ── */
function renderCfgPromos_(){
  const cont = $('#cfg-promos');
  const progName = id => (CFG.data.programas.find(p=>p.id===id)||{}).nombre || id;
  const opts = CFG.data.programas.map(p=>`<option value="${p.id}">${esc_(p.nombre)}</option>`).join('');
  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card__title">➕ Agregar promo</h3>
      <div class="cfg-grid">
        <div class="cfg-field"><label>Programa</label><select id="np-prog">${opts}</select></div>
        <div class="cfg-field"><label>Nombre promo</label><input id="np-nom" type="text" placeholder="Verano / Referido / Exparticipante"></div>
        <div class="cfg-field"><label>Descuento (%)</label><input id="np-pct" type="number" min="0" max="100" value="10"></div>
      </div>
      <div class="cfg-actions"><button class="btn btn-accent" id="np-add">Agregar</button></div>
    </div>
    <div class="cfg-card">
      <h3 class="cfg-card__title">🏷️ Promos actuales</h3>
      <div id="promos-list">${
        CFG.data.promos.length ? CFG.data.promos.map(pr=>`
          <div class="promo-item">
            <div><b>${esc_(pr.nombre)}</b><div class="promo-prog">${esc_(progName(pr.programaId))}</div></div>
            <span class="pct">${pr.descuento}%</span>
            <button class="mini-btn danger" data-del="${pr.id}">Eliminar</button>
          </div>`).join('') : '<p class="cfg-hint">Aún no hay promos.</p>'
      }</div>
    </div>`;

  $('#np-add').addEventListener('click', async ()=>{
    const body = { usuarioId: currentUser.id, programaId:$('#np-prog').value, nombre:$('#np-nom').value, descuento:$('#np-pct').value };
    if (!body.nombre.trim()) return Swal.fire({icon:'warning', title:'Nombre requerido'});
    try{ CFG.data.promos = await apiPost('savePromo', body); renderCfgPromos_(); Swal.fire({icon:'success', title:'Promo agregada', timer:900, showConfirmButton:false}); }
    catch(e){ Swal.fire({icon:'error', title:'Error', text:String(e.message||e)}); }
  });
  $$('#promos-list [data-del]').forEach(b => b.addEventListener('click', async ()=>{
    const ok = await Swal.fire({icon:'warning', title:'Eliminar promo', showCancelButton:true, confirmButtonText:'Eliminar', confirmButtonColor:'#dc2626'});
    if (!ok.isConfirmed) return;
    try{ CFG.data.promos = await apiPost('deletePromo', { usuarioId: currentUser.id, id:b.dataset.del }); renderCfgPromos_(); }
    catch(e){ Swal.fire({icon:'error', title:'Error', text:String(e.message||e)}); }
  }));
}

/* ── PLANTILLAS ── */
const PLT_VARS = ['{nombre}','{apellidos}','{programa}','{promo}','{descuento}','{valor}','{link_agenda}','{link_meet}','{fecha_asesoria}','{asesor}','{clave_acceso}'];
function renderCfgPlantillas_(){
  const cont = $('#cfg-plantillas');
  cont.innerHTML = CFG.data.plantillas.map((p,i)=>{
    const conAsunto = p.canal === 'EMAIL' || p.canal === 'AMBOS';
    return `<div class="cfg-card plt-card" id="plt-${i}">
      <h3 class="cfg-card__title">${esc_(p.descripcion||p.clave)} <span class="plt-canal">${esc_(p.canal)}</span></h3>
      ${conAsunto?`<div class="cfg-field"><label>Asunto (correo)</label><input id="plt-asunto-${i}" type="text" value="${esc_(p.asunto)}"></div>`:''}
      <div class="var-chips">${PLT_VARS.map(v=>`<span class="var-chip" data-var="${v}" data-target="plt-cuerpo-${i}">${v}</span>`).join('')}</div>
      <textarea id="plt-cuerpo-${i}">${esc_(p.cuerpo)}</textarea>
      <div class="cfg-actions"><button class="btn btn-primary" id="plt-save-${i}">Guardar plantilla</button></div>
    </div>`;
  }).join('');

  $$('#cfg-plantillas .var-chip').forEach(chip => chip.addEventListener('click', ()=>{
    const ta = $('#'+chip.dataset.target); const v = chip.dataset.var;
    const s = ta.selectionStart||ta.value.length;
    ta.value = ta.value.slice(0,s) + v + ta.value.slice(ta.selectionEnd||s);
    ta.focus();
  }));
  CFG.data.plantillas.forEach((p,i)=>{
    $('#plt-save-'+i).addEventListener('click', async ()=>{
      try{
        const body = { usuarioId: currentUser.id, clave:p.clave, cuerpo:$('#plt-cuerpo-'+i).value };
        const aEl = $('#plt-asunto-'+i); if (aEl) body.asunto = aEl.value;
        CFG.data.plantillas = await apiPost('savePlantilla', body);
        Swal.fire({icon:'success', title:'Plantilla guardada', timer:900, showConfirmButton:false});
      }catch(e){ Swal.fire({icon:'error', title:'Error', text:String(e.message||e)}); }
    });
  });
}

/* ── AVANZADO (solo DESARROLLADOR) ── */
function renderCfgAvanzado_(){
  const cont = $('#cfg-avanzado');
  if (!CFG.data.esDev || !CFG.data.avanzado){ cont.innerHTML = '<p class="cfg-hint">Sección exclusiva del DESARROLLADOR.</p>'; return; }
  const a = CFG.data.avanzado;
  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card__title">🔐 BuilderBot / API (solo DESARROLLADOR)</h3>
      <p class="cfg-card__sub">Estas claves no son visibles para otros roles.</p>
      <div class="cfg-grid">
        ${field_('cf-BB_API_URL','BB_API_URL', a.BB_API_URL, 'full')}
        ${field_('cf-BB_API_KEY','BB_API_KEY', a.BB_API_KEY, 'full')}
        ${field_('cf-BB_ENDPOINT_BASE','BB_ENDPOINT_BASE', a.BB_ENDPOINT_BASE, 'full')}
        ${field_('cf-BB_BOT_ID','BB_BOT_ID', a.BB_BOT_ID, 'text')}
        ${field_('cf-BB_PROJECT_ID','BB_PROJECT_ID', a.BB_PROJECT_ID, 'text')}
        ${field_('cf-BB_MANAGER_API','BB_MANAGER_API', a.BB_MANAGER_API, 'full')}
      </div>
      <div class="cfg-actions"><button class="btn btn-primary" id="cf-save-avanzado">Guardar</button></div>
    </div>`;
  $('#cf-save-avanzado').addEventListener('click', async ()=>{
    const keys = ['BB_API_URL','BB_API_KEY','BB_ENDPOINT_BASE','BB_BOT_ID','BB_PROJECT_ID','BB_MANAGER_API'];
    const cambios = {}; keys.forEach(k => cambios[k] = $('#cf-'+k).value);
    try{ await apiPost('saveConfig', { usuarioId: currentUser.id, cambios });
      Object.assign(CFG.data.avanzado, cambios);
      Swal.fire({icon:'success', title:'Guardado', timer:900, showConfirmButton:false});
    }catch(e){ Swal.fire({icon:'error', title:'Error', text:String(e.message||e)}); }
  });
}

/* ============================================================
 * SELECTOR FECHA/HORA ESTILO iOS (ruedas; año fijo al actual)
 * ============================================================ */
const IOSP = { onOk:null, year:new Date().getFullYear() };
const IOSP_MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const IOSP_HORAS = []; for (let h=6; h<=20; h++) IOSP_HORAS.push(h); // bloques exactos 6 AM–8 PM
const IOSP_H = 42;
function iospHoraLabel_(h){ const ap = h>=12?'PM':'AM'; let hh=h%12; if(hh===0)hh=12; return hh+':00 '+ap; }
function iospDiasMes_(mesIdx, year){ return new Date(year, mesIdx+1, 0).getDate(); }

function buildCol_(colEl, items, initIdx){
  colEl.innerHTML = '<div class="iosp-pad"></div>' +
    items.map((t,i)=>`<div class="iosp-item" data-i="${i}">${t}</div>`).join('') +
    '<div class="iosp-pad"></div>';
  colEl.scrollTop = Math.max(0, initIdx)*IOSP_H;
  marcarSel_(colEl);
  let to=null;
  colEl.onscroll = ()=>{ marcarSel_(colEl); if(to)clearTimeout(to); to=setTimeout(()=>{ const i=selCol_(colEl); colEl.scrollTo({top:i*IOSP_H, behavior:'smooth'}); }, 90); };
}
function selCol_(colEl){ return Math.max(0, Math.round(colEl.scrollTop / IOSP_H)); }
function marcarSel_(colEl){ const i=selCol_(colEl); colEl.querySelectorAll('.iosp-item').forEach(el=> el.classList.toggle('sel', +el.dataset.i===i)); }

function abrirRuedaFecha_(valorISO, onOk, opts){
  IOSP.onOk = onOk;
  IOSP.soloFecha = !!(opts && opts.soloFecha);
  IOSP.year = new Date().getFullYear();
  $('#iosp-year').textContent = IOSP.year;
  $('#iosp-hora').style.display = IOSP.soloFecha ? 'none' : '';

  let dRef = valorISO ? new Date(valorISO) : new Date();
  if (isNaN(dRef.getTime())) dRef = new Date();
  let mesIdx = dRef.getMonth();
  let dia = dRef.getDate();
  let hora = dRef.getHours(); if (hora < 6) hora = 9; if (hora > 20) hora = 20;
  const horaIdx = Math.max(0, IOSP_HORAS.indexOf(hora) >= 0 ? IOSP_HORAS.indexOf(hora) : 3);

  const diasArr = Array.from({length: iospDiasMes_(mesIdx, IOSP.year)}, (_,i)=>String(i+1));
  buildCol_($('#iosp-dia'), diasArr, dia-1);
  buildCol_($('#iosp-mes'), IOSP_MESES.map(m=>m.charAt(0).toUpperCase()+m.slice(1)), mesIdx);
  buildCol_($('#iosp-hora'), IOSP_HORAS.map(iospHoraLabel_), horaIdx);

  // Si cambia el mes, ajusta la cantidad de días
  $('#iosp-mes').addEventListener('scroll', ()=>{
    const mi = selCol_($('#iosp-mes'));
    const nDias = iospDiasMes_(mi, IOSP.year);
    if ($('#iosp-dia').querySelectorAll('.iosp-item').length !== nDias){
      const cur = Math.min(selCol_($('#iosp-dia')), nDias-1);
      buildCol_($('#iosp-dia'), Array.from({length:nDias},(_,i)=>String(i+1)), cur);
    }
  }, { passive:true });

  $('#ios-picker').classList.remove('hidden');
}

$('#iosp-cancel')?.addEventListener('click', ()=> $('#ios-picker').classList.add('hidden'));
$('#iosp-ok')?.addEventListener('click', ()=>{
  const mi = selCol_($('#iosp-mes'));
  const nDias = iospDiasMes_(mi, IOSP.year);
  const dia = Math.min(selCol_($('#iosp-dia'))+1, nDias);
  const pad = n => String(n).padStart(2,'0');
  $('#ios-picker').classList.add('hidden');
  if (IOSP.soloFecha){
    const iso = `${IOSP.year}-${pad(mi+1)}-${pad(dia)}`;
    if (IOSP.onOk) IOSP.onOk(iso, `${dia} de ${IOSP_MESES[mi]} de ${IOSP.year}`);
    return;
  }
  const hora = IOSP_HORAS[Math.min(selCol_($('#iosp-hora')), IOSP_HORAS.length-1)];
  const iso = `${IOSP.year}-${pad(mi+1)}-${pad(dia)}T${pad(hora)}:00`;
  const texto = `${dia} de ${IOSP_MESES[mi]} de ${IOSP.year} · ${iospHoraLabel_(hora)}`;
  if (IOSP.onOk) IOSP.onOk(iso, texto);
});

/* Botón de agenda en el modal Comercial */
$('#f-agenda-btn')?.addEventListener('click', ()=>{
  abrirRuedaFecha_($('#f-fecha-hora-agendada').value, (iso, texto)=>{
    $('#f-fecha-hora-agendada').value = iso;
    $('#f-agenda-text').textContent = texto;
  });
});

/* ============================================================
 * CONFIGURACIÓN — AGENDA (disponibilidad)
 * ============================================================ */
const AG_MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const AG_DIAS  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
function labelFechaISO_(iso){ const [y,m,d]=iso.split('-').map(Number); const dt=new Date(y,m-1,d); return `${AG_DIAS[dt.getDay()]} ${d} de ${AG_MESES[m-1]}`; }
function chipsBloques_(sel){ const s=new Set(sel||[]); let o=''; for(let h=6;h<=20;h++){const k=String(h).padStart(2,'0')+':00'; o+=`<span class="bchip ${s.has(k)?'on':''}" data-h="${k}">${iospHoraLabel_(h)}</span>`;} return o; }

function renderCfgAgenda_(){
  const a = CFG.data.agenda || { modo:'unificado', bloquesUnificados:[], dias:[] };
  CFG.agenda = JSON.parse(JSON.stringify(a));
  const cont = $('#cfg-agenda');
  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card__title">⚙️ Modo de horarios</h3>
      <div class="seg-toggle" id="agenda-modo">
        <button type="button" class="seg ${a.modo==='unificado'?'on':''}" data-modo="unificado">Mismos horarios todos los días</button>
        <button type="button" class="seg ${a.modo==='por_dia'?'on':''}" data-modo="por_dia">Horarios por día</button>
      </div>
      <div id="agenda-unif" class="${a.modo==='unificado'?'':'hidden'}">
        <p class="cfg-card__sub" style="margin-top:14px">Bloques de 1 hora (se aplican a todos los días disponibles):</p>
        <div class="bloques-chips" id="bloques-unif">${chipsBloques_(a.bloquesUnificados)}</div>
      </div>
    </div>
    <div class="cfg-card">
      <h3 class="cfg-card__title">📅 Días disponibles</h3>
      <p class="cfg-card__sub">Agrega las fechas concretas en las que atenderás asesorías. Cada bloque admite varios estudiantes (cupos compartidos).</p>
      <button type="button" class="btn btn-accent" id="agenda-add">+ Agregar día</button>
      <div class="agenda-dias" id="agenda-dias"></div>
    </div>
    <div class="cfg-actions"><button class="btn btn-primary" id="agenda-save">Guardar disponibilidad</button></div>`;
  renderDiasAgenda_();

  // Toggle de bloques (delegado)
  cont.addEventListener('click', (e)=>{
    const chip = e.target.closest('.bchip'); if (chip){ chip.classList.toggle('on'); }
  });
  // Modo
  $('#agenda-modo').addEventListener('click', (e)=>{
    const b = e.target.closest('.seg'); if (!b) return;
    sincronizarAgenda_();
    CFG.agenda.modo = b.dataset.modo;
    $$('#agenda-modo .seg').forEach(s=> s.classList.toggle('on', s===b));
    $('#agenda-unif').classList.toggle('hidden', CFG.agenda.modo!=='unificado');
    renderDiasAgenda_();
  });
  // Agregar día
  $('#agenda-add').addEventListener('click', ()=>{
    abrirRuedaFecha_('', (iso)=>{
      sincronizarAgenda_();
      if (!CFG.agenda.dias.some(d=>d.fecha===iso)) CFG.agenda.dias.push({fecha:iso, bloques:[]});
      renderDiasAgenda_();
    }, { soloFecha:true });
  });
  // Quitar día (delegado)
  $('#agenda-dias').addEventListener('click', (e)=>{
    const del = e.target.closest('[data-del]'); if (!del) return;
    sincronizarAgenda_();
    CFG.agenda.dias = CFG.agenda.dias.filter(d=>d.fecha!==del.dataset.del);
    renderDiasAgenda_();
  });
  // Guardar
  $('#agenda-save').addEventListener('click', async ()=>{
    sincronizarAgenda_();
    if (!CFG.agenda.dias.length) return Swal.fire({icon:'warning', title:'Agrega al menos un día'});
    try{
      CFG.data.agenda = await apiPost('saveAgenda', { usuarioId: currentUser.id, agenda: CFG.agenda });
      Swal.fire({icon:'success', title:'Disponibilidad guardada', timer:1000, showConfirmButton:false});
    }catch(e){ Swal.fire({icon:'error', title:'Error', text:String(e.message||e)}); }
  });
}

function renderDiasAgenda_(){
  const a = CFG.agenda; const porDia = a.modo==='por_dia';
  $('#agenda-dias').innerHTML = (a.dias||[]).slice().sort((x,y)=>x.fecha.localeCompare(y.fecha)).map(d=>`
    <div class="agenda-dia" data-fecha="${d.fecha}">
      <div class="agenda-dia__head"><b>${labelFechaISO_(d.fecha)}</b><button type="button" class="mini-btn danger" data-del="${d.fecha}">Quitar</button></div>
      ${porDia?`<div class="bloques-chips" style="margin-top:10px">${chipsBloques_(d.bloques)}</div>`:''}
    </div>`).join('') || '<p class="cfg-hint">Aún no agregas días.</p>';
}

/* Lee el DOM y actualiza CFG.agenda (para no perder selección al re-renderizar) */
function sincronizarAgenda_(){
  const a = CFG.agenda;
  const seg = $('#agenda-modo .seg.on'); if (seg) a.modo = seg.dataset.modo;
  const unif = $('#bloques-unif');
  if (unif) a.bloquesUnificados = [...unif.querySelectorAll('.bchip.on')].map(c=>c.dataset.h);
  $$('#agenda-dias .agenda-dia').forEach(card=>{
    const dia = a.dias.find(d=>d.fecha===card.dataset.fecha); if (!dia) return;
    const chips = card.querySelectorAll('.bchip.on');
    if (chips.length || a.modo==='por_dia') dia.bloques = [...chips].map(c=>c.dataset.h);
  });
}
