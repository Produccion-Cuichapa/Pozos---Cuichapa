
*{margin:0;padding:0;box-sizing:border-box}

/* ══ BASE VARS ══ */
:root{
  /* ── MODO DÍA: blanco y azul claro ── */
  --bg:#f5f8ff;--surface:#ffffff;--surface2:#eaf0fb;--border:#cad8ee;
  --txt:#0a1628;--txt2:#3d5a80;--accent:#0f3460;--accent2:#1e5caa;
  --green:#16a34a;--red:#dc2626;--send:#16a34a;
  --bar:#cad8ee;--prog:linear-gradient(90deg,#16a34a,#4ade80);
  --shadow:0 2px 14px rgba(15,52,96,.10);--shadowlg:0 8px 32px rgba(15,52,96,.16);
  --fixed:#ffffff;--char-bg:#0f3460;
  --hdr:linear-gradient(135deg,#0f3460 0%,#1a4d8a 100%);
}
/* ── MODO NOCHE ── */
body.night{
  --bg:#040810;--surface:#0a1222;--surface2:#060e1a;--border:#0f2030;
  --txt:#d0e0f8;--txt2:#4a6888;--accent:#4090e0;--accent2:#60b0f8;
  --green:#22c55e;--red:#f87171;--bar:#0f2030;
  --shadow:0 2px 10px rgba(0,0,0,.6);--shadowlg:0 8px 32px rgba(0,0,0,.7);
  --fixed:#040810;--char-bg:#0a1a2e;
}
/* Indicador visual dia/noche en body */
body:not(.night){
  background:#f5f8ff !important;
}
body.night{
  background:#040810 !important;
}
/* MANRIQUE — offshore azul */
body.m-active{
  --char-bg:linear-gradient(135deg,#0a1e3a 0%,#0e2d5a 60%,#0a2448 100%);
  --hdr:linear-gradient(135deg,#0a1e3a 0%,#0d2a5a 60%,#102050 100%);
}
/* CIRILO — refinería gris industrial */
body.c-active{
  --char-bg:linear-gradient(135deg,#1a1a1a 0%,#2a2a2a 60%,#1e1e1e 100%);
  --hdr:linear-gradient(135deg,#1a1a20 0%,#28282e 60%,#1e1e24 100%);
}
/* JUAN CARLOS — naranja campo */
body.jc-active{
  --char-bg:linear-gradient(135deg,#0f3460 0%,#1a4d8a 60%,#0f3460 100%);
  --hdr:linear-gradient(145deg,#0a2240 0%,#0f3460 50%,#1a4d8a 100%);
  --accent2:#FF7A00;
}

body{
  font-family:'Inter',sans-serif;background:var(--bg);color:var(--txt);
  min-height:100vh;padding:14px 14px 96px 14px;transition:background .5s,color .5s,padding .35s;
}
body.sidebar-visible{
  padding-left:70px;
}

/* ══ SIDEBAR ══ */
.sidebar{
  position:fixed;left:0;top:0;bottom:0;width:54px;
  background:#080f1e;
  display:flex;flex-direction:column;align-items:center;
  padding:16px 0;gap:6px;z-index:400;
  border-right:1px solid #1a2a42;
  box-shadow:2px 0 16px rgba(0,0,0,.4);
  transform:translateX(-100%);
  transition:transform .35s cubic-bezier(.34,1.2,.64,1);
}
.sidebar.sidebar-unlocked{
  transform:translateX(0);
}
body.night .sidebar{background:#050810;border-right-color:#0f1a28}

.sidebar-logo{
  width:36px;height:36px;margin-bottom:8px;
  display:flex;align-items:center;justify-content:center;
}

.sidebar-divider{width:30px;height:1px;background:#1a2a42;margin:4px 0}

.sidebar-locked{opacity:.25;pointer-events:none;filter:grayscale(1)}
.sidebar.sidebar-unlocked .sidebar-locked{opacity:1;pointer-events:auto;filter:none;transition:opacity .4s,filter .4s}
.sidebar-icon{
  width:44px;height:44px;border-radius:12px;
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:all .2s;position:relative;
  border:1.5px solid transparent;
}
.sidebar-icon:hover{background:#1a2a42;border-color:#2a3a52}
.sidebar-icon.active{
  background:#0f3460;border-color:#1e5caa;
  box-shadow:0 0 12px rgba(30,92,170,.4);
}

/* Tooltip */
.sidebar-icon::after{
  content:attr(data-tip);
  position:absolute;left:56px;top:50%;transform:translateY(-50%);
  background:#1a2a42;color:#e8f0fe;font-size:12px;font-weight:600;
  padding:6px 10px;border-radius:8px;white-space:nowrap;
  pointer-events:none;opacity:0;transition:opacity .2s;
  border:1px solid #2a3a52;
}
.sidebar-icon:hover::after{opacity:1}

.change-profile-btn{display:none}
.toggle-btn{
  position:fixed;top:12px;right:12px;z-index:500;
  background:var(--surface);border:1.5px solid var(--border);
  border-radius:20px;padding:7px 14px;font-size:13px;font-weight:700;
  cursor:pointer;color:var(--txt);box-shadow:var(--shadow);transition:all .3s;
}

.wrap{max-width:420px;margin:0 auto;position:relative;z-index:2}

/* ══ VIEWS ══ */
.view{display:none}.view.active{display:block}
.wrap .view.active{display:block !important}

/* ══ LOGIN MODAL ══ */
.login-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.7);
  z-index:900;display:none;align-items:center;justify-content:center;
  backdrop-filter:blur(4px);
}
.login-overlay.open{display:flex}
.login-box{
  background:var(--surface);border-radius:20px;padding:28px 24px;
  width:320px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.5);
  border:1.5px solid var(--border);animation:popIn .3s cubic-bezier(.34,1.56,.64,1);
}
@keyframes popIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
.login-icon{font-size:40px;text-align:center;margin-bottom:12px}
.login-title{font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--accent);text-align:center;letter-spacing:1px;margin-bottom:4px}
.login-sub{font-size:12px;color:var(--txt2);text-align:center;margin-bottom:20px}
.login-field{margin-bottom:14px}
.login-field label{display:block;font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
.login-field input{width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:15px;color:var(--txt);background:var(--surface2);outline:none;font-family:'Inter',sans-serif;transition:all .2s}
.login-field input:focus{border-color:var(--accent2);box-shadow:0 0 0 3px rgba(30,106,191,.12)}
.login-err{font-size:12px;color:var(--red);text-align:center;margin-bottom:10px;display:none}
.login-btn{width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:11px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;margin-bottom:10px}
.login-btn:hover{transform:translateY(-1px);opacity:.9}
.login-cancel{width:100%;padding:10px;background:none;border:none;color:var(--txt2);font-size:13px;cursor:pointer;font-family:'Inter',sans-serif}

/* ══ MAPA VIEW ══ */
.map-search-bar{
  background:var(--surface);border-radius:14px;padding:16px;
  margin-bottom:14px;border:1.5px solid var(--border);box-shadow:var(--shadow);
}
.map-input-wrap{display:flex;gap:8px;margin-top:10px}
.map-input{
  flex:1;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;
  font-size:16px;color:var(--txt);background:var(--surface2);
  outline:none;font-family:'Inter',sans-serif;transition:all .2s;
}
.map-input:focus{border-color:var(--accent2);box-shadow:0 0 0 3px rgba(30,106,191,.12)}
.map-search-btn{
  padding:12px 16px;background:var(--accent);color:#fff;
  border:none;border-radius:10px;font-size:14px;font-weight:700;
  cursor:pointer;font-family:'Inter',sans-serif;white-space:nowrap;
}

.map-result{
  background:var(--surface);border-radius:14px;padding:16px;
  margin-bottom:14px;border:1.5px solid var(--border);
  box-shadow:var(--shadow);display:none;animation:fadeUp .3s ease;
}
.map-result.show{display:block}
.map-well-title{font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--accent);letter-spacing:1px;margin-bottom:12px}
.coord-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.coord-row:last-of-type{border-bottom:none}
.coord-icon{font-size:20px;flex-shrink:0}
.coord-label{font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.8px;display:block}
.coord-val{font-family:'Courier New',monospace;font-size:16px;color:var(--txt);font-weight:700;margin-top:2px;display:block}

.map-open-btn{
  width:100%;padding:14px;background:#16a34a;color:#fff;
  border:none;border-radius:11px;font-size:15px;font-weight:800;
  cursor:pointer;font-family:'Inter',sans-serif;margin-top:12px;
  box-shadow:0 4px 14px rgba(22,163,74,.3);transition:all .2s;
  display:flex;align-items:center;justify-content:center;gap:8px;
}
.map-open-btn:hover{transform:translateY(-1px)}

.map-well-list{
  background:var(--surface);border-radius:14px;padding:14px 16px;
  border:1.5px solid var(--border);box-shadow:var(--shadow);
}
.map-well-list-title{font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px}
.map-well-chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{
  padding:6px 12px;background:var(--surface2);border:1.5px solid var(--border);
  border-radius:20px;font-size:12px;font-weight:700;color:var(--accent);
  cursor:pointer;transition:all .2s;font-family:'Inter',sans-serif;
}
.chip:hover{background:var(--accent);color:#fff;border-color:var(--accent)}
.chip.no-coord{color:var(--txt2);cursor:default}
.chip.no-coord:hover{background:var(--surface2);color:var(--txt2);border-color:var(--border)}

/* ══ INSTALL BANNER ══ */
.install-banner{
  display:none;background:linear-gradient(135deg,#0f3460,#1a5caa);
  border-radius:14px;padding:14px 16px;margin-bottom:14px;
  box-shadow:0 4px 20px rgba(15,52,96,.3);align-items:center;gap:12px;
}
.install-banner.show{display:flex}
.install-banner-txt{flex:1;color:#fff}
.install-banner-txt strong{font-size:14px;font-weight:800;display:block}
.install-banner-txt span{font-size:11px;color:rgba(255,255,255,.7)}
.install-btn{padding:9px 16px;background:#FF7A00;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;font-family:'Inter',sans-serif}
.install-close{background:none;border:none;color:rgba(255,255,255,.6);font-size:20px;cursor:pointer;padding:0 4px;flex-shrink:0}

/* ══ WELL PICKER ══ */
.well-picker{background:var(--surface);border-radius:16px;padding:0;margin-bottom:14px;border:2px solid var(--accent2);box-shadow:0 4px 20px rgba(15,52,96,.15);display:none;overflow:hidden}
.well-picker.show{display:block}
.well-picker-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;cursor:pointer;user-select:none}
.well-picker-header:active{background:var(--surface2)}
.well-picker-title{font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--accent);letter-spacing:1px}
.well-picker-arrow{font-size:22px;color:var(--accent);transition:transform .3s;display:inline-block}
.well-picker-arrow.open{transform:rotate(90deg)}
.well-picker-list{display:none;border-top:1.5px solid var(--border);max-height:320px;overflow-y:auto}
.well-picker-list.open{display:block}
.wp-item{display:flex;align-items:center;padding:13px 18px;cursor:pointer;font-size:15px;font-weight:700;color:var(--txt);border-bottom:1px solid var(--border);background:var(--surface);transition:background .15s;font-family:'Inter',sans-serif}
.wp-item:last-child{border-bottom:none}
.wp-item:hover,.wp-item:active{background:var(--accent);color:#fff}
.wp-item-icon{font-size:14px;margin-right:10px;opacity:.5}
.wp-item-num{flex:1}

/* ══ HISTORIAL ══ */
.hist-header{background:linear-gradient(135deg,#1a2f1a,#2a4a2a);border-radius:18px;padding:18px;margin-bottom:14px;box-shadow:var(--shadowlg)}
.hist-header h2{font-family:'Bebas Neue',sans-serif;font-size:36px;color:#fff;letter-spacing:2px}
.hist-header p{font-size:12px;color:rgba(255,255,255,.6);margin-top:2px}
.hist-filters{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.hist-filter{padding:7px 14px;border:1.5px solid var(--border);border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;background:var(--surface2);color:var(--txt2);font-family:'Inter',sans-serif;transition:all .2s}
.hist-filter.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.hist-empty{text-align:center;padding:40px 20px;color:var(--txt2)}
.hist-empty-icon{font-size:48px;margin-bottom:12px}
.hist-empty-txt{font-size:14px}
.hist-card{background:var(--surface);border-radius:14px;padding:0;margin-bottom:10px;border:1.5px solid var(--border);box-shadow:var(--shadow);overflow:hidden;cursor:pointer;transition:all .2s}
.hist-card:hover{border-color:var(--accent2)}
.hist-card-head{display:flex;align-items:center;gap:12px;padding:14px 16px}
.hist-card-well{font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--accent);letter-spacing:1px;flex-shrink:0}
.hist-card-info{flex:1}
.hist-card-rec{font-size:13px;font-weight:700;color:var(--txt);display:block}
.hist-card-date{font-size:11px;color:var(--txt2);margin-top:2px}
.hist-card-arrow{color:var(--txt2);font-size:18px;transition:transform .2s}
.hist-card.open .hist-card-arrow{transform:rotate(90deg)}
.hist-card-body{display:none;padding:0 16px 14px;border-top:1px solid var(--border)}
.hist-card.open .hist-card-body{display:block}
.hist-msg{font-family:'Courier New',monospace;font-size:11px;color:var(--txt);background:var(--surface2);border-radius:8px;padding:10px;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto;margin-top:10px;line-height:1.6}
.hist-actions{display:flex;gap:8px;margin-top:10px}
.hist-resend{flex:1;padding:10px;background:#16a34a;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif}
.hist-delete{padding:10px 14px;background:var(--surface2);color:var(--red);border:1.5px solid var(--red);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif}
.hist-clear-btn{width:100%;padding:12px;background:var(--surface2);color:var(--red);border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;margin-top:8px}
.hist-count{font-size:12px;color:var(--txt2);margin-bottom:10px;text-align:center}

@keyframes userPulse{
  0%,100%{box-shadow:0 0 0 4px rgba(29,78,216,.3)}
  50%{box-shadow:0 0 0 10px rgba(29,78,216,.05)}
}
#mapContainer{
  width:100%;height:420px;border-radius:14px;
  overflow:visible;border:1.5px solid var(--border);
  box-shadow:var(--shadow);margin-bottom:14px;
  background:#e8f4f8;
}
.leaflet-popup-content-wrapper{
  border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.2);
  border:none;font-family:'Inter',sans-serif;
}
.leaflet-popup-content{margin:12px 16px;font-size:13px}
.popup-title{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#0f3460;letter-spacing:1px}
.popup-coord{font-family:'Courier New',monospace;font-size:11px;color:#5a6e90;margin-top:2px}
.popup-maps{
  display:block;margin-top:8px;padding:7px 12px;
  background:#16a34a;color:#fff;border-radius:8px;
  text-decoration:none;font-size:12px;font-weight:700;text-align:center;
}
.map-info-card{
  background:var(--surface);border-radius:14px;padding:14px 16px;
  margin-bottom:14px;border:1.5px solid var(--border);
  box-shadow:var(--shadow);display:none;animation:fadeUp .3s ease;
}
.map-info-card.show{display:block}


.cat-header{
  background:var(--hdr);border-radius:18px;padding:18px;
  margin-bottom:14px;box-shadow:var(--shadowlg);
}
.cat-header h2{font-family:'Bebas Neue',sans-serif;font-size:36px;color:#fff;letter-spacing:2px}
.cat-header p{font-size:12px;color:rgba(255,255,255,.6);margin-top:2px}

.well-search{
  width:100%;padding:11px 14px;border:1.5px solid var(--border);
  border-radius:12px;font-size:15px;background:var(--surface);
  color:var(--txt);outline:none;margin-bottom:12px;
  font-family:'Inter',sans-serif;transition:all .25s;
}
.well-search:focus{border-color:var(--accent2);box-shadow:0 0 0 3px rgba(30,106,191,.12)}

.well-list{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.well-item{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 16px;background:var(--surface);
  border-radius:14px;border:1.5px solid var(--border);
  cursor:pointer;transition:all .2s;box-shadow:var(--shadow);
}
.well-item:hover{border-color:var(--accent2);transform:translateX(3px)}
.well-item.selected{border-color:var(--accent);background:var(--surface2);box-shadow:0 4px 14px rgba(15,52,96,.18)}
.well-num{font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--accent);letter-spacing:1px}
.well-status-dot{width:10px;height:10px;border-radius:50%}

.enter-btn{
  width:100%;padding:16px;background:var(--accent);color:#fff;
  border:none;border-radius:13px;font-size:16px;font-weight:800;
  cursor:pointer;font-family:'Inter',sans-serif;
  box-shadow:0 4px 16px rgba(15,52,96,.25);
  transition:all .2s;display:none;margin-bottom:14px;
  animation:fadeUp .3s ease;
}
.enter-btn:hover{transform:translateY(-1px)}

/* ══ POZO DETALLE ══ */
.pozo-back{
  display:flex;align-items:center;gap:8px;cursor:pointer;
  color:var(--accent2);font-size:14px;font-weight:700;
  margin-bottom:14px;padding:8px 0;
}
.pozo-back:hover{color:var(--accent)}

.pozo-header{
  background:var(--hdr);border-radius:18px;padding:18px;
  margin-bottom:14px;box-shadow:var(--shadowlg);
  display:flex;align-items:center;gap:14px;
}
.pozo-icon-big{
  width:56px;height:56px;border-radius:14px;
  background:rgba(255,255,255,.12);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.pozo-header-txt h2{font-family:'Bebas Neue',sans-serif;font-size:32px;color:#fff;letter-spacing:1px;line-height:1}
.pozo-header-txt p{font-size:11px;color:rgba(255,255,255,.6);margin-top:2px}

.info-section{background:var(--surface);border-radius:16px;padding:16px;margin-bottom:12px;border:1.5px solid var(--border);box-shadow:var(--shadow)}
.info-section-title{
  font-size:11px;font-weight:800;color:var(--accent2);
  text-transform:uppercase;letter-spacing:1.2px;
  margin-bottom:12px;padding-bottom:8px;border-bottom:1.5px solid var(--border);
  display:flex;align-items:center;gap:6px;
}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)}
.info-row:last-child{border-bottom:none}
.info-label{font-size:13px;color:var(--txt2);font-weight:600}
.info-value{font-size:13px;color:var(--txt);font-weight:700;text-align:right}
.info-value.empty{color:var(--border);font-style:italic;font-weight:400}
.info-edit-btn{
  width:100%;padding:12px;background:var(--surface2);color:var(--accent);
  border:1.5px dashed var(--accent2);border-radius:10px;font-size:13px;
  font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;
  margin-top:8px;transition:all .2s;
}
.info-edit-btn:hover{background:var(--accent);color:#fff;border-style:solid}

/* Badge tags */
.tag{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700}
.tag-green{background:#dcfce7;color:#15803d}
.tag-red{background:#fee2e2;color:#b91c1c}
.tag-blue{background:#dbeafe;color:#1d4ed8}
.tag-gray{background:var(--surface2);color:var(--txt2)}
body.night .tag-green{background:#14532d44;color:#4ade80}
body.night .tag-red{background:#7f1d1d44;color:#f87171}
body.night .tag-blue{background:#1e3a5f44;color:#60a5fa}


/* ══ HEADER ══ */
.header{
  border-radius:18px;padding:0;margin-bottom:14px;
  background:var(--hdr);box-shadow:var(--shadowlg);
  position:relative;overflow:hidden;transition:all .6s;
}
.header-row{display:flex;align-items:flex-end;min-height:160px;padding-bottom:0}
.header-text{flex:1;padding:16px 0 16px 16px}
.header-text h1{
  font-family:'Bebas Neue',sans-serif;font-size:44px;color:#fff;
  line-height:1;letter-spacing:2px;
}
.header-text p{font-size:11px;color:rgba(255,255,255,.6);margin-top:3px;font-weight:600;letter-spacing:.4px;transition:all .5s}

/* Character slot in header */
.char-slot{
  width:130px;height:210px;flex-shrink:0;align-self:flex-end;
  position:relative;overflow:hidden;
}
.char-m,.char-c,.char-jc,.char-j,.char-l{
  position:absolute;bottom:0;right:0;
  opacity:0;transform:translateX(14px) scale(.9);
  transition:opacity .5s cubic-bezier(.34,1.4,.64,1),transform .5s cubic-bezier(.34,1.4,.64,1);
  pointer-events:none;
}
.char-m svg,.char-c svg,.char-jc svg,.char-j svg,.char-l svg{display:block;filter:drop-shadow(0 4px 16px rgba(0,0,0,.35))}
body.m-active .char-m{opacity:1;transform:translateX(0) scale(1);pointer-events:auto}
body.c-active .char-c{opacity:1;transform:translateX(0) scale(1);pointer-events:auto}
body.jc-active .char-jc{opacity:1;transform:translateX(0) scale(1);pointer-events:auto}
body.j-active .char-j{opacity:1;transform:translateX(0) scale(1);pointer-events:auto}
body.l-active .char-l{opacity:1;transform:translateX(0) scale(1);pointer-events:auto}

/* Floating bob */
@keyframes charFloat{
  0%,100%{transform:translateY(0)}
  30%{transform:translateY(-5px)}
  60%{transform:translateY(-2px)}
}

/* Header animated glow spot */
.header::before{
  content:'';position:absolute;
  width:220px;height:220px;
  border-radius:50%;
  background:radial-gradient(circle,rgba(255,122,0,.18) 0%,transparent 70%);
  bottom:-60px;right:-20px;
  animation:glowPulse 4s ease-in-out infinite;
  pointer-events:none;
}
@keyframes glowPulse{
  0%,100%{opacity:.6;transform:scale(1)}
  50%{opacity:1;transform:scale(1.15)}
}

/* Particle dots in header background */
.header-particles{
  position:absolute;inset:0;overflow:hidden;border-radius:18px;pointer-events:none;
}
.header-particles span{
  position:absolute;border-radius:50%;background:rgba(255,255,255,.12);
  animation:particleDrift linear infinite;
}
.header-particles span:nth-child(1){width:4px;height:4px;left:15%;bottom:-10px;animation-duration:7s;animation-delay:0s}
.header-particles span:nth-child(2){width:3px;height:3px;left:35%;bottom:-10px;animation-duration:9s;animation-delay:1.5s}
.header-particles span:nth-child(3){width:5px;height:5px;left:55%;bottom:-10px;animation-duration:6s;animation-delay:3s}
.header-particles span:nth-child(4){width:2px;height:2px;left:70%;bottom:-10px;animation-duration:8s;animation-delay:.5s}
.header-particles span:nth-child(5){width:4px;height:4px;left:85%;bottom:-10px;animation-duration:10s;animation-delay:2s}
.header-particles span:nth-child(6){width:3px;height:3px;left:25%;bottom:-10px;animation-duration:7.5s;animation-delay:4s}
@keyframes particleDrift{
  0%{transform:translateY(0) translateX(0);opacity:0}
  10%{opacity:1}
  90%{opacity:.4}
  100%{transform:translateY(-220px) translateX(20px);opacity:0}
}

/* Shimmer line across header */
.header::after{
  content:'';position:absolute;
  top:0;left:-100%;width:60%;height:100%;
  background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.04) 50%,transparent 100%);
  animation:shimmerLine 6s ease-in-out infinite;
  pointer-events:none;border-radius:18px;
}
@keyframes shimmerLine{
  0%{left:-100%}
  60%,100%{left:160%}
}

/* Shadow under character pulsing */
body.m-active .char-m svg,
body.c-active .char-c svg,
body.jc-active .char-jc svg{
  animation:charFloat 3.5s ease-in-out infinite, shadowPulse 3.5s ease-in-out infinite;
}
@keyframes shadowPulse{
  0%,100%{filter:drop-shadow(0 6px 18px rgba(0,0,0,.35))}
  50%{filter:drop-shadow(0 12px 28px rgba(0,0,0,.5)) drop-shadow(0 0 20px rgba(255,122,0,.2))}
}
body.m-active .char-m{opacity:1;transform:translateX(0) scale(1);pointer-events:auto}
body.c-active .char-c{opacity:1;transform:translateX(0) scale(1);pointer-events:auto}
body.jc-active .char-jc{opacity:1;transform:translateX(0) scale(1);pointer-events:auto}

/* Floating bob */
@keyframes charFloat{
  0%,100%{transform:translateY(0)}
  30%{transform:translateY(-5px)}
  60%{transform:translateY(-2px)}
}

/* Header animated glow spot */
.header::before{
  content:'';position:absolute;
  width:220px;height:220px;
  border-radius:50%;
  background:radial-gradient(circle,rgba(255,122,0,.18) 0%,transparent 70%);
  bottom:-60px;right:-20px;
  animation:glowPulse 4s ease-in-out infinite;
  pointer-events:none;
}
@keyframes glowPulse{
  0%,100%{opacity:.6;transform:scale(1)}
  50%{opacity:1;transform:scale(1.15)}
}

/* Particle dots in header background */
.header-particles{
  position:absolute;inset:0;overflow:hidden;border-radius:18px;pointer-events:none;
}
.header-particles span{
  position:absolute;border-radius:50%;background:rgba(255,255,255,.12);
  animation:particleDrift linear infinite;
}
.header-particles span:nth-child(1){width:4px;height:4px;left:15%;bottom:-10px;animation-duration:7s;animation-delay:0s}
.header-particles span:nth-child(2){width:3px;height:3px;left:35%;bottom:-10px;animation-duration:9s;animation-delay:1.5s}
.header-particles span:nth-child(3){width:5px;height:5px;left:55%;bottom:-10px;animation-duration:6s;animation-delay:3s}
.header-particles span:nth-child(4){width:2px;height:2px;left:70%;bottom:-10px;animation-duration:8s;animation-delay:.5s}
.header-particles span:nth-child(5){width:4px;height:4px;left:85%;bottom:-10px;animation-duration:10s;animation-delay:2s}
.header-particles span:nth-child(6){width:3px;height:3px;left:25%;bottom:-10px;animation-duration:7.5s;animation-delay:4s}
@keyframes particleDrift{
  0%{transform:translateY(0) translateX(0);opacity:0}
  10%{opacity:1}
  90%{opacity:.4}
  100%{transform:translateY(-220px) translateX(20px);opacity:0}
}

/* Shimmer line across header */
.header::after{
  content:'';position:absolute;
  top:0;left:-100%;width:60%;height:100%;
  background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.04) 50%,transparent 100%);
  animation:shimmerLine 6s ease-in-out infinite;
  pointer-events:none;border-radius:18px;
}
@keyframes shimmerLine{
  0%{left:-100%}
  60%,100%{left:160%}
}

/* Shadow under character pulsing */
body.m-active .char-m svg,
body.c-active .char-c svg,
body.jc-active .char-jc svg{
  animation:charFloat 3.5s ease-in-out infinite, shadowPulse 3.5s ease-in-out infinite;
}
@keyframes shadowPulse{
  0%,100%{filter:drop-shadow(0 6px 18px rgba(0,0,0,.35))}
  50%{filter:drop-shadow(0 12px 28px rgba(0,0,0,.5)) drop-shadow(0 0 20px rgba(255,122,0,.2))}
}


/* Glow effect per character */
body.m-active .header::after{content:'';position:absolute;bottom:0;right:0;width:140px;height:100%;background:radial-gradient(ellipse at 80% 100%,rgba(30,120,255,.2) 0%,transparent 70%);pointer-events:none}
body.c-active .header::after{content:'';position:absolute;bottom:0;right:0;width:140px;height:100%;background:radial-gradient(ellipse at 80% 100%,rgba(180,180,180,.12) 0%,transparent 70%);pointer-events:none}
body.jc-active .header::after{content:'';position:absolute;bottom:0;right:0;width:140px;height:100%;background:radial-gradient(ellipse at 80% 100%,rgba(255,120,0,.2) 0%,transparent 70%);pointer-events:none}

/* ══ BANNER per character ══ */
.char-banner{
  display:none;border-radius:12px;padding:12px 16px;
  margin-bottom:14px;animation:bannerIn .4s cubic-bezier(.34,1.3,.64,1);
}
@keyframes bannerIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
.banner-inner{display:flex;align-items:center;gap:12px}
.banner-icon{font-size:28px;flex-shrink:0}
.banner-txt strong{font-size:14px;color:#fff;font-weight:800;display:block}
.banner-txt span{font-size:11px;color:rgba(255,255,255,.65);letter-spacing:.5px}

body.m-active .banner-m{display:block;background:linear-gradient(135deg,#0e2a5a,#1a3d7a);border:1px solid #2a4d8a}
body.c-active .banner-c{display:block;background:linear-gradient(135deg,#1e1e24,#2e2e38);border:1px solid #404050}
body.jc-active .banner-jc{display:block;background:linear-gradient(135deg,#3a1a00,#582800);border:1px solid #7a3a00}

/* ══ PERMISSION OVERLAY ══ */
.perm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:800;display:none;align-items:center;justify-content:center;backdrop-filter:blur(6px);padding:20px}
.perm-overlay.show{display:flex}
.perm-sheet{background:#0f1e32;border-radius:20px;padding:28px 24px;max-width:340px;width:100%;border:1.5px solid rgba(255,122,0,.3);box-shadow:0 0 40px rgba(255,122,0,.15);animation:popIn .4s cubic-bezier(.34,1.4,.64,1)}
.perm-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:#FF7A00;text-align:center;margin-bottom:4px}
.perm-sub{font-size:12px;color:rgba(255,255,255,.4);text-align:center;margin-bottom:18px}
.perm-item{display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(255,255,255,.05);border-radius:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,.08)}
.perm-icon{font-size:26px;flex-shrink:0}
.perm-info strong{display:block;font-size:13px;color:#fff;font-weight:800}
.perm-info span{font-size:11px;color:rgba(255,255,255,.4)}
.perm-status{font-size:16px;margin-left:auto;flex-shrink:0}
.perm-btn{width:100%;padding:15px;background:#FF7A00;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:900;cursor:pointer;font-family:'Inter',sans-serif;margin-top:10px;box-shadow:0 4px 20px rgba(255,122,0,.3)}
.perm-skip{width:100%;padding:10px;background:transparent;color:rgba(255,255,255,.3);border:none;font-size:12px;cursor:pointer;font-family:'Inter',sans-serif;margin-top:4px}
.ios-banner{display:none;background:#0f3460;border-radius:14px;padding:14px 16px;margin-bottom:14px;border:1.5px solid rgba(255,122,0,.3)}
.ios-banner.show{display:block}
.ios-banner p{font-size:12px;color:rgba(255,255,255,.8);line-height:1.6;margin:0}
.ios-banner strong{color:#FF7A00}

/* ══ GPS ══ */
.gps-bar{
  background:var(--surface);border:1.5px solid var(--border);
  border-radius:10px;padding:10px 14px;margin-bottom:6px;
  font-size:13px;color:var(--txt2);box-shadow:var(--shadow);transition:all .4s;
}
.gps-bar.ok{color:var(--green);border-color:rgba(34,197,94,.3)}
.gps-bar.err{color:var(--red)}
.gps-coords{font-family:'Courier New',monospace;font-size:11px;color:var(--accent2);margin-bottom:14px;padding:0 4px;display:none}

/* ══ CARD ══ */
.card{background:var(--surface);border-radius:16px;padding:14px 16px;margin-bottom:14px;border:1.5px solid var(--border);box-shadow:var(--shadow);transition:all .4s}

/* ══ RECORREDOR ══ */
.rec-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.rec-btn{
  flex:1;min-width:110px;padding:12px 10px;
  border:1.5px solid var(--border);border-radius:12px;
  font-size:14px;font-weight:700;cursor:pointer;
  background:var(--surface2);color:var(--txt2);
  transition:all .25s;text-align:center;
  display:flex;align-items:center;justify-content:center;gap:7px;
  font-family:'Inter',sans-serif;
}
.rec-btn.sel{background:var(--accent);color:#fff;border-color:var(--accent);box-shadow:0 4px 14px rgba(0,0,0,.2)}
.dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.dot-green{background:#22c55e;box-shadow:0 0 6px #22c55e}
.dot-yellow{background:#f59e0b;box-shadow:0 0 6px #f59e0b}

/* ══ COUNTER ══ */
.cnt-panel{display:none;margin-top:12px;background:var(--surface2);border-radius:12px;padding:14px;border:1.5px solid var(--border);animation:fadeUp .35s ease}
.cnt-panel.show{display:block}
@keyframes fadeUp{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
.cnt-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.cnt-name{font-size:14px;font-weight:800;color:var(--accent);display:block}
.cnt-status{font-size:12px;color:var(--txt2)}
.cnt-big{font-family:'Bebas Neue',sans-serif;font-size:54px;color:var(--accent);line-height:1}
.cnt-sub{font-size:11px;color:var(--txt2);text-align:right}
.pbar{height:6px;background:var(--bar);border-radius:99px;overflow:hidden;margin-top:8px}
.pfill{height:100%;background:var(--prog);border-radius:99px;transition:width .7s cubic-bezier(.34,1,.64,1)}

/* ══ TABS ══ */
.tabs{display:flex;gap:6px;margin-bottom:14px}
.tab{flex:1;padding:11px 6px;border:1.5px solid var(--border);border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;background:var(--surface2);color:var(--txt2);transition:all .2s;font-family:'Inter',sans-serif}
.tab:hover{border-color:var(--accent);color:var(--accent)}
.tab.active{background:var(--accent);color:#fff;border-color:var(--accent);box-shadow:0 4px 14px rgba(0,0,0,.2)}

/* ══ PANELS ══ */
.panel{display:none;background:var(--surface);border-radius:16px;padding:18px;margin-bottom:14px;border:1.5px solid var(--border);box-shadow:var(--shadow);transition:all .4s}
.panel.active{display:block}
.sec-title{font-family:'Bebas Neue',sans-serif;font-size:19px;letter-spacing:1.5px;color:var(--accent);margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid var(--border)}

/* ══ FIELDS ══ */
.field{margin-bottom:15px}
.lbl{display:block;font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.9px;margin-bottom:7px}
.req{color:var(--red)}
input[type=number],textarea{width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:15px;color:var(--txt);font-family:'Inter',sans-serif;background:var(--surface2);outline:none;transition:all .25s}
input:focus,textarea:focus{border-color:var(--accent2);box-shadow:0 0 0 3px rgba(30,106,191,.12);background:var(--surface)}
textarea{resize:none;height:70px}
.num-row{display:flex;gap:10px}.num-row .field{flex:1}

.btn-group{display:flex;gap:7px;margin-top:6px;flex-wrap:wrap}
.opt-btn{flex:1;min-width:70px;padding:11px 6px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;background:var(--surface2);color:var(--txt2);transition:all .2s;font-family:'Inter',sans-serif}
.opt-btn.sel-a{border-color:var(--accent);background:var(--accent);color:#fff}
.opt-btn.sel-b{border-color:var(--accent2);background:var(--accent2);color:#fff}
.opt-btn.sel-c{border-color:var(--accent);background:var(--surface);color:var(--accent);font-weight:800}

.cond{display:none}.cond.show{display:block}

.chk-row{display:flex;align-items:center;gap:12px;padding:13px;border:1.5px solid var(--border);border-radius:12px;cursor:pointer;margin-bottom:9px;background:var(--surface2);transition:all .2s}
.chk-row:hover{border-color:var(--accent2)}
.chk-row.on{border-color:var(--green);background:#f0fdf4}
body.night .chk-row.on{background:#052e1640}
.chk-box{width:24px;height:24px;border-radius:7px;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;background:var(--surface);transition:all .2s}
.chk-row.on .chk-box{background:var(--green);border-color:var(--green);color:#fff}
.chk-lbl{font-size:14px;font-weight:700;color:var(--txt)}
.chk-sub{font-size:11px;color:var(--txt2);margin-top:2px}
.aforo-extra{margin-top:10px;padding:12px;background:var(--surface2);border-radius:10px;border:1.5px dashed var(--accent2);display:none}
.hora-box{background:var(--surface2);border-radius:10px;padding:11px 14px;font-size:14px;color:var(--accent);font-weight:700;border:1.5px solid var(--border)}

/* Condición de Pera — 2 botones */
.pera2-row{display:flex;align-items:center;justify-content:space-between;padding:11px 4px;border-bottom:1px solid var(--border)}
.pera2-row:last-of-type{border-bottom:none}
.pera2-lbl{font-size:14px;font-weight:600;color:var(--txt)}
.pera2-btns{display:flex;gap:8px}
.pera2-btn{width:44px;height:44px;border-radius:12px;border:2px solid var(--border);background:var(--surface2);font-size:20px;font-weight:900;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center}
.pera2-btn.ok:not(.sel){color:#16a34a;border-color:rgba(22,163,74,.4)}
.pera2-btn.bad:not(.sel){color:#dc2626;border-color:rgba(220,38,38,.4)}
.pera2-btn.ok.sel{background:#16a34a;border-color:#16a34a;color:#fff;box-shadow:0 3px 10px rgba(22,163,74,.3)}
.pera2-btn.bad.sel{background:#dc2626;border-color:#dc2626;color:#fff;box-shadow:0 3px 10px rgba(220,38,38,.3)}
.maps-link{display:none;text-align:center;margin-top:10px;font-size:12px;color:var(--accent2);text-decoration:none;padding:9px;background:var(--surface);border-radius:10px;border:1.5px solid var(--border);font-weight:600}

/* ══ VACACIONES MODAL ══ */
.vac-btn{
  display:flex;align-items:center;gap:6px;margin-top:10px;
  padding:9px 14px;background:var(--surface2);border:1.5px solid var(--border);
  border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;
  color:var(--txt2);width:100%;justify-content:center;transition:all .2s;
  font-family:'Inter',sans-serif;
}
.vac-btn:hover{border-color:var(--accent);color:var(--accent)}
.vac-modal{
  display:none;margin-top:10px;background:var(--surface2);
  border-radius:12px;padding:14px;border:2px solid #f59e0b;
  animation:fadeUp .3s ease;
}
.vac-modal.open{display:block}
.vac-modal-title{font-size:12px;font-weight:800;color:#b45309;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
.vac-rec-btns{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.vac-rec-btn{flex:1;padding:8px 6px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;background:var(--surface);color:var(--txt2);transition:all .2s;font-family:'Inter',sans-serif}
.vac-rec-btn.sel{background:#f59e0b;color:#fff;border-color:#f59e0b}
.vac-fields{display:flex;gap:8px;margin-bottom:10px}
.vac-fields .field{flex:1;margin-bottom:0}
.vac-fields input{padding:9px 10px;font-size:14px}
.vac-save{width:100%;padding:10px;background:#f59e0b;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:800;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.vac-save:hover{background:#d97706}
.vac-status{margin-top:12px}
.vac-item{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--surface);border-radius:8px;margin-bottom:6px;border:1.5px solid var(--border)}
.vac-item-txt{font-size:12px;color:var(--txt);font-weight:600}
.vac-item-del{background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 4px}

/* ══ FOTO EVIDENCIA ══ */
.foto-card{background:var(--surface);border-radius:16px;padding:16px;margin-bottom:14px;border:1.5px solid var(--border);box-shadow:var(--shadow)}
.foto-title{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1.5px;color:var(--accent);margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--border)}
.foto-btn-cam,.foto-btn-gal{
  flex:1;padding:14px 8px;border-radius:12px;border:none;
  font-size:15px;font-weight:800;cursor:pointer;
  font-family:'Inter',sans-serif;transition:all .2s;
}
.foto-btn-cam{background:linear-gradient(135deg,#0f3460,#1e5caa);color:#fff}
.foto-btn-gal{background:var(--surface2);color:var(--txt);border:1.5px solid var(--border)}
.foto-btn-cam:active,.foto-btn-gal:active{transform:scale(.95)}

.foto-upload-area{
  border:2px dashed var(--border);border-radius:12px;
  padding:20px;text-align:center;cursor:pointer;
  transition:all .2s;background:var(--surface2);
  position:relative;
}
.foto-upload-area:hover{border-color:var(--accent2);background:var(--surface)}
.foto-upload-area input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.foto-icon{font-size:36px;margin-bottom:8px;display:block}
.foto-label{font-size:14px;font-weight:700;color:var(--txt2)}
.foto-sub{font-size:11px;color:var(--txt2);margin-top:4px;opacity:.7}
.foto-previews{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.foto-thumb{
  width:80px;height:80px;border-radius:10px;object-fit:cover;
  border:2px solid var(--border);position:relative;display:inline-block;
}
.foto-thumb-wrap{position:relative;width:80px;height:80px}
.foto-thumb-wrap img{width:80px;height:80px;border-radius:10px;object-fit:cover;border:2px solid var(--border)}
.foto-del{
  position:absolute;top:-6px;right:-6px;
  background:#dc2626;color:#fff;border:none;border-radius:50%;
  width:20px;height:20px;font-size:11px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-weight:900;
}
.foto-count{font-size:12px;color:var(--txt2);margin-top:8px;text-align:center}

.toast{position:fixed;top:16px;left:50%;transform:translateX(-50%) translateY(-90px);color:#fff;padding:12px 22px;border-radius:12px;font-size:14px;font-weight:700;z-index:600;transition:transform .45s cubic-bezier(.34,1.56,.64,1);white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.3);background:#0f3460}
.toast.show{transform:translateX(-50%) translateY(0)}

.send-fixed{position:fixed;bottom:0;left:0;right:0;padding:12px 14px 16px;background:var(--fixed);border-top:1.5px solid var(--border);z-index:100;transition:background .4s}
.send-wrap{max-width:420px;margin:0 auto}
.send-btn{width:100%;padding:16px;background:var(--send);color:#fff;border:none;border-radius:13px;font-size:16px;font-weight:800;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;box-shadow:0 4px 16px rgba(22,163,74,.3)}
.send-btn:hover{transform:translateY(-1px)}.send-btn:active{transform:scale(.98)}

/* ══ PROFILE PICKER — GAME STYLE ══ */
.profile-picker{padding:4px 0 16px;background:transparent}
.profile-picker-title{text-align:center;margin-bottom:18px;padding:14px 0 0}
.profile-picker-logo{font-size:32px;margin-bottom:2px;animation:logoPulse 2s ease-in-out infinite}
@keyframes logoPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.profile-picker-h{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:3px;color:var(--accent)}
.profile-picker-s{font-size:11px;color:var(--txt2);margin-top:2px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
.profile-grid{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:4px}
.profile-card{
  position:relative;
  display:flex;flex-direction:column;align-items:center;gap:0;
  padding:0;border-radius:14px;overflow:hidden;
  background:#0a1628;border:1.5px solid rgba(255,255,255,.12);
  cursor:pointer;transition:all .25s cubic-bezier(.34,1.4,.64,1);
  font-family:'Inter',sans-serif;width:calc(33% - 6px);min-width:90px;max-width:116px;
  box-shadow:0 4px 20px rgba(0,0,0,.35);
}
/* Glow on hover per card */
.pc-m:hover{border-color:#4a9eff;box-shadow:0 0 0 2px rgba(74,158,255,.25),0 8px 24px rgba(0,0,0,.5);transform:translateY(-4px) scale(1.03)}
.pc-c:hover{border-color:#888;box-shadow:0 0 0 2px rgba(136,136,136,.25),0 8px 24px rgba(0,0,0,.5);transform:translateY(-4px) scale(1.03)}
.pc-jc:hover{border-color:#4ade80;box-shadow:0 0 0 2px rgba(74,222,128,.25),0 8px 24px rgba(0,0,0,.5);transform:translateY(-4px) scale(1.03)}
.pc-super:hover{border-color:#FF7A00;box-shadow:0 0 0 2px rgba(255,122,0,.3),0 8px 24px rgba(0,0,0,.5);transform:translateY(-4px) scale(1.03)}
.pc-jefe:hover{border-color:#a78bfa;box-shadow:0 0 0 2px rgba(167,139,250,.3),0 8px 24px rgba(0,0,0,.5);transform:translateY(-4px) scale(1.03)}
.profile-card:active{transform:scale(.95)!important}

/* Tier banner top */
.profile-tier{
  width:100%;padding:3px 0;text-align:center;
  font-size:8px;font-weight:900;letter-spacing:2px;text-transform:uppercase;
}
.tier-field{background:#1e3a6a;color:#60a5fa}
.tier-elite{background:#FF7A00;color:#fff}
.tier-legend{background:linear-gradient(90deg,#7c3aed,#a855f7);color:#fff}
.tier-lock{background:#1a1a1a;color:#888}

/* Avatar area */
.profile-avatar{
  width:100%;height:86px;
  display:flex;align-items:flex-end;justify-content:center;
  overflow:hidden;position:relative;padding-top:4px;
}
.pa-m{background:linear-gradient(180deg,#0d2040 0%,#1e3a6a 100%)}
.pa-c{background:linear-gradient(180deg,#0d0d0d 0%,#252525 100%)}
.pa-jc{background:linear-gradient(180deg,#0a1f10 0%,#1a4a20 100%)}
.pa-super{background:linear-gradient(180deg,#1f0d00 0%,#4a1e00 100%)}
.pa-jefe{background:linear-gradient(180deg,#0a0d2a 0%,#1a1a6a 100%)}
.profile-avatar::after{
  content:'';position:absolute;bottom:0;left:0;right:0;height:30px;
  background:linear-gradient(transparent,rgba(0,0,0,.6));
}
.profile-avatar svg{position:relative;z-index:1}

/* Info area */
.profile-info{width:100%;padding:8px 8px 10px;background:#0a1628}
.profile-name{font-size:12px;font-weight:900;color:#fff;text-align:center;letter-spacing:.5px;line-height:1.2}
.profile-role{font-size:9px;color:rgba(255,255,255,.4);text-align:center;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:2px}

/* Stat bars */
.profile-stats{display:flex;gap:2px;margin-top:6px;padding:0 2px}
.pstat{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.1)}
.ps-m .pstat:nth-child(1){background:#4a9eff}
.ps-m .pstat:nth-child(2){background:#4a9eff;opacity:.7}
.ps-m .pstat:nth-child(3){background:#4a9eff;opacity:.4}
.ps-c .pstat:nth-child(1){background:#888}
.ps-c .pstat:nth-child(2){background:#888;opacity:.7}
.ps-c .pstat:nth-child(3){background:#888;opacity:.4}
.ps-jc .pstat:nth-child(1){background:#4ade80}
.ps-jc .pstat:nth-child(2){background:#4ade80;opacity:.7}
.ps-jc .pstat:nth-child(3){background:#4ade80;opacity:.4}
.ps-super .pstat:nth-child(1){background:#FF7A00}
.ps-super .pstat:nth-child(2){background:#FF7A00;opacity:.7}
.ps-super .pstat:nth-child(3){background:#FF7A00;opacity:.5}
.ps-jefe .pstat:nth-child(1){background:#a78bfa}
.ps-jefe .pstat:nth-child(2){background:#a78bfa;opacity:.7}
.ps-jefe .pstat:nth-child(3){background:#a78bfa;opacity:.4}

/* Lock icon for auth cards */
.profile-lock{position:absolute;top:24px;right:6px;font-size:12px;z-index:2;opacity:.7}

/* Back button */
.back-to-picker{
  display:flex;align-items:center;gap:6px;
  background:transparent;border:1.5px solid var(--border);
  border-radius:10px;padding:8px 14px;margin-bottom:12px;
  font-size:13px;font-weight:700;color:var(--txt2);
  cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;
}
.back-to-picker:hover{color:var(--accent);border-color:var(--accent)}

/* ══ PROFILE PICKER ══ */
.step-card{background:var(--surface);border-radius:18px;padding:20px 16px;margin-bottom:14px;border:1.5px solid var(--border);box-shadow:var(--shadow)}
.step-label{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;color:var(--accent);margin-bottom:16px;border-bottom:2px solid var(--border);padding-bottom:8px}

/* Botón modo (☀️ / 🌙) */
.mode-big-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px 10px;border-radius:16px;border:2.5px solid var(--border);background:var(--surface2);color:var(--txt);cursor:pointer;font-family:'Inter',sans-serif;gap:4px;transition:all .2s}
.mode-big-btn.sel-mode{border-color:var(--accent);background:var(--accent);color:#fff;box-shadow:0 4px 18px rgba(15,52,96,.25)}

/* Botones de estado grandes */
.big-status-btn{flex:1;padding:14px 8px;border-radius:14px;border:2px solid var(--border);background:var(--surface2);color:var(--txt);font-size:13px;font-weight:800;cursor:pointer;font-family:'Inter',sans-serif;line-height:1.5;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:4px}
.big-status-btn.active{color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.2)}
.big-status-btn.green.active{background:#16a34a;border-color:#16a34a}
.big-status-btn.red.active{background:#dc2626;border-color:#dc2626}
.big-status-btn.amber.active{background:#d97706;border-color:#d97706}
.big-status-btn.blue.active{background:#1d4ed8;border-color:#1d4ed8}
.big-status-btn.slate.active{background:var(--accent);border-color:var(--accent)}

/* Labels e inputs grandes */
.big-field-label{font-size:12px;font-weight:800;color:var(--txt2);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px}
.big-input{width:100%;padding:14px 12px;font-size:18px;font-weight:700;color:var(--txt);background:var(--surface2);border:1.5px solid var(--border);border-radius:12px;outline:none;font-family:'Inter',sans-serif;transition:border-color .2s;box-sizing:border-box}
.big-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(15,52,96,.1)}

/* Checkboxes grandes */
.big-chk{display:flex;align-items:center;gap:14px;padding:14px 4px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;border-radius:8px}
.big-chk:last-of-type{border-bottom:none}
.big-chk:active{background:var(--surface2)}
.big-chk-box{width:40px;height:40px;border-radius:10px;border:2px solid var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;transition:all .2s}
.big-chk-box.checked{background:var(--accent);border-color:var(--accent);color:#fff}
.big-chk-lbl{font-size:15px;font-weight:700;color:var(--txt)}
.big-chk-sub{font-size:12px;color:var(--txt2);margin-top:2px}


/* ══ MODO ALARMA ══ */
.alarm-fab{display:block;width:100%;padding:16px;background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;border:none;border-radius:14px;font-size:16px;font-weight:900;letter-spacing:1px;cursor:pointer;font-family:'Inter',sans-serif;box-shadow:0 4px 20px rgba(220,38,38,.4);animation:alarmPulse 2.5s ease-in-out infinite;margin-top:12px;margin-bottom:4px}
.alarm-fab:active{transform:scale(.97)}
@keyframes alarmPulse{0%,100%{box-shadow:0 4px 20px rgba(220,38,38,.4)}50%{box-shadow:0 4px 32px rgba(220,38,38,.7),0 0 0 6px rgba(220,38,38,.15)}}
.alarm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:900;display:none;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px)}
.alarm-overlay.open{display:flex}
.alarm-sheet{width:100%;max-width:480px;background:#0f0f0f;border-radius:24px 24px 0 0;padding:24px 20px 36px;border-top:3px solid #dc2626;animation:slideUp .35s cubic-bezier(.34,1.2,.64,1)}
.alarm-header{text-align:center;margin-bottom:20px}
.alarm-siren{font-size:40px;animation:alarmShake .3s ease-in-out infinite alternate}
@keyframes alarmShake{from{transform:rotate(-8deg)}to{transform:rotate(8deg)}}
.alarm-title{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;color:#dc2626;margin-top:6px}
.alarm-sub{font-size:13px;color:rgba(255,255,255,.5);margin-top:2px}
.alarm-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
.alarm-opt{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 10px;border-radius:14px;background:#1a1a1a;border:2px solid #333;color:#fff;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.alarm-opt:active{transform:scale(.95)}
.alarm-opt.selected{background:#dc2626;border-color:#dc2626;box-shadow:0 0 20px rgba(220,38,38,.4)}
.alarm-opt-icon{font-size:28px}
.alarm-opt-txt{font-size:12px;font-weight:800;letter-spacing:.5px;text-align:center}
.alarm-actions{display:flex;gap:10px}
.alarm-cancel-btn{flex:1;padding:14px;background:#1a1a1a;color:#888;border:1.5px solid #333;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif}
.alarm-send-btn{flex:2;padding:14px;background:#dc2626;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.alarm-send-btn:disabled{background:#3a1a1a;color:#666;cursor:not-allowed}
.alarm-send-btn:not(:disabled){box-shadow:0 4px 16px rgba(220,38,38,.4)}
.alarm-confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:950;display:none;align-items:center;justify-content:center;backdrop-filter:blur(6px)}
.alarm-confirm-overlay.open{display:flex}
.alarm-confirm-sheet{background:#0f0f0f;border-radius:20px;padding:28px 24px;max-width:340px;width:90%;text-align:center;border:2px solid #dc2626;box-shadow:0 0 60px rgba(220,38,38,.3);animation:popIn .4s cubic-bezier(.34,1.4,.64,1)}
.alarm-confirm-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:#dc2626;margin-bottom:8px}
.alarm-confirm-type{font-size:20px;font-weight:900;color:#fff;margin-bottom:10px;padding:8px 16px;background:#1a1a1a;border-radius:10px}
.alarm-confirm-sub{font-size:13px;color:rgba(255,255,255,.5);margin-bottom:20px;line-height:1.5}
.alarm-confirm-btns{display:flex;gap:10px}
.alarm-no-btn{flex:1;padding:13px;background:#1a1a1a;color:#888;border:1.5px solid #333;border-radius:11px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif}
.alarm-yes-btn{flex:2;padding:13px;background:#dc2626;color:#fff;border:none;border-radius:11px;font-size:14px;font-weight:800;cursor:pointer;font-family:'Inter',sans-serif;box-shadow:0 4px 16px rgba(220,38,38,.4);animation:alarmPulse 1.5s ease-in-out infinite}
.alarm-incoming{position:fixed;inset:0;background:#dc2626;z-index:999;align-items:center;justify-content:center;flex-direction:column;text-align:center;animation:alarmFlash .5s ease-in-out infinite alternate}
.alarm-incoming.show{display:flex}
@keyframes alarmFlash{from{background:#dc2626}to{background:#7f1d1d}}
.alarm-incoming-content{padding:32px 24px;max-width:340px}
.alarm-incoming-title{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;color:#fff;margin:12px 0 8px}
.alarm-incoming-type{font-size:26px;font-weight:900;color:#fff;background:rgba(0,0,0,.25);border-radius:12px;padding:10px 20px;margin:10px 0}
.alarm-incoming-info{font-size:13px;color:rgba(255,255,255,.8);margin-bottom:24px;line-height:1.6}
.alarm-incoming-close{padding:14px 32px;background:#fff;color:#dc2626;border:none;border-radius:12px;font-size:16px;font-weight:900;cursor:pointer;font-family:'Inter',sans-serif}
.alarm-loc-btn{flex:1;padding:10px 6px;border-radius:10px;border:1.5px solid #444;background:#1a1a1a;color:rgba(255,255,255,.6);font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.alarm-loc-btn.sel{background:#dc2626;border-color:#dc2626;color:#fff}
.alarm-quien-btn{flex:1;padding:11px 6px;border-radius:10px;border:1.5px solid #444;background:#1a1a1a;color:rgba(255,255,255,.6);font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;text-align:center}
.alarm-quien-btn.sel{background:#FF7A00;border-color:#FF7A00;color:#fff}

/* ══ CONFIRM MODAL ══ */
.confirm-overlay{
  position:fixed;top:0;left:0;right:0;bottom:0;
  background:rgba(0,0,0,.6);z-index:2500;
  display:none;align-items:flex-end;justify-content:center;
  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);
  -webkit-tap-highlight-color:transparent;
}
.confirm-overlay.open{display:flex}
.confirm-sheet{
  background:var(--surface);border-radius:20px 20px 0 0;
  padding:24px 20px 36px;width:100%;max-width:480px;
  animation:slideUp .35s cubic-bezier(.34,1.2,.64,1);
;padding-bottom:max(16px,env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.confirm-title{font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--accent);letter-spacing:1px;margin-bottom:4px}
.confirm-sub{font-size:13px;color:var(--txt2);margin-bottom:16px}
.confirm-detail{
  background:var(--surface2);border-radius:12px;padding:14px;
  margin-bottom:18px;border:1.5px solid var(--border);
  font-size:13px;line-height:1.8;color:var(--txt);
  white-space:pre-wrap;word-break:break-word;max-height:180px;overflow-y:auto;
}
.confirm-btns{display:flex;gap:10px}
.confirm-cancel{flex:1;padding:14px;background:var(--surface2);color:var(--txt2);border:1.5px solid var(--border);border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif}
.confirm-send{flex:2;padding:14px;background:#16a34a;color:#fff;border:none;border-radius:11px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Inter',sans-serif;box-shadow:0 4px 16px rgba(22,163,74,.3)}

/* ══ RESULT SCREEN ══ */
.result-view{
  display:none;position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;z-index:9000;
  background:var(--bg);flex-direction:column;overflow:hidden;
}
.result-view.open{display:flex}

/* ══ PETROLEUM BACKGROUND ══ */
/* ══ PETROLEUM BACKGROUND ══ */
.petro-bg{
  position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;
}
.petro-bg svg{width:100%;height:100%;object-fit:cover;}

/* Make sidebar and content appear above background */
.sidebar{z-index:400}
.wrap{position:relative;z-index:2}
.send-fixed{z-index:100}
.login-overlay,.alarm-overlay,.alarm-confirm-overlay,.alarm-incoming,.perm-overlay{z-index:800}

/* Darken app cards/panels slightly for readability on top of bg */
.step-card,.well-picker,.header,.send-fixed,.hist-header,.gps-bar{
  backdrop-filter:blur(2px);
}

/* ══ PICKER / KEYFRAMES ══ */
@keyframes pkFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pkBlink{0%,100%{opacity:1}50%{opacity:.3}}
.pk-wrap{animation:pkFade .4s ease both}
.pk-top{background:#1e40af;border-radius:18px;padding:20px 16px 22px;margin-bottom:8px}
.pk-top-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.pk-logo-box{background:#fff;border-radius:10px;padding:4px 10px;display:block}
.pk-logo-box img{height:28px;width:auto;display:block}
.pk-clock-box{text-align:right}
.pk-clock{font-size:20px;font-weight:700;color:#fff;font-family:monospace;letter-spacing:1px;line-height:1}
.pk-city{font-size:10px;color:rgba(255,255,255,.55);letter-spacing:1px;margin-top:3px}
.pk-center{text-align:center}
.pk-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.15);border-radius:20px;padding:4px 12px;font-size:11px;color:rgba(255,255,255,.9);margin-bottom:12px}
.pk-blink{width:6px;height:6px;border-radius:50%;background:#4ade80;animation:pkBlink 2s infinite;flex-shrink:0}
.pk-hi{font-size:22px;font-weight:700;color:#fff;margin-bottom:4px}
.pk-sub{font-size:13px;color:rgba(255,255,255,.65);margin-bottom:10px}
.pk-campo{font-size:10px;color:rgba(255,255,255,.4);letter-spacing:3px;text-transform:uppercase}
.pk-body{background:#fff;border-radius:18px;border:1px solid #e5e7eb;overflow:hidden}
.pk-row{display:flex;align-items:center;gap:12px;padding:16px 16px;border-bottom:1px solid #f3f4f6;cursor:pointer;transition:background .15s;background:#fff;width:100%;border:none;text-align:left}
.pk-row:hover,.pk-row.open{background:#f8faff}
.pk-ball{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
.pk-info{flex:1}
.pk-info-name{font-size:16px;font-weight:700;color:#111827;margin-bottom:3px}
.pk-info-sub{font-size:13px;color:#9ca3af}
.pk-chev{font-size:16px;color:#d1d5db;transition:transform .2s;flex-shrink:0}
.pk-row.open .pk-chev{transform:rotate(90deg)}
.pk-divider{height:1px;background:#f3f4f6}
.pk-cards{display:none;flex-wrap:wrap;gap:8px;padding:10px 12px 12px;background:#f9fafb}
.pk-cards.open{display:flex}
.pk-card{flex:1;min-width:90px;background:#fff;border:1.5px solid #e5e7eb;border-radius:16px;padding:16px 8px 12px;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;transition:all .15s;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.pk-card:hover{border-color:#1e40af;background:#eff6ff;transform:translateY(-2px)}
.pk-card:active{transform:translateY(0)}
.pk-card-ico{font-size:30px;margin-bottom:4px}
.pk-card-nm{font-size:13px;font-weight:700;color:#1f2937;line-height:1.35}
.pk-card-lk{font-size:11px;color:#9ca3af;margin-top:3px}
.pk-foot{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-top:1px solid #f3f4f6;background:#fff}
.pk-foot-l{display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280}
.pk-foot-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;animation:pkBlink 2s infinite}
.pk-foot-r{font-size:11px;color:#9ca3af;font-family:monospace}
