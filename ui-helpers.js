// ui-helpers.js — Reloj visual y toggle de panel
// Sin dependencias de app: solo document + setInterval

// Reloj visual (actualiza #ppClk cada segundo)
(function(){
  function t(){
    var d = new Date();
    var e = document.getElementById('ppClk');
    if(e) e.textContent =
      d.getHours().toString().padStart(2,'0') + ':' +
      d.getMinutes().toString().padStart(2,'0');
  }
  t();
  setInterval(t, 1000);
})();

// Toggle secciones del panel de producción
function ppToggle(id){
  ['calderon','prod','rec','op','seg','inv'].forEach(function(s){
    document.getElementById('pp-body-'+s).classList.remove('open');
    document.getElementById('pp-body-'+s).previousElementSibling.classList.remove('open');
  });
  var body = document.getElementById('pp-body-'+id);
  var row  = body.previousElementSibling;
  body.classList.add('open');
  if(row) row.classList.add('open');
}
