/**
 * ============================================================
 * SEP GROUP — VERSIÓN
 * SEP Colombia Group SAS
 * ------------------------------------------------------------
 * FASE 4 · ENTREGA 2 (03/09/2026) — CONFIGURACIÓN DE OFERTAS: los
 * textos que lee el participante dejaron de llamarse "Motivo de
 * bloqueo 1..6". Ahora cada uno dice para qué sirve y están los que
 * faltaban del plan: fecha de inicio, fecha de finalización, cierre
 * del periodo, las cuatro puertas del participante y la casilla
 * obligatoria del modal. Archivo tocado: js/ofertas.js.
 * ------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales
 * Contacto: +57 310 323 0712
 * ------------------------------------------------------------
 * Software propietario. Cualquier modificación de este archivo
 * por terceros anula automáticamente la garantía de
 * funcionamiento. Diseñado y desarrollado íntegramente por
 * Oscar Polanía.
 * ------------------------------------------------------------
 * FASE 4 SEP · ENTREGA 1 (03/09) — OFERTAS DE EMPLEO.
 *   · Procesos gana dos botones: "Ofertas de Empleo" (gestión) y
 *     "Configuración" (configura las ofertas).
 *   · Hoja OFERTAS nueva. El formulario de la oferta son 7 bloques
 *     (fotos, información general, características, conoce tu destino,
 *     fechas y filtros, detalles del puesto y housing) que se pintan
 *     con la MISMA definición con la que se creó la hoja y con la que
 *     el backend valida: no hay dos verdades.
 *   · Cinco estados (Disponible · Pocos cupos · Sin cupos · Cerrada ·
 *     Desactivada). NINGUNO se digita: los tres primeros salen de los
 *     cupos, Cerrada de la fecha de cierre o del cierre manual y
 *     Desactivada de la acción de SEP. Los botones son tres: Activar,
 *     Desactivar y Cerrar.
 *   · Fecha de cierre automático por oferta: al llegar el día, la
 *     oferta se cierra sola para nuevas selecciones, sin devolver
 *     cupos ni tocar a los participantes ya asociados.
 *   · "Si el participante no es aprobado, ¿el cupo vuelve a estar
 *     disponible?" se define POR OFERTA, no por Sponsor.
 *   · Cupos: 4 o más libres = Disponible · 1 a 3 = Pocos cupos ·
 *     0 = Sin cupos. No es configurable.
 *   · Configuración de ofertas: plantilla del PDF, carpeta de fotos,
 *     programa y temporada, política del cupo cuando no aprueban,
 *     catálogos (estados de EE. UU. y posiciones) y los ocho textos
 *     que verá el estudiante.
 *   · Todavía NO: la vista del estudiante, la entrevista, el
 *     resultado y el PDF (Entregas 2, 3 y 4).
 * ------------------------------------------------------------
 * LOTE 25/08 · TANDA B — BLOQUE 2 DEL CONTADOR.
 *   · Campo nuevo "Fecha pago de oferta", con la misma rueda de día ·
 *     mes · año parada en el año actual. Esa fecha es ahora la que
 *     registra el pago: con fecha (y su comprobante) el estudiante queda
 *     como pagado y se le abre el formulario; si se quita, deja de
 *     estarlo. Se guarda en la columna de siempre.
 *   · El check "Pago oferta OK" pasa a ser "🔔 Notificar" y ya solo
 *     decide si sale el mensaje. Nace apagado en cada apertura de la
 *     ficha: guardar sin marcarlo NO le escribe nada al estudiante, por
 *     muchas veces que se guarde. Marcándolo se envía (y se puede
 *     reenviar). Si falta la fecha o el comprobante, no se manda y la
 *     pantalla dice qué falta, en vez de invitarlo a un formulario al
 *     que todavía no puede entrar.
 * ------------------------------------------------------------
 * LOTE 25/08 — DOS AJUSTES.
 *   · Vista Contador: la FECHA DE INSCRIPCIÓN ya se puede escribir a
 *     mano, con la misma rueda de siempre (día · mes · año) y parada en
 *     el año actual. Sirve para montar procesos atrasados con su fecha
 *     de verdad. Si se deja vacía sigue poniéndose sola el día que entre
 *     el comprobante, y lo escrito a mano nunca lo pisa el sistema.
 *   · Nivel de Inglés: en el modal del Puntaje SEA hay un check
 *     "Guardar en silencio". Guarda el puntaje y el Nivel de Inglés HV
 *     sin enviarle al estudiante el WhatsApp ni el correo del resultado,
 *     y ese guardado no cuenta como envío. Nace apagado cada vez que se
 *     abre una ficha. No afecta al check Aprobado, que avisa aparte.
 * ------------------------------------------------------------
 * FASE 3.4 (21/08) — DOS AJUSTES.
 *   · Alertas del bot: el SILENCIO NOCTURNO ya funciona. La ventana
 *     (7:00 p. m. a 6:00 a. m.) estaba guardada en la hoja como celda de
 *     HORA y las rutinas de fondo no la entendían, así que el correo de
 *     "bot desconectado" salía cada hora también de madrugada. Ahora la
 *     hora se guarda y se lee como texto, y la marca de la última alerta
 *     se ve en hora de Colombia y no en formato técnico.
 *   · Nivel de Inglés HV: las opciones pasan a Pre-Intermediate,
 *     Intermediate, Upper-Intermediate y Advanced, y se editan en
 *     Configuración › Listas como las demás. Lo que ya estaba escrito en
 *     mayúsculas quedó convertido. Ese nivel además ya se puede filtrar y
 *     exportar desde el botón Exportar de la vista.
 * ------------------------------------------------------------
 * FASE 3.3 · TANDA B (20/08) — LOS DOS PUNTOS QUE FALTABAN.
 *   · Formulario, bloque 5: donde solo cabía un hermano(a) en Estados
 *     Unidos ahora caben HASTA TRES, cada uno con los mismos datos de
 *     siempre (nombre, ciudad/estado, estatus migratorio, correo y
 *     celular). El botón para añadir el siguiente se llama
 *     "Other brother" y la pantalla no deja pasar de tres.
 *   · Nivel de Inglés: la tarjeta muestra quién ya PAGÓ LA OFERTA de
 *     empleo y la fecha en que se le validó, y hay una cuarta pastilla
 *     de filtro para ver de una a los que pagaron o a los que faltan,
 *     con su consulta propia en Insights. El dato lo pone el contador
 *     en su vista: aquí no hay nada que marcar. Si alguien deja el
 *     check del pago sin subir el comprobante, la tarjeta lo avisa en
 *     ámbar, porque en ese caso el estudiante todavía NO puede entrar
 *     al formulario.
 * ------------------------------------------------------------
 * FASE 3.3 · TANDA A (20/08) — 4 AJUSTES DEL PLIEGO DE JAVIER.
 *   · Vista Contador: lo que se pega con Ctrl+V ya cae en el bloque que
 *     está abierto. Antes, todo pegado fuera de la caja se subía al
 *     comprobante de INSCRIPCIÓN aunque se estuviera trabajando el de la
 *     oferta (y podía pisárselo al estudiante). La zona que va a recibir
 *     el archivo se ve resaltada y, si no se puede saber cuál es, se
 *     pregunta en vez de adivinar.
 *   · Formulario, bloque 6: la casilla del semestre aplazado lleva la
 *     indicación del año y el semestre (e.g., 2025,2).
 *   · Formulario, bloque 14: el enlace del video de YouTube pasa a
 *     OBLIGATORIO para cerrar el bloque.
 *   · Modo oscuro del modal de Nivel de Inglés: los textos del
 *     formulario ya se ven. La hoja de esa vista usaba cuatro variables
 *     que no existen (--bg-input, --card-bg, --card-bd, --text), así que
 *     los campos en edición quedaban blancos con letra blanca y los
 *     datos de la ficha, tinta oscura sobre fondo oscuro.
 * ------------------------------------------------------------
 * FASE 3.2 (19/08) — ÚLTIMA ENTREGA: LOS 4 AJUSTES.
 *   · Estado nuevo "Pendiente de Pago Silencio": hace lo mismo que
 *     Pendiente de Pago (crea la clave y pasa el estudiante a la vista
 *     Contador) pero SIN avisarle por WhatsApp ni correo. Sirve para
 *     montar procesos atrasados sin confundir al estudiante. "Inscrito"
 *     sale de los selectores: lo sigue poniendo el sistema solo, al
 *     validar el comprobante.
 *   · En la vista Contador, check "Guardar en silencio": ese guardado no
 *     manda ningún mensaje (ni el de la inscripción, ni el del contrato
 *     validado, ni el del pago de la oferta) y se apaga solo al terminar.
 *   · El acceso al FORMULARIO cambia de sitio: ya no va en los mensajes
 *     del resultado del SET. Ahora se envía desde el Bloque 2 del
 *     Contador cuando quedan puestos el check "Pago oferta OK" y su
 *     comprobante, con la plantilla nueva PAGO_OFERTA_SUMMER (WhatsApp y
 *     correo). Si se desmarca y se vuelve a marcar, se reenvía. La Zona
 *     de estudiantes ahora también exige ese pago para abrir el
 *     formulario.
 *   · Botón INVITACIÓN (✉️) en las tarjetas de Nivel de Inglés: marca la
 *     tarjeta con su color propio, guarda quién la marcó y cuándo, tiene
 *     pastilla de filtro (Con / Sin invitación) y consulta propia en
 *     Insights. No envía ningún mensaje.
 *   · Botón ELIMINAR con purga en Nivel de Inglés, Contador y Comercial
 *     (solo SUPERUSUARIO, DESARROLLADOR y PROCESOS): borra en cascada las
 *     filas y los archivos de Drive de forma definitiva, se confirma
 *     escribiendo el documento del estudiante (en Comercial, el ID del
 *     registro) y AUDITORÍA nunca se toca.
 * ------------------------------------------------------------
 * FASE 3.1 · ENTREGA 1 (19/08) — MULTI-ROL Y ROL NUEVO "PROCESOS".
 *   · Un usuario puede tener varios roles a la vez y ve las vistas de
 *     todos ellos. Se configura en Configuración → Usuarios (solo ADMIN
 *     y DESARROLLADOR), con casillas de roles adicionales.
 *   · Se combinan CONTADOR, COMERCIAL y PROCESOS. SUPERUSUARIO y
 *     DESARROLLADOR no necesitan combinarse: ya alcanzan todo lo suyo.
 *   · Rol nuevo PROCESOS: entra a la vista Procesos y a todo lo que
 *     cuelga de ella (hoy, Nivel de Inglés). Si solo tiene ese rol, es
 *     lo único que ve.
 *   · La ventana de horario del rol COMERCIAL ahora solo aplica a quien
 *     es COMERCIAL y nada más: un asesor que además sea contador entra
 *     a cualquier hora.
 * ------------------------------------------------------------
 * LOTE 17/08 (4 ajustes) — Botón EXPORTAR en Comercial, Contador y Nivel
 *   de Inglés (solo SUPERUSUARIO y DESARROLLADOR): Excel con los datos
 *   (hoja Datos con filtros, formato y totales, más hoja Resumen) o PDF
 *   de informe (portada con el rango y los filtros, totales con barras y
 *   anexo de listado). El archivo solo se descarga: no queda nada en
 *   Drive. · Configuración → Programas avisa en rojo qué variable le
 *   falta a cada programa y qué sale en su lugar. · Nivel de Inglés y
 *   el botón "Ver formulario" ya no muestran girador al abrir: esqueleto.
 *
 * FASE 3 SEP · ENTREGA 5 (17/08) — la última de la Fase 3. En la vista
 *   Nivel de Inglés se encendió todo lo que hasta hoy se veía apagado:
 *   · El check APROBADO ya funciona. Al marcarlo se crea la hoja de
 *     vida del estudiante en PDF (con sus datos, sus habilidades, su
 *     experiencia y su foto) y se le vuelve a enviar, por WhatsApp y
 *     correo, el mensaje de las ofertas de empleo. Si el formulario
 *     todavía no está terminado, el sistema no deja aprobar y dice
 *     exactamente qué le falta al estudiante.
 *   · El botón VER FORMULARIO abre el formulario completo del
 *     estudiante, bloque por bloque, en modo lectura: se ve todo lo
 *     que escribió, sus documentos y en qué va.
 *   · El botón VER HV abre la hoja de vida sin salir de la app, con
 *     Descargar, Abrir y Copiar enlace.
 *   · ADMIN y DESARROLLADOR pueden REGENERAR LA HOJA DE VIDA cuando el
 *     estudiante corrige algo: se rehace en el mismo enlace de siempre
 *     (quien ya lo tenga verá la nueva) y de la anterior no queda copia.
 *   · Desmarcar el check APROBADO ya no es solo quitar una palomita:
 *     abre la pantalla para elegir qué bloques debe corregir el
 *     estudiante y escribir el motivo. Al confirmar, esos bloques se le
 *     vuelven a abrir y se le avisa por WhatsApp y correo con el motivo
 *     tal como se escribió. Su hoja de vida actual se conserva hasta
 *     que se le vuelva a aprobar. Cuando el estudiante termina de
 *     corregir, la tarjeta lo muestra como "Corregido · falta
 *     reaprobar".
 * ------------------------------------------------------------
 * FASE ANTERIOR: Fase 3 SEP · Entregas 3 y 4 (16 y 17/08) — el
 *   formulario del estudiante: sus 14 bloques, la carga de documentos
 *   y la foto, y los avisos de cada paso. En la vista Nivel de Inglés,
 *   la tarjeta muestra la EDAD junto a la fecha de nacimiento (misma
 *   cuenta de la vista Contador) y el emoji 🪪, que en Windows salía
 *   como un cuadro vacío, se cambió por 🆔 en Nivel de Inglés y en
 *   Contador.
 *   Fase 3 SEP · Entrega 2 (16/08) — botón PROCESOS en el
 *   Inicio (solo SUPERUSUARIO y DESARROLLADOR) y dentro de él la vista
 *   NIVEL DE INGLÉS: tarjetas en vivo con la foto del estudiante
 *   (ampliable con zoom), resumen tocable por resultado, filtros por
 *   resultado y por nivel, buscador y panel de consultas propio.
 *   El modal registra el PUNTAJE SEA (0.00 a 9.00), calcula el nivel
 *   solo mientras se escribe y, con una confirmación previa, envía al
 *   estudiante por WhatsApp y correo el mensaje que le corresponde
 *   (no aceptado · aceptado con condición · aceptado). Volver a digitar
 *   el puntaje reenvía el mensaje y queda contado. La escala de niveles
 *   y rangos se edita en Configuración › Nivel y SEA, con validación de
 *   que no queden huecos ni rangos montados. El check "Aprobado" y los
 *   botones Ver formulario y Ver HV se ven pero siguen bloqueados:
 *   llegan en las Entregas 4 y 5.
 *   ARREGLO: en NIVEL_INGLES el documento, el WhatsApp y la fecha de
 *   nacimiento quedaban como número y como fecha; ahora la columna
 *   entera es texto y las filas ya migradas quedaron corregidas.
 *   Fase 3 SEP · Entrega 1 (16/08) — hojas NIVEL_INGLES y
 *   FORMULARIO_SUMMER, migración del estudiante al validarse su
 *   contrato, plantillas del resultado del SET y las llaves nuevas de
 *   Configuración › Programas.
 *   Acuerdo de firma (12/08) — en el modal de la vista
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
var APP_VERSION = "2026.09.03.03";
