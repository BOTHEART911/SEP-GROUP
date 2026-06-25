/* ============================================================
 * SEP GROUP — APP FRONTEND (PWA)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario. Modificarlo anula la garantía de funcionamiento.
 * FASE 1 — Comercial (Parte 1: instalar · login · inicio)
 * ============================================================ */

/* ================== CONFIGURACIÓN ================== */
// 👇 Pega aquí la URL /exec de tu Apps Script desplegado (Setup → Implementar)
const API_BASE = 'https://script.google.com/macros/s/AKfycbyrb7dXsicBPJwEkkMJJfojtkPhfKeBxiFKqMHac348M94apbwLsRaz0bhpL0sX8HoTSQ/exec';

/* ================== LOADER ================== */
const loader = document.getElementById('loader');
let loadingCount = 0, loaderTimer = null;
function startLoading(){
  loadingCount++;
  if (loadingCount === 1){
    loaderTimer = setTimeout(()=>{ loader.classList.remove('hidden'); loaderTimer = null; }, 120);
  }
}
function stopLoading(){
  if (loadingCount === 0) return;
  loadingCount--;
  if (loadingCount === 0){
    if (loaderTimer){ clearTimeout(loaderTimer); loaderTimer = null; }
    loader.classList.add('hidden');
  }
}

/* ================== API (text/plain evita preflight CORS) ================== */
async function apiGet(action, params = {}){
  startLoading();
  try{
    const url = new URL(API_BASE);
    url.search = new URLSearchParams({ action, ...params }).toString();
    const r = await fetch(url.toString(), { method: 'GET' });
    const j = await r.json();
    if(!j.ok) throw new Error(j.error || 'Error');
    return j.data;
  } finally { stopLoading(); }
}
async function apiPost(action, body = {}){
  startLoading();
  try{
    const url = API_BASE + '?action=' + encodeURIComponent(action);
    const r = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if(!j.ok) throw new Error(j.error || 'Error');
    return j.data;
  } finally { stopLoading(); }
}

/* ================== ESTADO / SESIÓN ================== */
let currentUser = null; // { id, documento, nombre, rol, fotoUrl, isDev, isSuper, puedeEliminar }

function guardarSesion_(u){
  currentUser = u;
  try{ localStorage.setItem('sepUser', JSON.stringify(u)); }catch(_){}
}
function recuperarSesion_(){
  try{ const s = localStorage.getItem('sepUser'); return s ? JSON.parse(s) : null; }catch(_){ return null; }
}
function cerrarSesion_(){
  currentUser = null;
  try{ localStorage.removeItem('sepUser'); }catch(_){}
}

/* ================== VISTAS ================== */
function showView(id){
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ================== PWA: INSTALACIÓN ================== */
let deferredPrompt = null;

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: installed)').matches
      || window.navigator.standalone === true;
}
function isIOS(){ return /(iphone|ipad|ipod)/i.test(navigator.userAgent || ''); }
function isMarkedInstalled(){ try{ return localStorage.getItem('pwaInstalledFlag') === '1'; }catch(_){ return false; } }
function markInstalled(){ try{ localStorage.setItem('pwaInstalledFlag','1'); }catch(_){} }
function clearInstalledMark(){ try{ localStorage.removeItem('pwaInstalledFlag'); }catch(_){} }

async function detectInstalled(){
  if (isStandalone()) return true;
  if (typeof navigator.getInstalledRelatedApps === 'function'){
    try{
      const apps = await navigator.getInstalledRelatedApps();
      const found = apps.some(a => a.platform === 'webapp');
      if (found){ markInstalled(); return true; } else { clearInstalledMark(); }
    }catch(_){}
  }
  return isMarkedInstalled();
}
function updateInstallButtonsVisibility(){
  const btn = document.getElementById('btn-instalar');
  const installed = isMarkedInstalled() || isStandalone();
  const shouldShow = !installed && (!!deferredPrompt || isIOS());
  if (btn) btn.style.display = shouldShow ? '' : 'none';
}

window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e; updateInstallButtonsVisibility();
});
window.addEventListener('appinstalled', ()=>{
  markInstalled(); deferredPrompt = null; updateInstallButtonsVisibility();
});

document.getElementById('btn-instalar')?.addEventListener('click', async ()=>{
  if (isIOS()){
    Swal.fire({
      icon:'info', title:'Instalar en iPhone / iPad',
      html:`<div style="text-align:center;margin-top:8px;">
        <b>1.</b> Toca <b>Compartir</b>.<br>
        <b>2.</b> Elige <b>"Agregar a pantalla de inicio"</b>.<br>
        <b>3.</b> Confirma <b>"Agregar"</b>.</div>`
    });
    return;
  }
  if (!deferredPrompt){ Swal.fire({icon:'info', title:'Instalación no disponible todavía'}); return; }
  const dp = deferredPrompt; dp.prompt();
  const choice = await dp.userChoice; deferredPrompt = null;
  if (choice.outcome === 'accepted'){
    markInstalled();
    Swal.fire({ icon:'success', title:'¡App instalándose!',
      text:'Al cerrarse este aviso, busca SEP GROUP en tu pantalla de inicio.',
      timer:9000, showConfirmButton:false });
  } else {
    Swal.fire({ icon:'info', title:'Instalación cancelada' });
  }
  updateInstallButtonsVisibility();
});

/* ================== ARRANQUE ================== */
if ('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
window.addEventListener('load', initApp_);

async function initApp_(){
  // Carga config pública (logo/colores/version) sin bloquear el login
  cargarBootstrap_();

  const installed = await detectInstalled();
  if (!installed){
    showView('view-instalar');
    updateInstallButtonsVisibility();
    return;
  }
  // Instalada: ¿hay sesión guardada?
  const u = recuperarSesion_();
  if (u){ currentUser = u; pintarInicio_(u); showView('view-inicio'); }
  else  { showView('view-login'); }
}

async function cargarBootstrap_(){
  try{
    const b = await apiGet('bootstrap');
    if (b?.version){
      const v = document.getElementById('app-version');
      if (v) v.textContent = 'Versión ' + b.version;
    }
    if (b?.config?.COLOR_PRIMARY){
      document.documentElement.style.setProperty('--primary', b.config.COLOR_PRIMARY);
    }
    if (b?.config?.COLOR_ACCENT){
      document.documentElement.style.setProperty('--accent', b.config.COLOR_ACCENT);
    }
  }catch(_){ /* la app funciona aunque el bootstrap falle */ }
}

/* ================== LOGIN: tabs ================== */
document.querySelectorAll('.login-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.login-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    document.getElementById('tab-doc').classList.toggle('hidden', which !== 'doc');
    document.getElementById('tab-pin').classList.toggle('hidden', which !== 'pin');
  });
});

/* ================== LOGIN: documento ================== */
function onlyDigits(s){ return String(s||'').replace(/\D/g,''); }
function bindNumericSanitizer(id, maxLen){
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('input', ()=>{
    const raw = onlyDigits(el.value);
    el.value = maxLen ? raw.slice(0, maxLen) : raw;
  });
}
bindNumericSanitizer('login-doc', 12);

document.getElementById('toggle-doc')?.addEventListener('click', ()=>{
  const el = document.getElementById('login-doc');
  const oculto = el.type === 'password';
  el.type = oculto ? 'text' : 'password';
  document.getElementById('toggle-doc-img').src = oculto
    ? 'https://res.cloudinary.com/dqqeavica/image/upload/v1764084782/Ocultar_lgdxpd.png'
    : 'https://res.cloudinary.com/dqqeavica/image/upload/v1764084782/Mostrar_yymceh.png';
});

document.getElementById('btn-login')?.addEventListener('click', async ()=>{
  const doc = onlyDigits(document.getElementById('login-doc').value);
  if (!doc){ Swal.fire({icon:'warning', title:'Ingresa tu documento'}); return; }
  try{
    const u = await apiGet('login', { documento: doc });
    if (!u.encontrado){ Swal.fire({icon:'error', title:'Usuario no encontrado o inactivo'}); return; }
    entrar_(u);
  }catch(e){ manejarErrorLogin_(e); }
});

/* ================== LOGIN: PIN ================== */
let pinBuffer = '';
function pintarPinDots_(){
  document.querySelectorAll('.pin-dot').forEach((d,i)=> d.classList.toggle('filled', i < pinBuffer.length));
}
document.querySelectorAll('.pin-key').forEach(key=>{
  key.addEventListener('click', async ()=>{
    const k = key.dataset.key;
    if (k === 'clear'){ pinBuffer = ''; pintarPinDots_(); return; }
    if (k === 'back'){ pinBuffer = pinBuffer.slice(0,-1); pintarPinDots_(); return; }
    if (pinBuffer.length >= 4) return;
    pinBuffer += k; pintarPinDots_();
    if (pinBuffer.length === 4){
      const pin = pinBuffer;
      try{
        const u = await apiGet('loginPin', { pin });
        if (!u.encontrado){
          Swal.fire({icon:'error', title:'PIN incorrecto'});
          pinBuffer = ''; pintarPinDots_(); return;
        }
        entrar_(u);
      }catch(e){ pinBuffer=''; pintarPinDots_(); manejarErrorLogin_(e); }
    }
  });
});

function manejarErrorLogin_(e){
  const msg = String(e.message || e);
  if (/horario|entre .* y/i.test(msg)){
    Swal.fire({ icon:'warning', title:'Fuera de horario', text: msg });
  } else {
    Swal.fire({ icon:'error', title:'No se pudo iniciar sesión', text: msg });
  }
}

function entrar_(u){
  guardarSesion_(u);
  pintarInicio_(u);
  showView('view-inicio');
  Swal.fire({ icon:'success', title:'Bienvenido', text: u.nombre, timer:1100, showConfirmButton:false });
}

/* ================== INICIO ================== */
function pintarInicio_(u){
  document.getElementById('inicio-nombre').textContent = u.nombre || '';
  document.getElementById('inicio-rol').textContent = u.rol || '';
  const foto = document.getElementById('inicio-foto');
  if (u.fotoUrl) foto.src = u.fotoUrl;
}

document.getElementById('btn-logout')?.addEventListener('click', async ()=>{
  const r = await Swal.fire({
    icon:'question', title:'¿Cerrar sesión?', showCancelButton:true,
    confirmButtonText:'Salir', cancelButtonText:'Cancelar'
  });
  if (!r.isConfirmed) return;
  cerrarSesion_();
  pinBuffer=''; pintarPinDots_();
  showView('view-login');
});

/* Botón COMERCIAL — la vista se construye en la Parte 2 */
document.getElementById('btn-comercial')?.addEventListener('click', ()=>{
  Swal.fire({
    icon:'info', title:'COMERCIAL',
    text:'Vista en construcción (Fase 1 · Parte 2): filtro, pastillas por estado, tarjetas y dashboard.'
  });
});
