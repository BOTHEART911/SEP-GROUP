/* ============================================================
 * SEP GROUP — APP FRONTEND (PWA)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario. Modificarlo anula la garantía de funcionamiento.
 * FASE 1 — Comercial (Parte 1: instalar · login · inicio)
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
    roles:['DESARROLLADOR','SUPERUSUARIO'], listo:false },
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
  card.querySelector('[data-act="chat"]')?.addEventListener('click', ()=> {
    Swal.fire({icon:'info', title:'Chat', text:'El chat por lead llega en la próxima parte (Firebase en tiempo real).'});
  });
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
    const d = (l,v)=>`<div class="d-item"><label>${l}</label><div class="d-val">${esc_(v)||'—'}</div></div>`;
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
          ${d('Fecha asesoría', r.fechaAsesoria)} ${d('Registró', r.usuario)}
        </div>
      </div>`;
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
  // Estados (Inscrito solo si el usuario puede inscribir)
  const puedeInscribir = currentUser && (currentUser.isDev || currentUser.isSuper || String(currentUser.rol).toUpperCase()==='CONTADOR');
  $('#f-estado').innerHTML = (COM.catalogo.estados||[])
    .filter(e => e.clave!=='INSCRITO' || puedeInscribir)
    .map(e=>opt_(e.clave, e.label, r?r.estado:'NUEVO_LEAD')).join('');
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
  $('#f-fecha-asesoria').value = r && r.fechaAsesoria && /^\d{4}-\d{2}-\d{2}$/.test(r.fechaAsesoria) ? r.fechaAsesoria : '';

  actualizarVisibilidadEstado_();
  actualizarVisibilidadFecha_();
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
function actualizarVisibilidadFecha_(){
  const est = $('#f-estado').value;
  const mostrar = est === 'ASESORIA_REALIZADA';
  $('#fld-fecha-asesoria').style.display = mostrar ? '' : 'none';
  if (mostrar && !$('#f-fecha-asesoria').value){
    $('#f-fecha-asesoria').value = new Date().toISOString().slice(0,10);
  }
}

$('#f-departamento')?.addEventListener('change', e => poblarMunicipios_(e.target.value, ''));
$('#f-asesor')?.addEventListener('change', actualizarVisibilidadEstado_);
$('#f-estado')?.addEventListener('change', actualizarVisibilidadFecha_);
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
    fechaAsesoria: $('#f-fecha-asesoria').value,
    programa: $('#f-programa').value, promo: $('#f-promo').value
  };
  // Validación rápida en cliente
  if (!body.nombres.trim() || !body.apellidos.trim()) return Swal.fire({icon:'warning', title:'Nombres y apellidos obligatorios'});
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
