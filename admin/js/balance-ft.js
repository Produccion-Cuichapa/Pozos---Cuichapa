(function(){
'use strict';

/* ==========================================================
   BALANCE DIARIO FT V2
   ========================================================== */

if(window.__BALANCE_FT_V2__){
  return;
}

window.__BALANCE_FT_V2__ = true;


/* ==========================================================
   CONFIGURACIÓN
   ========================================================== */

const BBL_POR_M3 = 6.28981;

const RUTA_RETIROS =
  'balanceFT/retirosUPV';

const POZOS = [
  '19','106D','107','119','128','131','137','138','139',
  '167','169','172','176','179','180','187','191','201','207',
  '213','306','324','326','327','328','331','342','343','346',
  '350','352','356','359','363','364','367','373','376','377',
  '385','401','500','502','504','505','507','513','601','602','603'
];


/* ==========================================================
   ESTADO
   ========================================================== */

let db = null;

let reportes = [];

let retiros = [];

let fechaConsulta = null;

let reportesRef = null;

let retirosRef = null;

let timer = null;

let inicializadoFirebase = false;


/* ==========================================================
   UTILIDADES
   ========================================================== */

function texto(v){
  return String(v ?? '');
}


function normalizar(v){

  return texto(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .toUpperCase();
}


function num(v){

  if(
    v === null ||
    v === undefined ||
    v === ''
  ){
    return null;
  }

  if(typeof v === 'number'){
    return Number.isFinite(v)
      ? v
      : null;
  }

  const limpio =
    String(v)
      .replace(/,/g,'.')
      .replace(/[^\d.+-]/g,'');

  const n =
    Number(limpio);

  return Number.isFinite(n)
    ? n
    : null;
}


function esc(v){

  return texto(v)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}


function pad(v){
  return String(v).padStart(2,'0');
}


function ymd(d){

  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate())
  );
}


function fechaVisible(d){

  return new Intl.DateTimeFormat(
    'es-MX',
    {
      day:'2-digit',
      month:'2-digit',
      year:'numeric'
    }
  ).format(d);
}


function hora24(d){

  return (
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}


function hora12(d){

  return new Intl.DateTimeFormat(
    'es-MX',
    {
      hour:'2-digit',
      minute:'2-digit',
      hour12:true
    }
  ).format(d);
}


/* ==========================================================
   FECHA CONSULTADA
   ========================================================== */

function fechaReferencia(){

  if(fechaConsulta instanceof Date){
    return new Date(fechaConsulta);
  }

  return new Date();
}


function fechaDesdeInput(valor){

  const m =
    String(valor || '')
      .match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

  if(!m){
    return null;
  }

  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    12,0,0,0
  );
}


function inicioJornada(fecha){

  const d =
    new Date(fecha);

  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    5,0,0,0
  );
}


function finJornada(fecha){

  const ini =
    inicioJornada(fecha);

  return new Date(
    ini.getTime() +
    24 * 60 * 60 * 1000
  );
}


function claveJornada(fecha){

  return ymd(
    inicioJornada(fecha)
  );
}


function rangoActual(){

  const ref =
    fechaReferencia();

  return {
    inicio:inicioJornada(ref),
    fin:finJornada(ref)
  };
}


/* ==========================================================
   POZO
   ========================================================== */

function normalizarPozo(v){

  let p =
    normalizar(v);

  p = p
    .replace(/^CUICHAPA\s*/,'')
    .replace(/^POZO\s*/,'')
    .trim();

  return p;
}


function mensajeReporte(r){

  return [
    r?.mensaje,
    r?.msg,
    r?.texto,
    r?.observaciones,
    r?.descripcion,
    r?.nota,
    r?.whatsappMessage
  ]
    .filter(Boolean)
    .join('\n');
}


function pozoReporte(r){

  const candidatos = [
    r?.pozo,
    r?.pozoId,
    r?.well,
    r?.wellId,
    r?.numeroPozo,
    r?.datos?.pozo,
    r?.nivel?.pozo,
    r?.co?.pozo
  ];

  for(const x of candidatos){

    if(
      x !== undefined &&
      x !== null &&
      String(x).trim()
    ){

      const p =
        normalizarPozo(x);

      if(p){
        return p;
      }
    }
  }

  const msg =
    mensajeReporte(r);

  let m =
    msg.match(
      /\b(?:POZO|CUICHAPA)\s*[:#-]?\s*([0-9]{1,3}[A-Z]?)\b/i
    );

  if(m){
    return normalizarPozo(m[1]);
  }

  return '';
}


/* ==========================================================
   FECHA/HORA REPORTE
   ========================================================== */

function parseFechaBase(v){

  const s =
    texto(v).trim();

  if(!s){
    return null;
  }

  let m =
    s.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if(m){

    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      0,0,0,0
    );
  }

  m =
    s.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
    );

  if(m){

    return new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      0,0,0,0
    );
  }

  return null;
}


function aplicarHora(fecha,hora){

  if(!fecha){
    return null;
  }

  const d =
    new Date(fecha);

  let s =
    texto(hora)
      .toUpperCase()
      .replace(/\./g,'')
      .replace(/\s+/g,' ')
      .replace(/\bA\s+M\b/g,'AM')
      .replace(/\bP\s+M\b/g,'PM')
      .trim();

  const m =
    s.match(
      /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/
    );

  if(!m){
    return d;
  }

  let h =
    Number(m[1]);

  const min =
    Number(m[2]);

  const sec =
    Number(m[3] || 0);

  const mer =
    m[4] || '';

  if(
    mer === 'PM' &&
    h < 12
  ){
    h += 12;
  }

  if(
    mer === 'AM' &&
    h === 12
  ){
    h = 0;
  }

  d.setHours(
    h,
    min,
    sec,
    0
  );

  return d;
}


function fechaReporte(r){

  const timestamps = [
    r?.timestamp,
    r?.createdAt,
    r?.created_at,
    r?.capturedAt,
    r?.fechaHoraMs,
    r?.fechaTimestamp,
    r?.serverTimestamp,
    r?.savedAt
  ];

  for(const x of timestamps){

    const n =
      Number(x);

    if(
      Number.isFinite(n) &&
      n > 100000000000
    ){

      const d =
        new Date(n);

      if(!Number.isNaN(d.getTime())){
        return d;
      }
    }
  }


  const base =
    parseFechaBase(
      r?.fecha ??
      r?.date ??
      r?.fechaReporte ??
      ''
    );

  if(base){

    return aplicarHora(
      base,
      r?.hora ??
      r?.time ??
      r?.horaReporte ??
      r?.horaGuardia ??
      ''
    );
  }


  const combinadas = [
    r?.fechaHora,
    r?.dateTime,
    r?.datetime,
    r?.iso
  ];

  for(const x of combinadas){

    if(!x){
      continue;
    }

    const d =
      new Date(x);

    if(!Number.isNaN(d.getTime())){
      return d;
    }
  }


  const idNum =
    Number(
      r?.id ??
      r?._firebaseKey ??
      ''
    );

  if(
    Number.isFinite(idNum) &&
    idNum > 100000000000
  ){
    return new Date(idNum);
  }

  return null;
}


/* ==========================================================
   BLS
   ========================================================== */

function valorBls(r){

  const nivel =
    r?.nivel || {};

  const co =
    r?.co || {};

  const datos =
    r?.datos || {};

  const candidatos = [
    nivel.bls,
    nivel.BLS,
    nivel.bbl,
    nivel.BBL,
    nivel.barriles,

    r?.bls,
    r?.BLS,
    r?.bbl,
    r?.BBL,
    r?.barriles,
    r?.nivelBls,
    r?.nivelBLS,
    r?.nivelBbl,
    r?.nivelBBL,

    co.bls,
    co.BLS,

    datos.bls,
    datos.BLS,
    datos.bbl,
    datos.BBL
  ];

  for(const x of candidatos){

    const n =
      num(x);

    if(n !== null){
      return n;
    }
  }


  const msg =
    mensajeReporte(r);


  const patrones = [
    /\bBLS\s*[:=-]?\s*([-+]?\d+(?:[.,]\d+)?)/i,
    /\bBBLS\s*[:=-]?\s*([-+]?\d+(?:[.,]\d+)?)/i,
    /\bBBL\s*[:=-]?\s*([-+]?\d+(?:[.,]\d+)?)/i,
    /\bBARRILES?\s*[:=-]?\s*([-+]?\d+(?:[.,]\d+)?)/i,
    /([-+]?\d+(?:[.,]\d+)?)\s*(?:BLS|BBLS|BBL|BARRILES?)\b/i
  ];


  for(const patron of patrones){

    const m =
      msg.match(patron);

    if(m){

      const n =
        num(m[1]);

      if(n !== null){
        return n;
      }
    }
  }

  return null;
}


/* ==========================================================
   CTM
   ========================================================== */

function valorCtm(r){

  const nivel =
    r?.nivel || {};

  const candidatos = [
    nivel.ctm,
    nivel.CTM,
    nivel.cm,

    r?.ctm,
    r?.CTM,
    r?.nivelCtm,
    r?.nivelCM
  ];

  for(const x of candidatos){

    const n =
      num(x);

    if(n !== null){
      return n;
    }
  }


  const msg =
    mensajeReporte(r);

  let m =
    msg.match(
      /([-+]?\d+(?:[.,]\d+)?)\s*(?:CM|CTM|CMS)\b/i
    );

  return m
    ? num(m[1])
    : null;
}


/* ==========================================================
   AFORO
   ========================================================== */

function esAforo(r){

  try{

    if(
      window.AforoUtils &&
      typeof window.AforoUtils
        .esReporteAforoIndependiente === 'function' &&
      window.AforoUtils
        .esReporteAforoIndependiente(r)
    ){
      return true;
    }

  }catch(e){}


  const modo =
    normalizar(
      r?.modo ??
      r?.tipo ??
      ''
    );


  if(
    modo.includes('AFORO') ||
    modo.includes('PROYECCION')
  ){
    return true;
  }


  const msg =
    normalizar(
      mensajeReporte(r)
    );


  return (
    msg.includes('AFORO') &&
    msg.includes('BPH')
  );
}


function valorBph(r){

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


  for(const x of candidatos){

    const n =
      num(x);

    if(n !== null){
      return n;
    }
  }


  const msg =
    mensajeReporte(r);


  let m =
    msg.match(
      /AFORO[\s\S]{0,120}?([-+]?\d+(?:[.,]\d+)?)\s*BPH\b/i
    );


  if(!m){

    m =
      msg.match(
        /([-+]?\d+(?:[.,]\d+)?)\s*BPH\b/i
      );
  }


  return m
    ? num(m[1])
    : null;
}


/* ==========================================================
   NIVEL FT
   ========================================================== */

function esNivelFT(r){

  if(esAforo(r)){
    return false;
  }

  return valorBls(r) !== null;
}


/* ==========================================================
   ESTADO
   ========================================================== */

function estadoReporte(r){

  const candidatos = [
    r?.estadoPozo,
    r?.estatusPozo,
    r?.estado,
    r?.co?.estadoPozo,
    r?.parsed?.estadoPozo
  ];


  for(const x of candidatos){

    const s =
      normalizar(x);

    if(s.includes('CERRADO')){
      return 'CERRADO';
    }

    if(s.includes('INTERMITENTE')){
      return 'INTERMITENTE';
    }

    if(s.includes('ABIERTO')){
      return 'ABIERTO';
    }
  }


  const msg =
    normalizar(
      mensajeReporte(r)
    );


  const m =
    msg.match(
      /(?:ESTADO(?: DEL)? POZO|ESTATUS(?: DEL)? POZO)\s*[:=-]?\s*(ABIERTO|CERRADO|INTERMITENTE)/
    );


  if(m){
    return m[1];
  }


  if(/\bCERRADO\b/.test(msg)){
    return 'CERRADO';
  }

  if(/\bINTERMITENTE\b/.test(msg)){
    return 'INTERMITENTE';
  }

  if(/\bABIERTO\b/.test(msg)){
    return 'ABIERTO';
  }


  return null;
}


/* ==========================================================
   CACHE REPORTES POR POZO
   ========================================================== */

let cachePozo = new Map();


function reconstruirCache(){

  cachePozo =
    new Map();


  for(const r of reportes){

    const pozo =
      pozoReporte(r);

    const fecha =
      fechaReporte(r);


    if(
      !pozo ||
      !fecha
    ){
      continue;
    }


    if(
      !cachePozo.has(pozo)
    ){
      cachePozo.set(pozo,[]);
    }


    cachePozo
      .get(pozo)
      .push({
        r,
        fecha
      });
  }


  for(const arr of cachePozo.values()){

    arr.sort(
      (a,b) =>
        a.fecha - b.fecha
    );
  }
}


function datosPozo(pozo){

  return cachePozo.get(pozo) || [];
}


/* ==========================================================
   NIVEL / AFORO / ESTADO HASTA UN MOMENTO
   ========================================================== */

function nivelHasta(pozo,momento){

  const arr =
    datosPozo(pozo);

  let result =
    null;


  for(const x of arr){

    if(x.fecha > momento){
      break;
    }

    if(esNivelFT(x.r)){

      result = {
        fecha:x.fecha,
        bls:valorBls(x.r),
        ctm:valorCtm(x.r),
        reporte:x.r
      };
    }
  }

  return result;
}


function aforoHasta(pozo,momento){

  const arr =
    datosPozo(pozo);

  let result =
    null;


  for(const x of arr){

    if(x.fecha > momento){
      break;
    }

    if(esAforo(x.r)){

      const bph =
        valorBph(x.r);

      if(bph !== null){

        result = {
          fecha:x.fecha,
          bph,
          reporte:x.r
        };
      }
    }
  }

  return result;
}


function estadoHasta(pozo,momento){

  const arr =
    datosPozo(pozo);

  let estado =
    'SIN DATO';


  for(const x of arr){

    if(x.fecha > momento){
      break;
    }

    const e =
      estadoReporte(x.r);

    if(e){
      estado = e;
    }
  }


  return estado;
}


/* ==========================================================
   NIVELES REALES DE UNA HORA
   ========================================================== */

function nivelRealEnHora(
  pozo,
  inicio,
  fin
){

  const arr =
    datosPozo(pozo);

  let result =
    null;


  for(const x of arr){

    if(x.fecha < inicio){
      continue;
    }

    if(x.fecha >= fin){
      break;
    }

    if(esNivelFT(x.r)){

      result = {
        fecha:x.fecha,
        bls:valorBls(x.r),
        ctm:valorCtm(x.r)
      };
    }
  }


  return result;
}


/* ==========================================================
   RETIROS
   ========================================================== */

function descuentosEntre(
  pozo,
  desde,
  hasta
){

  return retiros.reduce(
    (s,x) => {

      if(
        x.pozo !== pozo ||
        !(x.fecha instanceof Date)
      ){
        return s;
      }


      if(
        x.fecha < desde ||
        x.fecha > hasta
      ){
        return s;
      }


      return (
        s +
        (num(x.bbls) || 0)
      );

    },
    0
  );
}


/* ==========================================================
   VOLUMEN EN UN MOMENTO
   ========================================================== */

function volumenEn(
  pozo,
  momento
){

  const nivel =
    nivelHasta(
      pozo,
      momento
    );


  if(
    !nivel ||
    nivel.bls === null
  ){
    return null;
  }


  const aforo =
    aforoHasta(
      pozo,
      momento
    );


  const estado =
    estadoHasta(
      pozo,
      momento
    );


  const bph =
    aforo?.bph || 0;


  const horas =
    Math.max(
      0,
      (
        momento.getTime() -
        nivel.fecha.getTime()
      ) /
      3600000
    );


  let incremento =
    horas * bph;


  if(estado === 'CERRADO'){
    incremento = 0;
  }


  const descuento =
    descuentosEntre(
      pozo,
      nivel.fecha,
      momento
    );


  return Math.max(
    0,
    nivel.bls +
    incremento -
    descuento
  );
}


/* ==========================================================
   HORAS DE LA JORNADA
   ========================================================== */

function horasJornada(){

  const {inicio} =
    rangoActual();

  const horas = [];


  for(let i = 0; i <= 24; i++){

    horas.push(
      new Date(
        inicio.getTime() +
        i * 3600000
      )
    );
  }


  return horas;
}


/* ==========================================================
   FILA
   ========================================================== */

function crearFila(pozo){

  const horas =
    horasJornada();


  /*
   * Solo mostrar el pozo si existe nivel antes
   * del cierre de la jornada.
   */
  const nivelFinal =
    nivelHasta(
      pozo,
      horas[24]
    );


  if(!nivelFinal){
    return null;
  }


  const celdas =
    horas.map(
      (momento,index) => {

        const siguiente =
          new Date(
            momento.getTime() +
            3600000
          );


        const real =
          index < 24
            ? nivelRealEnHora(
                pozo,
                momento,
                siguiente
              )
            : null;


        if(real){

          return {
            valor:real.bls,
            real:true,
            fechaReal:real.fecha,
            ctm:real.ctm,
            momento
          };
        }


        return {
          valor:
            volumenEn(
              pozo,
              momento
            ),

          real:false,
          fechaReal:null,
          ctm:null,
          momento
        };
      }
    );


  const ref =
    fechaReferencia();


  const estado =
    estadoHasta(
      pozo,
      finJornada(ref)
    );


  /*
   * Aforo/BPH que se está usando como referencia
   * para la proyección de este pozo.
   */
  const aforoReferencia =
    aforoHasta(
      pozo,
      finJornada(ref)
    );


  const descuento =
    retiros
      .filter(
        x => x.pozo === pozo
      )
      .reduce(
        (s,x) =>
          s + (num(x.bbls) || 0),
        0
      );


  /*
   * ========================================================
   * ÚLTIMO NIVEL REAL DEL POZO
   * ========================================================
   *
   * Puede haber varias lecturas reales durante la jornada,
   * pero visualmente SOLO se marca en verde la más reciente.
   *
   * Las lecturas anteriores siguen existiendo y conservan
   * su valor/hora; simplemente ya no reciben color verde.
   */

  let ultimoIndiceReal = -1;
  let ultimaFechaReal = -1;

  celdas.forEach(
    (celda, indice) => {

      celda.ultimoReal = false;

      if(
        !celda.real ||
        !celda.fechaReal
      ){
        return;
      }

      const tiempo =
        new Date(
          celda.fechaReal
        ).getTime();

      if(
        Number.isFinite(tiempo) &&
        tiempo > ultimaFechaReal
      ){
        ultimaFechaReal =
          tiempo;

        ultimoIndiceReal =
          indice;
      }
    }
  );


  if(
    ultimoIndiceReal >= 0 &&
    celdas[ultimoIndiceReal]
  ){
    celdas[
      ultimoIndiceReal
    ].ultimoReal = true;
  }


  return {
    pozo,
    estado,
    celdas,
    descuento,

    bph:
      aforoReferencia?.bph ?? 0,

    fechaAforo:
      aforoReferencia?.fecha ?? null
  };
}


/* ==========================================================
   ESTADO VISUAL
   ========================================================== */

function badgeEstado(estado){

  const cls =
    estado === 'ABIERTO'
      ? 'abierto'
      : estado === 'CERRADO'
        ? 'cerrado'
        : estado === 'INTERMITENTE'
          ? 'intermitente'
          : 'sin';


  return `
    <span class="bft-status ${cls}">
      ${esc(estado)}
    </span>
  `;
}


/* ==========================================================
   ALERTA VISUAL POR VOLUMEN
   ========================================================== */

function claseRiesgoBbl(valor){

  const bbl =
    Number(valor);

  if(
    !Number.isFinite(bbl) ||
    bbl <= 310
  ){
    return '';
  }

  if(bbl <= 345){
    return 'riesgo-1';
  }

  if(bbl <= 380){
    return 'riesgo-2';
  }

  if(bbl <= 450){
    return 'riesgo-3';
  }

  return 'riesgo-4';
}


function textoRiesgoBbl(valor){

  const bbl =
    Number(valor);

  if(
    !Number.isFinite(bbl) ||
    bbl <= 310
  ){
    return '';
  }

  if(bbl <= 345){
    return 'Precaución';
  }

  if(bbl <= 380){
    return 'Alerta';
  }

  if(bbl <= 450){
    return 'Riesgo alto';
  }

  return 'Prioridad máxima';
}


/* ==========================================================
   HTML FILA
   ========================================================== */

function htmlFila(row){

  const celdas =
    row.celdas
      .map(
        c => {

          const valor =
            c.valor === null
              ? '—'
              : Number(c.valor)
                  .toFixed(1);


          const hora =
            c.ultimoReal
              ? hora24(c.fechaReal)
              : hora24(c.momento);


          let title =
            c.ultimoReal
              ? (
                  'Nivel real ' +
                  hora12(c.fechaReal)
                )
              : (
                  'Proyección ' +
                  hora12(c.momento)
                );


          if(
            c.ultimoReal &&
            c.ctm !== null
          ){

            title +=
              ' · ' +
              c.ctm +
              ' cm';
          }


          /*
           * La lectura REAL siempre conserva verde.
           *
           * Solamente las celdas proyectadas reciben
           * escala de riesgo por BBL.
           */
          const riesgo =
            c.ultimoReal
              ? ''
              : claseRiesgoBbl(
                  c.valor
                );


          const textoRiesgo =
            c.ultimoReal
              ? ''
              : textoRiesgoBbl(
                  c.valor
                );


          if(textoRiesgo){

            title +=
              ' · ' +
              textoRiesgo;
          }


          return `
            <td
              class="bft-cell ${c.ultimoReal ? 'real' : ''} ${riesgo}"
              title="${esc(title)}">

              <strong>
                ${valor}
              </strong>

              <small>
                ${hora}
              </small>

            </td>
          `;
        }
      )
      .join('');


  const ultimo =
    row.celdas[
      row.celdas.length - 1
    ]?.valor;


  return `
    <tr>

      <td class="bft-pozo">
        <strong>
          ${esc(row.pozo)}
        </strong>
      </td>

      <td class="bft-estado">
        ${badgeEstado(row.estado)}
      </td>

      <td
        class="bft-proyeccion"
        title="${
          row.fechaAforo
            ? 'Aforo usado: ' + hora12(row.fechaAforo)
            : 'No existe Aforo válido para este pozo'
        }">

        <strong>
          ${
            Number(row.bph || 0)
              .toFixed(2)
          }
        </strong>

        <small>
          BPH
        </small>

      </td>

      ${celdas}

      <td class="bft-upv-cell">
        ${row.descuento.toFixed(2)}
      </td>

      <td class="bft-final-cell">
        ${
          ultimo === null ||
          ultimo === undefined
            ? '—'
            : Number(ultimo)
                .toFixed(1)
        }
      </td>

    </tr>
  `;
}


/* ==========================================================
   MONTAJE
   ========================================================== */

function montar(){

  let root =
    document.getElementById(
      'balanceFtRoot'
    );


  if(root){
    return root;
  }


  const h2s =
    Array.from(
      document.querySelectorAll('h2')
    );


  const actividad =
    h2s.find(
      x =>
        normalizar(x.textContent) ===
        'ACTIVIDAD RECIENTE'
    );


  if(!actividad){
    return null;
  }


  const panel =
    actividad.closest(
      '.panel,section,article'
    ) ||
    actividad.parentElement;


  const grid =
    panel?.parentElement;


  if(
    !grid ||
    !grid.parentElement
  ){
    return null;
  }


  root =
    document.createElement(
      'section'
    );


  root.id =
    'balanceFtRoot';


  grid.parentElement.insertBefore(
    root,
    grid
  );


  return root;
}


/* ==========================================================
   DIAGNÓSTICO
   ========================================================== */

function diagnostico(){

  const conPozo =
    reportes.filter(
      r => !!pozoReporte(r)
    ).length;


  const conFecha =
    reportes.filter(
      r => !!fechaReporte(r)
    ).length;


  const conBls =
    reportes.filter(
      r => valorBls(r) !== null
    ).length;


  const nivelFt =
    reportes.filter(
      esNivelFT
    ).length;


  return {
    total:reportes.length,
    conPozo,
    conFecha,
    conBls,
    nivelFt
  };
}


/* ==========================================================
   RENDER
   ========================================================== */

function render(){

  /*
   * BALANCE FT DOCUMENTOS ONLY
   *
   * La representación visual del Balance FT está
   * deshabilitada permanentemente.
   *
   * NO llamar montar() desde aquí.
   */
  const root =
    document.getElementById(
      'balanceFtRoot'
    );

  if(!root){
    return;
  }


  reconstruirCache();


  const ref =
    fechaReferencia();


  const rango =
    rangoActual();


  const horas =
    horasJornada();


  const filas =
    POZOS
      .map(crearFila)
      .filter(Boolean);


  const abiertos =
    filas.filter(
      x => x.estado === 'ABIERTO'
    ).length;


  const cerrados =
    filas.filter(
      x => x.estado === 'CERRADO'
    ).length;


  const inter =
    filas.filter(
      x => x.estado === 'INTERMITENTE'
    ).length;


  const retiroM3 =
    retiros.reduce(
      (s,x) =>
        s + (num(x.m3) || 0),
      0
    );


  const retiroBbl =
    retiros.reduce(
      (s,x) =>
        s + (num(x.bbls) || 0),
      0
    );


  const diag =
    diagnostico();


  root.innerHTML = `
    <div class="bft-card">

      <div class="bft-upv">

        <div class="bft-upv-title">
          <span>🚚</span>

          <div>
            <h3>
              Retiro UPV
            </h3>

            <p>
              Descuento manual sobre el FT seleccionado.
            </p>
          </div>
        </div>


        <div class="bft-upv-grid">

          <label>
            <span>1 · Pozo</span>

            <select id="bftPozo">
              <option value="">
                Seleccionar pozo...
              </option>

              ${
                POZOS
                  .map(
                    p =>
                      `<option value="${p}">CUICHAPA ${p}</option>`
                  )
                  .join('')
              }
            </select>
          </label>


          <label>
            <span>2 · Volumen retirado</span>

            <div class="bft-input-unit">
              <input
                id="bftM3"
                type="number"
                inputmode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00">

              <b>m³</b>
            </div>
          </label>


          <label>
            <span>3 · Hora del retiro</span>

            <input
              id="bftHora"
              type="time"
              step="60">
          </label>


          <div class="bft-conversion">
            <span>
              4 · Conversión
            </span>

            <strong id="bftConversion">
              0.00
            </strong>

            <b>
              BBL
            </b>
          </div>


          <button
            type="button"
            id="bftGuardar">
            Aplicar retiro
          </button>

        </div>


        <div class="bft-upv-resumen">

          <span>
            Jornada:
            <b>
              ${fechaVisible(rango.inicio)}
              05:00 →
              ${fechaVisible(rango.fin)}
              05:00
            </b>
          </span>

          <span>
            Retiro:
            <b>
              ${retiroM3.toFixed(2)} m³
            </b>
          </span>

          <span>
            Equivalente:
            <b class="purple">
              ${retiroBbl.toFixed(2)} BBL
            </b>
          </span>

        </div>

      </div>


      <div class="bft-head">

        <div>
          <h2>
            Balance Diario FT
          </h2>

          <p>
            Proyección operativa 05:00 a.m. → 05:00 a.m.
          </p>
        </div>


        <div class="bft-date-tools">

          <label>
            <span>Ver jornada</span>

            <input
              id="bftFecha"
              type="date"
              value="${ymd(ref)}">
          </label>

          <button
            type="button"
            id="bftHoy">
            Hoy
          </button>

          <button
            type="button"
            id="bftAmpliar"
            class="bft-expand-btn"
            title="Ampliar Balance Diario FT">
            ⛶ Ampliar tabla
          </button>

        </div>

      </div>


      <div class="bft-kpis">

        <div>
          <span class="dot verde"></span>
          Abiertos
          <strong>${abiertos}</strong>
        </div>

        <div>
          <span class="dot rojo"></span>
          Cerrados
          <strong>${cerrados}</strong>
        </div>

        <div>
          <span class="dot amarillo"></span>
          Intermitentes
          <strong>${inter}</strong>
        </div>

        <div>
          <span class="dot morado"></span>
          Retiro UPV
          <strong>${retiroBbl.toFixed(1)} BBL</strong>
        </div>

      </div>


      <div class="bft-alert-legend">

        <strong>
          Riesgo por volumen FT
        </strong>

        <span class="normal">
          <i></i>
          ≤ 310 BBL
        </span>

        <span class="r1">
          <i></i>
          310–345
        </span>

        <span class="r2">
          <i></i>
          345–380
        </span>

        <span class="r3">
          <i></i>
          380–450
        </span>

        <span class="r4">
          <i></i>
          &gt; 450 BBL
        </span>

      </div>


      <div class="bft-range">

        <span>
          ◷
          <strong>
            ${fechaVisible(rango.inicio)}
            05:00
            →
            ${fechaVisible(rango.fin)}
            05:00
          </strong>
        </span>

        <span class="bft-real-legend">
          <i></i>
          Celda verde = último nivel registrado del pozo
        </span>

      </div>


      <div class="bft-scroll">

        <table>

          <thead>

            <tr>

              <th class="bft-sticky-pozo">
                Pozo
              </th>

              <th class="bft-sticky-estado">
                Estado
              </th>

              <th class="bft-sticky-proyeccion">
                Proyección
                <small>BPH</small>
              </th>

              ${
                horas
                  .map(
                    (h,i) => `
                      <th>
                        ${hora24(h)}

                        ${
                          i === 0
                            ? '<small>INICIO</small>'
                            : i === 24
                              ? '<small>CIERRE</small>'
                              : ''
                        }
                      </th>
                    `
                  )
                  .join('')
              }

              <th>
                Retiro UPV
                <small>BBL</small>
              </th>

              <th>
                Balance
                <small>BBL</small>
              </th>

            </tr>

          </thead>


          <tbody>

            ${
              filas.length
                ? filas.map(htmlFila).join('')
                : `
                  <tr>
                    <td
                      colspan="29"
                      class="bft-empty">

                      <strong>
                        No hay niveles FT para esta jornada.
                      </strong>

                      <small>
                        Firebase:
                        ${db ? 'CONECTADO' : 'ESPERANDO'}
                        · Reportes: ${diag.total}
                        · Con pozo: ${diag.conPozo}
                        · Con BLS: ${diag.conBls}
                        · Con fecha: ${diag.conFecha}
                        · Nivel FT: ${diag.nivelFt}
                      </small>

                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>


      <div class="bft-footer">

        <span>
          Conversión:
          <b>
            1 m³ = ${BBL_POR_M3} BBL
          </b>
        </span>

        <span>
          Última actualización:
          <b>
            ${hora12(new Date())}
          </b>
        </span>

      </div>

    </div>
  `;


  bind();
}


/* ==========================================================
   VISTA AMPLIADA
   ========================================================== */

function abrirBalanceAmpliado(){

  if(
    document.getElementById(
      'bftFullscreen'
    )
  ){
    return;
  }


  const tablaOriginal =
    document.querySelector(
      '#balanceFtRoot .bft-scroll table'
    );


  if(!tablaOriginal){
    toast(
      'La tabla todavía no está disponible.',
      true
    );
    return;
  }


  const overlay =
    document.createElement('div');


  overlay.id =
    'bftFullscreen';


  overlay.className =
    'bft-fullscreen';


  overlay.innerHTML = `
    <div class="bft-fullscreen-shell">

      <header class="bft-fullscreen-head">

        <div>
          <strong>
            Balance Diario FT
          </strong>

          <span>
            ${
              fechaVisible(
                rangoActual().inicio
              )
            }
            · 05:00 → 05:00
          </span>
        </div>


        <div class="bft-fullscreen-actions">

          <span class="bft-fullscreen-help">
            ↔ Desliza para consultar las 24 horas
          </span>

          <button
            type="button"
            id="bftCerrarAmpliado"
            aria-label="Cerrar vista ampliada">
            ✕ Cerrar
          </button>

        </div>

      </header>


      <div class="bft-fullscreen-legend">

        <span>
          <i class="real"></i>
          Nivel real
        </span>

        <span>
          <i class="r1"></i>
          310–345
        </span>

        <span>
          <i class="r2"></i>
          345–380
        </span>

        <span>
          <i class="r3"></i>
          380–450
        </span>

        <span>
          <i class="r4"></i>
          &gt;450 BBL
        </span>

      </div>


      <div
        id="bftFullscreenScroll"
        class="bft-fullscreen-scroll">
      </div>

    </div>
  `;


  document.body.appendChild(
    overlay
  );


  const cont =
    document.getElementById(
      'bftFullscreenScroll'
    );


  const clon =
    tablaOriginal.cloneNode(true);


  clon.classList.add(
    'bft-table-ampliada'
  );


  cont.appendChild(
    clon
  );


  document.body.classList.add(
    'bft-modal-abierto'
  );


  document
    .getElementById(
      'bftCerrarAmpliado'
    )
    ?.addEventListener(
      'click',
      cerrarBalanceAmpliado
    );


  overlay.addEventListener(
    'click',
    event => {

      if(event.target === overlay){
        cerrarBalanceAmpliado();
      }
    }
  );


  document.addEventListener(
    'keydown',
    cerrarBalanceEsc
  );
}


function cerrarBalanceEsc(event){

  if(event.key === 'Escape'){
    cerrarBalanceAmpliado();
  }
}


function cerrarBalanceAmpliado(){

  const overlay =
    document.getElementById(
      'bftFullscreen'
    );


  if(!overlay){
    return;
  }


  overlay.remove();


  document.body.classList.remove(
    'bft-modal-abierto'
  );


  document.removeEventListener(
    'keydown',
    cerrarBalanceEsc
  );
}


/* ==========================================================
   CONTROLES
   ========================================================== */

/* ==========================================================
   BALANCE_FT_EXCEL_V1
   EXPORTACIÓN A EXCEL DESDE DOCUMENTOS
   ========================================================== */

async function descargarBalanceFtExcel(){

  /*
   * Fecha independiente para Documentos.
   * No depende de la vista visual Balance FT.
   */
  let fechaSeleccionada = null;

  const status =
    document.getElementById(
      'balanceFtExcelStatus'
    );

  try{

    if(typeof ExcelJS === 'undefined'){
      throw new Error(
        'ExcelJS todavía no está disponible'
      );
    }

    const input =
      document.getElementById(
        'balanceFtExcelFecha'
      );

    if(input && input.value){
      fechaSeleccionada =
        fechaDesdeInput(
          input.value
        );
    }

    reconstruirCache();

    const ref =
      fechaReferencia();

    const rango =
      rangoActual();

    const horas =
      horasJornada();

    const filas =
      POZOS
        .map(crearFila)
        .filter(Boolean);

    if(!filas.length){
      throw new Error(
        'No existen niveles FT para la jornada seleccionada'
      );
    }

    if(status){
      status.textContent =
        'Generando Balance FT...';
    }

    const wb =
      new ExcelJS.Workbook();

    wb.creator =
      'Campo Cuichapa';

    wb.created =
      new Date();

    const ws =
      wb.addWorksheet(
        'Balance FT'
      );

    /* ---------- TÍTULO ---------- */

    const totalColumnas =
      3 +
      horas.length +
      2;

    ws.mergeCells(
      1,
      1,
      1,
      totalColumnas
    );

    const titulo =
      ws.getCell(1,1);

    titulo.value =
      'BALANCE DIARIO DE FRAC TANK';

    titulo.font = {
      bold:true,
      size:16,
      color:{argb:'FFFFFFFF'}
    };

    titulo.fill = {
      type:'pattern',
      pattern:'solid',
      fgColor:{argb:'FF17365D'}
    };

    titulo.alignment = {
      horizontal:'center',
      vertical:'middle'
    };

    ws.getRow(1).height = 28;

    ws.mergeCells(
      2,
      1,
      2,
      totalColumnas
    );

    ws.getCell(2,1).value =
      'Jornada: ' +
      fechaVisible(rango.inicio) +
      ' 05:00 → ' +
      fechaVisible(rango.fin) +
      ' 05:00';

    ws.getCell(2,1).alignment = {
      horizontal:'center'
    };

    ws.getCell(2,1).font = {
      italic:true,
      bold:true
    };

    /* ---------- ENCABEZADOS ---------- */

    const headers = [
      'POZO',
      'ESTADO',
      'BPH'
    ];

    horas.forEach(
      h => headers.push(
        hora24(h)
      )
    );

    headers.push(
      'RETIRO UPV (BBL)'
    );

    headers.push(
      'BALANCE (BBL)'
    );

    const headerRow =
      ws.getRow(4);

    headers.forEach(
      (texto,i) => {

        const c =
          headerRow.getCell(i + 1);

        c.value = texto;

        c.font = {
          bold:true,
          color:{argb:'FFFFFFFF'}
        };

        c.fill = {
          type:'pattern',
          pattern:'solid',
          fgColor:{argb:'FF1F4E78'}
        };

        c.alignment = {
          horizontal:'center',
          vertical:'middle',
          wrapText:true
        };

        c.border = {
          top:{style:'thin'},
          left:{style:'thin'},
          bottom:{style:'thin'},
          right:{style:'thin'}
        };
      }
    );

    headerRow.height = 32;

    /* ---------- DATOS ---------- */

    filas.forEach(
      row => {

        const datos = [
          'CUICHAPA ' + row.pozo,
          row.estado || '',
          Number(row.bph || 0)
        ];

        row.celdas.forEach(
          c => {

            datos.push(
              c.valor === null ||
              c.valor === undefined
                ? null
                : Number(c.valor)
            );
          }
        );

        datos.push(
          Number(row.descuento || 0)
        );

        const ultimo =
          row.celdas[
            row.celdas.length - 1
          ]?.valor;

        datos.push(
          ultimo === null ||
          ultimo === undefined
            ? null
            : Number(ultimo)
        );

        const excelRow =
          ws.addRow(datos);

        excelRow.eachCell(
          {includeEmpty:true},
          cell => {

            cell.alignment = {
              horizontal:'center',
              vertical:'middle'
            };

            cell.border = {
              top:{
                style:'thin',
                color:{argb:'FFD9E2F3'}
              },
              left:{
                style:'thin',
                color:{argb:'FFD9E2F3'}
              },
              bottom:{
                style:'thin',
                color:{argb:'FFD9E2F3'}
              },
              right:{
                style:'thin',
                color:{argb:'FFD9E2F3'}
              }
            };
          }
        );

        /* BPH */
        excelRow.getCell(3).numFmt =
          '0.00';

        /* Horas */
        row.celdas.forEach(
          (c,i) => {

            const cell =
              excelRow.getCell(
                4 + i
              );

            cell.numFmt =
              '0.0';

            /*
             * Último nivel REAL:
             * misma identificación del Balance.
             */
            if(c.ultimoReal){

              cell.fill = {
                type:'pattern',
                pattern:'solid',
                fgColor:{argb:'FFC6EFCE'}
              };

              cell.font = {
                bold:true,
                color:{argb:'FF006100'}
              };
            }

            /*
             * Riesgo para proyecciones.
             */
            if(!c.ultimoReal){

              const riesgo =
                claseRiesgoBbl(
                  c.valor
                );

              const colores = {
                'riesgo-1':'FFFFF2CC',
                'riesgo-2':'FFFCE4D6',
                'riesgo-3':'FFF4B084',
                'riesgo-4':'FFFF6666'
              };

              if(colores[riesgo]){

                cell.fill = {
                  type:'pattern',
                  pattern:'solid',
                  fgColor:{
                    argb:
                      colores[riesgo]
                  }
                };
              }
            }
          }
        );

        excelRow.getCell(
          headers.length - 1
        ).numFmt = '0.00';

        excelRow.getCell(
          headers.length
        ).numFmt = '0.0';
      }
    );

    /* ---------- DIMENSIONES ---------- */

    ws.getColumn(1).width = 17;
    ws.getColumn(2).width = 15;
    ws.getColumn(3).width = 10;

    for(
      let i = 4;
      i <= 3 + horas.length;
      i++
    ){
      ws.getColumn(i).width = 10;
    }

    ws.getColumn(
      headers.length - 1
    ).width = 17;

    ws.getColumn(
      headers.length
    ).width = 15;

    ws.views = [{
      state:'frozen',
      xSplit:3,
      ySplit:4
    }];

    ws.autoFilter = {
      from:{
        row:4,
        column:1
      },
      to:{
        row:4,
        column:headers.length
      }
    };

    ws.pageSetup = {
      orientation:'landscape',
      fitToPage:true,
      fitToWidth:1,
      fitToHeight:0,
      paperSize:9
    };

    /* ---------- DESCARGA ---------- */

    const buffer =
      await wb.xlsx.writeBuffer();

    const blob =
      new Blob(
        [buffer],
        {
          type:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = url;

    a.download =
      'Balance_Frac_Tank_' +
      ymd(ref) +
      '.xlsx';

    document.body.appendChild(a);

    a.click();

    a.remove();

    setTimeout(
      () =>
        URL.revokeObjectURL(url),
      1000
    );

    if(status){
      status.textContent =
        '✓ Balance FT descargado correctamente';
    }

  }catch(error){

    console.error(
      '[Balance FT Excel]',
      error
    );

    if(status){
      status.textContent =
        'Error: ' +
        (
          error?.message ||
          error
        );
    }

    alert(
      'No se pudo generar el Balance FT:\n' +
      (
        error?.message ||
        error
      )
    );
  }
}


function bindBalanceFtExcel(){

  const btn =
    document.getElementById(
      'btnBalanceFtExcel'
    );

  const fecha =
    document.getElementById(
      'balanceFtExcelFecha'
    );

  if(fecha && !fecha.value){

    fecha.value =
      ymd(
        fechaReferencia()
      );
  }

  if(
    btn &&
    !btn.dataset.balanceFtExcelBind
  ){

    btn.dataset.balanceFtExcelBind =
      '1';

    btn.addEventListener(
      'click',
      descargarBalanceFtExcel
    );
  }
}



function bind(){

  const fecha =
    document.getElementById(
      'bftFecha'
    );


  const hoy =
    document.getElementById(
      'bftHoy'
    );


  const m3 =
    document.getElementById(
      'bftM3'
    );


  const hora =
    document.getElementById(
      'bftHora'
    );


  const conv =
    document.getElementById(
      'bftConversion'
    );


  const guardar =
    document.getElementById(
      'bftGuardar'
    );


  const ampliar =
    document.getElementById(
      'bftAmpliar'
    );


  if(
    hora &&
    !hora.value
  ){

    const now =
      new Date();

    hora.value =
      hora24(now);
  }


  function convertir(){

    const valor =
      Math.max(
        0,
        num(m3?.value) || 0
      );


    if(conv){

      conv.textContent =
        (
          valor *
          BBL_POR_M3
        ).toFixed(2);
    }
  }


  m3?.addEventListener(
    'input',
    convertir
  );


  fecha?.addEventListener(
    'change',
    () => {

      const d =
        fechaDesdeInput(
          fecha.value
        );

      if(!d){
        return;
      }

      fechaConsulta = d;

      escucharRetiros();

      render();
    }
  );


  hoy?.addEventListener(
    'click',
    () => {

      fechaConsulta = null;

      escucharRetiros();

      render();
    }
  );


  guardar?.addEventListener(
    'click',
    guardarRetiro
  );


  ampliar?.addEventListener(
    'click',
    abrirBalanceAmpliado
  );


  convertir();
}


/* ==========================================================
   TOAST
   ========================================================== */

function toast(msg,error){

  const viejo =
    document.getElementById(
      'bftToast'
    );

  viejo?.remove();


  const el =
    document.createElement('div');

  el.id =
    'bftToast';

  el.className =
    'bft-toast ' +
    (
      error
        ? 'error'
        : 'ok'
    );

  el.textContent =
    msg;


  document.body.appendChild(el);


  requestAnimationFrame(
    () => el.classList.add('show')
  );


  setTimeout(
    () => {

      el.classList.remove('show');

      setTimeout(
        () => el.remove(),
        200
      );

    },
    3000
  );
}


/* ==========================================================
   RETIRO UPV
   ========================================================== */

async function guardarRetiro(){

  if(!db){

    toast(
      'Firebase todavía no está disponible.',
      true
    );

    return;
  }


  const pozo =
    normalizarPozo(
      document.getElementById(
        'bftPozo'
      )?.value
    );


  const m3 =
    num(
      document.getElementById(
        'bftM3'
      )?.value
    );


  const hora =
    document.getElementById(
      'bftHora'
    )?.value;


  if(!pozo){

    toast(
      'Selecciona el pozo.',
      true
    );

    return;
  }


  if(
    m3 === null ||
    m3 <= 0
  ){

    toast(
      'Ingresa los m³ retirados.',
      true
    );

    return;
  }


  if(
    !/^\d{2}:\d{2}$/.test(
      hora || ''
    )
  ){

    toast(
      'Selecciona la hora del retiro.',
      true
    );

    return;
  }


  const {inicio,fin} =
    rangoActual();


  const partes =
    hora.split(':');


  const hh =
    Number(partes[0]);

  const mm =
    Number(partes[1]);


  let momento =
    new Date(inicio);


  if(hh < 5){

    momento.setDate(
      momento.getDate() + 1
    );
  }


  momento.setHours(
    hh,
    mm,
    0,
    0
  );


  if(
    momento < inicio ||
    momento > fin
  ){

    toast(
      'La hora no pertenece a la jornada seleccionada.',
      true
    );

    return;
  }


  const bbls =
    m3 * BBL_POR_M3;


  const registro = {

    pozo,

    m3:Number(
      m3.toFixed(3)
    ),

    bbls:Number(
      bbls.toFixed(3)
    ),

    hora:hora24(momento),

    fecha:ymd(momento),

    timestamp:
      momento.getTime(),

    diaOperativo:
      claveJornada(
        fechaReferencia()
      ),

    source:'manual',

    createdAt:
      firebase.database
        .ServerValue
        .TIMESTAMP
  };


  try{

    const ref =
      db.ref(
        RUTA_RETIROS +
        '/' +
        registro.diaOperativo
      ).push();


    await ref.set(
      registro
    );


    toast(
      `Retiro aplicado: ${m3.toFixed(2)} m³ = ${bbls.toFixed(2)} BBL`
    );


    const input =
      document.getElementById(
        'bftM3'
      );

    if(input){
      input.value = '';
    }


  }catch(e){

    console.error(
      '[BALANCE_FT_V2] retiro:',
      e
    );


    toast(
      'No se pudo guardar el retiro.',
      true
    );
  }
}


/* ==========================================================
   FIREBASE - CONVERSIÓN
   ========================================================== */

function snapshotArray(snap){

  const obj =
    snap.val() || {};


  return Object.entries(obj)
    .map(
      ([id,value]) => ({
        id,
        ...(value || {})
      })
    );
}


/* ==========================================================
   FIREBASE - REPORTES
   ========================================================== */

function escucharReportes(){

  if(
    Array.isArray(
      window.AdminFirebase?.reportes
    )
  ){
    reportes =
      window.AdminFirebase.reportes.slice();

    reconstruirCache();

    console.log(
      '[BALANCE_FT_V2] reportes desde AdminFirebase:',
      reportes.length
    );

    render();
  }
}


/* ==========================================================
   FIREBASE - RETIROS
   ========================================================== */

function escucharRetiros(){

  if(!db){
    return;
  }


  if(retirosRef){

    try{
      retirosRef.off();
    }catch(e){}
  }


  const key =
    claveJornada(
      fechaReferencia()
    );


  retirosRef =
    db.ref(
      RUTA_RETIROS +
      '/' +
      key
    );


  retirosRef.on(
    'value',

    snap => {

      retiros =
        snapshotArray(snap)
          .map(
            x => ({

              ...x,

              pozo:
                normalizarPozo(
                  x.pozo
                ),

              fecha:
                new Date(
                  Number(
                    x.timestamp ||
                    x.createdAt
                  )
                )

            })
          )
          .filter(
            x =>
              !Number.isNaN(
                x.fecha.getTime()
              )
          );


      render();
    },

    error => {

      console.error(
        '[BALANCE_FT_V2] retiros:',
        error
      );

      retiros = [];

      render();
    }
  );
}


/* ==========================================================
   FIREBASE INIT
   ========================================================== */

function intentarFirebase(){

  if(inicializadoFirebase){
    return;
  }


  const adminDb =
    window.AdminFirebase?.db;


  if(
    adminDb &&
    typeof adminDb.ref === 'function'
  ){

    db =
      adminDb;

    inicializadoFirebase =
      true;


    /*
     * Aprovechar datos que ya tenga el Admin.
     */
    if(
      Array.isArray(
        window.AdminFirebase?.reportes
      )
    ){

      reportes =
        window.AdminFirebase.reportes.slice();

      reconstruirCache();
    }


    escucharReportes();

    escucharRetiros();

    render();


    console.log(
      '[BALANCE_FT_V2] ✅ iniciado'
    );


    return;
  }


  /*
   * Fallback directo.
   */
  try{

    if(
      window.firebase &&
      firebase.apps?.length
    ){

      db =
        firebase.database();

      inicializadoFirebase =
        true;

      escucharReportes();

      escucharRetiros();

      render();


      console.log(
        '[BALANCE_FT_V2] ✅ Firebase directo'
      );
    }

  }catch(e){}
}


/* ==========================================================
   INIT
   ========================================================== */

function init(){

  /*
   * DOCUMENTOS ONLY:
   * si existe un Balance FT montado por una versión anterior
   * o por caché, retirarlo inmediatamente.
   */
  const balanceVisualExistente =
    document.getElementById(
      'balanceFtRoot'
    );

  if(balanceVisualExistente){
    balanceVisualExistente.remove();
  }

  /*
   * BALANCE FT:
   * la vista visual fue retirada de la plataforma.
   *
   * Se conserva toda la lógica interna porque Documentos
   * utiliza este mismo motor para generar el Excel.
   */
  // montar();
  // render();

  bindBalanceFtExcel();


  /*
   * Sin límite de espera.
   */
  window.setInterval(
    intentarFirebase,
    500
  );


  intentarFirebase();


  timer =
    window.setInterval(
      render,
      60000
    );
}


if(
  document.readyState === 'loading'
){

  document.addEventListener(
    'DOMContentLoaded',
    init,
    {once:true}
  );

}else{

  init();
}


/* ==========================================================
   API
   ========================================================== */

window.BalanceFT = {

  render,

  getReportes(){
    return reportes.slice();
  },

  getRetiros(){
    return retiros.slice();
  },

  getFecha(){
    return fechaReferencia();
  },

  BBL_POR_M3
};

})();
