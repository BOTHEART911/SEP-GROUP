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
function pintarBanners_(){
  const html = `<span class="dot"></span> <span>© <b>Oscar Polanía</b> · Experto en Soluciones Digitales · +57&nbsp;310&nbsp;323&nbsp;0712</span>`;
  $$('.credit-banner').forEach(b => b.innerHTML = html);
}

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
    icono:'https://res.cloudinary.com/dqqeavica/image/upload/v1776287585/target_rmpes0.webp',
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
      if (t.key === 'comercial'){
        Swal.fire({ icon:'info', title:'Comercial',
          text:'Vista en construcción (Fase 1 · Parte 2): filtro, pastillas por estado, tarjetas y dashboard.' });
      }
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
