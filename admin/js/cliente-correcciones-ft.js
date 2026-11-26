'use strict';

/*
 * CLIENTE_CORRECCIONES_FT_943
 * Preparado para Firebase Authentication.
 * Sin escrituras habilitadas.
 */

(function(){

  const CONFIG=Object.freeze({
    endpoint: '/api/ft/correcciones',
    escrituraHabilitada:false
  });

  async function obtenerToken(){
    const usuario=window.firebase?.auth?.()
      ?.currentUser;

    if(!usuario){
      throw new Error('FT_ADMIN_SIN_SESION');
    }

    if(typeof usuario.getIdToken!=='function'){
      throw new Error('FT_TOKEN_NO_DISPONIBLE');
    }

    return usuario.getIdToken();
  }

  /* CLIENTE_FT_LISTADO_957 */
  async function listar(){

    if(!CONFIG.endpoint){
      throw new Error('FT_ENDPOINT_NO_CONFIGURADO');
    }

    const token=await obtenerToken();

    const respuesta=await fetch(CONFIG.endpoint,{
      method:'GET',
      headers:{
        Authorization:'Bearer '+token,
        Accept:'application/json'
      },
      cache:'no-store'
    });

    if(!respuesta.ok){
      throw new Error('FT_CONSULTA_RECHAZADA');
    }

    const resultado=await respuesta.json();

    if(!Array.isArray(resultado.correcciones)){
      throw new Error('FT_RESPUESTA_INVALIDA');
    }

    return resultado.correcciones;
  }

  async function guardar(datos){

    if(CONFIG.escrituraHabilitada!==true){
      throw new Error('FT_GUARDADO_DESHABILITADO');
    }

    if(!CONFIG.endpoint){
      throw new Error('FT_ENDPOINT_NO_CONFIGURADO');
    }

    const token=await obtenerToken();

    const respuesta=await fetch(CONFIG.endpoint,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer '+token
      },
      body:JSON.stringify(datos)
    });

    if(!respuesta.ok){
      throw new Error('FT_ERROR_GUARDADO');
    }

    return respuesta.json();
  }

  window.ClienteCorreccionesFT=Object.freeze({
    listar,
    guardar,
    obtenerToken,
    escrituraHabilitada:CONFIG.escrituraHabilitada
  });

})();
