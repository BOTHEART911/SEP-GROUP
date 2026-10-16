/* =============================================================
 * SEP GROUP — SUBAGENCIAS (Fase 6 · Entregas 6.2, 6.3 y 6.4 · 16/10/2026)
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
 *      Ve un inicio reducido: Mis participantes y Mi agencia.
 *   3. (6.3) MIS PARTICIPANTES: la agencia registra con el formulario
 *      corto (paso 1: celular y cédula; paso 2: datos), ve su lista con
 *      la clave de acceso y sus solicitudes de traspaso. El
 *      Superusuario ve los de todas las agencias en la pestaña
 *      Participantes de Subagencias y aprueba o rechaza los traspasos.
 *   4. (6.4) PRUEBA Y FORMULARIO: cada tarjeta muestra el estado de la
 *      prueba de inglés y del formulario; "Prueba y formulario" abre el
 *      detalle (cabecera al instante, datos de fondo en un viaje). La
 *      agencia invita y aprueba; el Superusuario registra la nota y
 *      reversa. Todo queda en el historial del participante.
 *   5. (6.7) CUENTA DE COBRO Y CIERRE: pestaña Cuentas (Superusuario y
 *      Contador) con saldos COP y USD por agencia, cuenta de cada agencia
 *      (cargos, pagos, comprobantes, saldos), registrar / corregir /
 *      anular pagos (Contador o Super) y cierre / reapertura de la
 *      temporada (Super). La agencia ve su cuenta en Mi agencia (solo
 *      lectura) y, con la temporada cerrada, todo queda en solo lectura.
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

  var AGS = { data: null, filtro: '', tab: 'lista', tmp: '', wired: false, aud: {}, part: null, partCargando: null, partQ: '', partAg: '' };
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
    { key: 'participantes', titulo: 'Mis participantes', desc: 'Registro y seguimiento', icono: 'img/usuarios.webp', listo: true },
    { key: 'mia', titulo: 'Mi agencia', desc: 'Datos, valores y cuenta de cobro', icono: LOGO_DEF, listo: true }
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
        else if (t.key === 'participantes') abrirPart_();
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
        (v ? filas([['Inscripción', money_(v.inscripcion, monedasDe_(v).inscripcion)], ['Aplicada al Sponsor', money_(v.sponsor, monedasDe_(v).sponsor)],
                    ['DS-2019 confirmado', money_(v.ds2019, monedasDe_(v).ds2019)], ['Cargo por volumen', money_(v.volumen, monedasDe_(v).volumen)]])
           : '<p class="muted">SEP aún no ha cargado tus valores para esta temporada.</p>') +
        '<div class="ag-sp-titulo">Sponsors de esta temporada</div>' +
        '<div class="ag-chips">' + (r.sponsors || []).map(function (s) { return '<span class="ag-chip on">' + e_(s) + '</span>'; }).join('') + '</div>' +
      '</div>' + tarjetaCuentaAg_(r);
    var bc = c.querySelector('[data-mi-cuenta]');
    if (bc) bc.addEventListener('click', function () { abrirCuenta_({ propia: true, nombre: ag.nombre, temporadaId: t ? t.id : '' }); });
  }

  window.agSalir_ = function () {
    AGM.inicio = null; AGM.pendiente = null;
    AGP.data = null; AGP.filtro = ''; AGP.anio = ''; AGS.part = null;
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
    if (!esAdmin && (AGS.tab === 'auditoria' || AGS.tab === 'participantes')) AGS.tab = 'lista';
    /* 6.7 — el Contador entra directo a Cuentas (lo suyo es lo financiero). */
    if (!esAdmin && !AGS.tabElegida) AGS.tab = 'cuentas';
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
      b.addEventListener('click', function () { AGS.tab = b.getAttribute('data-agtab'); AGS.tabElegida = true; marcarTab_(); render_(); });
    });
    $1('#ag-cards').addEventListener('click', function (e) {
      var b = e.target.closest('[data-agacc]'); if (!b) return;
      var a = agPorId_(b.getAttribute('data-id')); if (!a) return;
      var acc = b.getAttribute('data-agacc');
      if (acc === 'editar') modalAgencia_(a);
      else if (acc === 'acceso') modalAcceso_(a);
      else if (acc === 'valores') modalValores_(a);
      else if (acc === 'auditoria') { AGS.tab = 'auditoria'; AGS.audAg = a.id; marcarTab_(); render_(); }
      else if (acc === 'cuenta') abrirCuenta_({ agenciaId: a.id, temporadaId: AGS.tmp, nombre: a.nombre });
    });
  }
  function marcarTab_() {
    document.querySelectorAll('#ag-tabs .ag-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-agtab') === AGS.tab); });
    ['lista', 'temporada', 'auditoria', 'participantes', 'cuentas'].forEach(function (k) { var el = $1('#ag-panel-' + k); if (el) el.classList.toggle('hidden', k !== AGS.tab); });
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
    else if (AGS.tab === 'participantes') renderPartSup_();
    else if (AGS.tab === 'cuentas') renderCuentas_();
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
      var mo = monedasDe_(v);
      var vals = v ? '<div class="ag-vals"><span>Inscripción <b>' + money_(v.inscripcion, mo.inscripcion) + '</b></span><span>Sponsor <b>' + money_(v.sponsor, mo.sponsor) + '</b></span><span>DS-2019 <b>' + money_(v.ds2019, mo.ds2019) + '</b></span><span>Volumen <b>' + money_(v.volumen, mo.volumen) + '</b></span></div>'
        : '<div class="ag-vals vacio">Sin valores para ' + e_(t ? t.nombre : 'la temporada') + '</div>';
      var acc = soloAdmin_()
        ? '<button class="ag-btn" data-agacc="editar" data-id="' + a.id + '" title="Editar datos y logo">' + IC.editar + '<span>Datos</span></button>' +
          '<button class="ag-btn" data-agacc="acceso" data-id="' + a.id + '" title="Usuario y contraseña">' + IC.llave + '<span>Acceso</span></button>' +
          '<button class="ag-btn" data-agacc="valores" data-id="' + a.id + '" title="Valores de la temporada">' + IC.moneda + '<span>Valores</span></button>' +
          '<button class="ag-btn" data-agacc="cuenta" data-id="' + a.id + '" title="Cuenta de cobro: cargos, pagos y cierre">' + IC.cuenta + '<span>Cuenta</span></button>' +
          '<button class="ag-btn" data-agacc="auditoria" data-id="' + a.id + '" title="Qué ha hecho esta agencia">' + IC.historial + '<span>Auditoría</span></button>'
        : '<button class="ag-btn" data-agacc="valores" data-id="' + a.id + '" title="Valores de la temporada">' + IC.moneda + '<span>Valores</span></button>' +
          '<button class="ag-btn" data-agacc="cuenta" data-id="' + a.id + '" title="Cuenta de cobro: cargos, pagos y comprobantes">' + IC.cuenta + '<span>Cuenta</span></button>';
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
    historial: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
    /* 6.7 — cuenta de cobro (libro), pago, comprobante, candado */
    cuenta: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    pago: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>',
    recibo: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 3 2 3-2 3 2 3-2V8z"/><path d="M14 2v6h6"/></svg>',
    candado: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    abierto: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>'
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
    GUARDAR_VALORES: 'Valores de temporada', CONFIG_TEMPORADA: 'Configuración de temporada', LOGIN: 'Inició sesión', LOGIN_FALLIDO: 'Intento fallido de ingreso',
    REGISTRAR: 'Registró un participante', SOLICITAR_TRASPASO: 'Pidió un traspaso', APROBAR_TRASPASO: 'Traspaso aprobado', RECHAZAR_TRASPASO: 'Traspaso rechazado',
    /* 6.4 */
    INVITACION_MARCAR: 'Invitó a la prueba de inglés', INVITACION_QUITAR: 'Quitó la invitación a la prueba', NOTA_REGISTRAR: 'Registró la nota de inglés',
    NOTA_ACTUALIZAR: 'Actualizó la nota de inglés', FORM_APROBAR: 'Aprobó el formulario', FORM_REVERSAR: 'Reversó la aprobación del formulario',
    /* 6.5 */
    HV_REGENERAR: 'Volvió a generar la hoja de vida', HV_GENERAR: 'Generó la hoja de vida', DOC_CARGA: 'Cargó un documento', DOC_APROBAR: 'Aprobó un documento',
    DOC_RECHAZAR: 'Rechazó un documento', OFERTA_SELECCION: 'El participante escogió oferta', APLICADA_SPONSOR: 'Marcó Aplicada al Sponsor',
    SPONSOR_CORREGIR: 'Corrigió Aplicada al Sponsor', ENTREVISTA_AGENDAR: 'Agendó la entrevista', ENTREVISTA_REAGENDAR: 'Reprogramó la entrevista',
    RESULTADO_CONTRATADO: 'Registró Contratado', RESULTADO_RECHAZADO: 'Registró Rechazado', OFERTA_LIBERAR: 'Liberó la oferta',
    /* 6.6 */
    VERIF_ENVIAR: 'Envió la verificación a SEP', VERIF_APROBAR: 'SEP aprobó la verificación', VERIF_DEVOLVER: 'SEP devolvió la verificación',
    VERIF_REABRIR: 'SEP reabrió la verificación', DS2019_CONFIRMAR: 'SEP confirmó el DS-2019', DS2019_CORREGIR: 'SEP corrigió el DS-2019',
    VISA_DATOS: 'Registró datos de la visa', VISA_RESULTADO: 'Registró el resultado consular', RETIRAR: 'Marcó Retirado', REINTEGRAR: 'Reintegró al participante',
    /* 6.7 */
    PAGO_REGISTRAR: 'Registró un pago', PAGO_CORREGIR: 'Corrigió un pago', PAGO_ANULAR: 'Anuló un pago',
    CERRAR_TEMPORADA: 'Cerró la temporada', REABRIR_TEMPORADA: 'Reabrió la temporada' };
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
    var v = valoresDe_(a.id, t.id) || { inscripcion: '', sponsor: '', ds2019: '', volumen: '' };
    var mo = monedasDe_(v.agenciaId ? v : null);
    var mons = d.monedas || ['USD', 'COP'];
    /* 6.7 — cada concepto con su moneda (sección 17: inscripción en COP, el resto en USD). */
    var campo = function (k, lab) {
      return '<div class="fld agv-campo"><label>' + lab + '</label><div class="agv-par">' +
        '<select data-mon="' + k + '" aria-label="Moneda de ' + e_(lab) + '"' + (edit ? '' : ' disabled') + '>' + mons.map(function (x) { return '<option' + (x === mo[k] ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>' +
        '<input data-val="' + k + '" type="number" min="0" step="any" inputmode="decimal" value="' + e_(v[k]) + '"' + (edit ? '' : ' disabled') + ' /></div></div>';
    };
    var m = modal_('Valores · ' + a.nombre,
      '<p class="cfg-card__sub">' + e_(t.nombre) + '. Cada agencia puede tener valores distintos; se cambian sin tocar código. COP y USD no se convierten entre sí.</p>' +
      '<div class="form-grid">' + campo('inscripcion', 'Valor de inscripción') + campo('sponsor', 'Valor de Aplicada al Sponsor') +
      campo('ds2019', 'Valor de DS-2019 confirmado') + campo('volumen', 'Valor del cargo por volumen (por viajero)') + '</div>' +
      (v.actualizadoPor ? '<p class="cfg-hint">Última vez: ' + e_(v.actualizadoPor) + ' · ' + e_(v.fecha) + '</p>' : ''),
      '<button class="btn btn-ghost" data-x>Cerrar</button>' + (edit ? '<button class="btn btn-primary" id="agv-save">Guardar</button>' : ''));
    m.querySelector('[data-x]').addEventListener('click', m.cerrar);
    if (!edit) return;
    m.querySelector('#agv-save').addEventListener('click', function () {
      var btn = this;
      var body = { usuarioId: currentUser.id, agenciaId: a.id, temporadaId: t.id, monedas: {} };
      ['inscripcion', 'sponsor', 'ds2019', 'volumen'].forEach(function (k) {
        body[k] = m.querySelector('[data-val="' + k + '"]').value;
        body.monedas[k] = m.querySelector('[data-mon="' + k + '"]').value;
      });
      body.moneda = body.monedas.sponsor;   // la columna MONEDA de antes
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

  /* ============================================================
     FASE 6.3 · MIS PARTICIPANTES (la agencia)
     Patrón de carga única: UN viaje (agParticipantes) por sesión; filtros,
     búsqueda y temporadas son locales. Tras registrar se parcha la
     lista en memoria (no se recarga).
     ============================================================ */
  var AGP = { data: null, filtro: '', anio: '', cargando: null };

  function sinTildes_(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function blob_(r) { return sinTildes_([r.nom, r.ape, r.cel, r.ced, r.cor, r.clave, r.id, r.agn].join(' ')); }
  function prepararReg_(r) { r.__b = blob_(r); return r; }
  function copiar_(txt, ok) {
    var hecho = function () { Swal.fire({ icon: 'success', title: ok || 'Copiado', timer: 900, showConfirmButton: false }); };
    try { navigator.clipboard.writeText(txt).then(hecho, hecho); } catch (_) { hecho(); }
  }
  var IC_P = {
    copiar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    llave: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>',
    tel: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>',
    doc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><line x1="13" y1="10" x2="18" y2="10"/><line x1="13" y1="14" x2="17" y2="14"/></svg>',
    mail: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
    reloj: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    /* 6.4 — portapapeles con check: prueba y formulario del participante */
    det: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3h6v3H9z"/><path d="m9 13 2 2 4-4"/></svg>'
  };

  function abrirPart_() {
    wirePart_();
    showView('agencia-part');
    if (AGP.data) { renderPart_(); return; }
    $1('#agp-cards').innerHTML = (window.SEPEsqueleto && SEPEsqueleto.html('persona', 4)) || '';
    cargarPart_();
  }
  function cargarPart_() {
    var tk = (typeof sesionTk_ === 'function') ? sesionTk_() : '';
    if (AGP.cargando) return AGP.cargando;
    AGP.cargando = apiGet('agParticipantes', {}, { vista: 'agencia-part', silent: true }).then(function (d) {
      AGP.cargando = null;
      if (!currentUser || sesionTk_() !== tk) return;
      (d.registros || []).forEach(prepararReg_);
      AGP.data = d;
      if (!AGP.anio) AGP.anio = d.temporada ? d.temporada.anio : '';
      renderPart_();
    }).catch(function (e) { AGP.cargando = null; err_(e); });
    return AGP.cargando;
  }
  function wirePart_() {
    var v = $1('#view-agencia-part'); if (!v || v.__w) return; v.__w = true;
    $1('#agp-search').addEventListener('input', function (e) { AGP.filtro = e.target.value; renderPartLista_(); });
    $1('#agp-add').addEventListener('click', function () { modalRegistro_(); });
    $1('#agp-pills').addEventListener('click', function (e) {
      var b = e.target.closest('[data-anio]'); if (!b) return;
      AGP.anio = b.getAttribute('data-anio'); renderPart_();
    });
    $1('#agp-cards').addEventListener('click', function (e) {
      var d = e.target.closest('[data-det]');
      if (d) { abrirDet_(d.getAttribute('data-det'), { lista: function () { return AGP.data && AGP.data.registros; }, repintar: renderPartLista_, esSuper: false }); return; }
      var b = e.target.closest('[data-copiar]'); if (!b) return;
      copiar_(b.getAttribute('data-copiar'), 'Clave copiada');
    });
  }
  function aniosDe_(regs, extra) {
    var a = {}; regs.forEach(function (r) { if (r.anio) a[r.anio] = (a[r.anio] || 0) + 1; });
    if (extra && !a[extra]) a[extra] = 0;
    return Object.keys(a).sort(function (x, y) { return Number(y) - Number(x); }).map(function (k) { return { anio: k, n: a[k] }; });
  }
  function renderPart_() {
    var d = AGP.data; if (!d) return;
    var t = d.temporada;
    $1('#agp-tmp-txt').innerHTML = t
      ? (t.cerrada ? '<b>' + e_(t.nombre) + ' está cerrada.</b> Queda en solo lectura: no se registran participantes ni se hacen cambios. Solo SEP puede reabrirla.'
                   : 'Registras en <b>' + e_(t.nombre) + '</b>')
      : '<b>SEP aún no abre la temporada.</b> Por ahora no se pueden registrar participantes.';
    $1('#agp-add').disabled = !t || d.listo === false || !!t.cerrada;   // 6.7 — temporada cerrada
    $1('#agp-pills').innerHTML = aniosDe_(d.registros, t ? t.anio : '').map(function (x) {
      return '<button type="button" class="ag-chip' + (x.anio === AGP.anio ? ' on' : '') + '" data-anio="' + e_(x.anio) + '">' + e_(x.anio) + ' · ' + x.n + '</button>';
    }).join('');
    renderTras_();
    renderPartLista_();
  }
  function renderTras_() {
    var c = $1('#agp-tras'); var d = AGP.data; if (!c || !d) return;
    var l = d.traspasos || [];
    if (!l.length) { c.innerHTML = ''; return; }
    var txt = { PENDIENTE: 'En revisión por SEP', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado' };
    c.innerHTML = '<div class="agp-tras"><div class="ag-sp-titulo">Solicitudes de traspaso a SEP</div>' + l.map(function (x) {
      var cls = x.estado === 'APROBADO' ? 'ok' : (x.estado === 'RECHAZADO' ? 'off' : 'warn');
      return '<div class="agp-tras__fila"><div><b>' + e_(x.nom + ' ' + x.ape) + '</b><div class="ag-meta">' + e_(x.cel) + ' · ' + e_(x.ced) + ' · ' + e_(x.fecha) + '</div>' +
        (x.estado === 'RECHAZADO' && x.motivo ? '<div class="ag-meta">Motivo: ' + e_(x.motivo) + '</div>' : '') + '</div>' +
        '<span class="ag-pill ' + cls + '">' + e_(txt[x.estado] || x.estado) + '</span></div>';
    }).join('') + '</div>';
  }
  function filtrarPart_(regs, anio, q) {
    q = sinTildes_(String(q || '').trim());
    return regs.filter(function (r) { return (!anio || r.anio === anio) && (!q || r.__b.indexOf(q) >= 0); });
  }
  function tarjetaPart_(r, conAgencia) {
    return '<article class="ag-card agp-card">' +
      '<div class="agp-card__top"><div class="agp-nom">' + e_(r.nom + ' ' + r.ape) + '</div><span class="ag-pill ok">SWT ' + e_(r.anio) + '</span></div>' +
      (conAgencia && r.agn ? '<div class="agp-ag">' + e_(r.agn) + '</div>' : '') +
      '<div class="agp-datos"><span>' + IC_P.tel + e_(r.cel) + '</span><span>' + IC_P.doc + e_(r.ced || '—') + '</span>' +
      (r.cor ? '<span class="agp-cor">' + IC_P.mail + e_(r.cor) + '</span>' : '') + '<span>' + IC_P.reloj + e_(r.fecha) + '</span></div>' +
      (r.clave ? '<div class="agp-clave"><span>' + IC_P.llave + 'Clave de acceso <b>' + e_(r.clave) + '</b></span>' +
        '<button type="button" class="ag-btn" data-copiar="' + e_(r.clave) + '" title="Copiar la clave">' + IC_P.copiar + '<span>Copiar</span></button></div>' : '') +
      estadoPart_(r) +
      '</article>';
  }
  /* FASE 6.4 — estado corto de la prueba y del formulario + el detalle. */
  function estadoPart_(r) {
    var x = r.est || {};
    var prueba = !x.inv && !x.pts ? ['Prueba: sin invitar', 'off']
      : (!x.pts ? ['Prueba: invitado', 'warn'] : ['Nota ' + x.pts, x.ok ? 'ok' : 'bad']);
    var form = x.apr ? ['Formulario aprobado', 'ok'] : (x.ft ? ['Formulario por aprobar', 'warn'] : (x.ok ? ['Formulario en curso', 'off'] : null));
    /* 6.5 — cómo va su oferta (la manda la lista si el backend ya la conoce). */
    var of = x.of ? [x.of, x.ofc || 'off'] : null;
    /* 6.6 — etapa (verificación, DS-2019, visa, vuelo o Retirado). */
    var et = x.et ? [x.et, x.etc || 'off'] : null;
    return '<div class="agp-est"><div class="ag-pills">' +
      '<span class="ag-pill ' + prueba[1] + '">' + e_(prueba[0]) + '</span>' +
      (form ? '<span class="ag-pill ' + form[1] + '">' + e_(form[0]) + '</span>' : '') +
      (of && !et ? '<span class="ag-pill ' + of[1] + '">' + e_(of[0]) + '</span>' : '') +
      (et ? '<span class="ag-pill ' + et[1] + '">' + e_(et[0]) + '</span>' : '') +
      '</div><button type="button" class="ag-btn" data-det="' + e_(r.id) + '" title="Prueba, formulario, documentos, oferta, verificación, visa y vuelo">' + IC_P.det + '<span>Detalle</span></button></div>';
  }
  function renderPartLista_() {
    var d = AGP.data; if (!d) return;
    var lista = filtrarPart_(d.registros, AGP.anio, AGP.filtro);
    $1('#agp-empty').classList.toggle('hidden', lista.length > 0);
    $1('#agp-empty-txt').textContent = d.registros.length ? 'Ningún participante coincide con el filtro.' : 'Aún no has registrado participantes.';
    var cont = $1('#agp-cards');
    if (typeof tandaPintar_ === 'function') tandaPintar_(cont, lista, function (r) { return tarjetaPart_(r, false); });
    else cont.innerHTML = lista.map(function (r) { return tarjetaPart_(r, false); }).join('');
  }

  /* ---------- Registro: paso 1 (celular y cédula) y paso 2 (datos) ---------- */
  function modalRegistro_() {
    var d = AGP.data;
    if (!d || !d.temporada) { Swal.fire({ icon: 'info', title: 'Sin temporada abierta', text: 'SEP aún no abre la temporada de Summer Work and Travel.' }); return; }
    var t = d.temporada;
    var m = modal_('Registrar participante',
      '<p class="cfg-card__sub">' + e_(t.nombre) + '. Primero el celular y la cédula.</p>' +
      '<div class="form-grid" id="agr-p1">' +
        '<div class="fld"><label>Celular (WhatsApp) *</label><input id="agr-cel" type="tel" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="10 dígitos" /></div>' +
        '<div class="fld"><label>Cédula *</label><input id="agr-ced" type="text" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="Solo números" /></div>' +
      '</div>' +
      '<div id="agr-aviso" class="agr-aviso hidden" role="alert"></div>' +
      '<div class="form-grid hidden" id="agr-p2">' +
        '<div class="fld"><label>Nombres *</label><input id="agr-nom" type="text" maxlength="60" autocomplete="off" /></div>' +
        '<div class="fld"><label>Apellidos *</label><input id="agr-ape" type="text" maxlength="60" autocomplete="off" /></div>' +
        '<div class="fld"><label>Correo *</label><input id="agr-cor" type="email" autocomplete="off" /></div>' +
        '<div class="fld"><label>Teléfono (opcional)</label><input id="agr-tel" type="tel" inputmode="numeric" maxlength="10" autocomplete="off" /></div>' +
        '<div class="fld"><label>Usuario de WhatsApp (opcional)</label><input id="agr-uwa" type="text" maxlength="60" autocomplete="off" /></div>' +
        '<div class="fld"><label>Programa</label><input type="text" value="' + e_(t.nombre) + '" disabled /></div>' +
      '</div>',
      '<button class="btn btn-ghost" data-x>Cancelar</button><button class="btn btn-primary" id="agr-ok">Verificar</button>');
    m.querySelector('[data-x]').addEventListener('click', m.cerrar);
    var paso = 1, modo = 'registro';
    var cel = m.querySelector('#agr-cel'), ced = m.querySelector('#agr-ced'), ok = m.querySelector('#agr-ok');
    var aviso = function (txt, tipo, extra) {
      var a = m.querySelector('#agr-aviso');
      a.className = 'agr-aviso ' + (tipo || 'err');
      a.innerHTML = '<b>' + e_(txt) + '</b>' + (extra ? '<div>' + e_(extra) + '</div>' : '');
    };
    var limpiar = function () { m.querySelector('#agr-aviso').className = 'agr-aviso hidden'; };
    [cel, ced].forEach(function (el) {
      el.addEventListener('input', function () {
        el.value = el.value.replace(/\D/g, '');
        if (paso !== 1) { paso = 1; modo = 'registro'; m.querySelector('#agr-p2').classList.add('hidden'); ok.textContent = 'Verificar'; }
        limpiar();
      });
    });
    var irPaso2 = function (traspaso) {
      paso = 2; modo = traspaso ? 'traspaso' : 'registro';
      m.querySelector('#agr-p2').classList.remove('hidden');
      ok.textContent = traspaso ? 'Enviar solicitud a SEP' : 'Registrar';
      if (!traspaso) aviso('Número disponible. Completa los datos.', 'ok');
      m.querySelector('#agr-nom').focus();
    };
    ok.addEventListener('click', function () {
      var c = cel.value.trim(), k = ced.value.trim();
      if (c.length !== 10) { aviso('El celular debe tener 10 dígitos.'); return; }
      if (k.length < 5 || k.length > 12) { aviso('La cédula debe tener entre 5 y 12 dígitos.'); return; }
      if (paso === 1) {
        /* Ya está en mi lista (misma temporada): sin viaje. */
        var mio = d.registros.some(function (r) { return r.anio === t.anio && (r.cel === c || r.ced === k); });
        if (mio) { aviso('Este número ya está registrado; comunícate con SEP.'); return; }
        escudo_(ok, function () {
          return apiPost('agVerificar', { celular: c, cedula: k }, { silent: true }).then(function (r) {
            if (r.libre) { irPaso2(false); return; }
            if (r.traspaso) {
              aviso(r.mensaje, 'warn', r.detalle);
              ok.textContent = 'Pedir traspaso';
              ok.onclick = null;
              paso = 1.5;
              return;
            }
            aviso(r.mensaje);
          });
        });
        return;
      }
      if (paso === 1.5) { limpiar(); aviso('Completa los datos de la persona; SEP revisa la solicitud.', 'warn'); irPaso2(true); return; }
      var body = { celular: c, cedula: k, nombres: m.querySelector('#agr-nom').value, apellidos: m.querySelector('#agr-ape').value,
        correo: m.querySelector('#agr-cor').value, telefono: m.querySelector('#agr-tel').value, usuarioWhatsapp: m.querySelector('#agr-uwa').value };
      if (!String(body.nombres).trim() || !String(body.apellidos).trim()) { aviso('Escribe nombres y apellidos.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.correo).trim())) { aviso('Escribe un correo válido.'); return; }
      if (body.telefono && String(body.telefono).replace(/\D/g, '').length !== 10) { aviso('El teléfono debe tener 10 dígitos.'); return; }
      if (modo === 'traspaso') body.solicitarTraspaso = true;
      escudo_(ok, function () {
        return apiPost('agRegistrar', body, {
          avion: { titulo: modo === 'traspaso' ? 'Enviando la solicitud…' : 'Registrando…', sub: 'Un momento.', pasos: ['Revisando el celular y la cédula…', 'Guardando…'] }
        }).then(function (r) {
          if (r.registro) {
            prepararReg_(r.registro);
            AGP.data.registros.unshift(r.registro);
            AGP.anio = r.registro.anio;
            m.cerrar(); renderPart_(); contarInicio_();
            mostrarClavePart_(r.registro);
            return;
          }
          if (r.solicitud) {
            AGP.data.traspasos.unshift(r.solicitud);
            m.cerrar(); renderTras_();
            Swal.fire({ icon: 'success', title: 'Solicitud enviada', text: 'SEP revisa el traspaso. El resultado aparece en Mis participantes.' });
            return;
          }
          aviso(r.mensaje || 'No se pudo registrar.', r.traspaso ? 'warn' : 'err', r.detalle);
        });
      });
    });
    cel.focus();
  }
  function mostrarClavePart_(r) {
    Swal.fire({
      icon: 'success', title: 'Participante registrado',
      html: '<p>' + e_(r.nom + ' ' + r.ape) + ' quedó inscrito en Summer Work and Travel ' + e_(r.anio) + '.</p>' +
        '<p>Entrégale su clave de acceso (no se envía por correo ni WhatsApp):</p><div class="ag-clave"><b>' + e_(r.clave) + '</b></div>',
      confirmButtonText: 'Copiar la clave', showCancelButton: true, cancelButtonText: 'Cerrar'
    }).then(function (x) { if (x.isConfirmed) copiar_(r.clave, 'Clave copiada'); });
  }
  function contarInicio_() {
    var tp = document.querySelector('[data-agtile="participantes"] .menu-tile__desc');
    var d = AGP.data; if (!tp || !d || !d.temporada) return;
    var n = d.registros.filter(function (r) { return r.anio === d.temporada.anio; }).length;
    tp.textContent = n + ' en ' + d.temporada.nombre;
  }

  /* ============================================================
     FASE 6.3 · PARTICIPANTES DE TODAS LAS AGENCIAS (Superusuario)
     ============================================================ */
  function renderPartSup_() {
    var p = $1('#ag-panel-participantes'); if (!p) return;
    if (!soloAdmin_()) { p.innerHTML = ''; return; }
    if (!AGS.part) {
      p.innerHTML = (window.SEPEsqueleto && SEPEsqueleto.html('persona', 3)) || '';
      if (!AGS.partCargando) {
        AGS.partCargando = apiGet('agParticipantes', { usuarioId: currentUser.id }, { vista: 'agencias', silent: true }).then(function (d) {
          AGS.partCargando = null;
          (d.registros || []).forEach(prepararReg_);
          AGS.part = d;
          if (AGS.tab === 'participantes') renderPartSup_();
        }).catch(function (e) { AGS.partCargando = null; err_(e); });
      }
      return;
    }
    var d = AGS.part, t = tmpSel_();
    var anio = t ? String(t.anio) : '';
    var pend = (d.traspasos || []).filter(function (x) { return x.estado === 'PENDIENTE'; });
    var agSel = AGS.partAg || '';
    var lista = filtrarPart_(d.registros, anio, AGS.partQ).filter(function (r) { return !agSel || r.ag === agSel; });
    var ags = (AGS.data && AGS.data.agencias) || [];
    p.innerHTML =
      (pend.length ? '<div class="agp-tras"><div class="ag-sp-titulo">Solicitudes de traspaso pendientes · ' + pend.length + '</div>' + pend.map(function (x) {
        return '<div class="agp-tras__fila"><div><b>' + e_(x.nom + ' ' + x.ape) + '</b> <span class="ag-meta">· ' + e_(x.agn) + '</span>' +
          '<div class="ag-meta">' + e_(x.cel) + ' · ' + e_(x.ced) + ' · ' + e_(x.fecha) + ' · lead SEP ' + e_(x.idSep || '—') + '</div></div>' +
          '<div class="ag-acts"><button class="ag-btn" data-tras="aprobar" data-id="' + e_(x.id) + '">Aprobar</button>' +
          '<button class="ag-btn" data-tras="rechazar" data-id="' + e_(x.id) + '">Rechazar</button></div></div>';
      }).join('') + '</div>' : '') +
      '<div class="com-toolbar"><div class="search-bar"><svg class="search-bar__ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input id="agps-q" type="search" placeholder="Buscar participante…" autocomplete="off" value="' + e_(AGS.partQ || '') + '" /></div>' +
      '<select id="agps-ag"><option value="">Todas las agencias</option>' + ags.map(function (a) { return '<option value="' + e_(a.id) + '"' + (a.id === agSel ? ' selected' : '') + '>' + e_(a.nombre) + '</option>'; }).join('') + '</select></div>' +
      '<p class="cfg-hint">' + lista.length + ' participante' + (lista.length === 1 ? '' : 's') + ' de agencias en ' + e_(t ? t.nombre : 'la temporada') + '. No aparecen en Comercial, Participantes ni Estadísticas de SEP.</p>' +
      '<div id="agps-cards" class="ag-cards"></div>';
    var cont = $1('#agps-cards');
    if (typeof tandaPintar_ === 'function') tandaPintar_(cont, lista, function (r) { return tarjetaPart_(r, true); });
    else cont.innerHTML = lista.map(function (r) { return tarjetaPart_(r, true); }).join('');
    $1('#agps-q').addEventListener('input', function (e) {
      AGS.partQ = e.target.value;
      var l = filtrarPart_(AGS.part.registros, anio, AGS.partQ).filter(function (r) { return !AGS.partAg || r.ag === AGS.partAg; });
      if (typeof tandaPintar_ === 'function') tandaPintar_(cont, l, function (r) { return tarjetaPart_(r, true); });
      else cont.innerHTML = l.map(function (r) { return tarjetaPart_(r, true); }).join('');
    });
    $1('#agps-ag').addEventListener('change', function (e) { AGS.partAg = e.target.value; renderPartSup_(); });
    p.onclick = function (e) {
      var c = e.target.closest('[data-copiar]'); if (c) { copiar_(c.getAttribute('data-copiar'), 'Clave copiada'); return; }
      var dt = e.target.closest('[data-det]');
      if (dt) { abrirDet_(dt.getAttribute('data-det'), { lista: function () { return AGS.part && AGS.part.registros; }, repintar: renderPartSup_, esSuper: true }); return; }
      var b = e.target.closest('[data-tras]'); if (!b) return;
      resolverTras_(b, b.getAttribute('data-id'), b.getAttribute('data-tras'));
    };
  }
  function resolverTras_(btn, id, accion) {
    var x = (AGS.part.traspasos || []).find(function (y) { return y.id === id; }); if (!x) return;
    var pide = accion === 'aprobar'
      ? Swal.fire({ icon: 'question', title: 'Aprobar el traspaso', html: '<b>' + e_(x.nom + ' ' + x.ape) + '</b> queda inscrito con <b>' + e_(x.agn) + '</b> y el lead de SEP se cierra (sin mensajes).', input: 'text', inputLabel: 'Nota (opcional)', showCancelButton: true, confirmButtonText: 'Aprobar', cancelButtonText: 'Cancelar' })
      : Swal.fire({ icon: 'warning', title: 'Rechazar el traspaso', input: 'textarea', inputLabel: 'Motivo (lo ve la agencia)', showCancelButton: true, confirmButtonText: 'Rechazar', cancelButtonText: 'Cancelar',
          inputValidator: function (v) { return String(v || '').trim().length < 5 && 'Escribe el motivo (mínimo 5 caracteres).'; } });
    pide.then(function (r) {
      if (!r.isConfirmed) return;
      escudo_(btn, function () {
        return apiPost('agTraspasoResolver', { usuarioId: currentUser.id, id: id, accion: accion, motivo: r.value || '' }).then(function (out) {
          var arr = AGS.part.traspasos; var i = arr.findIndex(function (y) { return y.id === id; });
          if (i >= 0) arr[i] = out.traspaso;
          if (out.registro) AGS.part.registros.unshift(prepararReg_(out.registro));
          renderPartSup_();
          Swal.fire({ icon: 'success', title: accion === 'aprobar' ? 'Traspaso aprobado' : 'Traspaso rechazado', timer: 1200, showConfirmButton: false });
        });
      });
    });
  }

  /* ============================================================
     FASE 6.4 · PRUEBA DE INGLÉS Y FORMULARIO DEL PARTICIPANTE
     Cabecera antes que datos: el modal se pinta con la fila de la lista
     y el detalle llega de fondo en UN viaje (agParticipante). Cada
     escritura (invitación, nota, aprobar, reversar) responde el detalle
     nuevo: se repinta el modal y se parcha la tarjeta en memoria.
     La agencia invita y aprueba; la nota y el reverso son del Superusuario.
     ============================================================ */
  var EST_BLOQUE = { PENDIENTE: ['Pendiente', 'off'], EN_PROGRESO: ['En progreso', 'warn'], COMPLETADO: ['Completado', 'ok'], REABIERTO: ['Reabierto', 'warn'] };

  function abrirDet_(id, ctx) {
    var lista = ctx.lista() || [];
    var r = lista.find(function (x) { return x.id === id; });
    if (!r) return;
    var m = modal_(r.nom + ' ' + r.ape,
      '<div class="agd-cab">' +
        (ctx.esSuper && r.agn ? '<div class="agp-ag">' + e_(r.agn) + '</div>' : '') +
        '<div class="agp-datos"><span>' + IC_P.tel + e_(r.cel) + '</span><span>' + IC_P.doc + e_(r.ced || '—') + '</span>' +
        '<span>' + IC_P.llave + e_(r.clave || '—') + '</span><span class="ag-pill ok">SWT ' + e_(r.anio) + '</span></div>' +
      '</div>' +
      '<div id="agd-cuerpo">' + ((window.SEPEsqueleto && SEPEsqueleto.html('persona', 2)) || '') + '</div>');
    m.classList.add('agd-modal');
    var tk = sesionTk_();
    var params = ctx.esSuper ? { usuarioId: currentUser.id, id: id } : { id: id };
    apiGet('agParticipante', params, { silent: true }).then(function (d) {
      if (!m.parentNode || sesionTk_() !== tk) return;
      pintarDet_(m, d, ctx);
    }).catch(function (e) {
      if (!m.parentNode) return;
      var c = m.querySelector('#agd-cuerpo');
      if (c) c.innerHTML = '<div class="agr-aviso err"><b>' + e_((e && e.message) || 'No se pudo cargar el detalle') + '</b></div>';
    });
  }

  function patchLista_(d, ctx) {
    var lista = ctx.lista() || [];
    var r = lista.find(function (x) { return x.id === d.id; });
    if (!r) return;
    var p = d.prueba || {}, f = d.formulario || {}, o = (d.oferta && d.oferta.sel) || null;
    var ofc = !o ? '' : (o.estado === 'APROBADA' ? 'ok' : (o.estado === 'NO_APROBADA' || o.estado === 'CANCELADA' ? 'bad' : 'warn'));
    r.est = { inv: !!p.invitado, pts: p.puntaje || '', ok: !!p.alcanza, ft: !!f.terminado, apr: !!f.aprobado,
              of: o && (d.oferta.activa || o.estado === 'APROBADA') ? o.estadoLabel : '', ofc: ofc };
    var et = d.viaje && d.viaje.etapa;
    if (et) { r.est.et = et.l; r.est.etc = et.c; }
    try { ctx.repintar(); } catch (_) {}
  }

  function pintarDet_(m, d, ctx) {
    var c = m.querySelector('#agd-cuerpo'); if (!c) return;
    var p = d.prueba || {}, f = d.formulario || {}, pu = d.puede || {};
    var minimo = Number(p.minimo || 4.5).toFixed(1);

    var estPrueba = p.puntaje
      ? '<span class="ag-pill ' + (p.alcanza ? 'ok' : 'bad') + '">Nota ' + e_(p.puntaje) + (p.alcanza ? ' · continúa' : ' · menor a ' + minimo) + '</span>'
      : (p.invitado ? '<span class="ag-pill warn">Invitado · sin nota</span>' : '<span class="ag-pill off">Sin invitar</span>');
    var prueba = '<section class="agd-sec"><h3>Prueba de inglés</h3>' +
      '<div class="ag-pills">' + estPrueba + '</div>' +
      '<div class="ag-pares">' +
        '<div class="ag-par"><span>Invitación</span><b>' + e_(p.invitado ? (p.invitadoPor || 'Sí') + (p.invitadoFecha ? ' · ' + p.invitadoFecha : '') : 'No') + '</b></div>' +
        (p.puntaje ? '<div class="ag-par"><span>Nivel</span><b>' + e_(p.nivel || '—') + (p.nivelHv ? ' · HV ' + e_(p.nivelHv) : '') + '</b></div>' +
                     '<div class="ag-par"><span>Registrada</span><b>' + e_(p.fecha || '—') + '</b></div>' : '') +
      '</div>' +
      '<p class="cfg-hint">La prueba le aparece al participante en sus Acciones pendientes, con el video de SEP. Con ' + minimo +
        ' o más se abre su formulario (sin curso de inglés). La nota la registra SEP.</p>' +
      '<div class="ag-acts">' +
        (pu.invitar ? '<button type="button" class="ag-btn" data-agd="inv" data-v="' + (p.invitado ? '0' : '1') + '">' + (p.invitado ? 'Quitar invitación' : 'Marcar invitación') + '</button>' : '') +
      '</div>' +
      (pu.nota ? '<div class="form-grid agd-nota">' +
        '<div class="fld"><label>Nota de inglés (0 a 9)</label><input id="agd-pts" type="text" inputmode="decimal" maxlength="5" placeholder="Ej. 4.5" value="' + e_(p.puntaje || '') + '" /></div>' +
        '<div class="fld"><label>Nivel de Inglés HV</label><select id="agd-hv"><option value="">Elige…</option>' +
          (d.listaHv || []).map(function (x) { return '<option' + (x === p.nivelHv ? ' selected' : '') + '>' + e_(x) + '</option>'; }).join('') + '</select></div>' +
        '<div class="fld agd-nota__btn"><button type="button" class="btn btn-primary" data-agd="nota">' + (p.puntaje ? 'Actualizar nota' : 'Registrar nota') + '</button></div>' +
      '</div>' : '') +
      '</section>';

    var pct = f.total ? Math.round((f.completados / f.total) * 100) : 0;
    var estForm = f.aprobado ? '<span class="ag-pill ok">Aprobado' + (f.fechaAprobado ? ' · ' + e_(f.fechaAprobado) : '') + '</span>'
      : (f.terminado ? '<span class="ag-pill warn">Terminado · por aprobar</span>'
        : (f.habilitado ? '<span class="ag-pill off">En curso · ' + f.completados + ' de ' + f.total + '</span>' : '<span class="ag-pill off">Se abre con la nota</span>'));
    var form = '<section class="agd-sec"><h3>Formulario</h3>' +
      '<div class="ag-pills">' + estForm + '</div>' +
      (f.habilitado || f.terminado || f.aprobado ? '<div class="agd-prog"><i style="width:' + pct + '%"></i></div>' +
        '<div class="agd-bloques">' + (f.bloques || []).map(function (b) {
          var e = EST_BLOQUE[b.e] || EST_BLOQUE.PENDIENTE;
          return '<div class="agd-bloque"><span>' + b.n + '. ' + e_(b.t) + '</span><span class="ag-pill ' + e[1] + '">' + e[0] + '</span></div>';
        }).join('') + '</div>' : '') +
      (f.falta ? '<div class="agr-aviso warn"><b>Todavía no se puede aprobar</b><div>' + e_(f.falta) + '</div></div>' : '') +
      ((f.docsPendientes || []).length ? '<p class="cfg-hint">Documentos pendientes: ' + e_(f.docsPendientes.join(', ')) + '.</p>' : '') +
      '<div class="ag-acts">' +
        (pu.aprobar ? '<button type="button" class="btn btn-primary" data-agd="aprobar">Aprobar formulario</button>' : '') +
        (pu.reversar ? '<button type="button" class="ag-btn" data-agd="reversar">Reversar aprobación</button>' : '') +
      '</div>' +
      (f.aprobado && !pu.reversar ? '<p class="cfg-hint">Solo SEP puede reversar la aprobación.</p>' : '') +
      '</section>';

    var hist = '<section class="agd-sec"><h3>Historial</h3>' +
      ((d.historial || []).length ? '<div class="ag-aud">' + d.historial.map(function (h) {
        return '<div class="ag-aud__fila"><div class="ag-aud__top"><b>' + e_(accionTxt_(h.accion)) + '</b><span>' + e_(h.fecha) + '</span></div>' +
          '<div class="ag-aud__quien">' + e_(h.actor) + (h.rol ? ' · ' + e_(h.rol) : '') + '</div>' +
          ((h.nota || h.motivo) ? '<div class="ag-aud__det">' + (h.nota ? 'Nota ' + e_(h.antes ? h.antes + ' → ' : '') + e_(h.nota) : '') +
            (h.motivo ? (h.nota ? ' · ' : '') + 'Motivo: ' + e_(h.motivo) : '') + '</div>' : '') +
          '</div>';
      }).join('') + '</div>' : '<p class="cfg-hint">Sin movimientos todavía.</p>') +
      '</section>';

    /* 6.7 — temporada cerrada: el detalle se ve, pero sin acciones. */
    var ro = !!(d.viaje && d.viaje.temporadaCerrada);
    m.classList.toggle('ag-ro', ro);
    c.innerHTML = (ro ? '<div class="agr-aviso warn ag-ro-aviso"><b>Temporada cerrada · solo lectura</b><div>No se hacen cambios en el proceso. Solo un Superadmin puede reabrirla.</div></div>' : '') +
      prueba + form + secHv_(d) + secDocs_(d) + secOferta_(d, ctx) + secViaje_(d, ctx) + hist;
    c.onclick = function (ev) {
      var b = ev.target.closest('[data-agd]'); if (!b) return;
      accionDet_(m, b, d, ctx);
    };
  }

  function accionDet_(m, btn, d, ctx) {
    /* 6.6 — hn: las escrituras devuelven solo el historial nuevo (no se
       relee la auditoría completa); aquí se pone encima del que ya hay. */
    var base = ctx.esSuper ? { usuarioId: currentUser.id, id: d.id, hn: 1 } : { id: d.id, hn: 1 };
    var hecho = function (nuevo, txt) {
      if (nuevo && nuevo.histNuevo) nuevo.historial = histJunto_(nuevo, d);
      /* 6.5 — las escrituras nuevas devuelven SOLO el bloque que cambió. */
      if (nuevo && nuevo.parcial) nuevo = Object.assign({}, d, nuevo, { parcial: false });
      patchLista_(nuevo, ctx);
      if (m.parentNode) pintarDet_(m, nuevo, ctx);
      Swal.fire({ icon: 'success', title: txt, timer: 1100, showConfirmButton: false });
    };
    var que = btn.getAttribute('data-agd');
    if (que === 'inv') {
      var marcar = btn.getAttribute('data-v') === '1';
      escudo_(btn, function () {
        return apiPost('agInvitacion', Object.assign({ marcar: marcar }, base), { avion: { titulo: 'Guardando la invitación…' } })
          .then(function (n) { hecho(n, marcar ? 'Invitación marcada' : 'Invitación quitada'); });
      });
      return;
    }
    if (que === 'nota') {
      var pts = String((m.querySelector('#agd-pts') || {}).value || '').trim().replace(',', '.');
      var hv = (m.querySelector('#agd-hv') || {}).value || '';
      var n = Number(pts);
      if (!pts || isNaN(n) || n < 0 || n > 9) { Swal.fire({ icon: 'warning', title: 'Revisa la nota', text: 'Escribe una nota entre 0 y 9.' }); return; }
      if (!hv) { Swal.fire({ icon: 'warning', title: 'Falta el nivel', text: 'Elige el Nivel de Inglés HV.' }); return; }
      escudo_(btn, function () {
        return apiPost('agNota', Object.assign({ puntaje: pts, nivelHv: hv }, base), { avion: { titulo: 'Guardando la nota…' } })
          .then(function (x) { hecho(x, 'Nota guardada'); });
      });
      return;
    }
    if (que === 'aprobar') {
      Swal.fire({ icon: 'question', title: 'Aprobar el formulario', text: 'Confirmas que el participante está listo para continuar con las ofertas. Solo SEP puede reversarlo.',
        showCancelButton: true, confirmButtonText: 'Aprobar', cancelButtonText: 'Cancelar' }).then(function (x) {
        if (!x.isConfirmed) return;
        escudo_(btn, function () {
          return apiPost('agFormAprobar', base, { avion: { titulo: 'Aprobando el formulario…' } }).then(function (n) {
            hecho(n, 'Formulario aprobado');
            /* 6.5 — la hoja de vida se arma DE FONDO (tarda ~12 s): no se
               espera aquí; se pinta "Generando…" y se parcha al llegar. */
            if (n && n.generarHv) hvFondo_(m, n, ctx, base);
          });
        });
      });
      return;
    }
    if (accionDet65_(m, btn, d, ctx, que, base, hecho)) return;
    if (accionDet66_(m, btn, d, ctx, que, base, hecho)) return;
    if (que === 'reversar') {
      Swal.fire({ icon: 'warning', title: 'Reversar la aprobación', input: 'textarea', inputLabel: 'Motivo (queda en el historial)',
        showCancelButton: true, confirmButtonText: 'Reversar', cancelButtonText: 'Cancelar',
        inputValidator: function (v) { return String(v || '').trim().length < 5 && 'Escribe el motivo (mínimo 5 caracteres).'; } }).then(function (x) {
        if (!x.isConfirmed) return;
        escudo_(btn, function () {
          return apiPost('agFormReversar', Object.assign({ motivo: x.value }, base), { avion: { titulo: 'Reversando…' } }).then(function (n) { hecho(n, 'Aprobación reversada'); });
        });
      });
    }
  }

  /* ============================================================
     FASE 6.5 · HOJA DE VIDA, DOCUMENTOS Y OFERTA DEL PARTICIPANTE
     Todo llega en el mismo detalle (un viaje). Cada escritura responde
     solo el bloque que cambió y se parcha sobre el detalle.
     Agencia: aprueba/rechaza documentos, marca Aplicada al Sponsor,
     agenda la entrevista y registra Contratado/Rechazado.
     Superusuario: además regenera la HV, reabre documentos aprobados,
     corrige "Aplicada al Sponsor" y libera la oferta (todo con motivo).
     ============================================================ */
  function secHv_(d) {
    var hv = d.hv || {};
    if (hv.generando) {
      return '<section class="agd-sec"><h3>Hoja de vida</h3><div class="ag-pills"><span class="ag-pill warn">Generando la hoja de vida…</span></div>' +
        '<p class="cfg-hint">Tarda unos segundos. Puedes seguir trabajando; aparecerá aquí cuando esté lista.</p></section>';
    }
    return '<section class="agd-sec"><h3>Hoja de vida</h3>' +
      (hv.error ? '<div class="agr-aviso err"><b>No se pudo generar la hoja de vida</b><div>' + e_(hv.error) + '</div></div>' : '') +
      (!hv.url && hv.puedeGenerar ? '<div class="ag-acts"><button type="button" class="btn btn-primary" data-agd="hvgen">Generar hoja de vida</button></div>' : '') +
      (hv.url
        ? '<div class="ag-pills"><span class="ag-pill ok">Generada' + (hv.fecha ? ' · ' + e_(hv.fecha) : '') + '</span></div>' +
          '<div class="ag-acts"><a class="btn btn-ghost" href="' + e_(hv.url) + '" target="_blank" rel="noopener">' + IC_P.doc + ' Ver hoja de vida</a>' +
          (hv.puedeRegenerar ? '<button type="button" class="ag-btn" data-agd="hv">Volver a generar</button>' : '') + '</div>'
        : '<p class="cfg-hint">Se genera al aprobar el formulario, con el nombre de la agencia y «Generated by SEP Group».</p>') +
      '</section>';
  }

  function secDocs_(d) {
    var dd = d.documentos || {}, l = dd.documentos || [];
    if (dd.error) return '<section class="agd-sec"><h3>Documentos</h3><div class="agr-aviso err"><b>' + e_(dd.error) + '</b></div></section>';
    var n = { APROBADO: 0, EN_REVISION: 0, RECHAZADO: 0, PENDIENTE: 0 };
    l.forEach(function (x) { if (!x.auto && n[x.estado] !== undefined) n[x.estado]++; });
    return '<section class="agd-sec"><h3>Documentos</h3>' +
      '<div class="ag-pills">' +
        '<span class="ag-pill ok">' + n.APROBADO + ' aprobado(s)</span>' +
        (n.EN_REVISION ? '<span class="ag-pill warn">' + n.EN_REVISION + ' por revisar</span>' : '') +
        (n.RECHAZADO ? '<span class="ag-pill bad">' + n.RECHAZADO + ' rechazado(s)</span>' : '') +
        '<span class="ag-pill off">' + n.PENDIENTE + ' pendiente(s)</span>' +
      '</div>' +
      '<p class="cfg-hint">Siempre abiertos: un documento pendiente no detiene las demás etapas. Los carga el participante o la agencia.</p>' +
      '<div class="ag-acts"><button type="button" class="btn btn-primary" data-agd="docs">' + IC_P.doc + ' Abrir documentos</button></div>' +
      '</section>';
  }

  /* 6.6 — historial nuevo (de la escritura) encima del que ya se tenía. */
  function histJunto_(n, d) { return (n.historial || []).concat(d.historial || []).slice(0, 40); }

  function hoyIso_() { var t = new Date(); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  function dmyAIso_(s) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }

  function secOferta_(d, ctx) {
    var o = d.oferta || {}, s = o.sel, pu = o.puede || {};
    if (o.error) return '<section class="agd-sec"><h3>Oferta de empleo</h3><div class="agr-aviso err"><b>' + e_(o.error) + '</b></div></section>';
    if (!s) {
      return '<section class="agd-sec"><h3>Oferta de empleo</h3>' +
        '<p class="cfg-hint">Todavía no ha escogido oferta. La escoge el participante en su portal cuando su formulario está aprobado ' +
        '(solo ve los sponsors habilitados para subagencias y el cupo es el mismo de SEP).</p></section>';
    }
    var c = o.cobro;
    var cobro = !c ? '<span class="ag-pill off">Sin cobro de Aplicada al Sponsor</span>'
      : (c.estado === 'REVERSADO' ? '<span class="ag-pill off">Cobro reversado' + (c.motivo ? ' · ' + e_(c.motivo) : '') + '</span>'
        : (c.estado === 'SIN_VALOR' ? '<span class="ag-pill warn">Cobro Aplicada al Sponsor · sin valor configurado</span>'
          : '<span class="ag-pill ok">Cobro Aplicada al Sponsor · ' + e_(c.moneda + ' ' + c.valor) + '</span>'));
    var ent = s.entrevista;
    var h = '<section class="agd-sec agd-ofe"><h3>Oferta de empleo</h3>' +
      '<div class="ag-pills"><span class="ag-pill ' + (s.estado === 'APROBADA' ? 'ok' : (s.estado === 'NO_APROBADA' || s.estado === 'CANCELADA' ? 'bad' : 'warn')) + '">' + e_(s.estadoLabel) + '</span>' + cobro + '</div>' +
      '<div class="ag-pares">' +
        '<div class="ag-par"><span>Posición</span><b>' + e_(s.posicion || '—') + '</b></div>' +
        '<div class="ag-par"><span>Empleador</span><b>' + e_(s.empleador || '—') + '</b></div>' +
        '<div class="ag-par"><span>Lugar</span><b>' + e_(s.lugar || '—') + '</b></div>' +
        '<div class="ag-par"><span>Sponsor</span><b>' + e_(s.sponsor || '—') + '</b></div>' +
        '<div class="ag-par"><span>Escogida</span><b>' + e_(s.fecha || '—') + '</b></div>' +
        (s.aplicada ? '<div class="ag-par"><span>Aplicada al Sponsor</span><b>' + e_(s.aplicadaFecha || '') + (s.aplicadaPor ? ' · ' + e_(s.aplicadaPor) : '') + '</b></div>' : '') +
        (ent ? '<div class="ag-par"><span>Entrevista</span><b>' + e_(ent.fecha) + (ent.hora ? ' · ' + e_(ent.hora) : '') + '</b></div>' : '') +
        (s.resultado ? '<div class="ag-par"><span>Resultado</span><b>' + e_(s.estadoLabel) + (s.resultadoPor ? ' · ' + e_(s.resultadoPor) : '') + '</b></div>' : '') +
      '</div>' +
      (ent && ent.link ? '<p class="cfg-hint">Enlace: <a href="' + e_(ent.link) + '" target="_blank" rel="noopener">' + e_(ent.link) + '</a></p>' : '') +
      (s.resultadoNota ? '<p class="cfg-hint">Nota del resultado: ' + e_(s.resultadoNota) + '</p>' : '') +
      (s.esperaLiberacion ? '<div class="agr-aviso warn"><b>Rechazado: espera la liberación de SEP</b><div>El cupo sigue tomado y el participante no puede escoger otra oferta hasta que SEP la libere. El cobro de Aplicada al Sponsor no se reversa.</div></div>' : '') +
      (!o.activa && s.liberada ? '<p class="cfg-hint">SEP liberó esta oferta' + (s.liberadaFecha ? ' el ' + e_(s.liberadaFecha) : '') + (s.motivoLiberacion && ctx.esSuper ? ' · ' + e_(s.motivoLiberacion) : '') + '. El participante ya puede escoger otra.</p>' : '');

    var acts = '';
    if (pu.aplicada) acts += '<button type="button" class="btn btn-primary" data-agd="aplicada">Marcar Aplicada al Sponsor</button>';
    if (pu.resultado) acts += '<button type="button" class="ag-btn" data-agd="contratado">Contratado</button><button type="button" class="ag-btn" data-agd="rechazado">Rechazado</button>';
    if (pu.corregirSponsor) acts += '<button type="button" class="ag-btn" data-agd="corregir">Corregir Aplicada al Sponsor</button>';
    if (pu.liberar) acts += '<button type="button" class="ag-btn" data-agd="liberar">Liberar oferta</button>';
    if (acts) h += '<div class="ag-acts">' + acts + '</div>';
    if (s.aplicada === false && o.activa && s.estado === 'SELECCIONADA') h += '<p class="cfg-hint">«Aplicada al Sponsor» genera una sola vez el cobro de esta temporada. La agencia no la puede deshacer.</p>';

    if (pu.entrevista) {
      h += '<div class="form-grid agd-nota agd-ent">' +
        '<div class="fld"><label>Fecha de la entrevista</label><input id="agd-ent-f" type="date" value="' + e_(dmyAIso_(s.entrevistaFechaTxt) || '') + '" min="' + hoyIso_() + '" /></div>' +
        '<div class="fld"><label>Hora (24 h)</label><input id="agd-ent-h" type="time" value="' + e_(s.entrevistaHoraTxt || '') + '" /></div>' +
        '<div class="fld"><label>Enlace (opcional)</label><input id="agd-ent-l" type="url" maxlength="300" placeholder="https://…" value="' + e_((ent && ent.link) || '') + '" /></div>' +
        '<div class="fld"><label>Instrucciones (opcional)</label><input id="agd-ent-i" type="text" maxlength="600" value="' + e_((ent && ent.instrucciones) || '') + '" /></div>' +
        '<div class="fld agd-nota__btn"><button type="button" class="btn btn-primary" data-agd="entrevista">' + (ent ? 'Reprogramar entrevista' : 'Guardar entrevista') + '</button></div>' +
      '</div><p class="cfg-hint">El participante la ve en su portal. No se le envían mensajes.</p>';
    }
    if ((s.historial || []).length) {
      h += '<details class="agd-ofe-hist"><summary>Historial de la oferta (' + s.historial.length + ')</summary><ol>' +
        s.historial.map(function (x) { return '<li><b>' + e_(x.a) + '</b> · ' + e_(x.q || '—') + ' · ' + e_(x.f) + (x.d ? '<div>' + e_(x.d) + '</div>' : '') + '</li>'; }).join('') +
        '</ol></details>';
    }
    return h + '</section>';
  }

  /* La HV de fondo: escritura con su rid (apiPost), sin bloquear la vista.
     Si el modal ya se cerró, el resultado igual queda guardado. */
  function hvFondo_(m, d, ctx, base) {
    d.hv = Object.assign({}, d.hv || {}, { generando: true, error: '' });
    if (m.parentNode) pintarDet_(m, d, ctx);
    apiPost('agHvGenerar', base, { silent: true }).then(function (n) {
      Object.assign(d, { hv: n.hv || d.hv, historial: n.histNuevo ? histJunto_(n, d) : (n.historial || d.historial) });
    }).catch(function (e) {
      d.hv = Object.assign({}, d.hv, { generando: false, error: String((e && e.message) || e), puedeGenerar: true });
    }).then(function () { if (m.parentNode) pintarDet_(m, d, ctx); });
  }

  function accionDet65_(m, btn, d, ctx, que, base, hecho) {
    var conMotivo = function (titulo, texto, ruta, ok, aviso) {
      Swal.fire({ icon: 'warning', title: titulo, text: texto, input: 'textarea', inputLabel: 'Motivo (queda en el historial)',
        showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar',
        inputValidator: function (v) { return String(v || '').trim().length < 5 && 'Escribe el motivo (mínimo 5 caracteres).'; } }).then(function (x) {
        if (!x.isConfirmed) return;
        escudo_(btn, function () {
          return apiPost(ruta, Object.assign({ motivo: x.value }, base), { avion: { titulo: aviso } }).then(function (n) { hecho(n, ok); });
        });
      });
    };
    if (que === 'docs') {
      if (typeof NDOCS === 'undefined') return true;
      var cab = d.cab || {};
      NDOCS.abrir({ id: d.id, nombres: cab.nom || '', apellidos: cab.ape || '', documento: cab.ced || '' }, {
        ag: { base: base, datos: d.documentos, alCambiar: function (res) {
          if (!res) return;
          Object.assign(d, { documentos: res.documentos || d.documentos, viaje: res.viaje || d.viaje,
            historial: res.histNuevo ? histJunto_(res, d) : (res.historial || d.historial) });
          if (m.parentNode) pintarDet_(m, d, ctx);
        } }
      });
      return true;
    }
    if (que === 'hvgen') { hvFondo_(m, d, ctx, base); return true; }
    if (que === 'hv') {
      escudo_(btn, function () {
        return apiPost('agHvRegenerar', base, { avion: { titulo: 'Generando la hoja de vida…' } }).then(function (n) { hecho(n, 'Hoja de vida generada'); });
      });
      return true;
    }
    if (que === 'aplicada') {
      Swal.fire({ icon: 'question', title: 'Aplicada al Sponsor', text: 'Se genera una sola vez el cobro de esta temporada. La agencia no lo puede deshacer.',
        showCancelButton: true, confirmButtonText: 'Marcar', cancelButtonText: 'Cancelar' }).then(function (x) {
        if (!x.isConfirmed) return;
        escudo_(btn, function () {
          return apiPost('agAplicadaSponsor', base, { avion: { titulo: 'Marcando Aplicada al Sponsor…' } }).then(function (n) { hecho(n, 'Aplicada al Sponsor'); });
        });
      });
      return true;
    }
    if (que === 'entrevista') {
      var f = String((m.querySelector('#agd-ent-f') || {}).value || ''), h = String((m.querySelector('#agd-ent-h') || {}).value || '');
      var l = String((m.querySelector('#agd-ent-l') || {}).value || '').trim(), ins = String((m.querySelector('#agd-ent-i') || {}).value || '').trim();
      var mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
      if (!mm) { Swal.fire({ icon: 'warning', title: 'Falta la fecha', text: 'Elige la fecha de la entrevista.' }); return true; }
      if (!/^\d{1,2}:\d{2}$/.test(h)) { Swal.fire({ icon: 'warning', title: 'Falta la hora', text: 'Escribe la hora de la entrevista.' }); return true; }
      if (l && !/^https?:\/\//i.test(l)) { Swal.fire({ icon: 'warning', title: 'Revisa el enlace', text: 'Debe empezar por https://' }); return true; }
      escudo_(btn, function () {
        return apiPost('agEntrevista', Object.assign({ fecha: mm[3] + '/' + mm[2] + '/' + mm[1], hora: h.slice(0, 5), link: l, instrucciones: ins }, base),
          { avion: { titulo: 'Guardando la entrevista…' } }).then(function (n) { hecho(n, 'Entrevista guardada'); });
      });
      return true;
    }
    if (que === 'contratado' || que === 'rechazado') {
      var contr = que === 'contratado';
      Swal.fire({ icon: 'question', title: contr ? 'Registrar Contratado' : 'Registrar Rechazado',
        text: contr ? 'El participante queda contratado en esta oferta.' : 'El cupo sigue tomado y el participante espera a que SEP libere la oferta para escoger otra.',
        input: 'text', inputLabel: 'Nota (opcional)', showCancelButton: true, confirmButtonText: 'Registrar', cancelButtonText: 'Cancelar' }).then(function (x) {
        if (!x.isConfirmed) return;
        escudo_(btn, function () {
          return apiPost('agResultado', Object.assign({ resultado: contr ? 'CONTRATADO' : 'RECHAZADO', nota: x.value || '' }, base),
            { avion: { titulo: 'Guardando el resultado…' } }).then(function (n) { hecho(n, contr ? 'Contratado' : 'Rechazado'); });
        });
      });
      return true;
    }
    if (que === 'corregir') {
      conMotivo('Corregir Aplicada al Sponsor', 'La oferta vuelve a Seleccionada y el cobro queda reversado (con este motivo).', 'agSponsorCorregir', 'Corregido', 'Corrigiendo…');
      return true;
    }
    if (que === 'liberar') {
      conMotivo('Liberar la oferta', 'El cupo vuelve de inmediato a la oferta y el participante puede escoger otra. El cobro de Aplicada al Sponsor no se reversa.', 'agLiberarOferta', 'Oferta liberada', 'Liberando…');
      return true;
    }
    return false;
  }


  /* ============================================================
     FASE 6.6 · VERIFICACIÓN, DS-2019, VISA, VUELO Y RETIRO
     Llega en el mismo detalle (d.viaje, un viaje). Cada escritura
     responde solo el bloque viaje (+ documentos si fue el vuelo) y se
     parcha. Agencia: primera revisión, visa, vuelo y retiro. SEP:
     segunda revisión, DS-2019 (cobro único) y sus correcciones.
     ============================================================ */
  var VERIF_CLS = { ENVIADA: 'warn', DEVUELTA: 'bad', APROBADA: 'ok' };
  function fechaHoraTxt_(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(s || ''));
    return m ? m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' ' + m[4] + ':' + m[5] : '') : '';
  }
  function bloqueForm_(b) {
    var filas = (b.campos || []).map(function (c) {
      var v;
      if (c.t === 'lista') {
        v = (c.filas || []).length ? '<table class="agv-tabla"><tr>' + (c.cols || []).map(function (k) { return '<th>' + e_(k.l) + '</th>'; }).join('') + '</tr>' +
          c.filas.map(function (f) { return '<tr>' + (c.cols || []).map(function (k) { return '<td>' + e_(f[k.k] || '—') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>' : '—';
        return '<div class="agv-campo agv-campo--ancho"><span>' + e_(c.l) + '</span>' + v + '</div>';
      }
      if (c.t === 'chips') v = (c.v || []).length ? c.v.map(e_).join(', ') : '—';
      else if (c.t === 'secreto') v = c.hay ? '•••••• (oculta)' : '—';
      else v = e_(c.v || '—');
      return '<div class="agv-campo"><span>' + e_(c.l) + '</span><b>' + v + '</b></div>';
    }).join('');
    return '<details class="agv-bloque"><summary>' + e_((b.icono ? b.icono + ' ' : '') + b.n + '. ' + b.titulo) + '</summary><div class="agv-campos">' + filas + '</div></details>';
  }
  function secViaje_(d, ctx) {
    var v = d.viaje;
    if (!v) return '';
    if (v.error) return '<section class="agd-sec"><h3>Verificación, visa y vuelo</h3><div class="agr-aviso err"><b>' + e_(v.error) + '</b></div></section>';
    var pu = v.puede || {}, vf = v.verif || {}, ds = v.ds2019 || {}, vi = v.visa || {}, ret = v.retiro || {};
    var h = '';
    var et = v.etapa ? '<span class="ag-pill ' + e_(v.etapa.c) + '">' + e_(v.etapa.l) + '</span>' : '';

    /* 1. Verificación académica (se abre con Contratado). */
    if (v.contratado || vf.estado) {
      var certs = ((d.documentos && d.documentos.documentos) || []).filter(function (x) { return x.clave === 'CERT_ENE_JUL' || x.clave === 'CERT_AGO_DIC'; });
      h += '<section class="agd-sec agv"><h3>Verificación académica</h3>' +
        '<div class="ag-pills"><span class="ag-pill ' + (VERIF_CLS[vf.estado] || 'off') + '">' + e_(vf.label || 'Pendiente') + '</span>' +
          (vf.resultado ? '<span class="ag-pill ok">Resultado SEP: ' + e_(vf.resultado === 'APROBADO' ? 'Aprobado' : vf.resultado) + '</span>' : '') + '</div>' +
        '<div class="ag-pares">' +
          (vf.enviadaPor ? '<div class="ag-par"><span>Primera revisión</span><b>' + e_(vf.enviadaPor) + ' · ' + e_(vf.enviadaFecha) + '</b></div>' : '') +
          (vf.revisoPor ? '<div class="ag-par"><span>Revisión de SEP</span><b>' + e_(vf.revisoPor) + ' · ' + e_(vf.revisoFecha) + '</b></div>' : '') +
        '</div>' +
        (vf.estado === 'DEVUELTA' && vf.motivo ? '<div class="agr-aviso warn"><b>SEP la devolvió para corregir</b><div>' + e_(vf.motivo) + '</div></div>' : '') +
        (certs.length ? '<div class="agv-certs">' + certs.map(function (x) {
          return '<div class="agv-cert"><span>' + e_(x.nombre) + '</span><span class="ag-pill ' + (x.estado === 'APROBADO' ? 'ok' : (x.estado === 'RECHAZADO' ? 'bad' : (x.estado === 'EN_REVISION' ? 'warn' : 'off'))) + '">' + e_(x.estadoLabel || x.estado) + '</span>' +
            (x.url ? '<a class="ag-btn" href="' + e_(x.url) + '" target="_blank" rel="noopener">' + IC_P.doc + '<span>Ver</span></a>' : '') + '</div>';
        }).join('') + '</div><p class="cfg-hint">Los certificados se aprueban o rechazan en «Abrir documentos».</p>' : '') +
        ((vf.bloques || []).length ? '<div class="agv-bloques">' + vf.bloques.map(bloqueForm_).join('') + '</div>' : '') +
        (pu.verifEnviar ? '<div class="fld agv-notas"><label>Notas de la revisión (las ve SEP)</label><textarea id="agd-vnotas" rows="3" maxlength="3000" placeholder="Qué revisaste y qué encontraste…">' + e_(vf.notas || '') + '</textarea></div>'
          : (vf.notas ? '<p class="cfg-hint">Notas: ' + e_(vf.notas) + (vf.notasPor ? ' · ' + e_(vf.notasPor) : '') + '</p>' : '')) +
        '<div class="ag-acts">' +
          (pu.verifEnviar ? '<button type="button" class="btn btn-primary" data-agd="vEnviar">' + (vf.estado === 'DEVUELTA' ? 'Reenviar corregida a SEP' : 'Enviar a revisión de SEP') + '</button>' : '') +
          (pu.verifAprobar ? '<button type="button" class="btn btn-primary" data-agd="vAprobar">Aprobar verificación (SEP)</button>' : '') +
          (pu.verifDevolver ? '<button type="button" class="ag-btn" data-agd="vDevolver">Devolver a la agencia</button>' : '') +
          (pu.verifReabrir ? '<button type="button" class="ag-btn" data-agd="vReabrir">Reabrir verificación</button>' : '') +
        '</div>' +
        '<p class="cfg-hint">Primera revisión: la agencia. Segunda: SEP. Si SEP encuentra un problema, la devuelve para corregir.</p>' +
        '</section>';
    }

    /* 2. DS-2019 confirmado (solo SEP). */
    if (vf.estado === 'APROBADA' || ds.confirmado) {
      var c = ds.cobro;
      var cobro = !c ? '' : (c.estado === 'REVERSADO' ? '<span class="ag-pill off">Cobro reversado' + (c.motivo ? ' · ' + e_(c.motivo) : '') + '</span>'
        : (c.estado === 'SIN_VALOR' ? '<span class="ag-pill warn">Cobro DS-2019 · sin valor configurado</span>'
          : '<span class="ag-pill ok">Cobro DS-2019 · ' + e_(c.moneda + ' ' + c.valor) + '</span>'));
      h += '<section class="agd-sec agv"><h3>DS-2019</h3>' +
        '<div class="ag-pills">' + (ds.confirmado ? '<span class="ag-pill ok">DS-2019 confirmado · llegó a visa</span>' : '<span class="ag-pill off">Pendiente de confirmar por SEP</span>') + cobro + '</div>' +
        (ds.confirmado ? '<div class="ag-pares"><div class="ag-par"><span>Confirmado</span><b>' + e_(ds.por) + ' · ' + e_(ds.fecha) + '</b></div></div>' : '') +
        '<div class="ag-acts">' +
          (pu.ds2019 ? '<button type="button" class="btn btn-primary" data-agd="dsOk">Confirmar DS-2019</button>' : '') +
          (pu.ds2019Corregir ? '<button type="button" class="ag-btn" data-agd="dsCorregir">Corregir DS-2019</button>' : '') +
        '</div>' +
        '<p class="cfg-hint">Lo confirma solo SEP y genera una sola vez el cobro de esta temporada, aunque el documento se reemita.</p>' +
        '</section>';
    }

    /* 3. Visa y viaje (con el DS-2019 confirmado). */
    if (ds.confirmado) {
      var res = (v.resultados || []).find(function (r) { return r.k === (vi.resultado || 'PENDIENTE'); }) || { l: 'Pendiente' };
      var resCls = vi.resultado === 'APROBADA' ? 'ok' : (vi.resultado === 'NEGADA' ? 'bad' : (vi.resultado ? 'warn' : 'off'));
      h += '<section class="agd-sec agv"><h3>Visa y viaje</h3>' +
        '<div class="ag-pills"><span class="ag-pill ' + resCls + '">Resultado: ' + e_(res.l) + '</span></div>' +
        (pu.visa
          ? '<div class="form-grid agd-nota agv-visa">' +
              '<div class="fld"><label>Inicio del DS-2019</label><input id="agd-v-start" type="date" value="' + e_(vi.start || '') + '" /></div>' +
              '<div class="fld"><label>Huellas (CAS)</label><input id="agd-v-cas" type="datetime-local" value="' + e_(String(vi.cas || '').replace(' ', 'T')) + '" /></div>' +
              '<div class="fld"><label>Cita consular</label><input id="agd-v-consul" type="datetime-local" value="' + e_(String(vi.consul || '').replace(' ', 'T')) + '" /></div>' +
              '<div class="fld"><label>Resultado consular</label><select id="agd-v-res">' + (v.resultados || []).map(function (r) {
                return '<option value="' + e_(r.k) + '"' + (r.k === (vi.resultado || 'PENDIENTE') ? ' selected' : '') + '>' + e_(r.l) + '</option>'; }).join('') + '</select></div>' +
              '<div class="fld agd-nota__btn"><button type="button" class="btn btn-primary" data-agd="visa">Guardar visa</button></div>' +
            '</div>'
          : '<div class="ag-pares">' +
              '<div class="ag-par"><span>Inicio del DS-2019</span><b>' + e_(fechaHoraTxt_(vi.start) || '—') + '</b></div>' +
              '<div class="ag-par"><span>Huellas (CAS)</span><b>' + e_(fechaHoraTxt_(vi.cas) || '—') + '</b></div>' +
              '<div class="ag-par"><span>Cita consular</span><b>' + e_(fechaHoraTxt_(vi.consul) || '—') + '</b></div>' +
            '</div>') +
        (vi.resultadoPor ? '<p class="cfg-hint">Resultado registrado por ' + e_(vi.resultadoPor) + (vi.resultadoFecha ? ' · ' + e_(vi.resultadoFecha) : '') + '. No se le envían mensajes al participante.</p>' : '');
      var vu = v.vuelo;
      if (vu) {
        var vuCls = vu.estado === 'APROBADO' ? 'ok' : (vu.estado === 'RECHAZADO' ? 'bad' : (vu.estado === 'EN_REVISION' ? 'warn' : 'off'));
        h += '<div class="agv-vuelo"><div class="agv-vuelo__top"><b>Vuelo</b><span class="ag-pill ' + vuCls + '">' + e_(vu.estado === 'PENDIENTE' ? 'Sin cargar' : vu.label) + '</span></div>' +
          (vu.fechaCarga ? '<div class="ag-meta">Cargado ' + e_(vu.fechaCarga) + (vu.revisadoPor ? ' · revisado por ' + e_(vu.revisadoPor) : '') + '</div>' : '<div class="ag-meta">El participante lo carga en su portal (tarjeta «Tu vuelo»).</div>') +
          (vu.nota ? '<div class="agr-aviso warn"><b>Rechazado</b><div>' + e_(vu.nota) + '</div></div>' : '') +
          '<div class="ag-acts">' +
            (vu.url ? '<a class="ag-btn" href="' + e_(vu.url) + '" target="_blank" rel="noopener">' + IC_P.doc + '<span>Ver vuelo</span></a>' : '') +
            (pu.vueloRevisar ? '<button type="button" class="btn btn-primary" data-agd="vueloOk">Aprobar vuelo</button><button type="button" class="ag-btn" data-agd="vueloNo">Rechazar vuelo</button>' : '') +
          '</div></div>';
      }
      h += '<p class="cfg-hint">Solo un vuelo aprobado cuenta como viajero. Si tiene la visa aprobada pero no viajará, márcalo como Retirado.</p></section>';
    }

    /* 4. Estado: retiro y reintegro. */
    h += '<section class="agd-sec agv"><h3>Estado del participante</h3>' +
      '<div class="ag-pills">' + (et || '<span class="ag-pill off">En proceso</span>') + '</div>' +
      (ret.retirado ? '<div class="agr-aviso warn"><b>Retirado</b><div>' + e_(ret.motivo || '') + (ret.por ? ' · ' + e_(ret.por) + ' · ' + e_(ret.fecha) : '') + '</div></div>'
        : (ret.reintegroFecha ? '<p class="cfg-hint">Reintegrado por ' + e_(ret.reintegroPor) + ' · ' + e_(ret.reintegroFecha) + '.</p>' : '')) +
      (v.temporadaCerrada ? '<div class="agr-aviso warn"><b>Temporada cerrada</b><div>Solo un Superadmin puede reabrirla.</div></div>' : '') +
      '<div class="ag-acts">' +
        (pu.retirar ? '<button type="button" class="ag-btn" data-agd="retirar">Marcar como Retirado</button>' : '') +
        (pu.reintegrar ? '<button type="button" class="btn btn-primary" data-agd="reintegrar">Reintegrar participante</button>' : '') +
      '</div>' +
      '<p class="cfg-hint">Retirado no borra nada: conserva historial, documentos, oferta y cobros. No libera la oferta (eso lo hace SEP).</p>' +
      '</section>';
    return h;
  }

  function accionDet66_(m, btn, d, ctx, que, base, hecho) {
    var conMotivo66 = function (titulo, texto, ruta, extra, ok, aviso) {
      Swal.fire({ icon: 'warning', title: titulo, text: texto, input: 'textarea', inputLabel: 'Motivo (queda en el historial)',
        showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar',
        inputValidator: function (v) { return String(v || '').trim().length < 5 && 'Escribe el motivo (mínimo 5 caracteres).'; } }).then(function (x) {
        if (!x.isConfirmed) return;
        escudo_(btn, function () {
          return apiPost(ruta, Object.assign({ motivo: x.value }, extra, base), { avion: { titulo: aviso } }).then(function (n) { hecho(n, ok); });
        });
      });
    };
    var confirmar66 = function (titulo, texto, ruta, extra, ok, aviso) {
      Swal.fire({ icon: 'question', title: titulo, text: texto, showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar' }).then(function (x) {
        if (!x.isConfirmed) return;
        escudo_(btn, function () {
          return apiPost(ruta, Object.assign({}, extra, base), { avion: { titulo: aviso } }).then(function (n) { hecho(n, ok); });
        });
      });
    };
    var v = d.viaje || {}, vi = v.visa || {};
    if (que === 'vEnviar') {
      var notas = String((m.querySelector('#agd-vnotas') || {}).value || '').trim();
      escudo_(btn, function () {
        return apiPost('agVerif', Object.assign({ accion: 'ENVIAR', notas: notas }, base), { avion: { titulo: 'Enviando la verificación a SEP…' } })
          .then(function (n) { hecho(n, 'Enviada a SEP'); });
      });
      return true;
    }
    if (que === 'vAprobar') { confirmar66('Aprobar la verificación', 'Segunda revisión de SEP. Después se puede confirmar el DS-2019.', 'agVerif', { accion: 'APROBAR' }, 'Verificación aprobada', 'Aprobando…'); return true; }
    if (que === 'vDevolver') { conMotivo66('Devolver a la agencia', 'La agencia verá el motivo para corregir y reenviar.', 'agVerif', { accion: 'DEVOLVER' }, 'Devuelta a la agencia', 'Devolviendo…'); return true; }
    if (que === 'vReabrir') { conMotivo66('Reabrir la verificación', 'Vuelve a la agencia para corregir.', 'agVerif', { accion: 'REABRIR' }, 'Verificación reabierta', 'Reabriendo…'); return true; }
    if (que === 'dsOk') { confirmar66('Confirmar DS-2019', 'Marca que el participante llegó a visa y genera una sola vez el cobro de DS-2019 de esta temporada.', 'agDs2019', { accion: 'CONFIRMAR' }, 'DS-2019 confirmado', 'Confirmando…'); return true; }
    if (que === 'dsCorregir') { conMotivo66('Corregir DS-2019', 'Se desmarca y el cobro queda reversado con este motivo.', 'agDs2019', { accion: 'CORREGIR' }, 'DS-2019 corregido', 'Corrigiendo…'); return true; }
    if (que === 'visa') {
      var val = function (id) { return String((m.querySelector(id) || {}).value || '').trim(); };
      var start = val('#agd-v-start'), cas = val('#agd-v-cas').replace('T', ' '), con = val('#agd-v-consul').replace('T', ' '), res = val('#agd-v-res');
      var body = {};
      if (start !== (vi.start || '')) body.start = start;
      if (cas !== (vi.cas || '')) body.cas = cas;
      if (con !== (vi.consul || '')) body.consul = con;
      if (res !== (vi.resultado || 'PENDIENTE')) body.resultado = res;
      if (!Object.keys(body).length) { Swal.fire({ icon: 'info', title: 'Sin cambios', timer: 1000, showConfirmButton: false }); return true; }
      if (cas && con && cas > con) { Swal.fire({ icon: 'warning', title: 'Revisa las fechas', text: 'La cita de huellas (CAS) va antes o el mismo día que la cita consular.' }); return true; }
      var enviar = function () {
        escudo_(btn, function () {
          return apiPost('agVisa', Object.assign(body, base), { avion: { titulo: 'Guardando la visa…' } }).then(function (n) { hecho(n, 'Visa guardada'); });
        });
      };
      if (body.resultado === 'APROBADA') {
        Swal.fire({ icon: 'question', title: 'Visa aprobada', text: 'Se habilita al participante la carga de su vuelo. No se le envían mensajes.', showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar' })
          .then(function (x) { if (x.isConfirmed) enviar(); });
      } else enviar();
      return true;
    }
    if (que === 'vueloOk') { confirmar66('Aprobar el vuelo', 'Con el vuelo aprobado el participante cuenta como viajero de la temporada.', 'agDocRevisar', { doc: 'ITINERARIO', accion: 'APROBAR' }, 'Vuelo aprobado', 'Aprobando el vuelo…'); return true; }
    if (que === 'vueloNo') {
      Swal.fire({ icon: 'warning', title: 'Rechazar el vuelo', input: 'textarea', inputLabel: 'Motivo (lo ve el participante)', showCancelButton: true, confirmButtonText: 'Rechazar', cancelButtonText: 'Cancelar',
        inputValidator: function (x) { return String(x || '').trim().length < 5 && 'Escribe el motivo (mínimo 5 caracteres).'; } }).then(function (x) {
        if (!x.isConfirmed) return;
        escudo_(btn, function () {
          return apiPost('agDocRevisar', Object.assign({ doc: 'ITINERARIO', accion: 'RECHAZAR', motivo: x.value }, base), { avion: { titulo: 'Rechazando el vuelo…' } })
            .then(function (n) { hecho(n, 'Vuelo rechazado'); });
        });
      });
      return true;
    }
    if (que === 'retirar') { conMotivo66('Marcar como Retirado', 'No se borra nada ni se reversan cobros, y la oferta no se libera (eso lo hace SEP).', 'agRetiro', { accion: 'RETIRAR' }, 'Marcado como Retirado', 'Guardando…'); return true; }
    if (que === 'reintegrar') { confirmar66('Reintegrar participante', 'Continúa desde donde iba. Si SEP liberó su oferta, vuelve a escoger una.', 'agRetiro', { accion: 'REINTEGRAR' }, 'Participante reintegrado', 'Reintegrando…'); return true; }
    return false;
  }

  /* ============================================================
     FASE 6.7 · CUENTA DE COBRO SEP – SUBAGENCIA Y CIERRE DE TEMPORADA
     · Pestaña Cuentas: saldos COP y USD de cada agencia en la temporada
       elegida; vienen en agenciasInit (sin otro viaje).
     · Cuenta de una agencia: cabecera al instante (lo que ya se sabe) y
       la cuenta completa en UN viaje (agCuenta). Tras registrar,
       corregir, anular, cerrar o reabrir se pinta lo que devuelve la
       escritura (los nombres de los participantes se conservan de la
       lectura: la escritura no relee la hoja grande).
     · Monedas siempre separadas: nunca se suman COP y USD.
     ============================================================ */
  var AGC = { nombres: {}, abierta: null };
  var AGC_TIPOS = { INSCRIPCION: 'Inscripción', SPONSOR: 'Aplicada al Sponsor', DS2019: 'DS-2019', VOLUMEN: 'Volumen' };
  var AGC_EST = { VIGENTE: ['Vigente', 'ok'], SIN_VALOR: ['Sin valor configurado', 'warn'], REVERSADO: ['Reversado', 'off'], ANULADO: ['Anulado', 'off'] };

  function monedasDe_(v) {
    var m = (v && v.monedas) || {};
    var vieja = v && v.moneda;
    return {
      inscripcion: m.inscripcion || vieja || 'COP', sponsor: m.sponsor || vieja || 'USD',
      ds2019: m.ds2019 || vieja || 'USD', volumen: m.volumen || vieja || 'USD'
    };
  }
  function resumenDe_(agId, tmpId) {
    return (AGS.data && AGS.data.cuentas || []).find(function (x) { return x.agenciaId === agId && x.temporadaId === tmpId; }) || null;
  }
  /* Tras una escritura: la pestaña Cuentas queda al día sin recargar. */
  function parcharResumen_(d) {
    if (!AGS.data || !d || !d.agencia) return;
    var arr = AGS.data.cuentas = AGS.data.cuentas || [];
    var i = arr.findIndex(function (x) { return x.agenciaId === d.agencia.id && x.temporadaId === d.temporada.id; });
    var o = { agenciaId: d.agencia.id, temporadaId: d.temporada.id, COP: d.saldos.COP, USD: d.saldos.USD, sinValor: d.sinValor,
              nCargos: d.cargos.length, nPagos: d.pagos.length, cerrada: !!d.cierre.cerrada };
    if (i >= 0) arr[i] = o; else arr.push(o);
    if (AGS.tab === 'cuentas' && document.getElementById('view-agencias').classList.contains('active')) renderCuentas_();
  }
  /* Un saldo legible: pendiente, a favor o al día. */
  function saldoTxt_(s, mon) {
    if (!s) return '<span class="agc-saldo">—</span>';
    if (s.pendiente > 0) return '<span class="agc-saldo deb">Debe ' + money_(s.pendiente, mon) + '</span>';
    if (s.aFavor > 0) return '<span class="agc-saldo fav">A favor ' + money_(s.aFavor, mon) + '</span>';
    return '<span class="agc-saldo ok">' + (s.cargos > 0 ? 'Al día' : 'Sin cargos') + '</span>';
  }

  /* ---------- Pestaña Cuentas (SEP) ---------- */
  function renderCuentas_() {
    var p = $1('#ag-panel-cuentas'); var d = AGS.data; var t = tmpSel_();
    if (!p || !d) return;
    if (!t) { p.innerHTML = '<p class="muted">No hay temporadas de Summer Work and Travel.</p>'; return; }
    if (d.cuentaLista === false) { p.innerHTML = '<div class="agr-aviso warn"><b>Falta preparar la cuenta de cobro</b><div>Hay que correr migrarF67 en el editor de Apps Script.</div></div>'; return; }
    var tot = { COP: 0, USD: 0, favCOP: 0, favUSD: 0 };
    var lista = d.agencias.map(function (a) { return { a: a, r: resumenDe_(a.id, t.id) }; });
    lista.forEach(function (x) { if (!x.r) return; tot.COP += x.r.COP.pendiente; tot.USD += x.r.USD.pendiente; tot.favCOP += x.r.COP.aFavor; tot.favUSD += x.r.USD.aFavor; });
    p.innerHTML = '<div class="agc-tot"><div><span>Por cobrar COP</span><b>' + money_(tot.COP, 'COP') + '</b></div><div><span>Por cobrar USD</span><b>' + money_(tot.USD, 'USD') + '</b></div>' +
        '<div><span>Saldos a favor</span><b>' + money_(tot.favCOP, 'COP') + ' · ' + money_(tot.favUSD, 'USD') + '</b></div></div>' +
      (lista.length ? '<div class="ag-cards">' + lista.map(function (x) {
        var a = x.a, r = x.r;
        return '<article class="ag-card agc-card' + (a.estado === 'INACTIVA' ? ' is-inactive' : '') + '">' +
          '<div class="ag-card__top"><img class="ag-logo" alt="Logo de ' + e_(a.nombre) + '" src="' + e_(logo_(a)) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + LOGO_DEF + '\'" />' +
          '<div class="ag-card__info"><div class="ag-nom">' + e_(a.nombre) + '</div><div class="ag-pills">' +
            (r && r.cerrada ? '<span class="ag-pill off">' + IC.candado + ' Temporada cerrada</span>' : '<span class="ag-pill ok">Temporada abierta</span>') +
            (r && r.sinValor ? '<span class="ag-pill warn">' + r.sinValor + ' sin valor</span>' : '') + '</div></div></div>' +
          '<div class="agc-mini"><div><span>COP</span>' + saldoTxt_(r && r.COP, 'COP') + '</div><div><span>USD</span>' + saldoTxt_(r && r.USD, 'USD') + '</div></div>' +
          '<div class="ag-acts"><button class="ag-btn" data-agcta="' + e_(a.id) + '">' + IC.cuenta + '<span>' + (soloAdmin_() ? 'Cuenta y cierre' : 'Cuenta y pagos') + '</span></button></div></article>';
      }).join('') + '</div>' : '<p class="muted">Aún no hay subagencias.</p>');
    p.onclick = function (e) {
      var b = e.target.closest('[data-agcta]'); if (!b) return;
      var a = agPorId_(b.getAttribute('data-agcta'));
      abrirCuenta_({ agenciaId: a.id, temporadaId: t.id, nombre: a.nombre });
    };
  }

  /* ---------- Tarjeta "Cuenta de cobro" en Mi agencia ---------- */
  function tarjetaCuentaAg_(r) {
    var c = r && r.cuenta;
    if (!c) return '';
    return '<div class="cfg-card"><h3 class="cfg-card__title">Cuenta de cobro con SEP</h3>' +
      (c.cerrada ? '<div class="agr-aviso warn"><b>Temporada cerrada · solo lectura</b><div>No se registran participantes ni se hacen cambios. Solo SEP puede reabrirla.</div></div>' : '') +
      '<div class="agc-mini"><div><span>COP</span>' + saldoTxt_(c.COP, 'COP') + '</div><div><span>USD</span>' + saldoTxt_(c.USD, 'USD') + '</div></div>' +
      '<p class="cfg-hint">Los pagos los registra el Contador de SEP. Un saldo pendiente no detiene el proceso de tus participantes.</p>' +
      '<div class="ag-acts"><button class="btn btn-primary" data-mi-cuenta>' + IC.cuenta + ' Ver cobros, pagos y comprobantes</button></div></div>';
  }

  /* ---------- Modal de la cuenta ---------- */
  function abrirCuenta_(o) {
    var r = o.propia ? null : resumenDe_(o.agenciaId, o.temporadaId);
    var m = modal_('Cuenta de cobro · ' + (o.nombre || ''),
      '<div id="agc-cab">' + (r ? cabeceraSaldos_(r.COP, r.USD) : '') + '</div>' +
      '<div id="agc-cuerpo">' + ((window.SEPEsqueleto && SEPEsqueleto.html('texto', 4)) || '') + '</div>');
    m.classList.add('agc-modal');
    AGC.abierta = { m: m, o: o, d: null };
    cargarCuenta_(m, o, o.temporadaId);
  }
  function cargarCuenta_(m, o, tmpId) {
    var tk = sesionTk_();
    var params = o.propia ? {} : { usuarioId: currentUser.id, agenciaId: o.agenciaId };
    if (tmpId) params.temporadaId = tmpId;
    apiGet('agCuenta', params, { silent: true }).then(function (d) {
      if (!m.parentNode || sesionTk_() !== tk) return;
      (d.cargos || []).forEach(function (c) { if (c.participante) AGC.nombres[c.idReg] = c.participante; });
      pintarCuenta_(m, o, d);
    }).catch(function (e) {
      if (!m.parentNode) return;
      var c = m.querySelector('#agc-cuerpo');
      if (c) c.innerHTML = '<div class="agr-aviso err"><b>' + e_((e && e.message) || 'No se pudo cargar la cuenta') + '</b></div>';
    });
  }
  function cabeceraSaldos_(cop, usd) {
    var caja = function (s, mon) {
      return '<div class="agc-caja"><div class="agc-caja__mon">' + mon + '</div>' +
        '<div class="agc-caja__fila"><span>Cobrado</span><b>' + money_(s ? s.cargos : 0, mon) + '</b></div>' +
        '<div class="agc-caja__fila"><span>Pagado</span><b>' + money_(s ? s.pagos : 0, mon) + '</b></div>' +
        '<div class="agc-caja__saldo">' + saldoTxt_(s, mon) + '</div></div>';
    };
    return '<div class="agc-cajas">' + caja(cop, 'COP') + caja(usd, 'USD') + '</div>';
  }
  function nombreDe_(c) { return c.participante || AGC.nombres[c.idReg] || c.idReg || ''; }

  function pintarCuenta_(m, o, d) {
    AGC.abierta = { m: m, o: o, d: d };
    var cab = m.querySelector('#agc-cab'), c = m.querySelector('#agc-cuerpo');
    if (!c) return;
    var sep = !o.propia, pu = d.puede || {}, ci = d.cierre || {};
    cab.innerHTML = cabeceraSaldos_(d.saldos.COP, d.saldos.USD);
    var cargoTxt = {};
    d.cargos.forEach(function (x) { cargoTxt[x.id] = (AGC_TIPOS[x.tipo] || x.tipo) + ' · ' + nombreDe_(x); });

    var selTmp = (d.temporadas || []).length > 1
      ? '<div class="ag-temporada-sel"><label for="agc-tmp">Temporada</label><select id="agc-tmp">' + d.temporadas.map(function (t) {
          return '<option value="' + e_(t.id) + '"' + (t.id === d.temporada.id ? ' selected' : '') + '>' + e_(t.nombre) + '</option>'; }).join('') + '</select></div>'
      : '<p class="cfg-card__sub">' + e_(d.temporada.nombre) + '</p>';

    var cierre = '<section class="agd-sec"><h3>' + IC.candado + ' Cierre de la temporada</h3>' +
      (ci.cerrada
        ? '<div class="agr-aviso warn"><b>Cerrada el ' + e_(ci.fecha) + ' por ' + e_(ci.por) + '</b><div>' + e_(ci.viajeros) + ' viajeros con vuelo aprobado · mínimo ' + e_(ci.minimo) +
          '. Solo lectura para la agencia; los pagos se siguen registrando.</div></div>'
        : '<p class="cfg-hint">Abierta. Mínimo de viajeros de la temporada: <b>' + e_(d.minimo) + '</b>' +
          (d.valores ? ' · cargo por volumen ' + money_(d.valores.volumen, monedasDe_(d.valores).volumen) + ' por viajero si queda por debajo.' : '.') + '</p>' +
          (ci.reabiertaPor ? '<p class="cfg-hint">Reabierta por ' + e_(ci.reabiertaPor) + ' · ' + e_(ci.reabiertaFecha) + ' · ' + e_(ci.reabiertaMotivo) + '</p>' : '')) +
      '<div id="agc-rev"></div>' +
      '<div class="ag-acts">' +
        (pu.cerrar ? '<button class="ag-btn" data-agc="revisar">' + IC.candado + '<span>Revisar y cerrar</span></button>' : '') +
        (pu.reabrir ? '<button class="ag-btn" data-agc="reabrir">' + IC.abierto + '<span>Reabrir</span></button>' : '') +
      '</div></section>';

    var cargos = '<section class="agd-sec"><h3>Cobros (' + d.cargos.length + ')</h3>' +
      (d.sinValor ? '<div class="agr-aviso warn"><b>' + d.sinValor + ' cobro(s) sin valor configurado</b><div>Toman el valor cuando SEP guarde los valores de la agencia para esta temporada.</div></div>' : '') +
      (d.cargos.length ? '<div class="agc-lista">' + d.cargos.map(function (x) {
        var e = AGC_EST[x.estado] || [x.estado, 'off'];
        return '<div class="agc-fila' + (x.estado === 'REVERSADO' ? ' is-off' : '') + '"><div class="agc-fila__main"><b>' + e_(AGC_TIPOS[x.tipo] || x.tipo) + '</b>' +
          '<span>' + e_(nombreDe_(x)) + ' · ' + e_(x.fecha) + '</span>' + (x.motivo ? '<span>Motivo: ' + e_(x.motivo) + '</span>' : '') + '</div>' +
          '<div class="agc-fila__val"><b>' + money_(x.valor, x.moneda) + '</b>' +
          (x.estado === 'VIGENTE' && x.aplicado > 0 ? '<span>Abonado ' + money_(x.aplicado, x.moneda) + '</span>' : '') +
          '<span class="ag-pill ' + e[1] + '">' + e_(e[0]) + '</span></div></div>';
      }).join('') + '</div>' : '<p class="cfg-hint">Sin cobros todavía. Se generan solos: inscripción, Aplicada al Sponsor, DS-2019 confirmado y, al cerrar, volumen.</p>') +
      '</section>';

    var pagos = '<section class="agd-sec"><h3>Pagos y abonos (' + d.pagos.length + ')</h3>' +
      (d.pagos.length ? '<div class="agc-lista">' + d.pagos.map(function (p) {
        var e = AGC_EST[p.estado] || [p.estado, 'off'];
        return '<div class="agc-fila' + (p.estado === 'ANULADO' ? ' is-off' : '') + '"><div class="agc-fila__main"><b>' + e_(p.fechaPago) + '</b>' +
          '<span>' + e_(p.aplicaA ? 'Aplicado a ' + (cargoTxt[p.aplicaA] || p.aplicaA) : 'Abono a la cuenta') + '</span>' +
          (p.observacion ? '<span>' + e_(p.observacion) + '</span>' : '') +
          (p.corregidoPor ? '<span>' + (p.estado === 'ANULADO' ? 'Anulado' : 'Corregido') + ' por ' + e_(p.corregidoPor) + ' · ' + e_(p.fechaCorreccion) + (p.motivo ? ' · ' + e_(p.motivo) : '') + '</span>' : '') +
          (sep && (p.historial || []).length > 1 ? '<details class="agc-hist"><summary>Historial</summary>' + p.historial.map(function (h) { return '<div>' + e_(h.f) + ' · ' + e_(h.p) + ' · ' + e_(h.d) + (h.m ? ' · ' + e_(h.m) : '') + '</div>'; }).join('') + '</details>' : '') +
          '</div><div class="agc-fila__val"><b>' + money_(p.valor, p.moneda) + '</b><span class="ag-pill ' + e[1] + '">' + e_(e[0]) + '</span>' +
          '<div class="agc-fila__btns">' +
            (p.comprobante ? '<a class="ag-btn" href="' + e_(p.comprobante.url) + '" target="_blank" rel="noopener" title="' + e_(p.comprobante.nombre) + '">' + IC.recibo + '<span>Comprobante</span></a>' : '') +
            (pu.pagos && p.estado === 'VIGENTE' ? '<button class="ag-btn" data-agc="corregir" data-id="' + e_(p.id) + '">' + IC.editar + '<span>Corregir</span></button>' +
              '<button class="ag-btn" data-agc="anular" data-id="' + e_(p.id) + '"><span>Anular</span></button>' : '') +
          '</div></div></div>';
      }).join('') + '</div>' : '<p class="cfg-hint">Sin pagos registrados.</p>') +
      (pu.pagos ? '<div class="ag-acts"><button class="btn btn-primary" data-agc="pago">' + IC.pago + ' Registrar pago</button></div>' : '') +
      (o.propia ? '<p class="cfg-hint">Los comprobantes se abren con la cuenta de Google del correo de contacto que tu agencia tiene registrado en SEP.</p>' : '') +
      '</section>';

    c.innerHTML = selTmp + (sep || ci.cerrada ? cierre : '') + cargos + pagos;
    var st = c.querySelector('#agc-tmp');
    if (st) st.addEventListener('change', function () {
      c.innerHTML = (window.SEPEsqueleto && SEPEsqueleto.html('texto', 4)) || '';
      cargarCuenta_(m, o, st.value);
    });
    c.onclick = function (ev) {
      var b = ev.target.closest('[data-agc]'); if (!b) return;
      var q = b.getAttribute('data-agc');
      if (q === 'pago') modalPago_(d, null);
      else if (q === 'corregir') modalPago_(d, d.pagos.find(function (x) { return x.id === b.getAttribute('data-id'); }));
      else if (q === 'anular') anularPago_(b, d, b.getAttribute('data-id'));
      else if (q === 'revisar') revisarCierre_(b, d);
      else if (q === 'reabrir') reabrir_(b, d);
      else if (q === 'cerrar') cerrar_(b, d);
    };
  }
  /* Tras cualquier escritura: repinta la cuenta abierta y el resumen. */
  function trasEscribir_(d, msg) {
    var ab = AGC.abierta;
    if (ab && ab.m.parentNode) pintarCuenta_(ab.m, ab.o, Object.assign({}, d, { temporadas: (ab.d && ab.d.temporadas) || d.temporadas }));
    parcharResumen_(d);
    if (msg) Swal.fire({ icon: 'success', title: msg, timer: 1300, showConfirmButton: false });
  }
  function baseCuenta_(d) { return { usuarioId: currentUser.id, agenciaId: d.agencia.id, temporadaId: d.temporada.id }; }

  /* ---------- Registrar / corregir un pago ---------- */
  function hoyIso67_() { var t = new Date(); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  function isoDe_(dmy) { var x = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dmy || '')); return x ? x[3] + '-' + x[2] + '-' + x[1] : ''; }
  function leerArchivo_(file) {
    return new Promise(function (ok, ko) {
      var ext = String(file.name.split('.').pop() || '').toLowerCase();
      if (['pdf', 'jpg', 'jpeg', 'png'].indexOf(ext) < 0) { ko(new Error('El comprobante debe ser PDF, JPG o PNG')); return; }
      if (file.size > 8 * 1024 * 1024) { ko(new Error('El comprobante pesa más de 8 MB')); return; }
      var fr = new FileReader();
      fr.onerror = function () { ko(new Error('No se pudo leer el archivo')); };
      fr.onload = function () { ok({ filename: file.name, mime: file.type, base64: String(fr.result).split(',')[1] }); };
      fr.readAsDataURL(file);
    });
  }
  function modalPago_(d, p) {
    var nuevo = !p;
    var opciones = function (mon, sel) {
      return '<option value="">Abono a la cuenta (saldo de ' + mon + ')</option>' + d.cargos.filter(function (x) {
        return x.moneda === mon && ((x.estado === 'VIGENTE' && x.pendiente > 0) || x.id === sel);
      }).map(function (x) {
        return '<option value="' + e_(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + e_((AGC_TIPOS[x.tipo] || x.tipo) + ' · ' + nombreDe_(x) + ' · pendiente ' + money_(x.pendiente, x.moneda)) + '</option>';
      }).join('');
    };
    var mon0 = p ? p.moneda : 'COP';
    var m = modal_(nuevo ? 'Registrar pago' : 'Corregir pago ' + p.id,
      '<p class="cfg-card__sub">' + e_(d.agencia.nombre) + ' · ' + e_(d.temporada.nombre) + '. COP y USD van por separado, sin conversión.</p>' +
      '<div class="form-grid">' +
        '<div class="fld"><label for="agp-fecha">Fecha del pago</label><input id="agp-fecha" type="date" max="' + hoyIso67_() + '" value="' + e_(p ? isoDe_(p.fechaPago) : hoyIso67_()) + '" /></div>' +
        '<div class="fld"><label for="agp-mon">Moneda</label><select id="agp-mon"><option' + (mon0 === 'COP' ? ' selected' : '') + '>COP</option><option' + (mon0 === 'USD' ? ' selected' : '') + '>USD</option></select></div>' +
        '<div class="fld"><label for="agp-valor">Valor</label><input id="agp-valor" type="number" min="0" step="any" inputmode="decimal" value="' + e_(p ? p.valor : '') + '" /></div>' +
        '<div class="fld"><label for="agp-aplica">Se aplica a</label><select id="agp-aplica">' + opciones(mon0, p ? p.aplicaA : '') + '</select></div>' +
        '<div class="fld fld-full"><label for="agp-obs">Observación</label><textarea id="agp-obs" rows="2" maxlength="500">' + e_(p ? p.observacion : '') + '</textarea></div>' +
        '<div class="fld fld-full"><label for="agp-file">Comprobante (PDF, JPG o PNG · máx. 8 MB)' + (nuevo ? '' : ' — solo si lo reemplazas') + '</label><input id="agp-file" type="file" accept="application/pdf,image/jpeg,image/png" /></div>' +
        (nuevo ? '' : '<div class="fld fld-full"><label for="agp-motivo">Motivo de la corrección</label><input id="agp-motivo" type="text" maxlength="300" placeholder="Ej. valor mal digitado" /></div>') +
      '</div><div id="agp-aviso" class="agr-aviso hidden" role="alert"></div>',
      '<button class="btn btn-ghost" data-x>Cancelar</button><button class="btn btn-primary" id="agp-ok">' + (nuevo ? 'Registrar pago' : 'Guardar corrección') + '</button>');
    m.querySelector('[data-x]').addEventListener('click', m.cerrar);
    m.querySelector('#agp-mon').addEventListener('change', function () { m.querySelector('#agp-aplica').innerHTML = opciones(this.value, ''); });
    var aviso = function (t) { var a = m.querySelector('#agp-aviso'); a.className = 'agr-aviso err'; a.innerHTML = '<b>' + e_(t) + '</b>'; };
    m.querySelector('#agp-ok').addEventListener('click', function () {
      var btn = this;
      var f = m.querySelector('#agp-file').files[0];
      var body = Object.assign({}, nuevo ? baseCuenta_(d) : { usuarioId: currentUser.id, id: p.id, accion: 'CORREGIR', motivo: m.querySelector('#agp-motivo').value.trim() }, {
        fechaPago: m.querySelector('#agp-fecha').value, moneda: m.querySelector('#agp-mon').value,
        valor: m.querySelector('#agp-valor').value, aplicaA: m.querySelector('#agp-aplica').value,
        observacion: m.querySelector('#agp-obs').value.trim()
      });
      if (!body.fechaPago) { aviso('Escribe la fecha del pago'); return; }
      if (!(Number(body.valor) > 0)) { aviso('Escribe un valor mayor que cero'); return; }
      if (nuevo && !f) { aviso('Adjunta el comprobante del pago'); return; }
      if (!nuevo && body.motivo.length < 5) { aviso('Escribe el motivo de la corrección (mínimo 5 caracteres)'); return; }
      escudo_(btn, function () {
        return (f ? leerArchivo_(f) : Promise.resolve(null)).then(function (comp) {
          if (comp) body.comprobante = comp;
          return apiPost(nuevo ? 'agPago' : 'agPagoCorregir', body, { avion: { titulo: nuevo ? 'Registrando el pago…' : 'Guardando la corrección…' } });
        }).then(function (r) {
          m.cerrar();
          trasEscribir_(r, nuevo ? 'Pago registrado' : 'Pago corregido');
        }).catch(function (e) { aviso((e && e.message) || 'No se pudo guardar'); });
      });
    });
  }
  function anularPago_(btn, d, id) {
    Swal.fire({ icon: 'warning', title: 'Anular el pago ' + id, text: 'Queda en la cuenta como anulado, con su motivo y el historial.', input: 'text', inputLabel: 'Motivo',
      showCancelButton: true, confirmButtonText: 'Anular', cancelButtonText: 'Cancelar',
      inputValidator: function (x) { return String(x || '').trim().length < 5 && 'Escribe el motivo (mínimo 5 caracteres).'; } }).then(function (x) {
      if (!x.isConfirmed) return;
      escudo_(btn, function () {
        return apiPost('agPagoCorregir', { usuarioId: currentUser.id, id: id, accion: 'ANULAR', motivo: x.value.trim() }, { avion: { titulo: 'Anulando el pago…' } })
          .then(function (r) { trasEscribir_(r, 'Pago anulado'); });
      });
    });
  }

  /* ---------- Cierre y reapertura (Superusuario) ---------- */
  function revisarCierre_(btn, d) {
    var box = AGC.abierta.m.querySelector('#agc-rev');
    box.innerHTML = (window.SEPEsqueleto && SEPEsqueleto.html('texto', 3)) || '';
    escudo_(btn, function () {
      return apiGet('agCierreRevisar', baseCuenta_(d), { silent: true }).then(function (rv) { pintarRevision_(box, rv, d); });
    });
  }
  function pintarRevision_(box, rv, d) {
    var vol = rv.volumen || {};
    box.innerHTML = '<div class="agc-rev">' +
      '<div class="ag-pares"><div class="ag-par"><span>Inscritos</span><b>' + rv.total + '</b></div><div class="ag-par"><span>Viajeros (vuelo aprobado)</span><b>' + rv.nViajeros + '</b></div>' +
        '<div class="ag-par"><span>Mínimo</span><b>' + rv.minimo + '</b></div><div class="ag-par"><span>Retirados</span><b>' + rv.retirados + '</b></div></div>' +
      (vol.aplica ? '<div class="agr-aviso warn"><b>Queda por debajo del mínimo</b><div>Al cerrar se cobra el volumen a cada viajero: ' + vol.cargos + ' × ' + money_(vol.valor, vol.moneda) + ' = ' + money_(vol.total, vol.moneda) + '.</div></div>'
        : '<div class="agr-aviso ok"><b>Sin cargo por volumen</b><div>' + (rv.nViajeros >= rv.minimo ? 'Alcanza el mínimo de viajeros.' : 'No hay viajeros con vuelo aprobado.') + '</div></div>') +
      (rv.bloquean.length ? '<div class="agr-aviso err"><b>' + rv.bloquean.length + ' participante(s) impiden cerrar</b></div><div class="agc-lista">' + rv.bloquean.map(function (b) {
          return '<div class="agc-fila"><div class="agc-fila__main"><b>' + e_(b.nombre) + '</b><span>' + e_(b.motivo) + '</span></div><div class="agc-fila__val"><span class="ag-pill warn">' + e_(b.etapa) + '</span></div></div>';
        }).join('') + '</div>'
        : '<div class="ag-acts"><button class="btn btn-primary" data-agc="cerrar">' + IC.candado + ' Cerrar la temporada</button></div>') +
      '</div>';
  }
  function cerrar_(btn, d) {
    Swal.fire({ icon: 'question', title: 'Cerrar ' + d.temporada.nombre, text: 'La agencia queda en solo lectura (sin registros ni cambios). El Contador sigue registrando pagos. Solo un Superadmin puede reabrirla.',
      showCancelButton: true, confirmButtonText: 'Cerrar temporada', cancelButtonText: 'Cancelar' }).then(function (x) {
      if (!x.isConfirmed) return;
      escudo_(btn, function () {
        return apiPost('agCierre', Object.assign({ accion: 'CERRAR' }, baseCuenta_(d)), { avion: { titulo: 'Cerrando la temporada…' } }).then(function (r) {
          if (r.bloqueada) { pintarRevision_(AGC.abierta.m.querySelector('#agc-rev'), r.revision, d); Swal.fire({ icon: 'warning', title: 'Todavía no se puede cerrar', text: 'Algo cambió mientras revisabas: mira la lista.' }); return; }
          var v = r.volumenAplicado || {};
          trasEscribir_(r, 'Temporada cerrada' + (v.creados ? ' · ' + v.creados + ' cargo(s) por volumen' : '') + (v.reversados ? ' · ' + v.reversados + ' reversado(s)' : ''));
        });
      });
    });
  }
  function reabrir_(btn, d) {
    Swal.fire({ icon: 'warning', title: 'Reabrir ' + d.temporada.nombre, text: 'La agencia vuelve a operar. Al cerrar de nuevo, el cargo por volumen se recalcula.', input: 'text', inputLabel: 'Motivo',
      showCancelButton: true, confirmButtonText: 'Reabrir', cancelButtonText: 'Cancelar',
      inputValidator: function (x) { return String(x || '').trim().length < 5 && 'Escribe el motivo (mínimo 5 caracteres).'; } }).then(function (x) {
      if (!x.isConfirmed) return;
      escudo_(btn, function () {
        return apiPost('agCierre', Object.assign({ accion: 'REABRIR', motivo: x.value.trim() }, baseCuenta_(d)), { avion: { titulo: 'Reabriendo la temporada…' } })
          .then(function (r) { trasEscribir_(r, 'Temporada reabierta'); });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', bindLogin_);
  if (document.readyState !== 'loading') bindLogin_();
})();
