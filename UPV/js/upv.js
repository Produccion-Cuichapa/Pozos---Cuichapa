// ═══════════════════════════════════════════════════════════
// UPV Fase 2 — js/upv.js
// Objetivos: fotos reales, GPS robusto, IndexedDB, historial,
// validación, deduplicación local.
// Sin Firebase, sin UltraMsg, sin CDN externos.
// Prefijo exclusivo de localStorage/IDB: upv_
// ═══════════════════════════════════════════════════════════
'use strict';

// ── Constantes ─────────────────────────────────────────────
const UPV_LS_EMPRESA   = 'upv_empresa_seleccionada';
const UPV_LS_HISTORIAL = 'upv_historial';   // compat legacy
const UPV_IDB_NAME     = 'upv_operacion_db';
const UPV_IDB_VERSION  = 1;
const UPV_MAX_FOTOS    = 5;
const UPV_IMG_MAX_PX   = 1280;
const UPV_IMG_QUALITY  = 0.72;
const UPV_DEDUP_WINDOW = 60000; // 60 segundos

// ── Estado global ──────────────────────────────────────────
const UPV = {
  empresa:          null,
  pantalla:         'upv',
  tipoOp:           null,
  // GPS separados por módulo
  gpsOperacion:     null,
  gpsObservacion:   null,
  // Fotos separadas por módulo
  fotosOperacion:   [],
  fotosObservacion: [],
  // Control de guardado
  saveInProgress:   false,
  enLinea:          navigator.onLine,
  // IndexedDB
  db:               null
};

// ═══════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  registrarSW();
  escucharConexion();
  setTimeout(upvVerificarPermisos, 800); // verificar permisos al cargar
  await abrirIDB();
  await migrarDesdeLocalStorage();
  recuperarEmpresa();
  bindLoginBtns();
  bindNavBtns();
  bindFormEvents();
  bindFotoInputs();
  await renderHistorial();
});

// ── Service Worker ─────────────────────────────────────────
function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { scope: './' })
    .then(r => console.log('[UPV-SW] registrado:', r.scope))
    .catch(e => console.warn('[UPV-SW] error:', e));
}

// ── Conexión ───────────────────────────────────────────────
function escucharConexion() {
  const update = () => {
    UPV.enLinea = navigator.onLine;
    const badge = document.getElementById('upv-conn-badge');
    if (!badge) return;
    badge.textContent = UPV.enLinea ? 'EN LÍNEA' : 'SIN CONEXIÓN';
    badge.className = 'conn-badge' + (UPV.enLinea ? '' : ' offline');
    if (UPV.enLinea) sincronizarPendientesUpv();
  };
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}

// ═══════════════════════════════════════════════════════════
// INDEXEDDB
// ═══════════════════════════════════════════════════════════
function abrirIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(UPV_IDB_NAME, UPV_IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      // Almacén reportes
      if (!db.objectStoreNames.contains('reportes')) {
        const rs = db.createObjectStore('reportes', { keyPath: 'id' });
        rs.createIndex('empresa',    'empresa',    { unique: false });
        rs.createIndex('syncStatus', 'syncStatus', { unique: false });
        rs.createIndex('createdAt',  'createdAt',  { unique: false });
      }
      // Almacén fotos
      if (!db.objectStoreNames.contains('fotos')) {
        const fs = db.createObjectStore('fotos', { keyPath: 'id' });
        fs.createIndex('reporteId', 'reporteId', { unique: false });
      }
      // Almacén configuracion
      if (!db.objectStoreNames.contains('configuracion')) {
        db.createObjectStore('configuracion', { keyPath: 'clave' });
      }
    };
    req.onsuccess = e => { UPV.db = e.target.result; resolve(); };
    req.onerror   = e => { console.warn('[UPV-IDB] error al abrir:', e.target.error); resolve(); };
  });
}

function idbTx(storeName, mode = 'readonly') {
  return UPV.db.transaction(storeName, mode).objectStore(storeName);
}

function idbPut(storeName, obj) {
  return new Promise((res, rej) => {
    const req = idbTx(storeName, 'readwrite').put(obj);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

function idbGetAll(storeName) {
  return new Promise((res, rej) => {
    const req = idbTx(storeName).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => rej(req.error);
  });
}

function idbGet(storeName, key) {
  return new Promise((res, rej) => {
    const req = idbTx(storeName).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

// Migración desde localStorage (una sola vez)
async function migrarDesdeLocalStorage() {
  if (!UPV.db) return;
  try {
    const existentes = await idbGetAll('reportes');
    if (existentes.length > 0) return; // ya hay datos en IDB
    const legacy = localStorage.getItem(UPV_LS_HISTORIAL);
    if (!legacy) return;
    const arr = JSON.parse(legacy);
    if (!Array.isArray(arr) || arr.length === 0) return;
    // Confirmar con una clave en configuracion que la migración se hizo
    const yaHecho = await idbGet('configuracion', 'migracion_ls_done');
    if (yaHecho) return;
    for (const r of arr) {
      const migrado = Object.assign({
        estadoLocal:    r.estado   || 'guardado',
        syncStatus:     r.enviado  ? 'sincronizado' : 'pendiente',
        whatsappStatus: 'no_configurado',
        fotoIds:        [],
        createdAt:      r.fecha || new Date().toISOString()
      }, r);
      await idbPut('reportes', migrado);
    }
    await idbPut('configuracion', { clave: 'migracion_ls_done', valor: new Date().toISOString() });
    console.log('[UPV-IDB] Migración desde localStorage completada:', arr.length, 'registros');
  } catch (e) {
    console.warn('[UPV-IDB] Error en migración:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// EMPRESA / LOGIN
// ═══════════════════════════════════════════════════════════
function bindLoginBtns() {
  document.querySelectorAll('.empresa-btn').forEach(btn =>
    btn.addEventListener('click', () => seleccionarEmpresa(btn.dataset.empresa))
  );
}

function seleccionarEmpresa(empresa) {
  UPV.empresa = empresa;
  try { localStorage.setItem(UPV_LS_EMPRESA, empresa); } catch(e) {}
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('upv-app').style.display = 'flex';
  actualizarHeaderEmpresa(empresa);
  mostrarPantalla('upv');
}

function recuperarEmpresa() {
  const saved = localStorage.getItem(UPV_LS_EMPRESA);
  if (!saved) return;
  UPV.empresa = saved;
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('upv-app').style.display = 'flex';
  actualizarHeaderEmpresa(saved);
  mostrarPantalla('upv');
}

function actualizarHeaderEmpresa(empresa) {
  const el = document.getElementById('upv-empresa-label');
  if (el) { el.textContent = empresa; el.className = 'header-empresa emp-tag ' + empresa; }
}

function cerrarSesion() {
  try { localStorage.removeItem(UPV_LS_EMPRESA); } catch(e) {}
  UPV.empresa = null;
  document.getElementById('upv-app').style.display = 'none';
  document.getElementById('screen-login').style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════════════════════
function bindNavBtns() {
  document.querySelectorAll('.nav-btn[data-screen]').forEach(btn =>
    btn.addEventListener('click', () => mostrarPantalla(btn.dataset.screen))
  );
}

function mostrarPantalla(id) {
  UPV.pantalla = id;
  document.querySelectorAll('.upv-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const screen = document.getElementById('screen-' + id);
  const btn    = document.querySelector('.nav-btn[data-screen="' + id + '"]');
  if (screen) screen.classList.add('active');
  if (btn)    btn.classList.add('active');
  if (id === 'upv') renderHistorial();
}

// ═══════════════════════════════════════════════════════════
// FOTOGRAFÍAS REALES (Objetivo 2)
// ═══════════════════════════════════════════════════════════
function bindFotoInputs() {
  const inpOp  = document.getElementById('foto-input-operacion');
  const inpObs = document.getElementById('foto-input-observacion');
  if (inpOp)  inpOp.addEventListener('change',  e => procesarFotos(e.target.files, 'operacion'));
  if (inpObs) inpObs.addEventListener('change', e => procesarFotos(e.target.files, 'observacion'));
}

function procesarFotos(files, modulo) {
  if (!files || !files.length) return;
  const estado = modulo === 'operacion' ? UPV.fotosOperacion : UPV.fotosObservacion;
  const max = UPV_MAX_FOTOS - estado.length;
  if (max <= 0) { mostrarError('Máximo ' + UPV_MAX_FOTOS + ' fotos por reporte.'); return; }
  const lista = Array.from(files).slice(0, max);
  lista.forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      const originalSize = file.size;
      comprimirImagen(ev.target.result, file.type).then(dataUrl => {
        const foto = {
          id:             'foto_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          dataUrl:        dataUrl,
          nombre:         file.name,
          tipo:           file.type || 'image/jpeg',
          sizeOriginal:   originalSize,
          sizeComprimido: Math.round(dataUrl.length * 0.75),
          createdAt:      new Date().toISOString()
        };
        if (modulo === 'operacion') UPV.fotosOperacion.push(foto);
        else                        UPV.fotosObservacion.push(foto);
        renderFotosPreview(modulo);
      });
    };
    reader.readAsDataURL(file);
  });
  // Limpiar el input para permitir re-seleccionar el mismo archivo
  const inp = document.getElementById('foto-input-' + modulo);
  if (inp) inp.value = '';
}

function comprimirImagen(dataUrl, tipo) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > UPV_IMG_MAX_PX || height > UPV_IMG_MAX_PX) {
        const ratio = Math.min(UPV_IMG_MAX_PX / width, UPV_IMG_MAX_PX / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', UPV_IMG_QUALITY));
    };
    img.onerror = () => resolve(dataUrl); // si falla, usar original
    img.src = dataUrl;
  });
}

function renderFotosPreview(modulo) {
  const fotos     = modulo === 'operacion' ? UPV.fotosOperacion : UPV.fotosObservacion;
  const contenId  = 'fotos-preview-' + modulo;
  const contadorId= 'fotos-count-' + modulo;
  const cont = document.getElementById(contenId);
  const cnt  = document.getElementById(contadorId);
  if (cnt) cnt.textContent = fotos.length + '/' + UPV_MAX_FOTOS;
  if (!cont) return;
  if (!fotos.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = fotos.map((f, i) => `
    <div style="position:relative;display:inline-block;margin:4px">
      <img src="${f.dataUrl}" alt="foto ${i+1}"
           style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:2px solid var(--border)">
      <button onclick="eliminarFoto('${modulo}',${i})"
              style="position:absolute;top:-6px;right:-6px;background:#ef4444;border:none;
                     color:#fff;border-radius:50%;width:20px;height:20px;font-size:12px;
                     line-height:20px;cursor:pointer;padding:0">✕</button>
    </div>`).join('');
}

function eliminarFoto(modulo, index) {
  if (modulo === 'operacion') UPV.fotosOperacion.splice(index, 1);
  else                        UPV.fotosObservacion.splice(index, 1);
  renderFotosPreview(modulo);
}

// ═══════════════════════════════════════════════════════════
// GPS ROBUSTO (Objetivo 3)
// ═══════════════════════════════════════════════════════════
const GPS_TIMEOUT_ANDROID = 35000;

function capturarGpsUpv(modulo) {
  const statusId = modulo === 'operacion' ? 'upv-gps-status' : 'obs-gps-status';
  const statusEl = document.getElementById(statusId);

  if (!navigator.geolocation) {
    _setGpsStatus(statusEl, 'error', '⚠️ GPS no disponible en este dispositivo');
    _setGpsResult(modulo, null, 'unavailable');
    return;
  }

  _setGpsStatus(statusEl, 'buscando', '📡 Obteniendo ubicación...');

  const opsFresh  = { enableHighAccuracy: true, timeout: GPS_TIMEOUT_ANDROID, maximumAge: 0 };
  const opsRecent = { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 };

  navigator.geolocation.getCurrentPosition(
    pos => {
      const r = _buildGpsResult(pos, 'fresh');
      _setGpsResult(modulo, r);
      _setGpsStatus(statusEl, 'ok',
        '📍 GPS capturado · Precisión: ±' + r.accuracy + ' m');
    },
    _err1 => {
      console.warn('[UPV-GPS] intento fresco falló, intentando reciente...', _err1.message);
      navigator.geolocation.getCurrentPosition(
        pos => {
          const r = _buildGpsResult(pos, 'recent');
          _setGpsResult(modulo, r);
          _setGpsStatus(statusEl, 'warn',
            '🕐 Ubicación reciente · Precisión: ±' + r.accuracy + ' m');
        },
        _err2 => {
          _setGpsResult(modulo, null, 'unavailable');
          if (_err2.code === 1) {
            _setGpsStatus(statusEl, 'error', '🚫 Permiso denegado. Revisa configuración.');
          } else {
            _setGpsStatus(statusEl, 'error', '⚠️ GPS sin señal. Intenta en exteriores.');
          }
        },
        opsRecent
      );
    },
    opsFresh
  );
}

function _buildGpsResult(pos, source) {
  return {
    lat:         pos.coords.latitude,
    lon:         pos.coords.longitude,
    accuracy:    Math.round(pos.coords.accuracy),
    source:      source,
    capturedAt:  new Date().toISOString()
  };
}

function _setGpsResult(modulo, gps) {
  if (modulo === 'operacion') UPV.gpsOperacion  = gps;
  else                        UPV.gpsObservacion = gps;
}

function _setGpsStatus(el, estado, texto) {
  if (!el) return;
  const colores = { buscando: 'var(--orange)', ok: 'var(--green)', warn: 'var(--orange)', error: 'var(--red)' };
  el.innerHTML = `<span style="color:${colores[estado] || 'var(--txt2)'}">${texto}</span>`;
}

// ═══════════════════════════════════════════════════════════
// FORM EVENTS
// ═══════════════════════════════════════════════════════════
function bindFormEvents() {
  document.querySelectorAll('.tipo-btn').forEach(btn =>
    btn.addEventListener('click', () => seleccionarTipo(btn.dataset.tipo))
  );
  const btnObs = document.getElementById('btn-guardar-obs');
  if (btnObs) btnObs.addEventListener('click', guardarObservacion);
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', cerrarSesion);
}

function upvOnOrigenChange(val) {
  var wrap = document.getElementById('upv-pozo-wrap');
  var sel  = document.getElementById('upv-pozo');
  var err  = document.getElementById('upv-pozo-error');
  if (!wrap) return;
  if (val === 'POZO') {
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
    if (sel) sel.value = '';
    if (err) err.style.display = 'none';
  }
}

function seleccionarTipo(tipo) {
  UPV.tipoOp = tipo;
  UPV.gpsOperacion  = null;
  UPV.fotosOperacion = [];
  document.querySelectorAll('.tipo-btn').forEach(b =>
    b.classList.remove('active-carga', 'active-descarga'));
  const btn = document.querySelector('.tipo-btn[data-tipo="' + tipo + '"]');
  if (btn) btn.classList.add(tipo === 'CARGA' ? 'active-carga' : 'active-descarga');

  const contenedor = document.getElementById('campos-dinamicos');
  if (!contenedor) return;

  if (tipo === 'CARGA') {
    contenedor.innerHTML = `
      <div class="upv-card">
        <div class="upv-label">EN</div>
        <select id="upv-origen" class="upv-select" onchange="upvOnOrigenChange(this.value)">
          <option value="">Seleccionar origen...</option>
          <option value="POZO">POZO</option>
          <option value="ECO">ECO</option>
          <option value="PIA">PIA</option>
        </select>
      </div>
      <div id="upv-pozo-wrap" class="upv-card" style="display:none">
        <div class="upv-label">POZO / LUGAR</div>
        <select id="upv-pozo" class="upv-select">
          <option value="">Seleccionar pozo...</option>
          <option value="352">352</option>
          <option value="505">505</option>
          <option value="376">376</option>
          <option value="172">172</option>
          <option value="602">602</option>
          <option value="601">601</option>
          <option value="107">107</option>
          <option value="603">603</option>
        </select>
        <div id="upv-pozo-error" style="color:#ef4444;font-size:12px;margin-top:6px;display:none">
          Selecciona un pozo antes de continuar.
        </div>
      </div>
      <div class="upv-card">
        <div class="upv-label">Cantidad (bbls)</div>
        <input id="upv-cantidad" type="number" inputmode="decimal"
               class="upv-input" placeholder="0.0" step="0.1" min="0">
      </div>
      <div class="upv-card">
        <div class="upv-label">
          Fotografías
          <span id="fotos-count-operacion" style="font-size:11px;color:var(--accent2);margin-left:8px">0/${UPV_MAX_FOTOS}</span>
        </div>
        <label style="display:flex;align-items:center;gap:10px;padding:14px;background:var(--surface2);
                      border-radius:10px;border:1.5px dashed var(--border);cursor:pointer;color:var(--txt2);font-size:13px">
          <span style="font-size:24px">📸</span>
          <span>Tomar foto o seleccionar de galería</span>
          <input id="foto-input-operacion" type="file" accept="image/*" capture="environment"
                 multiple style="display:none">
        </label>
        <div id="fotos-preview-operacion" style="margin-top:8px"></div>
      </div>
      <div class="upv-card">
        <div class="upv-label">GPS</div>
        <div class="gps-mock" id="upv-gps-status">
          <span style="color:var(--txt2)">📡 Toca para capturar ubicación</span>
        </div>
        <button class="upv-btn mt8" style="padding:10px;font-size:13px"
                onclick="capturarGpsUpv('operacion')">📍 Capturar GPS</button>
      </div>
      <button id="btn-termino" class="upv-btn green mt12">✅ TÉRMINO</button>
    `;
    document.getElementById('foto-input-operacion')
      .addEventListener('change', e => procesarFotos(e.target.files, 'operacion'));
    const t = document.getElementById('btn-termino');
    if (t) t.addEventListener('click', previsualizarReporte);
    capturarGpsUpv('operacion');
  } else {
    contenedor.innerHTML = `
      <div class="upv-msg-provisional">
        ⚠️ Los campos de descarga serán configurados posteriormente.
      </div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// GENERADOR DE ID ÚNICO (Objetivo 6)
// ═══════════════════════════════════════════════════════════
function generarIdUpv() {
  const ts  = Date.now();
  const rnd = Math.random().toString(36).slice(2, 9);
  return 'upv_' + ts + '_' + rnd;
}

// ═══════════════════════════════════════════════════════════
// DEDUPLICACIÓN LOCAL (Objetivo 7)
// ═══════════════════════════════════════════════════════════
async function firmaExisteReciente(empresa, unidad, tipo, origen, cantidad) {
  if (!UPV.db) return false;
  try {
    const todos = await idbGetAll('reportes');
    const ahora = Date.now();
    const firma = [empresa, unidad, tipo, origen, String(cantidad)].join('|').toLowerCase();
    return todos.some(r => {
      const rFirma = [r.empresa, r.unidad, r.tipo, r.origen, String(r.cantidad)].join('|').toLowerCase();
      const age    = ahora - new Date(r.createdAt).getTime();
      return rFirma === firma && age < UPV_DEDUP_WINDOW;
    });
  } catch(e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// PREVIEW Y CONFIRMACIÓN (Objetivo 6)
// ═══════════════════════════════════════════════════════════
async function previsualizarReporte() {
  const btn = document.getElementById('btn-termino');
  if (UPV.saveInProgress) return;

  // Validaciones
  const unidad   = (document.getElementById('upv-unidad')?.value || '').trim();
  const origen   = document.getElementById('upv-origen')?.value  || '';
  const cantRaw  = document.getElementById('upv-cantidad')?.value || '';
  const cantidad = parseFloat(cantRaw);

  if (!UPV.empresa)      return mostrarError('Selecciona una empresa.');
  if (!unidad)           return mostrarError('Ingresa el número de unidad.');
  if (!origen)           return mostrarError('Selecciona el origen: POZO / ECO / PIA.');
  const pozo = (origen === 'POZO') ? (document.getElementById('upv-pozo')?.value || '') : '';
  if (origen === 'POZO' && !pozo) {
    const errEl = document.getElementById('upv-pozo-error');
    if (errEl) errEl.style.display = 'block';
    mostrarError('Selecciona el pozo antes de continuar.');
    return;
  }
  const _errElOk = document.getElementById('upv-pozo-error');
  if (_errElOk) _errElOk.style.display = 'none';
  if (isNaN(cantidad) || cantidad <= 0) return mostrarError('Ingresa una cantidad válida mayor que cero.');

  // Advertencia GPS
  let confirmGps = true;
  if (!UPV.gpsOperacion) {
    confirmGps = await mostrarConfirmacion(
      '⚠️ GPS no capturado',
      'No se registró ubicación GPS. ¿Deseas guardar el reporte sin GPS?'
    );
    if (!confirmGps) return;
  }

  // Verificar duplicado
  const esDuplicado = await firmaExisteReciente(UPV.empresa, unidad, 'CARGA', origen, cantidad);
  if (esDuplicado) {
    const ok = await mostrarConfirmacion(
      '⚠️ Posible duplicado',
      'Este reporte parece haberse guardado recientemente. ¿Guardar de todas formas?'
    );
    if (!ok) return;
  }

  // Bloquear botón
  if (btn) { btn.disabled = true; UPV.saveInProgress = true; }

  const preview  = document.getElementById('upv-preview');
  const formPpal = document.getElementById('upv-form-principal');
  if (!preview) { desbloquearTermino(); return; }

  const ahora = new Date();
  const hora  = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const fecha = ahora.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  preview.innerHTML = `
    <div class="upv-card" style="border-color:var(--accent2)">
      <div class="upv-label" style="color:var(--accent2)">Vista previa del reporte</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span class="emp-tag ${UPV.empresa}">${UPV.empresa}</span>
        <span class="fs13 txt2">CARGA</span>
      </div>
      <div class="fs13 txt2">📅 ${fecha} · ${hora}</div>
      <div class="upv-sep"></div>
      <div class="mt8"><div class="upv-label">Unidad</div><div class="fw7" style="font-size:18px">${unidad}</div></div>
      <div class="mt8"><div class="upv-label">Origen</div><div class="fw7">${origen}</div></div>
      ${pozo ? '<div class="mt8"><div class="upv-label">Pozo</div><div class="fw7" style="font-size:18px">' + pozo + '</div></div>' : ''}
      <div class="mt8"><div class="upv-label">Cantidad</div><div class="fw7" style="font-size:18px">${cantidad} bbls</div></div>
      <div class="mt8 fs13 txt2">${UPV.gpsOperacion
        ? '📍 GPS: ±' + UPV.gpsOperacion.accuracy + ' m (' + UPV.gpsOperacion.source + ')'
        : '📍 Sin GPS'}</div>
      <div class="mt8 fs13 txt2">📸 ${UPV.fotosOperacion.length} foto(s)</div>
    </div>
    <div style="display:flex;gap:10px;margin-top:8px">
      <button id="btn-cancelar-preview" class="upv-btn"
              style="background:var(--surface2);color:var(--txt2);box-shadow:none;flex:1">Cancelar</button>
      <button id="btn-confirmar" class="upv-btn green" style="flex:2">✅ Confirmar y guardar</button>
    </div>`;

  preview.style.display = 'block';
  if (formPpal) formPpal.style.display = 'none';
  document.getElementById('btn-cancelar-preview')?.addEventListener('click', () => { cerrarPreview(); desbloquearTermino(); });
  document.getElementById('btn-confirmar')?.addEventListener('click', () => confirmarGuardado({ unidad, origen, cantidad, pozo }));
}

function desbloquearTermino() {
  UPV.saveInProgress = false;
  const btn = document.getElementById('btn-termino');
  if (btn) btn.disabled = false;
}

function cerrarPreview() {
  const preview  = document.getElementById('upv-preview');
  const formPpal = document.getElementById('upv-form-principal');
  if (preview)  preview.style.display = 'none';
  if (formPpal) formPpal.style.display = 'block';
}

async function confirmarGuardado({ unidad, origen, cantidad, pozo }) {
  const id = generarIdUpv();
  try {
    // 1. Guardar fotos en IDB
    const fotoIds = [];
    for (const f of UPV.fotosOperacion) {
      const fotoDoc = Object.assign({ reporteId: id }, f);
      await idbPut('fotos', fotoDoc);
      fotoIds.push(f.id);
    }
    // 2. Construir y guardar reporte
    const reporte = {
      id,
      empresa:        UPV.empresa,
      tipo:           'CARGA',
      unidad,
      origen,
      pozo:           pozo || null,
      lugarDetalle:   pozo || null,
      cantidad,
      gps:            UPV.gpsOperacion || null,
      fotoIds,
      fecha:          new Date().toISOString(),
      estadoLocal:    'guardado',
      syncStatus:     'pendiente',
      whatsappStatus: 'no_configurado',
      createdAt:      new Date().toISOString()
    };
    await idbPut('reportes', reporte);
    // 3. Limpiar y cerrar
    resetFormularioOperacion();
    cerrarPreview();
    mostrarPantalla('upv');
    mostrarExito('✅ Reporte guardado localmente');
  } catch(e) {
    console.error('[UPV] Error al guardar:', e);
    mostrarError('❌ Error al guardar: ' + e.message);
    desbloquearTermino();
  }
}

function resetFormularioOperacion() {
  const un = document.getElementById('upv-unidad');
  if (un) un.value = '';
  UPV.tipoOp        = null;
  UPV.gpsOperacion  = null;
  UPV.fotosOperacion = [];
  UPV.saveInProgress = false;
  const din = document.getElementById('campos-dinamicos');
  if (din) din.innerHTML = '';
  document.querySelectorAll('.tipo-btn').forEach(b =>
    b.classList.remove('active-carga', 'active-descarga'));
}

// ═══════════════════════════════════════════════════════════
// MÓDULO OBSERVACIONES
// ═══════════════════════════════════════════════════════════
async function guardarObservacion() {
  const unidad = (document.getElementById('obs-unidad')?.value || '').trim();
  const texto  = (document.getElementById('obs-texto')?.value  || '').trim();
  const tipo   = document.getElementById('obs-tipo')?.value    || 'normal';

  if (!UPV.empresa) return mostrarError('Selecciona una empresa primero.');
  if (!unidad)      return mostrarError('Ingresa la unidad.');
  if (!texto)       return mostrarError('Escribe la observación.');

  if (!UPV.gpsObservacion) {
    const ok = await mostrarConfirmacion(
      '⚠️ Sin GPS',
      'No se capturó ubicación GPS. ¿Guardar la observación sin GPS?'
    );
    if (!ok) return;
  }

  const id = generarIdUpv();
  try {
    const fotoIds = [];
    for (const f of UPV.fotosObservacion) {
      await idbPut('fotos', Object.assign({ reporteId: id }, f));
      fotoIds.push(f.id);
    }
    const obs = {
      id,
      empresa:        UPV.empresa,
      tipo:           'OBSERVACION',
      subtipo:        tipo,
      unidad,
      texto,
      gps:            UPV.gpsObservacion || null,
      fotoIds,
      fecha:          new Date().toISOString(),
      estadoLocal:    'guardado',
      syncStatus:     'pendiente',
      whatsappStatus: 'no_configurado',
      createdAt:      new Date().toISOString()
    };
    await idbPut('reportes', obs);

    document.getElementById('obs-unidad').value = '';
    document.getElementById('obs-texto').value  = '';
    UPV.fotosObservacion = [];
    UPV.gpsObservacion   = null;
    renderFotosPreview('observacion');
    _setGpsStatus(document.getElementById('obs-gps-status'), 'buscando', '📡 Toca para capturar ubicación');

    mostrarPantalla('upv');
    mostrarExito('✅ Observación guardada localmente');
  } catch(e) {
    console.error('[UPV] Error al guardar observación:', e);
    mostrarError('❌ Error: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════
// HISTORIAL (Objetivo 5)
// ═══════════════════════════════════════════════════════════
async function renderHistorial() {
  const cont = document.getElementById('upv-historial');
  if (!cont) return;

  let reportes = [];
  try {
    if (UPV.db) {
      reportes = await idbGetAll('reportes');
      reportes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  } catch(e) {
    console.warn('[UPV] Error al leer historial:', e);
  }

  if (!reportes.length) {
    cont.innerHTML = '<div class="hist-empty">📋 Sin reportes registrados aún</div>';
    return;
  }

  const visibles = reportes.slice(0, 50);
  cont.innerHTML = visibles.map(r => {
    const esCarga = r.tipo === 'CARGA';
    const esObs   = r.tipo === 'OBSERVACION';
    const titulo  = esCarga ? 'Carga · ' + r.unidad + ' · ' + r.origen + (r.pozo ? ' · Pozo ' + r.pozo : '')
                  : esObs  ? 'Obs · ' + r.unidad
                  : r.tipo;
    const detalle = esCarga ? r.cantidad + ' bbls'
                  : esObs  ? (r.texto || '').slice(0, 60)
                  : '';
    const fechaStr = r.createdAt
      ? new Date(r.createdAt).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';
    const gpsStr  = r.gps
      ? '📍 ±' + r.gps.accuracy + ' m (' + r.gps.source + ')'
      : '📍 Sin GPS';
    const sync    = r.syncStatus === 'sincronizado' ? '✅ Sincronizado' : '⏳ Pendiente';
    const syncClr = r.syncStatus === 'sincronizado' ? 'var(--green)' : 'var(--orange)';
    return `
      <div class="hist-item">
        <div class="hist-item-header">
          <span class="emp-tag ${r.empresa || ''}">${r.empresa || ''}</span>
          <span>${fechaStr}</span>
        </div>
        <div class="hist-item-title">${titulo}</div>
        ${detalle ? '<div class="fs13 txt2 mt8">' + detalle + '</div>' : ''}
        <div class="fs13 txt2 mt8">${gpsStr}</div>
        <div class="fs13 txt2 mt8">📸 ${(r.fotoIds || []).length} foto(s) &nbsp;·&nbsp; Estado: ${r.estadoLocal || '—'}</div>
        <div class="mt8 fs13" style="color:${syncClr}">${sync}</div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// FUNCIONES STUB (para fases futuras)
// ═══════════════════════════════════════════════════════════
function sincronizarPendientesUpv() {
  // TODO Fase 3: conectar con Firebase, subir reportes pendientes, marcar syncStatus
  console.log('[UPV] sincronizarPendientesUpv() — pendiente');
}
function enviarReporteUpv(id) {
  // TODO Fase 3: Cloud Function / UltraMsg
  console.log('[UPV] enviarReporteUpv()', id, '— pendiente');
}
function corregirReporteUpv(id) {
  // TODO Fase 3: edición con ventana de tiempo y editHistory
  console.log('[UPV] corregirReporteUpv()', id, '— pendiente');
}

// ═══════════════════════════════════════════════════════════
// UTILIDADES UI
// ═══════════════════════════════════════════════════════════
function mostrarConfirmacion(titulo, mensaje) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:#1c2d42;border-radius:16px;padding:24px;max-width:320px;width:100%;border:1px solid rgba(255,255,255,.15)">
        <div style="font-size:15px;font-weight:800;color:#e8edf2;margin-bottom:10px">${titulo}</div>
        <div style="font-size:13px;color:#8aa4bf;margin-bottom:20px;line-height:1.6">${mensaje}</div>
        <div style="display:flex;gap:10px">
          <button id="conf-no"  style="flex:1;padding:12px;border-radius:10px;border:none;background:#142032;color:#8aa4bf;font-size:14px;font-weight:700;cursor:pointer">Cancelar</button>
          <button id="conf-yes" style="flex:1;padding:12px;border-radius:10px;border:none;background:#1e6fbf;color:#fff;font-size:14px;font-weight:700;cursor:pointer">Continuar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#conf-yes').addEventListener('click', () => { modal.remove(); resolve(true);  });
    modal.querySelector('#conf-no').addEventListener('click',  () => { modal.remove(); resolve(false); });
  });
}

function mostrarError(msg) {
  const t = _crearToast(msg, 'var(--red)');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function mostrarExito(msg) {
  const t = _crearToast(msg, 'var(--green)');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function _crearToast(msg, color) {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
    background: '#1c2d42', color, border: '1.5px solid ' + color,
    borderRadius: '12px', padding: '12px 20px', fontSize: '13px', fontWeight: '700',
    zIndex: '9999', maxWidth: '90vw', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,.4)'
  });
  el.textContent = msg;
  return el;
}


// ═══════════════════════════════════════════════════════════
// OBJETIVO 1 — BOTÓN ACTUALIZAR
// Seguro: solo elimina cachés upv-pwa-*, solo opera sobre
// el SW del scope ./ de UPV. No toca otros SWs.
// ═══════════════════════════════════════════════════════════
function upvActualizarApp() {
  var btn = document.getElementById('upv-update-btn');
  var msg = document.getElementById('upv-update-msg');
  if (btn) btn.disabled = true;
  if (msg) msg.textContent = 'Actualizando...';

  var limpiarCachesUpv = function() {
    if (!('caches' in window)) return Promise.resolve();
    return caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(k) { return k.startsWith('upv-pwa-'); })
          .map(function(k) { return caches.delete(k); })
      );
    });
  };

  // Solo el SW de este scope (./), no getRegistrations() global
  var actualizarSW = function() {
    if (!('serviceWorker' in navigator)) return Promise.resolve();
    return navigator.serviceWorker.getRegistration('./').then(function(reg) {
      if (reg) {
        return reg.update().catch(function() {});
      }
    });
  };

  limpiarCachesUpv()
    .then(actualizarSW)
    .then(function() {
      // Recarga con parámetro de versión para evitar caché del navegador
      var url = location.href.split('?')[0] + '?v=' + Date.now();
      location.replace(url);
    })
    .catch(function(e) {
      console.warn('[UPV] Error al actualizar:', e);
      if (msg) msg.textContent = 'Error al actualizar. Recarga manualmente.';
      if (btn) btn.disabled = false;
    });
}

// ═══════════════════════════════════════════════════════════
// OBJETIVO 2 — ESTADO DE PERMISOS
// Independiente de la app de recorredores.
// No registra FCM, no modifica Firebase, no bloquea la app.
// ═══════════════════════════════════════════════════════════
var _upvLastGps = null; // última lectura GPS para mostrar precisión

function upvVerificarPermisos() {
  var gpsIcon  = document.getElementById('upv-ps-gps-icon');
  var gpsTxt   = document.getElementById('upv-ps-gps-txt');
  var valIcon  = document.getElementById('upv-ps-val-icon');
  var valTxt   = document.getElementById('upv-ps-val-txt');
  var notifIcon= document.getElementById('upv-ps-notif-icon');
  var notifTxt = document.getElementById('upv-ps-notif-txt');

  // GPS permission
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then(function(r) {
      if (r.state === 'granted') {
        if (gpsIcon) gpsIcon.textContent = '✅';
        if (gpsTxt)  { gpsTxt.textContent = 'Activada'; gpsTxt.style.color = '#4ade80'; }
        // Intentar lectura fresca sin pedir permiso de nuevo
        navigator.geolocation.getCurrentPosition(
          function(p) {
            _upvLastGps = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
            if (valIcon) valIcon.textContent = '✅';
            if (valTxt)  { valTxt.textContent = '±' + _upvLastGps.acc + ' m'; valTxt.style.color = '#4ade80'; }
          },
          function() {
            if (_upvLastGps) {
              if (valIcon) valIcon.textContent = '⚠️';
              if (valTxt)  { valTxt.textContent = '±' + _upvLastGps.acc + ' m (cacheado)'; valTxt.style.color = '#facc15'; }
            } else {
              if (valIcon) valIcon.textContent = '⚠️';
              if (valTxt)  { valTxt.textContent = 'Sin lectura'; valTxt.style.color = '#facc15'; }
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      } else if (r.state === 'denied') {
        if (gpsIcon) gpsIcon.textContent = '🚫';
        if (gpsTxt)  { gpsTxt.textContent = 'Bloqueada'; gpsTxt.style.color = '#f87171'; }
        if (valIcon) valIcon.textContent = '❌';
        if (valTxt)  { valTxt.textContent = 'Sin lectura'; valTxt.style.color = '#f87171'; }
      } else {
        if (gpsIcon) gpsIcon.textContent = '⚪';
        if (gpsTxt)  { gpsTxt.textContent = 'Sin activar'; gpsTxt.style.color = '#facc15'; }
        if (valIcon) valIcon.textContent = '⚪';
        if (valTxt)  { valTxt.textContent = 'Sin lectura'; valTxt.style.color = '#facc15'; }
      }
    }).catch(function() {
      // Navegador sin API permissions (Safari antiguo)
      if (gpsIcon) gpsIcon.textContent = '❓';
      if (gpsTxt)  { gpsTxt.textContent = 'No disponible'; gpsTxt.style.color = '#94a3b8'; }
      if (valIcon) valIcon.textContent = '❓';
      if (valTxt)  { valTxt.textContent = 'Sin lectura'; valTxt.style.color = '#94a3b8'; }
    });
  } else {
    if (gpsIcon) gpsIcon.textContent = '❓';
    if (gpsTxt)  { gpsTxt.textContent = 'No disponible'; gpsTxt.style.color = '#94a3b8'; }
  }

  // Notificaciones
  if ('Notification' in window) {
    var perm = Notification.permission;
    if (perm === 'granted') {
      if (notifIcon) notifIcon.textContent = '✅';
      if (notifTxt)  { notifTxt.textContent = 'Activadas'; notifTxt.style.color = '#4ade80'; }
    } else if (perm === 'denied') {
      if (notifIcon) notifIcon.textContent = '🚫';
      if (notifTxt)  { notifTxt.textContent = 'Bloqueadas'; notifTxt.style.color = '#f87171'; }
    } else {
      if (notifIcon) notifIcon.textContent = '⚪';
      if (notifTxt)  { notifTxt.textContent = 'Sin activar'; notifTxt.style.color = '#facc15'; }
    }
  } else {
    if (notifIcon) notifIcon.textContent = '❓';
    if (notifTxt)  { notifTxt.textContent = 'No compatible'; notifTxt.style.color = '#94a3b8'; }
  }
}

function upvActivarPermisos() {
  var btnActivar = document.getElementById('upv-ps-activar-btn');
  if (btnActivar) { btnActivar.disabled = true; btnActivar.textContent = 'Activando...'; }

  var done = 0;
  var total = 2;
  var onDone = function() {
    done++;
    if (done >= total) {
      if (btnActivar) { btnActivar.disabled = false; btnActivar.textContent = 'Activar GPS y notificaciones'; }
      upvVerificarPermisos();
    }
  };

  // 1. Solicitar GPS
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(p) {
        _upvLastGps = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
        onDone();
      },
      function() { onDone(); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  } else {
    onDone();
  }

  // 2. Solicitar notificaciones (sin FCM, sin tokens)
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(function() { onDone(); }).catch(function() { onDone(); });
  } else {
    onDone();
  }
}

// Exponer globalmente para onclick del HTML
window.upvActualizarApp    = upvActualizarApp;
window.upvVerificarPermisos = upvVerificarPermisos;
window.upvActivarPermisos   = upvActivarPermisos;
window.upvOnOrigenChange    = upvOnOrigenChange;

// Exponer globalmente lo que se llama desde HTML inline
window.cerrarSesion       = cerrarSesion;
window.eliminarFoto       = eliminarFoto;
window.capturarGpsUpv     = capturarGpsUpv;
window.sincronizarPendientesUpv = sincronizarPendientesUpv;
window.enviarReporteUpv   = enviarReporteUpv;
window.corregirReporteUpv = corregirReporteUpv;
