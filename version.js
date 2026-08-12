/**
 * ============================================================
 * SEP GROUP — VERSIÓN
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
 * FASE ACTUAL: Acuerdo de firma (12/08) — en el modal de la vista
 *   Contador, dentro del bloque del contrato, se ve la fecha y hora en
 *   que el estudiante aceptó el Acuerdo de firma electrónica
 *   (CONTADOR.FECHA_ACEPTA), la misma que queda impresa bajo las firmas
 *   de su contrato en PDF.
 *   Lote 11/08 (3) — INSIGHTS: botón flotante de consultas
 *   en Comercial, Tablero y Contador. Abre un chat con botones fijos;
 *   cada informe se calcula en el navegador con lo que hay en pantalla
 *   y con los filtros puestos (sin IA, sin mandar datos a terceros),
 *   con lectura en voz (Inworld), Copiar y WhatsApp. Nada se envía
 *   solo: el panel se abre y espera. Los ajustes de voz están en
 *   Configuración → Avanzado, solo DESARROLLADOR.
 *   Lote 11/08 (2) — MODO OSCURO en toda la app (botón
 *   fijo arriba a la derecha; sin elección propia sigue al sistema) ·
 *   el botón Descargar de los archivos del Contador vive ahora SOLO
 *   dentro del visor · la rueda de FECHAS MÁXIMAS de pago trae columna
 *   de año (el actual y el siguiente) · las listas de Métodos de pago,
 *   Cuentas y Oferta se editan en Configuración › Listas (ADMIN y DEV)
 *   y dejan de estar escritas en el código.
 *   Contador Fase 5 (11/08) — la vista Contador va EN VIVO
 *   (escucha /meta/contador_rev en Firebase, con sondeo de respaldo) y
 *   las tarjetas van de la más reciente a la más antigua · zona de
 *   archivo que acepta arrastrar, PEGAR (Ctrl+V, también archivos
 *   copiados del explorador) y adjuntar · Ver / Descargar / Reemplazar
 *   en todo archivo guardado · tres comprobantes opcionales nuevos
 *   (pago de oferta, pago total y adicionales) · botón Eliminar con
 *   purga definitiva de archivos, solo para ADMIN y DESARROLLADOR ·
 *   clave de acceso también al pasar a PENDIENTE_PAGO · botón
 *   "Ir a Plantilla" en Configuración → Programas.
 *   Vista CONTADOR (10/08 · Fase 2) — nueva vista para el
 *   contador sobre la hoja CONTADOR: tarjetas con la etapa del proceso
 *   (comprobante, contrato, validación, oferta, pago total, SEVIS),
 *   filtros en 3 pastillas (Asesor · Etapa · Plan), resumen por etapa,
 *   modal de 4 bloques con un solo botón Guardar, subida del comprobante
 *   de inscripción (que deja al estudiante en INSCRITO) y visor de
 *   archivos sin abrir pestaña. Rol CONTADOR + SUPERUSUARIO + DEV.
 *   Fase 1 (10/08) — la hoja CONTADOR se alimenta sola desde COMERCIAL
 *   al pasar el lead a Pendiente de Pago.
 *   Rendimiento del backend (07/08 · 4) — La vista Comercial
 *   pasa de ~28 s a segundos: fechas en JS puro (Utilities.formatDate
 *   costaba 0,872 ms por llamada y se invocaba 50 veces por tarjeta),
 *   respuesta de la lista sin los campos que solo usa el modal Ver,
 *   filtrado por asesor ANTES de mapear, y una sola petición
 *   (comercialInit) en vez de tres al abrir la vista.
 *   Capas y rendimiento (07/08 · 3) — Aviso "Enlace copiado"
 *   visible sobre los modales · imágenes de 9,4 MB a 903 KB · service
 *   worker cache-first · esqueletos en vez del girador en las lecturas
 *   (el girador se queda en guardar y subir) · capas 0, 1, 4, 5 y 7 en
 *   las carpetas css/ y js/.
 *   Lote 07/08 (2) — Anfitrión propio por asesoría (Id Calendar)
 *   · Imágenes servidas desde img/ de este mismo repo (fuera Cloudinary).
 *   Lote 07/08 (1) — Estado APLAZADO · Modal de brochures y
 *   condiciones con histórico y previsualización · Usuario WhatsApp del
 *   lead · Al renombrar un usuario se arrastran sus filas en COMERCIAL.
 *   Fase 25.1 — Filtros de Comercial en 3 pastillas (Asesor · Programa ·
 *   Estado). Fase 25 — Loader silencioso · Antiduplicados · Referido
 * Sube este número en cada despliegue. La app lo lee sin caché:
 * si cambia, limpia caches y recarga automáticamente en todos
 * los dispositivos. También alimenta el texto "Versión X" de las vistas.
 * ============================================================
 */
var APP_VERSION = "2026.08.12.01";
