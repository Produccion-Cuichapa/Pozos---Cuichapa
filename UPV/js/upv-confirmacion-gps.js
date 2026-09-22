(function(){
'use strict';

if(window.__UPV_GPS_SERVICE_V2__) return;
window.__UPV_GPS_SERVICE_V2__ = true;

const RADIO_POZO_M = 80;

const cacheCoords =
  new Map();


function normalizar(v){

  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .trim()
    .toUpperCase();
}


function limpiarPozo(v){

  return normalizar(v)
    .replace(/^CUICHAPA\s*/,'')
    .replace(/^POZO\s*/,'')
    .replace(/^C-/,'')
    .trim();
}


function distanciaMetros(
  lat1,
  lng1,
  lat2,
  lng2
){

  const R = 6371000;

  const rad =
    x => x * Math.PI / 180;

  const dLat =
    rad(lat2 - lat1);

  const dLng =
    rad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) *
    Math.cos(rad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}


/* ==========================================================
   GPS DEL DISPOSITIVO
   ========================================================== */

let _upvGpsCache = null;
let _upvGpsWatchGlobal = null;

function iniciarGPSContinuoUPV(){

  if(
    _upvGpsWatchGlobal !== null ||
    !navigator.geolocation
  ){
    return;
  }

  _upvGpsWatchGlobal =
    navigator.geolocation.watchPosition(

      pos => {

        const lectura = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number(pos.coords.accuracy),
          timestamp: pos.timestamp || Date.now()
        };

        if(
          !_upvGpsCache ||
          lectura.timestamp >= _upvGpsCache.timestamp ||
          lectura.accuracy < _upvGpsCache.accuracy
        ){
          _upvGpsCache = lectura;
        }
      },

      () => {},

      {
        enableHighAccuracy:true,
        maximumAge:0,
        timeout:10000
      }
    );
}

function gpsCacheValidoUPV(){

  if(!_upvGpsCache){
    return null;
  }

  const lat =
    Number(_upvGpsCache.lat);

  const lng =
    Number(_upvGpsCache.lng);

  const timestamp =
    Number(
      _upvGpsCache.timestamp || 0
    );

  /*
   * MISMO PRINCIPIO OPERATIVO DE RECORREDORES:
   *
   * Una posición GPS existe cuando tenemos
   * coordenadas geográficas válidas.
   *
   * La precisión NO determina si el GPS
   * está disponible o no.
   *
   * Ejemplo:
   * accuracy = 87 m
   *
   * Sigue siendo una posición GPS válida.
   * Los 87 m se conservan como dato de precisión.
   *
   * El radio operativo de 80 m se aplica
   * exclusivamente a la DISTANCIA entre:
   *
   * posición actual
   *        VS
   * punto de referencia seleccionado.
   */

  if(
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ){
    return null;
  }

  /*
   * watchPosition mantiene este dato actualizado.
   *
   * Permitimos hasta 5 minutos como respaldo para
   * que un instante sin nueva lectura no convierta
   * artificialmente el GPS en "NO DISPONIBLE".
   *
   * Esto NO depende de Firebase ni de Internet.
   */
  const edad =
    Date.now() - timestamp;

  if(
    Number.isFinite(timestamp) &&
    timestamp > 0 &&
    edad > 300000
  ){
    return null;
  }

  return {
    ..._upvGpsCache,
    lat,
    lng,
    accuracy:
      Number.isFinite(
        Number(_upvGpsCache.accuracy)
      )
        ? Number(_upvGpsCache.accuracy)
        : null,
    timestamp
  };
}

iniciarGPSContinuoUPV();

function capturarGPS(){

  const cache =
    gpsCacheValidoUPV();

  if(cache){
    return Promise.resolve({
      ...cache
    });
  }

  return new Promise(
    (resolve,reject) => {

      if(!navigator.geolocation){

        reject(
          new Error(
            'Geolocalización no disponible'
          )
        );

        return;
      }


      let mejorPosicion = null;
      let watchId = null;
      let terminado = false;


      function finalizarConError(){

        if(terminado){
          return;
        }

        terminado = true;

        if(watchId !== null){
          navigator.geolocation.clearWatch(watchId);
        }

        if(mejorPosicion){

          resolve(mejorPosicion);

          return;
        }

        reject(
          new Error(
            'No fue posible obtener una ubicación GPS precisa'
          )
        );
      }


      const temporizador =
        setTimeout(
          finalizarConError,
          7000
        );


      watchId =
        navigator.geolocation.watchPosition(

          pos => {

            if(terminado){
              return;
            }


            const lectura = {

              lat:
                pos.coords.latitude,

              lng:
                pos.coords.longitude,

              accuracy:
                Number(
                  pos.coords.accuracy
                ),

              timestamp:
                pos.timestamp || Date.now()

            };


            if(
              !mejorPosicion ||
              lectura.accuracy <
                mejorPosicion.accuracy
            ){
              mejorPosicion = lectura;
            }


            /*
             * Para un radio operativo de 80 m,
             * no aceptar una lectura claramente imprecisa.
             */
            if(
              Number.isFinite(
                lectura.accuracy
              ) &&
              lectura.accuracy <= 80
            ){

              terminado = true;

              clearTimeout(
                temporizador
              );

              navigator.geolocation
                .clearWatch(watchId);

              resolve(lectura);
            }

          },


          error => {

            if(
              !mejorPosicion
            ){

              clearTimeout(
                temporizador
              );

              terminado = true;

              if(watchId !== null){
                navigator.geolocation
                  .clearWatch(watchId);
              }

              reject(error);
            }

          },


          {
            enableHighAccuracy:true,
            timeout:7000,
            maximumAge:0
          }

        );

    }
  );
}


/* ==========================================================
   COORDENADAS OFICIALES DEL POZO

   Se leen del index principal de Recorridores
   para no mantener dos listas de coordenadas.
   ========================================================== */

/*
 * ==========================================================
 * COORDENADAS OFICIALES — POZOS CON FRAC TANK
 * ==========================================================
 *
 * Son las mismas coordenadas utilizadas como referencia
 * operativa para la validación GPS.
 *
 * Radio permitido:
 * 80 metros.
 */

const COORD_POZOS_FT = Object.freeze({

  /*
   * BATERÍA DE SEPARACIÓN CUICHAPA.
   * Se valida con el mismo radio operativo de 80 metros.
   */
  'BSC': {
    lat:17.942389,
    lng:-94.297432
  },

  'PIA': {
    lat:17.940260,
    lng:-94.301605
  },

  'ECO': {
    lat:17.946119,
    lng:-94.283073
  },

  '19': {
    lat:17.955136,
    lng:-94.263964
  },

  '106D': {
    lat:17.957444,
    lng:-94.287753
  },

  '107': {
    lat:17.953797,
    lng:-94.280869
  },

  '137': {
    lat:17.967892,
    lng:-94.287797
  },

  '138': {
    lat:17.971828,
    lng:-94.287369
  },

  '139': {
    lat:17.951825,
    lng:-94.297089
  },

  '169': {
    lat:17.935357,
    lng:-94.274471
  },

  '172': {
    lat:17.932064,
    lng:-94.280831
  },

  '176': {
    lat:17.937503,
    lng:-94.271028
  },

  '179': {
    lat:17.966961,
    lng:-94.284103
  },

  '180': {
    lat:17.942889,
    lng:-94.300467
  },

  '201': {
    lat:17.926681,
    lng:-94.290647
  },

  '207': {
    lat:17.924742,
    lng:-94.293919
  },

  '352': { lat:17.937386, lng:-94.292839 },

  '505': { lat:17.946683, lng:-94.289367 },

  '500': { lat:17.959172, lng:-94.287736 },

  '376': {
    lat:17.927106,
    lng:-94.292572
  },

  '377': {
    lat:17.926603,
    lng:-94.287797
  },

  '385': {
    lat:17.923300,
    lng:-94.292781
  },

  '401': {
    lat:17.935633,
    lng:-94.287222
  },

  '601': {
    lat:17.952008,
    lng:-94.264047
  },

  '602': {
    lat:17.951783,
    lng:-94.263978
  },

  '603': {
    lat:17.957717,
    lng:-94.291701
  }

});


async function coordenadasPozo(pozo){

  pozo =
    limpiarPozo(pozo);


  if(!pozo){
    return null;
  }


  /*
   * Primero revisar caché.
   */
  if(cacheCoords.has(pozo)){

    const coordsCache =
      cacheCoords.get(pozo);

    /*
     * Solo reutilizar coordenadas válidas.
     * Un null antiguo no debe impedir que un pozo
     * recién agregado consulte la tabla oficial.
     */
    if(
      coordsCache &&
      Number.isFinite(Number(coordsCache.lat)) &&
      Number.isFinite(Number(coordsCache.lng))
    ){
      return coordsCache;
    }

    cacheCoords.delete(pozo);
  }


  /*
   * Ahora UPV utiliza directamente
   * las coordenadas oficiales.
   */
  const referencia =
    COORD_POZOS_FT[pozo];


  if(!referencia){

    console.warn(
      '[UPV GPS] Sin coordenadas oficiales:',
      pozo
    );

    /*
     * No guardar resultados negativos en caché.
     * Si posteriormente se agrega el pozo a la tabla
     * oficial podrá resolverse inmediatamente.
     */
    cacheCoords.delete(pozo);

    return null;
  }


  const coords = {

    lat:Number(
      referencia.lat
    ),

    lng:Number(
      referencia.lng
    )

  };


  cacheCoords.set(
    pozo,
    coords
  );


  console.log(
    '[UPV GPS] Coordenadas oficiales',
    pozo,
    coords
  );


  return coords;
}


/* ==========================================================
   VALIDAR POZO
   ========================================================== */

async function validarPozo(pozo){

  pozo =
    limpiarPozo(pozo);


  const gps =
    await capturarGPS();


  const referencia =
    await coordenadasPozo(pozo);


  if(!referencia){

    return {

      tipo:'POZO',

      pozo,

      lat:gps.lat,
      lng:gps.lng,

      accuracy:
        gps.accuracy,

      dentro:null,

      distancia:null,

      referenciaDisponible:false

    };
  }


  const distancia =
    distanciaMetros(
      gps.lat,
      gps.lng,
      referencia.lat,
      referencia.lng
    );


  return {

    tipo:'POZO',

    pozo,

    lat:gps.lat,
    lng:gps.lng,

    accuracy:
      gps.accuracy,

    destinoLat:
      referencia.lat,

    destinoLng:
      referencia.lng,

    distancia,

    dentro:
      distancia <= RADIO_POZO_M,

    referenciaDisponible:true

  };
}


/* ==========================================================
   GPS SIN POZO
   PIA / ECO / BASE / BCS
   ========================================================== */

async function validarGeneral(){

  const gps =
    await capturarGPS();


  return {

    tipo:'GENERAL',

    lat:gps.lat,
    lng:gps.lng,

    accuracy:
      gps.accuracy

  };
}



async function validarReferenciaActual(
  ubicacion,
  pozo
){

  /*
   * NO captura una posición nueva.
   * Usa exclusivamente el GPS continuo ya disponible.
   */
  const gps =
    gpsCacheValidoUPV();

  if(!gps){
    return {
      error:'GPS no disponible',
      referencia:
        String(ubicacion || '').trim().toUpperCase(),
      dentro:null,
      distancia:null
    };
  }


  const tipoReferencia =
    String(ubicacion || '')
      .trim()
      .toUpperCase();

  let referenciaNombre =
    tipoReferencia;


  if(tipoReferencia === 'POZO'){

    referenciaNombre =
      limpiarPozo(pozo);

  }


  if(!referenciaNombre){

    return {
      error:'Referencia GPS no disponible',
      lat:gps.lat,
      lng:gps.lng,
      accuracy:gps.accuracy,
      dentro:null,
      distancia:null
    };

  }


  const referencia =
    await coordenadasPozo(
      referenciaNombre
    );


  if(!referencia){

    return {
      tipo:
        tipoReferencia === 'POZO'
          ? 'POZO'
          : 'REFERENCIA',
      referencia:referenciaNombre,
      lat:gps.lat,
      lng:gps.lng,
      accuracy:gps.accuracy,
      dentro:null,
      distancia:null,
      referenciaDisponible:false
    };

  }


  const distancia =
    distanciaMetros(
      gps.lat,
      gps.lng,
      referencia.lat,
      referencia.lng
    );


  return {
    tipo:
      tipoReferencia === 'POZO'
        ? 'POZO'
        : 'REFERENCIA',
    referencia:referenciaNombre,

    lat:gps.lat,
    lng:gps.lng,
    accuracy:gps.accuracy,

    destinoLat:referencia.lat,
    destinoLng:referencia.lng,

    distancia,

    dentro:
      distancia <= RADIO_POZO_M,

    referenciaDisponible:true
  };

}


function obtenerGPSActual(){

  const gps =
    gpsCacheValidoUPV();

  if(!gps){
    return null;
  }

  return {
    lat:Number(gps.lat),
    lng:Number(gps.lng),
    accuracy:Number(gps.accuracy),
    timestamp:Number(gps.timestamp)
  };
}


window.UPVGPS = {

  RADIO_POZO_M,

  obtenerGPSActual,

  validarReferenciaActual,

  validarPozo,

  validarGeneral,

  capturarGPS,

  distanciaMetros,

  limpiarPozo

};

})();
