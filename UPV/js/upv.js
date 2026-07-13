// ═══════════════════════════════════════════════════════════
// UPV — Unidades de Producción y Volumen
// js/upv.js — módulo principal, completamente aislado de la
// app de recorredores. Prefijo de localStorage: upv_
// ═══════════════════════════════════════════════════════════
'use strict';

// ── Constantes de localStorage (prefijo upv_ exclusivo) ────
const UPV_KEY_EMPRESA   = 'upv_empresa_seleccionada';
const UPV_KEY_HISTORIAL = 'upv_historial';
const UPV_KEY_PENDIENTES = 'upv_pendientes';

// ── Estado global de la app ────────────────────────────────
const UPV = {
  empresa:    null,
  pantalla:   'upv',    // 'upv' | 'observaciones'
  tipoOp:     null,     // 'CARGA' | 'DESCARGA'
  gpsActual:  null,
  fotos:      [],
  enLinea:    navigator.onLine
};

// ═══════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  registrarSW();
  escucharConexion();
  recuperarEmpresa();
  bindLoginBtns();
  bindNavBtns();
  bindFormEvents();
  renderHistorial();
});

// ── Service Worker ─────────────────────────────────────────
function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { scope: './' })
    .then(reg => console.log('[UPV-SW] registrado:', reg.scope))
    .catch(err => console.warn('[UPV-SW] error:', err));
}

// ── Conexión ───────────────────────────────────────────────
function escucharConexion() {
  const actualizar = () => {
    UPV.enLinea = navigator.onLine;
    const badge = document.getElementById('upv-conn-badge');
    if (!badge) return;
    badge.textContent = UPV.enLinea ? 'EN LÍNEA' : 'SIN CONEXIÓN';
    badge.className = 'conn-badge' + (UPV.enLinea ? '' : ' offline');
    if (UPV.enLinea) sincronizarPendientesUpv();
  };
  window.addEventListener('online',  actualizar);
  window.addEventListener('offline', actualizar);
  actualizar();
}

// ═══════════════════════════════════════════════════════════
// PANTALLA DE ACCESO — selección de empresa
// ═══════════════════════════════════════════════════════════
function bindLoginBtns() {
  document.querySelectorAll('.empresa-btn').forEach(btn => {
    btn.addEventListener('click', () => seleccionarEmpresa(btn.dataset.empresa));
  });
}

function seleccionarEmpresa(empresa) {
  UPV.empresa = empresa;
  try { localStorage.setItem(UPV_KEY_EMPRESA, empresa); } catch(e) {}
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('upv-app').style.display = 'flex';
  actualizarHeaderEmpresa(empresa);
  mostrarPantalla('upv');
}

function recuperarEmpresa() {
  const saved = localStorage.getItem(UPV_KEY_EMPRESA);
  if (saved) {
    UPV.empresa = saved;
    document.getElementById('screen-login').style.display = 'none';
    document.getElementById('upv-app').style.display = 'flex';
    actualizarHeaderEmpresa(saved);
    mostrarPantalla('upv');
  }
}

function actualizarHeaderEmpresa(empresa) {
  const el = document.getElementById('upv-empresa-label');
  if (el) {
    el.textContent = empresa;
    el.className = 'header-empresa emp-tag ' + empresa;
  }
}

function cerrarSesion() {
  try { localStorage.removeItem(UPV_KEY_EMPRESA); } catch(e) {}
  UPV.empresa = null;
  document.getElementById('upv-app').style.display = 'none';
  document.getElementById('screen-login').style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════════════════════
function bindNavBtns() {
  document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => mostrarPantalla(btn.dataset.screen));
  });
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
// MÓDULO UPV — CARGA / DESCARGA
// ═══════════════════════════════════════════════════════════
function bindFormEvents() {
  // Tipo de operación
  document.querySelectorAll('.tipo-btn').forEach(btn => {
    btn.addEventListener('click', () => seleccionarTipo(btn.dataset.tipo));
  });
  // Botón TÉRMINO
  const btnTermino = document.getElementById('btn-termino');
  if (btnTermino) btnTermino.addEventListener('click', previsualizarReporte);

  // Botón confirmar en preview
  const btnConfirmar = document.getElementById('btn-confirmar');
  if (btnConfirmar) btnConfirmar.addEventListener('click', confirmarGuardado);

  // Botón cancelar en preview
  const btnCancelar = document.getElementById('btn-cancelar-preview');
  if (btnCancelar) btnCancelar.addEventListener('click', cerrarPreview);

  // Botón guardar observación
  const btnObs = document.getElementById('btn-guardar-obs');
  if (btnObs) btnObs.addEventListener('click', guardarObservacion);

  // Cerrar sesión
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', cerrarSesion);
}

function seleccionarTipo(tipo) {
  UPV.tipoOp = tipo;
  // Actualizar botones
  document.querySelectorAll('.tipo-btn').forEach(b => {
    b.classList.remove('active-carga', 'active-descarga');
  });
  const btn = document.querySelector('.tipo-btn[data-tipo="' + tipo + '"]');
  if (btn) btn.classList.add(tipo === 'CARGA' ? 'active-carga' : 'active-descarga');

  // Mostrar campos dinámicos
  const contenedor = document.getElementById('campos-dinamicos');
  if (!contenedor) return;

  if (tipo === 'CARGA') {
    contenedor.innerHTML = `
      <div class="upv-card">
        <div class="upv-label">EN</div>
        <select id="upv-origen" class="upv-select">
          <option value="">Seleccionar origen...</option>
          <option value="POZO">POZO</option>
          <option value="ECO">ECO</option>
          <option value="PIA">PIA</option>
        </select>
      </div>

      <div class="upv-card">
        <div class="upv-label">Cantidad (bbls)</div>
        <input id="upv-cantidad" type="number" inputmode="decimal"
               class="upv-input" placeholder="0.0" step="0.1" min="0">
      </div>

      <div class="upv-card">
        <div class="upv-label">Fotografías</div>
        <div class="fotos-mock" onclick="agregarFotosUpv()">
          <span class="cam-icon">📸</span>
          <span>Toca para agregar fotos (próximamente)</span>
        </div>
        <div id="upv-fotos-preview" class="mt8" style="display:none"></div>
      </div>

      <div class="upv-card">
        <div class="upv-label">GPS</div>
        <div class="gps-mock" id="upv-gps-status">
          <div class="gps-dot"></div>
          <span>Ubicación: esperando señal...</span>
        </div>
        <button class="upv-btn mt8" style="padding:10px;font-size:13px"
                onclick="capturarGpsUpv()">📍 Capturar ubicación</button>
      </div>

      <button id="btn-termino" class="upv-btn green mt12">✅ TÉRMINO</button>
    `;
    // Re-bind botón término (fue creado dinámicamente)
    const t = document.getElementById('btn-termino');
    if (t) t.addEventListener('click', previsualizarReporte);
    capturarGpsUpv(); // intentar GPS al cargar
  } else {
    contenedor.innerHTML = `
      <div class="upv-msg-provisional">
        ⚠️ Los campos de descarga serán configurados posteriormente.
      </div>
    `;
  }
}

// ═══════════════════════════════════════════════════════════
// PREVIEW Y CONFIRMACIÓN
// ═══════════════════════════════════════════════════════════
function previsualizarReporte() {
  const unidad   = (document.getElementById('upv-unidad')?.value   || '').trim();
  const origen   = document.getElementById('upv-origen')?.value    || '';
  const cantidad = document.getElementById('upv-cantidad')?.value  || '';

  if (!unidad)   return mostrarError('Ingresa la unidad (número de pipa).');
  if (!origen)   return mostrarError('Selecciona el origen (POZO / ECO / PIA).');
  if (!cantidad) return mostrarError('Ingresa la cantidad en barriles.');

  const preview = document.getElementById('upv-preview');
  if (!preview) return;

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
      <div class="fs13 txt2 mb4">📅 ${fecha} · ${hora}</div>
      <div class="upv-sep"></div>
      <div class="mt8">
        <div class="upv-label">Unidad</div>
        <div class="fw7" style="font-size:18px">${unidad}</div>
      </div>
      <div class="mt8">
        <div class="upv-label">Origen</div>
        <div class="fw7">${origen}</div>
      </div>
      <div class="mt8">
        <div class="upv-label">Cantidad</div>
        <div class="fw7" style="font-size:18px">${cantidad} bbls</div>
      </div>
      ${UPV.gpsActual ? `<div class="mt8"><div class="upv-label">GPS</div><div class="fs13 txt2">📍 ${UPV.gpsActual.lat.toFixed(6)}, ${UPV.gpsActual.lon.toFixed(6)} (±${UPV.gpsActual.acc}m)</div></div>` : '<div class="mt8 fs13 txt2">📍 Sin GPS registrado</div>'}
    </div>
    <div style="display:flex;gap:10px">
      <button id="btn-cancelar-preview" class="upv-btn" style="background:var(--surface2);color:var(--txt2);box-shadow:none;flex:1">Cancelar</button>
      <button id="btn-confirmar" class="upv-btn green" style="flex:2">✅ Confirmar y guardar</button>
    </div>
  `;

  preview.style.display = 'block';
  document.getElementById('upv-form-principal').style.display = 'none';

  // Re-bind (creados dinámicamente)
  document.getElementById('btn-confirmar')?.addEventListener('click', confirmarGuardado);
  document.getElementById('btn-cancelar-preview')?.addEventListener('click', cerrarPreview);
}

function cerrarPreview() {
  document.getElementById('upv-preview').style.display = 'none';
  document.getElementById('upv-form-principal').style.display = 'block';
}

function confirmarGuardado() {
  const reporte = construirReporte();
  guardarReporteUpv(reporte);
  resetFormulario();
  cerrarPreview();
  mostrarPantalla('upv');
  mostrarExito('✅ Reporte guardado localmente');
}

function construirReporte() {
  return {
    id:        Date.now(),
    empresa:   UPV.empresa,
    tipo:      'CARGA',
    unidad:    document.getElementById('upv-unidad')?.value.trim() || '',
    origen:    document.getElementById('upv-origen')?.value || '',
    cantidad:  parseFloat(document.getElementById('upv-cantidad')?.value || '0'),
    gps:       UPV.gpsActual || null,
    fotos:     UPV.fotos.length,
    fecha:     new Date().toISOString(),
    estado:    'local',    // 'local' | 'enviado' | 'pendiente'
    enviado:   false
  };
}

function resetFormulario() {
  const un = document.getElementById('upv-unidad');
  if (un) un.value = '';
  UPV.tipoOp = null;
  UPV.gpsActual = null;
  UPV.fotos = [];
  const din = document.getElementById('campos-dinamicos');
  if (din) din.innerHTML = '';
  document.querySelectorAll('.tipo-btn').forEach(b =>
    b.classList.remove('active-carga', 'active-descarga'));
}

// ═══════════════════════════════════════════════════════════
// MÓDULO OBSERVACIONES
// ═══════════════════════════════════════════════════════════
function guardarObservacion() {
  const unidad = (document.getElementById('obs-unidad')?.value || '').trim();
  const texto  = (document.getElementById('obs-texto')?.value  || '').trim();
  const tipo   = document.getElementById('obs-tipo')?.value || 'normal';

  if (!unidad) return mostrarError('Ingresa la unidad.');
  if (!texto)  return mostrarError('Escribe la observación.');

  const obs = {
    id:      Date.now(),
    empresa: UPV.empresa,
    tipo:    'OBSERVACION',
    subtipo: tipo,
    unidad:  unidad,
    texto:   texto,
    gps:     UPV.gpsActual || null,
    fecha:   new Date().toISOString(),
    estado:  'local',
    enviado: false
  };
  guardarReporteUpv(obs);

  // Limpiar
  if (document.getElementById('obs-unidad'))  document.getElementById('obs-unidad').value  = '';
  if (document.getElementById('obs-texto'))   document.getElementById('obs-texto').value   = '';

  mostrarPantalla('upv');
  mostrarExito('✅ Observación guardada localmente');
}

// ═══════════════════════════════════════════════════════════
// FUNCIONES PREPARADAS (implementación futura)
// ═══════════════════════════════════════════════════════════

// GPS — se integrará con la API nativa del dispositivo
function capturarGpsUpv() {
  const status = document.getElementById('upv-gps-status');
  if (!navigator.geolocation) {
    if (status) status.innerHTML = '<span style="color:var(--red)">⚠️ GPS no disponible</span>';
    return;
  }
  if (status) status.innerHTML = '<div class="gps-dot"></div><span>Obteniendo ubicación...</span>';
  navigator.geolocation.getCurrentPosition(
    pos => {
      UPV.gpsActual = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        acc: Math.round(pos.coords.accuracy),
        ts:  Date.now()
      };
      if (status) status.innerHTML =
        `<span style="color:var(--green)">📍 ${UPV.gpsActual.lat.toFixed(5)}, ${UPV.gpsActual.lon.toFixed(5)} (±${UPV.gpsActual.acc}m)</span>`;
    },
    err => {
      if (status) status.innerHTML =
        `<span style="color:var(--orange)">⚠️ GPS: ${err.code === 1 ? 'permiso denegado' : 'sin señal'}</span>`;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
  );
}

// Fotos — se integrará con la cámara / fileInput
function agregarFotosUpv() {
  // TODO: implementar captura real de fotos
  console.log('[UPV] agregarFotosUpv() — pendiente de implementar');
}

// Guardar reporte — actualmente solo localStorage, luego Firebase
function guardarReporteUpv(reporte) {
  const hist = obtenerHistorialUpv();
  hist.unshift(reporte);
  if (hist.length > 100) hist.pop(); // máx 100 registros locales
  try {
    localStorage.setItem(UPV_KEY_HISTORIAL, JSON.stringify(hist));
  } catch(e) {
    console.warn('[UPV] Error al guardar en localStorage:', e);
  }
  renderHistorial();
}

// Sincronizar pendientes — se conectará a Firebase
function sincronizarPendientesUpv() {
  // TODO: leer upv_pendientes, subir a Firebase, marcar como enviados
  console.log('[UPV] sincronizarPendientesUpv() — pendiente de implementar');
}

// Enviar reporte a WhatsApp vía Cloud Function / UltraMsg
function enviarReporteUpv(reporteId) {
  // TODO: conectar con Cloud Function dedicada
  console.log('[UPV] enviarReporteUpv()', reporteId, '— pendiente de implementar');
}

// Corregir reporte (con ventana de tiempo y editHistory)
function corregirReporteUpv(reporteId) {
  // TODO: implementar correcciones con el mismo patrón que la app principal
  console.log('[UPV] corregirReporteUpv()', reporteId, '— pendiente de implementar');
}

// ═══════════════════════════════════════════════════════════
// HISTORIAL LOCAL
// ═══════════════════════════════════════════════════════════
function obtenerHistorialUpv() {
  try {
    return JSON.parse(localStorage.getItem(UPV_KEY_HISTORIAL) || '[]');
  } catch(e) {
    return [];
  }
}

function renderHistorial() {
  const contenedor = document.getElementById('upv-historial');
  if (!contenedor) return;
  const hist = obtenerHistorialUpv();

  if (!hist.length) {
    contenedor.innerHTML = '<div class="hist-empty">📋 Sin reportes registrados aún</div>';
    return;
  }

  contenedor.innerHTML = hist.slice(0, 30).map(r => {
    const fecha = new Date(r.fecha).toLocaleString('es-MX', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const esCarga = r.tipo === 'CARGA';
    const esObs   = r.tipo === 'OBSERVACION';
    const titulo  = esCarga ? `Carga · Unidad ${r.unidad} · ${r.origen}` :
                    esObs   ? `Obs · Unidad ${r.unidad}` : r.tipo;
    const detalle = esCarga ? `${r.cantidad} bbls` :
                    esObs   ? r.texto.slice(0, 60) : '';
    return `
      <div class="hist-item">
        <div class="hist-item-header">
          <span class="emp-tag ${r.empresa || ''}">${r.empresa || ''}</span>
          <span>${fecha}</span>
        </div>
        <div class="hist-item-title">${titulo}</div>
        ${detalle ? `<div class="fs13 txt2 mt8">${detalle}</div>` : ''}
        <div class="mt8 fs13" style="color:${r.enviado ? 'var(--green)' : 'var(--orange)'}">
          ${r.enviado ? '✅ Enviado' : '⏳ Local — pendiente de envío'}
        </div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// UTILIDADES UI
// ═══════════════════════════════════════════════════════════
function mostrarError(msg) {
  const toast = crearToast(msg, 'var(--red)');
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function mostrarExito(msg) {
  const toast = crearToast(msg, 'var(--green)');
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

function crearToast(msg, color) {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', bottom: '90px', left: '50%',
    transform: 'translateX(-50%)',
    background: '#1c2d42', color: color,
    border: `1.5px solid ${color}`,
    borderRadius: '12px', padding: '12px 20px',
    fontSize: '13px', fontWeight: '700',
    zIndex: '9999', maxWidth: '90vw',
    textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,.4)'
  });
  el.textContent = msg;
  return el;
}
