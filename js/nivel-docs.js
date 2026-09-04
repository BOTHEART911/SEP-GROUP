/* =============================================================
 * SEP GROUP — DOCUMENTOS DEL PARTICIPANTE (Fase 4 · Entrega 6)
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario; cualquier modificación por terceros anula
 * la garantía de funcionamiento.
 * ------------------------------------------------------------
 * QUÉ ES
 *   El punto 4.10 del plan, del lado de SEP: desde la ficha de
 *   Nivel de Inglés, Procesos abre los DIEZ documentos de un
 *   participante y puede
 *
 *     · visualizar y descargar
 *     · habilitar / deshabilitar (individual o VARIOS a la vez)
 *     · aprobar
 *     · solicitar corrección (reabre SOLO ese documento)
 *     · cargar en nombre del participante o reemplazar
 *
 * QUIÉN DECIDE
 *   El backend (Documentos.gs). Cada documento llega con su estado
 *   ya resuelto y con `soloVer` / `puedeSubir`. Aquí no se calcula
 *   ninguna regla: si el backend dice que no, el botón no está.
 *
 * VA EN SU PROPIO ARCHIVO
 *   js/nivel-perfil.js ya pesa 50 KB y hace otra cosa (el puntaje y
 *   el formulario). Esto se conecta igual que aquel: nivel.js llama
 *   a NDOCS y NDOCS solo vuelve a recargarNivel_ cuando algo cambió.
 *
 * Usa de app.js: apiPost, apiGet, currentUser, esc_.
 * Los cuerpos del modal se reescriben enteros con innerHTML y el
 * cableado va SIEMPRE después, sobre lo recién creado.
 * ============================================================= */

var NDOCS = (function () {
  'use strict';

  var D = { r: null, data: null, sel: {} };

  function q(sel) { return document.querySelector(sel); }
  function txt_(v) { return String(v === null || v === undefined ? '' : v).trim(); }
  function esc(v) { return (typeof esc_ === 'function') ? esc_(v) : txt_(v); }
  function cuerpoApi_(extra) {
    return Object.assign({ usuarioId: currentUser.id }, extra || {});
  }

  function idDrive_(url) {
    var m = String(url || '').match(/[-\w]{25,}/);
    return m ? m[0] : '';
  }

  /* ============================================================
     ABRIR
     ============================================================ */
  function abrir(r) {
    D.r = r; D.data = null; D.sel = {};
    q('#ndocs-title').textContent = '📁 Documentos del participante';
    q('#ndocs-sub').textContent = txt_(r.nombres + ' ' + r.apellidos) + ' · ' + txt_(r.documento);
    q('#ndocs-body').innerHTML = '';
    q('#ndocs-foot').innerHTML = '';
    q('#modal-ndocs').classList.remove('hidden');
    cargar();
  }

  function cerrar() { q('#modal-ndocs')?.classList.add('hidden'); }

  function cargar() {
    /* Esqueleto, nunca girador, para las LECTURAS: es la regla de la
       casa desde la Entrega 4. El mapa de capa-5 ya conoce la acción
       docsParticipante. */
    return apiGet('docsParticipante', { usuarioId: currentUser.id, id: D.r.id })
      .then(function (d) { D.data = d; pintar(); })
      .catch(function (e) {
        q('#ndocs-body').innerHTML = '<p class="conta-sub">' + esc(e.message || e) + '</p>';
      });
  }

  /* ============================================================
     PINTADO
     ============================================================ */
  function pintar() {
    var lista = (D.data && D.data.documentos) || [];
    q('#ndocs-body').innerHTML =
      '<p class="conta-sub ndoc-intro">Solo PDF. Cuando el participante guarda un documento queda ' +
      'bloqueado para él; si necesita cambiarlo, pídele corrección y se le reabre solo ese.</p>' +
      lista.map(fila).join('');
    q('#ndocs-foot').innerHTML = pie();
    cablear();
  }

  function fila(d) {
    var seleccionable = !d.soloVer;
    var acciones = [];

    if (d.tieneArchivo) {
      acciones.push('<button class="act-btn" data-ver="' + esc(d.clave) + '">👁 Ver</button>');
      acciones.push('<a class="act-btn" href="https://drive.google.com/uc?export=download&id=' +
                    esc(idDrive_(d.url)) + '" target="_blank" rel="noopener">⬇️ Descargar</a>');
    }
    if (!d.soloVer) {
      acciones.push('<button class="act-btn" data-cargar="' + esc(d.clave) + '">' +
                    (d.tieneArchivo ? '♻️ Reemplazar' : '⬆️ Cargar por SEP') + '</button>');
      if (d.tieneArchivo && d.estado !== 'APROBADO') {
        acciones.push('<button class="act-btn act-btn--ok" data-aprobar="' + esc(d.clave) + '">✅ Aprobar</button>');
      }
      if (d.tieneArchivo && d.estado !== 'CORRECCION') {
        acciones.push('<button class="act-btn act-btn--rojo" data-corregir="' + esc(d.clave) + '">↩️ Pedir corrección</button>');
      }
    }

    return '' +
      '<div class="ndoc" data-doc="' + esc(d.clave) + '">' +
      '  <div class="ndoc-h">' +
      (seleccionable
        ? '    <label class="ndoc-chk"><input type="checkbox" data-sel="' + esc(d.clave) + '"' +
          (D.sel[d.clave] ? ' checked' : '') + '><span></span></label>'
        : '    <span class="ndoc-chk ndoc-chk--no"></span>') +
      '    <span class="ndoc-n">' + esc(d.nombre) + '</span>' +
      '    <span class="ndoc-pill" style="background:' + esc(d.estadoColor) + '">' +
             esc(d.estadoIc) + ' ' + esc(d.estadoLabel) + '</span>' +
      '  </div>' +
      '  <div class="ndoc-meta">' +
             (d.fechaCarga ? 'Cargado el ' + esc(d.fechaCarga) +
               (d.origen ? ' (' + esc(d.origen === 'SEP' ? 'por SEP' : 'por el participante') + ')' : '') : 'Sin archivo') +
             (d.revisadoPor ? ' · Revisó ' + esc(d.revisadoPor) + (d.fechaRevision ? ' el ' + esc(d.fechaRevision) : '') : '') +
      '  </div>' +
      (d.estado === 'CORRECCION' && d.nota
        ? '  <div class="ndoc-nota"><b>Corrección pedida:</b> ' + esc(d.nota) + '</div>'
        : '') +
      '  <div class="ndoc-acc">' + acciones.join('') + '</div>' +
      '  <input type="file" accept="application/pdf,.pdf" class="ndoc-file" data-file="' + esc(d.clave) + '">' +
      '</div>';
  }

  /* Habilitación MASIVA: es lo que pidió el usuario para no tener que
     abrir diez veces el mismo participante. */
  function pie() {
    var n = Object.keys(D.sel).filter(function (k) { return D.sel[k]; }).length;
    return '' +
      '<span class="conta-sub" id="ndocs-cuenta">' + n + ' documento(s) seleccionados</span>' +
      '<button class="btn btn-ghost" id="ndocs-todos">Seleccionar todos</button>' +
      '<button class="btn btn-ghost" id="ndocs-off"' + (n ? '' : ' disabled') + '>🚫 Deshabilitar</button>' +
      '<button class="btn btn-primary" id="ndocs-on"' + (n ? '' : ' disabled') + '>🔓 Habilitar</button>';
  }

  /* ============================================================
     CABLEADO
     ============================================================ */
  function cablear() {
    var raiz = q('#modal-ndocs');
    if (!raiz) return;

    raiz.querySelectorAll('[data-sel]').forEach(function (c) {
      c.addEventListener('change', function () {
        D.sel[c.dataset.sel] = c.checked;
        q('#ndocs-foot').innerHTML = pie();
        cablearPie();
      });
    });

    raiz.querySelectorAll('[data-ver]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = doc(b.dataset.ver);
        if (!d || !d.url) return;
        if (typeof NPERFIL !== 'undefined' && NPERFIL.visor) NPERFIL.visor(d.url, d.nombre);
        else window.open(d.url, '_blank');
      });
    });

    raiz.querySelectorAll('[data-aprobar]').forEach(function (b) {
      b.addEventListener('click', function () { revisar(b.dataset.aprobar, 'APROBAR'); });
    });
    raiz.querySelectorAll('[data-corregir]').forEach(function (b) {
      b.addEventListener('click', function () { revisar(b.dataset.corregir, 'CORREGIR'); });
    });
    raiz.querySelectorAll('[data-cargar]').forEach(function (b) {
      b.addEventListener('click', function () {
        raiz.querySelector('[data-file="' + b.dataset.cargar + '"]')?.click();
      });
    });
    raiz.querySelectorAll('[data-file]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        inp.value = '';
        if (f) subir(inp.dataset.file, f);
      });
    });

    cablearPie();
  }

  function cablearPie() {
    q('#ndocs-todos')?.addEventListener('click', function () {
      var lista = (D.data && D.data.documentos) || [];
      var todos = lista.filter(function (d) { return !d.soloVer; });
      var falta = todos.some(function (d) { return !D.sel[d.clave]; });
      todos.forEach(function (d) { D.sel[d.clave] = falta; });
      pintar();
    });
    q('#ndocs-on')?.addEventListener('click', function () { habilitar(true); });
    q('#ndocs-off')?.addEventListener('click', function () { habilitar(false); });
  }

  function doc(clave) {
    var l = (D.data && D.data.documentos) || [];
    for (var i = 0; i < l.length; i++) if (l[i].clave === clave) return l[i];
    return null;
  }

  /* ============================================================
     ACCIONES
     ============================================================ */
  function habilitar(encender) {
    var claves = Object.keys(D.sel).filter(function (k) { return D.sel[k]; });
    if (!claves.length) return;

    apiPost('docHabilitar', cuerpoApi_({ id: D.r.id, docs: claves, habilitar: encender }))
      .then(function (d) {
        D.data = d; D.sel = {};
        pintar();
        Swal.fire({ icon: 'success', title: encender ? 'Documentos habilitados' : 'Documentos deshabilitados',
          timer: 1400, showConfirmButton: false });
      })
      .catch(function (e) {
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: String(e.message || e) });
      });
  }

  async function revisar(clave, accion) {
    var d = doc(clave);
    if (!d) return;

    var nota = '';
    if (accion === 'CORREGIR') {
      var r = await Swal.fire({
        title: '↩️ Pedir corrección',
        html: '<b>' + esc(d.nombre) + '</b><br><span style="color:#44546b">' +
              'Esto le reabre SOLO este documento al participante.</span>',
        input: 'textarea', inputPlaceholder: 'Qué debe corregir…',
        showCancelButton: true, confirmButtonText: 'Pedir corrección',
        inputValidator: function (v) { return !txt_(v) && 'Escribe qué debe corregir.'; }
      });
      if (!r.isConfirmed) return;
      nota = txt_(r.value);
    } else {
      var c = await Swal.fire({
        icon: 'question', title: '¿Aprobar este documento?',
        html: '<b>' + esc(d.nombre) + '</b>',
        showCancelButton: true, confirmButtonText: 'Sí, aprobar'
      });
      if (!c.isConfirmed) return;
    }

    try {
      D.data = await apiPost('docRevisar', cuerpoApi_({ id: D.r.id, doc: clave, accion: accion, nota: nota }));
      pintar();
      Swal.fire({ icon: 'success', title: accion === 'APROBAR' ? 'Documento aprobado' : 'Corrección solicitada',
        timer: 1500, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: String(e.message || e) });
    }
  }

  function subir(clave, file) {
    var d = doc(clave);
    if (!d) return;
    var maxMb = (D.data && D.data.maxMb) || 5;

    if (!/\.pdf$/i.test(String(file.name || ''))) {
      return Swal.fire({ icon: 'warning', title: 'Solo PDF', text: d.nombre + ' debe ser un archivo PDF.' });
    }
    if (file.size > maxMb * 1024 * 1024) {
      return Swal.fire({ icon: 'warning', title: 'Archivo muy pesado',
        text: 'El archivo pesa más de ' + maxMb + ' MB.' });
    }

    var lector = new FileReader();
    lector.onerror = function () { Swal.fire({ icon: 'error', title: 'No se pudo leer el archivo' }); };
    lector.onload = function () {
      var base64 = String(lector.result).split(',')[1];
      /* Girador (no esqueleto): esto es una ESCRITURA. */
      Swal.fire({ title: 'Subiendo el documento…', allowOutsideClick: false,
        didOpen: function () { Swal.showLoading(); } });

      apiPost('docSubirSep', cuerpoApi_({
        id: D.r.id, doc: clave, filename: String(file.name || ''),
        mime: file.type || 'application/pdf', base64: base64
      })).then(function (r) {
        D.data = r;
        Swal.close();
        pintar();
        Swal.fire({ icon: 'success', title: 'Documento cargado', timer: 1500, showConfirmButton: false });
      }).catch(function (e) {
        Swal.close();
        Swal.fire({ icon: 'error', title: 'No se pudo subir', text: String(e.message || e) });
      });
    };
    lector.readAsDataURL(file);
  }

  /* ---------------- arranque ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    q('#ndocs-close')?.addEventListener('click', cerrar);
  });

  return { abrir: abrir, cerrar: cerrar, _pintar: pintar, _fila: fila, _estado: D };
})();

window.__sepDocs = NDOCS;
