/**
 * ============================================================ 
 * SEP GROUP — APP FRONTEND (PWA)
 * SEP Colombia Group SAS
 * ------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales
 * Contacto: +57 310 323 0712
 * ------------------------------------------------------------
 * Software propietario. Cualquier modificación de este archivo
 * por terceros anula automáticamente la garantía de
 * funcionamiento. Diseñado y desarrollado íntegramente por
 * Oscar Polanía.
 * ------------------------------------------------------------
 * FASE ACTUAL: Fase 25 — Loader silencioso · Antiduplicados por WhatsApp ·
 *   Campo Referidor(a) · Nombres/Apellidos sin tildes ni ñ · Programas con
 *   "Datos adicionales para el pago" ({bloque_pago}).
 *   Fase 24 — Configuración › Agenda gana el campo "Correo de
 *   Asesorías" (se envía en saveAgenda). Al guardar la disponibilidad el
 *   backend crea la sala (evento + Meet) de cada horario y comparte la
 *   administración con ese correo. SEP-AGENDA intacta.
 *   Fase 23 — Reprogramación + preservar botón Meet
 *   Configuración › Agenda: se elimina el modo "mismos horarios todos los
 *   días"; cada día configura sus propios bloques. Se corrige el bug de la
 *   vista que "se quedaba detenida" (listener acumulado en #cfg-agenda).
 *   El backend (slotsDisponibles_) ahora lee siempre los bloques por día,
 *   con lo que SEP-AGENDA vuelve a mostrar los horarios.
 *   Fase 12: Configuración › General gana "Alertas del bot" (correos +
 *   URL de la app + silencio nocturno); el chequeo vive en Bot.gs.
 *   Fase 11: plantillas unificadas en Configuración (lista dinámica +
 *   modal de EDICIÓN; Mi Bot quedó solo con Conexión).
 *   Fase 9: usuarios. Fase 8: dashboard. Fase 7: chat. SEP-AGENDA intacta.
 * ============================================================
 */

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

/* ================== API (text/plain evita preflight CORS) ==================
   opts.silent = true  → no muestra el spinner global (para refrescos en
   segundo plano como el polling del chat). */
async function apiGet(action, params = {}, opts = {}){
  if (!opts.silent) startLoading();
  try{
    const url = new URL(API_BASE);
    url.search = new URLSearchParams({ action, ...params }).toString();
    const r = await fetch(url.toString(), { method:'GET' });
    const j = await r.json();
    if(!j.ok) throw new Error(j.error || 'Error');
    return j.data;
  } finally { if (!opts.silent) stopLoading(); }
}
async function apiPost(action, body = {}, opts = {}){
  if (!opts.silent) startLoading();
  try{
    const url = API_BASE + '?action=' + encodeURIComponent(action);
    const r = await fetch(url, { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const j = await r.json();
    if(!j.ok) throw new Error(j.error || 'Error');
    return j.data;
  } finally { if (!opts.silent) stopLoading(); }
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
  // Sincronización en vivo del Comercial: activa solo mientras se ve su tablero.
  if (typeof comercialLiveOn_ === 'function'){
    if (id === 'comercial') comercialLiveOn_();
    else comercialLiveOff_();
  }
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

let APP_CFG = {};   // Fase 14: config pública del bootstrap (incl. CRM_CHAT_URL)

async function cargarBootstrap_(){
  try{
    const b = await apiGet('bootstrap');
    APP_CFG = (b && b.config) || {};
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
  { key:'comercial', titulo:'Comercial', desc:'Leads y seguimiento',
    icono:'https://res.cloudinary.com/dqqeavica/image/upload/v1782391218/comercial_vlu9py.webp',
    roles:['DESARROLLADOR','SUPERUSUARIO','CONTADOR','COMERCIAL'], listo:true, view:'comercial' },
  { key:'usuarios', titulo:'Usuarios', desc:'Gestionar el equipo',
    icono:'https://res.cloudinary.com/dqqeavica/image/upload/v1776287377/usuarios_dkzfqk.webp',
    roles:['DESARROLLADOR','SUPERUSUARIO'], listo:true, view:'usuarios' },
  { key:'config', titulo:'Configuración', desc:'Ajustes del sistema',
    icono:'https://res.cloudinary.com/dqqeavica/image/upload/v1778860851/base_de_datos_cty8xc.webp',
    roles:['DESARROLLADOR','SUPERUSUARIO'], listo:true },
  { key:'bot', titulo:'Mi Bot', desc:'WhatsApp y plantillas',
    icono:'https://res.cloudinary.com/dqqeavica/image/upload/v1776016986/chat_sueco4.webp',
    roles:['DESARROLLADOR','SUPERUSUARIO'], listo:true, view:'bot' }
];

function irAInicio_(u){
  $('#welcome-name').textContent = (u.nombre || '').split(' ').slice(0,2).join(' ');
  $('#welcome-rol').textContent  = u.rol || '';
  $('#welcome-avatar').src = driveImg_(u.fotoUrl);   // driveImg_ cae al genérico si está vacío
  $('#welcome-avatar').onerror = function(){ this.onerror = null; this.src = USR_FOTO_FALLBACK; };
  refrescarUsuarioActual_();   // trae la foto/nombre/rol actuales desde la hoja

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
      else if (t.key === 'usuarios'){ abrirUsuarios_(); }
      else if (t.key === 'bot'){ abrirBot_(); }
    });
    grid.appendChild(tile);
  });

  showView('inicio');
}

/* Refresca al usuario en sesión desde el backend (fuente de verdad: la
   hoja USUARIOS) y actualiza avatar, nombre y rol del inicio. Corrige el
   caso de una sesión vieja guardada antes de subir/cambiar la foto. */
async function refrescarUsuarioActual_(){
  if (!currentUser || !currentUser.id) return;
  try{
    const fresco = await apiGet('me', { usuarioId: currentUser.id });
    if (!fresco || fresco.encontrado === false) return;
    currentUser = Object.assign({}, currentUser, fresco);
    guardarSesion_(currentUser);
    $('#welcome-name').textContent = (currentUser.nombre || '').split(' ').slice(0,2).join(' ');
    $('#welcome-rol').textContent  = currentUser.rol || '';
    const av = $('#welcome-avatar');
    av.onerror = function(){ this.onerror = null; this.src = USR_FOTO_FALLBACK; };
    av.src = driveImg_(currentUser.fotoUrl);
  }catch(_){}
}

$('#btn-logout')?.addEventListener('click', async ()=>{
  const r = await Swal.fire({ icon:'question', title:'¿Cerrar sesión?', showCancelButton:true, confirmButtonText:'Salir', cancelButtonText:'Cancelar' });
  if (!r.isConfirmed) return;
  cerrarSesion_(); pinBuffer=''; pintarPinDots_(); showView('login');
});

/* ============================================================
 * MÓDULO COMERCIAL (Parte 2)
 * ============================================================ */
let COM = { catalogo:null, ubic:null, registros:[], filtroTexto:'',
            filtroEstado:'__ALL__', filtroAsesor:'__ALL__',
            filtroPrograma:'__ALL__',            // Fase 25.1 — nueva pastilla
            sheetKey:null,                       // Fase 25.1 — hoja de filtros abierta
            editId:null,
            sig:'', pollTimer:null, pollMs:12000, cargando:false };

/* Navegación por data-go (botones "volver") */
document.addEventListener('click', (e)=>{
  const b = e.target.closest('[data-go]');
  if (b){ showView(b.getAttribute('data-go')); }
});

async function abrirComercial_(){
  showView('comercial');
  // Fase 14: visibilidad de los iconos del header por rol.
  const rol = String((currentUser && currentUser.rol) || '').toUpperCase();
  const dashBtn = $('#com-dashboard-btn');
  if (dashBtn) dashBtn.style.display = (rol === 'COMERCIAL') ? 'none' : '';      // Cambio 1
  const crmBtn = $('#com-crm-btn');
  if (crmBtn){
    const verCRM = (rol === 'DESARROLLADOR' || rol === 'SUPERUSUARIO' || rol === 'COMERCIAL'); // Cambio 2
    crmBtn.style.display = verCRM ? '' : 'none';
  }
  try{
    if (!COM.catalogo){
      const [cat, ubic] = await Promise.all([ apiGet('getCatalogoComercial'), apiGet('getUbicaciones') ]);
      COM.catalogo = cat; COM.ubic = ubic;
    }
    // Fase 25 (Ajuste 1): el loader solo en la PRIMERA carga, viniendo de Inicio.
    // Si ya hay tarjetas en memoria, la vista se refresca en silencio.
    await recargarComercial_(COM.registros.length > 0);
  }catch(e){ Swal.fire({icon:'error', title:'No se pudo cargar', text:String(e.message||e)}); }
}

/* Fase 25 (Ajuste 1) — El flag `silencioso` AHORA SÍ viaja a apiGet.
   Antes se recibía pero nunca se propagaba, así que el spinner global salía
   igual en los tres refrescos de segundo plano: visibilitychange (volver a la
   pestaña del navegador), el sondeo cada 12 s y la señal de Firebase.
   `forzar` = repintar aunque la firma no haya cambiado (tras guardar/eliminar). */
async function recargarComercial_(silencioso, forzar){
  const registros = await apiGet('listComercial', { usuarioId: currentUser.id },
                                 { silent: !!silencioso });
  const sig = JSON.stringify(registros);
  // En modo silencioso (sondeo en segundo plano) solo re-renderiza si algo
  // cambió realmente; así no se interrumpe el scroll/uso si no hay novedades.
  if (silencioso && !forzar && sig === COM.sig) return;
  COM.registros = registros;
  COM.sig = sig;
  renderFiltros_(); renderCards_();     // Fase 25.1
}

/* ══════════════════════════════════════════════════════════════
   SINCRONIZACIÓN EN VIVO DEL TABLERO COMERCIAL
   ══════════════════════════════════════════════════════════════
   Objetivo: que las tarjetas se vean IGUALES en TODAS las pantallas,
   al instante, cuando cualquiera crea/edita/agenda/elimina un lead.

   Cómo funciona:
   • El backend actualiza un único valor /meta/comercial_rev (timestamp)
     cada vez que cambia algo del comercial.
   • El cliente escucha SOLO ese valor por Firebase (Realtime DB). No se
     transmiten datos de leads por ese canal → un COMERCIAL nunca ve leads
     de otros asesores.
   • Al ver que el valor cambió, recarga su lista YA FILTRADA POR ROL vía
     listComercial (la hoja es la única fuente de verdad) y re-renderiza
     solo si hubo cambios reales.

   Robustez: si Firebase no está disponible (SDK no cargó, sin API key,
   token o reglas), cae automáticamente al SONDEO cada 12 s. Así nunca se
   rompe nada respecto a la versión anterior.
   Arranca/para desde showView(). */

const FB = { listo:false, iniciando:null, ref:null, primed:false, refrescoTimer:null };

/* ¿Hay un modal/overlay abierto? No refrescar para no pisar una edición. */
function comercialOverlayAbierto_(){
  const abierto = id => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden'); };
  return abierto('modal-comercial') || abierto('modal-accion') || abierto('sep-chat') ||
         abierto('com-fsheet') ||                       // Fase 25.1
         (window.Swal && typeof Swal.isVisible === 'function' && Swal.isVisible());
}

/* Recarga la lista (filtrada por rol) evitando solaparse y sin pisar modales. */
async function comercialRefrescar_(){
  if (document.hidden) return;
  if (COM.cargando) return;
  if (comercialOverlayAbierto_()){          // reintenta cuando se cierre el modal
    clearTimeout(FB.refrescoTimer);
    FB.refrescoTimer = setTimeout(comercialRefrescar_, 1500);
    return;
  }
  COM.cargando = true;
  try { await recargarComercial_(true); } catch(_){} finally { COM.cargando = false; }
}
/* Agrupa varios cambios seguidos en un solo refresco (debounce 400 ms). */
function comercialAgendarRefresco_(){
  clearTimeout(FB.refrescoTimer);
  FB.refrescoTimer = setTimeout(comercialRefrescar_, 400);
}

/* ── Firebase: inicia sesión una sola vez con el custom token del backend ── */
async function fbAsegurarSesion_(){
  if (FB.listo) return;
  if (FB.iniciando) return FB.iniciando;
  FB.iniciando = (async ()=>{
    if (!window.firebase || !firebase.database || !firebase.auth) throw new Error('SDK Firebase no cargado');
    // Fase 25 (Ajuste 1): silent → volver a Comercial no dispara el spinner.
    const r = await apiGet('tokenChat', { usuarioId: currentUser.id }, { silent:true });  // endpoint ya existente
    if (!r || !r.token) throw new Error('tokenChat sin token');
    const cfg = r.firebase || {};
    if (!cfg.apiKey) throw new Error('FIREBASE_API_KEY vacía en CONFIGURACION');
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    await firebase.auth().signInWithCustomToken(r.token);  // el SDK mantiene la sesión (renueva solo)
    FB.listo = true;
  })();
  try { await FB.iniciando; } finally { FB.iniciando = null; }
}

/* ── Escucha /meta/comercial_rev (solo la señal, sin datos de leads) ── */
function fbEscucharComercial_(){
  if (!window.firebase || !firebase.database) return;
  fbDejarDeEscuchar_();
  FB.primed = false;
  FB.ref = firebase.database().ref('meta/comercial_rev');
  FB.ref.on('value',
    ()=>{
      if (!FB.primed){ FB.primed = true; return; }   // ignora el snapshot inicial (ya cargamos con listComercial)
      comercialAgendarRefresco_();
    },
    (err)=>{                                          // sin permiso de lectura u otro error → sondeo
      console.warn('RT /meta/comercial_rev no disponible, uso sondeo:', err && err.message || err);
      fbDejarDeEscuchar_();
      comercialIniciarPolling_();
    });
}
function fbDejarDeEscuchar_(){
  if (FB.ref){ try { FB.ref.off(); } catch(_){} FB.ref = null; }
  clearTimeout(FB.refrescoTimer); FB.refrescoTimer = null;
}

/* ── Encendido/apagado del modo "en vivo" (lo llama showView) ── */
async function comercialLiveOn_(){
  try {
    await fbAsegurarSesion_();      // Firebase listo
    comercialDetenerPolling_();     // no hace falta el sondeo
    fbEscucharComercial_();         // escucha la señal en tiempo real
  } catch (e){
    console.warn('Tiempo real no disponible, uso sondeo cada 12 s:', e && e.message || e);
    comercialIniciarPolling_();     // fallback seguro
  }
}
function comercialLiveOff_(){
  fbDejarDeEscuchar_();
  comercialDetenerPolling_();
}

/* ── Fallback: sondeo cada 12 s (idéntico patrón al chat) ── */
async function comercialTick_(){
  if (document.hidden) return;
  if (COM.cargando) return;
  if (comercialOverlayAbierto_()) return;
  COM.cargando = true;
  try { await recargarComercial_(true); } catch(_){} finally { COM.cargando = false; }
}
function comercialIniciarPolling_(){
  comercialDetenerPolling_();
  COM.pollTimer = setInterval(comercialTick_, COM.pollMs);
}
function comercialDetenerPolling_(){
  if (COM.pollTimer){ clearInterval(COM.pollTimer); COM.pollTimer = null; }
}

/* Al regresar a la pestaña, refresca de inmediato (en vivo o por sondeo). */
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden) return;
  if (FB.ref) comercialAgendarRefresco_();
  else if (COM.pollTimer) comercialTick_();
});

/* ══════════════════════════════════════════════════════════════
   FILTROS DE LA VISTA COMERCIAL (Fase 25.1)
   ══════════════════════════════════════════════════════════════
   Antes: dos filas de pastillas con scroll horizontal (una por asesor,
   otra por estado). Ahora: TRES pastillas fijas en una sola línea —
   «Todos los asesores» · «Todos los programas» · «Todos los leads».

   • Al tocar una, se abre una hoja inferior con sus opciones (con
     icono, conteo y check de selección).
   • Al elegir un valor, la pastilla se renombra con ese valor, se pinta
     y aplica el filtro.
   • Al volver a tocarla, la PRIMERA opción de la hoja es «Todos los X»:
     la devuelve a su estado inicial y quita el filtro.

   Los filtros son EN CASCADA: Asesor → Programa → Estado. Los conteos
   de cada nivel se calculan sobre el nivel anterior, así nunca ofrece
   una opción que devuelva cero tarjetas. Cambiar un nivel superior
   reinicia los inferiores.

   El rol COMERCIAL no ve la pastilla de Asesor (solo tiene sus leads):
   la fila se reparte entre las dos restantes.
   ══════════════════════════════════════════════════════════════ */

const SIN_ASESOR   = '— Sin asesor —';
const SIN_PROGRAMA = '— Sin programa —';

const FILTROS_DEF = [
  { key:'asesor',   allLabel:'Todos los asesores',  titulo:'Filtrar por asesor',   ic:'👤', color:'#263143' },
  { key:'programa', allLabel:'Todos los programas', titulo:'Filtrar por programa', ic:'🎓', color:'#0891b2' },
  { key:'estado',   allLabel:'Todos los leads',     titulo:'Filtrar por estado',   ic:'🏷️', color:'#263143' }
];

const CHEVRON_SVG = '<svg class="fpill__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

function normAsesor_(r){   return String(r.asesor  ||'').trim() || SIN_ASESOR; }
function normPrograma_(r){ return String(r.programa||'').trim() || SIN_PROGRAMA; }

/* En la pastilla el asesor va en corto (2 palabras, igual que el saludo de
   Inicio): "MARIA ALEJANDRA SANABRIA CEPEDA" no cabe en un tercio de pantalla.
   El nombre completo queda en la hoja de opciones y en el tooltip. */
function nombreCortoAsesor_(n){
  const s = String(n||'').trim();
  if (s.startsWith('—')) return s;                 // "— Sin asesor —" va tal cual
  return s.split(/\s+/).slice(0, 2).join(' ');
}

function valFiltro_(key){
  return key === 'asesor' ? COM.filtroAsesor
       : key === 'programa' ? COM.filtroPrograma
       : COM.filtroEstado;
}
/* Cambiar un nivel superior reinicia los inferiores (evita filtros huérfanos). */
function setFiltro_(key, valor){
  if (key === 'asesor'){ COM.filtroAsesor = valor; COM.filtroPrograma = '__ALL__'; COM.filtroEstado = '__ALL__'; }
  else if (key === 'programa'){ COM.filtroPrograma = valor; COM.filtroEstado = '__ALL__'; }
  else { COM.filtroEstado = valor; }
}

/* ── Bases en cascada ── */
function baseAsesor_(){
  if (COM.filtroAsesor === '__ALL__') return COM.registros;
  return COM.registros.filter(r => normAsesor_(r) === COM.filtroAsesor);
}
function basePrograma_(){
  const b = baseAsesor_();
  if (COM.filtroPrograma === '__ALL__') return b;
  return b.filter(r => normPrograma_(r) === COM.filtroPrograma);
}
/* Registros visibles antes del filtro de estado (lo usa renderCards_). */
function registrosVisibles_(){ return basePrograma_(); }
/* Registros tras los TRES filtros (sin el buscador de texto). */
function baseEstado_(){
  const b = basePrograma_();
  if (COM.filtroEstado === '__ALL__') return b;
  return b.filter(r => r.estado === COM.filtroEstado);
}

function iconoPrograma_(nombre){
  const p = (COM.catalogo?.programas || []).find(x => x.nombre === nombre);
  return p && p.iconoUrl ? p.iconoUrl : '';
}
function estadoDef_(clave){
  return (COM.catalogo?.estados || []).find(e => e.clave === clave) || null;
}

/* ── Opciones de cada hoja (con conteo, calculadas sobre su base) ── */
function opcionesFiltro_(key){
  if (key === 'asesor'){
    const c = {};
    COM.registros.forEach(r => { const k = normAsesor_(r); c[k] = (c[k]||0)+1; });
    return Object.keys(c).sort((a,b)=>a.localeCompare(b))
      .map(k => ({ valor:k, label:k, count:c[k], ic:'👤' }));
  }
  if (key === 'programa'){
    const c = {};
    baseAsesor_().forEach(r => { const k = normPrograma_(r); c[k] = (c[k]||0)+1; });
    return Object.keys(c).sort((a,b)=>a.localeCompare(b))
      .map(k => ({ valor:k, label:k, count:c[k], img: iconoPrograma_(k), ic:'🎓' }));
  }
  const c = {};
  basePrograma_().forEach(r => { c[r.estado] = (c[r.estado]||0)+1; });
  return (COM.catalogo?.estados || [])
    .filter(e => c[e.clave])
    .map(e => ({ valor:e.clave, label:e.label, count:c[e.clave], color:e.color }));
}
/* Total de la opción «Todos los X» de cada hoja. */
function totalFiltro_(key){
  if (key === 'asesor')   return COM.registros.length;
  if (key === 'programa') return baseAsesor_().length;
  return basePrograma_().length;
}
/* Conteo que muestra la pastilla ya seleccionada. */
function conteoPill_(key){
  if (key === 'asesor')   return baseAsesor_().length;
  if (key === 'programa') return basePrograma_().length;
  return baseEstado_().length;
}

/* ── Render de la fila de 3 pastillas ── */
function renderFiltros_(){
  const cont = $('#com-filters'); if (!cont) return;
  const esComercial = String(currentUser?.rol||'').toUpperCase() === 'COMERCIAL';
  if (esComercial) COM.filtroAsesor = '__ALL__';   // no puede filtrar por asesor

  const defs = FILTROS_DEF.filter(f => !(f.key === 'asesor' && esComercial));
  cont.innerHTML = defs.map(fpillHtml_).join('');
  defs.forEach(f => $('#fp-'+f.key)?.addEventListener('click', ()=> abrirSheetFiltro_(f.key)));
}

function fpillHtml_(f){
  const val = valFiltro_(f.key);
  const on  = val !== '__ALL__';
  let label = f.allLabel, color = f.color, icHtml = `<span class="fpill__ic">${f.ic}</span>`;

  if (on){
    if (f.key === 'estado'){
      const e = estadoDef_(val);
      label = e ? e.label : val;
      color = e ? e.color : f.color;
      icHtml = `<span class="fpill__dot"></span>`;
    } else if (f.key === 'programa'){
      label = val;
      const img = iconoPrograma_(val);
      if (img) icHtml = `<span class="fpill__ic"><img src="${esc_(img)}" alt=""></span>`;
    } else {
      label = nombreCortoAsesor_(val);
    }
  }
  const titulo = on ? val : f.allLabel;             // tooltip con el valor completo
  return `<button class="fpill ${on?'is-on':''}" id="fp-${f.key}" style="--fp:${color}"
      title="${esc_(titulo)}" aria-haspopup="dialog">
    ${icHtml}
    <span class="fpill__label">${esc_(label)}</span>
    <span class="fpill__count">${conteoPill_(f.key)}</span>
    ${CHEVRON_SVG}
  </button>`;
}

/* ── Hoja inferior con las opciones ── */
function abrirSheetFiltro_(key){
  const f = FILTROS_DEF.find(x => x.key === key); if (!f) return;
  const sheet = $('#com-fsheet'), lista = $('#fsheet-list'); if (!sheet || !lista) return;
  COM.sheetKey = key;
  $('#fsheet-title').textContent = f.titulo;

  const actual = valFiltro_(key);
  let html = foptHtml_({ valor:'__ALL__', label:f.allLabel, count:totalFiltro_(key), ic:f.ic },
                       actual === '__ALL__', true);
  opcionesFiltro_(key).forEach(o => { html += foptHtml_(o, actual === o.valor, false); });
  lista.innerHTML = html;
  lista.scrollTop = 0;

  $$('#fsheet-list .fopt').forEach(b => b.addEventListener('click', ()=>{
    setFiltro_(key, b.dataset.valor);
    cerrarSheetFiltro_();
    renderFiltros_(); renderCards_();
  }));

  sheet.classList.remove('hidden');
  sheet.setAttribute('aria-hidden','false');
}
function foptHtml_(o, sel, esAll){
  const ic = o.color   ? `<span class="fopt__dot" style="background:${o.color}"></span>`
           : o.img     ? `<span class="fopt__ic"><img src="${esc_(o.img)}" alt=""></span>`
           :             `<span class="fopt__ic">${o.ic || '•'}</span>`;
  return `<button class="fopt ${sel?'is-sel':''} ${esAll?'is-all':''}" data-valor="${esc_(o.valor)}">
    ${ic}
    <span class="fopt__label">${esc_(o.label)}</span>
    <span class="fopt__count">${o.count}</span>
    <span class="fopt__check">✓</span>
  </button>`;
}
function cerrarSheetFiltro_(){
  const sheet = $('#com-fsheet'); if (!sheet) return;
  sheet.classList.add('hidden');
  sheet.setAttribute('aria-hidden','true');
  COM.sheetKey = null;
}
document.addEventListener('click', (e)=>{ if (e.target.closest('[data-fsheet-close]')) cerrarSheetFiltro_(); });
document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') cerrarSheetFiltro_(); });

/* ── Tarjetas ── */
/* Normaliza texto para el buscador: minúsculas, sin tildes y con ñ→n
   (así "carreño" encuentra "carreno" y al revés). NFD descompone la ñ en
   n + tilde combinada; al quitar las marcas diacríticas la ñ queda como n. */
function normBusq_(s){
  return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

function renderCards_(){
  const cont = $('#com-cards'); const empty = $('#com-empty'); if (!cont) return;
  const txt = normBusq_(COM.filtroTexto.trim());
  let list = registrosVisibles_().slice(); // respeta el asesor elegido; más antiguas primero
  if (COM.filtroEstado !== '__ALL__') list = list.filter(r => r.estado === COM.filtroEstado);
  if (txt) list = list.filter(r =>
    normBusq_(`${r.nombres} ${r.apellidos}`).includes(txt) ||
    String(r.whatsapp||'').includes(txt) ||
    normBusq_(r.correo).includes(txt));

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
      <div class="com-card__head">
        <h3 class="com-card__name">${esc_(r.nombres)} ${esc_(r.apellidos)}</h3>
        ${r.correo?`<div class="com-card__email">📧 ${esc_(r.correo)}</div>`:''}
      </div>
      <div class="com-card__tag">
        <span class="com-badge" style="background:${r.estadoColor}">${esc_(r.estadoLabel)}</span>
        <span class="com-card__id">${r.id}</span>
      </div>
    </div>
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
      <button class="act-btn act-accion" data-act="accion">✈️ Acción</button>
      <button class="act-btn act-ver" data-act="ver"><img src="${verIc}">Ver</button>
      <button class="act-btn act-editar" data-act="editar">✏️ Editar</button>
      <button class="act-btn act-chat${r.tieneNotas?' act-chat--notas':''}" data-act="chat"><img src="${chatIc}">Notas</button>
      ${puedeEliminar?`<button class="act-btn act-eliminar" data-act="eliminar">🗑 Eliminar</button>`:''}
    </div>
  </div>`;
}

function bindCard_(r){
  const card = $('#card-'+r.id); if (!card) return;
  card.querySelector('[data-act="accion"]')?.addEventListener('click', ()=> abrirModalAccion_(r));
  card.querySelector('[data-act="ver"]')?.addEventListener('click', ()=> verComercial_(r.id));
  card.querySelector('[data-act="editar"]')?.addEventListener('click', ()=> abrirModalComercial_(r));
  card.querySelector('[data-act="chat"]')?.addEventListener('click', ()=> abrirChat_(r));
  card.querySelector('[data-act="eliminar"]')?.addEventListener('click', ()=> eliminarComercial_(r));
}

/* ── Buscar ── */
$('#com-search')?.addEventListener('input', (e)=>{ COM.filtroTexto = e.target.value; renderCards_(); });
$('#com-dashboard-btn')?.addEventListener('click', ()=>{ abrirDashboard_(); });
/* Fase 14: botón CRM → abre el CRM de BuilderBot en pestaña nueva */
$('#com-crm-btn')?.addEventListener('click', ()=>{
  const url = APP_CFG.CRM_CHAT_URL;
  if (!url){ Swal.fire({icon:'info', title:'CRM no configurado', text:'Pídele al desarrollador que configure el enlace del CRM.'}); return; }
  window.open(url, '_blank', 'noopener');
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
          ${r.referido ? `<div class="d-item full">${d('Referidor(a)', r.referido)}</div>` : ''}
          ${d('Programa', r.programa)} ${d('Promo', r.promo)}
          ${d('Clave de acceso', r.claveAcceso)} ${d('Asesoría agendada', r.fechaHoraAgendada)}
          ${d('Fecha realizada', r.fechaAsesoria)} ${d('Registró', r.usuario)}
        </div>
        ${r.meetLink?`<div style="padding:0 22px 8px;"><a class="btn-meet" href="${esc_(r.meetLink)}" target="_blank" rel="noopener">▶ Entrar a la reunión Meet</a></div>`:''}
        <div class="detalle-acciones">
          <button class="act-btn act-accion" id="det-accion">✈️ Acción</button>
          <button class="act-btn act-editar" id="det-editar">✏️ Editar</button>
          <button class="act-btn act-chat" id="det-chat">📝 Notas</button>
          ${puedeEliminar?`<button class="act-btn act-eliminar" id="det-eliminar">🗑 Eliminar</button>`:''}
        </div>
        ${segHtml}
        ${traza?`<div class="traza-box"><h4>📜 Trazabilidad</h4><ul class="traza-list">${traza}</ul></div>`:''}
      </div>`;
    $('#det-accion')?.addEventListener('click', ()=> abrirModalAccion_(r));
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
    await recargarComercial_(true, true);   // Fase 25: el apiPost ya mostró el loader
    Swal.fire({icon:'success', title:'Eliminado', timer:1000, showConfirmButton:false});
  }catch(e){ Swal.fire({icon:'error', title:'No se pudo eliminar', text:String(e.message||e)}); }
}

/* ============================================================
 * MÓDULO DASHBOARD (Fase 8)
 * ------------------------------------------------------------
 * Consume el endpoint 'dashboard' (apiDashboard_) en un solo
 * viaje. Filtros: rango (mes_actual|acumulado) + asesor. Render
 * con Chart.js (ya cargado en index.html), count-up y refresco
 * silencioso. Toda la UI vive bajo #view-dashboard con prefijo dsh-.
 * ============================================================ */
const DASH = { rango:'mes_actual', asesor:'', data:null, charts:{}, asesoresCargados:false, bound:false };
const DASH_PALETA = ['#263143','#d6da09','#7c3aed','#2563eb','#0891b2','#c2792a','#16a34a','#ef4444','#06b6d4','#f59e0b'];

const DASH_KPI_DEF = [
  { k:'leadsTotales',        label:'Leads totales',        hint:'Total acumulado',     ic:'👥', bg:'rgba(37,99,235,.14)',  glow:'rgba(37,99,235,.16)' },
  { k:'asesoriasAgendadas',  label:'Asesorías agendadas',  hint:'Este mes',            ic:'📅', bg:'rgba(168,85,247,.14)', glow:'rgba(168,85,247,.16)' },
  { k:'inscripciones',       label:'Inscripciones',        hint:'Total acumulado',     ic:'✅', bg:'rgba(22,163,74,.14)',  glow:'rgba(22,163,74,.16)' },
  { k:'conversion',          label:'Conversión',           hint:'Inscripciones / Leads',ic:'📈', bg:'rgba(124,58,237,.14)', glow:'rgba(124,58,237,.16)', pct:true },
  { k:'asesoriasRealizadas', label:'Asesorías realizadas', hint:'Este mes',            ic:'🎯', bg:'rgba(8,145,178,.14)',  glow:'rgba(8,145,178,.16)' },
  { k:'ventasTotales',       label:'Ventas totales',       hint:'Total acumulado',     ic:'💰', bg:'rgba(214,218,9,.20)',  glow:'rgba(214,218,9,.20)', money:true }
];

function dashMoney_(v){ return '$ ' + Math.round(v).toLocaleString('es-CO'); }
function dashCountUp_(el, to, opts){
  opts = opts || {};
  const dur = 900, t0 = performance.now(), reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (reduce){ el.textContent = opts.money ? dashMoney_(to) : (Number.isInteger(to)? to.toLocaleString('es-CO') : (Math.round(to*100)/100).toFixed(2)) + (opts.suf||''); return; }
  function step(t){
    const p = Math.min(1, (t - t0)/dur), e = 1 - Math.pow(1-p, 3), v = to * e;
    el.textContent = opts.money ? dashMoney_(v)
      : (Number.isInteger(to) ? Math.round(v).toLocaleString('es-CO') : (Math.round(v*100)/100).toFixed(2) + (opts.suf||''));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

async function abrirDashboard_(){
  showView('dashboard');
  dashBind_();
  try { await dashLoad_(false); }
  catch(e){ Swal.fire({icon:'error', title:'No se pudo cargar el dashboard', text:String(e.message||e)}); }
}

async function dashLoad_(silent){
  const d = await apiGet('dashboard', { usuarioId: currentUser.id, rango: DASH.rango, asesor: DASH.asesor }, { silent: !!silent });
  DASH.data = d;
  if (!DASH.asesoresCargados){
    const sel = $('#dsh-asesor');
    sel.innerHTML = '<option value="">Todo el equipo</option>' +
      (d.asesores||[]).map(a => `<option value="${esc_(a)}">${esc_(a)}</option>`).join('');
    sel.value = DASH.asesor;
    DASH.asesoresCargados = true;
  }
  dashRenderAll_(d);
}

function dashBind_(){
  if (DASH.bound) return;
  DASH.bound = true;
  $('#dsh-seg-rango')?.addEventListener('click', (e)=>{
    const b = e.target.closest('button'); if (!b) return;
    $$('#dsh-seg-rango button').forEach(x => x.classList.toggle('on', x === b));
    DASH.rango = b.dataset.r;
    dashLoad_(true);
  });
  $('#dsh-asesor')?.addEventListener('change', (e)=>{ DASH.asesor = e.target.value; dashLoad_(true); });
  $('#dsh-refresh')?.addEventListener('click', ()=>{
    const b = $('#dsh-refresh'); b.classList.add('spin'); setTimeout(()=> b.classList.remove('spin'), 650);
    dashLoad_(true);
  });
}

function dashRenderAll_(d){
  const fecha = new Date().toLocaleDateString('es-CO', { day:'numeric', month:'long', year:'numeric' });
  $('#dsh-sub').textContent = (d.rango === 'mes_actual' ? 'Este mes' : 'Acumulado') +
    (d.asesor ? ' · ' + d.asesor : ' · Todo el equipo') + ' · ' + fecha;
  dashRenderKPIs_(d);
  dashDonut_('dsh-ch-prog','dsh-ctr-prog','dsh-lg-prog', d.leadsPorPrograma, 'Leads');
  dashRenderRend_(d);
  dashDonut_('dsh-ch-fuente','dsh-ctr-fuente','dsh-lg-fuente', d.leadsPorFuente, 'Leads');
  dashRenderEstados_(d);
  dashRenderInscPrograma_(d);
  dashRenderVentas_(d);
  dashRenderAlertas_(d);
  dashRenderMeta_(d);
  dashRenderMeses_(d);
}

function dashRenderKPIs_(d){
  const cont = $('#dsh-kpis');
  cont.innerHTML = DASH_KPI_DEF.map(def => `
    <div class="dsh-kpi" style="--kbg:${def.bg};--kglow:${def.glow};">
      <div class="dsh-kpi__ic">${def.ic}</div>
      <div class="dsh-kpi__label">${def.label}</div>
      <div class="dsh-kpi__value" data-k="${def.k}"></div>
      <div class="dsh-kpi__hint">${def.hint}</div>
    </div>`).join('');
  DASH_KPI_DEF.forEach(def=>{
    const el = cont.querySelector(`[data-k="${def.k}"]`);
    dashCountUp_(el, Number(d.kpis[def.k]||0), { money: !!def.money, suf: def.pct ? '%' : '' });
  });
}

function dashDestroy_(id){ if (DASH.charts[id]){ DASH.charts[id].destroy(); delete DASH.charts[id]; } }

function dashDonut_(canvasId, centerId, legendId, items, centerLabel){
  items = items || [];
  dashDestroy_(canvasId);
  const labels = items.map(i=>i.label), data = items.map(i=>i.valor);
  const colors = items.map((_,i)=> DASH_PALETA[i % DASH_PALETA.length]);
  DASH.charts[canvasId] = new Chart($('#'+canvasId), {
    type:'doughnut',
    data:{ labels, datasets:[{ data, backgroundColor:colors, borderWidth:2, borderColor:'#fff', hoverOffset:6 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'68%',
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:c=>` ${c.label}: ${c.raw}` } } },
      animation:{ animateRotate:true, duration:900 } }
  });
  const total = data.reduce((s,x)=>s+x, 0);
  $('#'+centerId).innerHTML = `<b>${total.toLocaleString('es-CO')}</b><span>${centerLabel}</span>`;
  $('#'+legendId).innerHTML = items.map((i,idx)=>`
    <div class="dsh-legend__row"><span class="sw" style="background:${DASH_PALETA[idx % DASH_PALETA.length]}"></span>
      <span class="nm">${esc_(i.label)}</span><span class="vl">${i.valor}</span><span class="pc">${i.pct}%</span></div>`).join('');
}

function dashRenderRend_(d){
  const rows = (d.rendimiento||[]).map(b=>`<tr>
    <td><span class="dsh-nm-dot"><i style="background:${b.asesor==='(Sin asesor)'?'#9ca3af':DASH_PALETA[2]}"></i>${esc_(b.asesor)}</span></td>
    <td>${b.leads}</td><td>${b.asesorias}</td><td>${b.inscripciones}</td><td>${b.conversion}%</td></tr>`).join('');
  const t = d.rendimientoTotal || { leads:0, asesorias:0, inscripciones:0, conversion:0 };
  $('#dsh-rend').innerHTML = `<table><thead><tr><th>Asesor</th><th>Leads</th><th>Ases.</th><th>Insc.</th><th>Conv.</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="color:var(--text-muted)">Sin datos</td></tr>'}</tbody>
    <tfoot><tr><td>Total</td><td>${t.leads}</td><td>${t.asesorias}</td><td>${t.inscripciones}</td><td>${t.conversion}%</td></tr></tfoot></table>`;
}

function dashRenderEstados_(d){
  const items = d.estadoLeads || [];
  const max = Math.max(1, ...items.map(e=>e.valor));
  $('#dsh-estados').innerHTML = items.length ? items.map(e=>`
    <div class="dsh-hbar"><span class="lb" title="${esc_(e.label)}">${esc_(e.label)}</span>
      <span class="tr"><span class="fl" style="background:${e.color}" data-w="${Math.round(e.valor/max*100)}"></span></span>
      <span class="vn">${e.valor}</span></div>`).join('')
    : '<p class="muted">Sin leads en este rango.</p>';
  requestAnimationFrame(()=> $$('#dsh-estados .fl').forEach(f=> f.style.width = f.dataset.w + '%'));
}

function dashRenderInscPrograma_(d){
  dashDestroy_('dsh-ch-insc');
  const items = d.inscripcionesPorPrograma || [];
  DASH.charts['dsh-ch-insc'] = new Chart($('#dsh-ch-insc'), {
    type:'bar',
    data:{ labels: items.map(x=>x.label),
      datasets:[{ data: items.map(x=>x.valor), backgroundColor: items.map((_,i)=>DASH_PALETA[i % DASH_PALETA.length]), borderRadius:8, maxBarThickness:54 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ x:{ grid:{ display:false }, ticks:{ font:{ size:10 }, maxRotation:0, autoSkip:false,
        callback:function(v){ const l = this.getLabelForValue(v); return l.length>12 ? l.slice(0,11)+'…' : l; } } },
        y:{ beginAtZero:true, ticks:{ precision:0 } } }, animation:{ duration:900 } }
  });
}

function dashRenderVentas_(d){
  const items = d.ventasPorPrograma || [];
  const t = d.ventasPorProgramaTotal || { inscritos:0, ventas:0 };
  const rows = items.map(x=>`<tr><td>${esc_(x.programa)}</td><td style="text-align:center;font-weight:600">${x.inscritos}</td><td>${dashMoney_(x.ventas)}</td></tr>`).join('');
  $('#dsh-ventas').innerHTML = `<table><thead><tr><th>Programa</th><th style="text-align:center">Inscritos</th><th>Ventas</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="3" style="color:var(--text-muted)">Sin inscripciones</td></tr>'}</tbody>
    <tfoot><tr><td>Total</td><td style="text-align:center">${t.inscritos}</td><td>${dashMoney_(t.ventas)}</td></tr></tfoot></table>`;
}

function dashRenderAlertas_(d){
  const a = d.alertas || { sinContacto3:0, sinContacto7:0, seguimientosVencidos:0 };
  $('#dsh-alertas').innerHTML = `
    <div class="dsh-alert lv-red"><span class="ai">⛔</span><span class="at">Leads sin contacto por más de <b>3 días</b></span><span class="av" data-v="${a.sinContacto3}">0</span></div>
    <div class="dsh-alert lv-amb"><span class="ai">⚠️</span><span class="at">Leads sin contacto por más de <b>7 días</b></span><span class="av" data-v="${a.sinContacto7}">0</span></div>
    <div class="dsh-alert lv-yel"><span class="ai">🔔</span><span class="at">Seguimientos vencidos</span><span class="av" data-v="${a.seguimientosVencidos}">0</span></div>`;
  $$('#dsh-alertas .av').forEach(el=> dashCountUp_(el, +el.dataset.v));
}

function dashRenderMeta_(d){
  const m = d.meta || { objetivo:0, inscripciones:0, cumplimiento:0 };
  dashCountUp_($('#dsh-m-obj'), m.objetivo);
  dashCountUp_($('#dsh-m-ins'), m.inscripciones);
  dashCountUp_($('#dsh-m-pct'), m.cumplimiento, { suf:'%' });
  const pct = Math.min(100, m.cumplimiento);
  requestAnimationFrame(()=> $('#dsh-m-fill').style.width = pct + '%');
}

function dashRenderMeses_(d){
  dashDestroy_('dsh-ch-mes');
  const s = d.inscripcionesPorMes || { anio:'', labels:[], data:[] };
  $('#dsh-anio').textContent = s.anio;
  const ctx = $('#dsh-ch-mes').getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 185);
  g.addColorStop(0, 'rgba(38,49,67,.28)'); g.addColorStop(1, 'rgba(38,49,67,0)');
  DASH.charts['dsh-ch-mes'] = new Chart($('#dsh-ch-mes'), {
    type:'line',
    data:{ labels:s.labels, datasets:[{ label:'Inscripciones', data:s.data,
      borderColor:'#263143', backgroundColor:g, fill:true, tension:.4, borderWidth:2.5,
      pointBackgroundColor:'#d6da09', pointBorderColor:'#263143', pointRadius:4, pointHoverRadius:6 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ x:{ grid:{ display:false }, ticks:{ font:{ size:10 } } }, y:{ beginAtZero:true, ticks:{ precision:0 } } },
      animation:{ duration:1000 } }
  });
}

/* ============================================================
 *  NOTAS DE LEAD (Fase 7 — sondeo / polling · Fase 18 relabel)
 * ------------------------------------------------------------
 *  Hilo de colaboración del equipo por cada lead (antes "Chat").
 *  El backend (hoja CHAT) es la fuente de verdad. El cliente LEE
 *  con historialChat (refresco cada CHAT.intervaloMs mientras está
 *  abierto) y ENVÍA vía enviarMensajeChat. "Vaciar mensajes"
 *  (DEV/SUPER/ADMIN) usa vaciarChat. Sin Firebase en el cliente.
 *  El estudiante NO participa. Los endpoints NO cambiaron de nombre.
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
  // Fase 18: "Vaciar mensajes" solo DEV / SUPERUSUARIO (/ ADMINISTRADOR).
  const puedeVaciar = currentUser && (currentUser.isDev || currentUser.isSuper ||
    String(currentUser.rol||'').toUpperCase()==='ADMINISTRADOR');
  const vb = $('#chat-vaciar'); if (vb) vb.style.display = puedeVaciar ? '' : 'none';
  $('#chat-msgs').innerHTML = `<div class="chat-empty">Cargando notas…</div>`;
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
    const hist = await apiPost('historialChat', { usuarioId: currentUser.id, leadId: CHAT.leadId }, { silent:true });
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
    return `<div class="chat-row ${mio?'mio':'otro'}">
      <span class="chat-autor rol-${rc}">${esc_(m.autor||'—')}</span>
      <div class="chat-bubble"><span class="chat-texto">${chatTexto_(m.texto)}</span></div>
      <span class="chat-hora">${esc_(chatFechaHora_(m.ts))}</span>
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
    await apiPost('enviarMensajeChat', { usuarioId: currentUser.id, leadId: CHAT.leadId, texto: txt }, { silent:true });
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
const _CHAT_MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function chatFechaHora_(ts){
  const d = ts ? new Date(Number(ts)) : null;
  if (!d || isNaN(d.getTime())) return '';
  const dia = d.getDate();
  const mes = _CHAT_MESES[d.getMonth()] || '';
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2,'0');
  const ap = h>=12?'PM':'AM'; h = h%12; if (h===0) h=12;
  return dia + ' de ' + mes + ' ' + h + ':' + m + ' ' + ap;   // p.ej. "26 de junio 8:58 AM"
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
/* Fase 18: Vaciar mensajes (DEV/SUPER/ADMIN). Borra la hoja CHAT del lead + RTDB. */
$('#chat-vaciar')?.addEventListener('click', async ()=>{
  const leadId = CHAT.leadId; if (!leadId) return;
  const r = await Swal.fire({
    icon:'warning', title:'¿Vaciar las notas?',
    text:'Se borrarán todos los mensajes de este lead. Esta acción no se puede deshacer.',
    showCancelButton:true, confirmButtonText:'Sí, vaciar', cancelButtonText:'Cancelar',
    confirmButtonColor:'#d33'
  });
  if (!r.isConfirmed) return;
  try{
    const res = await apiPost('vaciarChat', { usuarioId: currentUser.id, leadId });
    CHAT.sig = '';
    $('#chat-msgs').innerHTML = `<div class="chat-empty">Sin notas todavía.</div>`;
    await chatCargar_(true).catch(()=>{});
    Swal.fire({icon:'success', title:'Notas vaciadas', timer:1000, showConfirmButton:false});
  }catch(e){ Swal.fire({icon:'error', title:'No se pudo vaciar', text:String(e && e.message || e)}); }
});
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

/* Fase 22 — Asesores que se ofrecen en el selector según el rol del usuario:
   COMERCIAL → solo él mismo; los demás (SUPER/DEV/CONTADOR) → solo los
   usuarios con rol COMERCIAL (asesores). */
function asesoresParaSelect_(){
  const all = COM.catalogo.asesores || [];
  const rol = String(currentUser?.rol||'').toUpperCase();
  if (rol === 'COMERCIAL') return all.filter(a => a.nombre === currentUser.nombre);
  // Fase 22 (ajuste): además de los asesores COMERCIAL, se muestran los
  // SUPERUSUARIO para que puedan asignarse como asesor en el registro.
  const ROLES_ASIGNABLES = ['COMERCIAL','SUPERUSUARIO'];
  return all.filter(a => ROLES_ASIGNABLES.indexOf(String(a.rol).toUpperCase()) >= 0);
}

/* ============================================================
   FASE 25 (Ajuste 3) — ANTIDUPLICADOS POR WHATSAPP
   ============================================================
   En un registro NUEVO el único campo activo es WhatsApp. Al completar los
   10 dígitos se consulta la columna F (WHATSAPP) de la hoja COMERCIAL:
     • existe  → se informa el nombre del lead y NADA se habilita.
     • no existe → se abre el resto del formulario.
   Al EDITAR no aplica: todo va habilitado desde el inicio.
   ============================================================ */
const COM_CAMPOS_BLOQUEABLES = [
  'f-nombres','f-apellidos','f-telefono','f-correo',
  'f-departamento','f-municipio','f-fuente','f-referido','f-asesor',
  'f-estado','f-programa','f-promo','f-agenda-btn','com-save'
];
function comBloquearCampos_(bloquear){
  COM_CAMPOS_BLOQUEABLES.forEach(id => { const el = $('#'+id); if (el) el.disabled = !!bloquear; });
}
function setWaHint_(texto, tipo){
  const h = $('#f-wa-hint'); if (!h) return;
  h.textContent = texto || '';
  h.style.color = tipo === 'err' ? '#dc2626' : (tipo === 'ok' ? '#16a34a' : '');
  h.style.fontWeight = tipo ? '600' : '';
}
async function verificarWhatsapp_(wa){
  if (COM.waCheck === wa) return;            // evita repetir la misma consulta
  COM.waCheck = wa; COM.waOk = '';
  setWaHint_('Verificando número…');
  comBloquearCampos_(true);
  try{
    const res = await apiGet('buscarWhatsapp', { whatsapp: wa }, { silent:true });
    if (res.existe){
      setWaHint_(`⛔ Ya registrado: ${res.nombres} ${res.apellidos} (${res.id})`, 'err');
      Swal.fire({ icon:'warning', title:'Lead ya registrado',
        html:`El número <b>${wa}</b> ya pertenece a<br><b>${esc_(res.nombres)} ${esc_(res.apellidos)}</b> · ${res.id}` +
             (res.asesor ? `<br><span style="font-size:13px;">Asesor: ${esc_(res.asesor)}</span>` : '') });
      return;
    }
    COM.waOk = wa;
    comBloquearCampos_(false);
    setWaHint_('✅ Número disponible. Continúa el registro.', 'ok');
    $('#f-nombres').focus();
  }catch(e){
    COM.waCheck = '';                        // permite reintentar
    setWaHint_('No se pudo verificar el número. Corrige un dígito para reintentar.', 'err');
  }
}

function abrirModalComercial_(r){
  COM.editId = r ? r.id : null;
  COM.origEstado = r ? r.estado : '';                 // Fase 23
  const cbRep = $('#f-reprogramada'); if (cbRep) cbRep.checked = false;
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
  // Asesores (Fase 22): COMERCIAL ve solo su nombre; SUPER/DEV/otros ven
  // solo a los asesores (rol COMERCIAL). Si se edita y el asesor actual no
  // está en la lista, se conserva como opción para no perder la asignación.
  let listaAse = asesoresParaSelect_();
  if (r && r.asesor && !listaAse.some(a=>a.nombre===r.asesor)) listaAse = [{nombre:r.asesor, rol:''}].concat(listaAse);
  const rolAct = String(currentUser?.rol||'').toUpperCase();
  const selAse = r ? r.asesor : (rolAct==='COMERCIAL' ? currentUser.nombre : '');
  $('#f-asesor').innerHTML = '<option value="">— Sin asesor —</option>' +
    listaAse.map(a=>opt_(a.nombre, a.rol ? `${a.nombre} (${a.rol})` : a.nombre, selAse)).join('');
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
  $('#f-referido').value  = r ? (r.referido || '') : '';   // Fase 25
  const fhRaw = r && r.fechaHoraAgendadaRaw ? r.fechaHoraAgendadaRaw : '';
  $('#f-fecha-hora-agendada').value = fhRaw;
  $('#f-agenda-text').textContent = (r && r.fechaHoraAgendada) ? r.fechaHoraAgendada : 'Seleccionar fecha y hora';

  actualizarVisibilidadEstado_();
  actualizarVisibilidadAgenda_();
  actualizarVisibilidadReferido_();          // Fase 25

  // Fase 25 — modo antiduplicados SOLO en alta; al editar todo va habilitado.
  COM.waCheck = ''; COM.waOk = '';
  if (r){
    comBloquearCampos_(false);
    setWaHint_('');
  } else {
    comBloquearCampos_(true);
    setWaHint_('Escribe los 10 dígitos para verificar si el lead ya existe.');
  }

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
/* Fase 25 (Ajuste 4) — "Nombre del Referidor(a)" solo si la fuente es Referido. */
function actualizarVisibilidadReferido_(){
  const esRef = String($('#f-fuente').value || '').trim().toLowerCase() === 'referido';
  const box = $('#fld-referido');
  if (box) box.style.display = esRef ? '' : 'none';
  if (!esRef && $('#f-referido')) $('#f-referido').value = '';
}
function actualizarVisibilidadAgenda_(){
  const est = $('#f-estado').value;
  $('#fld-agenda').style.display = est === 'ASESORIA_AGENDADA' ? '' : 'none';
  // Fase 23: "Reprogramada" solo al editar un lead que YA estaba en
  // Asesoría Agendada (tiene sentido notificar un cambio de fecha).
  const rep = $('#fld-reprograma');
  if (rep) rep.style.display = (est === 'ASESORIA_AGENDADA' && COM.origEstado === 'ASESORIA_AGENDADA') ? '' : 'none';
}

$('#f-departamento')?.addEventListener('change', e => poblarMunicipios_(e.target.value, ''));
$('#f-asesor')?.addEventListener('change', actualizarVisibilidadEstado_);
$('#f-estado')?.addEventListener('change', actualizarVisibilidadAgenda_);
$('#f-fuente')?.addEventListener('change', actualizarVisibilidadReferido_);   // Fase 25

/* Fase 25 (Ajuste 5) — mayúsculas SIN tildes ni ñ, espejo exacto de
   upSinTildes_() del backend: lo que se ve es lo que se guarda.
   'Ramírez Caño' → 'RAMIREZ CANO'. */
const sinTildesJS_ = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[Ññ]/g,'N');
['f-nombres','f-apellidos'].forEach(id=> $('#'+id)?.addEventListener('input', e=>{
  const pos = e.target.selectionStart;
  e.target.value = sinTildesJS_(e.target.value).toUpperCase();
  try { e.target.setSelectionRange(pos, pos); } catch(_){}
}));

['f-whatsapp','f-telefono'].forEach(id=> $('#'+id)?.addEventListener('input', e=>{ e.target.value = onlyDigits(e.target.value).slice(0,10); }));

/* Fase 25 (Ajuste 3) — dispara la búsqueda al completar 10 dígitos (solo en ALTA).
   Se registra DESPUÉS del listener de arriba, así el valor ya viene recortado. */
$('#f-whatsapp')?.addEventListener('input', ()=>{
  if (COM.editId) return;                                   // editando: no aplica
  const wa = onlyDigits($('#f-whatsapp').value);
  if (wa.length === 10) { verificarWhatsapp_(wa); return; }
  COM.waCheck = ''; COM.waOk = '';
  comBloquearCampos_(true);
  setWaHint_('Escribe los 10 dígitos para verificar si el lead ya existe.');
});

$('#com-save')?.addEventListener('click', guardarComercial_);
async function guardarComercial_(){
  const body = {
    usuarioId: currentUser.id, usuario: currentUser.nombre,
    nombres: $('#f-nombres').value, apellidos: $('#f-apellidos').value,
    whatsapp: $('#f-whatsapp').value, telefono: $('#f-telefono').value,
    correo: $('#f-correo').value,
    departamento: $('#f-departamento').value, municipio: $('#f-municipio').value,
    fuente: $('#f-fuente').value, referido: $('#f-referido').value,   // Fase 25
    asesor: $('#f-asesor').value,
    estado: $('#f-asesor').value ? $('#f-estado').value : 'NUEVO_LEAD',
    fechaHoraAgendada: $('#f-fecha-hora-agendada').value,
    programa: $('#f-programa').value, promo: $('#f-promo').value,
    reprogramada: $('#f-reprogramada')?.checked || false
  };
  // Validación rápida en cliente
  if (!body.nombres.trim() || !body.apellidos.trim()) return Swal.fire({icon:'warning', title:'Nombres y apellidos obligatorios'});
  if (body.estado === 'ASESORIA_AGENDADA' && !body.fechaHoraAgendada) return Swal.fire({icon:'warning', title:'Selecciona la fecha y hora de la asesoría'});
  if (onlyDigits(body.whatsapp).length !== 10) return Swal.fire({icon:'warning', title:'WhatsApp debe tener 10 dígitos'});
  if (body.telefono && onlyDigits(body.telefono).length !== 10) return Swal.fire({icon:'warning', title:'Teléfono debe tener 10 dígitos'});
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.correo.trim())) return Swal.fire({icon:'warning', title:'Correo no válido'});
  if (!body.departamento || !body.municipio) return Swal.fire({icon:'warning', title:'Selecciona departamento y municipio'});
  if (!body.fuente) return Swal.fire({icon:'warning', title:'Selecciona la fuente del lead'});
  // Fase 25 — en alta, el número debe haber pasado la verificación antiduplicados.
  if (!COM.editId && COM.waOk !== onlyDigits(body.whatsapp))
    return Swal.fire({icon:'warning', title:'Verifica el WhatsApp', text:'El número debe validarse antes de guardar.'});

  try{
    if (COM.editId){ await apiPost('editarComercial', Object.assign({id:COM.editId}, body)); }
    else { await apiPost('crearComercial', body); }
    cerrarModalComercial_();
    await recargarComercial_(true, true);   // Fase 25: el apiPost ya mostró el loader
    Swal.fire({icon:'success', title: COM.editId?'Actualizado':'Registrado', timer:1100, showConfirmButton:false});
  }catch(e){ Swal.fire({icon:'error', title:'No se pudo guardar', text:String(e.message||e)}); }
}

/* ============================================================
 *  MODAL ACCIÓN ✈ (Fase 22) — cambio rápido de estado/programa/promo,
 *  disponible para todos. Reutiliza editarComercial: envía el lead
 *  COMPLETO + los overrides, así procesarEstado_ dispara las acciones
 *  ya programadas (mensajes, evento de Calendar, etc.).
 * ============================================================ */
const ACC = { lead:null };

function abrirModalAccion_(r){
  ACC.lead = r;
  $('#acc-sub').textContent = `${r.nombres} ${r.apellidos} · ${r.id}`;

  const puedeInscribir = currentUser && (currentUser.isDev || currentUser.isSuper || String(currentUser.rol).toUpperCase()==='CONTADOR');
  const estadoActual = r.estado || 'NUEVO_LEAD';
  const enSeg = /^SEGUIMIENTO_[1-4]$/.test(estadoActual);
  const SEG_SALIDA = ['PERFIL_NO_APTO','SIN_RESPUESTA','NO_INTERESADO','PENDIENTE_PAGO','INSCRITO'];
  $('#a-estado').innerHTML = (COM.catalogo.estados||[])
    .filter(e => {
      if (e.clave==='INSCRITO' && !puedeInscribir) return false;
      if (enSeg) return e.clave===estadoActual || SEG_SALIDA.indexOf(e.clave)>=0;
      return !/^SEGUIMIENTO_[1-4]$/.test(e.clave);
    })
    .map(e=>opt_(e.clave, e.label, estadoActual)).join('');

  $('#a-programa').innerHTML = '<option value="">— Ninguno —</option>' +
    (COM.catalogo.programas||[]).map(p=>opt_(p.nombre, p.nombre, r.programa)).join('');
  $('#a-promo').innerHTML = '<option value="">— Ninguna —</option>' +
    (COM.catalogo.promos||[]).map(p=>opt_(p.nombre, p.nombre, r.promo)).join('');

  $('#a-fecha-hora-agendada').value = r.fechaHoraAgendadaRaw || '';
  $('#a-agenda-text').textContent = r.fechaHoraAgendada || 'Seleccionar fecha y hora';
  const cbR = $('#a-reprogramada'); if (cbR) cbR.checked = false;   // Fase 23

  actualizarVisibilidadAccionAgenda_();
  $('#modal-accion').classList.remove('hidden');
}
function cerrarModalAccion_(){ $('#modal-accion').classList.add('hidden'); }
function actualizarVisibilidadAccionAgenda_(){
  const est = $('#a-estado').value;
  $('#a-fld-agenda').style.display = est === 'ASESORIA_AGENDADA' ? '' : 'none';
  const rep = $('#a-fld-reprograma');
  const origAgendada = ACC.lead && ACC.lead.estado === 'ASESORIA_AGENDADA';
  if (rep) rep.style.display = (est === 'ASESORIA_AGENDADA' && origAgendada) ? '' : 'none';
}

$('#a-estado')?.addEventListener('change', actualizarVisibilidadAccionAgenda_);
$('#acc-x')?.addEventListener('click', cerrarModalAccion_);
$('#acc-cancel')?.addEventListener('click', cerrarModalAccion_);
$('#a-agenda-btn')?.addEventListener('click', ()=>{
  abrirRuedaFecha_($('#a-fecha-hora-agendada').value, (iso, texto)=>{
    $('#a-fecha-hora-agendada').value = iso;
    $('#a-agenda-text').textContent = texto;
  });
});
$('#acc-save')?.addEventListener('click', async ()=>{
  const r = ACC.lead; if (!r) return;
  const estado = $('#a-estado').value;
  const fh = $('#a-fecha-hora-agendada').value;
  if (estado === 'ASESORIA_AGENDADA' && !fh) return Swal.fire({icon:'warning', title:'Selecciona la fecha y hora de la asesoría'});
  // editarComercial reescribe la fila → mandamos el lead completo + overrides.
  const body = {
    id: r.id,
    usuarioId: currentUser.id, usuario: currentUser.nombre,
    nombres: r.nombres, apellidos: r.apellidos,
    whatsapp: r.whatsapp, telefono: r.telefono, correo: r.correo,
    departamento: r.departamento, municipio: r.municipio,
    fuente: r.fuente, referido: r.referido || '', asesor: r.asesor,   // Fase 25: no perder el referidor
    estado: estado, programa: $('#a-programa').value, promo: $('#a-promo').value,
    fechaHoraAgendada: fh,
    reprogramada: $('#a-reprogramada')?.checked || false
  };
  try{
    $('#acc-save').disabled = true;
    await apiPost('editarComercial', body);
    cerrarModalAccion_();
    await recargarComercial_(true, true);   // Fase 25: el apiPost ya mostró el loader
    Swal.fire({icon:'success', title:'Acción aplicada', timer:1000, showConfirmButton:false});
  }catch(e){ Swal.fire({icon:'error', title:'No se pudo aplicar', text:String(e.message||e)}); }
  finally{ $('#acc-save').disabled = false; }
});

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
        ${field_('cf-CALENDAR_ID','ID del calendario de asesorías', g.CALENDAR_ID, 'full', 'Calendario donde se crean los eventos al pasar a "Asesoría Agendada". La cuenta que despliega debe poder hacer cambios en ese calendario.')}
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

    <div class="cfg-card">
      <h3 class="cfg-card__title">🔔 Alertas del bot (WhatsApp)</h3>
      <p class="cfg-card__sub">Si el bot se desconecta, el sistema lo verifica cada hora y avisa por correo (y manda otro correo cuando vuelve a conectarse). Indica a qué correos llega la alerta.</p>
      <div class="cfg-grid">
        ${field_('cf-ALERTA_BOT_EMAIL_1','Correo 1 (obligatorio)', g.ALERTA_BOT_EMAIL_1, 'full')}
        ${field_('cf-ALERTA_BOT_EMAIL_2','Correo 2 (opcional)', g.ALERTA_BOT_EMAIL_2, 'full')}
        ${field_('cf-ALERTA_BOT_EMAIL_3','Correo 3 (opcional)', g.ALERTA_BOT_EMAIL_3, 'full')}
        ${field_('cf-APP_URL','URL de la app (enlace del correo)', g.APP_URL, 'full', 'Dirección pública de la PWA. Si la dejas vacía, se usa la de GitHub Pages.')}
      </div>
      <div class="cfg-grid" style="margin-top:10px;">
        <div class="cfg-field"><label>Silencio nocturno</label>
          <select id="cf-ALERTA_BOT_SILENCIO_NOCTURNO"><option value="FALSE">Desactivado</option><option value="TRUE">Activado</option></select>
        </div>
        <div class="cfg-field"><label>Desde</label><input id="cf-ALERTA_BOT_SILENCIO_INICIO" type="time" value="${esc_(g.ALERTA_BOT_SILENCIO_INICIO||'22:00')}"></div>
        <div class="cfg-field"><label>Hasta</label><input id="cf-ALERTA_BOT_SILENCIO_FIN" type="time" value="${esc_(g.ALERTA_BOT_SILENCIO_FIN||'06:00')}"></div>
      </div>
      <div class="cfg-hint">Durante el silencio nocturno no se envían correos (la caída igual se registra y se avisa al terminar la ventana).${g.ALERTA_BOT_ULTIMA_ALERTA?` Última alerta enviada: <b>${esc_(g.ALERTA_BOT_ULTIMA_ALERTA)}</b>.`:''}</div>
      <div class="cfg-actions"><button class="btn btn-primary" id="cf-save-alertas">Guardar alertas</button></div>
    </div>

    <div class="cfg-actions"><button class="btn btn-primary" id="cf-save-general">Guardar cambios</button></div>`;

  $('#cf-save-general').addEventListener('click', async ()=>{
    const claves = ['APP_NOMBRE','LOGO_URL','COLOR_PRIMARY','COLOR_ACCENT','EMAIL_REMITENTE','EMAIL_REMITENTE_NOMBRE',
      'EMAIL_BANNER_URL','EMAIL_FINANCIERO','LINK_AGENDA','LINK_MEET_RESPALDO','CALENDAR_ID','COMERCIAL_ACCESO_INICIO','COMERCIAL_ACCESO_FIN',
      'BANCO_NOMBRE','BANCO_CUENTA','BANCO_TITULAR','BANCO_NIT'];
    const cambios = {}; claves.forEach(k => cambios[k] = $('#cf-'+k).value);
    await guardarConfig_(cambios);
  });

  // ── Alertas del bot (Fase 12) ──
  $('#cf-ALERTA_BOT_SILENCIO_NOCTURNO').value = (String(g.ALERTA_BOT_SILENCIO_NOCTURNO||'').toUpperCase()==='TRUE') ? 'TRUE' : 'FALSE';
  $('#cf-save-alertas').addEventListener('click', async ()=>{
    const e1 = $('#cf-ALERTA_BOT_EMAIL_1').value.trim();
    const e2 = $('#cf-ALERTA_BOT_EMAIL_2').value.trim();
    const e3 = $('#cf-ALERTA_BOT_EMAIL_3').value.trim();
    if (!e1){ Swal.fire({icon:'warning', title:'Falta el correo 1', text:'El primer correo es obligatorio.'}); return; }
    for (const [val,lbl] of [[e1,'Correo 1'],[e2,'Correo 2'],[e3,'Correo 3']]){
      if (val && !emailValido_(val)){ Swal.fire({icon:'warning', title:lbl+' inválido', text:'Revisa el formato del correo.'}); return; }
    }
    const cambios = {
      ALERTA_BOT_EMAIL_1: e1, ALERTA_BOT_EMAIL_2: e2, ALERTA_BOT_EMAIL_3: e3,
      APP_URL: $('#cf-APP_URL').value.trim(),
      ALERTA_BOT_SILENCIO_NOCTURNO: $('#cf-ALERTA_BOT_SILENCIO_NOCTURNO').value,
      ALERTA_BOT_SILENCIO_INICIO: $('#cf-ALERTA_BOT_SILENCIO_INICIO').value,
      ALERTA_BOT_SILENCIO_FIN: $('#cf-ALERTA_BOT_SILENCIO_FIN').value
    };
    await guardarConfig_(cambios);
  });
}

function emailValido_(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||'').trim()); }

async function guardarConfig_(cambios){
  try{
    await apiPost('saveConfig', { usuarioId: currentUser.id, cambios });
    Object.assign(CFG.data.general, cambios);
    Swal.fire({icon:'success', title:'Guardado', timer:900, showConfirmButton:false});
  }catch(e){ Swal.fire({icon:'error', title:'No se pudo guardar', text:String(e.message||e)}); }
}

/* ── PROGRAMAS ── */
function fmtCOP_(n){ return '$ ' + (Number(n)||0).toLocaleString('es-CO'); }
/* Fase 15: máscara de pesos en vivo. Muestra "$ 50.000" mientras se
   escribe; vacío si no hay dígitos. Al guardar se envía onlyDigits(). */
function maskCOP_(v){ const d = onlyDigits(v); return d ? '$ ' + Number(d).toLocaleString('es-CO') : ''; }
function renderCfgProgramas_(){
  const cont = $('#cfg-programas');
  cont.innerHTML = CFG.data.programas.map((p,i)=>`
    <div class="cfg-card" id="prog-card-${i}">
      <div class="prog-row"><img src="${esc_(p.iconoUrl)}"><b>${esc_(p.nombre)}</b></div>
      <div class="cfg-grid">
        <div class="cfg-field"><label>Precio Inscripción (COP)</label><input id="pr-precio-${i}" type="text" inputmode="numeric" value="${maskCOP_(p.precio)}"></div>
        <div class="cfg-field"><label>Brochure (PDF)</label>
          <div class="brochure-line">
            ${p.brochureUrl?`<a class="file-btn" href="${esc_(p.brochureUrl)}" target="_blank">👁️ Ver actual</a>`:'<span class="cfg-hint">Sin brochure</span>'}
            <label class="file-btn">${p.brochureUrl?'♻️ Reemplazar':'⬆️ Subir PDF'}<input type="file" accept="application/pdf" style="display:none" id="pr-file-${i}"></label>
            <span class="brochure-ok" id="pr-ok-${i}"></span>
          </div>
        </div>
        <div class="cfg-field"><label>Condiciones (PDF)</label>
          <div class="brochure-line">
            ${p.condicionesUrl?`<a class="file-btn" href="${esc_(p.condicionesUrl)}" target="_blank">👁️ Ver actual</a>`:'<span class="cfg-hint">Sin condiciones</span>'}
            <label class="file-btn">${p.condicionesUrl?'♻️ Reemplazar':'⬆️ Subir PDF'}<input type="file" accept="application/pdf" style="display:none" id="pr-cfile-${i}"></label>
            <span class="brochure-ok" id="pr-cok-${i}"></span>
          </div>
        </div>
        <div class="cfg-field full"><label>Frase Motivacional</label><textarea id="pr-frase-${i}" rows="3" placeholder="Frase que acompaña el correo/WhatsApp de Asesoría Realizada (variable {frase})">${esc_(p.frase)}</textarea></div>
        <div class="cfg-field full"><label>Datos adicionales para el pago</label>
          <input id="pr-pago-${i}" type="text" value="${esc_(p.datosPago||'')}"
                 placeholder="Ej: sponsor y plan (Essential, Premium, Diamond)" />
          <div class="cfg-hint">Variable <b>{bloque_pago}</b> de la plantilla <b>PENDIENTE_PAGO</b>. Se agrega después de «fecha de nacimiento», precedida de coma. Vacío = no se envía nada.</div>
        </div>
      </div>
      <div class="cfg-actions"><button class="btn btn-primary" id="pr-save-${i}">Guardar</button></div>
    </div>`).join('');

  CFG.data.programas.forEach((p,i)=>{
    $('#pr-precio-'+i).addEventListener('input', e=>{ e.target.value = maskCOP_(e.target.value); });
    $('#pr-save-'+i).addEventListener('click', async ()=>{
      try{
        const res = await apiPost('savePrograma', { usuarioId: currentUser.id, id:p.id,
          precio: onlyDigits($('#pr-precio-'+i).value), frase: $('#pr-frase-'+i).value,
          datosPago: $('#pr-pago-'+i).value });                       // Fase 25
        CFG.data.programas = res;
        Swal.fire({icon:'success', title:'Programa guardado', timer:900, showConfirmButton:false});
      }catch(e){ Swal.fire({icon:'error', title:'Error', text:String(e.message||e)}); }
    });
    // Subir/reemplazar BROCHURE
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
    // Subir/reemplazar CONDICIONES (Fase 15)
    $('#pr-cfile-'+i).addEventListener('change', async (ev)=>{
      const file = ev.target.files[0]; if (!file) return;
      if (file.type !== 'application/pdf'){ Swal.fire({icon:'warning', title:'Debe ser PDF'}); return; }
      try{
        $('#pr-cok-'+i).textContent = 'Subiendo…';
        const base64 = await fileBase64_(file);
        const res = await apiPost('uploadCondiciones', { usuarioId: currentUser.id, id:p.id, filename:file.name, base64 });
        p.condicionesUrl = res.url;
        $('#pr-cok-'+i).textContent = '✓ Subido';
        renderCfgProgramas_();
        Swal.fire({icon:'success', title:'Condiciones actualizadas', timer:1000, showConfirmButton:false});
      }catch(e){ $('#pr-cok-'+i).textContent=''; Swal.fire({icon:'error', title:'No se pudo subir', text:String(e.message||e)}); }
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

/* ── PLANTILLAS (Fase 11) — ÚNICA gestión: lista dinámica + modal de EDICIÓN ──
   Solo se EDITA contenido/canal de claves existentes. No hay "Nueva"
   ni "Eliminar" (las plantillas nacen del código). Reutiliza el modal
   #modal-plantilla. */
function renderCfgPlantillas_(){
  const cont = $('#cfg-plantillas');
  pltWire_();
  const lista = CFG.data.plantillas || [];
  const cards = lista.map(p => {
    const canalCls = p.canal === 'EMAIL' ? 'email' : (p.canal === 'AMBOS' ? 'ambos' : '');
    const canalTxt = p.canal === 'EMAIL' ? 'Correo' : (p.canal === 'AMBOS' ? 'WA+Correo' : 'WhatsApp');
    const sysTag = p.sistema ? '<span class="plt-sys">Sistema</span>' : '';
    return `
      <div class="plt-card">
        <div class="plt-head">
          <span class="plt-clave">${esc_(p.clave)}</span>
          <span class="plt-canal ${canalCls}">${canalTxt}</span>
        </div>
        <div class="plt-desc">${esc_(p.descripcion || '')} ${sysTag}</div>
        <div class="plt-body">${esc_(p.cuerpo || '')}</div>
        <div class="plt-actions">
          <button class="plt-btn" data-pledit="${esc_(p.clave)}">Editar</button>
        </div>
      </div>`;
  }).join('');

  cont.innerHTML = `
    <div class="cfg-card" style="margin-bottom:12px;">
      <p class="muted" style="margin:0;">Plantillas de WhatsApp y correo. La lista es dinámica: las plantillas se crean desde el código (al cablear su flujo). Aquí editas su contenido y canal.</p>
    </div>
    <div class="plt-cards">${cards || '<p class="muted">Sin plantillas configuradas.</p>'}</div>`;

  cont.querySelectorAll('[data-pledit]').forEach(b => b.addEventListener('click', ()=>{
    const p = (CFG.data.plantillas || []).find(x => x.clave === b.getAttribute('data-pledit'));
    if (p) pltAbrirModal_(p);
  }));
}

/* Modal de edición (cableado una sola vez) */
let _pltWired = false;
function pltWire_(){
  if (_pltWired) return; _pltWired = true;
  $('#pl-modal-close')?.addEventListener('click', pltCerrarModal_);
  $('#pl-cancel')?.addEventListener('click', pltCerrarModal_);
  $('#pl-save')?.addEventListener('click', pltGuardar_);
  $('#pl-canal')?.addEventListener('change', pltToggleAsunto_);
  $('#modal-plantilla')?.addEventListener('click', (e)=>{ if (e.target.id === 'modal-plantilla') pltCerrarModal_(); });
}

function pltToggleAsunto_(){
  const canal = $('#pl-canal').value;
  const mostrar = (canal === 'EMAIL' || canal === 'AMBOS');
  $('#pl-asunto-fld')?.classList.toggle('hidden', !mostrar);
}

function pltAbrirModal_(p){
  $('#pl-modal-title').textContent = 'Editar plantilla';
  $('#pl-clave').value = p.clave;
  $('#pl-clave').disabled = true;                 // edición pura: la clave no cambia
  $('#pl-canal').value = p.canal || 'AMBOS';
  $('#pl-asunto').value = p.asunto || '';
  $('#pl-cuerpo').value = p.cuerpo || '';
  $('#pl-descripcion').value = p.descripcion || '';
  $('#pl-sys-note').classList.toggle('hidden', !p.sistema);
  pltToggleAsunto_();

  const vars = CFG.data.plantillaVariables || [];
  $('#pl-vars').innerHTML = vars.map(v => `<span class="plt-var-chip" data-var="${esc_(v)}">${esc_(v)}</span>`).join('');
  $('#pl-vars').querySelectorAll('.plt-var-chip').forEach(ch => ch.addEventListener('click', ()=> pltInsertVar_(ch.getAttribute('data-var'))));

  $('#modal-plantilla').classList.remove('hidden');
}
function pltCerrarModal_(){ $('#modal-plantilla').classList.add('hidden'); }

function pltInsertVar_(token){
  const ta = $('#pl-cuerpo');
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  ta.value = ta.value.slice(0, start) + token + ta.value.slice(end);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + token.length;
}

async function pltGuardar_(){
  const clave = $('#pl-clave').value.trim();
  const canal = $('#pl-canal').value;
  const asunto = $('#pl-asunto').value;
  const cuerpo = $('#pl-cuerpo').value.trim();
  const descripcion = $('#pl-descripcion').value;
  if (!cuerpo){ Swal.fire({ icon:'warning', title:'Falta el mensaje' }); return; }
  if ((canal === 'EMAIL' || canal === 'AMBOS') && !asunto.trim()){
    Swal.fire({ icon:'warning', title:'Falta el asunto', text:'El asunto es obligatorio para correo.' }); return;
  }
  try{
    CFG.data.plantillas = await apiPost('savePlantilla', {
      usuarioId: currentUser.id, clave, canal, asunto, cuerpo, descripcion
    });
    pltCerrarModal_();
    renderCfgPlantillas_();
    Swal.fire({ icon:'success', title:'Plantilla guardada', timer:1000, showConfirmButton:false });
  }catch(e){ Swal.fire({ icon:'error', title:'No se pudo guardar', text:String(e.message||e) }); }
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
    </div>
    <div class="cfg-card">
      <h3 class="cfg-card__title">🔗 CRM (botón en Comercial)</h3>
      <p class="cfg-card__sub">Enlace del CRM de BuilderBot que abre el botón "CRM". Lo ven SUPER/DEV/COMERCIAL; solo el DESARROLLADOR puede editarlo aquí.</p>
      <div class="cfg-grid">
        ${field_('cf-CRM_CHAT_URL','CRM_CHAT_URL', a.CRM_CHAT_URL, 'full')}
      </div>
      <div class="cfg-actions"><button class="btn btn-primary" id="cf-save-crm">Guardar CRM</button></div>
    </div>`;
  $('#cf-save-avanzado').addEventListener('click', async ()=>{
    const keys = ['BB_API_URL','BB_API_KEY','BB_ENDPOINT_BASE','BB_BOT_ID','BB_PROJECT_ID','BB_MANAGER_API'];
    const cambios = {}; keys.forEach(k => cambios[k] = $('#cf-'+k).value);
    try{ await apiPost('saveConfig', { usuarioId: currentUser.id, cambios });
      Object.assign(CFG.data.avanzado, cambios);
      Swal.fire({icon:'success', title:'Guardado', timer:900, showConfirmButton:false});
    }catch(e){ Swal.fire({icon:'error', title:'Error', text:String(e.message||e)}); }
  });
  $('#cf-save-crm').addEventListener('click', async ()=>{
    const cambios = { CRM_CHAT_URL: $('#cf-CRM_CHAT_URL').value.trim() };
    try{ await apiPost('saveConfig', { usuarioId: currentUser.id, cambios });
      CFG.data.avanzado.CRM_CHAT_URL = cambios.CRM_CHAT_URL;
      APP_CFG.CRM_CHAT_URL = cambios.CRM_CHAT_URL;   // refresca el botón sin recargar
      Swal.fire({icon:'success', title:'CRM actualizado', timer:900, showConfirmButton:false});
    }catch(e){ Swal.fire({icon:'error', title:'Error', text:String(e.message||e)}); }
  });
}

/* ============================================================
 * SELECTOR FECHA/HORA ESTILO iOS (ruedas; año fijo al actual)
 * ============================================================ */
const IOSP = { onOk:null, year:new Date().getFullYear() };
const IOSP_MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const IOSP_HORAS = []; for (let h=6; h<=20; h++) IOSP_HORAS.push(h); // bloques exactos 6 AM–8 PM (chips de la agenda)
/* Fase 24 — El asesor programa asesorías de 30 min: la rueda de la hora
   avanza de media en media (6:00 AM … 8:00 PM). Se guarda en minutos
   desde medianoche. Los chips de Configuración › Agenda siguen siendo
   en punto (usan IOSP_HORAS / iospHoraLabel_). */
const IOSP_SLOTS = []; for (let h=6; h<=20; h++){ IOSP_SLOTS.push(h*60); if (h<20) IOSP_SLOTS.push(h*60+30); }
const IOSP_H = 42;
function iospHoraLabel_(h){ const ap = h>=12?'PM':'AM'; let hh=h%12; if(hh===0)hh=12; return hh+':00 '+ap; }
function iospSlotLabel_(m){
  const h = Math.floor(m/60), mi = m%60;
  const ap = h>=12?'PM':'AM'; let hh = h%12; if(hh===0) hh=12;
  return hh+':'+String(mi).padStart(2,'0')+' '+ap;
}
function iospDiasMes_(mesIdx, year){ return new Date(year, mesIdx+1, 0).getDate(); }

function buildCol_(colEl, items, initIdx, onSettle){
  colEl.innerHTML = '<div class="iosp-pad"></div>' +
    items.map((t,i)=>`<div class="iosp-item" data-i="${i}">${t}</div>`).join('') +
    '<div class="iosp-pad"></div>';
  colEl.scrollTop = Math.max(0, initIdx)*IOSP_H;
  marcarSel_(colEl);
  let to=null;
  colEl.onscroll = ()=>{ marcarSel_(colEl); if(to)clearTimeout(to); to=setTimeout(()=>{ const i=selCol_(colEl); colEl.scrollTo({top:i*IOSP_H, behavior:'smooth'}); if (onSettle) onSettle(i); }, 90); };
  // Fase 22 — PC: clic directo en cualquier fila para seleccionarla
  // (además del arrastre en móvil). Deja la fila centrada al instante.
  colEl.querySelectorAll('.iosp-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      const i = +el.dataset.i;
      colEl.scrollTop = i*IOSP_H;   // instantáneo → lectura fiable
      marcarSel_(colEl);
      if (onSettle) onSettle(i);
    });
  });
}
/* Fase 22 — Mueve una columna del picker ±1 (flechas ▲▼ para PC). */
function iospNudge_(colId, delta){
  const colEl = $('#'+colId); if (!colEl) return;
  const n = colEl.querySelectorAll('.iosp-item').length;
  let i = Math.min(Math.max(selCol_(colEl)+delta, 0), n-1);
  colEl.scrollTop = i*IOSP_H;
  marcarSel_(colEl);
  if (colId==='iosp-mes') iospRebuildDias_(i);  // el mes recalcula días
}
/* Reconstruye la columna de días para el mes en la posición dada. */
function iospRebuildDias_(mesPos){
  const nuevoMes = IOSP.meses[Math.min(mesPos, IOSP.meses.length-1)];
  IOSP.dias = iospDiasArr_(nuevoMes);
  const curPos = Math.min(selCol_($('#iosp-dia')), IOSP.dias.length-1);
  buildCol_($('#iosp-dia'), IOSP.dias.map(String), Math.max(0, curPos));
}
function selCol_(colEl){ return Math.max(0, Math.round(colEl.scrollTop / IOSP_H)); }
function marcarSel_(colEl){ const i=selCol_(colEl); colEl.querySelectorAll('.iosp-item').forEach(el=> el.classList.toggle('sel', +el.dataset.i===i)); }

/* Días disponibles del mes elegido. Si es el MES ACTUAL, arranca en el
   día de HOY (Bug A: no se pueden elegir días pasados). */
function iospDiasArr_(mesIdx){
  const total = iospDiasMes_(mesIdx, IOSP.year);
  const desde = (mesIdx === IOSP.minMes) ? IOSP.minDia : 1;
  const arr = []; for (let d=desde; d<=total; d++) arr.push(d);
  return arr;
}

function abrirRuedaFecha_(valorISO, onOk, opts){
  IOSP.onOk = onOk;
  IOSP.soloFecha = !!(opts && opts.soloFecha);
  const ahora = new Date();
  IOSP.year   = ahora.getFullYear();
  IOSP.minMes = ahora.getMonth();   // Bug A: cota inferior = mes/día de hoy
  IOSP.minDia = ahora.getDate();
  $('#iosp-year').textContent = IOSP.year;
  $('#iosp-hora').style.display = IOSP.soloFecha ? 'none' : '';
  $$('.iosp-arrow-hora').forEach(b=> b.style.display = IOSP.soloFecha ? 'none' : '');

  let dRef = valorISO ? new Date(valorISO) : ahora;
  if (isNaN(dRef.getTime())) dRef = ahora;
  let mesIdx = (dRef.getFullYear() === IOSP.year) ? dRef.getMonth() : IOSP.minMes;
  if (mesIdx < IOSP.minMes) mesIdx = IOSP.minMes;                       // no meses pasados
  let dia = dRef.getDate();
  if (mesIdx === IOSP.minMes && dia < IOSP.minDia) dia = IOSP.minDia;   // no días pasados
  // Fase 24 — slot de 30 min (minutos desde medianoche), redondeado al más cercano
  let slot = dRef.getHours()*60 + (dRef.getMinutes() >= 30 ? 30 : 0);
  if (slot < 6*60) slot = 9*60;
  if (slot > 20*60) slot = 20*60;
  const horaIdx = Math.max(0, IOSP_SLOTS.indexOf(slot) >= 0 ? IOSP_SLOTS.indexOf(slot) : IOSP_SLOTS.indexOf(9*60));

  // Meses disponibles: del mes actual a diciembre (Bug A).
  IOSP.meses = []; for (let m=IOSP.minMes; m<=11; m++) IOSP.meses.push(m);
  const mesPos = Math.max(0, IOSP.meses.indexOf(mesIdx));
  IOSP.dias = iospDiasArr_(mesIdx);
  const diaPos = Math.max(0, IOSP.dias.indexOf(dia));

  // IMPORTANTE (Bug B): mostrar el picker ANTES de construir las columnas.
  // Con el contenedor en display:none, asignar scrollTop NO surte efecto,
  // así que la rueda quedaba en el índice 0 (la hora salía siempre 6:00 AM).
  $('#ios-picker').classList.remove('hidden');

  buildCol_($('#iosp-dia'), IOSP.dias.map(String), diaPos);
  buildCol_($('#iosp-mes'), IOSP.meses.map(m=>IOSP_MESES[m].charAt(0).toUpperCase()+IOSP_MESES[m].slice(1)), mesPos, (pos)=>{
    // Al cambiar el mes, recalcula los días disponibles (con cota de hoy).
    iospRebuildDias_(pos);
  });
  buildCol_($('#iosp-hora'), IOSP_SLOTS.map(iospSlotLabel_), horaIdx);
}

$('#iosp-cancel')?.addEventListener('click', ()=> $('#ios-picker').classList.add('hidden'));
/* Fase 22 — flechas ▲▼ del picker (PC) */
$$('.iosp-arrow').forEach(b=> b.addEventListener('click', ()=> iospNudge_(b.dataset.col, +b.dataset.d)));
$('#iosp-ok')?.addEventListener('click', ()=>{
  // Leer TODAS las columnas ANTES de ocultar el picker: en un contenedor
  // display:none, scrollTop vale 0. Antes la HORA se leía después de
  // ocultar → siempre salía 6:00 AM (índice 0). Por eso mes/día salían
  // bien y la hora no.
  const mesIdx  = IOSP.meses[Math.min(selCol_($('#iosp-mes')), IOSP.meses.length-1)];
  const dia     = IOSP.dias[Math.min(selCol_($('#iosp-dia')), IOSP.dias.length-1)];
  const slotMin = IOSP_SLOTS[Math.min(selCol_($('#iosp-hora')), IOSP_SLOTS.length-1)];   // Fase 24
  const pad = n => String(n).padStart(2,'0');
  $('#ios-picker').classList.add('hidden');
  if (IOSP.soloFecha){
    const iso = `${IOSP.year}-${pad(mesIdx+1)}-${pad(dia)}`;
    if (IOSP.onOk) IOSP.onOk(iso, `${dia} de ${IOSP_MESES[mesIdx]} de ${IOSP.year}`);
    return;
  }
  const iso = `${IOSP.year}-${pad(mesIdx+1)}-${pad(dia)}T${pad(Math.floor(slotMin/60))}:${pad(slotMin%60)}`;
  const texto = `${dia} de ${IOSP_MESES[mesIdx]} de ${IOSP.year} · ${iospSlotLabel_(slotMin)}`;
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
/* Fase 24.1 — Tres estados por hora:
     amarillo (.on)  = activa, visible en SEP-AGENDA, con sala creada
     gris     (.off) = apagada, oculta en SEP-AGENDA, la sala se conserva
     blanca          = sin marcar, no hay sala (al guardar se borra si existía)
   El chip cicla amarillo → gris → blanca. El paso a blanca pide confirmación
   porque es el único destructivo. */
const BCHIP_OFF_STYLE = 'background:#eef0f3;color:#8a8f98;border:1px dashed #c3c8d0';
function chipsBloques_(sel, apagados){
  const s=new Set(sel||[]), off=new Set(apagados||[]);
  let o='';
  for(let h=6;h<=20;h++){
    const k=String(h).padStart(2,'0')+':00';
    const esOff = s.has(k) && off.has(k);
    const esOn  = s.has(k) && !esOff;
    const cls   = esOn ? 'on' : (esOff ? 'off' : '');
    const st    = esOff ? ` style="${BCHIP_OFF_STYLE}"` : '';
    const tit   = esOn ? 'Visible en SEP-AGENDA · clic para apagar'
                       : (esOff ? 'Oculta en SEP-AGENDA (la sala se conserva) · clic para desmarcar'
                                : 'Sin marcar · clic para activar');
    o+=`<span class="bchip ${cls}" data-h="${k}" title="${tit}"${st}>${iospHoraLabel_(h)}</span>`;
  }
  return o;
}

function renderCfgAgenda_(){
  const a = CFG.data.agenda || { dias:[] };
  // Fase 24.1 — 'activo' por día (por defecto encendido)
  CFG.agenda = { dias: (a.dias||[]).map(d=>({
    fecha:d.fecha,
    bloques:[...(d.bloques||[])],
    bloquesApagados:[...(d.bloquesApagados||[])],   // Fase 24.1
    activo: d.activo !== false
  })) };
  const cont = $('#cfg-agenda');
  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card__title">📨 Correo de Asesorías</h3>
      <p class="cfg-card__sub">Se le da administración sobre todos los eventos de asesoría (los de la disponibilidad y los que programa el asesor desde Comercial).</p>
      <div class="cfg-grid">
        <div class="cfg-field full">
          <label>Correo de Asesorías</label>
          <input id="cf-EMAIL_ASESORIAS" type="email" value="${esc_(a.correoAsesorias||'')}" placeholder="comercialsepcolombia@gmail.com" />
          <div class="cfg-hint">Si lo dejas vacío se usa <b>comercialsepcolombia@gmail.com</b>.</div>
        </div>
      </div>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card__title">📅 Días disponibles</h3>
      <p class="cfg-card__sub">Agrega las fechas concretas en las que atenderás asesorías y marca los horarios de cada día. Cada bloque admite varios estudiantes (cupos compartidos). Al guardar se crea el evento de calendario y el Meet de cada horario. <b>Apagar</b> un día lo oculta en SEP-AGENDA sin borrar su disponibilidad ni sus eventos.</p>
      <button type="button" class="btn btn-accent" id="agenda-add">+ Agregar día</button>
      <p class="cfg-hint" style="margin-top:10px">
        <b>Amarillo</b>: visible en SEP-AGENDA. ·
        <b>Gris</b>: apagada, oculta en SEP-AGENDA pero el evento y el Meet se conservan. ·
        <b>Blanco</b>: sin marcar, no hay evento. Cada clic avanza al siguiente estado.
      </p>
      <div class="agenda-dias" id="agenda-dias"></div>
    </div>
    <div class="cfg-actions"><button class="btn btn-primary" id="agenda-save">Guardar disponibilidad</button></div>`;
  renderDiasAgenda_();

  // Toggle de bloques + quitar día, delegados en #agenda-dias (se recrea
  // en cada render → NO se acumulan listeners como pasaba al colgarlos
  // del contenedor persistente #cfg-agenda).
  $('#agenda-dias').addEventListener('click', async (e)=>{
    const chip = e.target.closest('.bchip');
    if (chip){
      // Fase 24.1 — ciclo amarillo → gris → blanco
      if (chip.classList.contains('on')){            // activa → apagada
        chip.classList.remove('on'); chip.classList.add('off');
        chip.setAttribute('style', BCHIP_OFF_STYLE);
      } else if (chip.classList.contains('off')){    // apagada → sin marcar (destructivo)
        const ok = await Swal.fire({
          icon:'warning', title:'¿Desmarcar esta hora?',
          html:'Al guardar se <b>eliminará el evento de calendario y su Meet</b> de este horario.<br>' +
               'Si prefieres solo ocultarla, déjala en gris.<br><br>' +
               '<small>Los estudiantes ya agendados conservan su asesoría y su enlace.</small>',
          showCancelButton:true, confirmButtonText:'Sí, desmarcar', cancelButtonText:'Cancelar',
          confirmButtonColor:'#d33'
        });
        if (!ok.isConfirmed) return;
        chip.classList.remove('off'); chip.removeAttribute('style');
      } else {                                       // sin marcar → activa
        chip.classList.add('on');
      }
      return;
    }
    // Fase 24.1 — Apagar / Encender el día (no borra nada)
    const tog = e.target.closest('[data-toggle]');
    if (tog){
      sincronizarAgenda_();
      const dia = CFG.agenda.dias.find(d=>d.fecha===tog.dataset.toggle);
      if (dia) dia.activo = (dia.activo === false);
      renderDiasAgenda_();
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del){
      sincronizarAgenda_();
      CFG.agenda.dias = CFG.agenda.dias.filter(d=>d.fecha!==del.dataset.del);
      renderDiasAgenda_();
    }
  });
  // Agregar día
  $('#agenda-add').addEventListener('click', ()=>{
    abrirRuedaFecha_('', (iso)=>{
      sincronizarAgenda_();
      if (!CFG.agenda.dias.some(d=>d.fecha===iso)) CFG.agenda.dias.push({fecha:iso, bloques:[], bloquesApagados:[], activo:true});
      renderDiasAgenda_();
    }, { soloFecha:true });
  });
  // Guardar
  $('#agenda-save').addEventListener('click', async ()=>{
    sincronizarAgenda_();
    if (!CFG.agenda.dias.length) return Swal.fire({icon:'warning', title:'Agrega al menos un día'});
    // Fase 24 — Correo de Asesorías (opcional; si va, debe ser válido)
    const correoAses = $('#cf-EMAIL_ASESORIAS').value.trim();
    if (correoAses && !emailValido_(correoAses)){
      return Swal.fire({icon:'warning', title:'Correo de Asesorías inválido', text:'Revisa el formato del correo.'});
    }
    try{
      CFG.data.agenda = await apiPost('saveAgenda', {
        usuarioId: currentUser.id,
        agenda: CFG.agenda,
        correoAsesorias: correoAses          // Fase 24
      });
      // Fase 24: el backend devuelve el resumen de salas creadas/borradas
      const ev = CFG.data.agenda.eventos || {};
      const detalle = [
        ev.creados    ? `${ev.creados} sala(s) creada(s)`     : '',
        ev.eliminados ? `${ev.eliminados} sala(s) eliminada(s)` : ''
      ].filter(Boolean).join(' · ');
      if (ev.errores && ev.errores.length){
        Swal.fire({icon:'warning', title:'Disponibilidad guardada',
          text:'Algunos horarios no pudieron crear su evento de calendario. Revisa el ID del calendario y los permisos.'});
      } else {
        Swal.fire({icon:'success', title:'Disponibilidad guardada',
          text: detalle || undefined, timer: detalle ? 1800 : 1000, showConfirmButton:false});
      }
    }catch(e){ Swal.fire({icon:'error', title:'Error', text:String(e.message||e)}); }
  });
}

function renderDiasAgenda_(){
  const a = CFG.agenda;
  $('#agenda-dias').innerHTML = (a.dias||[]).slice().sort((x,y)=>x.fecha.localeCompare(y.fecha)).map(d=>{
    // Fase 24.1 — Apagar/Encender: oculta el día en SEP-AGENDA sin borrar
    // la disponibilidad ni los eventos del calendario.
    const on = d.activo !== false;
    return `
    <div class="agenda-dia" data-fecha="${d.fecha}" style="${on?'':'opacity:.62'}">
      <div class="agenda-dia__head" style="display:flex;align-items:center;gap:8px">
        <b>${labelFechaISO_(d.fecha)}</b>
        ${on?'':'<span class="mini-tag" style="margin-left:8px;font-size:11px;font-weight:700;color:#8a8f98;border:1px solid #d7dae0;border-radius:999px;padding:2px 8px">Oculto en SEP-AGENDA</span>'}
        <span style="flex:1"></span>
        <button type="button" class="mini-btn" data-toggle="${d.fecha}" title="${on?'Ocultar este día en SEP-AGENDA':'Volver a mostrar este día en SEP-AGENDA'}">${on?'Apagar':'Encender'}</button>
        <button type="button" class="mini-btn danger" data-del="${d.fecha}">Quitar</button>
      </div>
      <div class="bloques-chips" style="margin-top:10px">${chipsBloques_(d.bloques, d.bloquesApagados)}</div>
    </div>`;
  }).join('') || '<p class="cfg-hint">Aún no agregas días.</p>';
}

/* Lee el DOM y actualiza CFG.agenda (para no perder la selección de
   bloques al re-renderizar). Fase 13: ya no hay modo unificado. */
function sincronizarAgenda_(){
  const a = CFG.agenda;
  $$('#agenda-dias .agenda-dia').forEach(card=>{
    const dia = a.dias.find(d=>d.fecha===card.dataset.fecha); if (!dia) return;
    // Fase 24.1 — 'bloques' = activas + apagadas (ambas tienen sala).
    // 'bloquesApagados' = solo las grises. Las blancas quedan fuera y su
    // sala se borra al guardar.
    const on  = [...card.querySelectorAll('.bchip.on')].map(c=>c.dataset.h);
    const off = [...card.querySelectorAll('.bchip.off')].map(c=>c.dataset.h);
    dia.bloques = on.concat(off).sort();
    dia.bloquesApagados = off.sort();
    if (dia.activo === undefined) dia.activo = true;
  });
}

/* ============================================================
 * MÓDULO USUARIOS (Fase 9) — CRUD del equipo
 * ============================================================
 * Lista del equipo + modal crear/editar/eliminar con foto en
 * Drive. Solo SUPERUSUARIO/DESARROLLADOR. El DESARROLLADOR no es
 * editable ni eliminable (también reforzado en backend). El rol
 * DESARROLLADOR solo puede asignarlo otro DESARROLLADOR.
 * ============================================================ */
const USR_FOTO_FALLBACK = 'https://res.cloudinary.com/dqqeavica/image/upload/v1776287377/usuarios_dkzfqk.webp';
/* Normaliza cualquier URL de foto a un formato renderizable en <img>.
   - Drive (cualquier formato) → thumbnail?id=...&sz=w1000
   - No-Drive (Cloudinary, etc.) → se usa tal cual
   - Vacío → fallback */
function driveImg_(url){
  const s = String(url || '');
  if (!s) return USR_FOTO_FALLBACK;
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!m) return s; // no es de Drive → respetar (p. ej. Cloudinary)
  return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1000';
}
const USR_ROL_COLOR = {
  DESARROLLADOR: 'var(--rol-dev)',
  SUPERUSUARIO:  'var(--rol-super)',
  CONTADOR:      'var(--rol-contador)',
  COMERCIAL:     'var(--rol-comercial)'
};
const USR_ROL_CORTO = { DESARROLLADOR:'DEV', SUPERUSUARIO:'SUPER', CONTADOR:'CONTADOR', COMERCIAL:'COMERCIAL' };

let USR = { all: [], filtro: '', pendingFoto: '', _wired: false };

async function abrirUsuarios_(){
  const rol = String(currentUser?.rol || '').toUpperCase();
  if (rol !== 'DESARROLLADOR' && rol !== 'SUPERUSUARIO'){
    Swal.fire({ icon:'warning', title:'Sin permiso', text:'Solo SUPERUSUARIO o DESARROLLADOR pueden gestionar usuarios.' });
    return;
  }
  usrWire_();
  showView('usuarios');
  await usrLoad_();
}

async function usrLoad_(silent){
  try{
    USR.all = await apiGet('listUsuarios', { usuarioId: currentUser.id }, { silent: !!silent });
  }catch(e){
    Swal.fire({ icon:'error', title:'No se pudo cargar', text:String(e.message||e) });
    USR.all = [];
  }
  usrRenderList_();
}

function usrFiltrados_(){
  const q = USR.filtro.trim().toLowerCase();
  if (!q) return USR.all;
  return USR.all.filter(u =>
    String(u.nombre).toLowerCase().includes(q) ||
    String(u.documento).toLowerCase().includes(q) ||
    String(u.email).toLowerCase().includes(q)
  );
}

function usrRenderList_(){
  const cont = $('#usr-cards');
  const empty = $('#usr-empty');
  const list = usrFiltrados_();
  if (!list.length){ cont.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  cont.innerHTML = list.map(u => {
    const color = USR_ROL_COLOR[u.rol] || 'var(--text-soft)';
    const foto  = esc_(driveImg_(u.fotoUrl));   // ← ANTES: esc_(u.fotoUrl || USR_FOTO_FALLBACK)
    const meta  = [u.documento, u.email].filter(Boolean).map(esc_).join(' · ');
    const acciones = u.esDev
      ? `<span class="usr-lock" title="Protegido"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>`
      : `<button class="usr-iconbtn" data-edit="${esc_(u.id)}" title="Editar"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
         <button class="usr-iconbtn danger" data-del="${esc_(u.id)}" title="Eliminar"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;
    return `
      <div class="usr-card ${u.activo ? '' : 'is-inactive'}" style="--rolc:${color};">
        <img class="usr-avatar" src="${foto}" alt="${esc_(u.nombre)}" loading="lazy" onerror="this.src='${USR_FOTO_FALLBACK}'" />
        <div class="usr-info">
          <div class="usr-name">${esc_(u.nombre)}</div>
          <div class="usr-meta">${meta || '—'}</div>
          <div class="usr-chips">
            <span class="usr-chip-rol" style="background:${color};">${esc_(USR_ROL_CORTO[u.rol] || u.rol)}</span>
            <span class="usr-chip-estado ${u.activo ? 'on' : ''}">${u.activo ? 'Activo' : 'Inactivo'}</span>
          </div>
        </div>
        <div class="usr-actions">${acciones}</div>
      </div>`;
  }).join('');
}

function usrOpcionesRol_(){
  const soyDev = String(currentUser?.rol || '').toUpperCase() === 'DESARROLLADOR';
  const base = ['SUPERUSUARIO','CONTADOR','COMERCIAL'];
  if (soyDev) base.unshift('DESARROLLADOR');
  return base.map(r => `<option value="${r}">${esc_(r)}</option>`).join('');
}

function usrAbrirModal_(u){
  USR.pendingFoto = '';
  const esEdicion = !!u;
  $('#usr-modal-title').textContent = esEdicion ? 'Editar usuario' : 'Nuevo usuario';
  $('#u-rol').innerHTML = usrOpcionesRol_();

  $('#u-id').value        = esEdicion ? u.id : '';
  $('#u-nombre').value    = esEdicion ? (u.nombre || '') : '';
  $('#u-documento').value = esEdicion ? (u.documento || '') : '';
  $('#u-telefono').value  = esEdicion ? (u.telefono || '') : '';
  $('#u-email').value     = esEdicion ? (u.email || '') : '';
  $('#u-pin').value       = esEdicion ? (u.pin && /^\d{4}$/.test(u.pin) ? u.pin : '') : '';
  $('#u-rol').value       = esEdicion ? (u.rol || 'COMERCIAL') : 'COMERCIAL';
  $('#u-activo').value    = esEdicion ? (u.activo ? 'TRUE' : 'FALSE') : 'TRUE';
  $('#u-foto-prev').src   = esEdicion ? driveImg_(u.fotoUrl) : USR_FOTO_FALLBACK;   // ← ANTES: (u.fotoUrl || USR_FOTO_FALLBACK)
  $('#u-foto-ok').textContent = '';
  $('#u-foto-file').value = '';

  $('#modal-usuario').classList.remove('hidden');
}
function usrCerrarModal_(){ $('#modal-usuario').classList.add('hidden'); }

async function usrGuardar_(){
  const id   = $('#u-id').value.trim();
  const pin  = $('#u-pin').value.trim();
  const doc  = onlyDigits($('#u-documento').value);
  const body = {
    usuarioId: currentUser.id,
    id:        id || undefined,
    nombre:    $('#u-nombre').value.trim(),
    documento: doc,
    telefono:  onlyDigits($('#u-telefono').value),
    email:     $('#u-email').value.trim(),
    pin:       pin,
    rol:       $('#u-rol').value,
    activo:    $('#u-activo').value
  };
  if (USR.pendingFoto) body.fotoUrl = USR.pendingFoto;

  // Validación rápida en cliente (el servidor es la verdad)
  if (!body.nombre){ Swal.fire({icon:'warning', title:'Falta el nombre'}); return; }
  if (!doc){ Swal.fire({icon:'warning', title:'Falta el documento'}); return; }
  if (!/^\d{4}$/.test(pin)){ Swal.fire({icon:'warning', title:'PIN inválido', text:'Deben ser 4 dígitos.'}); return; }

  try{
    await apiPost('saveUsuario', body);
    usrCerrarModal_();
    await usrLoad_(true);
    Swal.fire({ icon:'success', title: id ? 'Usuario actualizado' : 'Usuario creado', timer:1000, showConfirmButton:false });
  }catch(e){
    Swal.fire({ icon:'error', title:'No se pudo guardar', text:String(e.message||e) });
  }
}

async function usrEliminar_(u){
  const r = await Swal.fire({
    icon:'warning', title:'¿Eliminar usuario?',
    html:`Se eliminará <b>${esc_(u.nombre)}</b> de forma permanente.`,
    showCancelButton:true, confirmButtonText:'Eliminar', cancelButtonText:'Cancelar',
    confirmButtonColor:'#dc3545'
  });
  if (!r.isConfirmed) return;
  try{
    await apiPost('eliminarUsuario', { usuarioId: currentUser.id, id: u.id });
    await usrLoad_(true);
    Swal.fire({ icon:'success', title:'Usuario eliminado', timer:1000, showConfirmButton:false });
  }catch(e){
    Swal.fire({ icon:'error', title:'No se pudo eliminar', text:String(e.message||e) });
  }
}

async function usrSubirFoto_(file){
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)){
    Swal.fire({ icon:'warning', title:'Formato no válido', text:'Usa PNG, JPG o WEBP.' });
    return;
  }
  try{
    $('#u-foto-ok').textContent = 'Subiendo…';
    const base64 = await fileBase64_(file);
    const editId = $('#u-id').value.trim();
    // En edición pasamos id (reemplaza y limpia la anterior en Drive).
    // En alta no hay id: solo subimos y adjuntamos la URL al guardar.
    const payload = { usuarioId: currentUser.id, filename: file.name, base64 };
    if (editId) payload.id = editId;
    const res = await apiPost('uploadFotoUsuario', payload);
    USR.pendingFoto = res.url;
    $('#u-foto-prev').src = res.url;
    $('#u-foto-ok').textContent = '✓ Lista';
  }catch(e){
    $('#u-foto-ok').textContent = '';
    Swal.fire({ icon:'error', title:'No se pudo subir', text:String(e.message||e) });
  }
}

function usrWire_(){
  if (USR._wired) return;
  USR._wired = true;

  $('#usr-search')?.addEventListener('input', (e)=>{ USR.filtro = e.target.value || ''; usrRenderList_(); });
  $('#usr-add')?.addEventListener('click', ()=> usrAbrirModal_(null));

  $('#usr-modal-close')?.addEventListener('click', usrCerrarModal_);
  $('#usr-cancel')?.addEventListener('click', usrCerrarModal_);
  $('#usr-save')?.addEventListener('click', usrGuardar_);
  $('#modal-usuario')?.addEventListener('click', (e)=>{ if (e.target.id === 'modal-usuario') usrCerrarModal_(); });

  $('#u-foto-btn')?.addEventListener('click', ()=> $('#u-foto-file').click());
  $('#u-foto-file')?.addEventListener('change', (e)=> usrSubirFoto_(e.target.files[0]));
  $('#u-pin')?.addEventListener('input', (e)=>{ e.target.value = onlyDigits(e.target.value).slice(0,4); });
  $('#u-documento')?.addEventListener('input', (e)=>{ e.target.value = onlyDigits(e.target.value); });

  // Delegación para editar / eliminar en las tarjetas
  $('#usr-cards')?.addEventListener('click', (e)=>{
    const ed = e.target.closest('[data-edit]');
    const dl = e.target.closest('[data-del]');
    if (ed){ const u = USR.all.find(x => String(x.id) === ed.getAttribute('data-edit')); if (u) usrAbrirModal_(u); }
    else if (dl){ const u = USR.all.find(x => String(x.id) === dl.getAttribute('data-del')); if (u) usrEliminar_(u); }
  });
}

/* ============================================================
 * MÓDULO MI BOT (Fase 11) — solo CONEXIÓN
 * ============================================================
 * Conexión: control del bot de WhatsApp (BuilderBot) — estado,
 * QR para vincular, reiniciar, silenciar, eliminar sesión y
 * acciones por contacto. La API key vive solo en el servidor.
 * Las plantillas se gestionan en Configuración › Plantillas (Fase 11).
 * Sin difusión masiva.
 * ============================================================ */
const MB = { silenciado:false, qrPoll:null, _wired:false };

async function abrirBot_(){
  const rol = String(currentUser?.rol || '').toUpperCase();
  if (rol !== 'DESARROLLADOR' && rol !== 'SUPERUSUARIO'){
    Swal.fire({ icon:'warning', title:'Sin permiso', text:'Solo SUPERUSUARIO o DESARROLLADOR pueden gestionar el bot.' });
    return;
  }
  botWire_();
  showView('bot');
  botPollingStop_();
  botRenderConexion_();
}

function botWire_(){
  if (MB._wired) return;
  MB._wired = true;
  $('#bot-refresh')?.addEventListener('click', botEstado_);
}

/* ================== CONEXIÓN ================== */
function botRenderConexion_(){
  $('#bot-conexion').innerHTML = `
    <div id="bot-status" class="bot-status bot-status--unknown">
      <div class="bot-status__icon">⏳</div>
      <div class="bot-status__txt">Consultando estado…</div>
      <div class="bot-status__sub">Un momento por favor</div>
    </div>

    <div class="bot-section">
      <h3 class="bot-section__title">📱 Conectar WhatsApp</h3>
      <p class="muted">Si el bot está desconectado, genera el código QR y escanéalo desde WhatsApp → Dispositivos vinculados.</p>
      <button id="bot-qr-btn" class="btn btn-primary btn-block mt-sm">⚡ Inicializar conexión</button>
      <div id="bot-qr-box" style="text-align:center"></div>
    </div>

    <div class="bot-section">
      <h3 class="bot-section__title">🛠 Controles del bot</h3>
      <div class="bot-btn-grid">
        <button class="bot-action" id="bot-reboot"><span class="bot-action__icon">🔄</span>Reiniciar</button>
        <button class="bot-action" id="bot-mute"><span class="bot-action__icon">🔇</span><span id="bot-mute-lbl">Silenciar</span></button>
      </div>
      <button class="bot-action danger" id="bot-logout" style="width:100%;margin-top:10px;flex-direction:row;gap:10px;"><span class="bot-action__icon">🗑️</span>Eliminar sesión</button>
    </div>

    <div class="bot-section">
      <h3 class="bot-section__title">👤 Gestionar un contacto</h3>
      <p class="muted">Escribe el número con código de país (ej. 573001234567) para bloquearlo, desbloquearlo o limpiar su conversación.</p>
      <div class="bot-contacto-row mt-sm"><input id="bot-num" inputmode="numeric" placeholder="573001234567" /></div>
      <div class="bot-btn-grid mt-sm">
        <button class="bot-action" id="bot-block"><span class="bot-action__icon">🚫</span>Bloquear</button>
        <button class="bot-action" id="bot-unblock"><span class="bot-action__icon">✅</span>Desbloquear</button>
      </div>
      <button class="bot-action" id="bot-clear" style="width:100%;margin-top:10px;flex-direction:row;gap:10px;"><span class="bot-action__icon">🧹</span>Limpiar conversación</button>
    </div>`;

  $('#bot-qr-btn').addEventListener('click', botQR_);
  $('#bot-reboot').addEventListener('click', botReiniciar_);
  $('#bot-mute').addEventListener('click', botMute_);
  $('#bot-logout').addEventListener('click', botEliminarSesion_);
  $('#bot-block').addEventListener('click', ()=> botContacto_('botBloquear', 'Bloquear contacto'));
  $('#bot-unblock').addEventListener('click', ()=> botContacto_('botDesbloquear', 'Desbloquear contacto'));
  $('#bot-clear').addEventListener('click', ()=> botContacto_('botLimpiar', 'Limpiar conversación'));
  $('#bot-num')?.addEventListener('input', (e)=>{ e.target.value = onlyDigits(e.target.value); });

  botEstado_();
}

async function botEstado_(){
  const box = $('#bot-status'); if (!box) return;
  try{
    const r = await apiGet('botEstado', { usuarioId: currentUser.id }, { silent:true });
    if (r.configurado === false){
      box.className = 'bot-status bot-status--unknown';
      box.innerHTML = '<div class="bot-status__icon">⚙️</div><div class="bot-status__txt">Bot sin configurar</div><div class="bot-status__sub">El DESARROLLADOR debe cargar las claves en Configuración › Avanzado</div>';
      return;
    }
    const st = String(r.status || 'UNKNOWN').toUpperCase();
    if (st === 'ONLINE'){ box.className='bot-status bot-status--online'; box.innerHTML='<div class="bot-status__icon">🟢</div><div class="bot-status__txt">Tu bot está conectado</div><div class="bot-status__sub">Funcionando correctamente</div>'; }
    else if (st === 'READY_TO_SCAN'){ box.className='bot-status bot-status--scan'; box.innerHTML='<div class="bot-status__icon">🟡</div><div class="bot-status__txt">Esperando que escanees el QR</div><div class="bot-status__sub">Genera el QR abajo y escanéalo</div>'; }
    else if (st === 'OFFLINE' || st === 'FAILED'){ box.className='bot-status bot-status--offline'; box.innerHTML='<div class="bot-status__icon">🔴</div><div class="bot-status__txt">Tu bot está desconectado</div><div class="bot-status__sub">Genera el QR para reconectarlo</div>'; }
    else { box.className='bot-status bot-status--unknown'; box.innerHTML=`<div class="bot-status__icon">⚪</div><div class="bot-status__txt">Estado: ${esc_(st)}</div><div class="bot-status__sub">Toca actualizar para reintentar</div>`; }
  }catch(e){
    box.className='bot-status bot-status--unknown';
    box.innerHTML=`<div class="bot-status__icon">⚪</div><div class="bot-status__txt">No se pudo consultar</div><div class="bot-status__sub">${esc_(String(e.message||e))}</div>`;
  }
}

async function botQR_(){
  const boxQR = $('#bot-qr-box');
  const btn = $('#bot-qr-btn');
  if (btn){ btn.disabled = true; btn.textContent = '⏳ Conectando…'; }
  boxQR.innerHTML = '<p class="muted">Preparando la conexión… (si el bot estaba apagado puede tardar unos segundos)</p>';
  try{
    const r = await apiGet('botQR', { usuarioId: currentUser.id }, { silent:true });
    const qr = r && r.qr ? String(r.qr) : '';
    if (!qr){
      if (btn){ btn.disabled = false; btn.textContent = '📲 Generar QR'; }
      boxQR.innerHTML = `<p class="muted">${esc_((r && r.error) || 'Conexión inicializada. Toca Generar QR para ver el código.')}</p>`;
      return;
    }
    const src = qr.indexOf('data:') === 0 ? qr : (/^https?:\/\//.test(qr) ? qr : 'data:image/png;base64,' + qr);
    boxQR.innerHTML = `
      <img class="bot-qr-img" src="${src}" alt="Código QR de WhatsApp" onerror="this.replaceWith(document.createTextNode('No se pudo mostrar el QR. Toca Regenerar.'))" />
      <p class="muted">Escanéalo desde WhatsApp → <b>Dispositivos vinculados</b>. El código se renueva cada cierto tiempo.</p>
      <button class="bot-action" id="bot-qr-regen" style="width:100%;flex-direction:row;gap:10px;"><span class="bot-action__icon">🔄</span>Regenerar QR</button>`;
    if (btn){ btn.disabled = false; btn.textContent = '📲 Generar QR'; }
    $('#bot-qr-regen')?.addEventListener('click', botQR_);
    botPollingStart_();
  }catch(e){
    if (btn){ btn.disabled = false; btn.textContent = '⚡ Inicializar conexión'; }
    boxQR.innerHTML = `<p class="muted">${esc_(String(e.message||e))}</p>`;
  }
}

function botPollingStart_(){
  botPollingStop_();
  MB.qrPoll = setInterval(async ()=>{
    const img = $('#bot-qr-box .bot-qr-img');
    if (!img){ botPollingStop_(); return; }
    try{
      await botEstado_();
      if ($('#bot-status')?.classList.contains('bot-status--online')){
        botPollingStop_();
        img.classList.add('bot-qr-img--connected');
        if (!$('#bot-qr-ok')){
          const ok = document.createElement('div');
          ok.id = 'bot-qr-ok'; ok.className = 'bot-qr-ok';
          ok.innerHTML = '🟢 <b>WhatsApp conectado</b><br><span>Ya puedes cerrar esta vista.</span>';
          img.insertAdjacentElement('afterend', ok);
        }
      }
    }catch(_){}
  }, 60000);
}
function botPollingStop_(){ if (MB.qrPoll){ clearInterval(MB.qrPoll); MB.qrPoll = null; } }

async function botConfirm_(title, html, confirmText){
  const r = await Swal.fire({ icon:'warning', title, html, showCancelButton:true, confirmButtonText:confirmText||'Sí', cancelButtonText:'Cancelar' });
  return r.isConfirmed;
}

async function botReiniciar_(){
  if (!await botConfirm_('Reiniciar bot', 'El bot se reiniciará y puede tardar unos segundos en reconectarse. ¿Continuar?', 'Sí, reiniciar')) return;
  try{
    const r = await apiPost('botReiniciar', { usuarioId: currentUser.id });
    if (r.ok) Swal.fire({ icon:'success', title:'Bot reiniciado', timer:1100, showConfirmButton:false });
    else Swal.fire({ icon:'info', title:'Aviso', text:'No se confirmó el reinicio.' });
    setTimeout(botEstado_, 2000);
  }catch(e){ Swal.fire({ icon:'error', title:'Error', text:String(e.message||e) }); }
}

async function botMute_(){
  const nuevo = !MB.silenciado;
  if (!await botConfirm_(nuevo?'Silenciar bot':'Activar bot', nuevo?'El bot dejará de responder mensajes. ¿Continuar?':'El bot volverá a responder mensajes. ¿Continuar?', 'Sí')) return;
  try{
    const r = await apiPost('botMute', { usuarioId: currentUser.id, flag: nuevo });
    if (r.ok){ MB.silenciado = nuevo; const l = $('#bot-mute-lbl'); if (l) l.textContent = nuevo ? 'Activar' : 'Silenciar';
      Swal.fire({ icon:'success', title: nuevo ? 'Bot silenciado' : 'Bot activado', timer:1000, showConfirmButton:false }); }
    else Swal.fire({ icon:'info', title:'Aviso', text:'No se confirmó el cambio.' });
  }catch(e){ Swal.fire({ icon:'error', title:'Error', text:String(e.message||e) }); }
}

async function botEliminarSesion_(){
  if (!await botConfirm_('Eliminar sesión', 'Esto cerrará la sesión de WhatsApp del bot y eliminará el despliegue actual.<br>Tendrás que generar un nuevo <b>QR</b> y escanearlo para reconectar.<br><br>¿Continuar?', 'Sí, eliminar sesión')) return;
  try{
    const r = await apiPost('botEliminarSesion', { usuarioId: currentUser.id });
    if (r.ok) Swal.fire({ icon:'success', title:'Sesión eliminada', text:'El bot se desconectó. Genera un nuevo QR para volver a vincular WhatsApp.' });
    else Swal.fire({ icon:'info', title:'Aviso', text:'No se pudo confirmar la eliminación.' });
    setTimeout(botEstado_, 2000);
  }catch(e){ Swal.fire({ icon:'error', title:'Error', text:String(e.message||e) }); }
}

async function botContacto_(action, titulo){
  const num = onlyDigits(($('#bot-num').value || ''));
  if (num.length < 8){ Swal.fire({ icon:'warning', title:'Número inválido', text:'Escribe un número con código de país (ej. 573001234567).' }); return; }
  if (!await botConfirm_(titulo, `Acción sobre el número <b>${esc_(num)}</b>. ¿Continuar?`, 'Sí')) return;
  try{
    const r = await apiPost(action, { usuarioId: currentUser.id, numero: num });
    if (r.ok) Swal.fire({ icon:'success', title:'Listo', timer:1000, showConfirmButton:false });
    else Swal.fire({ icon:'info', title:'Aviso', text:'No se confirmó la acción.' });
  }catch(e){ Swal.fire({ icon:'error', title:'Error', text:String(e.message||e) }); }
}
