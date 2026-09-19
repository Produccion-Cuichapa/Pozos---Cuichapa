(function(){
  'use strict';

  const CURRENT_PATH = 'config/admin_center/current';
  const AUDIT_PATH = 'config/admin_center/audit';

  // CONFIG_RUNTIME_VERSIONED_V1
  const RUNTIME_PATH =
    'config/admin_center/runtime';

  const VERSION_PATH =
    'config/admin_center/version';


  const DEFAULTS = Object.freeze({
    schemaVersion: 1,

    operacion: {
      radioGpsMetros: 80,
      historialVisible: 20,
      maxFotos: 5,
      correccionMinutos: 15
    },

    gps: {
      timeoutAndroidMs: 35000,
      timeoutIosMs: 10000,
      precisionMaximaMetros: 50,
      segundaLectura: true,
      fotoFueraRadio: true,
      justificacionFueraRadio: true
    },

    modulos: {
      controlOperativo: true,
      nivelGuardia: true,
      alarmas: true,
      historial: true,
      correcciones: true,
      fotografias: true
    },

    sincronizacion: {
      sincronizarAlRecuperarSenal: true,
      reintentosAutomaticos: true,
      reconciliarPendientes: true
    },

    whatsapp: {
      entorno: 'produccion',
      mensajesActivos: true,
      fotosActivas: true,
      alarmasActivas: true,
      correccionesActivas: true
    },

    mantenimiento: {
      activo: false,
      mensaje: '',
      permiteCapturaOffline: true
    },

    versiones: {
      versionMinima: '',
      avisoActualizacion: true
    }
  });

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function merge(base, incoming){
    const output = clone(base);

    if(!incoming || typeof incoming !== 'object'){
      return output;
    }

    Object.keys(incoming).forEach(key => {
      const value = incoming[key];

      if(
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        output[key] &&
        typeof output[key] === 'object'
      ){
        output[key] = merge(output[key], value);
      }else{
        output[key] = value;
      }
    });

    return output;
  }

  function numberValue(id, fallback, min, max){
    const element = document.getElementById(id);
    const value = Number(element?.value);

    if(!Number.isFinite(value)){
      return fallback;
    }

    return Math.min(max, Math.max(min, value));
  }

  function boolValue(id, fallback){
    const element = document.getElementById(id);

    return element
      ? Boolean(element.checked)
      : fallback;
  }

  function textValue(id, fallback){
    const element = document.getElementById(id);

    return element
      ? String(element.value || '').trim()
      : fallback;
  }

  function setValue(id, value){
    const element = document.getElementById(id);

    if(!element) return;

    if(element.type === 'checkbox'){
      element.checked = Boolean(value);
    }else{
      element.value = value ?? '';
    }
  }

  function escapeHtml(value){
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(value){
    const date = new Date(value || 0);

    if(isNaN(date)){
      return 'Fecha no disponible';
    }

    return date.toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'medium'
    });
  }

  
  /*
   * CONFIG_RUNTIME_VERSIONED_V1
   *
   * Convierte un objeto a JSON estable para calcular un checksum
   * reproducible, independientemente del orden de sus propiedades.
   */
  function stableStringify(value){
    if(value === null || typeof value !== 'object'){
      return JSON.stringify(value);
    }

    if(Array.isArray(value)){
      return '[' +
        value.map(stableStringify).join(',') +
        ']';
    }

    const keys = Object.keys(value).sort();

    return '{' +
      keys.map(key => {
        return JSON.stringify(key) +
          ':' +
          stableStringify(value[key]);
      }).join(',') +
      '}';
  }

  function configChecksum(value){
    const source = stableStringify(value);
    let hash = 2166136261;

    for(let i = 0; i < source.length; i += 1){
      hash ^= source.charCodeAt(i);

      hash = Math.imul(hash, 16777619);
    }

    return (
      'cfg-' +
      (hash >>> 0).toString(16).padStart(8, '0')
    );
  }

window.AdminConfigCenter = {
    defaults: clone(DEFAULTS),
    current: clone(DEFAULTS),
    original: clone(DEFAULTS),
    db: null,
    ready: false,
    initialized: false,
    auditRows: [],

    init(){
      if(this.initialized) return;

      this.initialized = true;
      this.bind();
      this.applyToForm(this.current);
      this.updateState('Esperando Firebase', 'Sin cambios publicados');

      this.waitForFirebase();
    },

    bind(){
      document
        .getElementById('configSaveBtn')
        ?.addEventListener('click', () => this.save());

      document
        .getElementById('configReloadBtn')
        ?.addEventListener('click', () => this.loadOnce());

      document
        .getElementById('configDefaultsBtn')
        ?.addEventListener('click', () => this.restoreDefaults());

      document
        .querySelectorAll('#configuracionView input, #configuracionView select, #configuracionView textarea')
        .forEach(element => {
          element.addEventListener('input', () => {
            this.setSaveStatus('Cambios sin publicar');
          });

          element.addEventListener('change', () => {
            this.setSaveStatus('Cambios sin publicar');
          });
        });

      document
        .querySelector('[data-view="configuracion"]')
        ?.addEventListener('click', () => {
          document.getElementById('viewTitle').textContent =
            'Centro de Configuración';

          document.getElementById('viewSubtitle').textContent =
            'Parámetros operativos, seguridad y control del sistema.';
        });

      document
        .querySelectorAll('[data-config-section]')
        .forEach(button => {
          button.addEventListener('click', () => {
            this.selectSection(
              button.dataset.configSection || 'all'
            );
          });
        });
    },

    selectSection(section){
      document
        .querySelectorAll('[data-config-section]')
        .forEach(button => {
          button.classList.toggle(
            'active',
            button.dataset.configSection === section
          );
        });

      document
        .querySelectorAll('[data-config-card]')
        .forEach(card => {
          const visible =
            section === 'all' ||
            card.dataset.configCard === section;

          card.classList.toggle(
            'config-card-hidden',
            !visible
          );
        });
    },

    waitForFirebase(){
      let attempts = 0;

      const timer = setInterval(() => {
        attempts += 1;

        const db = window.AdminFirebase?.db;

        if(db){
          clearInterval(timer);
          this.db = db;
          this.listen();
          return;
        }

        if(attempts >= 40){
          clearInterval(timer);
          this.updateState(
            'Firebase no disponible',
            'La operación de campo no fue modificada'
          );

          this.toast(
            'No fue posible conectar el Centro de Configuración con Firebase.',
            true
          );
        }
      }, 500);
    },

    listen(){
      if(!this.db) return;

      this.updateState('Conectando', 'Consultando configuración');

      this.db.ref(CURRENT_PATH).on(
        'value',
        snapshot => {
          const value = snapshot.val();

          this.current = merge(DEFAULTS, value || {});
          this.original = clone(this.current);
          this.applyToForm(this.current);
          this.ready = true;

          const updatedAt =
            value?.metadata?.updatedAt ||
            value?.updatedAt ||
            null;

          this.updateState(
            'Configuración sincronizada',
            updatedAt
              ? 'Parámetros cargados correctamente'
              : 'Valores predeterminados activos'
          );

          this.updateHeaderDetails(
            value?.metadata?.updatedBy ||
              window.AdminAuth?.current?.user ||
              'Administrador',
            updatedAt,
            value?.versiones?.versionMinima || ''
          );

          this.setSaveStatus('Sin cambios pendientes');
        },
        error => {
          console.error('[CONFIG_CENTER] lectura:', error);

          this.updateState(
            'Error de lectura',
            'Se conservan los valores predeterminados'
          );
        }
      );

      this.db
        .ref(AUDIT_PATH)
        .limitToLast(15)
        .on(
          'value',
          snapshot => {
            const rows = [];

            snapshot.forEach(child => {
              rows.push({
                id: child.key,
                ...(child.val() || {})
              });
            });

            this.auditRows = rows.reverse();
            this.renderAudit();
          },
          error => {
            console.error('[CONFIG_CENTER] auditoría:', error);
          }
        );
    },

    async loadOnce(){
      if(!this.db){
        this.toast('Firebase todavía no está disponible.', true);
        return;
      }

      this.setSaveStatus('Actualizando...');

      try{
        const snapshot = await this.db.ref(CURRENT_PATH).once('value');

        this.current = merge(DEFAULTS, snapshot.val() || {});
        this.original = clone(this.current);

        this.applyToForm(this.current);
        this.setSaveStatus('Configuración actualizada');
        this.toast('Configuración recargada desde Firebase.');
      }catch(error){
        console.error('[CONFIG_CENTER] recarga:', error);
        this.setSaveStatus('No se pudo actualizar');
        this.toast('No se pudo recargar la configuración.', true);
      }
    },

    readForm(){
      return {
        schemaVersion: 1,

        operacion: {
          radioGpsMetros: numberValue(
            'cfgRadioGps',
            DEFAULTS.operacion.radioGpsMetros,
            20,
            500
          ),

          historialVisible: numberValue(
            'cfgHistorialVisible',
            DEFAULTS.operacion.historialVisible,
            5,
            200
          ),

          maxFotos: numberValue(
            'cfgMaxFotos',
            DEFAULTS.operacion.maxFotos,
            0,
            10
          ),

          correccionMinutos: numberValue(
            'cfgCorreccionMinutos',
            DEFAULTS.operacion.correccionMinutos,
            0,
            1440
          )
        },

        gps: {
          timeoutAndroidMs: numberValue(
            'cfgGpsAndroid',
            DEFAULTS.gps.timeoutAndroidMs,
            5000,
            120000
          ),

          timeoutIosMs: numberValue(
            'cfgGpsIos',
            DEFAULTS.gps.timeoutIosMs,
            3000,
            60000
          ),

          precisionMaximaMetros: numberValue(
            'cfgGpsPrecision',
            DEFAULTS.gps.precisionMaximaMetros,
            5,
            500
          ),

          segundaLectura: boolValue(
            'cfgGpsSegundaLectura',
            DEFAULTS.gps.segundaLectura
          ),

          fotoFueraRadio: boolValue(
            'cfgGpsFotoFuera',
            DEFAULTS.gps.fotoFueraRadio
          ),

          justificacionFueraRadio: boolValue(
            'cfgGpsJustificacion',
            DEFAULTS.gps.justificacionFueraRadio
          )
        },

        modulos: {
          controlOperativo: boolValue(
            'cfgModuloCo',
            DEFAULTS.modulos.controlOperativo
          ),

          nivelGuardia: boolValue(
            'cfgModuloNivel',
            DEFAULTS.modulos.nivelGuardia
          ),

          alarmas: boolValue(
            'cfgModuloAlarmas',
            DEFAULTS.modulos.alarmas
          ),

          historial: boolValue(
            'cfgModuloHistorial',
            DEFAULTS.modulos.historial
          ),

          correcciones: boolValue(
            'cfgModuloCorrecciones',
            DEFAULTS.modulos.correcciones
          ),

          fotografias: boolValue(
            'cfgModuloFotos',
            DEFAULTS.modulos.fotografias
          )
        },

        sincronizacion: {
          sincronizarAlRecuperarSenal: boolValue(
            'cfgSyncSenal',
            DEFAULTS.sincronizacion.sincronizarAlRecuperarSenal
          ),

          reintentosAutomaticos: boolValue(
            'cfgSyncReintentos',
            DEFAULTS.sincronizacion.reintentosAutomaticos
          ),

          reconciliarPendientes: boolValue(
            'cfgSyncReconciliar',
            DEFAULTS.sincronizacion.reconciliarPendientes
          )
        },

        whatsapp: {
          entorno: textValue(
            'cfgWhatsappEntorno',
            DEFAULTS.whatsapp.entorno
          ),

          mensajesActivos: boolValue(
            'cfgWhatsappMensajes',
            DEFAULTS.whatsapp.mensajesActivos
          ),

          fotosActivas: boolValue(
            'cfgWhatsappFotos',
            DEFAULTS.whatsapp.fotosActivas
          ),

          alarmasActivas: boolValue(
            'cfgWhatsappAlarmas',
            DEFAULTS.whatsapp.alarmasActivas
          ),

          correccionesActivas: boolValue(
            'cfgWhatsappCorrecciones',
            DEFAULTS.whatsapp.correccionesActivas
          )
        },

        mantenimiento: {
          activo: boolValue(
            'cfgMantenimientoActivo',
            DEFAULTS.mantenimiento.activo
          ),

          mensaje: textValue(
            'cfgMantenimientoMensaje',
            DEFAULTS.mantenimiento.mensaje
          ),

          permiteCapturaOffline: true
        },

        versiones: {
          versionMinima: textValue(
            'cfgVersionMinima',
            DEFAULTS.versiones.versionMinima
          ),

          avisoActualizacion: boolValue(
            'cfgAvisoActualizacion',
            DEFAULTS.versiones.avisoActualizacion
          )
        }
      };
    },

    validate(config){
      const errors = [];

      if(
        config.whatsapp.entorno !== 'produccion' &&
        config.whatsapp.entorno !== 'pruebas'
      ){
        errors.push('El entorno de WhatsApp no es válido.');
      }

      if(
        config.mantenimiento.activo &&
        !config.mantenimiento.mensaje
      ){
        errors.push(
          'Escribe un mensaje antes de activar mantenimiento.'
        );
      }

      return errors;
    },

    changedFields(before, after, prefix){
      const rows = [];
      const root = prefix || '';

      Object.keys(after || {}).forEach(key => {
        if(key === 'metadata') return;

        const path = root ? root + '.' + key : key;
        const oldValue = before?.[key];
        const newValue = after?.[key];

        const oldIsObject =
          oldValue &&
          typeof oldValue === 'object' &&
          !Array.isArray(oldValue);

        const newIsObject =
          newValue &&
          typeof newValue === 'object' &&
          !Array.isArray(newValue);

        if(oldIsObject && newIsObject){
          rows.push(
            ...this.changedFields(oldValue, newValue, path)
          );
          return;
        }

        if(JSON.stringify(oldValue) !== JSON.stringify(newValue)){
          rows.push({
            campo: path,
            anterior: oldValue ?? null,
            nuevo: newValue ?? null
          });
        }
      });

      return rows;
    },

    async save(){
      if(!this.db){
        this.toast('Firebase todavía no está disponible.', true);
        return;
      }

      const config = this.readForm();
      const errors = this.validate(config);

      if(errors.length){
        this.toast(errors[0], true);
        return;
      }

      const changes = this.changedFields(this.original, config);

      if(!changes.length){
        this.toast('No hay cambios para publicar.');
        return;
      }

      const user =
        window.AdminAuth?.current?.user ||
        'Usuario Admin';
      const now = new Date().toISOString();

      /*
       * La versión usa Date.now():
       * - es numérica;
       * - es creciente;
       * - no requiere una transacción adicional;
       * - identifica exactamente cada publicación.
       */
      const version = Date.now();
      const checksum = configChecksum(config);

      const metadata = {
        version,
        checksum,
        updatedAt: now,
        updatedBy: user,
        source: 'admin-config-center',

        /*
         * Todavía no se conecta a la aplicación de campo.
         * Esto evita afirmar que ya está aplicada.
         */
        status: 'publicado-no-consumido-campo',
        applied: false
      };

      /*
       * Copia administrativa completa.
       * Conserva la ruta que actualmente usa el Centro.
       */
      const payload = {
        ...config,
        metadata
      };

      /*
       * Copia preparada para futuros consumidores:
       * Recorredores, Admin y UPV.
       */
      const runtime = {
        version,
        checksum,
        updatedAt: now,
        updatedBy: user,
        status: 'active',
        schemaVersion: 1,
        config
      };

      /*
       * Nodo ligero para comprobar la versión sin descargar
       * toda la configuración.
       */
      const versionRecord = {
        value: version,
        checksum,
        updatedAt: now,
        updatedBy: user,
        schemaVersion: 1
      };

      const auditKey =
        this.db.ref(AUDIT_PATH).push().key;

      if(!auditKey){
        this.toast(
          'No se pudo generar la clave de auditoría.',
          true
        );

        return;
      }

      const audit = {
        fecha: now,
        usuario: user,
        accion: 'CONFIGURACION_PUBLICADA',
        estado: 'PUBLICADO_NO_CONSUMIDO_CAMPO',
        version,
        checksum,
        cambios: changes.slice(0, 100),
        totalCambios: changes.length,
        origen: 'admin'
      };


      this.setSaveStatus('Publicando configuración...');

      try{
        const updates = {};

        
        /*
         * Escritura multirruta:
         * current, runtime, version y audit se publican juntos.
         */
        updates['/' + CURRENT_PATH] = payload;
        updates['/' + RUNTIME_PATH] = runtime;
        updates['/' + VERSION_PATH] = versionRecord;
        updates['/' + AUDIT_PATH + '/' + auditKey] = audit;


        await this.db.ref().update(updates);

        this.current = clone(payload);
        this.original = clone(payload);

        this.setSaveStatus('Configuración publicada · v' + version);
        this.toast(
          'Configuración publicada, versionada y registrada en la bitácora.'
        );
      }catch(error){
        console.error('[CONFIG_CENTER] guardado:', error);

        this.setSaveStatus('Error al guardar');
        this.toast(
          'No se pudo guardar la configuración.',
          true
        );
      }
    },

    restoreDefaults(){
      const accepted = window.confirm(
        'Esto cargará los valores predeterminados en el formulario. ' +
        'No se publicarán hasta presionar Guardar configuración.'
      );

      if(!accepted) return;

      this.applyToForm(DEFAULTS);
      this.setSaveStatus('Valores predeterminados sin publicar');

      this.toast(
        'Valores predeterminados cargados. Revisa y guarda para publicar.'
      );
    },

    applyToForm(config){
      const value = merge(DEFAULTS, config);

      setValue('cfgRadioGps', value.operacion.radioGpsMetros);
      setValue('cfgHistorialVisible', value.operacion.historialVisible);
      setValue('cfgMaxFotos', value.operacion.maxFotos);
      setValue(
        'cfgCorreccionMinutos',
        value.operacion.correccionMinutos
      );

      setValue('cfgGpsAndroid', value.gps.timeoutAndroidMs);
      setValue('cfgGpsIos', value.gps.timeoutIosMs);
      setValue(
        'cfgGpsPrecision',
        value.gps.precisionMaximaMetros
      );
      setValue(
        'cfgGpsSegundaLectura',
        value.gps.segundaLectura
      );
      setValue(
        'cfgGpsFotoFuera',
        value.gps.fotoFueraRadio
      );
      setValue(
        'cfgGpsJustificacion',
        value.gps.justificacionFueraRadio
      );

      setValue(
        'cfgModuloCo',
        value.modulos.controlOperativo
      );
      setValue(
        'cfgModuloNivel',
        value.modulos.nivelGuardia
      );
      setValue(
        'cfgModuloAlarmas',
        value.modulos.alarmas
      );
      setValue(
        'cfgModuloHistorial',
        value.modulos.historial
      );
      setValue(
        'cfgModuloCorrecciones',
        value.modulos.correcciones
      );
      setValue(
        'cfgModuloFotos',
        value.modulos.fotografias
      );

      setValue(
        'cfgSyncSenal',
        value.sincronizacion.sincronizarAlRecuperarSenal
      );
      setValue(
        'cfgSyncReintentos',
        value.sincronizacion.reintentosAutomaticos
      );
      setValue(
        'cfgSyncReconciliar',
        value.sincronizacion.reconciliarPendientes
      );

      setValue(
        'cfgWhatsappEntorno',
        value.whatsapp.entorno
      );
      setValue(
        'cfgWhatsappMensajes',
        value.whatsapp.mensajesActivos
      );
      setValue(
        'cfgWhatsappFotos',
        value.whatsapp.fotosActivas
      );
      setValue(
        'cfgWhatsappAlarmas',
        value.whatsapp.alarmasActivas
      );
      setValue(
        'cfgWhatsappCorrecciones',
        value.whatsapp.correccionesActivas
      );

      setValue(
        'cfgMantenimientoActivo',
        value.mantenimiento.activo
      );
      setValue(
        'cfgMantenimientoMensaje',
        value.mantenimiento.mensaje
      );

      setValue(
        'cfgVersionMinima',
        value.versiones.versionMinima
      );
      setValue(
        'cfgAvisoActualizacion',
        value.versiones.avisoActualizacion
      );
    },

    renderAudit(){
      const container =
        document.getElementById('configAuditList');

      if(!container) return;

      if(!this.auditRows.length){
        container.innerHTML = `
          <div class="config-empty">
            Todavía no hay cambios registrados.
          </div>
        `;
        return;
      }

      const rows = [];

      this.auditRows.forEach(record => {
        const changes = Array.isArray(record.cambios)
          ? record.cambios
          : Object.values(record.cambios || {});

        if(!changes.length){
          rows.push({
            fecha: record.fecha,
            usuario: record.usuario,
            accion: record.accion,
            campo: 'Configuración general',
            anterior: '—',
            nuevo: '—'
          });

          return;
        }

        changes.forEach(change => {
          rows.push({
            fecha: record.fecha,
            usuario: record.usuario,
            accion: record.accion,
            campo: change.campo || 'Parámetro',
            anterior: change.anterior,
            nuevo: change.nuevo
          });
        });
      });

      container.innerHTML = `
        <div class="config-audit-table-wrap">
          <table class="config-audit-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Parámetro</th>
                <th>Valor anterior</th>
                <th>Valor nuevo</th>
              </tr>
            </thead>

            <tbody>
              ${rows.map(row => `
                <tr>
                  <td>
                    ${escapeHtml(formatDate(row.fecha))}
                  </td>

                  <td class="config-audit-user-cell">
                    ${escapeHtml(row.usuario || 'Usuario')}
                  </td>

                  <td>
                    <span class="config-audit-action">
                      ${escapeHtml(
                        row.accion || 'ACTUALIZACIÓN'
                      )}
                    </span>
                  </td>

                  <td>
                    ${escapeHtml(row.campo)}
                  </td>

                  <td>
                    <span
                      class="config-audit-value
                      config-audit-value-old">
                      ${escapeHtml(
                        this.formatAuditValue(row.anterior)
                      )}
                    </span>
                  </td>

                  <td>
                    <span
                      class="config-audit-value
                      config-audit-value-new">
                      ${escapeHtml(
                        this.formatAuditValue(row.nuevo)
                      )}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    },

    formatAuditValue(value){
      if(value === null || value === undefined){
        return '—';
      }

      if(value === true){
        return 'Activado';
      }

      if(value === false){
        return 'Desactivado';
      }

      if(typeof value === 'object'){
        try{
          return JSON.stringify(value);
        }catch(error){
          return String(value);
        }
      }

      const stringValue = String(value).trim();

      return stringValue || 'Vacío';
    },

    updateHeaderDetails(user, updatedAt, version){
      const userElement =
        document.getElementById('configStateUser');

      const updatedElement =
        document.getElementById('configStateUpdated');

      const versionElement =
        document.getElementById('configStateVersion');

      if(userElement){
        userElement.textContent = user || 'Administrador';
      }

      if(updatedElement){
        updatedElement.textContent = updatedAt
          ? formatDate(updatedAt)
          : 'Sin cambios';
      }

      if(versionElement){
        const visibleVersion =
          version ||
          document
            .querySelector('.version-pill, .version-badge')
            ?.textContent
            ?.trim() ||
          'Actual';

        versionElement.textContent = visibleVersion;
      }
    },

    updateState(title, subtitle){
      const titleElement =
        document.getElementById('configStateTitle');

      const subtitleElement =
        document.getElementById('configStateSubtitle');

      if(titleElement){
        titleElement.textContent = title;
      }

      if(subtitleElement){
        subtitleElement.textContent = subtitle;
      }
    },

    setSaveStatus(message){
      const element =
        document.getElementById('configSaveStatus');

      if(element){
        element.textContent = message;
      }
    },

    toast(message, isError){
      let toast = document.getElementById('configToast');

      if(!toast){
        toast = document.createElement('div');
        toast.id = 'configToast';
        toast.className = 'config-toast';
        document.body.appendChild(toast);
      }

      toast.textContent = message;
      toast.classList.toggle('error', Boolean(isError));
      toast.classList.add('show');

      clearTimeout(this.toastTimer);

      this.toastTimer = setTimeout(() => {
        toast.classList.remove('show');
      }, 3600);
    }
  };

  function start(){
    window.AdminConfigCenter.init();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  }else{
    start();
  }
})();
