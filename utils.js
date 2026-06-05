// ══ utils.js — Campo Cuichapa PWA ═══════════════════════════════
// Funciones utilitarias puras (sin Firebase, GPS, UI, WhatsApp).
// Debe cargarse después de config.js y antes del script principal.

// ══ utils.js — Campo Cuichapa PWA ═══════════════════════════════
// Funciones utilitarias puras sin dependencias de Firebase,
// GPS, UI o WhatsApp. Cargado después de config.js.

// ── diffDays (L2786 de index.html) ──
function diffDays(a,b){return Math.floor((b-a)/(1000*60*60*24));}

// ── _rangoLabel (L3237–L3243 de index.html) ──
function _rangoLabel(dm, tipo){
  tipo = tipo || 'pozo';
  if(dm < 0) return '';
  var ok = dm <= 15;
  var distTxt = dm < 1000 ? Math.round(dm)+'m' : (dm/1000).toFixed(2)+'km';
  return (ok ? '✅ Dentro del rango del '+tipo : '⚠️ Fuera del rango del '+tipo+' ('+distTxt+')');
}

// ── now (L3257 de index.html) ──
function now(){var d=new Date();return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'})+'  '+d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});}

// ── toDMS (L4196–L4203 de index.html) ──
function toDMS(deg, isLat){
  var d=Math.floor(Math.abs(deg));
  var mFull=(Math.abs(deg)-d)*60;
  var m=Math.floor(mFull);
  var s=((mFull-m)*60).toFixed(1);
  var dir=isLat?(deg>=0?'N':'S'):(deg>=0?'E':'W');
  return d+'° '+m+"' "+s+'" '+dir;
}

// ── escapeHTML (L7655 de index.html) ──
function escapeHTML(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
