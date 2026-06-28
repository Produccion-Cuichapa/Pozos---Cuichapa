// android-fix.js — Fix teclado virtual Android
// Extraído de index.html Fase 1
// Mantiene scope global (window)
// ══ ANDROID: teclado virtual, textarea, viewport ════════════
(function(){
  var isAndroid = /android/i.test(navigator.userAgent);
  var isChrome  = /chrome/i.test(navigator.userAgent);

  // ── Scroll al textarea activo cuando el teclado sube ───────
  function scrollToActive(){
    var el = document.activeElement;
    if(!el || (el.tagName!=='TEXTAREA' && el.tagName!=='INPUT')) return;
    console.log('[ANDROID] scrollToActive:', el.id||el.tagName);
    try{ el.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){}
  }

  // ── visualViewport API (Android Chrome ≥ 56) ───────────────
  // Más confiable que window.resize para detectar teclado
  if(window.visualViewport){
    var lastVVH = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', function(){
      var newH = window.visualViewport.height;
      var diff = lastVVH - newH;
      lastVVH = newH;
      if(diff > 100){
        // Teclado subió
        console.log('[ANDROID] teclado ABIERTO, altura reducida:', Math.round(diff)+'px');
        setTimeout(scrollToActive, 200);
      } else if(diff < -100){
        // Teclado bajó
        console.log('[ANDROID] teclado CERRADO, altura restaurada');
        setTimeout(function(){
          try{ window.scrollTo(0, 0); }catch(e){}
        }, 100);
      }
    });
    console.log('[ANDROID] visualViewport API activa');
  } else {
    // Fallback: window.resize (menos preciso en Android)
    var lastWH = window.innerHeight;
    window.addEventListener('resize', function(){
      var newH = window.innerHeight;
      var diff = lastWH - newH;
      lastWH = newH;
      console.log('[ANDROID] resize: diff='+Math.round(diff)+'px innerH='+newH);
      if(diff > 100){ setTimeout(scrollToActive, 200); }
    });
  }

  // ── Focus/blur logging en todos los textareas ──────────────
  function attachTextareaListeners(ta){
    if(!ta || ta._androidFixed) return;
    ta._androidFixed = true;
    ta.addEventListener('focus', function(){
      console.log('[ANDROID] FOCUS textarea:', this.id||'?', 'val len:', this.value.length);
      // Quitar pointer-events:none si quedó bloqueado
      if(getComputedStyle(this).pointerEvents === 'none'){
        console.warn('[ANDROID] textarea tenía pointer-events:none — corrigiendo');
        this.style.pointerEvents = 'auto';
      }
      setTimeout(function(){ try{ ta.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){} }, 300);
    });
    ta.addEventListener('blur', function(){
      console.log('[ANDROID] BLUR textarea:', this.id||'?');
    });
    ta.addEventListener('input', function(){
      console.log('[ANDROID] INPUT textarea:', this.id||'?', 'chars:', this.value.length);
    });
  }

  // Aplicar a los textareas existentes
  function attachAll(){
    document.querySelectorAll('textarea, input[type="text"]').forEach(attachTextareaListeners);
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attachAll);
  } else {
    attachAll();
  }

  // MutationObserver para elementos dinámicos
  if(typeof MutationObserver !== 'undefined'){
    var _obs = new MutationObserver(function(muts){
      muts.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if(!n.querySelectorAll) return;
          n.querySelectorAll('textarea, input[type="text"]').forEach(attachTextareaListeners);
        });
      });
    });
    if(document.body){
      _obs.observe(document.body, {childList:true, subtree:true});
    } else {
      document.addEventListener('DOMContentLoaded', function(){
        _obs.observe(document.body, {childList:true, subtree:true});
      });
    }
  }

  console.log('[ANDROID] keyboard fix instalado. isAndroid='+isAndroid+' visualViewport='+(!!window.visualViewport));
})();
// ═════════════════════════════════════════════════════════════
