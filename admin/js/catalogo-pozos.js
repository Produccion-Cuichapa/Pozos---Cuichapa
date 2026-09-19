(function(){
  'use strict';

  /*
   * CATÁLOGO MAESTRO DE POZOS
   *
   * Fuente:
   * REPORTE INTEGRAL POZOS.xlsx
   *
   * Reglas:
   * BATERIA   → BSC
   * FRAC TANK → FT
   *
   * Toda la plataforma deberá consultar este catálogo.
   */

  const registros = [
    {pozo:'101',  destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'FY'},
    {pozo:'108',  destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'FY'},
    {pozo:'106D', destino:'FT',  tipo:'FT',  estatus:'OPERANDO', sap:'BN'},
    {pozo:'107',  destino:'FT',  tipo:'FT',  estatus:'OPERANDO', sap:'BN'},
    {pozo:'119',  destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'BN'},
    {pozo:'124D', destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'FY'},
    {pozo:'128',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'131',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'137',  destino:'FT',  tipo:'FT',  estatus:'CERRADO',  sap:'BN'},
    {pozo:'138',  destino:'FT',  tipo:'FT',  estatus:'CERRADO',  sap:'BN'},
    {pozo:'139',  destino:'FT',  tipo:'FT',  estatus:'OPERANDO', sap:'BN'},
    {pozo:'167',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'169',  destino:'FT',  tipo:'FT',  estatus:'CERRADO',  sap:'BN'},
    {pozo:'172',  destino:'FT',  tipo:'FT',  estatus:'OPERANDO', sap:'BN'},
    {pozo:'176',  destino:'FT',  tipo:'FT',  estatus:'CERRADO',  sap:'BN'},
    {pozo:'179',  destino:'FT',  tipo:'FT',  estatus:'OPERANDO', sap:'BM'},
    {pozo:'180',  destino:'FT',  tipo:'FT',  estatus:'CERRADO',  sap:'BM'},
    {pozo:'187',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'19',   destino:'FT',  tipo:'FT',  estatus:'CERRADO',  sap:'FY'},
    {pozo:'191',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'201',  destino:'FT',  tipo:'FT',  estatus:'CERRADO',  sap:'BN'},
    {pozo:'207',  destino:'FT',  tipo:'FT',  estatus:'CERRADO',  sap:'FY'},
    {pozo:'213',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},

    {
      pozo:'306',
      destino:'SIN_DEFINIR',
      tipo:'ESPECIAL',
      estatus:'CERRADO',
      sap:''
    },

    {pozo:'324',  destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'FY'},
    {pozo:'326',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'FY'},
    {pozo:'327',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'FY'},
    {pozo:'328',  destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'FY'},
    {pozo:'331',  destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'BN'},
    {pozo:'342',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'FY'},
    {pozo:'343',  destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'BN'},
    {pozo:'346',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'FY'},
    {pozo:'350',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'FY'},
    {pozo:'352',  destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'FY'},
    {pozo:'356',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'359',  destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'BN'},
    {pozo:'363',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'364',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'367',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'373',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'376',  destino:'FT',  tipo:'FT',  estatus:'OPERANDO', sap:'BN'},
    {pozo:'377',  destino:'FT',  tipo:'FT',  estatus:'CERRADO',  sap:'FY'},
    {pozo:'385',  destino:'FT',  tipo:'FT',  estatus:'OPERANDO', sap:'BN'},
    {pozo:'401',  destino:'FT',  tipo:'FT',  estatus:'OPERANDO', sap:'FY'},
    {pozo:'500',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'502',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'504',  destino:'BSC', tipo:'BSC', estatus:'OPERANDO', sap:'BN'},
    {pozo:'505',  destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'BM/FY'},
    {pozo:'507',  destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'BN'},
    {pozo:'513',  destino:'BSC', tipo:'BSC', estatus:'CERRADO',  sap:'BN'},
    {pozo:'601',  destino:'FT',  tipo:'FT',  estatus:'OPERANDO', sap:'FY'},
    {pozo:'602',  destino:'FT',  tipo:'FT',  estatus:'CERRADO',  sap:'BN'},
    {pozo:'603',  destino:'FT',  tipo:'FT',  estatus:'ABIERTO',  sap:'BM'},

    {
      pozo:'224',
      destino:'ESTACION_C',
      tipo:'ESTACION',
      estatus:'ABIERTO',
      sap:'INY'
    },
    {
      pozo:'197',
      destino:'ESTACION_C',
      tipo:'ESTACION',
      estatus:'ABIERTO',
      sap:'INY'
    },
    {
      pozo:'344',
      destino:'ESTACION_C',
      tipo:'ESTACION',
      estatus:'CERRADO',
      sap:'INY'
    },
    {
      pozo:'333',
      destino:'ESTACION_B',
      tipo:'ESTACION',
      estatus:'ABIERTO',
      sap:'INY'
    },
    {
      pozo:'339',
      destino:'ESTACION_B',
      tipo:'ESTACION',
      estatus:'ABIERTO',
      sap:'INY'
    },
    {
      pozo:'181',
      destino:'ESTACION_B',
      tipo:'ESTACION',
      estatus:'ABIERTO',
      sap:'INY'
    },
    {
      pozo:'182',
      destino:'ESTACION_B',
      tipo:'ESTACION',
      estatus:'CERRADO',
      sap:'INY'
    }
  ];

  function normalizarPozo(valor){
    const limpio=String(valor || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/\bCUICHAPA\b/g,'')
      .replace(/\bPOZO\b/g,'')
      .replace(/\bPZO\b/g,'')
      .replace(/[^0-9A-Z]/g,'');

    const encontrado=limpio.match(/[0-9]{1,3}[A-Z]?/);

    return encontrado
      ? encontrado[0]
      : '';
  }

  const mapa=Object.freeze(
    registros.reduce((resultado,registro)=>{
      resultado[registro.pozo]=Object.freeze({...registro});
      return resultado;
    },{})
  );

  const ids=Object.freeze(
    registros.map(registro=>registro.pozo)
  );

  const permitidos=new Set(ids);

  function existe(valor){
    return permitidos.has(normalizarPozo(valor));
  }

  function obtener(valor){
    const pozo=normalizarPozo(valor);
    return mapa[pozo] || null;
  }

  function filtrarReportes(reportes,obtenerPozo){
    if(!Array.isArray(reportes)){
      return [];
    }

    return reportes.filter(reporte=>{
      let valor='';

      if(typeof obtenerPozo === 'function'){
        valor=obtenerPozo(reporte);
      }else{
        valor=
          reporte?.pozo ||
          reporte?.pozoNombre ||
          reporte?.well ||
          reporte?.wellName ||
          reporte?.numeroPozo ||
          reporte?.numPozo ||
          reporte?.lugar ||
          '';
      }

      return existe(valor);
    });
  }

  window.CatalogoPozos=Object.freeze({
    registros:Object.freeze(
      registros.map(registro=>Object.freeze({...registro}))
    ),
    mapa,
    ids,
    permitidos,
    total:registros.length,
    normalizarPozo,
    existe,
    obtener,
    filtrarReportes,

    porTipo(tipo){
      const buscado=String(tipo || '').toUpperCase();

      return registros.filter(
        registro=>registro.tipo === buscado
      );
    },

    porDestino(destino){
      const buscado=String(destino || '').toUpperCase();

      return registros.filter(
        registro=>registro.destino === buscado
      );
    }
  });

  /*
   * Alias temporales para facilitar la migración de módulos.
   * Se eliminarán cuando toda la plataforma use CatalogoPozos.
   */
  window.CATALOGO_POZOS=window.CatalogoPozos.registros;
  window.CATALOGO_POZOS_MAP=window.CatalogoPozos.mapa;
  window.POZOS_PERMITIDOS=window.CatalogoPozos.permitidos;

  console.info(
    '[CATÁLOGO POZOS]',
    window.CatalogoPozos.total,
    'pozos cargados'
  );
})();
