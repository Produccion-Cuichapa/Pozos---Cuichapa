/* ==========================================================
 * REGLA CENTRAL DE AFORO
 *
 * Reconoce:
 * 1. Nueva función independiente de Aforo.
 * 2. Reporte de visita con ✅ Aforo.
 * 3. Reporte de visita con ✅ Aforo / Proyección.
 * 4. Registros antiguos cuyo modo quedó guardado como C.O.,
 *    pero cuyo mensaje realmente es AFORO / PROYECCIÓN.
 * ========================================================== */
(function instalarAforoUtils(){
  'use strict';

  if(window.AforoUtils){
    return;
  }

  function quitarAcentos(valor){
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function normalizar(valor){
    return quitarAcentos(valor)
      .replace(/\*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function textoCompleto(reporte){
    if(!reporte || typeof reporte !== 'object'){
      return normalizar(reporte);
    }

    var partes = [
      reporte.modo,
      reporte.mode,
      reporte.tipo,
      reporte.tipoReporte,
      reporte.reportType,
      reporte.msg,
      reporte.mensaje,
      reporte.message,
      reporte.texto,
      reporte.observaciones,
      reporte.obs,
      reporte.descripcion
    ];

    try{
      partes.push(JSON.stringify({
        aforo: reporte.aforo,
        aforoData: reporte.aforoData,
        datosAforo: reporte.datosAforo,
        resultadoAforo: reporte.resultadoAforo,
        registroAforo: reporte.registroAforo,
        checks: reporte.checks,
        registro: reporte.registro
      }));
    }catch(error){
      /* No bloquear la identificación por un objeto irregular. */
    }

    return normalizar(
      partes.filter(Boolean).join('\n')
    );
  }

  function modoAforo(reporte){
    var modo = normalizar(
      reporte && (
        reporte.modo ||
        reporte.mode ||
        reporte.tipo ||
        reporte.tipoReporte ||
        reporte.reportType
      )
    );

    return (
      modo === 'AFORO' ||
      modo === 'AFORO PROYECCION' ||
      modo === 'AFORO/PROYECCION' ||
      modo === 'PROYECCION'
    );
  }

  function tieneDatosAforo(reporte){
    if(!reporte || typeof reporte !== 'object'){
      return false;
    }

    return Boolean(
      reporte.aforoData ||
      reporte.datosAforo ||
      reporte.resultadoAforo ||
      reporte.registroAforo ||
      (
        reporte.aforo &&
        typeof reporte.aforo === 'object'
      )
    );
  }

  function esMensajeAforoIndependiente(texto){
    return (
      /(^|\s)AFORO\s*\/\s*PROYECCION(\s|$)/.test(texto) &&
      (
        texto.includes('NIVEL INICIAL') ||
        texto.includes('NIVEL FINAL') ||
        texto.includes('BPH')
      )
    );
  }

  function tieneCheckAforo(texto){
    return (
      /✅\s*AFORO\b/.test(texto) ||
      /✅\s*AFORO\s*\/\s*PROYECCION\b/.test(texto) ||
      /✅\s*PROYECCION\s*\/\s*AFORO\b/.test(texto)
    );
  }

  function esActividadAforo(reporte){
    var texto = textoCompleto(reporte);

    return Boolean(
      modoAforo(reporte) ||
      tieneDatosAforo(reporte) ||
      tieneCheckAforo(texto) ||
      esMensajeAforoIndependiente(texto)
    );
  }

  /*
   * Determina si el reporte pertenece a la nueva pantalla
   * independiente de Aforo, no únicamente a un check dentro
   * de un Reporte de Visita.
   */
  function esReporteAforoIndependiente(reporte){
    var texto = textoCompleto(reporte);

    return Boolean(
      modoAforo(reporte) ||
      tieneDatosAforo(reporte) ||
      esMensajeAforoIndependiente(texto)
    );
  }

  window.AforoUtils = Object.freeze({
    normalizar: normalizar,
    textoCompleto: textoCompleto,
    esActividadAforo: esActividadAforo,
    esReporteAforoIndependiente:
      esReporteAforoIndependiente
  });

  console.log(
    '[AFORO] Regla central instalada'
  );
})();
