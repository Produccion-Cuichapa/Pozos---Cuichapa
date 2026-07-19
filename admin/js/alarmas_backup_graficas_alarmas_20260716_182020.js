window.AdminAlarmas = {
  currentRows: [],

  init(){
    [
      'almDesde',
      'almHasta',
      'almBuscar',
      'almEstado',
      'almPrioridad'
    ].forEach(id => {
      const element = document.getElementById(id);

      element?.addEventListener(
        id === 'almBuscar' ? 'input' : 'change',
        () => this.render()
      );
    });

    document.getElementById('almLimpiar')
      ?.addEventListener('click', () => {
        [
          'almDesde',
          'almHasta',
          'almBuscar',
          'almEstado',
          'almPrioridad'
        ].forEach(id => {
          const element = document.getElementById(id);

          if(element){
            element.value = '';
          }
        });

        this.render();
      });

    document.getElementById('almExportar')
      ?.addEventListener(
        'click',
        () => this.exportCsv()
      );
  },

  normalize(value){
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  },

  rawStatus(row){
    return this.normalize(
      row.gestionEstado ||
      row.estadoGestion ||
      row.statusGestion ||
      row.workflowStatus ||
      row.atencionEstado ||
      ''
    );
  },

  statusData(row){
    const raw = this.rawStatus(row);

    if(
      raw.includes('cerrad') ||
      raw.includes('closed')
    ){
      return {
        key: 'closed',
        label: 'Cerrada'
      };
    }

    if(
      raw.includes('resuelt') ||
      raw.includes('atendid') ||
      raw.includes('resolved')
    ){
      return {
        key: 'resolved',
        label: 'Atendida'
      };
    }

    if(
      raw.includes('revision') ||
      raw.includes('revisión') ||
      raw.includes('proceso') ||
      raw.includes('review')
    ){
      return {
        key: 'review',
        label: 'En revisión'
      };
    }

    return {
      key: 'new',
      label: 'Nueva'
    };
  },

  alarmType(row){
    return String(
      row.tipoAlarma ||
      row.alarmType ||
      row.tipo ||
      row.alarma ||
      row.categoria ||
      AdminUtils.modeText(row) ||
      'Alarma'
    ).trim();
  },

  alarmMessage(row){
    return String(
      row.mensaje ||
      row.message ||
      row.descripcion ||
      row.observaciones ||
      row.observacion ||
      row.nota ||
      row.msg ||
      AdminUtils.obsText(row) ||
      ''
    ).trim();
  },

  priorityData(row){
    const explicit = this.normalize(
      row.prioridad ||
      row.priority ||
      row.severidad ||
      row.severity ||
      ''
    );

    if(
      explicit.includes('critic') ||
      explicit.includes('emergencia')
    ){
      return {
        key: 'critical',
        label: 'Crítica',
        weight: 4
      };
    }

    if(
      explicit.includes('alta') ||
      explicit.includes('high')
    ){
      return {
        key: 'high',
        label: 'Alta',
        weight: 3
      };
    }

    if(
      explicit.includes('baja') ||
      explicit.includes('low')
    ){
      return {
        key: 'low',
        label: 'Baja',
        weight: 1
      };
    }

    if(
      explicit.includes('media') ||
      explicit.includes('medium')
    ){
      return {
        key: 'medium',
        label: 'Media',
        weight: 2
      };
    }

    const content = this.normalize(
      [
        this.alarmType(row),
        this.alarmMessage(row)
      ].join(' ')
    );

    const criticalWords = [
      'fuga mayor',
      'incendio',
      'explosion',
      'derrame',
      'emergencia',
      'lesionado',
      'alta presion',
      'gas'
    ];

    const highWords = [
      'fuga',
      'presion',
      'cabezal',
      'linea rota',
      'valvula',
      'contaminacion',
      'derrame menor'
    ];

    if(
      criticalWords.some(word =>
        content.includes(word)
      )
    ){
      return {
        key: 'critical',
        label: 'Crítica',
        weight: 4
      };
    }

    if(
      highWords.some(word =>
        content.includes(word)
      )
    ){
      return {
        key: 'high',
        label: 'Alta',
        weight: 3
      };
    }

    return {
      key: 'medium',
      label: 'Media',
      weight: 2
    };
  },

  ageData(row){
    const time = AdminUtils.getTime(row);

    if(!time){
      return {
        ms: 0,
        hours: 0,
        text: 'Sin fecha'
      };
    }

    const ms = Math.max(
      0,
      Date.now() - time
    );

    const minutes = Math.floor(
      ms / 60000
    );

    if(minutes < 1){
      return {
        ms,
        hours: 0,
        text: 'Ahora'
      };
    }

    if(minutes < 60){
      return {
        ms,
        hours: minutes / 60,
        text: `${minutes} min`
      };
    }

    const hours = Math.floor(
      minutes / 60
    );

    if(hours < 24){
      return {
        ms,
        hours,
        text: `${hours} h`
      };
    }

    const days = Math.floor(
      hours / 24
    );

    return {
      ms,
      hours,
      text: `${days} d`
    };
  },

  enrichedRows(){
    return (
      window.AdminFirebase.alarmas || []
    ).map(row => ({
      ...row,
      _alarmStatus: this.statusData(row),
      _alarmPriority: this.priorityData(row),
      _alarmAge: this.ageData(row)
    }));
  },

  filtered(){
    const desde =
      document.getElementById('almDesde')
        ?.value || '';

    const hasta =
      document.getElementById('almHasta')
        ?.value || '';

    const search = this.normalize(
      document.getElementById('almBuscar')
        ?.value || ''
    );

    const statusFilter =
      document.getElementById('almEstado')
        ?.value || '';

    const priorityFilter =
      document.getElementById('almPrioridad')
        ?.value || '';

    return this.enrichedRows().filter(row => {
      const dateObj = AdminUtils.dateObj(row);

      const date = dateObj
        ? AdminUtils.ymd(dateObj)
        : String(row.fecha || '')
            .slice(0, 10);

      if(desde && date < desde){
        return false;
      }

      if(hasta && date > hasta){
        return false;
      }

      if(
        statusFilter &&
        row._alarmStatus.key !== statusFilter
      ){
        return false;
      }

      if(
        priorityFilter &&
        row._alarmPriority.key !== priorityFilter
      ){
        return false;
      }

      if(search){
        const haystack = this.normalize(
          [
            AdminUtils.placeText(row),
            AdminUtils.personText(row),
            this.alarmType(row),
            this.alarmMessage(row),
            row._alarmStatus.label,
            row._alarmPriority.label
          ].join(' ')
        );

        if(!haystack.includes(search)){
          return false;
        }
      }

      return true;
    });
  },

  statusBadge(status){
    return `
      <span class="
        alarm-state-badge
        alarm-state-${status.key}
      ">
        <i></i>
        ${AdminUtils.escapeHtml(status.label)}
      </span>
    `;
  },

  priorityBadge(priority){
    return `
      <span class="
        alarm-priority-badge
        alarm-priority-${priority.key}
      ">
        ${AdminUtils.escapeHtml(priority.label)}
      </span>
    `;
  },

  isToday(row){
    return AdminUtils.sameToday(row);
  },

  renderKpis(allRows){
    const today = allRows.filter(row =>
      this.isToday(row)
    );

    const active = allRows.filter(row =>
      row._alarmStatus.key === 'new'
    );

    const review = allRows.filter(row =>
      row._alarmStatus.key === 'review'
    );

    const resolved = allRows.filter(row =>
      ['resolved', 'closed'].includes(
        row._alarmStatus.key
      )
    );

    const oldest = active
      .slice()
      .sort(
        (a, b) =>
          b._alarmAge.ms -
          a._alarmAge.ms
      )[0];

    this.setText(
      'alarmKpiToday',
      today.length
    );

    this.setText(
      'alarmKpiActive',
      active.length
    );

    this.setText(
      'alarmKpiReview',
      review.length
    );

    this.setText(
      'alarmKpiResolved',
      resolved.length
    );

    this.setText(
      'alarmKpiOldest',
      oldest
        ? oldest._alarmAge.text
        : '—'
    );
  },

  priorityRows(allRows){
    return allRows
      .filter(row =>
        ['new', 'review'].includes(
          row._alarmStatus.key
        )
      )
      .sort((a, b) => {
        if(
          b._alarmPriority.weight !==
          a._alarmPriority.weight
        ){
          return (
            b._alarmPriority.weight -
            a._alarmPriority.weight
          );
        }

        return (
          b._alarmAge.ms -
          a._alarmAge.ms
        );
      });
  },

  renderPriorityPanel(allRows){
    const rows = this.priorityRows(
      allRows
    );

    const container =
      document.getElementById(
        'alarmPriorityList'
      );

    this.setText(
      'alarmPriorityCount',
      `${rows.length} ${
        rows.length === 1
          ? 'evento'
          : 'eventos'
      }`
    );

    if(!container) return;

    if(!rows.length){
      container.innerHTML = `
        <div class="alarm-priority-empty">
          <b>Sin alarmas pendientes</b>
          <span>
            No se detectaron eventos que requieran revisión.
          </span>
        </div>
      `;

      return;
    }

    container.innerHTML = rows
      .slice(0, 5)
      .map(row => `
        <article class="
          alarm-priority-item
          priority-${row._alarmPriority.key}
        ">
          <div class="alarm-priority-icon">
            !
          </div>

          <div class="alarm-priority-content">
            <div class="alarm-priority-title">
              <b>
                ${AdminUtils.escapeHtml(
                  this.alarmType(row)
                )}
              </b>

              ${this.priorityBadge(
                row._alarmPriority
              )}
            </div>

            <span>
              ${AdminUtils.escapeHtml(
                AdminUtils.placeText(row) ||
                'Sin pozo o lugar'
              )}
              ·
              ${AdminUtils.escapeHtml(
                row._alarmAge.text
              )}
            </span>

            <small>
              ${AdminUtils.escapeHtml(
                AdminUtils.cut(
                  this.alarmMessage(row) ||
                  'Sin mensaje',
                  115
                )
              )}
            </small>
          </div>

          <button
            type="button"
            class="alarm-review-btn"
            data-alarm-open="${AdminUtils.escapeHtml(row.id)}">
            Revisar
          </button>
        </article>
      `)
      .join('');

    this.bindOpenButtons(container);
  },

  renderTable(rows){
    const body =
      document.getElementById(
        'alarmasTable'
      );

    if(!body) return;

    if(!rows.length){
      body.innerHTML = `
        <tr>
          <td colspan="11">
            <div class="alarm-table-empty">
              <b>Sin alarmas con esos filtros</b>
              <span>
                Modifica la búsqueda o el periodo.
              </span>
            </div>
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML = rows.map(row => {
      const whatsapp =
        row.whatsappStatus ||
        row.estado ||
        '';

      return `
        <tr>
          <td>
            ${AdminUtils.escapeHtml(
              AdminUtils.fmtDate(row)
            )}
          </td>

          <td>
            ${AdminUtils.escapeHtml(
              AdminUtils.fmtTime(row)
            )}
          </td>

          <td>
            <b class="alarm-place">
              ${AdminUtils.escapeHtml(
                AdminUtils.placeText(row) ||
                'Sin lugar'
              )}
            </b>
          </td>

          <td>
            <span class="alarm-type-label">
              ${AdminUtils.escapeHtml(
                this.alarmType(row)
              )}
            </span>
          </td>

          <td>
            ${this.priorityBadge(
              row._alarmPriority
            )}
          </td>

          <td>
            ${this.statusBadge(
              row._alarmStatus
            )}
          </td>

          <td>
            ${AdminUtils.escapeHtml(
              AdminUtils.personText(row) ||
              'Sin usuario'
            )}
          </td>

          <td>
            <span class="alarm-age">
              ${AdminUtils.escapeHtml(
                row._alarmAge.text
              )}
            </span>
          </td>

          <td>
            ${AdminUtils.statusBadge(
              whatsapp
            )}
          </td>

          <td>
            <span class="alarm-message">
              ${AdminUtils.escapeHtml(
                AdminUtils.cut(
                  this.alarmMessage(row),
                  95
                ) || '—'
              )}
            </span>
          </td>

          <td>
            <button
              type="button"
              class="row-action alarm-row-action"
              data-alarm-open="${AdminUtils.escapeHtml(row.id)}">
              Ver
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.bindOpenButtons(body);
  },

  bindOpenButtons(container){
    container
      .querySelectorAll(
        '[data-alarm-open]'
      )
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            const id =
              button.dataset.alarmOpen;

            const row = (
              window.AdminFirebase.alarmas ||
              []
            ).find(item =>
              String(item.id) ===
              String(id)
            );

            if(!row) return;

            AdminUI.openDetail(
              'alarma',
              row
            );
          }
        );
      });
  },

  render(){
    const allRows =
      this.enrichedRows();

    const filteredRows =
      this.filtered();

    this.currentRows =
      filteredRows;

    this.renderKpis(allRows);
    this.renderPriorityPanel(allRows);
    this.renderTable(filteredRows);

    this.setText(
      'alarmResultCount',
      filteredRows.length
    );
  },

  setText(id, value){
    const element =
      document.getElementById(id);

    if(element){
      element.textContent = value;
    }
  },

  csvValue(value){
    const text = String(
      value ?? ''
    ).replace(/"/g, '""');

    return `"${text}"`;
  },

  exportCsv(){
    const rows =
      this.currentRows || [];

    if(!rows.length){
      alert(
        'No hay alarmas para exportar.'
      );

      return;
    }

    const headers = [
      'Fecha',
      'Hora',
      'Pozo/Lugar',
      'Tipo',
      'Prioridad',
      'Estado',
      'Usuario',
      'Antigüedad',
      'WhatsApp',
      'Mensaje'
    ];

    const lines = [
      headers.map(
        value => this.csvValue(value)
      ).join(',')
    ];

    rows.forEach(row => {
      lines.push([
        AdminUtils.fmtDate(row),
        AdminUtils.fmtTime(row),
        AdminUtils.placeText(row),
        this.alarmType(row),
        row._alarmPriority.label,
        row._alarmStatus.label,
        AdminUtils.personText(row),
        row._alarmAge.text,
        row.whatsappStatus ||
          row.estado ||
          '',
        this.alarmMessage(row)
      ].map(
        value => this.csvValue(value)
      ).join(','));
    });

    const blob = new Blob(
      ['\ufeff' + lines.join('\n')],
      {
        type:
          'text/csv;charset=utf-8'
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;
    link.download =
      `alarmas_${AdminUtils.ymd(
        new Date()
      )}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }
};
