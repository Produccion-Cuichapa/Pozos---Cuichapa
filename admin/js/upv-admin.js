'use strict';

window.AdminUpv = {
  initialized: false,

  init(){
    if(this.initialized) return;

    window.AdminUpvFirebase?.init();
    this.initialized = true;
  },

  listen(){
    window.AdminUpvFirebase?.listen();
  },

  render(){
    const firebaseUpv =
      window.AdminUpvFirebase;

    if(!firebaseUpv) return;

    const reportes = firebaseUpv.reportes || [];

    this.renderKpis(reportes);
    this.renderEmpresas(reportes);
    this.renderRecientes(reportes);
  },

  renderKpis(reportes){
    const ahora = new Date();

    const hoy = reportes.filter(item => {
      const fecha = this.getDate(item);

      return fecha &&
        fecha.getFullYear() === ahora.getFullYear() &&
        fecha.getMonth() === ahora.getMonth() &&
        fecha.getDate() === ahora.getDate();
    });

    const cargas = reportes.filter(item =>
      String(item.tipo || item.subtipo || '')
        .toUpperCase()
        .includes('CARGA')
    );

    const descargas = reportes.filter(item =>
      String(item.tipo || item.subtipo || '')
        .toUpperCase()
        .includes('DESCARGA')
    );

    this.setText(
      'upvKpiTotal',
      reportes.length
    );

    this.setText(
      'upvKpiHoy',
      hoy.length
    );

    this.setText(
      'upvKpiCargas',
      cargas.length
    );

    this.setText(
      'upvKpiDescargas',
      descargas.length
    );
  },

  renderEmpresas(reportes){
    const empresas = {
      PETROSMART: 0,
      ATO: 0,
      IPEP: 0
    };

    reportes.forEach(item => {
      const empresa = String(
        item.empresa || ''
      ).trim().toUpperCase();

      if(Object.prototype.hasOwnProperty.call(
        empresas,
        empresa
      )){
        empresas[empresa] += 1;
      }
    });

    this.setText(
      'upvEmpresaPetrosmart',
      empresas.PETROSMART
    );

    this.setText(
      'upvEmpresaAto',
      empresas.ATO
    );

    this.setText(
      'upvEmpresaIpep',
      empresas.IPEP
    );
  },

  renderRecientes(reportes){
    const tbody = document.getElementById(
      'upvRecentTable'
    );

    const empty = document.getElementById(
      'upvEmptyState'
    );

    if(!tbody) return;

    const recientes = reportes.slice(0, 20);

    if(!recientes.length){
      tbody.innerHTML = '';

      if(empty){
        empty.classList.remove('hidden');
      }

      return;
    }

    if(empty){
      empty.classList.add('hidden');
    }

    tbody.innerHTML = recientes
      .map(item => {
        const fecha = this.formatDate(item);

        const empresa = this.escapeHtml(
          item.empresa || 'Sin empresa'
        );

        const unidad = this.escapeHtml(
          item.unidad || '—'
        );

        const tipo = this.escapeHtml(
          item.tipo ||
          item.subtipo ||
          'Reporte'
        );

        const origen = this.escapeHtml(
          item.origen || '—'
        );

        const cantidad =
          item.cantidad !== null &&
          item.cantidad !== undefined &&
          item.cantidad !== ''
            ? `${this.escapeHtml(item.cantidad)} bbls`
            : '—';

        const fotos = Number(
          item.nFotos ||
          item.fotoIds?.length ||
          0
        );

        return `
          <tr>
            <td>${fecha}</td>
            <td>
              <span class="upv-company-badge">
                ${empresa}
              </span>
            </td>
            <td>${unidad}</td>
            <td>${tipo}</td>
            <td>${origen}</td>
            <td>${cantidad}</td>
            <td>${fotos}</td>
          </tr>
        `;
      })
      .join('');
  },

  getDate(item){
    const values = [
      item?.createdAt,
      item?.fecha,
      item?.receivedAtClient,
      item?.firebaseSyncedAt
    ];

    for(const value of values){
      if(!value) continue;

      const date = new Date(value);

      if(!Number.isNaN(date.getTime())){
        return date;
      }
    }

    const numericId = Number(item?.id);

    if(Number.isFinite(numericId)){
      return new Date(numericId);
    }

    return null;
  },

  formatDate(item){
    const date = this.getDate(item);

    if(!date) return '—';

    return new Intl.DateTimeFormat(
      'es-MX',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    ).format(date);
  },

  setText(id, value){
    const el = document.getElementById(id);

    if(el){
      el.textContent = String(value);
    }
  },

  escapeHtml(value){
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
