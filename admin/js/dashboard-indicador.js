(function(){
  'use strict';


  /* INDICADOR_HELPERS_V1 */

  const POZOS_INDICADOR = new Set(
    window.CatalogoPozos?.ids || []
  );

  function normalizeText(value){
    return String(value || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function messageOf(report){
    return [
      report.msg,
      report.mensaje,
      report.message,
      report.texto,
      report.whatsappText,
      report.raw
    ].filter(Boolean).join('\n');
  }


  function reportDate(report){
    const candidates = [
      report.fecha,
      report.date,
      report.createdAt,
      report.timestamp,
      report.ts,
      report.fechaHora,
      report.datetime,
      report.sentAt,
      report.whatsappSentAt,
      report.horaServidor
    ];

    for(const candidate of candidates){
      if(candidate === null || candidate === undefined || candidate === ''){
        continue;
      }

      if(candidate instanceof Date && !isNaN(candidate)){
        return candidate;
      }

      if(typeof candidate === 'number'){
        const millis =
          candidate < 100000000000
            ? candidate * 1000
            : candidate;

        const date = new Date(millis);

        if(!isNaN(date)){
          return date;
        }
      }

      if(typeof candidate === 'string'){
        const clean = candidate.trim();

        if(!clean){
          continue;
        }

        const ymd = clean.match(
          /\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/
        );

        if(ymd){
          const date = new Date(
            Number(ymd[1]),
            Number(ymd[2]) - 1,
            Number(ymd[3])
          );

          if(!isNaN(date)){
            return date;
          }
        }

        const dmy = clean.match(
          /\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/
        );

        if(dmy){
          const date = new Date(
            Number(dmy[3]),
            Number(dmy[2]) - 1,
            Number(dmy[1])
          );

          if(!isNaN(date)){
            return date;
          }
        }

        const parsed = new Date(clean);

        if(!isNaN(parsed)){
          return parsed;
        }
      }
    }

    const message = messageOf(report);

    const messageYmd = message.match(
      /\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/
    );

    if(messageYmd){
      return new Date(
        Number(messageYmd[1]),
        Number(messageYmd[2]) - 1,
        Number(messageYmd[3])
      );
    }

    const messageDmy = message.match(
      /\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/
    );

    if(messageDmy){
      return new Date(
        Number(messageDmy[3]),
        Number(messageDmy[2]) - 1,
        Number(messageDmy[1])
      );
    }

    return null;
  }



  function normalizeWell(value){
    const clean = normalizeText(value)
      .replace(/\bPOZO\b/g, '')
      .replace(/\bPZO\b/g, '')
      .replace(/\bCUICHAPA\b/g, '')
      .replace(/[^0-9A-Z]/g, '');

    const match = clean.match(/([0-9]{1,3}[A-Z]?)/);

    if(!match) return '';

    return POZOS_INDICADOR.has(match[1])
      ? match[1]
      : '';
  }

  function wellFromReport(report, message){
    const values = [
      report.pozo,
      report.pozoNombre,
      report.well,
      report.wellName,
      report.numeroPozo,
      report.numPozo,
      report.lugar
    ];

    for(const value of values){
      const well = normalizeWell(value);
      if(well) return well;
    }

    const match = String(message || '').match(
      /\b(?:POZO|PZO|CUICHAPA)\s*[:#-]?\s*([0-9]{1,3}\s*[A-Z]?)\b/i
    );

    return match
      ? normalizeWell(match[1])
      : '';
  }


  function parsedReport(report){
    try{
      if(window.AdminExportaciones?.parsed){
        return window.AdminExportaciones.parsed(report) || {};
      }

      if(window.AdminUtils?.parseMsg){
        return window.AdminUtils.parseMsg(report) || {};
      }
    }catch(error){
      console.warn('[INDICADOR] parseMsg:', error);
    }

    return {};
  }

  function levelCm(report){
    const direct =
      report.nivel?.ctm ||
      report.nivel?.nivel ||
      report.ctm ||
      report.nivelCtm ||
      '';

    if(String(direct).trim()){
      return String(direct).trim();
    }

    const message=messageOf(report);

    const match=
      message.match(/CTM\s*:\s*([0-9]+(?:[.,][0-9]+)?)/i) ||
      message.match(/CENT[IÍ]METROS?\s*:\s*([0-9]+(?:[.,][0-9]+)?)/i) ||
      message.match(/\bCM\s*:\s*([0-9]+(?:[.,][0-9]+)?)/i);

    return match ? match[1] : '';
  }

  function hasFracTankLevel(report){
    try{
      if(window.AdminExportaciones?.hasNivelFracTank){
        return Boolean(
          window.AdminExportaciones.hasNivelFracTank(report)
        );
      }
    }catch(error){
      console.warn('[INDICADOR] hasNivelFracTank:', error);
    }

    const message=messageOf(report);

    const block=
      /NIVEL\s+(?:DE\s+)?(?:FRAC\s*TANK|PRESA\s*MET[ÁA]LICA)/i
        .test(message);

    return block && levelCm(report) !== '';
  }

  function isFracTank(report, message){
    const data=parsedReport(report);

    const flow=normalizeText(
      report.co?.fluye ||
      report.fluye ||
      data.fluye ||
      ''
    );

    return Boolean(
      flow === 'FT' ||
      flow.includes('FRAC TANK') ||
      /FLUYE\s*:\s*FT\b/i.test(message) ||
      /FLUYE\s+FT\b/i.test(message)
    );
  }


  function calculateIndicator(rows, range){
    const groups=new Map();

    rows.forEach(report=>{
      const date=reportDate(report);

      if(
        !date ||
        !range?.start ||
        !range?.end ||
        date < range.start ||
        date > range.end
      ){
        return;
      }

      const raw=messageOf(report);
      const message=normalizeText(raw);

      const isVisit=
        message.includes('REPORTE DE VISITA');

      const isGuard=
        message.includes('NIVELES DE GUARDIA');

      if(!isVisit && !isGuard){
        return;
      }

      const well=wellFromReport(report,raw);

      if(!well){
        return;
      }

      const day=[
        date.getFullYear(),
        String(date.getMonth()+1).padStart(2,'0'),
        String(date.getDate()).padStart(2,'0')
      ].join('-');

      const key=day+'|'+well;

      if(!groups.has(key)){
        groups.set(key,{
          fecha:day,
          pozo:well,
          super:0,
          nivel:0
        });
      }

      const group=groups.get(key);

      if(isGuard){
        group.nivel+=1;
      }

      if(isVisit){
        group.super+=1;

        if(
          isFracTank(report,raw) &&
          hasFracTankLevel(report)
        ){
          group.nivel+=1;
        }
      }
    });

    let vrt=0;
    let superTotal=0;

    const detail=[];

    groups.forEach(group=>{
      /*
       * REGLA OFICIAL DEL EXCEL
       *
       * Cada grupo representa una fila:
       * FECHA + POZO
       *
       * VR = NIVEL - SUPER
       * SM = VR + SUPER
       */
      /*
       * REGLA OFICIAL:
       *
       * VR = NIVEL - SUPER
       * Solo los VR positivos participan en VRT.
       */
      const vr=group.nivel-group.super;
      const vrPositivo=vr>0 ? vr : 0;

      vrt+=vrPositivo;
      superTotal+=group.super;

      detail.push({
        ...group,
        vr,
        vrPositivo
      });
    });

    /*
     * Totales finales:
     *
     * VRT = suma de todos los VR positivos
     * SMT = SUPER TOTAL + VRT
     */
    const smt=superTotal+vrt;

    return {
      vrt,
      smt,
      superTotal,
      detail
    };
  }


  /* INDICADOR_TABLA_OFICIAL_V1 */

  function numberFromText(value){
    const clean=String(value || '')
      .replace(/,/g,'')
      .match(/-?\d+(?:\.\d+)?/);

    return clean ? Number(clean[0]) : 0;
  }

  function percentValue(realizado,programado){
    if(!programado) return '0.00%';

    return (
      (Number(realizado || 0) / Number(programado)) * 100
    ).toFixed(2) + '%';
  }

  /*
   * PROGRAMADO PROPORCIONAL PARA MODO PERSONALIZADO
   *
   * Programado diario =
   * total mensual / días reales del mes.
   *
   * Si el intervalo cruza de un mes a otro, cada día utiliza
   * la cantidad real de días del mes al que pertenece.
   */
  function proratedProgramado(monthlyTotal,range){
    if(
      !range?.start ||
      !range?.end ||
      range.start > range.end
    ){
      return Number(monthlyTotal || 0);
    }

    const cursor=new Date(range.start);
    cursor.setHours(0,0,0,0);

    const finalDate=new Date(range.end);
    finalDate.setHours(0,0,0,0);

    let total=0;

    while(cursor <= finalDate){
      const daysInMonth=new Date(
        cursor.getFullYear(),
        cursor.getMonth()+1,
        0
      ).getDate();

      total+=Number(monthlyTotal || 0)/daysInMonth;
      cursor.setDate(cursor.getDate()+1);
    }

    return Number(total.toFixed(2));
  }

  function formatProgramado(value){
    const number=Number(value || 0);

    return number.toLocaleString('es-MX',{
      minimumFractionDigits:
        Number.isInteger(number) ? 0 : 2,

      maximumFractionDigits:2
    });
  }

  function monthlyCard(){
    const titles=[
      ...document.querySelectorAll('h1,h2,h3,h4,p,span')
    ];

    const title=titles.find(el=>
      normalizeText(el.textContent)
        .includes('AVANCE OPERATIVO POR PERIODO')
    );

    if(!title) return null;

    return title.closest(
      'section, article, .panel, .card, .dashboard-card'
    ) || title.parentElement?.parentElement;
  }

  function monthlyTotalsFromDOM(card){
    const totals={
      super:0,
      nivel:0,
      trabajo:0,
      drena:0,
      aforo:0
    };

    if(!card) return totals;

    const tables=[
      ...card.querySelectorAll('table')
    ];

    const table=tables.find(candidate=>{
      if(candidate.classList.contains('indicador-oficial-table')){
        return false;
      }

      const candidateHeaders=[
        ...candidate.querySelectorAll('thead th')
      ].map(th=>normalizeText(th.textContent));

      return (
        candidateHeaders.includes('SUPER') &&
        candidateHeaders.includes('NIVEL') &&
        candidateHeaders.some(h=>h.includes('TRABAJO')) &&
        candidateHeaders.some(h=>h.includes('DRENA')) &&
        candidateHeaders.some(h=>h.includes('AFORO'))
      );
    });

    if(!table) return totals;

    const headers=[
      ...table.querySelectorAll('thead th')
    ].map(th=>normalizeText(th.textContent));

    const row=table.querySelector('tbody tr');
    if(!row) return totals;

    const cells=[...row.querySelectorAll('td')];

    headers.forEach((header,index)=>{
      const value=numberFromText(cells[index]?.textContent);

      if(header === 'SUPER') totals.super=value;
      if(header === 'NIVEL') totals.nivel=value;
      if(header.includes('TRABAJO')) totals.trabajo=value;
      if(header.includes('DRENA')) totals.drena=value;
      if(header.includes('AFORO')) totals.aforo=value;
    });

    return totals;
  }

  function ensureIndicatorStyles(){
    if(document.getElementById('indicadorOficialStyles')){
      return;
    }

    const style=document.createElement('style');
    style.id='indicadorOficialStyles';

    style.textContent=`
      .indicador-oficial{
        margin:18px 26px 22px;
        border:1px solid #d8e2ef;
        border-radius:16px;
        background:#fff;
        overflow:hidden;
        box-shadow:0 8px 22px rgba(15,42,74,.06);
      }

      .indicador-oficial-head{
        padding:18px 20px 14px;
        border-bottom:1px solid #e3eaf3;
        background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);
      }

      .indicador-oficial-kicker{
        margin:0 0 5px;
        color:#35649a;
        font-size:11px;
        font-weight:800;
        letter-spacing:1.4px;
        text-transform:uppercase;
      }

      .indicador-oficial-title{
        margin:0;
        color:#102a4c;
        font-size:19px;
        font-weight:800;
      }

      .indicador-oficial-sub{
        margin:5px 0 0;
        color:#6b7d92;
        font-size:13px;
      }

      .indicador-oficial-scroll{
        width:100%;
        overflow-x:auto;
      }

      .indicador-oficial-table{
        width:100%;
        min-width:720px;
        border-collapse:collapse;
      }

      .indicador-oficial-table th{
        padding:13px 16px;
        background:#eff5fb;
        color:#48627f;
        font-size:11px;
        font-weight:800;
        letter-spacing:.5px;
        text-align:center;
        text-transform:uppercase;
        border-bottom:1px solid #d8e2ef;
      }

      .indicador-oficial-table th:first-child{
        text-align:left;
      }

      .indicador-oficial-table td{
        padding:14px 16px;
        color:#1f3654;
        font-size:14px;
        border-bottom:1px solid #e7edf5;
        text-align:center;
      }

      .indicador-oficial-table td:first-child{
        text-align:left;
        font-weight:700;
      }

      .indicador-oficial-table tbody tr:last-child td{
        border-bottom:0;
      }

      .indicador-oficial-number{
        display:inline-flex;
        min-width:72px;
        min-height:38px;
        align-items:center;
        justify-content:center;
        padding:7px 12px;
        border:1px solid #d2dfed;
        border-radius:11px;
        background:#f4f8fc;
        color:#1c4f8c;
        font-size:17px;
        font-weight:800;
      }

      .indicador-oficial-percent{
        font-weight:800;
        color:#1b5d91;
      }

      .indicador-oficial-total td{
        background:#eef5ff;
        color:#123f73;
        font-weight:800;
      }

      .indicador-oficial-total .indicador-oficial-number{
        background:#dfeeff;
        border-color:#bfd7f3;
        color:#0d4f91;
      }

      @media(max-width:700px){
        .indicador-oficial{
          margin:14px 12px 18px;
        }

        .indicador-oficial-head{
          padding:16px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function renderOfficialTable(data){
    const card=monthlyCard();
    if(!card) return;

    ensureIndicatorStyles();

    const monthlyTotals=monthlyTotalsFromDOM(card);

    const isCustom=
      data?.mode === 'custom';

    const range=data?.range || null;

    const smt=Number(data?.smt || 0);
    const aforo=Number(monthlyTotals.aforo || 0);
    const drena=Number(monthlyTotals.drena || 0);
    const trabajo=Number(monthlyTotals.trabajo || 0);

    const totalRealizado=
      smt +
      aforo +
      drena +
      trabajo;

    const monthlyProgramado={
      supervision:1525,
      aforo:183,
      drena:54,
      trabajo:140
    };

    const rows=[
      {
        actividad:'Supervisión y monitoreo a pozos',
        programado:isCustom
          ? proratedProgramado(
              monthlyProgramado.supervision,
              range
            )
          : monthlyProgramado.supervision,
        realizado:smt
      },
      {
        actividad:'Aforo/Medición a pozo (batería-FT)',
        programado:isCustom
          ? proratedProgramado(
              monthlyProgramado.aforo,
              range
            )
          : monthlyProgramado.aforo,
        realizado:aforo
      },
      {
        actividad:'Drenar líquidos en red de BN',
        programado:isCustom
          ? proratedProgramado(
              monthlyProgramado.drena,
              range
            )
          : monthlyProgramado.drena,
        realizado:drena
      },
      {
        actividad:'Trabajo a pozo',
        programado:isCustom
          ? proratedProgramado(
              monthlyProgramado.trabajo,
              range
            )
          : monthlyProgramado.trabajo,
        realizado:trabajo
      }
    ];

    const totalProgramado=rows.reduce(
      (sum,row)=>sum+Number(row.programado || 0),
      0
    );

    let box=document.getElementById('indicadorOficialBox');

    if(!box){
      box=document.createElement('section');
      box.id='indicadorOficialBox';
      box.className='indicador-oficial';

      const firstTable=card.querySelector('table');
      const insertPoint=
        firstTable?.closest('.table-wrap,.table-scroll') ||
        firstTable;

      if(insertPoint){
        insertPoint.parentNode.insertBefore(box,insertPoint);
      }else{
        card.appendChild(box);
      }
    }

    box.innerHTML=`
      <div class="indicador-oficial-head">
        <p class="indicador-oficial-kicker">
          Indicador operativo oficial
        </p>

        <h3 class="indicador-oficial-title">
          Cumplimiento de actividades
        </h3>

        <p class="indicador-oficial-sub">
          Actualizado automáticamente con los reportes del periodo seleccionado.
        </p>
      </div>

      <div class="indicador-oficial-scroll">
        <table class="indicador-oficial-table">
          <thead>
            <tr>
              <th>Actividad</th>
              <th>Total programado</th>
              <th>Total realizado</th>
              <th>Efectividad (%)</th>
            </tr>
          </thead>

          <tbody>
            ${rows.map(row=>`
              <tr>
                <td>${row.actividad}</td>

                <td>
                  <span class="indicador-oficial-number">
                    ${formatProgramado(row.programado)}
                  </span>
                </td>

                <td>
                  <span class="indicador-oficial-number">
                    ${row.realizado.toLocaleString('es-MX')}
                  </span>
                </td>

                <td class="indicador-oficial-percent">
                  ${percentValue(
                    row.realizado,
                    row.programado
                  )}
                </td>
              </tr>
            `).join('')}

            <tr class="indicador-oficial-total">
              <td>Resultado del indicador</td>

              <td>
                <span class="indicador-oficial-number">
                  ${formatProgramado(totalProgramado)}
                </span>
              </td>

              <td>
                <span class="indicador-oficial-number">
                  ${totalRealizado.toLocaleString('es-MX')}
                </span>
              </td>

              <td class="indicador-oficial-percent">
                ${percentValue(
                  totalRealizado,
                  totalProgramado
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  window.AdminDashboardIndicador = {
    initialized: false,

    init(){
      if(this.initialized) return;
      this.initialized = true;
      this.waitForMonthlyData();
    },

    waitForMonthlyData(){
      const timer=setInterval(()=>{
        const monthly=window.AdminDashboardMensual;

        if(
          !monthly ||
          !Array.isArray(monthly.rows) ||
          typeof monthly.render !== 'function'
        ){
          return;
        }

        clearInterval(timer);

        const originalRender=monthly.render;

        monthly.render=function(){
          const result=originalRender.apply(this,arguments);

          window.AdminDashboardIndicador.render();

          return result;
        };

        this.render();
      },500);
    },

    render(){
      const monthly=window.AdminDashboardMensual;

      if(
        !monthly ||
        !Array.isArray(monthly.rows) ||
        typeof monthly.getActiveRange !== 'function'
      ){
        return;
      }

      const range=monthly.getActiveRange();
      const result=calculateIndicator(
        monthly.rows,
        range
      );

      this.vrt=result.vrt;
      this.smt=result.smt;
      this.superTotal=result.superTotal;
      this.detail=result.detail;

      renderOfficialTable({
        vrt:this.vrt,
        smt:this.smt,
        detail:this.detail,
        mode:monthly.mode,
        range
      });

      const positivos=this.detail.filter(x=>x.vr>0);
      const negativos=this.detail.filter(x=>x.vr<0);
      const iguales=this.detail.filter(x=>x.vr===0);

      console.log('[INDICADOR OPERATIVO]',{
        SUPER_TOTAL:this.superTotal,
        VRT:this.vrt,
        SMT:this.smt,
        comprobacionSMT:this.superTotal+this.vrt,
        grupos:this.detail.length,
        gruposPositivos:positivos.length,
        gruposNegativos:negativos.length,
        gruposIguales:iguales.length,
        sumaPositivos:positivos.reduce((s,x)=>s+x.vr,0),
        sumaNegativos:negativos.reduce((s,x)=>s+x.vr,0)
      });

      console.table(
        this.detail
          .filter(x=>x.vr!==0)
          .sort((a,b)=>a.fecha.localeCompare(b.fecha))
      );
    }  };

  function start(){
    window.AdminDashboardIndicador.init();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  }else{
    start();
  }
})();
