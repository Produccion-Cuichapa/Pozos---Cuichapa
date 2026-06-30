// admin.js — Panel Administrativo Campo Cuichapa
// Lee de Firebase RTDB /reportes y /alarmas. Solo lectura.

'use strict';

// ── Config ────────────────────────────────────────────────
var ADMIN_USERS = {
  'AntonioS':    { p: 'Mexico',       role: 'super',       nombre: 'Antonio S.' },
  'JaimeG':      { p: 'Venezuela',    role: 'jefe',        nombre: 'Jaime G.' },
  'IngDuctos':   { p: 'Ductos2024',   role: 'ingenieria',  nombre: 'Ing. Ductos' },
  'Almacenista': { p: 'Bodega2024',   role: 'operacion',   nombre: 'Almacenista' },
  'JorgeGill':   { p: 'Gill2024',     role: 'supervision', nombre: 'Jorge Gill' },
};

var MODOS = {
  co: 'C.O.',
  guardia: 'Guardia',
  cab: 'Cabezal',
  estacion: 'Estación',
  nota: 'Nota',
};

// ── State ─────────────────────────────────────────────────
var db = null;
var currentUser = null;
var allReportes = [];
var allAlarmas  = [];
var filteredReportes = [];
var filteredAlarmas  = [];
var PAGE_SIZE = 50;
var currentPageR = 0;
var currentPageA = 0;
var activeTab = 'reportes';
var isLoading = false;

// ── Init ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function () {
  // Restore session
  try {
    var saved = sessionStorage.getItem('admin_user');
    if (saved) {
      currentUser = JSON.parse(saved);
      showApp();
    }
  } catch (e) {}
  updateConn();
  window.addEventListener('online',  updateConn);
  window.addEventListener('offline', updateConn);
});

function updateConn() {
  var el = document.getElementById('connStatus');
  if (!el) return;
  if (navigator.onLine) {
    el.textContent = '● En línea';
    el.className = 'online';
  } else {
    el.textContent = '● Sin señal';
    el.className = 'offline';
  }
}

// ── LOGIN ─────────────────────────────────────────────────
function doAdminLogin() {
  var user = document.getElementById('adminUser').value.trim();
  var pass = document.getElementById('adminPass').value;
  var err  = document.getElementById('loginErr');
  err.style.display = 'none';

  var found = ADMIN_USERS[user];
  if (!found || pass !== found.p) {
    err.textContent = 'Usuario o contraseña incorrectos';
    err.style.display = 'block';
    document.getElementById('adminPass').value = '';
    return;
  }

  currentUser = { user: user, nombre: found.nombre, role: found.role };
  try { sessionStorage.setItem('admin_user', JSON.stringify(currentUser)); } catch (e) {}
  showApp();
}

function doAdminLogout() {
  currentUser = null;
  allReportes = []; allAlarmas = [];
  try { sessionStorage.removeItem('admin_user'); } catch (e) {}
  document.getElementById('adminApp').style.display    = 'none';
  document.getElementById('loginScreen').style.display  = 'flex';
  document.getElementById('userLabel').style.display    = 'none';
  document.getElementById('btnLogout').style.display    = 'none';
  document.getElementById('adminUser').value = '';
  document.getElementById('adminPass').value = '';
  // Detach Firebase listeners
  if (db) {
    db.ref('reportes').off();
    db.ref('alarmas').off();
  }
}

function showApp() {
  document.getElementById('loginScreen').style.display  = 'none';
  document.getElementById('adminApp').style.display     = 'block';
  document.getElementById('userLabel').textContent      = currentUser.nombre;
  document.getElementById('userLabel').style.display    = 'inline';
  document.getElementById('btnLogout').style.display    = 'block';
  initFirebaseAdmin();
}

// ── FIREBASE ──────────────────────────────────────────────
function initFirebaseAdmin() {
  if (!firebase || !firebase.apps || !firebase.apps.length) {
    setTimeout(initFirebaseAdmin, 300);
    return;
  }
  db = firebase.database();
  loadData();
}

function loadData() {
  if (isLoading) return;  // prevent double-trigger
  isLoading = true;
  setLoadingState(true);

  // Load last 300 reportes ordered by fecha
  db.ref('reportes').orderByChild('fecha').limitToLast(500)
    .once('value', function (snap) {
      allReportes = [];
      snap.forEach(function (child) {
        var r = child.val();
        if (r && !r.esAlarma) allReportes.push(r);
      });
      // Sort newest first
      allReportes.sort(function (a, b) {
        return new Date(b.fecha) - new Date(a.fecha);
      });
      loadAlarmas();
    }, function (err) {
      console.error('Error loading reportes:', err);
      isLoading = false;
      setLoadingState(false);
    });
}

function loadAlarmas() {
  db.ref('alarmas').orderByChild('fecha').limitToLast(100)
    .once('value', function (snap) {
      allAlarmas = [];
      snap.forEach(function (child) {
        var a = child.val();
        if (a) allAlarmas.push(a);
      });
      allAlarmas.sort(function (a, b) {
        return new Date(b.fecha) - new Date(a.fecha);
      });
      isLoading = false;
      setLoadingState(false);
      applyFilters();
      renderStats();
    }, function (err) {
      console.error('Error loading alarmas:', err);
      isLoading = false;
      setLoadingState(false);
    });
}

function setLoadingState(loading) {
  var btn = document.getElementById('btnRefresh');
  if (btn) btn.disabled = loading;
  if (loading) {
    showLoadingRows();
  }
}

function showLoadingRows() {
  // Only overwrite the active tab — avoid flicker on the hidden one
  if (activeTab === 'reportes') {
    var tbody = document.getElementById('reportesTbody');
    if (tbody) tbody.innerHTML = '<tr class="loading-row"><td colspan="7"><span class="spinner"></span>Cargando...</td></tr>';
  } else {
    var adiv = document.getElementById('alarmasList');
    if (adiv) adiv.innerHTML = '<div class="empty-state"><p><span class="spinner"></span>Cargando alarmas...</p></div>';
  }
}

// ── FILTROS ───────────────────────────────────────────────
function applyFilters() {
  var rec    = document.getElementById('filterRec').value;
  var desde  = document.getElementById('filterDesde').value;
  var hasta  = document.getElementById('filterHasta').value;
  var modo   = document.getElementById('filterModo').value;
  var search = (document.getElementById('filterSearch').value || '').toLowerCase().trim();

  var desdeTs = desde ? new Date(desde).getTime() : 0;
  var hastaTs = hasta ? new Date(hasta + 'T23:59:59').getTime() : Infinity;

  filteredReportes = allReportes.filter(function (r) {
    if (rec && r.recorredor !== rec) return false;
    var t = new Date(r.fecha).getTime();
    if (t < desdeTs || t > hastaTs) return false;
    if (modo && r.modo !== modo) return false;
    if (search) {
      var hay = (r.pozo || '') + ' ' + (r.recorredor || '') + ' ' + (r.msg || '') + ' ' + (r.modo || '');
      if (hay.toLowerCase().indexOf(search) === -1) return false;
    }
    return true;
  });

  filteredAlarmas = allAlarmas.filter(function (a) {
    if (rec && (a.quien || a.recorredor) !== rec) return false;
    var t = new Date(a.fecha).getTime();
    if (t < desdeTs || t > hastaTs) return false;
    if (search) {
      var hay = (a.tipo || '') + ' ' + (a.quien || '') + ' ' + (a.lugar || '');
      if (hay.toLowerCase().indexOf(search) === -1) return false;
    }
    return true;
  });

  currentPageR = 0;
  currentPageA = 0;
  renderTabs();
  if (activeTab === 'reportes') renderReportes();
  else renderAlarmas();
}

function clearFilters() {
  document.getElementById('filterRec').value    = '';
  document.getElementById('filterDesde').value  = '';
  document.getElementById('filterHasta').value  = '';
  document.getElementById('filterModo').value   = '';
  document.getElementById('filterSearch').value = '';
  applyFilters();
}

// ── STATS ─────────────────────────────────────────────────
function renderStats() {
  // Total reportes hoy
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var hoyTs = hoy.getTime();
  var rHoy = allReportes.filter(function (r) { return new Date(r.fecha).getTime() >= hoyTs; }).length;
  var aHoy = allAlarmas.filter(function (a)  { return new Date(a.fecha).getTime() >= hoyTs; }).length;
  var rPend = allReportes.filter(function (r) { return r.estado === 'pendiente'; }).length;
  var aTotal = allAlarmas.length;

  setText('statReportesHoy', rHoy);
  setText('statAlarmasHoy',  aHoy);
  setText('statPendientes',  rPend);
  setText('statAlarmasTotal',aTotal);
  setText('statSubR', 'de ' + allReportes.length + ' total');
  setText('statSubA', 'de ' + allAlarmas.length  + ' total');
  setText('statSubP', rPend === 0 ? 'todo enviado ✅' : 'por enviar');
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── TABS ──────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
  document.querySelectorAll('.data-section').forEach(function (s) { s.classList.remove('active'); });
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('section-' + tab).classList.add('active');
  if (tab === 'reportes') renderReportes();
  else renderAlarmas();
}

function renderTabs() {
  var cr = document.getElementById('countR');
  var ca = document.getElementById('countA');
  if (cr) cr.textContent = filteredReportes.length;
  if (ca) ca.textContent = filteredAlarmas.length;
}

// ── RENDER REPORTES ───────────────────────────────────────
function renderReportes() {
  var tbody = document.getElementById('reportesTbody');
  if (!tbody) return;

  if (!filteredReportes.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><p>Sin reportes con los filtros actuales</p></div></td></tr>';
    document.getElementById('paginationR').innerHTML = '';
    return;
  }

  var start = currentPageR * PAGE_SIZE;
  var page  = filteredReportes.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = page.map(function (r) {
    var fecha = fmtFecha(r.fecha);
    var estado = r.estado === 'enviado'
      ? '<span class="badge badge-green">✓ Enviado</span>'
      : '<span class="badge badge-yellow">⏳ Pendiente</span>';
    var modo = '<span class="modo-tag">' + (MODOS[r.modo] || r.modo || '—') + '</span>';
    var pozo = r.pozo ? 'C-' + r.pozo : '—';
    var nFotos = r.nFotos ? '<span class="badge badge-blue">📸 ' + r.nFotos + '</span>' : '';
    var msg = r.msg ? ('<div class="msg-preview">' + escHtml(r.msg.split('\n')[0].replace(/\*/g,'')) + '</div>') : '';
    return '<tr>'
      + '<td>' + fecha + '</td>'
      + '<td><strong>' + escHtml(r.recorredor || '—') + '</strong></td>'
      + '<td>' + pozo + '</td>'
      + '<td>' + modo + '</td>'
      + '<td>' + msg + '</td>'
      + '<td class="hide-mobile">' + (nFotos || '—') + '</td>'
      + '<td>' + estado + '</td>'
      + '</tr>';
  }).join('');

  renderPagination('paginationR', filteredReportes.length, currentPageR, '_goPageR');
}

// ── RENDER ALARMAS ────────────────────────────────────────
function renderAlarmas() {
  var list = document.getElementById('alarmasList');
  if (!list) return;

  if (!filteredAlarmas.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🚨</div><p>Sin alarmas con los filtros actuales</p></div>';
    document.getElementById('paginationA').innerHTML = '';
    return;
  }

  var start = currentPageA * PAGE_SIZE;
  var page  = filteredAlarmas.slice(start, start + PAGE_SIZE);

  list.innerHTML = page.map(function (a) {
    var ws = a.whatsappStatus || 'unknown';
    var wsBadge = ws === 'sent'
      ? '<span class="badge badge-green">✓ WA enviado</span>'
      : ws === 'pending'
      ? '<span class="badge badge-yellow">⏳ Pendiente</span>'
      : ws === 'failed'
      ? '<span class="badge badge-red">✗ Falló</span>'
      : '<span class="badge badge-gray">' + ws + '</span>';

    var statusClass = ws === 'sent' ? 'alarm-sent' : ws === 'pending' ? 'alarm-pending' : 'alarm-failed';
    var tipo = (a.tipo || 'ALARMA').toUpperCase();
    var icon = tipo.includes('DERRAME') ? '🛢' : tipo.includes('PARO') ? '🛑' : tipo.includes('INCENDIO') ? '🔥' : '🚨';
    var fecha = fmtFecha(a.fecha);
    var quien = a.quien || a.recorredor || '—';
    var lugar = a.lugar ? '<br><span style="font-size:11px;color:var(--txt2)">' + escHtml(a.lugar.split('\n')[0]) + '</span>' : '';

    return '<div class="alarm-card ' + statusClass + '">'
      + '<div class="alarm-icon">' + icon + '</div>'
      + '<div>'
      +   '<div class="alarm-tipo">' + escHtml(tipo) + '</div>'
      +   '<div class="alarm-quien">' + escHtml(quien) + lugar + '</div>'
      +   '<div class="alarm-meta">' + fecha + (a.nFotos ? ' · 📸 ' + a.nFotos + ' foto' + (a.nFotos > 1 ? 's' : '') : '') + '</div>'
      + '</div>'
      + '<div class="alarm-status">' + wsBadge + '</div>'
      + '</div>';
  }).join('');

  renderPagination('paginationA', filteredAlarmas.length, currentPageA, '_goPageA');
}

// ── PAGINATION ────────────────────────────────────────────
// Named handlers avoid Function.toString() serialization in innerHTML
function _goPageR(p) { currentPageR = p; renderReportes(); }
function _goPageA(p) { currentPageA = p; renderAlarmas();  }

function renderPagination(containerId, total, currentPage, handlerName) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  var start = currentPage * PAGE_SIZE + 1;
  var end   = Math.min((currentPage + 1) * PAGE_SIZE, total);

  container.innerHTML =
    '<button class="page-btn"'
    + (currentPage === 0 ? ' disabled' : ' onclick="' + handlerName + '(' + (currentPage - 1) + ')"')
    + '>← Anterior</button>'
    + '<span>' + start + '–' + end + ' de ' + total + '</span>'
    + '<button class="page-btn"'
    + (currentPage >= totalPages - 1 ? ' disabled' : ' onclick="' + handlerName + '(' + (currentPage + 1) + ')"')
    + '>Siguiente →</button>';
}

// ── EXCEL EXPORT ──────────────────────────────────────────
function exportarExcel() {
  if (typeof XLSX === 'undefined') {
    alert('La librería Excel no está cargada.');
    return;
  }

  var data = filteredReportes.map(function (r) {
    return {
      'Fecha':       fmtFechaExcel(r.fecha),
      'Recorredor':  r.recorredor || '',
      'Pozo':        r.pozo ? 'C-' + r.pozo : '',
      'Modo':        MODOS[r.modo] || r.modo || '',
      'Estado':      r.estado || '',
      'N° Fotos':    r.nFotos || 0,
      'WA Status':   r.whatsappStatus || '',
      'Mensaje':     (r.msg || '').replace(/\*/g, '').replace(/\n/g, ' ').slice(0, 200),
    };
  });

  var ws = XLSX.utils.json_to_sheet(data);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reportes');

  // Alarmas sheet
  var dataA = filteredAlarmas.map(function (a) {
    return {
      'Fecha':    fmtFechaExcel(a.fecha),
      'Hora':     a.hora || '',
      'Tipo':     a.tipo || '',
      'Quien':    a.quien || '',
      'Lugar':    (a.lugar || '').split('\n')[0],
      'WA Status':a.whatsappStatus || '',
      'N° Fotos': a.nFotos || 0,
    };
  });
  var wsA = XLSX.utils.json_to_sheet(dataA);
  XLSX.utils.book_append_sheet(wb, wsA, 'Alarmas');

  var fecha = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, 'Cuichapa_Admin_' + fecha + '.xlsx');
}

// ── HELPERS ───────────────────────────────────────────────
function fmtFecha(iso) {
  if (!iso) return '—';
  try {
    var d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric' })
      + ' ' + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
  } catch (e) { return iso.slice(0,16).replace('T',' '); }
}

function fmtFechaExcel(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch (e) { return iso.slice(0,10); }
}

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── KEY ENTER en login ────────────────────────────────────
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') {
    doAdminLogin();
  }
});
