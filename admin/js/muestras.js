/* ============================================================
   MUESTRAS — CONTROL MENSUAL
   ============================================================ */

(function(){

'use strict';

const M = {

  fecha:new Date(),

  recorredor:'',
  pozo:''

};


/* ============================================================
   TEXTO
   ============================================================ */

function normalizar(v){

  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .trim()
    .toUpperCase();

}


/* ============================================================
   FUENTE
   ============================================================ */

function obtenerFuente(){

  const candidatos = [

    window.AdminFirebase?.reportes,

    window.AdminData?.reportes,

    window.reportes,

    window.reportesCache,

    window.todosLosReportes

  ];

  for(const x of candidatos){

    if(
      Array.isArray(x) &&
      x.length
    ){
      return x;
    }

  }

  return [];

}


/* ============================================================
   ¿ES MUESTRA?
   ============================================================ */

function esMuestra(r){

  if(!r){
    return false;
  }

  const modo =
    normalizar(
      r.modo ||
      r.tipo ||
      r.tipoReporte
    );

  const msg =
    normalizar(
      r.msg ||
      r.mensaje ||
      r.message ||
      r.texto
    );

  return (
    modo.includes('MUESTRA') ||
    modo.includes('MUESTREO') ||
    msg.includes('MUESTRA') ||
    msg.includes('MUESTREO')
  );

}


/* ============================================================
   TIMESTAMP
   ============================================================ */

function timestamp(r){

  const id =
    Number(r?.id);

  if(
    Number.isFinite(id) &&
    id > 1000000000000
  ){
    return id;
  }


  const nums = [

    r?.timestamp,
    r?.ts,
    r?.createdAt,
    r?.fechaMs

  ];


  for(let n of nums){

    n = Number(n);

    if(!Number.isFinite(n)){
      continue;
    }

    if(
      n > 1000000000 &&
      n < 100000000000
    ){
      n *= 1000;
    }

    if(n > 1000000000000){
      return n;
    }

  }


  const fecha =
    r?.fechaHora ||
    r?.datetime ||
    r?.fecha ||
    '';

  const d =
    new Date(fecha);

  if(!Number.isNaN(d.getTime())){
    return d.getTime();
  }


  return null;

}


/* ============================================================
   CAMPOS
   ============================================================ */

function persona(r){

  return String(
    r?.recorredor ||
    r?.usuario ||
    r?.nombreRecorredor ||
    r?.operador ||
    ''
  ).trim();

}


function pozo(r){

  let p =
    r?.pozo ||
    r?.pozoNombre ||
    r?.numeroPozo ||
    r?.well ||
    r?.lugar ||
    '';

  p = String(p).trim();

  p = p
    .replace(/^POZO\s*/i,'')
    .replace(/^C-/i,'');

  return p || '—';

}


function observacion(r){

  return String(
    r?.observaciones ||
    r?.observacion ||
    r?.obs ||
    ''
  ).trim();

}


/* ============================================================
   DATOS NORMALIZADOS
   ============================================================ */

function datos(){

  const normalizados =
    obtenerFuente()

      .filter(esMuestra)

      .map(function(r){

        const ts =
          timestamp(r);

        if(!ts){
          return null;
        }

        return {

          source:r,

          ts,

          fecha:new Date(ts),

          recorredor:persona(r),

          pozo:pozo(r),

          obs:observacion(r)

        };

      })

      .filter(Boolean)

      .sort(
        (a,b) => b.ts-a.ts
      );


  /*
   * REGLA OPERATIVA:
   * un pozo solo cuenta una vez por día.
   *
   * Como normalizados está ordenado de más nuevo a más viejo,
   * conservamos el último registro del día.
   */
  const vistos = new Set();

  return normalizados.filter(function(r){

    const fechaKey =
      [
        r.fecha.getFullYear(),
        String(
          r.fecha.getMonth()+1
        ).padStart(2,'0'),
        String(
          r.fecha.getDate()
        ).padStart(2,'0')
      ].join('-');


    const pozoKey =
      normalizar(
        r.pozo
      );


    const key =
      fechaKey +
      '|' +
      pozoKey;


    if(
      vistos.has(key)
    ){
      return false;
    }


    vistos.add(key);

    return true;

  });

}


/* ============================================================
   FILTRAR MES
   ============================================================ */

function filtrados(){

  const y =
    M.fecha.getFullYear();

  const m =
    M.fecha.getMonth();


  return datos().filter(function(r){

    if(
      r.fecha.getFullYear() !== y ||
      r.fecha.getMonth() !== m
    ){
      return false;
    }

    if(
      M.recorredor &&
      r.recorredor !== M.recorredor
    ){
      return false;
    }

    if(
      M.pozo &&
      r.pozo !== M.pozo
    ){
      return false;
    }

    return true;

  });

}


/* ============================================================
   TITULO
   ============================================================ */

function tituloMes(){

  return M.fecha
    .toLocaleDateString(
      'es-MX',
      {
        month:'long',
        year:'numeric'
      }
    )
    .replace(
      /^./,
      c => c.toUpperCase()
    );

}


/* ============================================================
   SELECTS
   ============================================================ */

function llenarFiltros(){

  const base =
    datos();

  const personas =
    [...new Set(
      base
        .map(r => r.recorredor)
        .filter(Boolean)
    )]
    .sort();


  const pozos =
    [...new Set(
      base
        .map(r => r.pozo)
        .filter(Boolean)
    )]
    .sort(
      (a,b) =>
        a.localeCompare(
          b,
          undefined,
          {numeric:true}
        )
    );


  const sp =
    document.getElementById(
      'muestrasFiltroRecorredor'
    );

  const sw =
    document.getElementById(
      'muestrasFiltroPozo'
    );


  if(sp){

    const actual = sp.value;

    sp.innerHTML =
      '<option value="">Todos los recorredores</option>' +
      personas
        .map(
          x =>
            '<option value="' +
            x.replace(/"/g,'&quot;') +
            '">' +
            x +
            '</option>'
        )
        .join('');

    sp.value = actual;

  }


  if(sw){

    const actual = sw.value;

    sw.innerHTML =
      '<option value="">Todos los pozos</option>' +
      pozos
        .map(
          x =>
            '<option value="' +
            x.replace(/"/g,'&quot;') +
            '">' +
            x +
            '</option>'
        )
        .join('');

    sw.value = actual;

  }

}


/* ============================================================
   RENDER
   ============================================================ */

function render(){

  const filas =
    filtrados();


  const titulo =
    document.getElementById(
      'muestrasMesTitulo'
    );

  if(titulo){
    titulo.textContent =
      tituloMes();
  }


  const total =
    document.getElementById(
      'muestrasKpiTotal'
    );

  if(total){
    total.textContent =
      filas.length;
  }


  const kp =
    document.getElementById(
      'muestrasKpiPozos'
    );

  if(kp){

    kp.textContent =
      new Set(
        filas.map(r => r.pozo)
      ).size;

  }


  const ku =
    document.getElementById(
      'muestrasKpiUltima'
    );

  if(ku){

    ku.textContent =
      filas.length
        ? filas[0].fecha
            .toLocaleTimeString(
              'es-MX',
              {
                hour:'2-digit',
                minute:'2-digit'
              }
            )
        : '—';

  }


  const cont =
    document.getElementById(
      'muestrasTimeline'
    );

  if(!cont){
    return;
  }


  if(!filas.length){

    cont.innerHTML =
      '<div class="muestras-empty">' +
      'No hay muestras registradas para este mes.' +
      '</div>';

    return;

  }


  const grupos = {};


  filas.forEach(function(r){

    const key =
      [
        r.fecha.getFullYear(),
        String(
          r.fecha.getMonth()+1
        ).padStart(2,'0'),
        String(
          r.fecha.getDate()
        ).padStart(2,'0')
      ].join('-');

    if(!grupos[key]){
      grupos[key] = [];
    }

    grupos[key].push(r);

  });


  cont.innerHTML =
    Object.keys(grupos)

      .sort()
      .reverse()

      .map(function(key){

        const arr =
          grupos[key];


        const fecha =
          arr[0].fecha;


        const etiqueta =
          String(
            fecha.getDate()
          ).padStart(2,'0') +
          ' ' +
          fecha
            .toLocaleDateString(
              'es-MX',
              {month:'short'}
            )
            .replace('.','')
            .toUpperCase();


        return (
          '<section class="muestras-dia">' +

            '<span class="muestras-fecha">' +
              etiqueta +
            '</span>' +

            '<div class="muestras-dia-lista">' +

              arr.map(function(r){

                const hora =
                  r.fecha
                    .toLocaleTimeString(
                      'es-MX',
                      {
                        hour:'2-digit',
                        minute:'2-digit'
                      }
                    );


                const obsClass =
                  r.obs
                    ? ' con-obs'
                    : '';


                return (
                  '<article class="muestras-item' +
                    obsClass +
                  '">' +

                    '<span class="muestras-hora">' +
                      hora +
                    '</span>' +

                    '<i class="muestras-item-dot"></i>' +

                    '<strong class="muestras-pozo">' +
                      r.pozo +
                    '</strong>' +

                    '<span class="muestras-recorredor">' +
                      (
                        r.recorredor ||
                        'Sin recorredor'
                      ) +
                    '</span>' +

                    '<span class="muestras-detalle">' +
                      (
                        r.obs ||
                        'Muestra realizada'
                      ) +
                    '</span>' +

                  '</article>'
                );

              }).join('') +

            '</div>' +

          '</section>'
        );

      })
      .join('');

}


/* ============================================================
   NAVEGACIÓN
   ============================================================ */

function abrir(){

  const prod =
    document.getElementById(
      'pozosView'
    );

  const vista =
    document.getElementById(
      'muestrasSubView'
    );

  if(prod){
    prod.classList.add('hidden');
  }

  if(vista){
    vista.classList.remove('hidden');
  }

  llenarFiltros();
  render();

}


function volver(){

  const prod =
    document.getElementById(
      'pozosView'
    );

  const vista =
    document.getElementById(
      'muestrasSubView'
    );

  if(vista){
    vista.classList.add('hidden');
  }

  if(prod){
    prod.classList.remove('hidden');
  }

}


/* ============================================================
   EVENTOS
   ============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  function(){

    document
      .getElementById(
        'btnAbrirMuestras'
      )
      ?.addEventListener(
        'click',
        abrir
      );


    document
      .getElementById(
        'btnVolverProduccionMuestras'
      )
      ?.addEventListener(
        'click',
        volver
      );


    document
      .getElementById(
        'muestrasMesAnterior'
      )
      ?.addEventListener(
        'click',
        function(){

          M.fecha =
            new Date(
              M.fecha.getFullYear(),
              M.fecha.getMonth()-1,
              1
            );

          render();

        }
      );


    document
      .getElementById(
        'muestrasMesSiguiente'
      )
      ?.addEventListener(
        'click',
        function(){

          M.fecha =
            new Date(
              M.fecha.getFullYear(),
              M.fecha.getMonth()+1,
              1
            );

          render();

        }
      );


    document
      .getElementById(
        'muestrasFiltroRecorredor'
      )
      ?.addEventListener(
        'change',
        function(e){

          M.recorredor =
            e.target.value;

          render();

        }
      );


    document
      .getElementById(
        'muestrasFiltroPozo'
      )
      ?.addEventListener(
        'change',
        function(e){

          M.pozo =
            e.target.value;

          render();

        }
      );

  }
);


window.MuestrasMensual = {
  abrir,
  render,
  datos
};

})();
