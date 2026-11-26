/* SINCRONIZACION_CORRECCIONES_FT_1010 */
(function(global){
  'use strict';

  let actualizando=false;
  let ultimaActualizacion=null;
  let ultimoError=null;

  const CONFIG=Object.freeze({
    habilitada:true
  });

  async function actualizar(){

    if(!CONFIG.habilitada){
      return {
        actualizado:false,
        motivo:'SINCRONIZACION_DESHABILITADA'
      };
    }

    if(actualizando){
      return {
        actualizado:false,
        motivo:'CONSULTA_EN_PROGRESO'
      };
    }

    const capa=global.CapaCorreccionesFT;

    if(!capa ||
       typeof capa.actualizar!=='function'){
      return {
        actualizado:false,
        motivo:'CAPA_NO_DISPONIBLE'
      };
    }

    actualizando=true;

    try{
      const correcto=await capa.actualizar();

      if(!correcto){
        ultimoError=capa.estado()?.errorConsulta ||
          'CONSULTA_FALLIDA';

        return {
          actualizado:false,
          motivo:ultimoError
        };
      }

      ultimaActualizacion=new Date().toISOString();
      ultimoError=null;

      if(global.MonitoreoFT?.render){
        global.MonitoreoFT.render();
      }


      return {
        actualizado:true,
        fecha:ultimaActualizacion
      };

    }catch(error){
      ultimoError=error.message;

      return {
        actualizado:false,
        motivo:ultimoError
      };

    }finally{
      actualizando=false;
    }
  }

  function estado(){
    return {
      habilitada:CONFIG.habilitada,
      actualizando,
      ultimaActualizacion,
      ultimoError
    };
  }

  global.SincronizacionCorreccionesFT=Object.freeze({
    actualizar,
    estado
  });

})(window);
