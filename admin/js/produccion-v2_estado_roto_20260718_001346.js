(function () {
  'use strict';

  function encontrarFiltros(view) {
    const search = document.getElementById('wellSearch');

    if (!search) return null;

    let node = search;

    while (
      node &&
      node.parentElement &&
      node.parentElement !== view
    ) {
      node = node.parentElement;
    }

    return node && node.parentElement === view
      ? node
      : null;
  }

  function agregarTitulo(panel, title, subtitle) {
    if (
      !panel ||
      panel.querySelector(':scope > .prod-panel-heading')
    ) {
      return;
    }

    const heading = document.createElement('header');
    heading.className = 'prod-panel-heading';

    heading.innerHTML = `
      <div>
        <h2>${title}</h2>
        ${
          subtitle
            ? `<p>${subtitle}</p>`
            : ''
        }
      </div>
    `;

    panel.insertBefore(heading, panel.firstChild);
  }

  function cambiarTituloPagina() {
    const view = document.getElementById('pozosView');

    if (!view) return;

    /*
     * Busca el encabezado inmediatamente anterior a la vista.
     * Solo cambia "Pozos" por "Producción".
     */
    const possibleHeadings = [
      document.querySelector(
        '[data-view-title="pozos"]'
      ),
      document.querySelector(
        '.page-header h1'
      ),
      document.querySelector(
        '.view-header h1'
      ),
      document.querySelector(
        'main h1'
      )
    ].filter(Boolean);

    possibleHeadings.forEach(function (heading) {
      if (
        heading.textContent.trim().toLowerCase() ===
        'pozos'
      ) {
        heading.textContent = 'Producción';
      }
    });
  }

  function construirProduccion() {
    const view = document.getElementById('pozosView');

    if (!view) return false;

    if (
      document.getElementById(
        'productionOperationalLayout'
      )
    ) {
      cambiarTituloPagina();
      return true;
    }

    const overview =
      view.querySelector(':scope > .wells-overview');

    const priorities =
      view.querySelector(
        ':scope > .well-priority-center'
      );

    const filters = encontrarFiltros(view);

    const cards =
      document.getElementById('wellsCardsView');

    if (
      !overview ||
      !priorities ||
      !filters ||
      !cards
    ) {
      console.warn(
        'Producción V2: no se localizaron todos los bloques.',
        {
          overview: Boolean(overview),
          priorities: Boolean(priorities),
          filters: Boolean(filters),
          cards: Boolean(cards)
        }
      );

      return false;
    }

    const layout = document.createElement('section');

    layout.id = 'productionOperationalLayout';
    layout.className = 'production-operational-layout';

    overview.classList.add(
      'production-summary-panel'
    );

    priorities.classList.add(
      'production-priority-panel'
    );

    filters.classList.add(
      'production-filter-panel'
    );

    agregarTitulo(
      overview,
      'Resumen operativo',
      ''
    );

    agregarTitulo(
      priorities,
      'Prioridades del campo',
      'Pozos ordenados por nivel estimado de atención'
    );

    agregarTitulo(
      filters,
      'Filtros',
      ''
    );

    /*
     * Se mueven los elementos reales.
     * No se copian, por lo que no habrá IDs duplicados.
     */
    layout.appendChild(overview);
    layout.appendChild(priorities);
    layout.appendChild(filters);

    cards.parentElement.insertBefore(
      layout,
      cards
    );

    view.classList.add('production-layout-ready');

    cambiarTituloPagina();

    return true;
  }

  function iniciar() {
    construirProduccion();

    /*
     * Reintentos por si Producción se renderiza después.
     */
    setTimeout(construirProduccion, 300);
    setTimeout(construirProduccion, 900);
    setTimeout(construirProduccion, 1800);

    /*
     * También responde al cambio de vista del panel.
     */
    const observer = new MutationObserver(function () {
      construirProduccion();
      cambiarTituloPagina();
    });

    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      iniciar
    );
  } else {
    iniciar();
  }
})();
