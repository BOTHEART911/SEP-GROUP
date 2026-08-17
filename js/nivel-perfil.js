/* ============================================================
 * SEP GROUP — PERFIL DEL ESTUDIANTE (Fase 3 SEP · Entrega 5 · 17/08/2026)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula
 * la garantía de funcionamiento.
 * ------------------------------------------------------------
 * QUÉ ES
 *   La segunda mitad de la vista "Nivel de Inglés": todo lo que pasa
 *   DESPUÉS del Puntaje SEA. Va en su propio archivo para que
 *   js/nivel.js siga siendo la pantalla del puntaje y nada más.
 *
 *   · Ver HV        abre la hoja de vida en PDF sin salir de la app,
 *                   con Descargar, Abrir y Copiar enlace.
 *   · Aprobar       crea la hoja de vida y le reenvía al estudiante el
 *                   mensaje de las ofertas de empleo.
 *   · Regenerar HV  rehace el PDF en el MISMO enlace (de la hoja de
 *                   vida anterior no queda copia).
 *   · Ver formulario  muestra sus 14 bloques en SOLO LECTURA.
 *   · Reabrir       le devuelve al estudiante los bloques que tiene
 *                   que corregir, con un motivo que le llega por
 *                   WhatsApp y correo. Desmarca el check Aprobado.
 *
 * CÓMO SE CONECTA
 *   js/nivel.js llama a NPERFIL; NPERFIL no llama a nadie de vuelta
 *   salvo a cerrarModalNivel_() y recargarNivel_(true), que son las
 *   dos cosas que hay que hacer cuando algo cambió de verdad.
 *
 * Usa de app.js: apiPost, currentUser, esc_. Y de js/nivel.js:
 *   cerrarModalNivel_, recargarNivel_.
 *
 * OJO con los repintados: los cuerpos de los modales se reescriben
 * enteros con innerHTML y el cableado va SIEMPRE después, sobre los
 * elementos recién creados. Lo único que se cablea una sola vez (en
 * DOMContentLoaded) son los botones fijos del HTML.
 * ============================================================ */

var NPERFIL = (function () {
  'use strict';

  /* Estado del "Ver formulario" (#modal-nform). */
  var F = { r: null, data: null, sel: {} };
  /* Estado de la reapertura corta (#modal-nreab). */
  var R = { r: null, data: null, sel: {}, resolver: null };
  /* Lo que hay ahora en el visor, para el botón Copiar enlace. */
  var V = { url: '' };

  var MOTIVO_MAX = 600;

  /* ============================================================
     AYUDAS
     ============================================================ */
  function q(sel) { return document.querySelector(sel); }
  function txt_(v) { return String(v === null || v === undefined ? '' : v).trim(); }
  function esc(v) { return (typeof esc_ === 'function') ? esc_(v) : txt_(v); }

  /* Comparación tolerante: la hoja guarda "Si", el pliego escribe
     "Sí" y una migración vieja pudo dejar "SI". Todo es lo mismo. */
  function norm_(v) { return txt_(v).toUpperCase().replace(/Í/g, 'I'); }

  function siNo_(v) {
    var s = norm_(v);
    if (s === 'SI' || s === 'TRUE' || s === 'X' || s === '1') return 'Sí';
    if (s === 'NO' || s === 'FALSE' || s === '0') return 'No';
    return '';
  }

  /* El identificador de un archivo de Drive, igual que en el visor de
     la vista Contador. */
  function driveId_(url) {
    var m = String(url || '').match(/[-\w]{25,}/);
    return m ? m[0] : '';
  }

  function canalTexto_(c) {
    var s = norm_(c);
    if (s === 'EMAIL' || s === 'CORREO') return 'correo';
    if (s === 'WHATSAPP') return 'WhatsApp';
    return 'correo y WhatsApp';
  }

  function nombreDe_(r) { return txt_(r && (r.nombres + ' ' + r.apellidos)); }

  function cuerpoApi_(r) {
    return { usuarioId: currentUser.id, n: r.n, documento: r.documento };
  }

  function refrescarLista_() {
    if (typeof cerrarModalNivel_ === 'function') cerrarModalNivel_();
    if (typeof recargarNivel_ === 'function') return recargarNivel_(true);
    return Promise.resolve();
  }

  /* ============================================================
     VISOR DE LA HOJA DE VIDA (#nive-visor)
     ============================================================
     Mismo patrón que el visor de la vista Contador: el PDF se ve
     dentro de la app, y quien lo necesite fuera tiene Descargar,
     Abrir y Copiar enlace. */
  function abrirVisor_(url, titulo) {
    var visor = q('#nive-visor'); if (!visor) return;
    var id = driveId_(url);
    V.url = txt_(url);

    q('#nive-visor-title').textContent = titulo || 'Documento';
    q('#nive-visor-frame').src = id ? ('https://drive.google.com/file/d/' + id + '/preview') : V.url;
    var abrir = q('#nive-visor-abrir'); if (abrir) abrir.href = V.url;
    var bajar = q('#nive-visor-bajar');
    if (bajar) bajar.href = id ? ('https://drive.google.com/uc?export=download&id=' + id) : V.url;

    visor.classList.remove('hidden');
  }

  function cerrarVisor_() {
    q('#nive-visor')?.classList.add('hidden');
    var f = q('#nive-visor-frame'); if (f) f.src = 'about:blank';
  }

  /* Copiar con respaldo: sin HTTPS o sin permiso, navigator.clipboard
     no existe y hay que pasar por un campo temporal. */
  async function copiarEnlace_() {
    var url = V.url;
    if (!url) return;
    var ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch (e) {
      try {
        var tmp = document.createElement('input');
        tmp.value = url;
        tmp.setAttribute('readonly', '');
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        ok = document.execCommand('copy');
        document.body.removeChild(tmp);
      } catch (e2) { ok = false; }
    }
    if (ok) {
      Swal.fire({
        toast: true, position: 'top', icon: 'success',
        title: 'Enlace copiado', showConfirmButton: false, timer: 1400
      });
    } else {
      Swal.fire({ icon: 'info', title: 'Copia el enlace a mano', input: 'text', inputValue: url });
    }
  }

  /* ============================================================
     1. VER LA HOJA DE VIDA
     ============================================================ */
  function verHv(r) {
    if (!r || !txt_(r.hvUrl)) {
      Swal.fire({
        icon: 'info', title: 'Todavía no hay hoja de vida',
        html: 'La hoja de vida se crea al marcar <b>Aprobado</b>, con lo que el estudiante llenó en su formulario y con su foto.'
      });
      return;
    }
    abrirVisor_(r.hvUrl, 'Hoja de vida · ' + nombreDe_(r));
  }

  /* ============================================================
     2. APROBAR EL PERFIL
     ============================================================
     La confirmación la hace quien llama (el check de js/nivel.js):
     aquí solo se ejecuta y se cuenta cómo salió. Devuelve true si el
     perfil quedó aprobado. */
  async function aprobar(r) {
    if (!r) return false;
    try {
      var out = await apiPost('nivelAprobar', cuerpoApi_(r));
      var aviso = out.aviso || {};
      var faltan = aviso.faltan || [];
      var avisos = out.avisos || [];

      var html = '<div class="nive-conf">';
      html += '<div class="nive-conf__q"><b>' + esc(nombreDe_(r)) + '</b> · N° ' + esc(r.n) + '</div>';
      html += '<div class="nive-conf__d">Su hoja de vida quedó de <b>' +
              (Number(out.paginas) === 2 ? '2 páginas' : '1 página') + '</b>' +
              (out.regenerada ? ' y reemplazó a la anterior en el mismo enlace' : '') + '.</div>';

      if (aviso.enviado) {
        html += '<div class="nive-conf__d">El mensaje de las <b>ofertas de empleo</b> salió por <b>' +
                esc(canalTexto_(aviso.canal)) + '</b>.</div>';
      } else {
        html += '<div class="nive-conf__re">El mensaje de las ofertas <b>no salió</b>: ' +
                esc(aviso.motivo || 'sin motivo') + '</div>';
      }
      if (out.reaprobado) {
        html += '<div class="nive-conf__d"><small>Ya estaba aprobado antes: se le volvió a enviar el mensaje.</small></div>';
      }
      if (faltan.length) {
        html += '<div class="nive-aviso-amarillo">⚠️ El mensaje salió con el enlace en blanco porque falta <b>' +
                faltan.map(esc).join('</b> / <b>') +
                '</b> en Configuración → Programas → Summer.</div>';
      }
      if (avisos.length) {
        html += '<ul class="nive-avisos">' +
                avisos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>';
      }
      html += '</div>';

      await refrescarLista_();
      Swal.fire({
        icon: (faltan.length || avisos.length || !aviso.enviado) ? 'warning' : 'success',
        title: out.reaprobado ? 'Perfil vuelto a aprobar' : 'Perfil aprobado',
        html: html
      });
      return true;

    } catch (e) {
      /* El backend frena la aprobación cuando el formulario no está
         terminado y dice exactamente qué falta: ese texto se muestra
         tal cual, y de ahí se puede saltar al formulario. */
      var res = await Swal.fire({
        icon: 'error', title: 'No se pudo aprobar',
        html: '<div style="text-align:left">' + esc(e && e.message ? e.message : e) + '</div>',
        showCancelButton: true,
        confirmButtonText: '📝 Ver formulario',
        cancelButtonText: 'Cerrar'
      });
      if (res.isConfirmed) abrirFormulario(r);
      return false;
    }
  }

  /* ============================================================
     3. REGENERAR LA HOJA DE VIDA
     ============================================================ */
  async function regenerar(r) {
    if (!r) return false;
    if (!txt_(r.hvUrl)) {
      Swal.fire({
        icon: 'info', title: 'Todavía no hay hoja de vida',
        text: 'Primero marca Aprobado: ahí se crea.'
      });
      return false;
    }
    var conf = await Swal.fire({
      icon: 'question', title: '¿Rehacer la hoja de vida?',
      html: '<div class="nive-conf"><div class="nive-conf__q"><b>' + esc(nombreDe_(r)) + '</b> · N° ' + esc(r.n) + '</div>' +
            '<div class="nive-conf__d">Se vuelve a armar con lo que hay hoy en su formulario y con su foto actual.</div>' +
            '<div class="nive-conf__re">El <b>enlace no cambia</b>: la hoja de vida anterior se reemplaza y <b>no queda copia</b> de ella.</div></div>',
      showCancelButton: true,
      confirmButtonText: 'Sí, rehacerla',
      cancelButtonText: 'Cancelar',
      focusCancel: true
    });
    if (!conf.isConfirmed) return false;

    try {
      var out = await apiPost('nivelRegenerarHv', cuerpoApi_(r));
      var avisos = out.avisos || [];
      var html = '<div class="nive-conf">';
      html += '<div class="nive-conf__d">Quedó de <b>' +
              (Number(out.paginas) === 2 ? '2 páginas' : '1 página') + '</b>' +
              (out.mismaUrl ? ' en el <b>mismo enlace</b> de siempre' : '') + '.</div>';
      if (avisos.length) {
        html += '<ul class="nive-avisos">' +
                avisos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>';
      }
      html += '</div>';

      await refrescarLista_();
      Swal.fire({
        icon: avisos.length ? 'warning' : 'success',
        title: 'Hoja de vida rehecha', html: html
      });
      return true;
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'No se pudo rehacer', text: String(e && e.message ? e.message : e) });
      return false;
    }
  }

  /* ============================================================
     4. VER EL FORMULARIO (solo lectura)
     ============================================================ */
  async function abrirFormulario(r) {
    if (!r) return;
    var d;
    try {
      d = await apiPost('nivelFormulario', cuerpoApi_(r));
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'No se pudo abrir el formulario', text: String(e && e.message ? e.message : e) });
      return;
    }
    F.r = r; F.data = d; F.sel = {};
    pintarFormulario_();
    q('#modal-nform')?.classList.remove('hidden');
  }

  function cerrarFormulario_() { q('#modal-nform')?.classList.add('hidden'); }

  function pintarFormulario_() {
    var d = F.data;
    if (!d) return;
    var e = d.estudiante || {};

    q('#nform-title').textContent =
      'Formulario · ' + txt_(e.nombres + ' ' + e.apellidos) + ' · N° ' + txt_(e.n);

    q('#nform-sub').innerHTML =
      '<span class="nfm-pill ' + (d.terminado ? 'ok' : 'prog') + '">' +
        (d.terminado ? '✅ Formulario terminado' : '⏳ Formulario sin terminar') + '</span>' +
      '<span class="nfm-pill">' + esc(d.completados) + ' de ' + esc(d.total) + ' bloques</span>' +
      (e.aprobado ? '<span class="nfm-pill ok">✅ Perfil aprobado</span>' : '') +
      (nfmReabiertos_(d).length
        ? '<span class="nfm-pill reab">↩️ ' + (nfmReabiertos_(d).length === 1
            ? '1 bloque reabierto' : nfmReabiertos_(d).length + ' bloques reabiertos') + '</span>'
        : '');

    var body = q('#nform-body');
    body.innerHTML = cabeceraHtml_(d) + (d.bloques || []).map(function (b) {
      return bloqueHtml_(b, d);
    }).join('');

    q('#nform-foot').innerHTML = pieHtml_(d);

    /* Cableado (elementos recién creados: no hay escuchas repetidas). */
    body.querySelectorAll('[data-arch]').forEach(function (b) {
      b.addEventListener('click', function () {
        abrirVisor_(b.dataset.arch, b.dataset.archT || 'Documento');
      });
    });
    body.querySelectorAll('[data-reab]').forEach(function (c) {
      c.addEventListener('change', function () {
        var n = Number(c.dataset.reab);
        if (c.checked) F.sel[n] = true; else delete F.sel[n];
        c.closest('.nfm-bloque')?.classList.toggle('is-sel', !!c.checked);
        refrescarPie_();
      });
    });

    var motivo = q('#nfm-motivo');
    if (motivo) motivo.addEventListener('input', refrescarPie_);
    q('#nfm-reabrir')?.addEventListener('click', function () {
      lanzarReapertura_(F.r, seleccionados_(F.sel), txt_(q('#nfm-motivo')?.value), 'nform');
    });
    refrescarPie_();
  }

  /* Los bloques reabiertos, SIEMPRE como arreglo. El backend manda
     'bloquesReabiertos' (arreglo con los números de bloque) y
     'reabiertos' (cuántos son). Confundirlos deja la píldora sin
     pintar, porque un número no tiene .length. */
  function nfmReabiertos_(d) {
    if (Array.isArray(d && d.bloquesReabiertos)) return d.bloquesReabiertos;
    if (Array.isArray(d && d.reabiertos)) return d.reabiertos;
    return [];
  }

  function cabeceraHtml_(d) {
    var e = d.estudiante || {};
    var lineas = '';
    if (d.motivoNoAprobar) {
      lineas += '<div class="nfm-nota nfm-nota--warn">⚠️ Todavía no se puede aprobar: ' + esc(d.motivoNoAprobar) + '</div>';
    } else if (d.puedeAprobar && !e.aprobado) {
      lineas += '<div class="nfm-nota nfm-nota--ok">✅ El formulario está completo: ya se le puede marcar <b>Aprobado</b>.</div>';
    }
    if ((d.docsPendientes || []).length) {
      lineas += '<div class="nfm-nota nfm-nota--warn">📎 Documentos por subir: <b>' +
                d.docsPendientes.map(esc).join('</b>, <b>') + '</b>.</div>';
    }
    return '<div class="nfm-cab">' +
      '<div class="nfm-cab__datos">' +
        '<div><span>Estudiante</span><b>' + esc(txt_(e.nombres + ' ' + e.apellidos) || '—') + '</b></div>' +
        '<div><span>Documento</span><b>' + esc(e.documento || '—') + '</b></div>' +
        '<div><span>Nivel</span><b>' + esc(e.nivel || '—') + '</b></div>' +
        '<div><span>Puntaje SEA</span><b>' + esc(e.puntaje === '' || e.puntaje == null ? '—' : e.puntaje) + '</b></div>' +
        '<div class="full"><span>Resumen</span><b>' + esc(d.resumen || '—') + '</b></div>' +
      '</div>' + lineas + '</div>';
  }

  /* ── Un bloque ─────────────────────────────────────────────
     El bloque se pinta cerrado; la casilla para reabrirlo va en una
     franja debajo del propio bloque y NO dentro del resumen: metida
     en el <summary>, tocarla abriría y cerraría el bloque entero. */
  function bloqueHtml_(b, d) {
    var p = pastilla_(b);
    var campos = (b.campos || []).filter(function (c) { return visible_(c, b.valores); });

    var grupo = '';
    var cuerpo = campos.map(function (c) {
      var cab = '';
      if (c.grl && c.gr !== grupo) { grupo = c.gr; cab = '<div class="nfm-grupo">' + esc(c.grl) + '</div>'; }
      else if (!c.gr) { grupo = ''; }
      return cab + campoHtml_(c, b);
    }).join('');

    var extras = '';
    if (b.aviso) extras += '<div class="nfm-aviso">' + esc(b.aviso) + '</div>';
    if (b.intro) extras += '<div class="nfm-aviso">' + esc(introTexto_(b.intro, d)) + '</div>';
    if (b.reabierto && b.motivoReapertura) {
      extras += '<div class="nfm-nota nfm-nota--reab">↩️ <b>Devuelto para corregir:</b> ' + esc(b.motivoReapertura) +
                (b.reabiertoPor ? ' <small>(' + esc(b.reabiertoPor) + ')</small>' : '') + '</div>';
    }
    if ((b.docsPendientes || []).length) {
      extras += '<div class="nfm-nota nfm-nota--warn">📎 Le faltan por subir: <b>' +
                b.docsPendientes.map(esc).join('</b>, <b>') + '</b>.</div>';
    }

    var pick = '';
    if (b.reabrible) {
      var puede = !!(d.estudiante && d.estudiante.aprobado);
      pick = '<label class="nfm-pick' + (puede ? '' : ' off') + '">' +
        '<input type="checkbox" data-reab="' + esc(b.n) + '"' + (puede ? '' : ' disabled title="Solo se pueden reabrir bloques de un perfil ya aprobado"') + ' />' +
        '<span>Reabrir este bloque para que lo corrija</span></label>';
    }

    return '<div class="nfm-bloque" data-bloque="' + esc(b.n) + '">' +
      '<details class="conta-bloque">' +
        '<summary>' + esc(b.icono || '•') + ' ' + esc(b.n) + '. ' + esc(b.titulo) +
          ' <span class="nfm-pill ' + p.cls + '">' + p.txt + '</span>' +
          (b.fecha ? ' <span class="nfm-fecha">🕒 ' + esc(b.fecha) + '</span>' : '') +
        '</summary>' +
        '<div class="nfm-campos">' + extras + (cuerpo || '<div class="nfm-v vacio">— este bloque no tiene nada escrito —</div>') + '</div>' +
      '</details>' + pick + '</div>';
  }

  /* El bloque 13 trae el nombre del estudiante en llaves. */
  function introTexto_(intro, d) {
    var pre = (d && d.precargados) || {};
    return txt_(intro).replace(/\{(\w+)\}/g, function (todo, k) {
      return (pre[k] === undefined || pre[k] === null) ? todo : txt_(pre[k]);
    });
  }

  function pastilla_(b) {
    var e = norm_(b.estadoVista || b.estado);
    if (e === 'COMPLETADO')  return { cls: 'ok',   txt: 'Completado 🔒' };
    if (e === 'REABIERTO')   return { cls: 'reab', txt: 'Reabierto ↩️' };
    if (e === 'EN_PROGRESO') return { cls: 'prog', txt: 'En progreso' };
    return { cls: 'pend', txt: 'Pendiente' };
  }

  /* ── Campos en solo lectura ────────────────────────────────
     Un campo condicionado que hoy no aplica no se pinta (el
     estudiante nunca lo respondió). Lo que sí aplica y está vacío se
     pinta con una raya gris: esconderlo sería tapar un hueco. */
  function visible_(c, valores) {
    if (!c || !c.ver) return true;
    return norm_((valores || {})[c.ver.k]) === norm_(c.ver.v);
  }

  function campoHtml_(c, b) {
    var v = (b.valores || {})[c.k];
    var cuerpo, ancho = '';
    switch (c.t) {
      case 'sino':    cuerpo = valorHtml_(siNo_(v)); break;
      /* Una casilla de autorización sin marcar es un "No", no un dato
         en blanco: el estudiante pasó por ahí y no la aceptó. */
      case 'check':   cuerpo = '<span class="nfm-v">' + (siNo_(v) === 'Sí' ? 'Sí' : 'No') + '</span>'; ancho = ' full'; break;
      case 'chips':   cuerpo = chipsHtml_(v); ancho = ' full'; break;
      case 'lista':   cuerpo = listaHtml_(c, v); ancho = ' full'; break;
      case 'archivo': cuerpo = archivoHtml_(c, v); break;
      case 'textarea':cuerpo = valorHtml_(v); ancho = ' full'; break;
      default:        cuerpo = valorHtml_(v);
    }
    return '<div class="nfm-campo' + ancho + '">' +
      '<span class="nfm-l">' + esc(c.l || c.k) + '</span>' + cuerpo + '</div>';
  }

  function valorHtml_(v) {
    var s = txt_(v);
    return s ? '<span class="nfm-v">' + esc(s) + '</span>'
             : '<span class="nfm-v vacio">—</span>';
  }

  /* Los "chips" llegan como arreglo desde el backend; si algún día
     llegaran como texto separado por comas, se leen igual. */
  function aChips_(v) {
    if (Array.isArray(v)) return v.map(txt_).filter(Boolean);
    var s = txt_(v);
    return s ? s.split(',').map(txt_).filter(Boolean) : [];
  }
  function chipsHtml_(v) {
    var lista = aChips_(v);
    if (!lista.length) return '<span class="nfm-v vacio">—</span>';
    return '<div class="nfm-chips">' + lista.map(function (x) {
      return '<span class="nfm-chip">' + esc(x) + '</span>';
    }).join('') + '</div>';
  }

  /* Las listas repetibles se guardan como texto JSON; el backend las
     entrega ya convertidas en arreglo. Se admiten las dos formas. */
  function aFilas_(v) {
    if (Array.isArray(v)) return v;
    var s = txt_(v);
    if (!s) return [];
    try { var f = JSON.parse(s); return Array.isArray(f) ? f : []; } catch (e) { return []; }
  }
  function listaHtml_(c, v) {
    var subs = c.sub || [];
    var filas = aFilas_(v);
    if (!filas.length || !subs.length) return '<div class="nfm-v vacio">— sin registros —</div>';
    var cab = subs.map(function (s) { return '<th>' + esc(s.l || s.k) + '</th>'; }).join('');
    var cuerpo = filas.map(function (f) {
      return '<tr>' + subs.map(function (s) {
        var x = f ? f[s.k] : '';
        var t = (s.t === 'sino' || s.t === 'check') ? siNo_(x) : txt_(x);
        return '<td>' + (t ? esc(t) : '<span class="vacio">—</span>') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="nfm-tabla-wrap"><table class="nfm-tabla">' +
      '<thead><tr>' + cab + '</tr></thead><tbody>' + cuerpo + '</tbody></table></div>';
  }

  function archivoHtml_(c, v) {
    var u = txt_(v);
    if (!u) return '<span class="nfm-v vacio">— sin cargar —</span>';
    return '<button type="button" class="btn btn-ghost nfm-ver" data-arch="' + esc(u) +
      '" data-arch-t="' + esc(c.l || 'Documento') + '">👁️ Ver</button>';
  }

  /* ── Pie de reapertura del "Ver formulario" ────────────────── */
  function pieHtml_(d) {
    var aprobado = !!(d.estudiante && d.estudiante.aprobado);
    if (!aprobado) {
      return '<div class="nfm-pie nfm-pie--off">' +
        '<small class="conta-hint">Solo se pueden reabrir bloques de un perfil ya aprobado.</small>' +
        '<button type="button" class="btn btn-primary" disabled>↩️ Reabrir los bloques seleccionados</button>' +
        '</div>';
    }
    return '<div class="nfm-pie">' +
      '<div class="nfm-pie__sel"><b id="nfm-cuenta">0</b> <span id="nfm-cuenta-t">bloques seleccionados</span></div>' +
      '<label for="nfm-motivo">Motivo (esto es lo que le llega al estudiante por WhatsApp y correo)</label>' +
      '<textarea id="nfm-motivo" rows="3" maxlength="' + MOTIVO_MAX + '" ' +
        'placeholder="Ej.: en Experiencia laboral faltan las funciones del último trabajo."></textarea>' +
      '<div class="nfm-chars"><span id="nfm-chars">0</span> / ' + MOTIVO_MAX + '</div>' +
      '<button type="button" id="nfm-reabrir" class="btn btn-primary" disabled>↩️ Reabrir los bloques seleccionados</button>' +
      '</div>';
  }

  function seleccionados_(mapa) {
    return Object.keys(mapa || {}).map(Number).filter(Boolean).sort(function (a, b) { return a - b; });
  }

  function refrescarPie_() {
    var cuenta = q('#nfm-cuenta'); if (!cuenta) return;
    var n = seleccionados_(F.sel).length;
    cuenta.textContent = n;
    var t = q('#nfm-cuenta-t');
    if (t) t.textContent = (n === 1 ? 'bloque seleccionado' : 'bloques seleccionados');

    var motivo = txt_(q('#nfm-motivo')?.value);
    var chars = q('#nfm-chars'); if (chars) chars.textContent = motivo.length;
    var btn = q('#nfm-reabrir');
    if (btn) btn.disabled = !(n > 0 && motivo.length > 0);
  }

  /* ============================================================
     5. REAPERTURA CORTA (#modal-nreab)
     ============================================================
     Es el atajo del check "Aprobado": la misma operación, pero sin
     tener que leer los 14 bloques. Devuelve una promesa que dice si
     la reapertura se hizo, para que el check se quede desmarcado
     solo cuando de verdad pasó algo. */
  function abrirReapertura(r) {
    if (!r) return Promise.resolve(false);
    if (!r.aprobado) {
      Swal.fire({
        icon: 'info', title: 'Nada que reabrir',
        text: 'Solo se pueden reabrir bloques de un perfil ya aprobado.'
      });
      return Promise.resolve(false);
    }
    return (async function () {
      var d;
      try {
        d = await apiPost('nivelFormulario', cuerpoApi_(r));
      } catch (e) {
        Swal.fire({ icon: 'error', title: 'No se pudo abrir', text: String(e && e.message ? e.message : e) });
        return false;
      }
      R.r = r; R.data = d; R.sel = {};
      pintarReapertura_();
      q('#modal-nreab')?.classList.remove('hidden');
      return new Promise(function (resolver) { R.resolver = resolver; });
    })();
  }

  /* Cerrar siempre resuelve la promesa: si no, el check se quedaría
     esperando para siempre. */
  function cerrarReapertura_(hecho) {
    q('#modal-nreab')?.classList.add('hidden');
    var f = R.resolver; R.resolver = null;
    if (f) f(!!hecho);
  }

  function pintarReapertura_() {
    var d = R.data, r = R.r;
    if (!d) return;
    var sub = q('#nreab-sub');
    if (sub) {
      sub.innerHTML = '<span class="nfm-pill">' + esc(nombreDe_(r)) + ' · N° ' + esc(r.n) + '</span>';
    }

    var reabribles = (d.bloques || []).filter(function (b) { return b.reabrible; });
    var body = q('#nreab-body');
    if (!reabribles.length) {
      body.innerHTML = '<div class="nfm-nota nfm-nota--warn">Este estudiante no tiene ningún bloque completado que se pueda reabrir.</div>';
    } else {
      body.innerHTML =
        '<p class="conta-hint">Elige los bloques que el estudiante tiene que corregir. Al confirmar se le quita el check <b>Aprobado</b> y se le avisa por WhatsApp y correo con el motivo que escribas.</p>' +
        '<div class="nrb-lista">' + reabribles.map(function (b) {
          return '<label class="nrb-item"><input type="checkbox" data-nrb="' + esc(b.n) + '" />' +
            '<span class="nrb-item__t">' + esc(b.icono || '•') + ' ' + esc(b.n) + '. ' + esc(b.titulo) + '</span>' +
            (b.fecha ? '<span class="nfm-fecha">🕒 ' + esc(b.fecha) + '</span>' : '') + '</label>';
        }).join('') + '</div>';
    }

    var motivo = q('#nreab-motivo');
    if (motivo) { motivo.value = ''; motivo.setAttribute('maxlength', String(MOTIVO_MAX)); }
    refrescarReapertura_();

    /* Cableado del contenido recién pintado. */
    body.querySelectorAll('[data-nrb]').forEach(function (c) {
      c.addEventListener('change', function () {
        var n = Number(c.dataset.nrb);
        if (c.checked) R.sel[n] = true; else delete R.sel[n];
        c.closest('.nrb-item')?.classList.toggle('is-sel', !!c.checked);
        refrescarReapertura_();
      });
    });
  }

  function refrescarReapertura_() {
    var n = seleccionados_(R.sel).length;
    var motivo = txt_(q('#nreab-motivo')?.value);
    var cuenta = q('#nreab-cuenta');
    if (cuenta) {
      cuenta.textContent = n + (n === 1 ? ' bloque seleccionado' : ' bloques seleccionados') +
                           ' · ' + motivo.length + ' / ' + MOTIVO_MAX;
    }
    var btn = q('#nreab-ok');
    if (btn) btn.disabled = !(n > 0 && motivo.length > 0);
  }

  /* ============================================================
     6. LA OPERACIÓN DE REABRIR (la usan las dos pantallas)
     ============================================================ */
  async function lanzarReapertura_(r, bloques, motivo, origen) {
    if (!r) return false;

    /* El backend valida lo mismo, pero avisar aquí evita un viaje y
       un error feo. */
    if (!bloques.length) {
      Swal.fire({ icon: 'warning', title: 'Elige los bloques', text: 'Marca al menos un bloque para reabrirle al estudiante.' });
      return false;
    }
    if (!motivo) {
      Swal.fire({ icon: 'warning', title: 'Falta el motivo', text: 'Escribe qué tiene que corregir: es justo lo que le llega por WhatsApp y correo.' });
      return false;
    }
    if (motivo.length > MOTIVO_MAX) {
      Swal.fire({ icon: 'warning', title: 'Motivo demasiado largo', text: 'El motivo no puede pasar de ' + MOTIVO_MAX + ' caracteres.' });
      return false;
    }

    var nombres = nombresBloques_(bloques);
    var conf = await Swal.fire({
      icon: 'question', title: '¿Reabrir estos bloques?',
      html: '<div class="nive-conf">' +
        '<div class="nive-conf__q"><b>' + esc(nombreDe_(r)) + '</b> · N° ' + esc(r.n) + '</div>' +
        '<ul class="nive-avisos">' + nombres.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<div class="nive-conf__d">Motivo: <b>' + esc(motivo) + '</b></div>' +
        '<div class="nive-conf__re">Se le quita el check <b>Aprobado</b> y se le avisa por WhatsApp y correo. Su hoja de vida actual se conserva hasta que lo vuelvas a aprobar.</div>' +
        '</div>',
      showCancelButton: true,
      confirmButtonText: 'Sí, reabrir',
      cancelButtonText: 'Cancelar',
      focusCancel: true
    });
    if (!conf.isConfirmed) return false;

    try {
      var out = await apiPost('nivelReabrir', {
        usuarioId: currentUser.id, n: r.n, documento: r.documento,
        bloques: bloques, motivo: motivo
      });
      var lista = out.bloques || bloques;
      var aviso = out.aviso || {};

      cerrarFormulario_();
      if (origen === 'nreab') cerrarReapertura_(true);
      await refrescarLista_();

      Swal.fire({
        icon: aviso.enviado ? 'success' : 'warning',
        title: lista.length === 1 ? 'Se reabrió 1 bloque' : ('Se reabrieron ' + lista.length + ' bloques'),
        html: '<div class="nive-conf">' +
          '<div class="nive-conf__d">' + esc(out.nombres || nombres.join(' · ')) + '</div>' +
          (aviso.enviado
            ? '<div class="nive-conf__d">Al estudiante se le avisó por <b>' + esc(canalTexto_(aviso.canal)) + '</b>.</div>'
            : '<div class="nive-conf__re">El aviso <b>no le llegó</b>: ' + esc(aviso.motivo || 'sin motivo') + '</div>') +
          '</div>'
      });
      return true;
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'No se pudo reabrir', text: String(e && e.message ? e.message : e) });
      return false;
    }
  }

  /* Nombre legible de cada bloque, con lo que ya está en pantalla. */
  function nombresBloques_(bloques) {
    var todos = ((F.data && F.data.bloques) || (R.data && R.data.bloques) || []);
    return bloques.map(function (n) {
      var b = todos.find(function (x) { return Number(x.n) === Number(n); });
      return b ? (n + '. ' + b.titulo) : ('Bloque ' + n);
    });
  }

  /* ============================================================
     BOTONES FIJOS DEL HTML — se cablean UNA sola vez
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    q('#nive-visor-close')?.addEventListener('click', cerrarVisor_);
    q('#nive-visor-copiar')?.addEventListener('click', copiarEnlace_);
    q('#nive-visor')?.addEventListener('click', function (ev) {
      if (ev.target && ev.target.id === 'nive-visor') cerrarVisor_();
    });

    q('#nform-close')?.addEventListener('click', cerrarFormulario_);

    q('#nreab-close')?.addEventListener('click', function () { cerrarReapertura_(false); });
    q('#nreab-cancel')?.addEventListener('click', function () { cerrarReapertura_(false); });
    q('#nreab-motivo')?.addEventListener('input', refrescarReapertura_);
    q('#nreab-ok')?.addEventListener('click', function () {
      lanzarReapertura_(R.r, seleccionados_(R.sel), txt_(q('#nreab-motivo')?.value), 'nreab');
    });
  });

  return {
    abrirFormulario: abrirFormulario,
    verHv: verHv,
    aprobar: aprobar,
    regenerar: regenerar,
    abrirReapertura: abrirReapertura
  };
})();

/* Puerta para las pruebas automatizadas. */
window.__sepPerfil = NPERFIL;
