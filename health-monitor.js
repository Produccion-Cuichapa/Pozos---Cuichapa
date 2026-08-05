(function(){
  'use strict';

  if(window.__APP_HEALTH_MONITOR__){
    return;
  }

  window.__APP_HEALTH_MONITOR__ = true;

  var VERSION = 'health-v1';
  var QUEUE_KEY = 'cuichapa_health_queue_v1';
  var SESSION_KEY = 'cuichapa_health_session_v1';
  var MAX_LOCAL_EVENTS = 150;
  var FLUSH_INTERVAL = 10000;
  var HEARTBEAT_INTERVAL = 60000;
  var FREEZE_CHECK_INTERVAL = 5000;
  var FREEZE_THRESHOLD = 8000;

  var sessionId = sessionStorage.getItem(SESSION_KEY);

  if(!sessionId){
    sessionId =
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 10);

    sessionStorage.setItem(
      SESSION_KEY,
      sessionId
    );
  }

  var ultimoFreezeTick = Date.now();
  var enviando = false;
  var dedupe = {};

  function textoSeguro(value, max){
    var valueText = '';

    try{
      valueText = String(value || '');
    }catch(error){
      valueText = '[no convertible]';
    }

    return valueText.slice(
      0,
      max || 500
    );
  }

  function fechaDia(){
    return new Date()
      .toISOString()
      .slice(0, 10);
  }

  function navegador(){
    return textoSeguro(
      navigator.userAgent,
      300
    );
  }

  function conexion(){
    var connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection ||
      {};

    return {
      online: navigator.onLine,
      effectiveType:
        connection.effectiveType || null,
      downlink:
        connection.downlink || null,
      rtt:
        connection.rtt || null,
      saveData:
        connection.saveData === true
    };
  }

  function memoria(){
    var memory =
      performance &&
      performance.memory
        ? performance.memory
        : null;

    if(!memory){
      return null;
    }

    return {
      usedMB: Number(
        (
          memory.usedJSHeapSize /
          1048576
        ).toFixed(1)
      ),
      totalMB: Number(
        (
          memory.totalJSHeapSize /
          1048576
        ).toFixed(1)
      ),
      limitMB: Number(
        (
          memory.jsHeapSizeLimit /
          1048576
        ).toFixed(1)
      )
    };
  }

  function contexto(){
    var path =
      location.pathname || '/';

    return {
      area:
        path.indexOf('/admin') >= 0
          ? 'plataforma'
          : (
              path.indexOf('/UPV') >= 0
                ? 'upv'
                : 'app'
            ),

      url:
        path + (location.hash || ''),

      recorredor:
        typeof window.REC !== 'undefined'
          ? textoSeguro(window.REC, 80)
          : null,

      pozo:
        typeof window.W !== 'undefined'
          ? textoSeguro(window.W, 40)
          : null,

      modo:
        typeof window.modoRegistro !==
        'undefined'
          ? textoSeguro(
              window.modoRegistro,
              40
            )
          : null,

      visibility:
        document.visibilityState,

      connection:
        conexion(),

      memory:
        memoria(),

      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr:
          Number(
            window.devicePixelRatio || 1
          )
      }
    };
  }

  function leerCola(){
    try{
      var queue = JSON.parse(
        localStorage.getItem(QUEUE_KEY) ||
        '[]'
      );

      return Array.isArray(queue)
        ? queue
        : [];
    }catch(error){
      return [];
    }
  }

  function guardarCola(queue){
    try{
      if(queue.length > MAX_LOCAL_EVENTS){
        queue = queue.slice(
          queue.length - MAX_LOCAL_EVENTS
        );
      }

      localStorage.setItem(
        QUEUE_KEY,
        JSON.stringify(queue)
      );
    }catch(error){}
  }

  function crearEvento(
    type,
    severity,
    detail
  ){
    return {
      version: VERSION,
      sessionId: sessionId,
      type: textoSeguro(type, 80),
      severity:
        textoSeguro(
          severity || 'info',
          20
        ),
      detail: detail || {},
      context: contexto(),
      timestamp: Date.now(),
      iso: new Date().toISOString(),
      userAgent: navegador()
    };
  }

  function emitir(
    type,
    severity,
    detail,
    dedupeSeconds
  ){
    var key =
      type +
      '|' +
      textoSeguro(
        detail &&
        (
          detail.message ||
          detail.reportId ||
          detail.url ||
          ''
        ),
        160
      );

    var now = Date.now();
    var windowMs =
      Number(dedupeSeconds || 0) *
      1000;

    if(
      windowMs > 0 &&
      dedupe[key] &&
      now - dedupe[key] < windowMs
    ){
      return;
    }

    dedupe[key] = now;

    var queue = leerCola();

    queue.push(
      crearEvento(
        type,
        severity,
        detail
      )
    );

    guardarCola(queue);
    programarFlush();
  }

  /*
   * Resolver la conexión real de Firebase.
   *
   * La app puede declarar fbDB como variable global,
   * sin adjuntarla explícitamente a window.
   * La plataforma utiliza su propio objeto Firebase.
   */
  function obtenerHealthDB(){
    try{
      if(
        window.fbDB &&
        typeof window.fbDB.ref === 'function'
      ){
        return window.fbDB;
      }
    }catch(error){}

    try{
      if(
        typeof fbDB !== 'undefined' &&
        fbDB &&
        typeof fbDB.ref === 'function'
      ){
        return fbDB;
      }
    }catch(error){}

    try{
      if(
        window.AdminFirebase &&
        window.AdminFirebase.db &&
        typeof window.AdminFirebase.db.ref ===
          'function'
      ){
        return window.AdminFirebase.db;
      }
    }catch(error){}

    try{
      if(
        window.firebase &&
        typeof window.firebase.database ===
          'function'
      ){
        var db = window.firebase.database();

        if(
          db &&
          typeof db.ref === 'function'
        ){
          return db;
        }
      }
    }catch(error){}

    return null;
  }

  function firebaseDisponible(){
    return Boolean(obtenerHealthDB());
  }

  function enviarEvento(event){
    var db = obtenerHealthDB();

    if(!db){
      return Promise.reject(
        new Error(
          'Firebase DB no disponible para Health'
        )
      );
    }

    var path =
      'systemHealth/events/' +
      fechaDia();

    return db
      .ref(path)
      .push(event);
  }

  function flush(){
    if(
      enviando ||
      !firebaseDisponible() ||
      !navigator.onLine
    ){
      return Promise.resolve(false);
    }

    var queue = leerCola();

    if(!queue.length){
      return Promise.resolve(true);
    }

    enviando = true;

    var batch = queue.slice(0, 10);
    var restante = queue.slice(10);

    var chain = Promise.resolve();

    batch.forEach(function(event){
      chain = chain.then(function(){
        return enviarEvento(event);
      });
    });

    return chain
      .then(function(){
        guardarCola(restante);
        enviando = false;

        if(restante.length){
          setTimeout(flush, 1000);
        }

        return true;
      })
      .catch(function(error){
        enviando = false;

        console.warn(
          '[HEALTH] No se pudo enviar:',
          error &&
          (
            error.code ||
            error.message
          )
        );

        return false;
      });
  }

  var flushTimer = null;

  function programarFlush(){
    if(flushTimer){
      return;
    }

    flushTimer = setTimeout(
      function(){
        flushTimer = null;
        flush();
      },
      1500
    );
  }

  function guardarSesion(){
    if(
      !firebaseDisponible() ||
      !navigator.onLine
    ){
      return;
    }

    var payload = {
      version: VERSION,
      sessionId: sessionId,
      lastSeen: Date.now(),
      iso: new Date().toISOString(),
      context: contexto(),
      userAgent: navegador()
    };

    var db = obtenerHealthDB();

    if(!db){
      return;
    }

    db.ref(
        'systemHealth/sessions/' +
        sessionId
      )
      .update(payload)
      .catch(function(error){
        console.warn(
          '[HEALTH] Sesión no registrada:',
          error &&
          (
            error.code ||
            error.message
          )
        );
      });
  }

  function navigationMetrics(){
    try{
      var entry =
        performance.getEntriesByType(
          'navigation'
        )[0];

      if(!entry){
        return;
      }

      emitir(
        'navigation',
        entry.loadEventEnd > 8000
          ? 'warning'
          : 'info',
        {
          dnsMs:
            Number(
              (
                entry.domainLookupEnd -
                entry.domainLookupStart
              ).toFixed(1)
            ),
          connectMs:
            Number(
              (
                entry.connectEnd -
                entry.connectStart
              ).toFixed(1)
            ),
          responseMs:
            Number(
              (
                entry.responseEnd -
                entry.requestStart
              ).toFixed(1)
            ),
          domReadyMs:
            Number(
              entry.domContentLoadedEventEnd
                .toFixed(1)
            ),
          loadMs:
            Number(
              entry.loadEventEnd
                .toFixed(1)
            ),
          transferSize:
            entry.transferSize || 0
        },
        300
      );
    }catch(error){}
  }

  function instalarErrores(){
    window.addEventListener(
      'error',
      function(event){
        var target =
          event.target || {};

        if(
          target !== window &&
          (
            target.src ||
            target.href
          )
        ){
          emitir(
            'resource_error',
            'error',
            {
              tag:
                target.tagName || null,
              url:
                textoSeguro(
                  target.src ||
                  target.href,
                  500
                )
            },
            60
          );

          return;
        }

        emitir(
          'javascript_error',
          'critical',
          {
            message:
              textoSeguro(
                event.message,
                500
              ),
            file:
              textoSeguro(
                event.filename,
                500
              ),
            line:
              event.lineno || null,
            column:
              event.colno || null,
            stack:
              textoSeguro(
                event.error &&
                event.error.stack,
                1600
              )
          },
          30
        );
      },
      true
    );

    window.addEventListener(
      'unhandledrejection',
      function(event){
        var reason = event.reason;

        emitir(
          'unhandled_rejection',
          'critical',
          {
            message:
              textoSeguro(
                reason &&
                (
                  reason.message ||
                  reason
                ),
                600
              ),
            stack:
              textoSeguro(
                reason &&
                reason.stack,
                1600
              )
          },
          30
        );
      }
    );
  }

  function instalarLongTasks(){
    if(
      typeof PerformanceObserver ===
      'undefined'
    ){
      return;
    }

    try{
      var observer =
        new PerformanceObserver(
          function(list){
            list.getEntries()
              .forEach(function(entry){
                if(entry.duration < 200){
                  return;
                }

                emitir(
                  'long_task',
                  entry.duration >= 1000
                    ? 'critical'
                    : 'warning',
                  {
                    durationMs:
                      Number(
                        entry.duration
                          .toFixed(1)
                      ),
                    startMs:
                      Number(
                        entry.startTime
                          .toFixed(1)
                      )
                  },
                  15
                );
              });
          }
        );

      observer.observe({
        entryTypes: ['longtask']
      });
    }catch(error){}
  }

  function instalarFreezeDetector(){
    ultimoFreezeTick = Date.now();

    setInterval(function(){
      var now = Date.now();

      var drift =
        now -
        ultimoFreezeTick -
        FREEZE_CHECK_INTERVAL;

      ultimoFreezeTick = now;

      if(drift >= FREEZE_THRESHOLD){
        emitir(
          'ui_freeze',
          drift >= 20000
            ? 'critical'
            : 'warning',
          {
            blockedMs: drift,
            visibility:
              document.visibilityState
          },
          20
        );
      }
    }, FREEZE_CHECK_INTERVAL);
  }

  function estadoEnviado(report){
    var status = String(
      report.whatsappStatus ||
      report.estado ||
      ''
    ).toLowerCase();

    return (
      report.whatsappSent === true ||
      status === 'sent' ||
      status === 'enviado'
    );
  }

  function revisarPendientesLocales(){
    if(
      typeof window.getHistorial !==
      'function'
    ){
      return;
    }

    var history = [];

    try{
      history =
        window.getHistorial() || [];
    }catch(error){
      return;
    }

    history.forEach(function(report){
      if(
        !report ||
        !report.id ||
        estadoEnviado(report)
      ){
        return;
      }

      var reportTime =
        new Date(
          report.fecha || 0
        ).getTime();

      if(
        !Number.isFinite(reportTime) ||
        Date.now() - reportTime <
          120000
      ){
        return;
      }

      var reportId =
        String(report.id);

      if(!firebaseDisponible()){
        emitir(
          report.modo === 'nota'
            ? 'note_pending_offline'
            : 'report_pending_offline',
          'warning',
          {
            reportId: reportId,
            pozo:
              textoSeguro(
                report.pozo,
                40
              ),
            mode:
              textoSeguro(
                report.modo,
                30
              ),
            ageMinutes:
              Math.round(
                (
                  Date.now() -
                  reportTime
                ) /
                60000
              )
          },
          300
        );

        return;
      }

      obtenerHealthDB()
        .ref(
          'whatsappSentRegistry/' +
          reportId
        )
        .once('value')
        .then(function(snapshot){
          var registry =
            snapshot.val();

          var registryStatus =
            String(
              registry &&
              (
                registry.status ||
                registry.estado
              ) ||
              ''
            ).toLowerCase();

          var confirmed =
            registry === true ||
            registryStatus === 'sent' ||
            registryStatus === 'enviado';

          emitir(
            confirmed
              ? 'status_mismatch'
              : (
                  report.modo === 'nota'
                    ? 'note_not_confirmed'
                    : 'report_not_confirmed'
                ),
            confirmed
              ? 'warning'
              : 'critical',
            {
              reportId: reportId,
              pozo:
                textoSeguro(
                  report.pozo,
                  40
                ),
              mode:
                textoSeguro(
                  report.modo,
                  30
                ),
              localStatus:
                textoSeguro(
                  report.whatsappStatus ||
                  report.estado,
                  40
                ),
              registryStatus:
                registryStatus || null,
              ageMinutes:
                Math.round(
                  (
                    Date.now() -
                    reportTime
                  ) /
                  60000
                )
            },
            300
          );
        })
        .catch(function(error){
          emitir(
            'registry_check_error',
            'warning',
            {
              reportId: reportId,
              code:
                textoSeguro(
                  error &&
                  (
                    error.code ||
                    error.message
                  ),
                  200
                )
            },
            300
          );
        });
    });
  }

  function instalarEstadoConexion(){
    window.addEventListener(
      'online',
      function(){
        emitir(
          'connection_online',
          'info',
          {
            connection: conexion()
          },
          10
        );

        flush();
        guardarSesion();
      }
    );

    window.addEventListener(
      'offline',
      function(){
        emitir(
          'connection_offline',
          'warning',
          {
            connection: conexion()
          },
          10
        );
      }
    );

    document.addEventListener(
      'visibilitychange',
      function(){
        emitir(
          'visibility_change',
          'info',
          {
            visibility:
              document.visibilityState
          },
          5
        );

        if(
          document.visibilityState ===
          'visible'
        ){
          flush();
          guardarSesion();
        }
      }
    );
  }

  window.AppHealth = {
    emit: emitir,
    flush: flush,
    snapshot: function(){
      return {
        sessionId: sessionId,
        queue: leerCola().length,
        context: contexto()
      };
    }
  };

  instalarErrores();
  instalarLongTasks();
  instalarFreezeDetector();
  instalarEstadoConexion();

  window.addEventListener(
    'load',
    function(){
      setTimeout(
        navigationMetrics,
        500
      );

      setTimeout(
        function(){
          emitir(
            'session_start',
            'info',
            {
              referrer:
                textoSeguro(
                  document.referrer,
                  300
                )
            },
            0
          );

          flush();
          guardarSesion();
          revisarPendientesLocales();
        },
        1800
      );
    }
  );

  setInterval(
    flush,
    FLUSH_INTERVAL
  );

  setInterval(
    guardarSesion,
    HEARTBEAT_INTERVAL
  );

  setInterval(
    revisarPendientesLocales,
    120000
  );

  console.log(
    '[HEALTH] Monitor activo:',
    VERSION,
    sessionId
  );
})();
