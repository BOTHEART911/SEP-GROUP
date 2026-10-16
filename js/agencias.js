/* =============================================================
 * SEP GROUP — SUBAGENCIAS (Fase 6 · Entrega 6.2 · 16/10/2026)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario. Modificarlo anula la garantía de funcionamiento.
 * -------------------------------------------------------------
 * DOS CARAS
 *   1. SEP (vista Subagencias): el Superusuario crea y configura las
 *      agencias (datos, logo, contacto, estado, cuenta de acceso,
 *      valores por temporada, mínimo de viajeros, sponsors visibles y
 *      auditoría). El Contador entra solo a lo financiero (agencias,
 *      valores y cuenta), sin contacto, sin accesos y sin auditoría.
 *   2. La AGENCIA: entra por la pestaña "Agencia" del login (usuario y
 *      contraseña), con la marca SEP en el login y SU logo después.
 *      Ve un inicio reducido: Mis participantes (llega en la entrega
 *      siguiente) y Mi agencia.
 *
 * RENDIMIENTO
 *   · Una vista, un viaje: agenciasInit trae agencias + temporadas +
 *     valores + configuración; agInicio trae todo el inicio de la agencia.
 *   · Cabecera antes que datos: el inicio de la agencia se pinta con lo
 *     que trae la sesión (nombre y logo) y agInicio completa de fondo.
 *   · Tras guardar se parcha la memoria (no se recarga la lista).
 *   · Lecturas con corte al salir de la vista (opts.vista).
 * ============================================================= */
(function () {
  'use strict';

  var AGS = { data: null, filtro: '', tab: 'lista', tmp: '', wired: false, aud: {} };
  var AGM = { inicio: null, pendiente: null };
  var LOGO_DEF = 'img/agencias.svg';

  function $1(s, c) { return (c || document).querySelector(s); }
  function e_(s) { return (typeof esc_ === 'function') ? esc_(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function soloAdmin_() { return !!(AGS.data && AGS.data.esAdmin); }
  function logo_(a) { return (a && a.logoUrl) ? a.logoUrl : LOGO_DEF; }
  function err_(e) { if (typeof esCorte_ === 'function' && esCorte_(e)) return; Swal.fire({ icon: 'error', title: 'No se pudo completar', text: String((e && e.message) || e) }); }
  function money_(v, mon) {
    if (v === '' || v === null || v === undefined) return '—';
    var n = Number(v); if (isNaN(n)) return '—';
    return (mon === 'COP' ? '$ ' : 'US$ ') + n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  }
  function ocupado_(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('is-busy', !!on);
  }
  /* Escudo: una escritura a la vez por botón (nada de doble envío). */
  function escudo_(btn, fn) {
    if (btn && btn.disabled) return Promise.resolve();
    ocupado_(btn, true);
    return Promise.resolve().then(fn).catch(err_).then(function () { ocupado_(btn, false); });
  }

  /* ============================================================
     LOGIN DE LA AGENCIA
     ============================================================ */
  function bindLogin_() {
    var f = $1('#tab-agencia'); if (!f || f.__ag) return; f.__ag = true;
    var ojo = $1('#toggle-ag-clave');
    if (ojo) ojo.addEventListener('click', function () {
      var el = $1('#login-ag-clave'); var oculto = el.type === 'password';
      el.type = oculto ? 'text' : 'password';
      $1('#toggle-ag-clave-img').src = oculto ? 'img/ocultar.png' : 'img/mostrar.png';
    });
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var btn = $1('#btn-login-ag');
      var usuario = String($1('#login-ag-usuario').value || '').trim();
      var clave = String($1('#login-ag-clave').value || '');
      if (!usuario || !clave) { Swal.fire({ icon: 'warning', title: 'Escribe el usuario y la contraseña' }); return; }
      escudo_(btn, function () {
        return apiPost('loginAgencia', { usuario: usuario, clave: clave }, {
          avion: { titulo: 'Entrando…', sub: 'Estamos revisando tu acceso.', pasos: ['Revisando tu usuario…', 'Abriendo tu sesión…'] }
        }).then(function (u) {
          if (!u || !u.encontrado) {
            Swal.fire({ icon: 'error', title: (u && u.inactiva) ? 'Agencia inactiva' : 'Usuario o contraseña incorrectos',
              text: (u && u.inactiva) ? 'Tu agencia está inactiva. Comunícate con SEP.' : 'Revisa los datos. Si la olvidaste, pídele a SEP el cambio.' });
            return;
          }
          $1('#login-ag-clave').value = '';
          /* Login e inicio en un solo viaje: el inicio llega con la sesión. */
          var ini = u.inicio || null; delete u.inicio;
          AGM.inicio = null; AGM.pendiente = ini;
          entrar_(u);
        });
      });
    });
  }

  /* ============================================================
     INICIO DE LA AGENCIA (vistas reducidas)
     ============================================================ */
  var TILES_AG = [
    { key: 'participantes', titulo: 'Mis participantes', desc: 'Registro y seguimiento', icono: 'img/usuarios.webp', listo: false },
    { key: 'mia', titulo: 'Mi agencia', desc: 'Datos, temporada y valores', icono: LOGO_DEF, listo: true }
  ];

  window.agIrAInicio_ = function (u) {
    var ag = u.agencia || {};
    /* Sin logo cargado, el chip muestra el ícono de agencia (no la foto
       genérica de usuario). */
    if (!u.fotoUrl) { u.fotoUrl = LOGO_DEF; if (currentUser === u || (currentUser && currentUser.id === u.id)) currentUser.fotoUrl = LOGO_DEF; }
    document.documentElement.setAttribute('data-agencia', '1');
    $1('#welcome-name').textContent = ag.nombre || u.nombre || '';
    $1('#welcome-rol').textContent = 'Subagencia · ' + (ag.programa || 'Summer Work and Travel');
    var av = $1('#welcome-avatar');
    av.onerror = function () { this.onerror = null; this.src = LOGO_DEF; };
    av.src = logo_(ag);
    av.classList.add('ag-logo-av');
    var hello = document.querySelector('#view-inicio .welcome-bar__hello');
    if (hello) hello.textContent = 'Bienvenida';
    if (typeof uchipPintar_ === 'function') uchipPintar_(u);
    pintarTilesAg_();
    var bajo = $1('#inicio-bajo-separador');
    if (bajo) bajo.innerHTML = '<p class="muted" style="margin:0;">' + e_(ag.nombre || '') + ' · con la plataforma de SEP Colombia Group</p>';
    showView('inicio');
    cargarInicioAg_();
  };

  function pintarTilesAg_() {
    var grid = $1('#inicio-menu-grid'); if (!grid) return;
    grid.innerHTML = '';
    TILES_AG.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'menu-tile' + (t.listo ? '' : ' soon');
      b.setAttribute('data-agtile', t.key);
      b.innerHTML = '<img src="' + t.icono + '" alt="' + e_(t.titulo) + '" loading="lazy" />' +
        '<div class="menu-tile__title">' + e_(t.titulo) + '</div>' +
        '<div class="menu-tile__desc">' + e_(t.desc) + '</div>' +
        (t.listo ? '' : '<span class="menu-tile__badge">PRONTO</span>');
      b.addEventListener('click', function () {
        if (!t.listo) { Swal.fire({ icon: 'info', title: t.titulo, text: 'El registro de tus participantes se habilita en la siguiente entrega.' }); return; }
        if (t.key === 'mia') abrirMia_();
      });
      grid.appendChild(b);
    });
  }

  /* De fondo: no bloquea la navegación. Si el inicio vino con el login,
     no hay viaje. */
  function cargarInicioAg_() {
    var tk = (typeof sesionTk_ === 'function') ? sesionTk_() : '';
    var yaVino = AGM.pendiente; AGM.pendiente = null;
    (yaVino ? Promise.resolve(yaVino) : apiGet('agInicio', {}, { silent: true })).then(function (r) {
      if (!r || !currentUser || sesionTk_() !== tk) return;
      AGM.inicio = r;
      var u = Object.assign({}, currentUser, { nombre: r.usuario.nombre, fotoUrl: r.usuario.fotoUrl || LOGO_DEF, agencia: r.usuario.agencia });
      currentUser = u;
      if (typeof guardarSesion_ === 'function') guardarSesion_(u);
      $1('#welcome-name').textContent = r.agencia.nombre;
      var av = $1('#welcome-avatar'); if (av) av.src = logo_(r.agencia);
      if (typeof uchipPintar_ === 'function') uchipPintar_(u);
      var tp = document.querySelector('[data-agtile="participantes"] .menu-tile__desc');
      if (tp) tp.textContent = r.participantes ? (r.participantes + ' en ' + (r.temporada ? r.temporada.nombre : 'la temporada')) : 'Registro y seguimiento';
      if (document.getElementById('view-agencia-mia').classList.contains('active')) pintarMia_();
    }).catch(function () { /* sesión vencida: ya lo maneja apiGet */ });
  }

  function abrirMia_() {
    showView('agencia-mia');
    pintarMia_();
    if (!AGM.inicio) cargarInicioAg_();
  }

  function pintarMia_() {
    var c = $1('#ag-mia-cuerpo'); if (!c) return;
    var r = AGM.inicio;
    var ag = (r && r.agencia) || (currentUser && currentUser.agencia) || {};
    var cab = '<div class="ag-mia-cab"><img class="ag-mia-logo" alt="Logo" src="' + e_(logo_(ag)) + '" onerror="this.onerror=null;this.src=\'' + LOGO_DEF + '\'" />' +
      '<div><div class="ag-mia-nom">' + e_(ag.nombre || '') + '</div><div class="ag-mia-sub">' + e_(ag.programa || 'Summer Work and Travel') + '</div></div></div>';
    if (!r) { c.innerHTML = cab + ((window.SEPEsqueleto && SEPEsqueleto.html('formsec', 2)) || ''); return; }
    var t = r.temporada, v = r.valores;
    var filas = function (pares) {
      return '<div class="ag-pares">' + pares.map(function (p) { return '<div class="ag-par"><span>' + e_(p[0]) + '</span><b>' + e_(p[1] || '—') + '</b></div>'; }).join('') + '</div>';
    };
    c.innerHTML = cab +
      '<div class="cfg-card"><h3 class="cfg-card__title">Contacto registrado en SEP</h3>' +
        filas([['Nombre', ag.contactoNombre], ['Celular', ag.contactoCelular], ['Correo', ag.contactoCorreo]]) +
        '<p class="cfg-hint">Si algo cambió, pídele a SEP que lo actualice.</p></div>' +
      '<div class="cfg-card"><h3 class="cfg-card__title">Temporada ' + e_(t ? t.nombre : '—') + '</h3>' +
        (v ? filas([['Inscripción', money_(v.inscripcion, v.moneda)], ['Aplicada al Sponsor', money_(v.sponsor, v.moneda)],
                    ['DS-2019 confirmado', money_(v.ds2019, v.moneda)], ['Cargo por volumen', money_(v.volumen, v.moneda)]])
           : '<p class="muted">SEP aún no ha cargado tus valores para esta temporada.</p>') +
        '<div class="ag-sp-titulo">Sponsors de esta temporada</div>' +
        '<div class="ag-chips">' + (r.sponsors || []).map(function (s) { return '<span class="ag-chip on">' + e_(s) + '</span>'; }).join('') + '</div>' +
      '</div>';
  }

  window.agSalir_ = function () {
    AGM.inicio = null; AGM.pendiente = null;
    document.documentElement.removeAttribute('data-agencia');
    var av = $1('#welcome-avatar'); if (av) av.classList.remove('ag-logo-av');
    var hello = document.querySelector('#view-inicio .welcome-bar__hello'); if (hello) hello.textContent = 'Bienvenido';
    var bajo = $1('#inicio-bajo-separador'); if (bajo) bajo.innerHTML = '<p class="muted" style="margin:0;">SEP Colombia Group SAS</p>';
    AGS.data = null;
  };

  /* ============================================================
     VISTA SUBAGENCIAS (SEP)
     ============================================================ */
  window.abrirAgencias_ = function () {
    if (!(typeof tengoRol_ === 'function' && tengoRol_('DESARROLLADOR', 'SUPERUSUARIO', 'CONTADOR'))) {
      Swal.fire({ icon: 'warning', title: 'Sin permiso', text: 'Subagencias es del Superusuario y del Contador.' });
      return;
    }
    wire_();
    showView('agencias');
    var esAdmin = tengoRol_('DESARROLLADOR', 'SUPERUSUARIO');
    document.getElementById('view-agencias').classList.toggle('ag-es-conta', !esAdmin);
    if (!esAdmin && AGS.tab === 'auditoria') AGS.tab = 'lista';
    marcarTab_();
    if (!AGS.data) $1('#ag-cards').innerHTML = (window.SEPEsqueleto && SEPEsqueleto.html('persona', 4)) || '';
    else render_();
    apiGet('agenciasInit', { usuarioId: currentUser.id }, { vista: 'agencias', silent: true }).then(function (d) {
      AGS.data = d;
      if (!AGS.tmp || !d.temporadas.some(function (t) { return t.id === AGS.tmp; })) {
        var act = d.temporadas.find(function (t) { return t.estado === 'ACTIVA'; }) || d.temporadas[0];
        AGS.tmp = act ? act.id : '';
      }
      document.getElementById('view-agencias').classList.toggle('ag-es-conta', !d.esAdmin);
      render_();
      if (!d.listo && d.esAdmin) Swal.fire({ icon: 'info', title: 'Falta preparar la base', text: 'Corre migrarF62 en el editor de Apps Script para crear las hojas de subagencias.' });
    }).catch(err_);
  };

  function wire_() {
    if (AGS.wired) return; AGS.wired = true;
    $1('#ag-search').addEventListener('input', function (e) { AGS.filtro = e.target.value; renderLista_(); });
    $1('#ag-add').addEventListener('click', function () { modalAgencia_(null); });
    $1('#ag-tmp').addEventListener('change', function (e) { AGS.tmp = e.target.value; render_(); });
    document.querySelectorAll('#ag-tabs .ag-tab').forEach(function (b) {
      b.addEventListener('click', function () { AGS.tab = b.getAttribute('data-agtab'); marcarTab_(); render_(); });
    });
    $1('#ag-cards').addEventListener('click', function (e) {
      var b = e.target.closest('[data-agacc]'); if (!b) return;
      var a = agPorId_(b.getAttribute('data-id')); if (!a) return;
      var acc = b.getAttribute('data-agacc');
      if (acc === 'editar') modalAgencia_(a);
      else if (acc === 'acceso') modalAcceso_(a);
      else if (acc === 'valores') modalValores_(a);
      else if (acc === 'auditoria') { AGS.tab = 'auditoria'; AGS.audAg = a.id; marcarTab_(); render_(); }
    });
  }
  function marcarTab_() {
    document.querySelectorAll('#ag-tabs .ag-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-agtab') === AGS.tab); });
    ['lista', 'temporada', 'auditoria'].forEach(function (k) { $1('#ag-panel-' + k).classList.toggle('hidden', k !== AGS.tab); });
  }
  function agPorId_(id) { return (AGS.data && AGS.data.agencias || []).find(function (a) { return a.id === id; }) || null; }
  function tmpSel_() { return (AGS.data && AGS.data.temporadas || []).find(function (t) { return t.id === AGS.tmp; }) || null; }
  function valoresDe_(agId, tmpId) { return (AGS.data && AGS.data.valores || []).find(function (v) { return v.agenciaId === agId && v.temporadaId === tmpId; }) || null; }
  function globalDe_(tmpId) { return (AGS.data && AGS.data.globales || []).find(function (g) { return g.temporadaId === tmpId; }) || null; }

  function render_() {
    var d = AGS.data; if (!d) return;
    var sel = $1('#ag-tmp');
    sel.innerHTML = d.temporadas.length
      ? d.temporadas.map(function (t) { return '<option value="' + e_(t.id) + '"' + (t.id === AGS.tmp ? ' selected' : '') + '>' + e_(t.nombre) + (t.estado === 'ACTIVA' ? ' · activa' : '') + '</option>'; }).join('')
      : '<option value="">Sin temporadas de Summer Work and Travel</option>';
    if (AGS.tab === 'lista') renderLista_();
    else if (AGS.tab === 'temporada') renderTemporada_();
    else renderAuditoria_();
  }

  function renderLista_() {
    var d = AGS.data; if (!d) return;
    var q = String(AGS.filtro || '').trim().toLowerCase();
    var lista = d.agencias.filter(function (a) { return !q || a.nombre.toLowerCase().indexOf(q) >= 0; });
    $1('#ag-empty').classList.toggle('hidden', lista.length > 0);
    var t = tmpSel_();
    $1('#ag-cards').innerHTML = lista.map(function (a) {
      var v = t ? valoresDe_(a.id, t.id) : null;
      var cuenta = a.cuenta === undefined ? '' : (!a.cuenta ? '<span class="ag-pill warn">Sin acceso</span>'
        : (a.cuenta.activa ? '<span class="ag-pill ok">Acceso: ' + e_(a.cuenta.usuario) + '</span>' : '<span class="ag-pill off">Cuenta inactiva</span>'));
      var contacto = (a.contactoNombre || a.contactoCelular || a.contactoCorreo)
        ? '<div class="ag-meta">' + e_([a.contactoNombre, a.contactoCelular, a.contactoCorreo].filter(Boolean).join(' · ')) + '</div>' : '';
      var vals = v ? '<div class="ag-vals"><span>Inscripción <b>' + money_(v.inscripcion, v.moneda) + '</b></span><span>Sponsor <b>' + money_(v.sponsor, v.moneda) + '</b></span><span>DS-2019 <b>' + money_(v.ds2019, v.moneda) + '</b></span><span>Volumen <b>' + money_(v.volumen, v.moneda) + '</b></span></div>'
        : '<div class="ag-vals vacio">Sin valores para ' + e_(t ? t.nombre : 'la temporada') + '</div>';
      var acc = soloAdmin_()
        ? '<button class="ag-btn" data-agacc="editar" data-id="' + a.id + '" title="Editar datos y logo">' + IC.editar + '<span>Datos</span></button>' +
          '<button class="ag-btn" data-agacc="acceso" data-id="' + a.id + '" title="Usuario y contraseña">' + IC.llave + '<span>Acceso</span></button>' +
          '<button class="ag-btn" data-agacc="valores" data-id="' + a.id + '" title="Valores de la temporada">' + IC.moneda + '<span>Valores</span></button>' +
          '<button class="ag-btn" data-agacc="auditoria" data-id="' + a.id + '" title="Qué ha hecho esta agencia">' + IC.historial + '<span>Auditoría</span></button>'
        : '<button class="ag-btn" data-agacc="valores" data-id="' + a.id + '" title="Valores y cuenta">' + IC.moneda + '<span>Cuenta</span></button>';
      return '<article class="ag-card' + (a.estado === 'INACTIVA' ? ' is-inactive' : '') + '">' +
        '<div class="ag-card__top"><img class="ag-logo" alt="Logo de ' + e_(a.nombre) + '" src="' + e_(logo_(a)) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + LOGO_DEF + '\'" />' +
        '<div class="ag-card__info"><div class="ag-nom">' + e_(a.nombre) + '</div>' + contacto +
        '<div class="ag-pills"><span class="ag-pill ' + (a.estado === 'ACTIVA' ? 'ok' : 'off') + '">' + (a.estado === 'ACTIVA' ? 'Activa' : 'Inactiva') + '</span>' + cuenta + '</div></div></div>' +
        vals + '<div class="ag-acts">' + acc + '</div></article>';
    }).join('');
  }

  var IC = {
    editar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    llave: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>',
    moneda: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    historial: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>'
  };

  /* ---------- Temporada: mínimo de viajeros y sponsors visibles ---------- */
  function renderTemporada_() {
    var p = $1('#ag-panel-temporada'); var d = AGS.data; var t = tmpSel_();
    if (!t) { p.innerHTML = '<p class="muted">No hay temporadas de Summer Work and Travel. Créala en Configuración → Temporadas.</p>'; return; }
    var g = globalDe_(t.id) || { minViajeros: d.minDefecto, sponsors: d.sponsors.slice(), porDefecto: true };
    var edit = soloAdmin_();
    p.innerHTML = '<div class="cfg-card"><h3 class="cfg-card__title">' + e_(t.nombre) + ' · igual para todas las agencias</h3>' +
      '<p class="cfg-card__sub">Lo que aquí se guarde aplica a todas las subagencias de esta temporada. Se cambia sin tocar código.</p>' +
      '<div class="cfg-grid"><div class="cfg-field"><label for="ag-min">Mínimo de viajeros para evitar el cargo por volumen</label>' +
      '<input id="ag-min" type="number" min="0" step="1" inputmode="numeric" value="' + e_(g.minViajeros) + '"' + (edit ? '' : ' disabled') + ' /></div></div>' +
      '<div class="ag-sp-titulo">Sponsors visibles para las subagencias</div>' +
      '<div class="ag-chips" id="ag-sp">' + d.sponsors.map(function (s) {
        var on = g.sponsors.indexOf(s) >= 0;
        return '<button type="button" class="ag-chip' + (on ? ' on' : '') + '" data-sp="' + e_(s) + '"' + (edit ? '' : ' disabled') + '>' + e_(s) + '</button>';
      }).join('') + '</div>' +
      '<p class="cfg-hint">La lista sale de Configuración → Listas → Sponsor.' + (g.porDefecto ? ' Aún no se ha guardado: por defecto se ven todos.' : (g.actualizadoPor ? ' Última vez: ' + e_(g.actualizadoPor) + ' · ' + e_(g.fecha) : '')) + '</p>' +
      (edit ? '<div class="cfg-actions"><button class="btn btn-primary" id="ag-g-save">Guardar temporada</button></div>' : '') + '</div>';
    if (!edit) return;
    $1('#ag-sp').addEventListener('click', function (e) { var b = e.target.closest('[data-sp]'); if (b) b.classList.toggle('on'); });
    $1('#ag-g-save').addEventListener('click', function () {
      var btn = this;
      var sp = Array.prototype.map.call(document.querySelectorAll('#ag-sp .ag-chip.on'), function (b) { return b.getAttribute('data-sp'); });
      var min = $1('#ag-min').value;
      if (!sp.length) { Swal.fire({ icon: 'warning', title: 'Deja al menos un sponsor visible' }); return; }
      escudo_(btn, function () {
        return apiPost('agenciasGlobal', { usuarioId: currentUser.id, temporadaId: t.id, minViajeros: min, sponsors: sp }).then(function (r) {
          var arr = AGS.data.globales; var i = arr.findIndex(function (x) { return x.temporadaId === t.id; });
          if (i >= 0) arr[i] = r.global; else arr.push(r.global);
          renderTemporada_();
          Swal.fire({ icon: 'success', title: 'Temporada guardada', timer: 1200, showConfirmButton: false });
        });
      });
    });
  }

  /* ---------- Auditoría ---------- */
  function renderAuditoria_() {
    var p = $1('#ag-panel-auditoria'); var d = AGS.data;
    if (!soloAdmin_()) { p.innerHTML = ''; return; }
    var id = AGS.audAg || '*';
    p.innerHTML = '<div class="ag-aud-sel"><label for="ag-aud-ag">Agencia</label><select id="ag-aud-ag"><option value="*">Todas las agencias</option>' +
      d.agencias.map(function (a) { return '<option value="' + e_(a.id) + '"' + (a.id === id ? ' selected' : '') + '>' + e_(a.nombre) + '</option>'; }).join('') +
      '</select></div><div id="ag-aud-lista">' + ((window.SEPEsqueleto && SEPEsqueleto.html('texto', 4)) || '') + '</div>';
    $1('#ag-aud-ag').addEventListener('change', function (e) { AGS.audAg = e.target.value; renderAuditoria_(); });
    apiGet('agenciaAuditoria', { usuarioId: currentUser.id, id: id }, { vista: 'agencias', silent: true }).then(function (r) {
      if (AGS.tab !== 'auditoria' || (AGS.audAg || '*') !== id) return;
      var l = $1('#ag-aud-lista'); if (!l) return;
      if (!r.filas.length) { l.innerHTML = '<p class="muted">Sin movimientos registrados.</p>'; return; }
      l.innerHTML = '<div class="ag-aud">' + r.filas.map(function (f) {
        return '<div class="ag-aud__fila"><div class="ag-aud__top"><b>' + e_(accionTxt_(f.accion)) + '</b><span>' + e_(f.fecha) + (f.pendiente ? ' · en cola' : '') + '</span></div>' +
          '<div class="ag-aud__quien">' + e_(f.actor) + ' · ' + e_(f.rol) + (id === '*' && f.agencia ? ' · ' + e_(f.agencia) : '') + '</div>' +
          (f.detalle && f.detalle !== '{}' ? '<div class="ag-aud__det">' + e_(f.detalle) + '</div>' : '') + '</div>';
      }).join('') + '</div>' + (r.total > r.filas.length ? '<p class="cfg-hint">Se muestran los ' + r.filas.length + ' más recientes de ' + r.total + '.</p>' : '');
    }).catch(err_);
  }
  var ACC_TXT = { CREAR: 'Agencia creada', EDITAR: 'Datos editados', ACTIVAR: 'Agencia activada', DESACTIVAR: 'Agencia desactivada',
    LOGO: 'Logo actualizado', CREAR_CUENTA: 'Cuenta de acceso creada', CAMBIAR_CLAVE: 'Contraseña cambiada', CAMBIAR_USUARIO: 'Usuario cambiado',
    ACTIVAR_CUENTA: 'Cuenta activada', DESACTIVAR_CUENTA: 'Cuenta desactivada', CERRAR_SESIONES: 'Sesiones cerradas',
    GUARDAR_VALORES: 'Valores de temporada', CONFIG_TEMPORADA: 'Configuración de temporada', LOGIN: 'Inició sesión', LOGIN_FALLIDO: 'Intento fallido de ingreso' };
  function accionTxt_(a) { return ACC_TXT[a] || a; }

  /* ---------- Modal genérico (mismas clases del resto de la app) ---------- */
  function modal_(titulo, cuerpo, pie) {
    var m = document.createElement('div');
    m.className = 'modal-overlay ag-modal';
    m.innerHTML = '<div class="modal-card"><div class="modal-head"><h2>' + e_(titulo) + '</h2><button class="modal-x" aria-label="Cerrar">✕</button></div>' +
      '<div class="modal-body">' + cuerpo + '</div>' + (pie ? '<div class="modal-foot">' + pie + '</div>' : '') + '</div>';
    document.body.appendChild(m);
    var cerrar = function () { if (m.parentNode) m.parentNode.removeChild(m); };
    m.querySelector('.modal-x').addEventListener('click', cerrar);
    m.addEventListener('click', function (e) { if (e.target === m) cerrar(); });
    m.cerrar = cerrar;
    return m;
  }

  /* Reduce el logo en el navegador (máx. 512 px, PNG) antes de subirlo:
     viaja liviano y Drive guarda una imagen pequeña. */
  function logoComprimido_(file) {
    return new Promise(function (ok, ko) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { ko(new Error('Usa una imagen PNG, JPG o WEBP')); return; }
      var fr = new FileReader();
      fr.onerror = function () { ko(new Error('No se pudo leer la imagen')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { ko(new Error('La imagen no es válida')); };
        img.onload = function () {
          var max = 512, w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
          var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var url = c.toDataURL('image/png');
          ok({ base64: url.split(',')[1], dataUrl: url, filename: 'logo.png' });
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function parchar_(a) {
    var arr = AGS.data.agencias; var i = arr.findIndex(function (x) { return x.id === a.id; });
    /* El "último ingreso" viene de la auditoría solo en agenciasInit: se conserva. */
    if (i >= 0 && a.cuenta && arr[i].cuenta && !a.cuenta.ultimoLogin) a.cuenta.ultimoLogin = arr[i].cuenta.ultimoLogin;
    if (i >= 0) arr[i] = Object.assign({}, arr[i], a); else arr.push(a);
    renderLista_();
  }

  /* ---------- Modal: datos de la agencia ---------- */
  function modalAgencia_(a) {
    var nuevo = !a; a = a || { estado: 'ACTIVA' };
    var logoNuevo = null;
    var m = modal_(nuevo ? 'Nueva subagencia' : 'Datos de la agencia',
      '<div class="usr-foto-block"><img class="ag-logo-prev" id="agm-logo" alt="Logo" src="' + e_(logo_(a)) + '" onerror="this.onerror=null;this.src=\'' + LOGO_DEF + '\'" />' +
      '<div class="usr-foto-actions"><button type="button" class="btn btn-ghost btn-sm" id="agm-logo-btn">' + (a.logoUrl ? 'Cambiar logo' : 'Subir logo') + '</button>' +
      '<input type="file" id="agm-logo-file" accept="image/png,image/jpeg,image/webp" hidden /><span class="cfg-hint">Obligatorio. Lo ve la agencia al entrar y sus participantes.</span></div></div>' +
      '<div class="form-grid">' +
      '<div class="fld fld-full"><label>Nombre de la agencia *</label><input id="agm-nom" type="text" maxlength="80" value="' + e_(a.nombre || '') + '" /></div>' +
      '<div class="fld fld-full"><label>Persona de contacto</label><input id="agm-cnom" type="text" value="' + e_(a.contactoNombre || '') + '" /></div>' +
      '<div class="fld"><label>Celular de contacto</label><input id="agm-ccel" type="tel" inputmode="numeric" value="' + e_(a.contactoCelular || '') + '" /></div>' +
      '<div class="fld"><label>Correo de contacto</label><input id="agm-ccor" type="email" value="' + e_(a.contactoCorreo || '') + '" /></div>' +
      '<div class="fld"><label>Estado</label><select id="agm-est"><option value="ACTIVA">Activa</option><option value="INACTIVA">Inactiva</option></select></div>' +
      '<div class="fld"><label>Programa</label><input type="text" value="Summer Work and Travel" disabled /></div>' +
      '<div class="fld fld-full"><label>Notas internas</label><textarea id="agm-notas" rows="2" maxlength="500">' + e_(a.notas || '') + '</textarea></div>' +
      '</div><p class="cfg-hint">Desactivar bloquea el acceso de la agencia; su información queda intacta.</p>',
      '<button class="btn btn-ghost" data-x>Cancelar</button><button class="btn btn-primary" id="agm-save">Guardar</button>');
    m.querySelector('#agm-est').value = a.estado || 'ACTIVA';
    m.querySelector('[data-x]').addEventListener('click', m.cerrar);
    m.querySelector('#agm-logo-btn').addEventListener('click', function () { m.querySelector('#agm-logo-file').click(); });
    m.querySelector('#agm-logo-file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      logoComprimido_(f).then(function (x) { logoNuevo = x; m.querySelector('#agm-logo').src = x.dataUrl; }).catch(err_);
    });
    m.querySelector('#agm-save').addEventListener('click', function () {
      var btn = this;
      var body = { usuarioId: currentUser.id, id: a.id || '', nombre: m.querySelector('#agm-nom').value,
        contactoNombre: m.querySelector('#agm-cnom').value, contactoCelular: m.querySelector('#agm-ccel').value,
        contactoCorreo: m.querySelector('#agm-ccor').value, estado: m.querySelector('#agm-est').value, notas: m.querySelector('#agm-notas').value };
      if (!String(body.nombre).trim()) { Swal.fire({ icon: 'warning', title: 'Escribe el nombre de la agencia' }); return; }
      if (nuevo && !logoNuevo) { Swal.fire({ icon: 'warning', title: 'Sube el logo de la agencia' }); return; }
      var seguir = (!nuevo && body.estado === 'INACTIVA' && a.estado !== 'INACTIVA')
        ? Swal.fire({ icon: 'question', title: '¿Desactivar la agencia?', text: 'Su cuenta no podrá entrar. La información queda intacta.', showCancelButton: true, confirmButtonText: 'Sí, desactivar', cancelButtonText: 'No' }).then(function (x) { return x.isConfirmed; })
        : Promise.resolve(true);
      seguir.then(function (ok) { if (ok) guardar_(); });
      function guardar_() { escudo_(btn, function () {
        return apiPost('agenciaGuardar', body).then(function (r) {
          parchar_(r.agencia);
          if (!logoNuevo) return r;
          return apiPost('agenciaLogo', { usuarioId: currentUser.id, id: r.id, filename: logoNuevo.filename, base64: logoNuevo.base64 })
            .then(function (l) { parchar_({ id: r.id, logoId: l.logoId, logoUrl: l.logoUrl }); return r; });
        }).then(function (r) {
          m.cerrar();
          Swal.fire({ icon: 'success', title: nuevo ? 'Agencia creada' : 'Agencia actualizada', text: nuevo ? 'Ahora crea su usuario de acceso.' : '', timer: nuevo ? 1800 : 1100, showConfirmButton: false })
            .then(function () { if (nuevo) { var ag = agPorId_(r.id); if (ag) modalAcceso_(ag); } });
        });
      }); }
    });
  }

  /* ---------- Modal: cuenta de acceso ---------- */
  function modalAcceso_(a) {
    var c = a.cuenta;
    var m = modal_('Acceso · ' + a.nombre,
      '<p class="cfg-card__sub">Una sola cuenta compartida para toda la agencia. La contraseña la administra SEP.</p>' +
      '<div class="form-grid">' +
      '<div class="fld fld-full"><label>Usuario *</label><input id="aga-usu" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" value="' + e_(c ? c.usuario : '') + '" placeholder="ej. agencia.norte" /></div>' +
      '<div class="fld fld-full"><label>' + (c ? 'Nueva contraseña (opcional)' : 'Contraseña (vacía = se genera una)') + '</label>' +
      '<div class="input-wrap"><input id="aga-cla" type="text" autocomplete="new-password" spellcheck="false" placeholder="Mínimo 8, con letras y números" /></div></div>' +
      '</div>' +
      (c ? '<div class="ag-pares"><div class="ag-par"><span>Estado</span><b>' + (c.activa ? 'Activa' : 'Inactiva') + '</b></div><div class="ag-par"><span>Último ingreso</span><b>' + e_(c.ultimoLogin || '—') + '</b></div></div>' +
        '<div class="ag-acceso-btns"><button class="btn btn-ghost btn-sm" data-acc="clave">Generar contraseña nueva</button>' +
        '<button class="btn btn-ghost btn-sm" data-acc="cerrarSesiones">Cerrar sesiones abiertas</button>' +
        '<button class="btn btn-ghost btn-sm" data-acc="' + (c.activa ? 'desactivar' : 'activar') + '">' + (c.activa ? 'Desactivar cuenta' : 'Activar cuenta') + '</button></div>' : ''),
      '<button class="btn btn-ghost" data-x>Cerrar</button><button class="btn btn-primary" id="aga-save">Guardar</button>');
    m.querySelector('[data-x]').addEventListener('click', m.cerrar);
    var enviar = function (btn, body, okTxt) {
      return escudo_(btn, function () {
        return apiPost('agenciaAcceso', Object.assign({ usuarioId: currentUser.id, id: a.id }, body)).then(function (r) {
          parchar_(r.agencia);
          m.cerrar();
          if (r.claveNueva) mostrarClave_(r.agencia, r.claveNueva);
          else Swal.fire({ icon: 'success', title: okTxt, timer: 1200, showConfirmButton: false });
        });
      });
    };
    m.querySelector('#aga-save').addEventListener('click', function () {
      var usu = String(m.querySelector('#aga-usu').value || '').trim(), cla = String(m.querySelector('#aga-cla').value || '');
      if (!usu) { Swal.fire({ icon: 'warning', title: 'Escribe el usuario' }); return; }
      enviar(this, { accion: 'guardar', usuario: usu, clave: cla }, 'Acceso guardado');
    });
    m.querySelectorAll('[data-acc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var acc = b.getAttribute('data-acc');
        var txt = { clave: '¿Generar una contraseña nueva? La actual deja de servir y se cierran las sesiones.', cerrarSesiones: '¿Cerrar todas las sesiones abiertas de la agencia?', desactivar: '¿Desactivar la cuenta? La agencia no podrá entrar.', activar: '¿Activar la cuenta?' }[acc];
        Swal.fire({ icon: 'question', title: 'Confirmar', text: txt, showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'No' }).then(function (x) {
          if (x.isConfirmed) enviar(b, { accion: acc }, { cerrarSesiones: 'Sesiones cerradas', desactivar: 'Cuenta desactivada', activar: 'Cuenta activada' }[acc] || 'Listo');
        });
      });
    });
  }
  function mostrarClave_(a, clave) {
    Swal.fire({
      icon: 'success', title: 'Contraseña de ' + a.nombre,
      html: '<p>Entrégala a la agencia. Por seguridad <b>no se vuelve a mostrar</b>.</p>' +
        '<div class="ag-clave">' + e_(a.cuenta ? a.cuenta.usuario : '') + '<br><b>' + e_(clave) + '</b></div>',
      confirmButtonText: 'Copiar y cerrar', showCancelButton: true, cancelButtonText: 'Cerrar'
    }).then(function (x) {
      if (!x.isConfirmed) return;
      var t = 'Usuario: ' + (a.cuenta ? a.cuenta.usuario : '') + '\nContraseña: ' + clave;
      try { navigator.clipboard.writeText(t); } catch (_) {}
    });
  }

  /* ---------- Modal: valores por temporada (Contador: solo lectura) ---------- */
  function modalValores_(a) {
    var d = AGS.data, t = tmpSel_(), edit = soloAdmin_();
    if (!t) { Swal.fire({ icon: 'info', title: 'Sin temporada', text: 'No hay temporadas de Summer Work and Travel.' }); return; }
    var v = valoresDe_(a.id, t.id) || { moneda: 'USD', inscripcion: '', sponsor: '', ds2019: '', volumen: '' };
    var campo = function (id, lab, val) { return '<div class="fld"><label>' + lab + '</label><input id="' + id + '" type="number" min="0" step="any" inputmode="decimal" value="' + e_(val) + '"' + (edit ? '' : ' disabled') + ' /></div>'; };
    var m = modal_((edit ? 'Valores · ' : 'Cuenta · ') + a.nombre,
      '<p class="cfg-card__sub">' + e_(t.nombre) + '. Cada agencia puede tener valores distintos; se cambian sin tocar código.</p>' +
      '<div class="form-grid"><div class="fld"><label>Moneda</label><select id="agv-mon"' + (edit ? '' : ' disabled') + '>' + (d.monedas || ['USD', 'COP']).map(function (x) { return '<option' + (x === v.moneda ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div><div class="fld"></div>' +
      campo('agv-ins', 'Valor de inscripción', v.inscripcion) + campo('agv-spo', 'Valor de Aplicada al Sponsor', v.sponsor) +
      campo('agv-ds', 'Valor de DS-2019 confirmado', v.ds2019) + campo('agv-vol', 'Valor del cargo por volumen', v.volumen) + '</div>' +
      (v.actualizadoPor ? '<p class="cfg-hint">Última vez: ' + e_(v.actualizadoPor) + ' · ' + e_(v.fecha) + '</p>' : '') +
      '<div class="cfg-card ag-cuenta"><h3 class="cfg-card__title">Cuenta de cobro</h3><p class="muted">Aún sin movimientos en esta temporada.</p></div>',
      '<button class="btn btn-ghost" data-x>Cerrar</button>' + (edit ? '<button class="btn btn-primary" id="agv-save">Guardar</button>' : ''));
    m.querySelector('[data-x]').addEventListener('click', m.cerrar);
    if (!edit) return;
    m.querySelector('#agv-save').addEventListener('click', function () {
      var btn = this;
      var body = { usuarioId: currentUser.id, agenciaId: a.id, temporadaId: t.id, moneda: m.querySelector('#agv-mon').value,
        inscripcion: m.querySelector('#agv-ins').value, sponsor: m.querySelector('#agv-spo').value,
        ds2019: m.querySelector('#agv-ds').value, volumen: m.querySelector('#agv-vol').value };
      escudo_(btn, function () {
        return apiPost('agenciaValores', body).then(function (r) {
          var arr = AGS.data.valores; var i = arr.findIndex(function (x) { return x.agenciaId === a.id && x.temporadaId === t.id; });
          if (i >= 0) arr[i] = r.valores; else arr.push(r.valores);
          renderLista_();
          m.cerrar();
          Swal.fire({ icon: 'success', title: 'Valores guardados', timer: 1100, showConfirmButton: false });
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', bindLogin_);
  if (document.readyState !== 'loading') bindLogin_();
})();
