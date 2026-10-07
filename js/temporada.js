/* ============================================================
 * SEP GROUP — TEMPORADA (Fase 5 · Subfase 5.1 · Entrega A)
 * SEP Colombia Group SAS
 * ------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * ------------------------------------------------------------
 * Temporada = Programa + Año. Todo el sistema se ve por AÑO y por
 * defecto se muestra el año activo (pliego 5.1.1).
 *
 * El año es UN solo selector para toda la sesión: si en Comercial
 * se elige 2028, Contador, Nivel y Ofertas abren también en 2028.
 * El filtro es LOCAL: cada fila ya trae su año (campo `anio`) y las
 * listas se cargan una vez por sesión, así que cambiar de año no
 * hace ni un viaje al servidor.
 *
 * Cómo lo usa cada vista:
 *   X.todos     = lo que llegó del servidor (todas las temporadas)
 *   X.registros = TEMP.filtrar(X.todos)  → lo único que ve la vista
 *   TEMP.alCambiar(fn) para recalcular y repintar al cambiar el año.
 * ============================================================ */
const TEMP = {
  meta: null,
  anio: null,                  // '2027' · 'TODOS'
  KEY: 'sepTempAnio',
  oyentes: [],

  /* Llega en el init de cada vista (comercialInit, contadorInit,
     nivelInit, ofertasInit). El primero que llega fija el año. */
  set(meta){
    if (!meta || !meta.anioDefecto) return;
    this.meta = meta;
    if (!this.anio){
      let guardado = null;
      try { guardado = sessionStorage.getItem(this.KEY); } catch(_){}
      this.anio = (guardado && (guardado === 'TODOS' || (meta.anios || []).indexOf(guardado) >= 0))
        ? guardado : meta.anioDefecto;
    }
    this.pintar();
  },

  /* Filas sin año (antes del migrador) pasan: nunca se esconde a
     nadie por falta de dato. */
  filtrar(rows){
    const lista = Array.isArray(rows) ? rows : [];
    if (!this.anio || this.anio === 'TODOS') return lista.slice();
    return lista.filter(r => !r || !r.anio || String(r.anio) === this.anio);
  },

  esTodos(){ return this.anio === 'TODOS'; },

  /* "2027" o "Todos los años", para títulos y avisos. */
  etiqueta(){ return this.esTodos() ? 'Todos los años' : ('Temporada ' + (this.anio || '')); },

  cambiar(a){
    if (!a || a === this.anio) return;
    this.anio = a;
    try { sessionStorage.setItem(this.KEY, a); } catch(_){}
    this.pintar();
    this.oyentes.forEach(fn => { try { fn(a); } catch(e){ console.error('TEMP', e); } });
  },
  alCambiar(fn){ if (typeof fn === 'function') this.oyentes.push(fn); },

  /* Pone (una sola vez) el selector en la cabecera de una vista,
     justo después del título. */
  montar(viewId){
    const head = document.querySelector('#view-' + viewId + ' .app-header');
    if (!head || head.querySelector('.temp-sel')) return;
    const sel = document.createElement('select');
    sel.className = 'temp-sel';
    sel.title = 'Temporada (año)';
    sel.setAttribute('aria-label', 'Temporada');
    sel.addEventListener('change', () => this.cambiar(sel.value));
    const t = head.querySelector('.app-header__title');
    if (t && t.nextSibling) head.insertBefore(sel, t.nextSibling); else head.appendChild(sel);
    this.pintar();
  },

  pintar(){
    const anios = (this.meta && this.meta.anios) || (this.anio && this.anio !== 'TODOS' ? [this.anio] : []);
    const arch = (this.meta && this.meta.archivados) || [];
    const html = anios.map(a =>
      `<option value="${a}"${a === this.anio ? ' selected' : ''}>📅 ${a}${arch.indexOf(a) >= 0 ? ' · archivada' : ''}</option>`).join('') +
      `<option value="TODOS"${this.anio === 'TODOS' ? ' selected' : ''}>📅 Todos</option>`;
    document.querySelectorAll('.temp-sel').forEach(s => { s.innerHTML = html; });
  }
};
