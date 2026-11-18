/* ============================================================================
 * EXCEL DE LISTA · SEP GROUP (17/11/2026 · ajustes operativos de Javier)
 * ----------------------------------------------------------------------------
 * Pieza única para «Descargar Excel» de Visas y «Exportar datos» de
 * Seguimiento: arma un .xlsx con LO QUE YA ESTÁ EN PANTALLA (los filtros
 * aplicados), sin ir al servidor. Solo SUPERUSUARIO y DESARROLLADOR ven el
 * botón (decisión de Oss, 17/11/2026: igual que el Exportar de Comercial).
 *
 *   XLSXL.puede()                       → ¿el usuario ve el botón?
 *   XLSXL.descargar({ nombre, hoja, titulo, filtros, columnas, filas })
 *     columnas: [{ t: 'Título', v: fila => valor, ancho?: 18 }]
 *     filtros:  ['Asesor: X', ...] (van en la hoja «Filtros»)
 *
 * ExcelJS se baja del CDN la PRIMERA vez (el mismo de js/exportar.js), no al
 * abrir la app. El archivo solo se descarga: nada se guarda en Drive.
 * ========================================================================== */
(function () {
  'use strict';
  if (window.XLSXL) return;

  var CDN = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  var AZUL = 'FF263143', LIMA = 'FFD6DA09';
  var cargando = null;

  function roles_() {
    try {
      var u = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : (window.currentUser || {});
      var l = (Array.isArray(u.roles) && u.roles.length) ? u.roles : [u.rol];
      return l.map(function (r) { return String(r || '').toUpperCase(); });
    } catch (e) { return []; }
  }
  function puede() {
    var r = roles_();
    return r.indexOf('SUPERUSUARIO') >= 0 || r.indexOf('DESARROLLADOR') >= 0;
  }
  function cargar_() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (cargando) return cargando;
    cargando = new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = CDN; s.async = true;
      s.onload = function () { window.ExcelJS ? ok(window.ExcelJS) : mal(new Error('No cargó ExcelJS')); };
      s.onerror = function () { cargando = null; mal(new Error('Sin conexión para preparar el Excel. Intenta de nuevo.')); };
      document.head.appendChild(s);
    });
    return cargando;
  }
  function limpio_(v) {
    if (v === null || v === undefined) return '';
    if (v === true) return 'Sí';
    if (v === false) return 'No';
    return v;
  }
  function hoy_() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  async function descargar(o) {
    if (!puede()) throw new Error('Solo Superusuario y Desarrollador descargan el Excel.');
    var ExcelJS = await cargar_();
    var wb = new ExcelJS.Workbook();
    wb.creator = 'SEP Group';
    var ws = wb.addWorksheet(o.hoja || 'Datos', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = o.columnas.map(function (c) { return { header: c.t, width: c.ancho || Math.max(12, Math.min(40, c.t.length + 4)) }; });
    o.filas.forEach(function (f) { ws.addRow(o.columnas.map(function (c) { var v; try { v = c.v(f); } catch (e) { v = ''; } return limpio_(v); })); });
    var h = ws.getRow(1);
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    h.alignment = { vertical: 'middle', wrapText: true };
    h.height = 30;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: o.columnas.length } };

    var wf = wb.addWorksheet('Filtros');
    wf.columns = [{ header: o.titulo || 'Exportación', width: 70 }];
    wf.getRow(1).font = { bold: true, color: { argb: AZUL } };
    wf.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIMA } };
    wf.addRow(['Generado: ' + new Date().toLocaleString('es-CO')]);
    wf.addRow(['Registros: ' + o.filas.length]);
    (o.filtros && o.filtros.length ? o.filtros : ['Sin filtros']).forEach(function (t) { wf.addRow([t]); });

    var buf = await wb.xlsx.writeBuffer();
    var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (o.nombre || 'SEP') + '_' + hoy_() + '.xlsx';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return o.filas.length;
  }

  window.XLSXL = { puede: puede, descargar: descargar, _cargar: cargar_ };
})();
