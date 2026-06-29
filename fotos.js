// fotos.js — Manejo de fotos para Campo Cuichapa PWA
// Fuente: extraído del monolito index.html original

// ── Clave localStorage ─────────────────────────────────────
var FOTOS_KEY = 'cuichapa_fotos_temp';

// ── Restaurar fotos si la app se recargó durante el turno ──
(function(){
  try{
    var saved = JSON.parse(localStorage.getItem(FOTOS_KEY)||'[]');
    if(saved.length){ fotos = saved; renderFotos(); }
  }catch(e){}
})();

// ── Comprimir imagen File → base64 (para captura de fotos) ─
function comprimirImagen(file, callback){
  var maxW = 900, maxH = 900, quality = 0.75;
  var reader = new FileReader();
  reader.onerror = function(){ callback(null); };
  reader.onload = function(ev){
    var img = new Image();
    img.onerror = function(){ callback(null); };
    img.onload = function(){
      var w = img.width, hh = img.height;
      if(w > maxW || hh > maxH){
        var ratio = Math.min(maxW/w, maxH/hh);
        w = Math.round(w*ratio); hh = Math.round(hh*ratio);
      }
      setTimeout(function(){
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = hh;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, hh);
        var data = canvas.toDataURL('image/jpeg', quality);
        callback(data);
      }, 0);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Agregar fotos al reporte ──────────────────────────────
function agregarFotos(e){
  var files = Array.from(e.target.files);
  setTimeout(function(){ e.target.value=''; }, 100); // reset con delay para iOS
  if(!files.length) return;

  var count = document.getElementById('fotoCount');
  if(count) count.textContent = '\u23f3 Guardando foto...';

  var procesadas = 0;
  var total = files.filter(function(f){ return f.type.startsWith('image/'); }).length;
  if(!total){ if(count) count.textContent=''; return; }

  files.forEach(function(file){
    if(!file.type.startsWith('image/')){ return; }
    comprimirImagen(file, function(data){
      procesadas++;
      if(data){
        fotos.push({ data: data, nombre: file.name, size: data.length });
        // FIX: Si localStorage está lleno, mantener fotos en memoria.
        // NO destruir el array con while(fotos.length > 1){ fotos.shift(); }
        try{
          localStorage.setItem(FOTOS_KEY, JSON.stringify(fotos));
        }catch(ex){
          console.warn('[FOTOS] localStorage lleno, se mantienen fotos en memoria:', ex.message);
        }
        renderFotos();
      }
      if(procesadas === total){
        if(count) count.textContent = fotos.length + ' foto'+(fotos.length!==1?'s':'')+' lista'+(fotos.length!==1?'s':'');
      }
    });
  });
}

// ── Borrar una foto por índice ────────────────────────────
function borrarFoto(idx){
  fotos.splice(idx, 1);
  try{ localStorage.setItem(FOTOS_KEY, JSON.stringify(fotos)); }catch(e){}
  renderFotos();
}

// ── Limpiar todas las fotos del reporte ──────────────────
function limpiarFotos(){
  fotos = [];
  try{ localStorage.removeItem(FOTOS_KEY); }catch(e){}
  renderFotos();
}

// ── Renderizar previsualizaciones de fotos del reporte ───
function renderFotos(){
  var prev  = document.getElementById('fotoPreviews');
  var count = document.getElementById('fotoCount');
  if(!prev) return;
  prev.innerHTML = '';
  fotos.forEach(function(f, i){
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-block;margin:4px;vertical-align:top';
    var img = document.createElement('img');
    img.src = (typeof f === 'object') ? (f.data || f) : f;
    img.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:8px;display:block';
    var btn = document.createElement('button');
    btn.textContent = '\xd7';
    btn.style.cssText = 'position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:13px;line-height:1;padding:0';
    btn.onclick = (function(n){ return function(ev){ ev.stopPropagation(); borrarFoto(n); }; })(i);
    wrap.appendChild(img);
    wrap.appendChild(btn);
    prev.appendChild(wrap);
  });
  if(count){
    count.textContent = fotos.length > 0
      ? fotos.length + ' foto' + (fotos.length!==1?'s':'') + ' lista' + (fotos.length!==1?'s':'')
      : '';
  }
}

// ── Recomprimir base64 existente (usado por umSendImage) ─
function comprimirFoto(base64, callback){
  var maxW = 900, maxH = 900, quality = 0.75;
  var img = new Image();
  img.onerror = function(){ callback(base64); }; // fallback sin compresión
  img.onload = function(){
    var w = img.width, hh = img.height;
    if(w > maxW || hh > maxH){
      var ratio = Math.min(maxW/w, maxH/hh);
      w = Math.round(w*ratio); hh = Math.round(hh*ratio);
    }
    setTimeout(function(){
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = hh;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, hh);
      callback(canvas.toDataURL('image/jpeg', quality));
    }, 0);
  };
  img.src = base64;
}

// ── Agregar fotos de alarma ───────────────────────────────
function agregarFotosAlarma(event){
  var files = event.target.files;
  if(!files||!files.length) return;
  var grid    = document.getElementById('alarmFotoGrid');
  var countEl = document.getElementById('alarmFotoCountNew');
  var MAX_ALARM_FOTOS = (typeof MAX_FOTOS_ANDROID !== 'undefined') ? MAX_FOTOS_ANDROID : 7;
  Array.from(files).forEach(function(file){
    if(fotosAlarma.length >= MAX_ALARM_FOTOS) return;
    if(!file.type.startsWith('image/')) return;
    var reader = new FileReader();
    reader.onload = function(e){
      var data = e.target.result;
      fotosAlarma.push({ data: data, nombre: file.name });
      // Render thumbnail
      if(grid){
        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;display:inline-block;margin:4px;vertical-align:top';
        var img = document.createElement('img');
        img.src = data;
        img.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:8px;display:block';
        var idx = fotosAlarma.length - 1;
        var btn = document.createElement('button');
        btn.textContent = '\xd7';
        btn.style.cssText = 'position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:13px;line-height:1;padding:0';
        btn.onclick = (function(n){ return function(ev){
          ev.stopPropagation();
          fotosAlarma.splice(n,1);
          grid.removeChild(wrap);
          if(countEl) countEl.textContent = fotosAlarma.length > 0
            ? fotosAlarma.length+' foto'+(fotosAlarma.length!==1?'s':'')
            : '';
        }; })(idx);
        wrap.appendChild(img); wrap.appendChild(btn);
        grid.appendChild(wrap);
      }
      if(countEl) countEl.textContent = fotosAlarma.length+' foto'+(fotosAlarma.length!==1?'s':'');
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

// ── Limpiar fotos de alarma post-envío ───────────────────
function limpiarFotosPostAlarma(){
  try{ renderFotos(); }catch(e){}
  var fg  = document.getElementById('alarmFotoGrid');    if(fg)  fg.innerHTML  = '';
  var fc  = document.getElementById('alarmFotoCountNew');if(fc)  fc.textContent = '';
  var fi1 = document.getElementById('alarmFotoInputCam');if(fi1) fi1.value = '';
  var fi2 = document.getElementById('alarmFotoInputGal');if(fi2) fi2.value = '';
}
