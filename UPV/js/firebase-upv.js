'use strict';

/*
 * Firebase exclusivo de la aplicación UPV.
 *
 * IMPORTANTE:
 * - No escribe en /reportes, /alarmas ni /correcciones.
 * - No registra listeners de la app de recorredores.
 * - No configura UltraMsg.
 * - No envía datos todavía.
 */

var UPV_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAkMbD9XgFDA6gchX38Ma6goABsoimi-50',
  authDomain: 'pozos-upv.firebaseapp.com',
  databaseURL: 'https://pozos-upv-default-rtdb.firebaseio.com',
  projectId: 'pozos-upv',
  storageBucket: 'pozos-upv.firebasestorage.app',
  messagingSenderId: '126193680547',
  appId: '1:126193680547:web:db6501b3d759491f13ff16',
  measurementId: 'G-108SP3JKHS'
};

function inicializarFirebaseUpv() {
  if (!window.firebase) {
    console.warn(
      '[UPV-Firebase] SDK no disponible. ' +
      'La app continuará funcionando en modo local.'
    );

    UPV.firebaseReady = false;
    UPV.firebaseConnected = false;
    return;
  }

  try {
    /*
     * Se utiliza una aplicación Firebase con nombre propio.
     * Esto evita reutilizar accidentalmente una instancia de otra app.
     */
    var app;

    try {
      app = firebase.app('upvApp');
    } catch (e) {
      app = firebase.initializeApp(
        UPV_FIREBASE_CONFIG,
        'upvApp'
      );
    }

    UPV.firebaseApp = app;

    /*
     * APP CHECK — UPV WEB
     *
     * Se inicializa sobre la misma instancia nombrada upvApp.
     * Fraud Defense utiliza la clave reCAPTCHA Enterprise
     * restringida al dominio de la PWA.
     *
     * tokenAutoRefreshEnabled mantiene actualizado el token
     * mientras la aplicación permanece abierta.
     */
    if(
      typeof app.appCheck !== 'function'
    ){
      throw new Error(
        'Firebase App Check SDK no disponible'
      );
    }

    try{
      UPV.firebaseAppCheck = app.appCheck();

      UPV.firebaseAppCheck.activate(
        new firebase.appCheck.ReCaptchaEnterpriseProvider(
          '6LeJn98tAAAAAN2-CKkUJ9B0_QftvGVC4IvNQimw'
        ),
        true
      );

      console.log(
        '[UPV-AppCheck] Inicializado'
      );

    }catch(error){

      /*
       * Una segunda llamada sobre la misma instancia puede indicar
       * que App Check ya estaba activo. Ese caso es seguro.
       */
      if(
        error &&
        String(error.code || '').indexOf(
          'appCheck/already-initialized'
        ) !== -1
      ){
        console.log(
          '[UPV-AppCheck] Ya inicializado'
        );
      }else{
        throw error;
      }
    }

    /*
     * RTDB se instancia únicamente después de que App Check
     * esté disponible/inicializado.
     */
    UPV.firebaseDb = app.database();

    /*
     * Authentication exclusivo de la misma app Firebase UPV.
     *
     * firebaseReady todavía NO se activa aquí.
     * Primero necesitamos una identidad autenticada.
     */
    if (
      typeof app.auth !== 'function'
    ) {
      throw new Error(
        'Firebase Auth SDK no disponible'
      );
    }

    UPV.firebaseAuth = app.auth();
    UPV.firebaseAuthReady = false;
    UPV.firebaseReady = false;

    /*
     * Escuchar restauración/cambio de sesión.
     *
     * Firebase conserva la sesión anónima localmente,
     * por lo que normalmente el mismo dispositivo
     * recuperará su UID al volver a abrir la PWA.
     */
    UPV.firebaseAuth.onAuthStateChanged(
      function(user) {

        if(user) {

          UPV.firebaseUser = user;
          UPV.firebaseUid = user.uid;
          UPV.firebaseAuthReady = true;
          UPV.firebaseReady = true;

          console.log(
            '[UPV-Auth] Sesión autenticada:',
            user.uid
          );

          window.dispatchEvent(
            new CustomEvent(
              'upvFirebaseAuth',
              {
                detail: {
                  authenticated: true,
                  uid: user.uid
                }
              }
            )
          );

          /*
           * Si RTDB ya estaba conectado cuando terminó
           * Authentication, liberar ahora el FIFO.
           */
          if (
            UPV.firebaseConnected &&
            typeof sincronizarPendientesUpv === 'function'
          ) {
            sincronizarPendientesUpv();
          }

          return;
        }

        /*
         * Todavía no existe sesión:
         * crear identidad anónima automáticamente.
         *
         * No requiere intervención del operador.
         */
        UPV.firebaseUser = null;
        UPV.firebaseUid = null;
        UPV.firebaseAuthReady = false;
        UPV.firebaseReady = false;

        if(!navigator.onLine) {
          console.log(
            '[UPV-Auth] Sin Internet; autenticación pendiente'
          );
          return;
        }

        autenticarAnonimoFirebaseUpv();
      }
    );

    /*
     * .info/connected es una ruta interna de Firebase.
     * Solo informa si existe conexión; no escribe datos operativos.
     */
    UPV.firebaseDb
      .ref('.info/connected')
      .on('value', function(snapshot) {
        UPV.firebaseConnected = snapshot.val() === true;

        console.log(
          '[UPV-Firebase]',
          UPV.firebaseConnected
            ? 'Conectado a RTDB'
            : 'Sin conexión a RTDB'
        );

        window.dispatchEvent(
          new CustomEvent('upvFirebaseConnection', {
            detail: {
              connected: UPV.firebaseConnected
            }
          })
        );

        if (
          UPV.firebaseConnected &&
          UPV.firebaseAuthReady &&
          UPV.firebaseUid &&
          typeof sincronizarPendientesUpv === 'function'
        ) {
          sincronizarPendientesUpv();
        }
      });

    console.log(
      '[UPV-Firebase] Inicialización aislada correcta'
    );
  } catch (error) {

    /*
     * La instancia nombrada upvApp puede conservarse para
     * un reintento posterior, pero ningún servicio parcial
     * debe considerarse operativo.
     */
    UPV.firebaseAppCheck = null;
    UPV.firebaseDb = null;
    UPV.firebaseAuth = null;
    UPV.firebaseUser = null;
    UPV.firebaseUid = null;
    UPV.firebaseAuthReady = false;
    UPV.firebaseReady = false;
    UPV.firebaseConnected = false;

    console.error(
      '[UPV-Firebase] Error de inicialización:',
      error
    );
  }
}

function obtenerEstadoFirebaseUpv() {
  return {
    ready: UPV.firebaseReady === true,
    connected: UPV.firebaseConnected === true,
    database: UPV.firebaseDb ? 'configurada' : 'no_configurada'
  };
}

window.inicializarFirebaseUpv = inicializarFirebaseUpv;
window.obtenerEstadoFirebaseUpv = obtenerEstadoFirebaseUpv;


/*
 * ============================================================
 * RECUPERACIÓN FIREBASE DESPUÉS DE ARRANQUE OFFLINE
 * ============================================================
 *
 * Si la PWA abrió completamente sin Internet, los SDK externos
 * de Firebase pueden no existir en window.
 *
 * Al recuperar señal:
 * 1. cargamos firebase-app-compat una sola vez;
 * 2. cargamos firebase-database-compat;
 * 3. inicializamos la app UPV;
 * 4. .info/connected continuará con el FIFO existente.
 */

var _upvFirebaseSdkPromise = null;
var _upvFirebaseAuthPromise = null;


/*
 * Una sola operación de Anonymous Auth puede estar activa.
 * Si varios eventos solicitan autenticación simultáneamente,
 * todos reutilizan la misma promesa.
 */
function autenticarAnonimoFirebaseUpv(){

  if(
    !UPV.firebaseAuth ||
    !navigator.onLine
  ){
    return Promise.resolve(false);
  }

  if(UPV.firebaseAuth.currentUser){
    return Promise.resolve(true);
  }

  if(_upvFirebaseAuthPromise){
    return _upvFirebaseAuthPromise;
  }

  _upvFirebaseAuthPromise =
    UPV.firebaseAuth
      .signInAnonymously()
      .then(function(){
        return true;
      })
      .catch(function(error){
        console.warn(
          '[UPV-Auth] No fue posible autenticar:',
          error && error.message
            ? error.message
            : error
        );
        return false;
      })
      .finally(function(){
        _upvFirebaseAuthPromise = null;
      });

  return _upvFirebaseAuthPromise;
}


function cargarScriptFirebaseUpv(src, id){

  return new Promise(function(resolve, reject){

    /*
     * Si este script ya fue insertado previamente,
     * esperar su resultado en lugar de duplicarlo.
     */
    var existente =
      document.getElementById(id);

    if(existente){

      if(
        existente.dataset &&
        existente.dataset.upvLoaded === '1'
      ){
        resolve();
        return;
      }

      existente.addEventListener(
        'load',
        function(){
          resolve();
        },
        { once:true }
      );

      existente.addEventListener(
        'error',
        function(){
          reject(
            new Error(
              'No fue posible cargar ' + src
            )
          );
        },
        { once:true }
      );

      return;
    }


    var script =
      document.createElement('script');

    script.id = id;
    script.src = src;
    script.async = true;

    script.onload = function(){

      script.dataset.upvLoaded = '1';

      resolve();
    };

    script.onerror = function(){

      /*
       * Permitir un intento posterior si la red
       * volvió a perderse durante la descarga.
       */
      try{
        script.remove();
      }catch(e){}

      reject(
        new Error(
          'No fue posible cargar ' + src
        )
      );
    };

    document.head.appendChild(script);
  });
}


async function asegurarFirebaseUpv(){

  /*
   * Firebase + Database ya están disponibles.
   */
  if(
    window.firebase &&
    typeof window.firebase.initializeApp === 'function' &&
    window.firebase.appCheck &&
    window.firebase.auth &&
    window.firebase.database
  ){

    if(
      !UPV.firebaseDb ||
      !UPV.firebaseAuth
    ){
      inicializarFirebaseUpv();
    }

    /*
     * Caso crítico:
     * la PWA pudo arrancar completamente offline.
     * Auth/Database ya existen, pero todavía no hay UID.
     *
     * Al recuperar Internet debemos completar
     * Authentication antes de liberar el FIFO.
     */
    if(
      navigator.onLine &&
      UPV.firebaseAuth &&
      !UPV.firebaseAuthReady &&
      !UPV.firebaseUid &&
      !UPV.firebaseAuth.currentUser
    ){
      await autenticarAnonimoFirebaseUpv();
    }

    return !!(
      UPV.firebaseDb &&
      UPV.firebaseAuth
    );
  }


  /*
   * Sin Internet no intentamos descargar los SDK.
   * La operación local continúa normalmente.
   */
  if(!navigator.onLine){
    return false;
  }


  /*
   * Lock global:
   * múltiples eventos "online" no pueden iniciar
   * varias descargas simultáneas de Firebase.
   */
  if(_upvFirebaseSdkPromise){
    return _upvFirebaseSdkPromise;
  }


  _upvFirebaseSdkPromise =
    (async function(){

      try{

        if(
          !window.firebase ||
          typeof window.firebase.initializeApp !== 'function'
        ){

          await cargarScriptFirebaseUpv(
            'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
            'upv-firebase-app-dynamic'
          );
        }


        /*
         * App Check debe cargarse después de Firebase App.
         * La inicialización del proveedor se realizará
         * sobre la instancia nombrada upvApp.
         */
        if(
          !window.firebase ||
          !window.firebase.appCheck
        ){

          await cargarScriptFirebaseUpv(
            'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check-compat.js',
            'upv-firebase-app-check-dynamic'
          );
        }


        /*
         * Authentication debe cargarse después de App
         * y antes de inicializar la aplicación UPV.
         */
        if(
          !window.firebase ||
          !window.firebase.auth
        ){

          await cargarScriptFirebaseUpv(
            'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
            'upv-firebase-auth-dynamic'
          );
        }


        if(
          !window.firebase ||
          !window.firebase.database
        ){

          await cargarScriptFirebaseUpv(
            'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
            'upv-firebase-database-dynamic'
          );
        }


        if(
          !window.firebase ||
          !window.firebase.appCheck ||
          !window.firebase.auth ||
          !window.firebase.database
        ){
          throw new Error(
            'Firebase App Check/Auth/Database SDK no disponible después de la carga'
          );
        }


        inicializarFirebaseUpv();


        if(
          !UPV.firebaseDb ||
          !UPV.firebaseAuth
        ){
          throw new Error(
            'Firebase UPV no pudo inicializar Auth/Database'
          );
        }


        console.log(
          '[UPV-Firebase] SDK recuperado; esperando estado Auth'
        );

        return true;

      }catch(error){

        console.warn(
          '[UPV-Firebase] Recuperación pendiente:',
          error && error.message
            ? error.message
            : error
        );

        return false;

      }finally{

        /*
         * Liberar el lock.
         * Si la recuperación falló por una red inestable,
         * un próximo evento online podrá volver a intentar.
         */
        _upvFirebaseSdkPromise = null;
      }

    })();


  return _upvFirebaseSdkPromise;
}


window.asegurarFirebaseUpv =
  asegurarFirebaseUpv;


/*
 * Diagnóstico manual de App Check.
 * No imprime ni expone el token completo.
 */
window.verificarAppCheckUpv = async function(){

  try{

    if(
      !UPV.firebaseAppCheck
    ){
      console.warn(
        '[UPV-AppCheck] No inicializado'
      );
      return false;
    }

    const resultado =
      await UPV.firebaseAppCheck.getToken(true);

    const valido =
      !!(
        resultado &&
        resultado.token
      );

    console.log(
      valido
        ? '[UPV-AppCheck] TOKEN VÁLIDO'
        : '[UPV-AppCheck] TOKEN NO DISPONIBLE'
    );

    return valido;

  }catch(error){

    console.error(
      '[UPV-AppCheck] ERROR TOKEN:',
      error && error.code
        ? error.code
        : error && error.message
          ? error.message
          : error
    );

    return false;
  }
};
