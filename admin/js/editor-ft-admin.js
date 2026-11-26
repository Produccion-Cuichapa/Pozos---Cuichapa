/*
 * EDITOR ADMINISTRATIVO FT — FASE VISUAL
 * No escribe en Firebase.
 * No modifica reportes originales.
 */

(function(){
  'use strict';

  if(window.EditorFTAdmin) return;

  const ESTADOS = [
    'ABIERTO',
    'CERRADO',
    'INTERMITENTE'
  ];

  function escapar(valor){
    return String(valor ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function crearCampo(nombre,tipo,valor=''){
    return `
      <label class="eft-campo">
        <span>${escapar(nombre)}</span>
        <input type="${tipo}"
               value="${escapar(valor)}">
      </label>
    `;
  }


  /* EDITOR_FT_ADMIN_863 — SELECTOR INTEGRADO */
  function abrir(datos={}){
    const usuario=window.AdminAuth?.current?.user;
    const correo=window.firebase?.auth?.()
      ?.currentUser?.email?.toLowerCase();

    if(
      usuario!=='Admin' ||
      correo!=='admin@cuichapa.local'
    ){
      console.warn('Editor FT: acceso no autorizado');
      return;
    }

    const lecturas=Array.isArray(datos.lecturas)
      ? datos.lecturas
      : [];

    const anterior=document.getElementById(
      'editorFtAdminModal'
    );

    if(anterior) anterior.remove();

    const modal=document.createElement('div');
    modal.id='editorFtAdminModal';

    modal.style.cssText=`
      position:fixed;
      inset:0;
      z-index:99999;
      background:rgba(10,20,40,.75);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      overflow:auto;
    `;

    const opciones=lecturas.map((item,i)=>`
      <option value="${i}">
        Pozo ${escapar(item.pozo)}
      </option>
    `).join('');

    modal.innerHTML=`
      <div style="
        background:#fff;
        color:#172b4d;
        width:min(760px,100%);
        max-height:90vh;
        overflow:auto;
        border-radius:16px;
        padding:24px;
        box-shadow:0 20px 60px #0004;
      ">
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:16px;
        ">
          <h2>Corrección administrativa FT</h2>
          <button type="button"
                  id="eftCerrar">✕</button>
        </div>

        <p>
          Selecciona el pozo y revisa sus datos.
          El guardado permanece deshabilitado.
        </p>

        <form id="eftFormulario">
          <label class="eft-campo">
            <span>Seleccionar pozo FT</span>
            <select id="eftPozo">
              <option value="">Seleccionar pozo</option>
              ${opciones}
            </select>
          </label>

          <!-- EDITOR_FT_ADMIN_872 — DATOS ORIGINALES -->
          <div id="eftLecturaOriginal"
               role="status"
               style="
                 padding:14px;
                 margin:12px 0 18px;
                 background:#f1f5f9;
                 border:1px solid #cbd5e1;
                 border-radius:10px;
               ">
            <strong>Lectura original del recorredor</strong>
            <div id="eftVolumenOriginal"
                 style="margin-top:8px;font-size:20px">
              Selecciona un pozo
            </div>
            <small>Dato informativo. No se modifica.</small>
          </div>

          <div class="eft-grid">
            ${crearCampo('Reporte original','text')}
            ${crearCampo('Nivel (cm)','number')}
            ${crearCampo('Nuevo volumen (BBLS)','number')}
            ${crearCampo('Aforo (BPH)','number')}
            ${crearCampo('Fecha de lectura','date')}
            ${crearCampo('Hora de lectura','time')}

            <label class="eft-campo">
              <span>Estado operativo</span>
              <select>
                <option value="">Seleccionar</option>
                ${ESTADOS.map(x=>
                  `<option value="${x}">${x}</option>`
                ).join('')}
              </select>
            </label>

            ${crearCampo('Pozo origen','text')}
            ${crearCampo('Pozo destino','text')}
          </div>

          <label class="eft-campo">
            <span>Motivo de corrección</span>
            <textarea rows="3"
              placeholder="Describe el motivo"></textarea>
          </label>

          <div style="
            display:flex;
            gap:12px;
            justify-content:flex-end;
            margin-top:20px;
          ">
            <button type="button" id="eftCancelar">
              Cancelar
            </button>
            <button type="button" disabled>
              Guardar corrección
            </button>
          </div>
        </form>
      </div>
    `;

    const estilo=document.createElement('style');
    estilo.textContent=`
      #editorFtAdminModal .eft-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:14px;
      }
      #editorFtAdminModal .eft-campo{
        display:flex;
        flex-direction:column;
        gap:6px;
        margin-bottom:14px;
        font-size:14px;
        font-weight:600;
      }
      #editorFtAdminModal input,
      #editorFtAdminModal select,
      #editorFtAdminModal textarea{
        width:100%;
        box-sizing:border-box;
        border:1px solid #cbd5e1;
        border-radius:8px;
        padding:10px;
        font:inherit;
      }
      @media(max-width:600px){
        #editorFtAdminModal .eft-grid{
          grid-template-columns:1fr;
        }
      }
    `;

    modal.appendChild(estilo);
    document.body.appendChild(modal);

    const cerrar=()=>modal.remove();

    modal.querySelector('#eftCerrar')
      .addEventListener('click',cerrar);

    modal.querySelector('#eftCancelar')
      .addEventListener('click',cerrar);

    modal.querySelector('#eftFormulario')
      .addEventListener('submit',async e=>{
        e.preventDefault();

        const cliente=window.ClienteCorreccionesFT;

        if(!cliente || cliente.escrituraHabilitada!==true){
          return;
        }

        try{
          const datos=obtenerDatosCorreccion();
          await cliente.guardar(datos);
        }catch(error){
          console.error('FT_CORRECCION_RECHAZADA',error);
        }
      });

    modal.addEventListener('click',e=>{
      if(e.target===modal) cerrar();
    });

    const selector=modal.querySelector('#eftPozo');
    const inputs=modal.querySelectorAll(
      '.eft-grid input'
    );


    /* EDITOR_FT_ADMIN_865 — VALIDACIÓN LOCAL */
    const formulario=modal.querySelector('#eftFormulario');

    const aviso=document.createElement('div');
    aviso.id='eftValidacion';
    aviso.setAttribute('role','status');
    aviso.style.cssText=`
      margin-top:12px;
      padding:12px;
      border-radius:8px;
      background:#f1f5f9;
      color:#334155;
      font-size:13px;
    `;
    aviso.textContent=
      'Selecciona un pozo para preparar una corrección.';

    formulario.appendChild(aviso);

    const validar=()=>{
      const seleccion=selector.value;

      if(seleccion===''){
        aviso.textContent='Selecciona un pozo FT.';
        return false;
      }

      const campos=modal.querySelectorAll(
        '.eft-grid input'
      );

      const nivel=campos[1].value.trim();
      const volumen=campos[2].value.trim();
      const aforo=campos[3].value.trim();
      const fecha=campos[4].value;
      const hora=campos[5].value;

      const estado=modal.querySelector(
        '.eft-grid select'
      ).value;

      const motivo=modal.querySelector(
        'textarea'
      ).value.trim();

      const errores=[];

      const numeroValido=v=>
        v!=='' &&
        Number.isFinite(Number(v)) &&
        Number(v)>=0;

      if(nivel!=='' && !numeroValido(nivel)){
        errores.push('Nivel inválido');
      }

      if(volumen!=='' && !numeroValido(volumen)){
        errores.push('Volumen inválido');
      }

      if(aforo!=='' && !numeroValido(aforo)){
        errores.push('Aforo inválido');
      }

      if(nivel==='' && volumen==='' && aforo==='' &&
         estado==='' ){
        errores.push('Indica al menos un dato a corregir');
      }

      if(!fecha || !hora){
        errores.push('Fecha y hora obligatorias');
      }

      if(motivo.length<10){
        errores.push(
          'El motivo debe tener al menos 10 caracteres'
        );
      }

      if(errores.length){
        aviso.textContent=errores.join(' · ');
        aviso.style.background='#fff1f2';
        aviso.style.color='#9f1239';
        return false;
      }

      aviso.textContent=
        'Datos válidos para revisión. '+
        'El guardado sigue deshabilitado.';

      aviso.style.background='#eff6ff';
      aviso.style.color='#1d4ed8';

      return true;
    };

    formulario.addEventListener('input',validar);
    formulario.addEventListener('change',validar);

    /* EDITOR_FT_ADMIN_949 — REPORTE ORIGINAL PROTEGIDO */
    const campoReporteOriginal=modal.querySelector(
      '.eft-grid input'
    );

    if(campoReporteOriginal){
      campoReporteOriginal.readOnly=true;
      campoReporteOriginal.setAttribute(
        'aria-label','Identificador del reporte original'
      );
    }

    /* EDITOR_FT_ADMIN_945 — DATOS DE CORRECCION */
    function obtenerDatosCorreccion(){
      if(!validar()){
        throw new Error('FT_DATOS_INVALIDOS');
      }

      const indice=Number(selector.value);
      const item=lecturas[indice];

      const reporteId=
        item?.reporteId ||
        item?.reporte?.id;

      if(!item || !reporteId){
        throw new Error('FT_REPORTE_ORIGINAL_NO_DISPONIBLE');
      }

      const campos=modal.querySelectorAll('.eft-grid input');

      const numero=v=>{
        const valor=v.trim();
        return valor==='' ? null : Number(valor);
      };

      return {
        pozo:String(item.pozo),
        reporteId:String(reporteId),
        nivel:numero(campos[1].value),
        volumen:numero(campos[2].value),
        bph:numero(campos[3].value),
        fecha:campos[4].value,
        hora:campos[5].value,
        estado:modal.querySelector('.eft-grid select').value,
        origen:campos[6]?.value.trim() || '',
        destino:campos[7]?.value.trim() || '',
        motivo:modal.querySelector('textarea').value.trim()
      };
    }

    /* EDITOR_FT_ADMIN_866 — LIMPIEZA POR POZO */
    selector.addEventListener('change',()=>{
      const item=selector.value===''
        ? null
        : lecturas[Number(selector.value)];

      const estado=modal.querySelector(
        '.eft-grid select'
      );

      const motivo=modal.querySelector('textarea');

      inputs.forEach(input=>input.value='');

      if(campoReporteOriginal){
        campoReporteOriginal.value=
          item?.reporteId || item?.reporte?.id || '';
      }

      if(estado) estado.value='';
      if(motivo) motivo.value='';

      const aviso=modal.querySelector('#eftValidacion');

      if(aviso){
        aviso.textContent=item
          ? 'Lectura original cargada. '+
            'Introduce los valores a corregir.'
          : 'Selecciona un pozo FT.';

        aviso.style.background='#f1f5f9';
        aviso.style.color='#334155';
      }

      if(!item){
        const volumenOriginal=modal.querySelector(
          '#eftVolumenOriginal'
        );
        if(volumenOriginal){
          volumenOriginal.textContent='Selecciona un pozo';
        }
        return;
      }

      inputs[0].value=item.reporteId || '';
      inputs[0].readOnly=true;

      const volumenOriginal=modal.querySelector(
        '#eftVolumenOriginal'
      );

      if(volumenOriginal){
        volumenOriginal.textContent=
          item.volumen==null
            ? 'Sin volumen original disponible'
            : String(item.volumen)+' BBLS';
      }

      // El volumen nuevo se introduce manualmente.
      inputs[2].value='';

      if(Number.isFinite(item.fecha)){
        const d=new Date(item.fecha);

        const partes=new Intl.DateTimeFormat('en-CA',{
          timeZone:'America/Mexico_City',
          year:'numeric',
          month:'2-digit',
          day:'2-digit',
          hour:'2-digit',
          minute:'2-digit',
          hourCycle:'h23'
        }).formatToParts(d);

        const valor=tipo=>
          partes.find(x=>x.type===tipo)?.value||'';

        inputs[4].value=[
          valor('year'),valor('month'),valor('day')
        ].join('-');

        inputs[5].value=[
          valor('hour'),valor('minute')
        ].join(':');
      }
    });

  }

  window.EditorFTAdmin={
    abrir,
    version:'FASE_VISUAL_859',
    escrituraHabilitada:false
  };

})();
