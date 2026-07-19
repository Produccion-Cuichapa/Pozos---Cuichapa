// UPV Fase 2
// Sin Firebase, sin UltraMsg, sin CDN externos.
// Prefijo exclusivo localStorage/IDB: upv_
'use strict';

// Constantes
// Configuración y estado cargados desde config.js y state.js

document.addEventListener('DOMContentLoaded', async () => {
  registrarSW();

  if (typeof inicializarFirebaseUpv === 'function') {
    inicializarFirebaseUpv();
  }
  escucharConexion();
  await abrirIDB();
  await migrarDesdeLocalStorage();
  recuperarEmpresa();
  bindLoginBtns();
  bindNavBtns();
  bindFormEvents();
  bindFotoInputs();
  await renderHistorial();
});

function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { scope: './' })
    .then(r => console.log('[UPV-SW] registrado:', r.scope))
    .catch(e => console.warn('[UPV-SW] error:', e));
}

function escucharConexion() {
  const update = () => {
    UPV.enLinea = navigator.onLine;
    const badge = document.getElementById('upv-conn-badge');
    if (!badge) return;
    badge.textContent = UPV.enLinea ? 'EN LINEA' : 'SIN CONEXION';
    badge.className = 'conn-badge' + (UPV.enLinea ? '' : ' offline');
    if (UPV.enLinea) sincronizarPendientesUpv();
  };
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}

// ═══════════════════════════════════════════════════════════
// INDEXEDDB — upv_operacion_db v1
// stores: reportes, fotos, configuracion
// ═══════════════════════════════════════════════════════════
function abrirIDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open(UPV_IDB_NAME, UPV_IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('reportes')) {
        const rs = db.createObjectStore('reportes', { keyPath: 'id' });
        rs.createIndex('empresa',    'empresa',    { unique: false });
        rs.createIndex('syncStatus', 'syncStatus', { unique: false });
        rs.createIndex('createdAt',  'createdAt',  { unique: false });
      }
      if (!db.objectStoreNames.contains('fotos')) {
        const fs = db.createObjectStore('fotos', { keyPath: 'id' });
        fs.createIndex('reporteId', 'reporteId', { unique: false });
      }
      if (!db.objectStoreNames.contains('configuracion')) {
        db.createObjectStore('configuracion', { keyPath: 'clave' });
      }
    };
    req.onsuccess = e => { UPV.db = e.target.result; resolve(); };
    req.onerror   = e => { console.warn('[UPV-IDB] error:', e.target.error); resolve(); };
  });
}

function idbTx(store, mode) {
  return UPV.db.transaction(store, mode || 'readonly').objectStore(store);
}
function idbPut(store, obj) {
  return new Promise((res, rej) => {
    const r = idbTx(store, 'readwrite').put(obj);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}
function idbGetAll(store) {
  return new Promise((res, rej) => {
    const r = idbTx(store).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror   = () => rej(r.error);
  });
}
function idbGet(store, key) {
  return new Promise((res, rej) => {
    const r = idbTx(store).get(key);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}

// Migracion desde upv_historial en localStorage (una sola vez)
async function migrarDesdeLocalStorage() {
  if (!UPV.db) return;
  try {
    const existentes = await idbGetAll('reportes');
    if (existentes.length > 0) return;
    const legacy = localStorage.getItem(UPV_LS_HISTORIAL);
    if (!legacy) return;
    const arr = JSON.parse(legacy);
    if (!Array.isArray(arr) || !arr.length) return;
    const yaHecho = await idbGet('configuracion', 'migracion_ls_done');
    if (yaHecho) return;
    for (const r of arr) {
      await idbPut('reportes', Object.assign({
        estadoLocal:    r.estado   || 'guardado',
        syncStatus:     r.enviado  ? 'sincronizado' : 'pendiente',
        whatsappStatus: 'no_configurado',
        fotoIds:        [],
        createdAt:      r.fecha || new Date().toISOString()
      }, r));
    }
    await idbPut('configuracion', {
      clave: 'migracion_ls_done',
      valor: new Date().toISOString()
    });
    console.log('[UPV-IDB] Migracion completada:', arr.length, 'registros');
  } catch(e) {
    console.warn('[UPV-IDB] Error en migracion:', e);
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
// NAVEGACION
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
// FOTOGRAFIAS REALES
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
  const libre  = UPV_MAX_FOTOS - estado.length;
  if (libre <= 0) { mostrarError('Maximo ' + UPV_MAX_FOTOS + ' fotos por reporte.'); return; }
  const lista = Array.from(files).slice(0, libre);
  lista.forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      const sizeOriginal = file.size;
      comprimirImagen(ev.target.result).then(dataUrl => {
        const foto = {
          id:             'foto_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          dataUrl:        dataUrl,
          nombre:         file.name,
          tipo:           file.type || 'image/jpeg',
          sizeOriginal:   sizeOriginal,
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
  const inp = document.getElementById('foto-input-' + modulo);
  if (inp) inp.value = '';
}

function comprimirImagen(dataUrl) {
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
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', UPV_IMG_QUALITY));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function renderFotosPreview(modulo) {
  const fotos    = modulo === 'operacion' ? UPV.fotosOperacion : UPV.fotosObservacion;
  const contId   = 'fotos-preview-' + modulo;
  const cntId    = 'fotos-count-'   + modulo;
  const cont = document.getElementById(contId);
  const cnt  = document.getElementById(cntId);
  if (cnt) cnt.textContent = fotos.length + '/' + UPV_MAX_FOTOS;
  if (!cont) return;
  if (!fotos.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = fotos.map((f, i) =>
    '<div style="position:relative;display:inline-block;margin:4px">' +
    '<img src="' + f.dataUrl + '" alt="foto ' + (i+1) + '" ' +
         'style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:2px solid var(--border)">' +
    '<button onclick="eliminarFoto(\'' + modulo + '\',' + i + ')" ' +
            'style="position:absolute;top:-6px;right:-6px;background:#ef4444;border:none;' +
            'color:#fff;border-radius:50%;width:20px;height:20px;font-size:12px;' +
            'line-height:20px;cursor:pointer;padding:0">x</button>' +
    '</div>'
  ).join('');
}

function eliminarFoto(modulo, index) {
  if (modulo === 'operacion') UPV.fotosOperacion.splice(index, 1);
  else                        UPV.fotosObservacion.splice(index, 1);
  renderFotosPreview(modulo);
}

// ═══════════════════════════════════════════════════════════
// GPS ROBUSTO — fresh 35000ms, fallback recent 5min
// Estados separados: UPV.gpsOperacion / UPV.gpsObservacion
// ═══════════════════════════════════════════════════════════
function capturarGpsUpv(modulo) {
  const statusId = modulo === 'operacion' ? 'upv-gps-status' : 'obs-gps-status';
  const statusEl = document.getElementById(statusId);
  if (!navigator.geolocation) {
    setGpsUI(statusEl, 'error', 'GPS no disponible en este dispositivo');
    setGpsResult(modulo, null);
    return;
  }
  setGpsUI(statusEl, 'buscando', 'Obteniendo ubicacion...');

  navigator.geolocation.getCurrentPosition(
    pos => {
      const r = buildGps(pos, 'fresh');
      setGpsResult(modulo, r);
      setGpsUI(statusEl, 'ok', 'GPS capturado. Precision: +/-' + r.accuracy + ' m');
    },
    err1 => {
      console.warn('[UPV-GPS] fresco fallo, intentando reciente...', err1.message);
      navigator.geolocation.getCurrentPosition(
        pos => {
          const r = buildGps(pos, 'recent');
          setGpsResult(modulo, r);
          setGpsUI(statusEl, 'warn', 'Ubicacion reciente. Precision: +/-' + r.accuracy + ' m');
        },
        err2 => {
          setGpsResult(modulo, null);
          if (err2.code === 1) setGpsUI(statusEl, 'error', 'Permiso denegado. Revisa configuracion.');
          else                 setGpsUI(statusEl, 'error', 'GPS sin senal. Intenta en exteriores.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    },
    { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 }
  );
}

function buildGps(pos, source) {
  return {
    lat:        pos.coords.latitude,
    lon:        pos.coords.longitude,
    accuracy:   Math.round(pos.coords.accuracy),
    source:     source,
    capturedAt: new Date().toISOString()
  };
}
function setGpsResult(modulo, gps) {
  if (modulo === 'operacion') UPV.gpsOperacion  = gps;
  else                        UPV.gpsObservacion = gps;
}
function setGpsUI(el, estado, texto) {
  if (!el) return;
  var colores = { buscando: 'var(--orange)', ok: 'var(--green)', warn: 'var(--orange)', error: 'var(--red)' };
  el.innerHTML = '<span style="color:' + (colores[estado]||'var(--txt2)') + '">' + texto + '</span>';
}

// ═══════════════════════════════════════════════════════════
// FORM EVENTS
// ═══════════════════════════════════════════════════════════
function bindFormEvents() {
  document.querySelectorAll('.tipo-btn').forEach(btn =>
    btn.addEventListener('click', () => seleccionarTipo(btn.dataset.tipo))
  );
  var btnObs = document.getElementById('btn-guardar-obs');
  if (btnObs) btnObs.addEventListener('click', guardarObservacion);
  var btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', cerrarSesion);
}

function seleccionarTipo(tipo) {
  UPV.tipoOp         = tipo;
  UPV.gpsOperacion   = null;
  UPV.fotosOperacion = [];
  document.querySelectorAll('.tipo-btn').forEach(b =>
    b.classList.remove('active-carga', 'active-descarga'));
  var btn = document.querySelector('.tipo-btn[data-tipo="' + tipo + '"]');
  if (btn) btn.classList.add(tipo === 'CARGA' ? 'active-carga' : 'active-descarga');
  var contenedor = document.getElementById('campos-dinamicos');
  if (!contenedor) return;
  if (tipo === 'CARGA') {
    contenedor.innerHTML =
      '<div class="upv-card">' +
        '<div class="upv-label">EN</div>' +
        '<select id="upv-origen" class="upv-select">' +
          '<option value="">Seleccionar origen...</option>' +
          '<option value="POZO">POZO</option>' +
          '<option value="ECO">ECO</option>' +
          '<option value="PIA">PIA</option>' +
        '</select>' +
      '</div>' +
      '<div class="upv-card">' +
        '<div class="upv-label">Cantidad (bbls)</div>' +
        '<input id="upv-cantidad" type="number" inputmode="decimal" class="upv-input" placeholder="0.0" step="0.1" min="0">' +
      '</div>' +
      '<div class="upv-card">' +
        '<div class="upv-label">Fotografias ' +
          '<span id="fotos-count-operacion" style="font-size:11px;color:var(--accent2);margin-left:8px">0/' + UPV_MAX_FOTOS + '</span>' +
        '</div>' +
        '<label style="display:flex;align-items:center;gap:10px;padding:14px;background:var(--surface2);' +
               'border-radius:10px;border:1.5px dashed var(--border);cursor:pointer;color:var(--txt2);font-size:13px">' +
          '<span style="font-size:24px">📸</span>' +
          '<span>Tomar foto o elegir de galeria</span>' +
          '<input id="foto-input-operacion" type="file" accept="image/*" capture="environment" multiple style="display:none">' +
        '</label>' +
        '<div id="fotos-preview-operacion" style="margin-top:8px"></div>' +
      '</div>' +
      '<div class="upv-card">' +
        '<div class="upv-label">GPS</div>' +
        '<div class="gps-mock" id="upv-gps-status">' +
          '<span style="color:var(--txt2)">Toca para capturar ubicacion</span>' +
        '</div>' +
        '<button class="upv-btn mt8" style="padding:10px;font-size:13px" onclick="capturarGpsUpv(\'operacion\')">Capturar GPS</button>' +
      '</div>' +
      '<button id="btn-termino" class="upv-btn green mt12">TERMINO</button>';
    document.getElementById('foto-input-operacion')
      .addEventListener('change', function(e){ procesarFotos(e.target.files, 'operacion'); });
    var t = document.getElementById('btn-termino');
    if (t) t.addEventListener('click', previsualizarReporte);
    capturarGpsUpv('operacion');
  } else {
    contenedor.innerHTML = '<div class="upv-msg-provisional">Los campos de descarga seran configurados posteriormente.</div>';
  }
}

// ═══════════════════════════════════════════════════════════
// ID UNICO
// ═══════════════════════════════════════════════════════════
function generarIdUpv() {
  return 'upv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

// ═══════════════════════════════════════════════════════════
// DEDUPLICACION LOCAL — ventana 60 segundos
// ═══════════════════════════════════════════════════════════
async function firmaExisteReciente(empresa, unidad, tipo, origen, cantidad) {
  if (!UPV.db) return false;
  try {
    var todos  = await idbGetAll('reportes');
    var ahora  = Date.now();
    var firma  = [empresa, unidad, tipo, origen, String(cantidad)].join('|').toLowerCase();
    return todos.some(function(r) {
      var rFirma = [r.empresa, r.unidad, r.tipo, r.origen, String(r.cantidad)].join('|').toLowerCase();
      var age    = ahora - new Date(r.createdAt).getTime();
      return rFirma === firma && age < UPV_DEDUP_WINDOW;
    });
  } catch(e) { return false; }
}

// ═══════════════════════════════════════════════════════════
// PREVIEW Y CONFIRMACION
// ═══════════════════════════════════════════════════════════
async function previsualizarReporte() {
  if (UPV.saveInProgress) return;
  var unidad   = (document.getElementById('upv-unidad')  ? document.getElementById('upv-unidad').value   : '').trim();
  var origen   =  document.getElementById('upv-origen')  ? document.getElementById('upv-origen').value   : '';
  var cantRaw  =  document.getElementById('upv-cantidad') ? document.getElementById('upv-cantidad').value : '';
  var cantidad = parseFloat(cantRaw);
  if (!UPV.empresa)                     return mostrarError('Selecciona una empresa.');
  if (!unidad)                          return mostrarError('Ingresa el numero de unidad.');
  if (!origen)                          return mostrarError('Selecciona origen: POZO / ECO / PIA.');
  if (isNaN(cantidad) || cantidad <= 0) return mostrarError('Ingresa una cantidad valida mayor que cero.');
  if (!UPV.gpsOperacion) {
    var okGps = await mostrarConfirmacion('Sin GPS', 'No se registro GPS. Guardar sin ubicacion?');
    if (!okGps) return;
  }
  var esDup = await firmaExisteReciente(UPV.empresa, unidad, 'CARGA', origen, cantidad);
  if (esDup) {
    var okDup = await mostrarConfirmacion('Posible duplicado', 'Este reporte parece haberse guardado recientemente. Guardar de todas formas?');
    if (!okDup) return;
  }
  UPV.saveInProgress = true;
  var btnT = document.getElementById('btn-termino');
  if (btnT) btnT.disabled = true;
  var preview  = document.getElementById('upv-preview');
  var formPpal = document.getElementById('upv-form-principal');
  if (!preview) { desbloquearTermino(); return; }
  var ahora  = new Date();
  var hora   = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  var fecha  = ahora.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  var gpsStr = UPV.gpsOperacion
    ? 'GPS: +/-' + UPV.gpsOperacion.accuracy + ' m (' + UPV.gpsOperacion.source + ')'
    : 'Sin GPS';
  preview.innerHTML =
    '<div class="upv-card" style="border-color:var(--accent2)">' +
      '<div class="upv-label" style="color:var(--accent2)">Vista previa</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
        '<span class="emp-tag ' + UPV.empresa + '">' + UPV.empresa + '</span>' +
        '<span class="fs13 txt2">CARGA</span>' +
      '</div>' +
      '<div class="fs13 txt2">📅 ' + fecha + ' ' + hora + '</div>' +
      '<div class="upv-sep"></div>' +
      '<div class="mt8"><div class="upv-label">Unidad</div><div class="fw7" style="font-size:18px">' + unidad + '</div></div>' +
      '<div class="mt8"><div class="upv-label">Origen</div><div class="fw7">' + origen + '</div></div>' +
      '<div class="mt8"><div class="upv-label">Cantidad</div><div class="fw7" style="font-size:18px">' + cantidad + ' bbls</div></div>' +
      '<div class="mt8 fs13 txt2">' + gpsStr + '</div>' +
      '<div class="mt8 fs13 txt2">📸 ' + UPV.fotosOperacion.length + ' foto(s)</div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;margin-top:8px">' +
      '<button id="btn-cancelar-preview" class="upv-btn" ' +
              'style="background:var(--surface2);color:var(--txt2);box-shadow:none;flex:1">Cancelar</button>' +
      '<button id="btn-confirmar" class="upv-btn green" style="flex:2">Confirmar y guardar</button>' +
    '</div>';
  preview.style.display = 'block';
  if (formPpal) formPpal.style.display = 'none';
  document.getElementById('btn-cancelar-preview').addEventListener('click', function() {
    cerrarPreview(); desbloquearTermino();
  });
  document.getElementById('btn-confirmar').addEventListener('click', function() {
    confirmarGuardado(unidad, origen, cantidad);
  });
}

function desbloquearTermino() {
  UPV.saveInProgress = false;
  var btn = document.getElementById('btn-termino');
  if (btn) btn.disabled = false;
}

function cerrarPreview() {
  var preview  = document.getElementById('upv-preview');
  var formPpal = document.getElementById('upv-form-principal');
  if (preview)  preview.style.display = 'none';
  if (formPpal) formPpal.style.display = 'block';
}

async function confirmarGuardado(unidad, origen, cantidad) {
  var id = generarIdUpv();
  try {
    var fotoIds = [];
    for (var i = 0; i < UPV.fotosOperacion.length; i++) {
      var f = UPV.fotosOperacion[i];
      await idbPut('fotos', Object.assign({ reporteId: id }, f));
      fotoIds.push(f.id);
    }
    var reporte = {
      id:             id,
      empresa:        UPV.empresa,
      tipo:           'CARGA',
      unidad:         unidad,
      origen:         origen,
      cantidad:       cantidad,
      gps:            UPV.gpsOperacion || null,
      fotoIds:        fotoIds,
      fecha:          new Date().toISOString(),
      estadoLocal:    'guardado',
      syncStatus:     'pendiente',
      whatsappStatus: 'no_configurado',
      createdAt:      new Date().toISOString()
    };
    await idbPut('reportes', reporte);
    resetFormularioOperacion();
    cerrarPreview();
    mostrarPantalla('upv');
    mostrarExito('Reporte guardado localmente');
  } catch(e) {
    console.error('[UPV] Error al guardar:', e);
    mostrarError('Error al guardar: ' + e.message);
    desbloquearTermino();
  }
}

function resetFormularioOperacion() {
  var un = document.getElementById('upv-unidad');
  if (un) un.value = '';
  UPV.tipoOp         = null;
  UPV.gpsOperacion   = null;
  UPV.fotosOperacion = [];
  UPV.saveInProgress = false;
  var din = document.getElementById('campos-dinamicos');
  if (din) din.innerHTML = '';
  document.querySelectorAll('.tipo-btn').forEach(function(b) {
    b.classList.remove('active-carga', 'active-descarga');
  });
}

// ═══════════════════════════════════════════════════════════
// OBSERVACIONES
// ═══════════════════════════════════════════════════════════
async function guardarObservacion() {
  var unidad = (document.getElementById('obs-unidad') ? document.getElementById('obs-unidad').value : '').trim();
  var texto  = (document.getElementById('obs-texto')  ? document.getElementById('obs-texto').value  : '').trim();
  var tipo   =  document.getElementById('obs-tipo')   ? document.getElementById('obs-tipo').value   : 'normal';
  if (!UPV.empresa) return mostrarError('Selecciona una empresa primero.');
  if (!unidad)      return mostrarError('Ingresa la unidad.');
  if (!texto)       return mostrarError('Escribe la observacion.');
  if (!UPV.gpsObservacion) {
    var ok = await mostrarConfirmacion('Sin GPS', 'No se capturo GPS. Guardar sin ubicacion?');
    if (!ok) return;
  }
  var id = generarIdUpv();
  try {
    var fotoIds = [];
    for (var i = 0; i < UPV.fotosObservacion.length; i++) {
      var f = UPV.fotosObservacion[i];
      await idbPut('fotos', Object.assign({ reporteId: id }, f));
      fotoIds.push(f.id);
    }
    await idbPut('reportes', {
      id:             id,
      empresa:        UPV.empresa,
      tipo:           'OBSERVACION',
      subtipo:        tipo,
      unidad:         unidad,
      texto:          texto,
      gps:            UPV.gpsObservacion || null,
      fotoIds:        fotoIds,
      fecha:          new Date().toISOString(),
      estadoLocal:    'guardado',
      syncStatus:     'pendiente',
      whatsappStatus: 'no_configurado',
      createdAt:      new Date().toISOString()
    });
    if (document.getElementById('obs-unidad')) document.getElementById('obs-unidad').value = '';
    if (document.getElementById('obs-texto'))  document.getElementById('obs-texto').value  = '';
    UPV.fotosObservacion = [];
    UPV.gpsObservacion   = null;
    renderFotosPreview('observacion');
    setGpsUI(document.getElementById('obs-gps-status'), 'buscando', 'Toca para capturar ubicacion');
    mostrarPantalla('upv');
    mostrarExito('Observacion guardada localmente');
  } catch(e) {
    console.error('[UPV] Error:', e);
    mostrarError('Error: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════
// HISTORIAL desde IndexedDB
// ═══════════════════════════════════════════════════════════
async function renderHistorial() {
  var cont = document.getElementById('upv-historial');
  if (!cont) return;
  var reportes = [];
  try {
    if (UPV.db) {
      reportes = await idbGetAll('reportes');
      reportes.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    }
  } catch(e) { console.warn('[UPV] historial error:', e); }
  if (!reportes.length) {
    cont.innerHTML = '<div class="hist-empty">📋 Sin reportes registrados aun</div>';
    return;
  }
  cont.innerHTML = reportes.slice(0, 50).map(function(r) {
    var esCarga = r.tipo === 'CARGA';
    var esObs   = r.tipo === 'OBSERVACION';
    var titulo  = esCarga ? 'Carga · ' + r.unidad + ' · ' + r.origen
                : esObs  ? 'Obs · '   + r.unidad
                : r.tipo;
    var detalle = esCarga ? r.cantidad + ' bbls'
                : esObs  ? (r.texto || '').slice(0, 60) : '';
    var fechaStr = r.createdAt
      ? new Date(r.createdAt).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '--';
    var gpsStr  = r.gps ? 'GPS: +/-' + r.gps.accuracy + ' m (' + r.gps.source + ')' : 'Sin GPS';
    var sync    = r.syncStatus === 'sincronizado' ? 'Sincronizado' : 'Pendiente';
    var syncClr = r.syncStatus === 'sincronizado' ? 'var(--green)' : 'var(--orange)';
    return '<div class="hist-item">' +
      '<div class="hist-item-header">' +
        '<span class="emp-tag ' + (r.empresa||'') + '">' + (r.empresa||'') + '</span>' +
        '<span>' + fechaStr + '</span>' +
      '</div>' +
      '<div class="hist-item-title">' + titulo + '</div>' +
      (detalle ? '<div class="fs13 txt2 mt8">' + detalle + '</div>' : '') +
      '<div class="fs13 txt2 mt8">' + gpsStr + '</div>' +
      '<div class="fs13 txt2 mt8">📸 ' + (r.fotoIds||[]).length + ' foto(s) · Estado: ' + (r.estadoLocal||'--') + '</div>' +
      '<div class="mt8 fs13" style="color:' + syncClr + '">' + sync + '</div>' +
    '</div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// STUBS FASE 3
// ═══════════════════════════════════════════════════════════
async function sincronizarPendientesUpv() {
  if (UPV.syncInProgress) return;

  if (
    !UPV.firebaseReady ||
    !UPV.firebaseConnected ||
    !UPV.firebaseDb ||
    !UPV.db
  ) {
    return;
  }

  UPV.syncInProgress = true;

  try {
    var todos = await idbGetAll('reportes');

    var pendientes = todos
      .filter(function(r) {
        return r && r.id && r.syncStatus !== 'sincronizado';
      })
      .sort(function(a, b) {
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

    if (!pendientes.length) {
      console.log('[UPV-SYNC] No hay reportes pendientes');
      return;
    }

    console.log('[UPV-SYNC] Pendientes encontrados:', pendientes.length);

    for (var i = 0; i < pendientes.length; i++) {
      try {
        await enviarReporteUpv(pendientes[i].id);
      } catch (e) {
        console.warn(
          '[UPV-SYNC] Error al enviar reporte',
          pendientes[i].id,
          e.message
        );
      }
    }

    if (typeof renderHistorial === 'function') {
      await renderHistorial();
    }
  } catch (e) {
    console.warn(
      '[UPV-SYNC] Error general en sincronizarPendientesUpv:',
      e.message
    );
  } finally {
    UPV.syncInProgress = false;
  }
}

async function enviarReporteUpv(id) {
  if (
    !id ||
    !UPV.firebaseReady ||
    !UPV.firebaseConnected ||
    !UPV.firebaseDb ||
    !UPV.db
  ) {
    return false;
  }

  try {
    var reporte = await idbGet('reportes', id);

    if (!reporte) {
      console.warn(
        '[UPV-SYNC] Reporte no encontrado en IndexedDB:',
        id
      );
      return false;
    }

    if (reporte.syncStatus === 'sincronizado') {
      console.log('[UPV-SYNC] Reporte ya sincronizado:', id);
      return true;
    }

    var ruta =
      '/' +
      UPV_FIREBASE_TEST_PATH +
      '/' +
      reporte.id;

    var fotoIds = Array.isArray(reporte.fotoIds)
      ? reporte.fotoIds
      : [];

    var payload = {
      id: reporte.id,
      empresa: reporte.empresa || null,
      tipo: reporte.tipo || null,
      subtipo: reporte.subtipo || null,
      unidad: reporte.unidad || null,
      origen: reporte.origen || null,
      cantidad:
        reporte.cantidad !== undefined
          ? reporte.cantidad
          : null,
      texto: reporte.texto || null,
      gps: reporte.gps || null,
      fotoIds: fotoIds,
      nFotos: fotoIds.length,
      fecha: reporte.fecha || null,
      createdAt: reporte.createdAt || null,
      origenApp: 'UPV',
      entorno: 'PRUEBA',
      schemaVersion: 1,
      receivedAtClient: new Date().toISOString()
    };

    await UPV.firebaseDb
      .ref(ruta)
      .set(payload);

    reporte.syncStatus = 'sincronizado';
    reporte.firebasePath = ruta;
    reporte.firebaseSyncedAt = new Date().toISOString();
    reporte.syncError = null;

    await idbPut('reportes', reporte);

    console.log(
      '[UPV-SYNC] Sincronizado correctamente:',
      reporte.id,
      ruta
    );

    return true;
  } catch (e) {
    console.warn(
      '[UPV-SYNC] Error al enviar reporte',
      id,
      e.message
    );

    try {
      var reporteFallido = await idbGet('reportes', id);

      if (reporteFallido) {
        reporteFallido.syncStatus = 'pendiente';
        reporteFallido.syncError =
          e && e.message
            ? e.message
            : String(e);

        await idbPut('reportes', reporteFallido);
      }
    } catch (e2) {
      console.warn(
        '[UPV-SYNC] No se pudo guardar syncError:',
        e2.message
      );
    }

    return false;
  }
}

function corregirReporteUpv(id) {
  console.log(
    '[UPV] corregirReporteUpv pendiente Fase 3, id:',
    id
  );
}

// ═══════════════════════════════════════════════════════════
// UTILIDADES UI
// ═══════════════════════════════════════════════════════════
function mostrarConfirmacion(titulo, mensaje) {
  return new Promise(function(resolve) {
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.75);' +
                          'display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML =
      '<div style="background:#1c2d42;border-radius:16px;padding:24px;max-width:320px;' +
                   'width:100%;border:1px solid rgba(255,255,255,.15)">' +
        '<div style="font-size:15px;font-weight:800;color:#e8edf2;margin-bottom:10px">' + titulo + '</div>' +
        '<div style="font-size:13px;color:#8aa4bf;margin-bottom:20px;line-height:1.6">' + mensaje + '</div>' +
        '<div style="display:flex;gap:10px">' +
          '<button id="conf-no"  style="flex:1;padding:12px;border-radius:10px;border:none;' +
                  'background:#142032;color:#8aa4bf;font-size:14px;font-weight:700;cursor:pointer">Cancelar</button>' +
          '<button id="conf-yes" style="flex:1;padding:12px;border-radius:10px;border:none;' +
                  'background:#1e6fbf;color:#fff;font-size:14px;font-weight:700;cursor:pointer">Continuar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('#conf-yes').addEventListener('click', function() { modal.remove(); resolve(true);  });
    modal.querySelector('#conf-no').addEventListener('click',  function() { modal.remove(); resolve(false); });
  });
}
function mostrarError(msg) {
  var t = crearToast(msg, 'var(--red)'); document.body.appendChild(t);
  setTimeout(function(){ t.remove(); }, 3500);
}
function mostrarExito(msg) {
  var t = crearToast(msg, 'var(--green)'); document.body.appendChild(t);
  setTimeout(function(){ t.remove(); }, 2800);
}
function crearToast(msg, color) {
  var el = document.createElement('div');
  Object.assign(el.style, {
    position:'fixed', bottom:'90px', left:'50%', transform:'translateX(-50%)',
    background:'#1c2d42', color:color, border:'1.5px solid '+color,
    borderRadius:'12px', padding:'12px 20px', fontSize:'13px', fontWeight:'700',
    zIndex:'9999', maxWidth:'90vw', textAlign:'center', boxShadow:'0 4px 20px rgba(0,0,0,.4)'
  });
  el.textContent = msg;
  return el;
}

// Exponer al HTML
window.cerrarSesion             = cerrarSesion;
window.eliminarFoto             = eliminarFoto;
window.capturarGpsUpv           = capturarGpsUpv;
window.sincronizarPendientesUpv = sincronizarPendientesUpv;
window.enviarReporteUpv         = enviarReporteUpv;
window.corregirReporteUpv       = corregirReporteUpv;

// ═══════════════════════════════════════════════════════════
// INSTALACIÓN PWA
// ═══════════════════════════════════════════════════════════
var upvDeferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', function(event) {
  event.preventDefault();
  upvDeferredInstallPrompt = event;

  var btn = document.getElementById('upv-install-btn');
  if (btn) btn.style.display = 'block';
});

document.addEventListener('click', function(event) {
  var btn = event.target.closest('#upv-install-btn');
  if (!btn || !upvDeferredInstallPrompt) return;

  btn.disabled = true;

  upvDeferredInstallPrompt.prompt();

  upvDeferredInstallPrompt.userChoice.finally(function() {
    upvDeferredInstallPrompt = null;
    btn.style.display = 'none';
    btn.disabled = false;
  });
});

window.addEventListener('appinstalled', function() {
  var btn = document.getElementById('upv-install-btn');
  if (btn) btn.style.display = 'none';

  upvDeferredInstallPrompt = null;
  console.log('[UPV] Aplicación instalada');
});

// ═══════════════════════════════════════════════════════════
// ACTUALIZACIÓN MANUAL DE LA PWA
// ═══════════════════════════════════════════════════════════
var upvSwRegistration = null;
var upvRefreshing = false;

function mostrarBotonActualizarUpv() {
  var banner = document.getElementById('upv-update-banner');
  if (banner) banner.classList.add('show');
}

function ocultarBotonActualizarUpv() {
  var banner = document.getElementById('upv-update-banner');
  if (banner) banner.classList.remove('show');
}

async function actualizarAppUpv() {
  var btn = document.getElementById('upv-update-btn');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Actualizando...';
  }

  try {
    if ('serviceWorker' in navigator) {
      var registrations = await navigator.serviceWorker.getRegistrations();

      for (var i = 0; i < registrations.length; i++) {
        var reg = registrations[i];

        if (reg.scope.indexOf('/UPV/') !== -1) {
          await reg.update();

          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }
    }

    if ('caches' in window) {
      var keys = await caches.keys();

      await Promise.all(
        keys
          .filter(function(key) {
            return key.indexOf('upv-pwa-') === 0;
          })
          .map(function(key) {
            return caches.delete(key);
          })
      );
    }

    ocultarBotonActualizarUpv();

    window.location.replace(
      window.location.pathname + '?upv_update=' + Date.now()
    );
  } catch (error) {
    console.error('[UPV] Error al actualizar:', error);
    mostrarError('No fue posible actualizar. Intenta nuevamente.');

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Actualizar';
    }
  }
}

function configurarActualizacionUpv() {
  var btn = document.getElementById('upv-update-btn');

  if (btn) {
    btn.addEventListener('click', actualizarAppUpv);
  }

  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.getRegistration('./').then(function(reg) {
    if (!reg) return;

    upvSwRegistration = reg;

    if (reg.waiting) {
      mostrarBotonActualizarUpv();
    }

    reg.addEventListener('updatefound', function() {
      var nuevoWorker = reg.installing;
      if (!nuevoWorker) return;

      nuevoWorker.addEventListener('statechange', function() {
        if (
          nuevoWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          mostrarBotonActualizarUpv();
        }
      });
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (upvRefreshing) return;
    upvRefreshing = true;
    window.location.reload();
  });
}

document.addEventListener('DOMContentLoaded', configurarActualizacionUpv);

window.actualizarAppUpv = actualizarAppUpv;

// ═══════════════════════════════════════════════════════════
// ACTUALIZACIÓN MANUAL PERMANENTE
// ═══════════════════════════════════════════════════════════
var upvActualizando = false;

async function actualizarAppUpv() {
  if (upvActualizando) return;

  var btn = document.getElementById('upv-update-btn');
  upvActualizando = true;

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Actualizando...';
  }

  try {
    if ('serviceWorker' in navigator) {
      var registros = await navigator.serviceWorker.getRegistrations();

      for (var i = 0; i < registros.length; i++) {
        var reg = registros[i];

        if (reg.scope.indexOf('/UPV/') !== -1) {
          await reg.update();

          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }
    }

    if ('caches' in window) {
      var claves = await caches.keys();

      await Promise.all(
        claves
          .filter(function(clave) {
            return clave.indexOf('upv-pwa-') === 0;
          })
          .map(function(clave) {
            return caches.delete(clave);
          })
      );
    }

    var url = new URL(window.location.href);
    url.searchParams.set('actualizado', Date.now().toString());

    window.location.replace(url.toString());
  } catch (error) {
    console.error('[UPV] No se pudo actualizar:', error);

    if (typeof mostrarError === 'function') {
      mostrarError('No fue posible actualizar. Intenta otra vez.');
    }

    upvActualizando = false;

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Actualizar';
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('upv-update-btn');

  if (btn) {
    btn.addEventListener('click', actualizarAppUpv);
  }
});

window.actualizarAppUpv = actualizarAppUpv;
