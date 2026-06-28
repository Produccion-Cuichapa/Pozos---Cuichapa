// ══ fotos.js — Campo Cuichapa PWA ═══════════════════════════════
// Captura, compresión y gestión de fotografías de campo.
// Requiere: config.js (FOTOS_KEY) cargado antes.
// Requiere: var fotos=[] y var fotosAlarma=[] declarados en index.html.
// Nota: enviarSigFoto() permanece en index.html (closure de enviarConUltramsg).

// ── comprimirImagen ──
function comprimirImagen(file, callback){
  // Reducido a 900px para guardar más rápido sin perder calidad visible
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
      // Usar setTimeout para no bloquear UI
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

// ── agregarFotos ──
function agregarFotos(e){
  var files = Array.from(e.target.files);
  setTimeout(function(){ e.target.value=''; }, 100); // reset con delay para iOS
  if(!files.length) return;

  var count = document.getElementById('fotoCount');
  if(count) count.textContent = '⏳ Guardando foto...';

  var procesadas = 0;
  var total = files.filter(function(f){ return f.type.startsWith('image/'); }).length;
  if(!total){ if(count) count.textContent=''; return; }

  files.forEach(function(file){
    if(!file.type.startsWith('image/')){ return; }
    comprimirImagen(file, function(data){
      procesadas++;
      if(data){
        fotos.push({ data: data, nombre: file.name, size: data.length });
        // Intentar guardar, si no hay espacio reducir calidad de anteriores
        try{
          localStorage.setItem(FOTOS_KEY, JSON.stringify(fotos));
        }catch(ex){
          // localStorage lleno: quitar fotos viejas hasta que quepa
          while(fotos.length > 1){
            fotos.shift();
            try{ localStorage.setItem(FOTOS_KEY, JSON.stringify(fotos)); break; }catch(e2){}
          }
        }
        // Mostrar miniatura de inmediato sin esperar al resto
        renderFotos();
      }
      if(procesadas === total){
        if(count) count.textContent = fotos.length + ' foto'+(fotos.length!==1?'s':'')+' lista'+(fotos.length!==1?'s':'');

      }
    });
  });
}

// ── borrarFoto ──
function borrarFoto(idx){
  fotos.splice(idx, 1);
  try{ localStorage.setItem(FOTOS_KEY, JSON.stringify(fotos)); }catch(e){}
  renderFotos();
}

// ── limpiarFotos ──
function limpiarFotos(){
  fotos = [];
  try{ localStorage.removeItem(FOTOS_KEY); }catch(e){}
  renderFotos();
}

// ── renderFotos ──
function renderFotos(){
  var prev  = document.getElementById('fotoPreviews');
  var count = document.getElementById('fotoCount');
  if(!prev) return;
  if(!fotos.length){
    prev.innerHTML  = '';
    if(count) count.textContent = '';
    return;
  }
  prev.innerHTML = fotos.map(function(f, i){
    var src = f.data || f; // compatibilidad con versión anterior
    return '<div class="foto-thumb-wrap">'
      +'<img src="'+src+'" alt="foto '+(i+1)+'" '
      +'style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:2px solid var(--border)">'
      +'<button class="foto-del" onclick="borrarFoto('+i+')">✕</button>'
      +'</div>';
  }).join('');
  if(count) count.textContent = '📸 '+fotos.length+' foto'+(fotos.length===1?'':'s')+' lista'+(fotos.length===1?'':'s');
}

// ── agregarFotosAlarma ──
function agregarFotosAlarma(event){
  var files = event.target.files;
  if(!files||!files.length) return;
  var grid = document.getElementById('alarmFotoGrid');
  var countEl = document.getElementById('alarmFotoCountNew');
  Array.from(files).forEach(function(file){
    if(fotosAlarma.length >= 5) return;
    var reader = new FileReader();
    reader.onload = function(e){
      var data = e.target.result;
      var id = Date.now()+'_'+Math.random();
      fotosAlarma.push({data:data, nombre:file.name, id:id});
      // Render miniatura
      var wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;display:inline-block';
      var img = document.createElement('img');
      img.src = data;
      img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:10px;border:1.5px solid var(--border)';
      var del = document.createElement('button');
      del.textContent = '✕';
      del.style.cssText = 'position:absolute;top:2px;right:2px;background:rgba(0,0,0,.7);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;line-height:1';
      del.onclick = (function(fid, wr){ return function(){
        fotosAlarma = fotosAlarma.filter(function(f){ return f.id !== fid; });
        wr.remove();
        countEl.textContent = fotosAlarma.length ? fotosAlarma.length+' foto'+(fotosAlarma.length>1?'s':'')+' lista'+(fotosAlarma.length>1?'s':''): '';
      };})(id, wrap);
      wrap.appendChild(img); wrap.appendChild(del);
      grid.appendChild(wrap);
      countEl.textContent = fotosAlarma.length+' foto'+(fotosAlarma.length>1?'s':'')+' lista'+(fotosAlarma.length>1?'s':'');
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

// ── limpiarFotosPostAlarma ──
function limpiarFotosPostAlarma(){
  try{ renderFotos(); }catch(e){}
  var fg=document.getElementById('fotoGrid'); if(fg) fg.innerHTML='';
  var fc=document.getElementById('fotoCount'); if(fc) fc.textContent='';
  var fi1=document.getElementById('fotoInputCam'),fi2=document.getElementById('fotoInputGal');
  if(fi1) fi1.value=''; if(fi2) fi2.value='';
}

// ── comprimirFoto ──
function comprimirFoto(base64, callback){
  try{
    // Android necesita compresión más agresiva — fotos de 12-20MB
    var isAndroid = /Android/i.test(navigator.userAgent);
    var MAX     = isAndroid ? 800 : 1024;
    var QUALITY = isAndroid ? 0.50 : 0.70;
    var MAX_KB  = isAndroid ? 150  : 300;  // límite objetivo en KB

    var img = new Image();
    img.onload = function(){
      var w = img.width, h = img.height;
      // Reducir hasta que quepa en MAX
      if(w > MAX){ h = Math.round(h*MAX/w); w = MAX; }
      if(h > MAX){ w = Math.round(w*MAX/h); h = MAX; }

      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      var compressed = canvas.toDataURL('image/jpeg', QUALITY);
      var newKB = Math.round(compressed.length * 0.75 / 1024);

      // Si sigue siendo grande, comprimir otra vez
      if(newKB > MAX_KB){
        var canvas2 = document.createElement('canvas');
        var escala = Math.sqrt(MAX_KB / newKB);
        var w2 = Math.max(200, Math.round(w * escala));
        var h2 = Math.max(200, Math.round(h * escala));
        canvas2.width = w2; canvas2.height = h2;
        canvas2.getContext('2d').drawImage(canvas, 0, 0, w2, h2);
        compressed = canvas2.toDataURL('image/jpeg', 0.55);
        newKB = Math.round(compressed.length * 0.75 / 1024);
      }

      var origKB = Math.round(base64.length * 0.75 / 1024);
      console.log('Foto comprimida: '+origKB+'KB → '+newKB+'KB ('+w+'x'+h+') Android:'+isAndroid);
      callback(compressed);
    };
    img.onerror = function(){ callback(base64); };
    img.src = base64.startsWith('data:') ? base64 : 'data:image/jpeg;base64,'+base64;
  }catch(e){ callback(base64); }
}

/* alarm-photo-cache-bust Sun Jun 28 05:47:34 AM UTC 2026 */
