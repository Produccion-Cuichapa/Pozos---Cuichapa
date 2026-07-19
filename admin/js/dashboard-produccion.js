(function () {
  'use strict';

  const METRICS = [
    {
      sourceId: 'wellKpiTotal',
      targetId: 'dashProdTotal',
      label: 'Pozos registrados',
      detail: 'Catálogo operativo',
      icon: '●',
      tone: 'blue'
    },
    {
      sourceId: 'wellKpiVisited',
      targetId: 'dashProdVisited',
      label: 'Visitados hoy',
      detail: 'Avance del recorrido',
      icon: '✓',
      tone: 'blue'
    },
    {
      sourceId: 'wellKpiOperating',
      targetId: 'dashProdOperating',
      label: 'Operando',
      detail: 'Último estatus conocido',
      icon: '↗',
      tone: 'green'
    },
    {
      sourceId: 'wellKpiIntermittent',
      targetId: 'dashProdIntermittent',
      label: 'Intermitentes',
      detail: 'Seguimiento operativo',
      icon: '↝',
      tone: 'yellow'
    },
    {
      sourceId: 'wellKpiClosed',
      targetId: 'dashProdClosed',
      label: 'Cerrados',
      detail: 'Último estatus conocido',
      icon: '■',
      tone: 'red'
    },
    {
      sourceId: 'wellKpiPending',
      targetId: 'dashProdPending',
      label: 'Sin visita hoy',
      detail: 'Pendientes del recorrido',
      icon: '○',
      tone: 'purple'
    }
  ];

  let observer = null;

  function getMetricValue(sourceId) {
    const source = document.getElementById(sourceId);

    if (!source) return '—';

    const value = source.textContent.trim();

    return value || '0';
  }

  function updateMetrics() {
    METRICS.forEach(function (metric) {
      const target = document.getElementById(metric.targetId);

      if (target) {
        target.textContent = getMetricValue(metric.sourceId);
      }
    });
  }

  function createPanel() {
    const dashboard = document.getElementById('dashboardView');

    if (!dashboard) return null;

    const existing = document.getElementById(
      'dashboardProductionStatus'
    );

    if (existing) return existing;

    const section = document.createElement('section');

    section.id = 'dashboardProductionStatus';
    section.className = 'dashboard-production-panel panel';

    section.innerHTML = `
      <div class="dashboard-production-head">
        <div>
          <span class="dashboard-production-eyebrow">
            PRODUCCIÓN DE CAMPO
          </span>
          <h2>Estado de Producción</h2>
          <p>
            Resumen operativo actualizado de los pozos.
          </p>
        </div>

        <button
          type="button"
          class="dashboard-production-link"
          data-go-view="pozos">
          Ver Producción →
        </button>
      </div>

      <div class="dashboard-production-list">
        ${METRICS.map(function (metric) {
          return `
            <article
              class="dashboard-production-item
                     production-tone-${metric.tone}">
              <span class="dashboard-production-icon">
                ${metric.icon}
              </span>

              <div class="dashboard-production-copy">
                <span>${metric.label}</span>
                <small>${metric.detail}</small>
              </div>

              <strong id="${metric.targetId}">—</strong>
            </article>
          `;
        }).join('')}
      </div>
    `;

    const mainKpis =
      dashboard.querySelector('.dashboard-main-kpis') ||
      dashboard.querySelector(':scope > .kpi-grid');

    if (mainKpis) {
      mainKpis.insertAdjacentElement('afterend', section);
    } else {
      const firstPanel = dashboard.querySelector('.panel');

      if (firstPanel) {
        firstPanel.insertAdjacentElement('beforebegin', section);
      } else {
        dashboard.appendChild(section);
      }
    }

    const link = section.querySelector(
      '.dashboard-production-link'
    );

    if (link) {
      link.addEventListener('click', function () {
        const productionButton =
          document.querySelector(
            '.nav-btn[data-view="pozos"]'
          ) ||
          document.querySelector(
            '.nav-btn[data-target="pozosView"]'
          ) ||
          Array.from(
            document.querySelectorAll('.nav-btn')
          ).find(function (button) {
            return button.textContent
              .trim()
              .toLowerCase()
              .includes('producción');
          });

        if (productionButton) {
          productionButton.click();
        }
      });
    }

    return section;
  }

  function observeSources() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(updateMetrics);

    METRICS.forEach(function (metric) {
      const source = document.getElementById(metric.sourceId);

      if (source) {
        observer.observe(source, {
          childList: true,
          characterData: true,
          subtree: true
        });
      }
    });
  }

  function initialize() {
    const panel = createPanel();

    if (!panel) return;

    updateMetrics();
    observeSources();

    setTimeout(updateMetrics, 500);
    setTimeout(updateMetrics, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize
    );
  } else {
    initialize();
  }
})();
