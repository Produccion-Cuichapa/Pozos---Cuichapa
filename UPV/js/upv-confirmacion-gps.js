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

function capturarGPS(){

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


      navigator.geolocation
        .getCurrentPosition(

          pos => {

            resolve({

              lat:
                pos.coords.latitude,

              lng:
                pos.coords.longitude,

              accuracy:
                pos.coords.accuracy,

              timestamp:
                pos.timestamp || Date.now()

            });
          },


          error => {

            reject(error);

          },


          {
            enableHighAccuracy:true,
            timeout:15000,
            maximumAge:5000
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
    return cacheCoords.get(pozo);
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

    cacheCoords.set(
      pozo,
      null
    );

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


window.UPVGPS = {

  RADIO_POZO_M,

  validarPozo,

  validarGeneral,

  capturarGPS,

  distanciaMetros,

  limpiarPozo

};

})();
