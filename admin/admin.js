/* Admin Pozos Cuichapa
   1) Pega aquí tu firebaseConfig.
   2) Sube admin.html y carpeta admin/ a Firebase Hosting.
   3) Cambia usuarios/contraseñas si quieres.
*/

const firebaseConfig = {
  // PEGA AQUÍ TU CONFIG REAL DE FIREBASE WEB APP
  // apiKey: "xxxx",
  // authDomain: "pozos-cuichapa.firebaseapp.com",
  // databaseURL: "https://pozos-cuichapa-default-rtdb.firebaseio.com",
  // projectId: "pozos-cuichapa",
  // storageBucket: "pozos-cuichapa.appspot.com",
  // messagingSenderId: "xxxx",
  // appId: "xxxx"
};

const AUTH_USERS = {
  AntonioS: "1234",
  JaimeG: "1234",
  IngDuctos: "1234",
  Almacenista: "1234",
  JorgeGill: "1234",
  Supervisor: "1234",
  Admin: "1234"
};

let DB = null;
let reportes = [];
let alarmas = [];
let currentSection = "dashboard";

document.addEventListener("DOMContentLoaded", () => {
  bindLogin();
  bindNav();
  bindFilters();
  bindDialog();

  const saved = sessionStorage.getItem("adminUser");
  if (saved) startApp(saved);
});

function bindLogin(){
  const btn = document.getElementById("loginBtn");
  btn.addEventListener("click", doLogin);
  document.getElementById("loginPass").addEventListener("keydown", e => {
    if(e.key === "Enter") doLogin();
  });
}

function doLogin(){
  const user = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value;
  const err = document.getElementById("loginError");

  if(!AUTH_USERS[user] || AUTH_USERS[user] !== pass){
    err.textContent = "Usuario o contraseña incorrectos.";
    return;
  }

  sessionStorage.setItem("adminUser", user);
  startApp(user);
}

function startApp(user){
  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("appView").classList.remove("hidden");
  document.getElementById("currentUser").textContent = user;

  if(!firebase.apps.length){
    if(!firebaseConfig.databaseURL){
      alert("Falta pegar firebaseConfig en admin/admin.js");
      return;
    }
    firebase.initializeApp(firebaseConfig);
  }
  DB = firebase.database();

  listenData();
}

function bindNav(){
  document.querySelectorAll(".nav").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      showSection(btn.dataset.section);
    });
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("adminUser");
    location.reload();
  });
}

function showSection(section){
  currentSection = section;
  document.getElementById("dashboardSection").classList.toggle("hidden", section !== "dashboard");
  document.getElementById("reportesSection").classList.toggle("hidden", section !== "reportes");
  document.getElementById("alarmasSection").classList.toggle("hidden", section !== "alarmas");

  const titles = {
    dashboard: ["Dashboard", "Resumen operativo de reportes y alarmas."],
    reportes: ["Reportes", "Consulta, filtra y exporta los reportes de campo."],
    alarmas: ["Alarmas", "Consulta, filtra y exporta eventos de alarma."]
  };
  document.getElementById("sectionTitle").textContent = titles[section][0];
  document.getElementById("sectionSubtitle").textContent = titles[section][1];
}

function listenData(){
  DB.ref("/reportes").limitToLast(1500).on("value", snap => {
    reportes = objToList(snap.val());
    renderAll();
  });

  DB.ref("/alarmas").limitToLast(1000).on("value", snap => {
    alarmas = objToList(snap.val());
    renderAll();
  });
}

function objToList(obj){
  if(!obj) return [];
  return Object.entries(obj).map(([id, v]) => ({ id, ...(v || {}) }))
    .sort((a,b) => getTime(b) - getTime(a));
}

function getTime(r){
  const raw = r.timestamp || r.createdAt || r.fechaHora || r.fecha || r.sentAt || 0;
  if(typeof raw === "number") return raw;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function ymd(d){
  const dt = d instanceof Date ? d : new Date(d);
  if(isNaN(dt)) return "";
  return dt.toISOString().slice(0,10);
}

function localDate(r){
  const t = getTime(r);
  if(t) return new Date(t);
  if(r.fecha && r.hora) return new Date(`${r.fecha}T${r.hora}`);
  if(r.fecha) return new Date(r.fecha);
  return null;
}

function fmtDate(r){
  const d = localDate(r);
  return d ? d.toLocaleDateString("es-MX") : (r.fecha || "");
}

function fmtTime(r){
  const d = localDate(r);
  if(d) return d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});
  return r.hora || r.horaNivel || "";
}

function todayYMD(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function sameToday(r){
  const d = localDate(r);
  return d && ymd(d) === todayYMD();
}

function renderAll(){
  renderDashboard();
  renderReportes();
  renderAlarmas();
}

function renderDashboard(){
  const reportesHoy = reportes.filter(sameToday).length;
  const alarmasHoy = alarmas.filter(sameToday).length;
  const pendientes = reportes.filter(r => (r.whatsappStatus || r.estado || "").toLowerCase().includes("pending")).length;

  document.getElementById("statReportesHoy").textContent = reportesHoy;
  document.getElementById("statAlarmasHoy").textContent = alarmasHoy;
  document.getElementById("statPendientes").textContent = pendientes;
  document.getElementById("statTotal").textContent = reportes.length + alarmas.length;

  const merged = [
    ...reportes.slice(0,8).map(r => ({tipo:"Reporte", ...r})),
    ...alarmas.slice(0,8).map(r => ({tipo:"Alarma", ...r}))
  ].sort((a,b)=>getTime(b)-getTime(a)).slice(0,10);

  const box = document.getElementById("recentList");
  box.innerHTML = merged.map(r => `
    <div class="recent-item">
      <b>${escapeHtml(r.tipo)} · ${escapeHtml(r.pozo || r.lugar || r.nombrePozo || "Sin pozo")}</b>
      <span>${escapeHtml(fmtDate(r))} ${escapeHtml(fmtTime(r))} · ${escapeHtml(r.recorredor || r.usuario || r.user || "Sin usuario")}</span>
    </div>
  `).join("") || `<div class="recent-item"><span>Sin movimientos cargados.</span></div>`;
}

function bindFilters(){
  ["fFechaDesde","fFechaHasta","fRecorredor","fPozo","fModo"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderReportes);
  });
  ["aFechaDesde","aFechaHasta","aBuscar"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderAlarmas);
  });

  document.getElementById("clearFilters").addEventListener("click", () => {
    ["fFechaDesde","fFechaHasta","fRecorredor","fPozo","fModo"].forEach(id => document.getElementById(id).value = "");
    renderReportes();
  });

  document.getElementById("clearAlarmFilters").addEventListener("click", () => {
    ["aFechaDesde","aFechaHasta","aBuscar"].forEach(id => document.getElementById(id).value = "");
    renderAlarmas();
  });

  document.getElementById("exportReportes").addEventListener("click", () => {
    downloadCSV("reportes.csv", filteredReportes());
  });
  document.getElementById("exportAlarmas").addEventListener("click", () => {
    downloadCSV("alarmas.csv", filteredAlarmas());
  });
}

function filteredReportes(){
  const desde = document.getElementById("fFechaDesde").value;
  const hasta = document.getElementById("fFechaHasta").value;
  const recorredor = document.getElementById("fRecorredor").value.trim().toLowerCase();
  const pozo = document.getElementById("fPozo").value.trim().toLowerCase();
  const modo = document.getElementById("fModo").value;

  return reportes.filter(r => {
    const d = localDate(r);
    const date = d ? ymd(d) : (r.fecha || "");
    if(desde && date < desde) return false;
    if(hasta && date > hasta) return false;
    if(recorredor && !String(r.recorredor || r.usuario || "").toLowerCase().includes(recorredor)) return false;
    if(pozo && !String(r.pozo || r.nombrePozo || "").toLowerCase().includes(pozo)) return false;
    if(modo && String(r.modo || "").toLowerCase() !== modo) return false;
    return true;
  });
}

function renderReportes(){
  const rows = filteredReportes();
  const body = document.getElementById("reportesBody");

  body.innerHTML = rows.map(r => {
    const gps = r.gps || {};
    const hasGps = gps.lat || gps.latitude || r.lat || r.lon;
    return `<tr>
      <td>${escapeHtml(fmtDate(r))}</td>
      <td>${escapeHtml(fmtTime(r))}</td>
      <td>${escapeHtml(r.recorredor || r.usuario || "")}</td>
      <td><span class="badge">${escapeHtml(r.modo || "")}</span></td>
      <td>${escapeHtml(r.pozo || r.nombrePozo || "")}</td>
      <td>${escapeHtml((r.co && r.co.estatus) || r.estatus || "")}</td>
      <td>${statusBadge(r.whatsappStatus || r.estado || "")}</td>
      <td>${hasGps ? '<span class="badge ok">GPS</span>' : '<span class="badge warn">Sin GPS</span>'}</td>
      <td>${escapeHtml(cut(r.observaciones || r.obs || r.msg || "", 90))}</td>
      <td><button class="rowbtn" onclick="showDetail('reportes','${r.id}')">Ver</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="10">Sin reportes con esos filtros.</td></tr>`;
}

function filteredAlarmas(){
  const desde = document.getElementById("aFechaDesde").value;
  const hasta = document.getElementById("aFechaHasta").value;
  const buscar = document.getElementById("aBuscar").value.trim().toLowerCase();

  return alarmas.filter(r => {
    const d = localDate(r);
    const date = d ? ymd(d) : (r.fecha || "");
    if(desde && date < desde) return false;
    if(hasta && date > hasta) return false;
    if(buscar && !JSON.stringify(r).toLowerCase().includes(buscar)) return false;
    return true;
  });
}

function renderAlarmas(){
  const rows = filteredAlarmas();
  const body = document.getElementById("alarmasBody");

  body.innerHTML = rows.map(r => `<tr>
    <td>${escapeHtml(fmtDate(r))}</td>
    <td>${escapeHtml(fmtTime(r))}</td>
    <td>${escapeHtml(r.usuario || r.recorredor || r.user || "")}</td>
    <td>${escapeHtml(r.pozo || r.lugar || r.nombrePozo || "")}</td>
    <td><span class="badge danger">${escapeHtml(r.tipo || r.modo || "alarma")}</span></td>
    <td>${statusBadge(r.whatsappStatus || r.estado || "")}</td>
    <td>${escapeHtml(cut(r.mensaje || r.msg || r.descripcion || "", 120))}</td>
    <td><button class="rowbtn" onclick="showDetail('alarmas','${r.id}')">Ver</button></td>
  </tr>`).join("") || `<tr><td colspan="8">Sin alarmas con esos filtros.</td></tr>`;
}

function statusBadge(st){
  const s = String(st || "").toLowerCase();
  if(s.includes("sent") || s.includes("enviado")) return `<span class="badge ok">${escapeHtml(st || "sent")}</span>`;
  if(s.includes("pending") || s.includes("pendiente")) return `<span class="badge warn">${escapeHtml(st || "pending")}</span>`;
  if(s.includes("error") || s.includes("fail")) return `<span class="badge danger">${escapeHtml(st)}</span>`;
  return `<span class="badge">${escapeHtml(st || "-")}</span>`;
}

function showDetail(type,id){
  const arr = type === "reportes" ? reportes : alarmas;
  const item = arr.find(x => x.id === id);
  document.getElementById("detailJson").textContent = JSON.stringify(item || {}, null, 2);
  document.getElementById("detailDialog").showModal();
}
window.showDetail = showDetail;

function bindDialog(){
  document.getElementById("closeDialog").addEventListener("click", () => {
    document.getElementById("detailDialog").close();
  });
}

function downloadCSV(filename, rows){
  const flat = rows.map(flattenObject);
  const headers = Array.from(new Set(flat.flatMap(o => Object.keys(o))));
  const csv = [
    headers.join(","),
    ...flat.map(o => headers.map(h => csvCell(o[h])).join(","))
  ].join("\n");

  const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function flattenObject(obj, prefix="", out={}){
  Object.entries(obj || {}).forEach(([k,v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if(v && typeof v === "object" && !Array.isArray(v)){
      flattenObject(v, key, out);
    }else{
      out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
    }
  });
  return out;
}

function csvCell(v){
  const s = String(v ?? "");
  return `"${s.replace(/"/g,'""')}"`;
}

function escapeHtml(v){
  return String(v ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function cut(s,n){
  s = String(s ?? "");
  return s.length > n ? s.slice(0,n-1) + "…" : s;
}
