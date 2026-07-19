(function(){
  'use strict';

  const HERO_ID = 'reportesV2Hero';

  function texto(el){
    return String(el?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function obtenerReportes(){
    return Array.isArray(window.AdminFirebase?.reportes)
      ? window.AdminFirebase.reportes
      : [];
  }

  function esHoy(row){
    try{
      return Boolean(window.AdminUtils?.sameToday(row));
    }catch(error){
      return false;
    }
  }

  function tieneGps(row){
    try{
      return Boolean(window.AdminUtils?.hasGps(row));
    }catch(error){
      return Boolean(
        row?.gps ||
        row?.lat ||
        row?.latitude ||
        row?.ubicacion
      );
    }
  }

  function estaPendiente(row){
    const estado = String(
      row?.whatsappStatus ||
      row?.estado ||
      ''
    ).toLowerCase();

    return (
      estado.includes('pending') ||
      estado.includes('pendiente')
    );
  }

  function ocultarEncabezadoAnterior(view){
    [...view.children].forEach(elemento => {
      if(elemento.id === HERO_ID) return;

      const contenido = texto(elemento);

      const contieneTitulo =
        contenido.includes('reportes') &&
        (
          contenido.includes('consulta') ||
          contenido.includes('exportación') ||
          contenido.includes('exportacion')
        );

      const tieneHeading =
        Boolean(elemento.querySelector('h1, h2'));

      if(contieneTitulo && tieneHeading){
        elemento.classList.add(
          'reportes-v2-old-heading'
        );
      }
    });
  }

  function crearHero(){
    const view =
      document.getElementById('reportesView');

    if(!view) return null;

    let hero =
      document.getElementById(HERO_ID);

    if(hero) return hero;

    hero = document.createElement('section');
    hero.id = HERO_ID;
    hero.className = 'reportes-v2-hero';

    hero.innerHTML = `
      <div class="reportes-v2-hero-copy">
        <span class="reportes-v2-eyebrow">
          REPORTES DE CAMPO
        </span>

        <h1>Consulta y seguimiento operativo</h1>

        <p>
          Administra y consulta los reportes generados en campo.
        </p>
      </div>

      <div class="reportes-v2-stats">
        <article class="reportes-v2-stat stat-total">
          <div class="reportes-v2-stat-icon">▤</div>

          <div>
            <strong id="reportesV2Total">0</strong>
            <span>Disponibles</span>
          </div>
        </article>

        <article class="reportes-v2-stat stat-today">
          <div class="reportes-v2-stat-icon">▣</div>

          <div>
            <strong id="reportesV2Today">0</strong>
            <span>Recibidos hoy</span>
          </div>
        </article>

        <article class="reportes-v2-stat stat-pending">
          <div class="reportes-v2-stat-icon">WA</div>

          <div>
            <strong id="reportesV2Pending">0</strong>
            <span>Pendientes</span>
          </div>
        </article>

        <article class="reportes-v2-stat stat-gps">
          <div class="reportes-v2-stat-icon">✓</div>

          <div>
            <strong id="reportesV2Gps">0</strong>
            <span>GPS correcto</span>
          </div>
        </article>
      </div>
    `;

    view.insertAdjacentElement(
      'afterbegin',
      hero
    );

    ocultarEncabezadoAnterior(view);
    view.classList.add('reportes-v2-ready');

    return hero;
  }

  function actualizarIndicadores(){
    const hero = crearHero();

    if(!hero) return;

    const reportes = obtenerReportes();
    const reportesHoy =
      reportes.filter(esHoy);

    const pendientes =
      reportesHoy.filter(estaPendiente);

    const gpsCorrecto =
      reportes.filter(tieneGps);

    const valores = {
      reportesV2Total: reportes.length,
      reportesV2Today: reportesHoy.length,
      reportesV2Pending: pendientes.length,
      reportesV2Gps: gpsCorrecto.length
    };

    Object.entries(valores).forEach(
      ([id, valor]) => {
        const elemento =
          document.getElementById(id);

        if(elemento){
          elemento.textContent =
            Number(valor).toLocaleString('es-MX');
        }
      }
    );
  }

  function prepararVista(){
    const view =
      document.getElementById('reportesView');

    if(!view) return;

    crearHero();
    ocultarEncabezadoAnterior(view);
    actualizarIndicadores();
  }

  function iniciar(){
    prepararVista();

    const view =
      document.getElementById('reportesView');

    if(!view) return;

    let timer = null;

    const observer = new MutationObserver(() => {
      clearTimeout(timer);

      timer = setTimeout(
        prepararVista,
        80
      );
    });

    observer.observe(view, {
      childList: true,
      subtree: true
    });

    setInterval(
      actualizarIndicadores,
      5000
    );

    window.addEventListener(
      'focus',
      actualizarIndicadores
    );
  }

  if(document.readyState === 'loading'){
    document.addEventListener(
      'DOMContentLoaded',
      iniciar
    );
  }else{
    iniciar();
  }
})();
