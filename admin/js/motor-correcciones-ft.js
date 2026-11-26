
/* MOTOR_CORRECCIONES_FT_876
   Módulo aislado, sin Firebase ni modificaciones
   a reportes, Balance FT o Monitoreo FT.
*/
(function(global){
  'use strict';

  const ESTADOS=['ABIERTO','CERRADO','INTERMITENTE'];

  function numero(v){
    if(v===null || v===undefined || v==='') return null;
    const n=Number(v);
    return Number.isFinite(n) && n>=0 ? n : null;
  }

  function validarCorreccion(c){
    const errores=[];

    if(!c || typeof c!=='object'){
      return {valida:false,errores:['Corrección inválida']};
    }

    if(!String(c.pozo||'').trim()){
      errores.push('Pozo obligatorio');
    }

    if(!String(c.reporteId||'').trim()){
      errores.push('Reporte original obligatorio');
    }

    if(!Number.isFinite(c.timestamp)){
      errores.push('Fecha de lectura inválida');
    }

    const campos=['nivelCm','volumenBbls','aforoBph'];
    const definidos=campos.filter(k=>
      c[k]!==null && c[k]!==undefined && c[k]!==''
    );

    for(const k of definidos){
      if(numero(c[k])===null){
        errores.push(k+' inválido');
      }
    }

    if(c.estado && !ESTADOS.includes(c.estado)){
      errores.push('Estado operativo inválido');
    }

    if(!definidos.length && !c.estado){
      errores.push('Sin datos de corrección');
    }

    if(String(c.motivo||'').trim().length<10){
      errores.push('Motivo insuficiente');
    }

    return {valida:errores.length===0,errores};
  }

  function proyectar({
    volumenBase,
    inicio,
    fin,
    bphInicial=0,
    estadoInicial='ABIERTO',
    eventos=[],
    retiros=[]
  }){
    const base=numero(volumenBase);

    if(base===null ||
       !Number.isFinite(inicio) ||
       !Number.isFinite(fin) ||
       fin<inicio ||
       numero(bphInicial)===null ||
       !ESTADOS.includes(estadoInicial)){
      throw new Error('Parámetros de proyección inválidos');
    }

    const ordenados=eventos
      .filter(e=>Number.isFinite(e.timestamp))
      .filter(e=>e.timestamp>inicio && e.timestamp<=fin)
      .sort((a,b)=>a.timestamp-b.timestamp);

    let volumen=base;
    let anterior=inicio;
    let bph=bphInicial;
    let estado=estadoInicial;

    function integrar(hasta){
      const horas=(hasta-anterior)/3600000;
      if(estado==='ABIERTO'){
        volumen+=horas*bph;
      }
      anterior=hasta;
    }

    for(const e of ordenados){
      integrar(e.timestamp);

      if(e.bph!==undefined && e.bph!==null){
        const nuevo=numero(e.bph);
        if(nuevo===null) throw new Error('BPH inválido');
        bph=nuevo;
      }

      if(e.estado!==undefined && e.estado!==null){
        if(!ESTADOS.includes(e.estado)){
          throw new Error('Estado inválido');
        }
        estado=e.estado;
      }
    }

    integrar(fin);

    /* MOTOR_FT_ANTIDUPLICADOS_879 */
    const retirosProcesados=new Map();

    for(const r of retiros){
      if(!Number.isFinite(r.timestamp) ||
         r.timestamp<=inicio ||
         r.timestamp>fin){
        continue;
      }

      const cantidad=numero(r.bbls);

      if(cantidad===null){
        throw new Error('Retiro inválido');
      }

      const id=String(r.id ?? '').trim();

      if(id){
        if(retirosProcesados.has(id)){
          const previo=retirosProcesados.get(id);

          if(previo.timestamp!==r.timestamp ||
             previo.bbls!==cantidad){
            throw new Error(
              'Retiro duplicado con datos diferentes: '+id
            );
          }

          continue;
        }

        retirosProcesados.set(id,{
          timestamp:r.timestamp,
          bbls:cantidad
        });
      }

      volumen-=cantidad;
    }

    return {
      volumenBbls:Math.max(0,volumen),
      estadoFinal:estado,
      bphFinal:bph,
      calculo:'AISLADO_SIN_TRANSFERENCIAS'
    };
  }

  /* MOTOR_FT_APLICAR_CORRECCIONES_953
     Construye copias de reportes con correcciones
     verificadas previamente por el backend.
     No modifica los reportes originales.
  */
  function aplicarCorrecciones(reportes,correcciones){

    const originales=Array.isArray(reportes)
      ? reportes
      : [];

    const lista=Array.isArray(correcciones)
      ? correcciones
      : [];

    const ultimas=new Map();

    const ordenadas=lista
      .filter(c=>
        c &&
        c.estadoRegistro==='ACTIVO' &&
        String(c.reporteId||'').trim() &&
        Number.isFinite(Date.parse(c.creadoEn||''))
      )
      .sort((a,b)=>
        Date.parse(a.creadoEn)-
        Date.parse(b.creadoEn)
      );

    for(const c of ordenadas){
      const id=String(c.reporteId).trim();
      const previo=ultimas.get(id)||{};

      const acumulada={...previo,...c};

      for(const campo of [
        'nivelCm','volumenBbls','aforoBph',
        'estado','timestamp','fecha','hora'
      ]){
        if(c[campo]===null ||
           c[campo]===undefined ||
           c[campo]===''){
          if(previo[campo]!==undefined){
            acumulada[campo]=previo[campo];
          }
        }
      }

      ultimas.set(id,acumulada);
    }

    return originales.map(r=>{

      if(!r || !r.id){
        return r;
      }

      const c=ultimas.get(String(r.id));

      if(!c){
        return r;
      }

      const copia={...r};

      // No sustituir todavía el esquema original
      // utilizado por los cálculos operativos.
      copia.correccionFT={
        id:c.id||null,
        nivelCm:c.nivelCm??c.nivel??null,
        volumenBbls:c.volumenBbls??c.volumen??null,
        aforoBph:c.aforoBph??c.bph??null,
        estado:c.estado??null,
        motivo:c.motivo||'',
        /* MOTOR_CONTRATO_FECHA_970 */
        timestamp:(c.timestamp!==null &&
             c.timestamp!==undefined &&
             c.timestamp!=='' &&
             Number.isFinite(Number(c.timestamp)))
          ? Number(c.timestamp)
          : null,
        fecha:c.fecha??(
          (c.timestamp!==null &&
             c.timestamp!==undefined &&
             c.timestamp!=='' &&
             Number.isFinite(Number(c.timestamp)))
            ? new Date(Number(c.timestamp)-21600000)
                .toISOString().slice(0,10)
            : null
        ),
        hora:c.hora??(
          (c.timestamp!==null &&
             c.timestamp!==undefined &&
             c.timestamp!=='' &&
             Number.isFinite(Number(c.timestamp)))
            ? new Date(Number(c.timestamp)-21600000)
                .toISOString().slice(11,16)
            : null
        ),
        creadoEn:c.creadoEn
      };

      return copia;
    });
  }

  global.MotorCorreccionesFT={
    validarCorreccion,
    proyectar,
    aplicarCorrecciones
  };

})(typeof window!=='undefined' ? window : globalThis);
