(function(){
  'use strict';

  function texto(el){
    return String(el?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function buscarPanel(frase){
    const objetivo = frase.toLowerCase();

    return [...document.querySelectorAll('#dashboardView .panel')]
      .find(panel => texto(panel).includes(objetivo));
  }

  function prepararEstructura(){
    const dashboard = document.getElementById('dashboardView');

    if(!dashboard) return;

    /*
     * La referencia aprobada utiliza únicamente:
     * - Encabezado
     * - 4 KPI principales
     * - Actividad / Alertas
     * - Gráfica horaria / Recorredores
     */

    const extraKpis = document.getElementById('kpiExtraGrid');

    if(extraKpis){
      extraKpis.classList.add('reference-hidden');
    }

    [
      'avance del recorrido',
      'pozos con mayor actividad',
      'último reporte recibido'
    ].forEach(frase => {
      const panel = buscarPanel(frase);

      if(panel){
        panel.classList.add('reference-hidden');
      }
    });

    let bottomGrid = document.getElementById(
      'dashboardReferenceBottomGrid'
    );

    if(!bottomGrid){
      bottomGrid = document.createElement('div');
      bottomGrid.id = 'dashboardReferenceBottomGrid';
      bottomGrid.className = 'dashboard-reference-bottom';

      const dashboardGrid =
        dashboard.querySelector('.dashboard-grid');

      if(dashboardGrid){
        dashboardGrid.insertAdjacentElement(
          'afterend',
          bottomGrid
        );
      }else{
        dashboard.appendChild(bottomGrid);
      }
    }

    const chart =
      document.getElementById('hourChart')?.closest('.panel') ||
      buscarPanel('reportes por hora');

    const walkers =
      buscarPanel('recorredores activos');

    if(chart && chart.parentElement !== bottomGrid){
      bottomGrid.appendChild(chart);
    }

    if(walkers && walkers.parentElement !== bottomGrid){
      bottomGrid.appendChild(walkers);
    }

    if(chart){
      chart.classList.add('reference-chart-panel');
      chart.classList.remove('reference-hidden');
    }

    if(walkers){
      walkers.classList.add('reference-walkers-panel');
      walkers.classList.remove('reference-hidden');
    }

    const incident = document.getElementById(
      'operationsIncidentBanner'
    );

    if(incident){
      incident.classList.add('reference-hidden');
    }

    dashboard.classList.add('dashboard-reference-ready');
  }

  function observar(){
    prepararEstructura();

    const dashboard = document.getElementById('dashboardView');

    if(!dashboard) return;

    let timer = null;

    const observer = new MutationObserver(() => {
      clearTimeout(timer);

      timer = setTimeout(prepararEstructura, 60);
    });

    observer.observe(dashboard, {
      childList: true,
      subtree: true
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', observar);
  }else{
    observar();
  }

  window.addEventListener('load', prepararEstructura);
  window.addEventListener('resize', prepararEstructura);
})();
