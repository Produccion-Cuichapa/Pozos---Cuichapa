(function(){
'use strict';

if(window.MonitoreoFT) return;

const ESCALA = 375;
const ALERTA = 300;
const PREVENTIVO = 250;
const ANTIGUO_MS = 4 * 60 * 60 * 1000;

function texto(v){
  return String(v ?? '');
}

function normal(v){
  return texto(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toUpperCase()
    .trim();
}

function num(v){
  if(v === null || v === undefined || v === '') return null;
  const match = texto(v).replace(/,/g,'.').match(/^[-+]?\d+(?:\.\d+)?$/);
  if(!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function esc(v){
  return texto(v)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function mensaje(r){
  return texto(
    r?.msg ||
    r?.mensaje ||
    r?.message ||
    r?.texto ||
    r?.whatsappMessage ||
    ''
  );
}

function pozo(r){
  const p =
    r?.pozo ??
    r?.pozoId ??
    r?.well ??
    r?.wellId ??
    r?.numeroPozo ??
    r?.datos?.pozo ??
    r?.nivel?.pozo ??
    r?.co?.pozo;

  if(p !== null && p !== undefined && texto(p).trim()){
    return normal(p).replace(/^POZO\s*/,'');
  }

  const m = mensaje(r).match(/\b(?:POZO|CUICHAPA)\s*[:#-]?\s*(\d{1,3}[A-Z]?)\b/i);
  return m ? normal(m[1]) : '';
}

/* MONITOREO_NIVEL_CM_CORREGIDO_965 */
function nivelCmFT(r){

  const corregido=r?.correccionFT?.nivelCm;

  if(corregido!==null && corregido!==undefined){
    const n=num(corregido);
    if(n!==null && n>=0) return n;
  }

  return null;
}

function bls(r){
  /* MONITOREO_VALORES_CORREGIDOS_963 */
  const corregido=r?.correccionFT?.volumenBbls;

  if(corregido!==null && corregido!==undefined){
    const n=num(corregido);
    if(n!==null && n>=0) return n;
  }

  const parsed = window.AdminUtils?.parseMsg?.(r) || {};
  const nivel = r?.nivel || {};
  const co = r?.co || {};

  const valores = [
    nivel.bls, nivel.BLS, nivel.bbl, nivel.BBL,
    r?.bls, r?.BLS, r?.nivelBls, r?.nivelBLS,
    co.bls, co.BLS, parsed.bls, parsed.BLS
  ];

  for(const v of valores){
    const n = num(v);
    if(n !== null && n >= 0) return n;
  }

  const m = mensaje(r).match(/\b(?:BLS|BBLS|BBL|BARRILES?)\s*[:=-]?\s*(\d+(?:[.,]\d+)?)/i);
  return m ? num(m[1]) : null;
}

function esAforo(r){
  const modo = normal(r?.modo ?? r?.tipo ?? '');
  const msg = normal(mensaje(r));

  return (
    modo.includes('AFORO') ||
    modo.includes('PROYECCION') ||
    (msg.includes('AFORO') && /\bBPH\b/.test(msg))
  );
}

function esFT(r){
  if(esAforo(r) || bls(r) === null) return false;

  const msg = normal(mensaje(r));
  const parsed = window.AdminUtils?.parseMsg?.(r) || {};

  if(/NIVELES?\s+DE\s+GUARDIA/.test(msg)){
    return true;
  }

  const flujo = normal(
    r?.co?.fluye ||
    r?.fluye ||
    parsed?.fluye ||
    ''
  );

  const flujoFT =
    flujo === 'FT' ||
    /FLUYE\s*[:=-]?\s*FT\b/.test(msg);

  const nivelFT =
    /NIVEL\s+(?:DE\s+)?(?:FRAC\s*TANK|PRESA\s*METALICA)/.test(msg);

  return flujoFT && nivelFT;
}

/* MONITOREO_FECHA_CORREGIDA_966 */
function fechaCorregidaFT(r){

  const c=r?.correccionFT;

  if(!c || !c.fecha || !c.hora){
    return null;
  }

  /* VALIDACION_FECHA_FT_967 */
  const f=String(c.fecha);
  const h=String(c.hora);

  if(!/^\d{4}-\d{2}-\d{2}$/.test(f) ||
     !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(h)){
    return null;
  }

  const valor=f+'T'+h+':00-06:00';
  const resultado=new Date(valor);

  if(Number.isNaN(resultado.getTime())){
    return null;
  }

  const partes=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Etc/GMT+6',
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
    hour:'2-digit',
    minute:'2-digit',
    hourCycle:'h23'
  }).formatToParts(resultado);

  const datos=Object.fromEntries(
    partes.map(x=>[x.type,x.value])
  );

  if(datos.year+'-'+datos.month+'-'+datos.day!==f ||
     datos.hour+':'+datos.minute!==h){
    return null;
  }

  return resultado;
}

function fecha(r){
  /* MONITOREO_FECHA_ACTIVA_971 */
  const corregida=fechaCorregidaFT(r);

  if(corregida){
    return corregida;
  }

  const t = window.AdminUtils?.getTime?.(r);

  if(Number.isFinite(t) && t > 100000000000){
    const d = new Date(t);
    if(!Number.isNaN(d.getTime())) return d;
  }

  const d = window.AdminUtils?.dateObj?.(r);
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}






function interpretarEstadoFT(r){

  if(!r || typeof r!=='object') return null;

  const corregido=normal(r?.correccionFT?.estado);

  if(['ABIERTO','CERRADO','INTERMITENTE'].includes(corregido)){
    return {
      valor:corregido,
      origen:'CORRECCION ADMINISTRATIVA FT'
    };
  }

  const motor=window.AdminPozos;

  if(motor &&
     typeof motor.reportWellState==='function'){

    const valor=motor.reportWellState(r);

    if(valor){
      return {
        valor,
        origen:'MOTOR OPERATIVO COMPARTIDO'
      };
    }
  }

  // Respaldo cuando AdminPozos no este disponible.
  const candidatos=[
    r.estadoPozo,
    r.estatusPozo,
    r.co?.estadoPozo,
    r.parsed?.estadoPozo
  ];

  for(const candidato of candidatos){

    const valor=String(candidato || '')
      .trim()
      .toUpperCase();

    if([
      'ABIERTO',
      'CERRADO',
      'INTERMITENTE',
      'TAPONADO'
    ].includes(valor)){
      return {
        valor,
        origen:'CAMPO OPERATIVO'
      };
    }
  }

  return null;
}


function obtenerEstados(reportes){
  const mapa=new Map();
  const motor=window.AdminPozos;
  const util=window.AdminUtils;

  if(!motor ||
     typeof motor.reportWell!=='function' ||
     typeof motor.reportWellState!=='function'){
    return mapa;
  }

  for(const r of reportes || []){
    const id=normal(
      motor.reportWell(r)
    ).replace(/^POZO\s*[-:#]?\s*/i,'')
     .replace(/^0+(?=\d)/,'');

    if(!id) continue;

    // Misma prioridad de fecha que utiliza el Croquis.
    const fechaObj=
      typeof util?.dateObj==='function'
        ? util.dateObj(r)
        : null;

    let tiempo=
      fechaObj instanceof Date &&
      Number.isFinite(fechaObj.getTime())
        ? fechaObj.getTime()
        : 0;

    if(!tiempo && typeof util?.getTime==='function'){
      tiempo=util.getTime(r) || 0;
    }

    if(!tiempo) continue;

    const resultado=interpretarEstadoFT(r);
    if(!resultado) continue;

    const previo=mapa.get(id);

    if(!previo || tiempo>previo.fecha.getTime()){
      mapa.set(id,{
        valor:resultado.valor,
        origen:resultado.origen,
        fecha:new Date(tiempo)
      });
    }
  }

  return mapa;
}

function obtenerLecturas(reportes){
  const mapa = new Map();
  const ahora = Date.now();

  for(const r of reportes || []){
    if(!esFT(r)) continue;

    const id = pozo(r);
    const volumen = bls(r);
    const momento = fecha(r);

    if(!id || volumen === null || !momento) continue;
    if(momento.getTime() > ahora + 5 * 60 * 1000) continue;

    const previo = mapa.get(id);

    if(!previo || momento > previo.fecha){
      mapa.set(id,{
        pozo:id,
        volumen,
        fecha:momento,
        reporte:r
      });
    }
  }

  const estados = obtenerEstados(reportes);

  const resultado = [...mapa.values()];

  for(const item of resultado){
    item.estadoPozo = estados.get(item.pozo) || null;
  }

  return resultado.sort((a,b) =>
    b.volumen - a.volumen ||
    a.pozo.localeCompare(b.pozo,'es',{numeric:true})
  );
}


/* ==========================================================
   BLOQUE 196 — PROYECCION OPERATIVA FT

   No representa medicion continua.
   No modifica datos originales.
   ========================================================== */

function obtenerBphFT(r){
  /* MONITOREO_BPH_CORREGIDO_964 */
  const corregido=r?.correccionFT?.aforoBph;

  if(corregido!==null && corregido!==undefined){
    const n=num(corregido);
    if(n!==null && n>=0){
      return n;
    }
  }



  if(!esAforo(r)) return null;

  const a =
    r?.aforoData ||
    r?.datosAforo ||
    r?.resultadoAforo ||
    r?.registroAforo ||
    r?.aforo ||
    {};

  const candidatos = [
    r?.bph,
    r?.BPH,
    a?.bph,
    a?.BPH,
    a?.barrilesHora,
    a?.barrilesPorHora,
    a?.resultado
  ];

  for(const valor of candidatos){
    const n = num(valor);
    if(n !== null && n > 0) return n;
  }

  const msg = mensaje(r);

  const m =
    msg.match(/AFORO[\s\S]{0,120}?(\d+(?:[.,]\d+)?)\s*BPH\b/i) ||
    msg.match(/(\d+(?:[.,]\d+)?)\s*BPH\b/i);

  if(!m) return null;

  const n = num(m[1]);
  return n !== null && n > 0 ? n : null;
}



function calcularProyeccionFT(item,reportes,ahora=Date.now()){

  const base = {
    volumenReal:item.volumen,
    volumenEstimado:item.volumen,
    bph:null,
    proyectando:false,
    horasProduciendo:0,
    fechaBase:item.fecha,
    motivo:'SIN PROYECCION'
  };

  const inicio=item.fecha?.getTime();

  if(!Number.isFinite(inicio) || inicio>ahora){
    base.motivo='FECHA DE LECTURA NO VALIDA';
    return base;
  }

  const datos=[];

  for(const r of reportes || []){
    if(pozo(r)!==item.pozo) continue;

    const f=fecha(r);
    if(!f) continue;

    const t=f.getTime();
    if(t>ahora) continue;

    const estado=interpretarEstadoFT(r);
    const bph=obtenerBphFT(r);

    if(estado || bph!==null){
      datos.push({
        t,
        estado:estado?.valor || null,
        bph
      });
    }
  }

  datos.sort((a,b)=>a.t-b.t);

  let estadoInicial=null;
  let aforoInicial=null;

  for(const evento of datos){
    if(evento.t>inicio) break;

    if(evento.estado){
      estadoInicial=evento.estado;
    }

    if(evento.bph!==null){
      aforoInicial=evento.bph;
    }
  }

  if(estadoInicial!=='ABIERTO'){
    base.motivo='POZO SIN APERTURA CONFIRMADA';
    return base;
  }

  let estadoActual='ABIERTO';
  let bphActual=aforoInicial;
  let ultimo=inicio;
  let incremento=0;
  let bloqueado=false;
  let huboCierre=false;

  for(const evento of datos){

    if(evento.t<=inicio) continue;

    const horas=(evento.t-ultimo)/3600000;

    if(
      estadoActual==='ABIERTO' &&
      !bloqueado &&
      bphActual!==null
    ){
      incremento+=Math.max(0,horas)*bphActual;
      base.horasProduciendo+=Math.max(0,horas);
    }

    ultimo=evento.t;

    if(evento.estado==='CERRADO'){
      estadoActual='CERRADO';
      bloqueado=true;
      huboCierre=true;
    }else if(evento.estado==='INTERMITENTE'){
      estadoActual='INTERMITENTE';
      bloqueado=true;
    }else if(evento.estado==='ABIERTO'){
      estadoActual='ABIERTO';
    }

    if(evento.bph!==null){
      bphActual=evento.bph;
    }
  }

  if(
    estadoActual==='ABIERTO' &&
    !bloqueado &&
    bphActual!==null
  ){
    const horas=Math.max(0,(ahora-ultimo)/3600000);
    incremento+=horas*bphActual;
    base.horasProduciendo+=horas;
  }

  base.volumenEstimado=Math.max(
    0,
    item.volumen+incremento
  );

  base.bph=bphActual;

  base.proyectando=(
    estadoActual==='ABIERTO' &&
    !bloqueado &&
    bphActual!==null
  );

  if(huboCierre && estadoActual==='ABIERTO'){
    base.motivo='REAPERTURA: REQUIERE NUEVA LECTURA';
  }else if(estadoActual==='CERRADO'){
    base.motivo='CIERRE: PROYECCION DETENIDA';
  }else if(estadoActual==='INTERMITENTE'){
    base.motivo='INTERMITENTE: PROYECCION DETENIDA';
  }else if(base.proyectando){
    base.motivo='PROYECCION ACTIVA';
  }else{
    base.motivo='SIN AFORO VALIDO';
  }

  return base;
}



/* ==========================================================
   BLOQUE 207 — DERIVACION ESPECIAL 601 / 602

   Solo NIVELES DE GUARDIA del 602 activa derivacion.
   REPORTE DE VISITA del 602 detiene la proyeccion.
   No cambia el estado operativo del pozo 601.
   ========================================================== */


/* ==========================================================
   DERIVACION FT 601 -> FT 602
   Aforo dinamico tomado de reportes reales del pozo 601.
   No se utilizan BPH fijos.
   ========================================================== */

function tipoReporteEspecialFT(r){
  const modo=normal(
    r?.modo || r?.tipo || r?.tipoReporte || r?.categoria || ''
  );

  const msg=normal([
    r?.mensaje,
    r?.msg,
    r?.message,
    r?.texto,
    r?.whatsappMessage
  ].filter(Boolean).join('\n'));

  if(
    /NIVELES?\s+DE\s+GUARDIA/.test(msg) ||
    /NIVELES?\s+DE\s+GUARDIA/.test(modo)
  ) return 'GUARDIA';

  if(
    /REPORTE\s+DE\s+VISITA/.test(msg) ||
    /REPORTE\s+DE\s+VISITA/.test(modo)
  ) return 'VISITA';

  if(esAforo(r)) return 'AFORO';

  return 'OTRO';
}

function calcularDerivacion601602(lecturas,reportes,ahora){

  const mapa=new Map(lecturas.map(x=>[x.pozo,x]));
  const ft601=mapa.get('601');
  const ft602=mapa.get('602');

  if(!ft601 || !ft602) return lecturas;

  const eventos=[];

  for(const r of reportes || []){
    const id=pozo(r);
    if(id!=='601' && id!=='602') continue;

    const f=fecha(r);
    if(!f) continue;

    const t=f.getTime();
    if(!Number.isFinite(t) || t>ahora) continue;

    eventos.push({
      pozo:id,
      tipo:tipoReporteEspecialFT(r),
      estado:interpretarEstadoFT(r)?.valor || null,
      t,
      volumen:esFT(r) ? bls(r) : null,
      bph:id==='601' ? obtenerBphFT(r) : null
    });
  }

  eventos.sort((a,b)=>a.t-b.t);

  let estado601=null;
  let aforo601=null;
  let reporte601Previo=null;

  let inicioPrimeraDerivacion=null;
  let volumenCorte601=null;
  let horasCorte601=0;

  let derivacionActiva=false;
  let proyeccionHabilitada=false;

  let base602=null;
  let ultimoTiempo=null;
  let acumulado602=0;
  let horas602=0;

  let ultimaVisita602=null;
  let motivoDetencion='SIN DERIVACION ACTIVA';

  const integrarHasta=(t)=>{
    if(
      !derivacionActiva ||
      !proyeccionHabilitada ||
      ultimoTiempo===null
    ){
      return;
    }

    const horas=Math.max(0,(t-ultimoTiempo)/3600000);

    if(estado601==='ABIERTO' && aforo601!==null){
      acumulado602+=horas*aforo601;
      horas602+=horas;
    }

    ultimoTiempo=t;
  };

  for(const e of eventos){

    integrarHasta(e.t);

    if(e.pozo==='601'){

      if(e.estado){

        if(
          (e.estado==='CERRADO' ||
           e.estado==='INTERMITENTE') &&
          derivacionActiva
        ){
          derivacionActiva=false;
          proyeccionHabilitada=false;
          motivoDetencion='CIERRE 601: DERIVACION DETENIDA';
        }

        estado601=e.estado;
      }

      if(e.bph!==null){
        aforo601=e.bph;
      }

      if(['GUARDIA','VISITA','AFORO'].includes(e.tipo)){
        reporte601Previo=e;
      }

      continue;
    }

    if(
      e.tipo==='VISITA' &&
      inicioPrimeraDerivacion!==null
    ){
      derivacionActiva=false;
      proyeccionHabilitada=false;
      ultimaVisita602=e;
      motivoDetencion='VISITA 602: PROYECCION DETENIDA';

      if(e.volumen!==null){
        base602=e.volumen;
        acumulado602=0;
        horas602=0;
      }

      continue;
    }

    if(
      e.tipo==='GUARDIA' &&
      e.volumen!==null &&
      reporte601Previo &&
      reporte601Previo.t<e.t
    ){

      if(inicioPrimeraDerivacion===null){

        inicioPrimeraDerivacion=e.t;

        const lecturas601=eventos.filter(x=>
          x.pozo==='601' &&
          x.volumen!==null &&
          x.t<=e.t
        );

        const base601=lecturas601.at(-1);

        if(base601){
          const corte=calcularProyeccionFT(
            {
              ...ft601,
              volumen:base601.volumen,
              fecha:new Date(base601.t)
            },
            reportes,
            e.t
          );

          volumenCorte601=corte.volumenEstimado;
          horasCorte601=corte.horasProduciendo || 0;
        }
      }

      base602=e.volumen;
      acumulado602=0;
      horas602=0;
      ultimoTiempo=e.t;
      ultimaVisita602=null;

      derivacionActiva=estado601==='ABIERTO';
      proyeccionHabilitada=derivacionActiva && aforo601!==null;

      motivoDetencion=!derivacionActiva
        ? '601 SIN APERTURA CONFIRMADA'
        : aforo601===null
          ? 'SIN AFORO VALIDO DEL 601'
          : 'DERIVACION ACTIVA';
    }
  }

  if(inicioPrimeraDerivacion===null) return lecturas;

  integrarHasta(ahora);

  if(volumenCorte601!==null){

    const medicionPosterior=
      ft601.fecha.getTime()>inicioPrimeraDerivacion;

    ft601.volumenMostrado=medicionPosterior
      ? ft601.volumen
      : volumenCorte601;

    ft601.proyeccion={
      ...ft601.proyeccion,
      volumenEstimado:ft601.volumenMostrado,
      horasProduciendo:medicionPosterior?0:horasCorte601,
      proyectando:false,
      bph:null,
      motivo:'FT 601: PRODUCCION DERIVADA AL FT 602'
    };

    ft601.derivacionFT='SALIDA A FT 602';
  }

  if(base602===null) return lecturas;

  const volumenEstimado=base602+acumulado602;

  ft602.volumenMostrado=volumenEstimado;

  ft602.proyeccion={
    ...ft602.proyeccion,
    volumenReal:base602,
    volumenEstimado,
    bph:proyeccionHabilitada ? aforo601 : null,
    proyectando:proyeccionHabilitada,
    horasProduciendo:horas602,
    motivo:proyeccionHabilitada
      ? 'DERIVACION ACTIVA: AFORO DINAMICO DEL 601'
      : motivoDetencion
  };

  ft602.derivacionFT=proyeccionHabilitada
    ? 'RECIBE PRODUCCION DEL 601'
    : 'DERIVACION DETENIDA';

  return lecturas;
}

function prepararProyeccionesFT(lecturas,reportes){

  const ahora=Date.now();

  const resultado=lecturas.map(item=>{

    const proyeccion=calcularProyeccionFT(
      item,
      reportes,
      ahora
    );

    return {
      ...item,
      proyeccion,
      volumenMostrado:proyeccion.volumenEstimado
    };
  });

  calcularDerivacion601602(
    resultado,
    reportes,
    ahora
  );

  return resultado.sort((a,b)=>
    b.volumenMostrado-a.volumenMostrado ||
    a.pozo.localeCompare(b.pozo,'es',{numeric:true})
  );
}


function estado(item){
  const volumen=item.volumenMostrado ?? item.volumen;

  if(volumen >= ESCALA) return 'limite';
  if(volumen >= ALERTA) return 'alerta';

  if(Date.now()-item.fecha.getTime()>ANTIGUO_MS){
    return 'antiguo';
  }

  if(volumen >= PREVENTIVO) return 'preventivo';

  return 'normal';
}

function clasificarVolumenFT(item){

  const volumen=item.volumenMostrado ?? item.volumen;
  const p=item.proyeccion || {};

  const horas=Number(p.horasProduciendo) || 0;

  const estimado=(
    p.proyectando===true ||
    horas>0 ||
    Math.abs(volumen-item.volumen)>0.001
  );

  if(!estimado){
    return {
      codigo:'MEDIDO',
      etiqueta:'ÚLTIMA MEDICIÓN REAL'
    };
  }

  if(p.proyectando===true){
    return {
      codigo:'ESTIMADO ACTIVO',
      etiqueta:'VOLUMEN ESTIMADO — PROYECCIÓN ACTIVA'
    };
  }

  return {
    codigo:'ESTIMADO DETENIDO',
    etiqueta:'VOLUMEN ESTIMADO — PROYECCIÓN DETENIDA'
  };
}



/* GRAFICA_LINEAL_FT271 — SOLO PRESENTACION */

function graficaLinealFT(item,ampliada=false){
  const reportes=window.AdminFirebase?.reportes || [];
  const puntos=[];

  for(const r of reportes){
    if(!esFT(r)) continue;
    if(pozo(r)!==item.pozo) continue;

    const valor=bls(r);
    const momento=fecha(r);

    if(valor===null || !momento) continue;

    const t=momento.getTime();

    if(!Number.isFinite(t)) continue;
    if(t>Date.now()+5*60*1000) continue;

    puntos.push({t,valor});
  }

  puntos.sort((a,b)=>a.t-b.t);

  const unicos=[];
  for(const punto of puntos){
    const anterior=unicos[unicos.length-1];

    if(anterior && anterior.t===punto.t){
      // No inventar un orden para mediciones simultáneas.
      // Conservar el punto más reciente recibido en la lista.
      unicos[unicos.length-1]=punto;
    }else{
      unicos.push(punto);
    }
  }

  const inicio48h=Date.now()-48*60*60*1000;
  const historicos=unicos
    .filter(p=>p.t>=inicio48h && p.t<=Date.now())
    .slice(-200);

  if(!historicos.length){
    return '<div class="mft-line-empty">Sin historial válido</div>';
  }

  const W=360;
  const H=190;
  const L=42;
  const R=12;
  const T=14;
  const B=30;

  const ancho=W-L-R;
  const alto=H-T-B;

  const ultimo=historicos[historicos.length-1];

  const volumenActual=item.volumenMostrado ?? item.volumen;

  const estimado=Number.isFinite(volumenActual) &&
    Math.abs(volumenActual-item.volumen)>0.001;

  const ahora=Date.now();

  const proyeccionValida=estimado &&
    item.fecha instanceof Date &&
    Number.isFinite(item.fecha.getTime()) &&
    ahora>=item.fecha.getTime();

  const valores=historicos.map(p=>p.valor);

  if(proyeccionValida){
    valores.push(volumenActual);
  }

  const maximo=Math.max(ESCALA,...valores,1);
  const techo=Math.ceil(maximo/25)*25;

  const tiempoMin=historicos[0].t;

  const tiempoMax=Math.max(
    ultimo.t,
    proyeccionValida?ahora:ultimo.t
  );

  const rangoTiempo=Math.max(1,tiempoMax-tiempoMin);

  const x=t=>L+(t-tiempoMin)/rangoTiempo*ancho;
  const y=v=>T+alto-(v/techo)*alto;

  // Con una sola medición, colocar el punto al centro.
  const xReal=t=>
    historicos.length===1 && !proyeccionValida
      ? L+ancho/2
      : x(t);

  const coords=historicos.map(p=>({
    x:xReal(p.t),
    y:y(p.valor),
    t:p.t,
    valor:p.valor
  }));

  const ruta=coords.map((p,i)=>
    (i===0?'M':'L')+
    p.x.toFixed(2)+' '+p.y.toFixed(2)
  ).join(' ');

  const color='#2563eb';

  const rejilla=[0,techo/4,techo/2,techo*3/4,techo]
    .map(v=>{
      const yy=y(v).toFixed(2);
      return `
        <line x1="${L}" y1="${yy}"
          x2="${W-R}" y2="${yy}"
          stroke="#e2e8f0" stroke-width="1"/>
        <text x="${L-7}" y="${Number(yy)+4}"
          text-anchor="end"
          font-size="10" fill="#64748b">
          ${v.toFixed(0)}
        </text>`;
    }).join('');

  const umbral=y(ALERTA).toFixed(2);

  const alerta=`
    <line x1="${L}" y1="${umbral}"
      x2="${W-R}" y2="${umbral}"
      stroke="#ea580c" stroke-width="1.5"
      stroke-dasharray="5 4"/>
  `;

  const puntosSVG=coords.map(p=>`
    <circle cx="${p.x.toFixed(2)}"
      cy="${p.y.toFixed(2)}"
      r="3.5" fill="${color}"
      stroke="white" stroke-width="1.5">
      <title>${esc(
        new Date(p.t).toLocaleString('es-MX')
      )} — ${p.valor.toFixed(1)} BBLS reales</title>
    </circle>
  `).join('');

  let lineaEstimada='';

  if(proyeccionValida){
    const origen={
      x:x(item.fecha.getTime()),
      y:y(item.volumen)
    };

    const destino={
      x:x(ahora),
      y:y(volumenActual)
    };

    lineaEstimada=`
      <line
        x1="${origen.x.toFixed(2)}"
        y1="${origen.y.toFixed(2)}"
        x2="${destino.x.toFixed(2)}"
        y2="${destino.y.toFixed(2)}"
        stroke="#d97706"
        stroke-width="2.5"
        stroke-dasharray="6 5"/>
      <circle cx="${destino.x.toFixed(2)}"
        cy="${destino.y.toFixed(2)}"
        r="4" fill="#d97706">
        <title>Volumen estimado:
          ${volumenActual.toFixed(1)} BBLS</title>
      </circle>`;
  }

  const fechaInicio=new Date(tiempoMin)
    .toLocaleString('es-MX',{
      day:'2-digit',
      month:'2-digit',
      hour:'2-digit',
      minute:'2-digit'
    });

  const fechaFinal=new Date(tiempoMax)
    .toLocaleString('es-MX',{
      day:'2-digit',
      month:'2-digit',
      hour:'2-digit',
      minute:'2-digit'
    });

  return `
    <div class="mft-line-wrap">
      <div class="mft-line-title">
        ÚLTIMAS 48 HORAS
      </div>

      <svg class="mft-line-svg"
        viewBox="0 0 ${W} ${H}"
        role="img"
        aria-label="Historial de volumen del pozo ${esc(item.pozo)}">

        ${rejilla}
        ${alerta}

        ${coords.length>1
          ? `<path d="${ruta}" fill="none"
              stroke="${color}"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"/>`
          : ''}

        ${puntosSVG}
        ${lineaEstimada}

        <text x="${L}" y="${H-7}"
          font-size="10" fill="#64748b">
          ${esc(fechaInicio)}
        </text>

        <text x="${W-R}" y="${H-7}"
          text-anchor="end"
          font-size="10" fill="#64748b">
          ${esc(fechaFinal)}
        </text>
      </svg>

      <div class="mft-line-legend">
        <span>● Lectura real</span>
        <span>┄ Estimación</span>
        <span>┄ Alerta 300</span>
      </div>
    </div>
  `;
}



/* BLOQUE 277 — TARJETAS PROFESIONALES */

function tarjeta(item){
  const volumen = item.volumenMostrado ?? item.volumen;
  const tipo = estado(item);

  const estadoPozo =
    item.estadoPozo?.valor || 'NO CONFIRMADO';

  const claseEstado = {
    ABIERTO:'abierto',
    CERRADO:'cerrado',
    INTERMITENTE:'intermitente'
  }[estadoPozo] || 'desconocido';

  const porcentaje = Math.max(
    0,
    Math.min(100, volumen / ESCALA * 100)
  );

  const porcentajeTexto = (
    volumen / ESCALA * 100
  ).toFixed(1);

  const nivel = volumen >= ALERTA
    ? 'alerta'
    : volumen >= PREVENTIVO
      ? 'preventivo'
      : 'normal';

  const desactualizada =
    Date.now() - item.fecha.getTime() > ANTIGUO_MS;

  return `
    <article
      class="mft-card mft-card-277
             mft-${tipo}
             mft-borde-${claseEstado}
             mft-nivel-${nivel}"
      data-mft-pozo="${esc(item.pozo)}"
      tabindex="0"
      role="button"
      aria-label="Abrir detalle del pozo ${esc(item.pozo)}">

      <div class="mft-card-top-277">
        <strong class="mft-pozo-277">
          POZO ${esc(item.pozo)}
        </strong>

        <span class="mft-estado-277
                     mft-estado-${claseEstado}">
          <i aria-hidden="true"></i>
          ${esc(estadoPozo)}
        </span>
      </div>

      <div class="mft-card-body-277">

        <div class="mft-card-values-277">
          <div class="mft-bbls-277">
            ${volumen.toFixed(1)}
            <small>BBLS</small>
          </div>

          <div class="mft-percent-277">
            ${porcentajeTexto}% de 375 BBLS
          </div>
        </div>

        <div class="mft-mini-tank-277"
             aria-hidden="true">
          <div class="mft-mini-tank-glass-277">
            <div class="mft-mini-tank-water-277"
                 style="height:${porcentaje.toFixed(2)}%">
            </div>
            <div class="mft-mini-tank-scale-277"></div>
          </div>
        </div>

      </div>

      <div class="mft-progress-277"
           aria-label="${porcentajeTexto}% de escala">
        <div class="mft-progress-fill-277"
             style="width:${porcentaje.toFixed(2)}%">
        </div>
      </div>

      ${desactualizada
        ? '<div class="mft-stale-277">LECTURA ANTIGUA</div>'
        : ''}

      <div class="mft-card-hint-277">
        Ver detalle del pozo
        <span aria-hidden="true">↗</span>
      </div>

    </article>
  `;
}

/* BLOQUE 202 — ALERTAS PREVENTIVAS */

function generarAlertasFT(lecturas){

  const alertas=[];

  for(const item of lecturas){

    const volumen=item.volumenMostrado ?? item.volumen;

    if(!Number.isFinite(volumen) || volumen<ALERTA){
      continue;
    }

    const limite=volumen>=ESCALA;

    const origenVolumen=clasificarVolumenFT(item).codigo;

    alertas.push({
      pozo:item.pozo,
      volumen,
      limite,
      origenVolumen
    });
  }

  return alertas;
}

function mostrarAlertasFT(lecturas){

  const alertas=generarAlertasFT(lecturas);

  if(!alertas.length){
    return '';
  }

  return `
    <div class="mft-alert-panel">
      <div class="mft-alert-panel-title">
        ⚠️ ALERTAS PREVENTIVAS FT
      </div>

      ${alertas.map(a=>`
        <div class="mft-alert-row">
          <strong>POZO ${esc(a.pozo)}</strong>
          <span>
            ${a.volumen.toFixed(1)} BBLS
            (${esc(a.origenVolumen)})
          </span>
          <strong>
            ${a.limite
              ? 'LÍMITE REFERENCIAL 375 BBLS'
              : 'UMBRAL PREVENTIVO 300 BBLS'}
          </strong>
        </div>
      `).join('')}
    </div>
  `;
}


/* AMPLIACION_FT272 — SOLO PRESENTACION */

let lecturasVisiblesFT=[];

function abrirGraficaAmpliadaFT(id){
  const item=lecturasVisiblesFT.find(x=>x.pozo===id);
  if(!item)return;

  const anterior=document.getElementById('mft-modal-272');
  if(anterior)anterior.remove();

  const modal=document.createElement('div');
  modal.id='mft-modal-272';
  modal.className='mft-modal-272';

  modal.innerHTML=`
    <div class="mft-modal-panel-272"
      role="dialog"
      aria-modal="true"
      aria-label="Gráfica ampliada del pozo ${esc(id)}">

      <div class="mft-modal-head-272">
        <div>
          <strong>POZO ${esc(id)}</strong>
          <div>EVOLUCIÓN DE VOLUMEN — 48 HORAS</div>
        </div>
        <button type="button"
          class="mft-modal-close-272"
          aria-label="Cerrar gráfica">✕</button>
      </div>

      <div class="mft-modal-chart-272">
        ${graficaLinealFT(item,true)}
      </div>

      <div class="mft-modal-extra-276">
        <div>
          <span>Clasificación del volumen</span>
          <strong>${esc(clasificarVolumenFT(item).etiqueta)}</strong>
        </div>

        <div>
          <span>Aforo utilizado</span>
          <strong>${
            Number.isFinite(item.proyeccion?.bph)
              ? item.proyeccion.bph.toFixed(2)+' BPH'
              : 'Sin BPH activo'
          }</strong>
        </div>

        <div>
          <span>Estado de la proyección</span>
          <strong>${esc(item.proyeccion?.motivo || 'SIN PROYECCIÓN')}</strong>
        </div>

        <div>
          <span>Derivación especial</span>
          <strong>${esc(item.derivacionFT || 'NO APLICA')}</strong>
        </div>
      </div>

      <div class="mft-modal-data-272">
        <div>
          <span>Última medición real</span>
          <strong>${item.volumen.toFixed(1)} BBLS</strong>
        </div>
        <div>
          <span>Volumen mostrado</span>
          <strong>${(item.volumenMostrado??item.volumen).toFixed(1)} BBLS</strong>
        </div>
        <div>
          <span>Estado operativo</span>
          <strong>${esc(item.estadoPozo?.valor||'NO CONFIRMADO')}</strong>
        </div>
        <div>
          <span>Última lectura</span>
          <strong>${esc(item.fecha.toLocaleString('es-MX'))}</strong>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cerrar=()=>modal.remove();

  modal.querySelector('.mft-modal-close-272')
    .addEventListener('click',cerrar);

  modal.addEventListener('click',e=>{
    if(e.target===modal)cerrar();
  });

  modal.querySelector('.mft-modal-close-272').focus();
}

function activarTarjetasFT272(root){
  root.querySelectorAll('[data-mft-pozo]').forEach(card=>{
    const abrir=()=>abrirGraficaAmpliadaFT(
      card.getAttribute('data-mft-pozo')
    );

    card.addEventListener('click',abrir);

    card.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();
        abrir();
      }
    });
  });
}

function render(){
  const root = document.getElementById('monitoreoFtRoot');
  if(!root) return;

  /* MONITOREO_CAPA_CORRECCIONES_961 */
  const reportesOriginales=window.AdminFirebase?.reportes || [];

  const reportes=window.CapaCorreccionesFT
    ?.obtenerReportes(reportesOriginales)
    || reportesOriginales;

  const lecturas=prepararProyeccionesFT(
    obtenerLecturas(reportes),
    reportes
  );
  lecturasVisiblesFT=lecturas;
  const alertas = lecturas.filter(x => x.volumenMostrado >= ALERTA);
  const antiguas = lecturas.filter(
    x => Date.now() - x.fecha.getTime() > ANTIGUO_MS
  );

  root.innerHTML = `
    <div class="mft-heading">
      <div>
        <h2>Monitoreo de Frac Tanks</h2>
        <!-- EDITOR_FT_ADMIN_860 -->
        <button type="button"
                id="mftAbrirEditorAdmin"
                class="primary-btn"
                style="margin-top:12px">
          Corrección administrativa
        </button>
        <div class="mft-order">
          Ordenado por volumen: mayor a menor ↓
        </div>
        <p>Últimas mediciones recibidas. No representa medición continua por sensores.</p>
      </div>
      <div class="mft-summary">
        <strong>${lecturas.length} FT con lectura</strong>
        <strong>${alertas.length} en alerta ≥300 BBLS</strong>
        <strong>${antiguas.length} lecturas antiguas</strong>
      </div>
    </div>

    <div class="mft-notice">
      Escala visual: 375 BBLS. Alerta preventiva: desde 300 BBLS.
      Las lecturas antiguas no confirman el volumen actual.
    </div>

    ${mostrarAlertasFT(lecturas)}

    <div class="mft-grid">
      ${lecturas.map(tarjeta).join('') ||
        '<p>No se encontraron mediciones FT válidas en la ventana de reportes cargados.</p>'}
    </div>
  `;

  activarTarjetasFT272(root);


  /* EDITOR_FT_ADMIN_863 — ACCESO VISUAL ADMIN */
  const botonEditor = root.querySelector(
    '#mftAbrirEditorAdmin'
  );

  const autorizado = (
    window.AdminAuth?.current?.user === 'Admin' &&
    firebase.auth().currentUser?.email?.toLowerCase() ===
      'admin@cuichapa.local'
  );

  if(botonEditor){
    botonEditor.hidden = !autorizado;

    if(autorizado){
      botonEditor.addEventListener('click',()=>{
        if(!window.EditorFTAdmin){
          console.error('Editor FT no disponible');
          return;
        }

        window.EditorFTAdmin.abrir({
          lecturas:lecturasVisiblesFT.map(item=>({
            pozo:item.pozo,
            reporteId:item.reporte?.id || '',
            volumen:item.volumen,
            fecha:item.fecha?.getTime() || null
          }))
        });
      });
    }
  }


}


/* ==========================================================
   BLOQUE 201 — ACTUALIZACION PERIODICA

   Recalcula solo cuando el panel esta visible.
   No consulta Firebase.
   No genera reportes.
   ========================================================== */

/* FT_LECTURA_AUTOMATICA_1156 */
let vistaFTAnteriorVisible=false;
let consultaFTCompletada=false;
let consultaFTEnCurso=false;

async function consultarCorreccionesFT(){

  if(consultaFTCompletada || consultaFTEnCurso){
    return;
  }

  const vista=document.getElementById('monitoreoFtView');

  if(!vista ||
     vista.classList.contains('hidden') ||
     document.hidden){
    return;
  }

  const usuario=window.firebase?.auth?.()
    ?.currentUser;

  if(!usuario ||
     usuario.email!=='admin@cuichapa.local' ||
     window.AdminAuth?.current?.user!=='Admin'){
    return;
  }

  const sync=window.SincronizacionCorreccionesFT;

  if(!sync ||
     typeof sync.actualizar!=='function'){
    return;
  }

  consultaFTEnCurso=true;

  try{
    const resultado=await sync.actualizar();

    if(resultado?.actualizado){
      consultaFTCompletada=true;
    }else{
      console.warn(
        '[Monitoreo FT] Lectura:',
        resultado?.motivo
      );
    }
  }catch(error){
    console.warn(
      '[Monitoreo FT] Consulta fallida:',
      error.message
    );
  }finally{
    consultaFTEnCurso=false;
  }
}

let intervaloMonitoreoFT=null;

function iniciarActualizacionFT(){

  if(intervaloMonitoreoFT!==null){
    return;
  }

  intervaloMonitoreoFT=setInterval(()=>{

    const vista=document.getElementById('monitoreoFtView');

    if(!vista) return;

    if(vista.classList.contains('hidden')){
      vistaFTAnteriorVisible=false;
      return;
    }

    if(document.hidden){
      return;
    }

    if(!vistaFTAnteriorVisible){
      vistaFTAnteriorVisible=true;
      consultaFTCompletada=false;
    }

    consultarCorreccionesFT();

    try{
      render();
    }catch(error){
      console.error(
        '[Monitoreo FT] Error de actualización:',
        error
      );
    }

  },60000);
}

window.MonitoreoFT = {
  render,
  obtenerLecturas,
  calcularProyeccionFT,
  iniciarActualizacionFT
};

iniciarActualizacionFT();

/* CARGA INICIAL CONTROLADA */
const intervaloConsultaFT=setInterval(()=>{
  const vista=document.getElementById('monitoreoFtView');

  if(!vista || vista.classList.contains('hidden')){
    return;
  }

  consultarCorreccionesFT();
},5000);


})();
