/* CAPA_CORRECCIONES_FT_959 */
(function(global){
  'use strict';

  let correcciones=[];
  let cargadas=false;
  let errorConsulta=null;

  async function actualizar(){

    const cliente=global.ClienteCorreccionesFT;

    if(!cliente ||
       typeof cliente.listar!=='function'){
      errorConsulta='CLIENTE_FT_NO_DISPONIBLE';
      return false;
    }

    try{
      const resultado=await cliente.listar();

      if(!Array.isArray(resultado)){
        throw new Error('FT_LISTADO_INVALIDO');
      }

      correcciones=resultado;
      cargadas=true;
      errorConsulta=null;

      return true;

    }catch(error){
      errorConsulta=error.message;
      console.warn(
        '[CAPA_FT] Consulta no disponible:',
        errorConsulta
      );
      return false;
    }
  }

  function obtenerReportes(reportes){

    const originales=Array.isArray(reportes)
      ? reportes
      : [];

    const motor=global.MotorCorreccionesFT;

    if(!cargadas ||
       !motor ||
       typeof motor.aplicarCorrecciones!=='function'){
      return originales.slice();
    }

    return motor.aplicarCorrecciones(
      originales,
      correcciones
    );
  }

  function estado(){
    return {
      cargadas,
      total:correcciones.length,
      errorConsulta
    };
  }

  global.CapaCorreccionesFT=Object.freeze({
    actualizar,
    obtenerReportes,
    estado
  });

})(window);
