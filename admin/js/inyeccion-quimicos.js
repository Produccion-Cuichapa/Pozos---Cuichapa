/* QUIMICOS_CONSUMOS_383 */

/* quimicos-medicion-v284 */
(function(){
  "use strict";

  const STORAGE = "cuichapa_quimicos_test_v284";

  const puntos = [
    {id:"187", nombre:"Pozo 187", producto:"Desparafinante – desemulsificante", diario:20},
    {id:"502", nombre:"Pozo 502", producto:"Agua", diario:160},
    {id:"139", nombre:"Pozo 139", producto:"Desemulsificante", diario:30},
    {id:"191-1", nombre:"Pozo 191 · Tótem 1", producto:"Agua", diario:75, alternado:true},
    {id:"191-2", nombre:"Pozo 191 · Tótem 2", producto:"Agua", diario:75, alternado:true},
    {id:"213", nombre:"Pozo 213", producto:"Desparafinante – desemulsificante", diario:20},
    {id:"172", nombre:"Pozo 172", producto:"Desemulsificante", diario:25},
    {id:"376", nombre:"Pozo 376", producto:"Desemulsificante", diario:20},
    {id:"ECO", nombre:"Trampa ECO", producto:"Inhibidor de hidratos", diario:35}
  ];

  const CAPACIDAD = 1000;

  function cargar(){
    try {
      const dato = JSON.parse(localStorage.getItem(STORAGE) || "{}");
      return dato && typeof dato === "object" ? dato : {};
    } catch(e){
      return {};
    }
  }

  let registros = cargar();

  function guardar(){
    localStorage.setItem(STORAGE, JSON.stringify(registros));
  }

  function fechaLocal(date){
    const d = date || new Date();
    const pad = n => String(n).padStart(2,"0");

    return d.getFullYear() + "-" +
      pad(d.getMonth()+1) + "-" +
      pad(d.getDate()) + "T" +
      pad(d.getHours()) + ":" +
      pad(d.getMinutes());
  }

  function escapar(s){
    return String(s).replace(/[&<>"']/g, c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[c]));
  }

  function activo191(){
    return registros.activo191 || null;
  }


  /* QUIMICOS_ESTADOS_OPERATIVOS_293 */


  /* QUIMICOS_PRIORIDAD_MANIOBRA_296 */

  function interpretarEstadoQuimicos(reporte){
    const co = reporte.co || {};
    const aforo = reporte.aforo || {};
    const control = reporte.controlOperativo || {};

    const maniobras = [
      reporte.maniobraPozo,
      reporte.guardiaManiobra,
      reporte.aforoManiobra,
      aforo.maniobraPozo,
      co.maniobraPozo,
      control.maniobraPozo
    ];

    const texto = [
      reporte.msg,
      reporte.mensaje,
      reporte.message,
      reporte.texto,
      reporte.observaciones,
      reporte.obs,
      reporte.descripcion
    ].filter(Boolean).join("\n");

    for(const valor of maniobras){
      const v = String(valor || "")
        .trim().toUpperCase();

      if(v === "CIERRE") return "CERRADO";
      if(v === "APERTURA") return "ABIERTO";
    }

    const m = texto.match(
      /MANIOBRA\s+REALIZADA\s*[:=-]?\s*(CIERRE|APERTURA)\b/i
    );

    if(m){
      return m[1].toUpperCase() === "CIERRE"
        ? "CERRADO"
        : "ABIERTO";
    }

    const estados = [
      reporte.estadoPozo,
      reporte.estadoActual,
      reporte.guardiaEstado,
      reporte.aforoEstado,
      aforo.estadoPozo,
      co.estadoPozo,
      co.estadoActual,
      control.estadoPozo,
      control.estadoActual
    ];

    const normalizar = window.AdminPozos
      ?.normalizeWellState
      ?.bind(window.AdminPozos);

    if(normalizar){
      for(const valor of estados){
        const estado = normalizar(valor);
        if(estado) return estado;
      }
    }

    const estadoTexto = texto.match(
      /(?:ESTADO\s+ACTUAL|ESTADO\s+DEL\s+POZO|ESTATUS\s+DEL\s+POZO)\s*[:=-]\s*(ABIERTO|CERRADO|INTERMITENTE)\b/i
    );

    if(estadoTexto && normalizar){
      return normalizar(estadoTexto[1]);
    }

    return window.AdminPozos
      ?.reportWellState?.(reporte) || "";
  }


  /* QUIMICOS_ESTADO_UNIFICADO_311 */

  function estadoOperativoQuimicos(p){
    if(p.id === "ECO"){
      return {
        estado:"NO CONFIGURADO",
        fecha:null,
        origen:"La Trampa ECO requiere estado propio"
      };
    }

    const eventos = eventosQuimicos(p);

    if(!eventos.length){
      return {
        estado:"SIN INFORMACIÓN",
        fecha:null,
        origen:"Sin eventos operativos con fecha válida"
      };
    }

    const ultimo = eventos[eventos.length - 1];

    return {
      estado:ultimo.estado,
      fecha:ultimo.fecha,
      origen:"Último reporte operativo con fecha válida"
    };
  }

  window.AdminQuimicosEstado = {
    consultar:estadoOperativoQuimicos,
    puntos:puntos.map(p=>({
      id:p.id,
      nombre:p.nombre,
      diario:p.diario
    }))
  };


  /* QUIMICOS_INTERVALOS_298 */


  /* QUIMICOS_FECHA_ISO_305 */

  function fechaEventoQuimicos(reporte){
    if(!reporte || typeof reporte !== "object"){
      return null;
    }

    const ahora = Date.now();

    function validar(valor){
      if(valor === null ||
         valor === undefined ||
         valor === ""){
        return null;
      }

      let t = null;

      if(typeof valor === "number"){
        t = valor;
      }else if(typeof valor === "string"){
        const texto = valor.trim();

        if(/^\d{13}$/.test(texto)){
          t = Number(texto);
        }else if(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(texto) &&
          /(?:Z|[+-]\d{2}:\d{2})$/i.test(texto)
        ){
          t = Date.parse(texto);
        }
      }

      return Number.isFinite(t) &&
        t > 0 &&
        t <= ahora
          ? t : null;
    }

    // Los reportes actuales guardan fecha ISO completa.
    const fuentes = [
      reporte.fecha,
      reporte.fechaHora,
      reporte.timestamp,
      reporte.createdAt,
      reporte.fechaMs,
      reporte.fechaISO,
      reporte.ts
    ];

    for(const valor of fuentes){
      const fecha = validar(valor);

      if(fecha !== null){
        return fecha;
      }
    }

    // No asumir medianoche cuando solo hay fecha.
    return null;
  }

  function eventosQuimicos(p){
    if(p.id === "ECO") return [];

    const motor = window.AdminPozos;
    const fb = window.AdminFirebase;

    if(!motor ||
       typeof motor.reportWell !== "function" ||
       !Array.isArray(fb?.reportes)){
      return [];
    }

    const buscado = p.alternado
      ? "191" : String(p.id);

    const eventos = [];

    for(const r of fb.reportes){
      if(!r) continue;

      let pozo;
      let estado;

      try{
        pozo = String(motor.reportWell(r) || "")
          .replace(/^POZO\s*[-:#]?\s*/i,"")
          .replace(/^0+(?=\d)/,"")
          .trim();

        estado = interpretarEstadoQuimicos(r);
      }catch(e){
        continue;
      }

      if(pozo !== buscado ||
         !["ABIERTO","CERRADO","INTERMITENTE"]
           .includes(estado)){
        continue;
      }

      const fecha = fechaEventoQuimicos(r);
      if(fecha === null) continue;

      eventos.push({
        fecha,
        estado,
        id:String(r.id || "")
      });
    }

    eventos.sort((a,b)=>
      a.fecha-b.fecha ||
      a.id.localeCompare(b.id)
    );

    return eventos;
  }

  function intervalosOperativosQuimicos(p,inicio,fin){
    const eventos = eventosQuimicos(p);

    const previo = eventos
      .filter(e=>e.fecha<=inicio)
      .at(-1);

    let estado = previo ? previo.estado : null;
    let cursor = inicio;
    let desconocido = false;
    const abiertos = [];

    for(const e of eventos){
      if(e.fecha <= inicio || e.fecha > fin) continue;

      if(e.fecha > cursor){
        if(estado === "ABIERTO"){
          abiertos.push([cursor,e.fecha]);
        }else if(estado !== "CERRADO"){
          desconocido = true;
        }
      }

      estado = e.estado;
      cursor = e.fecha;
    }

    if(fin > cursor){
      if(estado === "ABIERTO"){
        abiertos.push([cursor,fin]);
      }else if(estado !== "CERRADO"){
        desconocido = true;
      }
    }

    return {abiertos,desconocido,estado};
  }


  /* QUIMICOS_INTERVALOS_FO_351 */

  function historialFOQuimicos(id){
    const historial=Array.isArray(registros.eventosFO)
      ? registros.eventosFO.filter(x=>x && x.id===id)
      : [];

    return historial
      .map(x=>({
        id:x.id,
        tipo:x.tipo,
        fecha:new Date(x.fecha).getTime()
      }))
      .sort((a,b)=>a.fecha-b.fecha);
  }

  function intervalosFOQuimicos(id,inicio,fin){
    const eventos=historialFOQuimicos(id);
    const pausas=[];

    let fuera=false;
    let cursor=null;
    let valido=true;

    for(const e of eventos){
      if(!Number.isFinite(e.fecha) ||
         !["FO","REANUDAR"].includes(e.tipo)){
        valido=false;
        continue;
      }

      if(e.fecha>fin) continue;

      if(e.tipo==="FO"){
        if(fuera){
          valido=false;
          continue;
        }

        fuera=true;
        cursor=e.fecha;
      }else{
        if(!fuera){
          valido=false;
          continue;
        }

        if(e.fecha<cursor){
          valido=false;
          continue;
        }

        if(e.fecha>inicio){
          pausas.push([
            Math.max(cursor,inicio),
            Math.min(e.fecha,fin)
          ]);
        }

        fuera=false;
        cursor=null;
      }
    }

    if(fuera && cursor!==null && fin>inicio){
      pausas.push([
        Math.max(cursor,inicio),
        fin
      ]);
    }

    return {
      pausas:pausas.filter(([a,b])=>b>a),
      fuera,
      valido
    };
  }

  function descontarIntervalosFOQuimicos(
    intervalosAbiertos,pausas
  ){
    let resultado=intervalosAbiertos.map(
      ([a,b])=>[a,b]
    );

    for(const [pausaInicio,pausaFin] of pausas){
      const siguiente=[];

      for(const [a,b] of resultado){
        if(pausaFin<=a || pausaInicio>=b){
          siguiente.push([a,b]);
          continue;
        }

        if(pausaInicio>a){
          siguiente.push([a,pausaInicio]);
        }

        if(pausaFin<b){
          siguiente.push([pausaFin,b]);
        }
      }

      resultado=siguiente;
    }

    return resultado.filter(([a,b])=>b>a);
  }

  function calcular(p){
    const r = registros[p.id];

    if(!r ||
       !Number.isFinite(r.litros) ||
       !r.fecha){
      return null;
    }

    const inicio = new Date(r.fecha).getTime();
    const ahora = Date.now();

    if(!Number.isFinite(inicio) ||
       inicio > ahora){
      return null;
    }

    const activo = !p.alternado ||
      activo191() === p.id;

    if(p.id === "ECO"){
      return {
        restante:null,
        porcentaje:0,
        autonomia:null,
        fecha:r.fecha,
        litros:r.litros,
        activo:false,
        verificable:false,
        detalle:"Trampa ECO: falta definir su control operativo"
      };
    }

    /* QUIMICOS_CONSUMO_FO_353 */
    const fo = intervalosFOQuimicos(
      p.id,inicio,ahora
    );

    const opOriginal = intervalosOperativosQuimicos(
      p,inicio,ahora
    );

    const op = {
      ...opOriginal,
      abiertos:descontarIntervalosFOQuimicos(
        opOriginal.abiertos,
        fo.pausas
      ),
      desconocido:opOriginal.desconocido || !fo.valido
    };

    let consumoMs = 0;
    let desconocido = op.desconocido;


    if(p.alternado){
      /* QUIMICOS_COBERTURA_191_373 */

      const historial=registros.periodos191;
      const periodos=[];

      if(Array.isArray(historial)){
        for(const x of historial){
          if(!x || !["191-1","191-2"].includes(x.id)){
            desconocido=true;
            continue;
          }

          const desde=new Date(x.desde).getTime();
          const hasta=x.hasta
            ? new Date(x.hasta).getTime()
            : ahora;

          if(!Number.isFinite(desde) ||
             !Number.isFinite(hasta) ||
             hasta<desde){
            desconocido=true;
            continue;
          }

          // Periodos terminados antes de la medición:
          // no afectan el inventario actual.
          if(hasta<=inicio)continue;

          periodos.push({
            id:x.id,
            desde,
            hasta:Math.min(hasta,ahora)
          });
        }
      }else{
        desconocido=true;
      }

      periodos.sort((a,b)=>a.desde-b.desde);

      // Verificar solapamientos únicamente dentro
      // del intervalo posterior a la medición.
      for(let i=1;i<periodos.length;i++){
        if(Math.max(periodos[i].desde,inicio) <
           Math.min(periodos[i-1].hasta,ahora)){
          desconocido=true;
        }
      }

      // op.abiertos ya excluye los intervalos F/O.
      // Solo se exige conexión cuando pudo haber consumo.
      for(const [a,b] of op.abiertos){
        let cubiertoHasta=a;

        for(const x of periodos){
          const desde=Math.max(a,x.desde);
          const hasta=Math.min(b,x.hasta);

          if(hasta<=desde)continue;

          if(desde>cubiertoHasta){
            desconocido=true;
          }

          if(x.id===p.id){
            consumoMs+=hasta-desde;
          }

          cubiertoHasta=Math.max(cubiertoHasta,hasta);
        }

        if(cubiertoHasta<b){
          desconocido=true;
        }
      }
    }else{
      consumoMs = op.abiertos.reduce(
        (total,[a,b])=>total+(b-a),0
      );
    }

    /* QUIMICOS_MOTOR_RECARGAS_332 */

    const recargas = Array.isArray(registros.recargas)
      ? registros.recargas.filter(x => x && x.id === p.id)
      : [];

    const recargasPosteriores = [];
    let recargasInvalidas = false;

    for(const x of recargas){
      const fechaRecarga = new Date(x.fecha).getTime();

      if(!Number.isFinite(fechaRecarga) ||
         !Number.isFinite(x.litros) ||
         x.litros <= 0 ||
         x.litros > CAPACIDAD){
        recargasInvalidas = true;
        continue;
      }

      if(fechaRecarga > inicio && fechaRecarga <= ahora){
        recargasPosteriores.push({
          fecha:fechaRecarga,
          litros:x.litros
        });
      }
    }

    recargasPosteriores.sort((a,b)=>a.fecha-b.fecha);

    let volumen = r.litros;
    let cursorInventario = inicio;

    function consumoEntre(desde,hasta){
      if(hasta <= desde) return 0;

      if(!p.alternado){
        return op.abiertos.reduce((total,[a,b])=>{
          const t = Math.max(
            0,
            Math.min(b,hasta)-Math.max(a,desde)
          );
          return total+t;
        },0) / 3600000 * (p.diario/24);
      }

      const periodos = Array.isArray(registros.periodos191)
        ? registros.periodos191 : [];

      let horas = 0;

      for(const [a,b] of op.abiertos){
        for(const x of periodos){
          if(!x || x.id !== p.id) continue;

          const d = new Date(x.desde).getTime();
          const f = x.hasta
            ? new Date(x.hasta).getTime()
            : ahora;

          if(!Number.isFinite(d) || !Number.isFinite(f)){
            continue;
          }

          const t = Math.max(
            0,
            Math.min(b,hasta,f) -
            Math.max(a,desde,d)
          );

          horas += t / 3600000;
        }
      }

      return horas * (p.diario/24);
    }

    for(const recarga of recargasPosteriores){
      volumen -= consumoEntre(
        cursorInventario,recarga.fecha
      );

      if(volumen < -0.000001){
        recargasInvalidas = true;
      }

      volumen += recarga.litros;

      if(volumen > CAPACIDAD + 0.000001){
        recargasInvalidas = true;
      }

      cursorInventario = recarga.fecha;
    }

    volumen -= consumoEntre(cursorInventario,ahora);

    if(volumen < -0.000001){
      recargasInvalidas = true;
    }

    const restante = Math.max(0,Math.min(CAPACIDAD,volumen));

    const verificable = !desconocido && !recargasInvalidas;

    const operativo = estadoOperativoQuimicos(p);
    /* QUIMICOS_ESTADOS_FO_359 */
    const estadoFO=estadoFOQuimicos(p.id);
    const enServicio =
      operativo.estado === "ABIERTO" &&
      activo &&
      estadoFO.valido &&
      !estadoFO.fuera;

    return {
      restante:verificable ? restante : null,
      porcentaje:verificable
        ? restante/CAPACIDAD*100 : 0,
      autonomia:verificable && enServicio
        ? restante/(p.diario/24) : null,
      fecha:r.fecha,
      litros:r.litros,
      activo,
      verificable,
      detalle:verificable
        ? "Consumo según intervalos operativos registrados"
        : "Historial operativo o recargas insuficientes para verificar el volumen"
    };
  }

  function formato(n){
    return n.toLocaleString("es-MX",{
      minimumFractionDigits:2,
      maximumFractionDigits:2
    });
  }


  /* QUIMICOS_BOTON_FO_355 */

  function estadoFOQuimicos(id){
    const historial=historialFOQuimicos(id);
    const ahora=Date.now();

    let fuera=false;
    let valido=true;
    let fecha=null;

    for(const e of historial){
      if(!Number.isFinite(e.fecha) ||
         !["FO","REANUDAR"].includes(e.tipo)){
        valido=false;
        continue;
      }

      if(e.fecha>ahora){
        valido=false;
        continue;
      }

      if(e.tipo==="FO"){
        if(fuera){
          valido=false;
          continue;
        }

        fuera=true;
        fecha=e.fecha;
      }else{
        if(!fuera){
          valido=false;
          continue;
        }

        fuera=false;
        fecha=e.fecha;
      }
    }

    return {fuera,valido,fecha};
  }

  function cerrarFOQuimicos(){
    document.getElementById("quimicosFOModal")
      ?.classList.add("hidden");
  }

  function errorFOQuimicos(mensaje){
    const el=document.getElementById("quimicosFOError");

    if(el){
      el.textContent=mensaje;
      el.classList.remove("hidden");
    }
  }

  function abrirFOQuimicos(id){
    const p=puntos.find(x=>x.id===id);
    if(!p)return;

    const estado=estadoFOQuimicos(id);

    if(!estado.valido){
      alert(
        "El historial F/O de este recipiente " +
        "necesita revisión antes de registrar otro movimiento."
      );
      return;
    }

    const accion=estado.fuera?"REANUDAR":"FO";
    const ahora=new Date();

    const local=new Date(
      ahora.getTime()-ahora.getTimezoneOffset()*60000
    ).toISOString();

    const fecha=local.slice(0,10);
    const hora=local.slice(11,16);

    document.getElementById("quimicosFOId").value=id;
    document.getElementById("quimicosFOAccion").value=accion;

    document.getElementById("quimicosFONombre").textContent=
      p.nombre;

    document.getElementById("quimicosFOTitulo").textContent=
      accion==="FO"
        ?"Registrar fuera de operación"
        :"Desactivar F/O";

    document.getElementById("quimicosFODescripcion").textContent=
      accion==="FO"
        ?"Indica cuándo dejó de funcionar realmente la inyección."
        :"Indica cuándo volvió a funcionar realmente la inyección.";

    document.getElementById("quimicosFOFecha").value=fecha;
    document.getElementById("quimicosFOHora").value=hora;

    document.getElementById("quimicosFOError")
      ?.classList.add("hidden");

    document.getElementById("quimicosFOModal")
      ?.classList.remove("hidden");
  }

  function guardarFOQuimicos(e){
    e.preventDefault();

    const id=document.getElementById("quimicosFOId").value;
    const tipo=document.getElementById("quimicosFOAccion").value;
    const fecha=document.getElementById("quimicosFOFecha").value;
    const hora=document.getElementById("quimicosFOHora").value;

    if(!puntos.some(p=>p.id===id)){
      errorFOQuimicos("Recipiente no válido.");
      return;
    }

    const estado=estadoFOQuimicos(id);

    if(!estado.valido){
      errorFOQuimicos("Historial F/O no verificable.");
      return;
    }

    if(tipo!==(estado.fuera?"REANUDAR":"FO")){
      errorFOQuimicos(
        "El estado F/O cambió. Cierra y abre nuevamente."
      );
      return;
    }

    if(!fecha || !hora){
      errorFOQuimicos("Captura fecha y hora.");
      return;
    }

    const fechaLocal=fecha+"T"+hora+":00";
    const timestamp=new Date(fechaLocal).getTime();

    if(!Number.isFinite(timestamp)){
      errorFOQuimicos("Fecha u hora no válida.");
      return;
    }

    if(timestamp>Date.now()){
      errorFOQuimicos(
        "No puedes registrar un movimiento futuro."
      );
      return;
    }

    if(estado.fecha!==null && timestamp<=estado.fecha){
      errorFOQuimicos(
        "La fecha debe ser posterior al último " +
        "movimiento F/O de este recipiente."
      );
      return;
    }

    const anterior=registros.eventosFO;
    const historial=Array.isArray(anterior)
      ? anterior.slice()
      : [];

    historial.push({
      id,
      tipo,
      fecha:new Date(timestamp).toISOString(),
      registradoEn:new Date().toISOString()
    });

    registros.eventosFO=historial;

    try{
      guardar();
    }catch(err){
      if(anterior===undefined){
        delete registros.eventosFO;
      }else{
        registros.eventosFO=anterior;
      }

      errorFOQuimicos(
        "No se pudo guardar el movimiento."
      );
      return;
    }

    cerrarFOQuimicos();
    render();
  }


  /* QUIMICOS_REINICIO_386 */
  function reiniciarRecipienteQuimicos(id){
    const p = puntos.find(x => x.id === id);

    if(!p){
      console.error("Recipiente no reconocido:", id);
      return;
    }

    const anterior = registros[id];

    if(!anterior){
      window.alert(
        "Este recipiente no tiene una medición vigente."
      );
      return;
    }

    const confirmar = window.confirm(
      "¿Reiniciar " + p.nombre + "?\\n\\n" +
      "Se eliminará únicamente su medición vigente " +
      "y se detendrá la proyección hasta registrar " +
      "un nuevo nivel.\\n\\n" +
      "Se conservarán el historial, las recargas, " +
      "los eventos F/O y las conexiones."
    );

    if(!confirmar) return;

    delete registros[id];

    try{
      guardar();
    }catch(err){
      registros[id] = anterior;

      window.alert(
        "No se pudo guardar el reinicio. " +
        "La medición anterior fue restaurada."
      );
      return;
    }

    cerrarHistorialQuimicos();
    render();
  }


  /* QUIMICOS_LECTURAS_REC_460 */
  function lecturasRecorredoresQuimicos(p){
    const reportes = window.AdminFirebase?.reportes;

    if(!Array.isArray(reportes)) return [];

    const pozoBuscado = p.alternado
      ? "191"
      : String(p.id);

    const encontrados = new Map();

    for(const r of reportes){
      if(!r || !r.quimicos ||
         !Array.isArray(r.quimicos.recipientes)){
        continue;
      }

      const q = r.quimicos;
      const pozo = String(q.pozo || r.pozo || "")
        .replace(/^C-/i, "")
        .trim();

      if(pozo !== pozoBuscado) continue;

      const recipiente = q.recipientes.find(x =>
        x && String(x.id) === (
          p.alternado ? "191-TOTAL" : String(p.id)
        )
      );

      if(!recipiente) continue;

      const litros = Number(recipiente.litros);
      const maximo = p.alternado ? 2000 : 1000;

      if(!Number.isFinite(litros) ||
         litros < 0 || litros > maximo){
        continue;
      }

      const fechaMs = Date.parse(String(r.fecha || ""));

      if(!Number.isFinite(fechaMs)) continue;

      const id = String(r.id || "");

      if(!id) continue;

      encontrados.set(id,{
        id,
        fechaMs,
        litros,
        estado:String(recipiente.estado || ""),
        recorredor:String(r.recorredor || "")
      });
    }

    return Array.from(encontrados.values())
      .sort((a,b)=>b.fechaMs-a.fechaMs);
  }

  function lecturaRecorredoresHTML(p){
    const lecturas = lecturasRecorredoresQuimicos(p);
    const ultima = lecturas[0];

    if(!ultima){
      return `
        <div class="quimicos-datos">
          <span>Lectura de Recorredores</span>
          <strong>Sin reporte disponible</strong>
        </div>`;
    }

    const descripcion = p.alternado
      ? "Total conjunto de ambos tótems"
      : "Volumen reportado en campo";

    return `
      <div class="quimicos-datos">
        <span>${descripcion}</span>
        <strong>${formato(ultima.litros)} L</strong>
      </div>
      <div class="quimicos-datos">
        <span>Condición de inyección</span>
        <strong>${escapar(ultima.estado)}</strong>
      </div>
      <p class="quimicos-producto">
        Recorredores ·
        ${escapar(
          new Date(ultima.fechaMs).toLocaleString("es-MX")
        )}
        · ${escapar(ultima.recorredor || "Sin nombre")}
      </p>
      <p class="quimicos-producto">
        ${lecturas.length} lectura(s) disponibles en Firebase
      </p>`;
  }

  function tarjeta(p){
    const c = calcular(p);
    const operativo = estadoOperativoQuimicos(p);
    const fo=estadoFOQuimicos(p.id);
    const porcentaje = !c
      ? 0
      : c.verificable
        ? c.porcentaje
        : Math.max(0, Math.min(100,
            c.litros / CAPACIDAD * 100
          ));

    const nivel = !c
      ? "Sin medición"
      : c.verificable
        ? formato(c.restante) + " L"
        : "Última medición: " +
          formato(c.litros) + " L";

    const estado = !fo.valido
      ? "HISTORIAL F/O NO VERIFICABLE"
      : fo.fuera
        ? "FUERA DE OPERACIÓN — CONSUMO DETENIDO"
        : !c
          ? "SIN MEDICIÓN"
          : !c.verificable
            ? "ESTIMACIÓN NO VERIFICABLE"
            : operativo.estado === "CERRADO"
          ? "CONSUMO DETENIDO"
          : operativo.estado === "ABIERTO"
            ? (p.alternado && !c.activo
                ? "TÓTEM EN RESERVA"
                : "CONSUMO ACTIVO")
            : "ESTADO SIN CONFIRMAR";

    const autonomia = !c
      ? "—"
      : !c.verificable
        ? "No calculable"
        : c.autonomia === null
          ? "Consumo no activo"
          : formato(c.autonomia/24) + " días";

    return `
      <article class="quimicos-card">
        <!-- QUIMICOS_REINICIO_386 -->
        <button
          type="button"
          class="quimicos-reinicio-icono"
          data-quimicos-reiniciar="${p.id}"
          aria-label="Reiniciar ${p.nombre}"
          title="Reiniciar ${p.nombre}">
          <svg viewBox="0 0 24 24"
               width="18"
               height="18"
               fill="none"
               stroke="currentColor"
               stroke-width="2"
               stroke-linecap="round"
               stroke-linejoin="round"
               aria-hidden="true">
            <path d="M12 2v10"/>
            <path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>
          </svg>
        </button>

        <h3>${escapar(p.nombre)}</h3>
        <div class="quimicos-producto">${escapar(p.producto)}</div>

        <div class="quimicos-tanque quimicos-tanque-dinamico">
          <div class="quimicos-liquido"
               style="height:${porcentaje.toFixed(2)}%"></div>
          <strong class="quimicos-tanque-valor">${nivel}</strong>
        </div>

        <div class="quimicos-datos">
          <span>Capacidad</span><strong>1,000 L</strong>
        </div>

        <div class="quimicos-datos">
          <span>Consumo del punto</span>
          <strong>${p.diario} L/día</strong>
        </div>

        <div class="quimicos-datos">
          <span>Consumo horario activo</span>
          <strong>${formato(p.diario/24)} L/h</strong>
        </div>

        <div class="quimicos-datos">
          <span>Autonomía estimada</span>
          <strong>${autonomia}</strong>
        </div>

        <div class="quimicos-datos">
          <span>Estado operativo del pozo</span>
          <strong>${escapar(operativo.estado)}</strong>
        </div>

        <span class="quimicos-estado">${estado}</span>

        ${lecturaRecorredoresHTML(p)}

        ${c ? `<p class="quimicos-producto">
          ${escapar(c.detalle)}
        </p>` : ""}

        <p class="quimicos-producto">
          ${operativo.fecha
            ? "Último estado registrado: " +
              escapar(
                new Date(operativo.fecha)
                  .toLocaleString("es-MX")
              )
            : escapar(operativo.origen)}
        </p>

        ${c ? `
          <p class="quimicos-producto">
            Última medición: ${escapar(c.fecha.replace("T"," "))}
            · ${formato(c.litros)} L
          </p>` : ""}

        <button type="button"
                class="quimicos-accion"
                data-quimicos-medicion="${p.id}">
          Registrar nivel
        </button>

        <!-- QUIMICOS_FORM_RECARGAS_336 -->
        <button type="button"
                class="quimicos-accion quimicos-accion-secundaria"
                data-quimicos-recarga="${p.id}">
          Registrar recarga
        </button>

        <!-- QUIMICOS_BOTON_FO_355 -->
        ${(()=>{
          const fo=estadoFOQuimicos(p.id);
          return `
            <button type="button"
                    class="quimicos-accion quimicos-accion-fo"
                    data-quimicos-fo="${p.id}"
                    ${fo.valido?"":"disabled"}>
              ${!fo.valido
                ?"F/O — REVISAR HISTORIAL"
                :fo.fuera
                  ?"Desactivar F/O"
                  :"F/O"}
            </button>
          `;
        })()}

        <!-- QUIMICOS_BITACORA_328 -->
        <button type="button"
                class="quimicos-accion quimicos-accion-secundaria"
                data-quimicos-historial="${p.id}">
          Ver historial
        </button>

        ${p.alternado ? `
          <button type="button"
                  class="quimicos-accion quimicos-accion-secundaria"
                  data-quimicos-activar="${p.id}">
            ${c && c.activo ? "Tótem activo" : "Conectar este tótem"}
          </button>` : ""}
      ${alertaAbastecimientoQuimicos(p,c)}
        </article>`;
  }


  /* QUIMICOS_BITACORA_328 */

  function cerrarHistorialQuimicos(){
    const panel = document.getElementById("quimicosHistorial");
    if(panel) panel.classList.add("hidden");
  }

  /* QUIMICOS_BITACORA_RECARGAS_338 */

  function abrirHistorialQuimicos(id){
    const p=puntos.find(x=>x.id===id);
    const panel=document.getElementById("quimicosHistorial");
    const contenido=document.getElementById(
      "quimicosHistorialContenido"
    );

    if(!p || !panel || !contenido) return;

    const mediciones=Array.isArray(registros.historialMediciones)
      ? registros.historialMediciones
          .filter(x=>x && x.id===id &&
            Number.isFinite(x.litros) &&
            typeof x.fecha==="string")
          .map(x=>({...x,tipo:"MEDICION"}))
      : [];

    const recargas=Array.isArray(registros.recargas)
      ? registros.recargas
          .filter(x=>x && x.id===id &&
            Number.isFinite(x.litros) &&
            typeof x.fecha==="string")
          .map(x=>({...x,tipo:"RECARGA"}))
      : [];

    /* QUIMICOS_BITACORA_FO_362 */
    const eventosFO=Array.isArray(registros.eventosFO)
      ? registros.eventosFO
          .filter(x=>x && x.id===id &&
            ["FO","REANUDAR"].includes(x.tipo) &&
            typeof x.fecha==="string")
          .map(x=>({...x}))
      : [];

    /* QUIMICOS_HISTORIAL_REC_484 */
    const lecturasCampo = lecturasRecorredoresQuimicos(p)
      .map(x=>({
        id:x.id,
        fecha:new Date(x.fechaMs).toISOString(),
        litros:x.litros,
        tipo:"RECORREDORES",
        estado:x.estado,
        recorredor:x.recorredor
      }));

    const movimientos=[
      ...mediciones,
      ...recargas,
      ...eventosFO,
      ...lecturasCampo
    ]
      .filter(x=>Number.isFinite(new Date(x.fecha).getTime()))
      .sort((a,b)=>
        new Date(b.fecha).getTime()-
        new Date(a.fecha).getTime()
      );

    const filas=movimientos.map(x=>{
      const tipo=x.tipo==="RECORREDORES"
        ? (p.alternado
            ? "Recorredores — Total conjunto C-191"
            : "Medición de Recorredores")
        : x.tipo==="RECARGA"
        ? "Recarga"
        : x.tipo==="FO"
          ? "F/O — Fuera de operación"
          : x.tipo==="REANUDAR"
            ? "Desactivar F/O — Reanudación"
            : "Medición";

      const cantidad=x.tipo==="RECARGA"
        ? "+"+formato(x.litros)+" L"
        : (x.tipo==="MEDICION" ||
           x.tipo==="RECORREDORES")
          ? formato(x.litros)+" L"
          : "—";

      const registro=x.registradoEn &&
        Number.isFinite(new Date(x.registradoEn).getTime())
          ? new Date(x.registradoEn).toLocaleString("es-MX")
          : "Sin registro";
      const detalleCampo=x.tipo==="RECORREDORES"
        ? "Recorredor: "+
          (x.recorredor || "Sin nombre")+
          " · Condición: "+
          (x.estado || "Sin especificar")
        : registro;

      return `
        <tr>
          <td>${escapar(tipo)}</td>
          <td>${escapar(x.fecha.replace("T"," "))}</td>
          <td>${escapar(cantidad)}</td>
          <td>${escapar(detalleCampo)}</td>
        </tr>`;
    }).join("");

    const ultima=registros[id];

    const aviso=!mediciones.length && ultima
      ? `<p class="quimicos-historial-aviso">
          Existe una medición anterior a la bitácora:
          ${escapar(String(ultima.fecha).replace("T"," "))},
          ${formato(ultima.litros)} L.
          No se dispone de sus registros históricos previos.
        </p>`
      : "";

    contenido.innerHTML=`
      <h3>${escapar(p.nombre)}</h3>
      <p>${escapar(p.producto)}</p>
      ${aviso}
      ${movimientos.length ? `
        <div class="quimicos-historial-scroll">
          <table class="quimicos-historial-tabla">
            <thead>
              <tr>
                <th>Movimiento</th>
                <th>Fecha y hora</th>
                <th>Litros</th>
                <th>Registrado en sistema</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
        <p class="quimicos-historial-aviso">
          ${mediciones.length} medición(es),
          ${recargas.length} recarga(s) y
          ${eventosFO.length} movimiento(s) F/O
          almacenados en este navegador.
          Además, ${lecturasCampo.length} lectura(s)
          de Recorredores disponibles en Firebase.
        </p>
      ` : (!ultima
        ? "<p>No hay movimientos registrados.</p>"
        : "")}
    `;

    panel.classList.remove("hidden");
  }


  /* QUIMICOS_ALERTAS_48H_342 */

  function alertaAbastecimientoQuimicos(p,calculo){
    if(!calculo || !calculo.verificable ||
       !Number.isFinite(calculo.restante)){
      return `
        <div class="quimicos-alerta quimicos-alerta-sin-datos">
          <strong>Sin estimación de abastecimiento</strong>
          <span>Se requiere información operativa verificable.</span>
        </div>`;
    }

    const operativo=estadoOperativoQuimicos(p);
    const fo=estadoFOQuimicos(p.id);

    if(fo.fuera){
      return `
        <div class="quimicos-alerta quimicos-alerta-detenido">
          <strong>Inyección fuera de operación</strong>
          <span>Consumo detenido. Inventario estimado:
          ${formato(calculo.restante)} L.</span>
        </div>`;
    }

    if(operativo.estado!=="ABIERTO"){
      return `
        <div class="quimicos-alerta quimicos-alerta-detenido">
          <strong>Consumo detenido</strong>
          <span>El pozo no está abierto. Inventario estimado:
          ${formato(calculo.restante)} L.</span>
        </div>`;
    }

    if(p.alternado && !calculo.activo){
      return `
        <div class="quimicos-alerta quimicos-alerta-detenido">
          <strong>Tótem en reserva</strong>
          <span>Inventario estimado:
          ${formato(calculo.restante)} L.
          Sin consumo mientras permanezca desconectado.</span>
        </div>`;
    }

    const horas=calculo.restante/(p.diario/24);

    if(!Number.isFinite(horas)){
      return `
        <div class="quimicos-alerta quimicos-alerta-sin-datos">
          <strong>Sin estimación</strong>
        </div>`;
    }

    const tiempo=horas.toFixed(1);

    if(horas<24){
      return `
        <div class="quimicos-alerta quimicos-alerta-urgente">
          <strong>URGENTE — Recargar químico</strong>
          <span>Autonomía estimada: ${tiempo} horas.
          Quedan ${formato(calculo.restante)} L.</span>
        </div>`;
    }

    if(horas<=48){
      return `
        <div class="quimicos-alerta quimicos-alerta-programar">
          <strong>PROGRAMAR RECARGA</strong>
          <span>Quedan ${tiempo} horas de químico.
          Inventario estimado:
          ${formato(calculo.restante)} L.</span>
        </div>`;
    }

    return `
      <div class="quimicos-alerta quimicos-alerta-normal">
        <strong>Abastecimiento normal</strong>
        <span>Autonomía estimada:
        ${tiempo} horas.</span>
      </div>`;
  }

  function render(){
    const grid = document.getElementById("quimicosRecipientes");
    const resumen = document.getElementById("quimicosResumen");

    if(!grid || !resumen) return;

    /* QUIMICOS_TABLERO_347 */
    const medidos = puntos.filter(p => calcular(p)).length;

    const alertas = {
      programar: 0,
      urgente: 0,
      sinEstimacion: 0
    };

    for(const p of puntos){
      const c = calcular(p);

      if(!c || !c.verificable ||
         !Number.isFinite(c.restante)){
        alertas.sinEstimacion++;
        continue;
      }

      const operativo = estadoOperativoQuimicos(p);

      if(operativo.estado !== "ABIERTO") continue;

      const fo=estadoFOQuimicos(p.id);
      if(!fo.valido || fo.fuera) continue;

      if(p.alternado && !c.activo) continue;

      const horas = c.restante / (p.diario / 24);

      if(!Number.isFinite(horas)){
        alertas.sinEstimacion++;
      } else if(horas < 24){
        alertas.urgente++;
      } else if(horas <= 48){
        alertas.programar++;
      }
    }

    resumen.innerHTML = `
      <div class="quimicos-kpi">
        <span>Puntos de inyección</span><strong>8</strong>
      </div>
      <div class="quimicos-kpi">
        <span>Recipientes registrados</span>
        <strong>${medidos} / 9</strong>
      </div>
      <div class="quimicos-kpi">
        <span>Consumo programado</span>
        <strong>385 L/día</strong>
      </div>
      <div class="quimicos-kpi quimicos-kpi-programar">
        <span>Programar recarga · 48 h</span>
        <strong>${alertas.programar}</strong>
      </div>
      <div class="quimicos-kpi quimicos-kpi-urgente">
        <span>Recarga urgente · menos de 24 h</span>
        <strong>${alertas.urgente}</strong>
      </div>
      <div class="quimicos-kpi quimicos-kpi-sin-datos">
        <span>Sin estimación verificable</span>
        <strong>${alertas.sinEstimacion}</strong>
      </div>`;

    grid.innerHTML = puntos.map(tarjeta).join("");
  }


  /* quimicos-modal-v287 */

  function cerrarModal(){
    const modal = document.getElementById("quimicosModal");
    if(modal) modal.classList.add("hidden");
    document.body.classList.remove("quimicos-modal-abierto");
  }

  function errorFormulario(mensaje){
    const el = document.getElementById("quimicosFormError");
    if(!el) return;

    el.textContent = mensaje;
    el.classList.remove("hidden");
  }


  /* QUIMICOS_FORM_RECARGAS_336 */

  function cerrarRecargaQuimicos(){
    const modal = document.getElementById("quimicosRecargaModal");
    if(modal) modal.classList.add("hidden");
    document.body.classList.remove("quimicos-modal-abierto");
  }

  function errorRecargaQuimicos(mensaje){
    const el = document.getElementById("quimicosRecargaError");
    if(!el) return;
    el.textContent = mensaje;
    el.classList.remove("hidden");
  }

  function abrirRecargaQuimicos(id){
    const p = puntos.find(x=>x.id===id);
    if(!p) return;

    document.getElementById("quimicosRecargaId").value=id;
    document.getElementById("quimicosRecargaNombre").textContent=p.nombre;
    document.getElementById("quimicosRecargaProducto").textContent=p.producto;

    const ahora = fechaLocal();
    document.getElementById("quimicosRecargaFecha").value=ahora.slice(0,10);
    document.getElementById("quimicosRecargaHora").value=ahora.slice(11,16);
    document.getElementById("quimicosRecargaLitros").value="";

    const error = document.getElementById("quimicosRecargaError");
    error.textContent="";
    error.classList.add("hidden");

    document.getElementById("quimicosRecargaModal")
      .classList.remove("hidden");

    document.body.classList.add("quimicos-modal-abierto");
  }

  function guardarRecargaQuimicos(e){
    e.preventDefault();

    const id=document.getElementById("quimicosRecargaId").value;
    const p=puntos.find(x=>x.id===id);

    if(!p){
      errorRecargaQuimicos("Recipiente no identificado.");
      return;
    }

    const texto=document.getElementById("quimicosRecargaLitros")
      .value.trim();

    const litros=Number(texto);

    if(!texto || !Number.isFinite(litros) ||
       litros<=0 || litros>CAPACIDAD){
      errorRecargaQuimicos(
        "Introduce una recarga mayor a 0 y hasta 1,000 L."
      );
      return;
    }

    const fecha=document.getElementById("quimicosRecargaFecha").value;
    const hora=document.getElementById("quimicosRecargaHora").value;
    const fechaCompleta=fecha+"T"+hora;
    const instante=new Date(fechaCompleta).getTime();

    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fechaCompleta) ||
       !Number.isFinite(instante) ||
       instante>Date.now()){
      errorRecargaQuimicos(
        "Selecciona una fecha y hora válidas, no futuras."
      );
      return;
    }

    const medicion=registros[id];

    if(!medicion || !medicion.fecha ||
       !Number.isFinite(medicion.litros)){
      errorRecargaQuimicos(
        "Primero registra una medición de nivel."
      );
      return;
    }

    const inicio=new Date(medicion.fecha).getTime();

    if(!Number.isFinite(inicio) || instante<=inicio){
      errorRecargaQuimicos(
        "La recarga debe ser posterior a la última medición."
      );
      return;
    }

    const anterior=registros.recargas;
    const recargas=Array.isArray(anterior)
      ? anterior.slice() : [];

    recargas.push({
      id,
      litros,
      fecha:fechaCompleta,
      registradoEn:new Date().toISOString(),
      tipo:"RECARGA"
    });

    registros.recargas=recargas;

    const calculo=calcular(p);

    if(!calculo || !calculo.verificable){
      if(anterior===undefined) delete registros.recargas;
      else registros.recargas=anterior;

      errorRecargaQuimicos(
        "No se puede verificar esta recarga con el historial " +
        "operativo disponible o se excede la capacidad del recipiente."
      );
      return;
    }

    try{
      guardar();
    }catch(err){
      if(anterior===undefined) delete registros.recargas;
      else registros.recargas=anterior;

      errorRecargaQuimicos(
        "No fue posible guardar la recarga en este navegador."
      );
      return;
    }

    cerrarRecargaQuimicos();
    render();
  }

  function registrar(id){
    const p = puntos.find(x => x.id === id);
    if(!p) return;

    const anterior = registros[id];

    document.getElementById("quimicosFormId").value = id;
    document.getElementById("quimicosFormNombre").textContent = p.nombre;
    document.getElementById("quimicosFormProducto").textContent = p.producto;
    document.getElementById("quimicosFormDiario").textContent =
      p.diario + " L/día";
    document.getElementById("quimicosFormHora").textContent =
      formato(p.diario/24) + " L/h";

    const litros = document.getElementById("quimicosFormLitros");
    const fecha = document.getElementById("quimicosFormFecha");
    const tiempo = document.getElementById("quimicosFormTiempo");

    const referencia = anterior && anterior.fecha
      ? anterior.fecha
      : fechaLocal();

    litros.value = anterior ? anterior.litros : "";
    fecha.value = referencia.slice(0,10);
    tiempo.value = referencia.slice(11,16);

    const error = document.getElementById("quimicosFormError");
    error.textContent = "";
    error.classList.add("hidden");

    document.getElementById("quimicosModal")
      .classList.remove("hidden");

    document.body.classList.add("quimicos-modal-abierto");

    litros.focus();
  }

  function guardarFormulario(e){
    e.preventDefault();

    const id = document.getElementById("quimicosFormId").value;

    const p = puntos.find(x => x.id === id);
    if(!p){
      errorFormulario("Recipiente no identificado.");
      return;
    }

    const campoLitros =
      document.getElementById("quimicosFormLitros");

    const cantidadTexto = campoLitros.value.trim();
    const litros = Number(cantidadTexto);

    if(!cantidadTexto ||
       !Number.isFinite(litros) ||
       litros < 0 ||
       litros > CAPACIDAD){
      errorFormulario(
        "La cantidad debe estar entre 0 y 1,000 litros."
      );
      return;
    }

    const fecha =
      document.getElementById("quimicosFormFecha").value;

    const hora =
      document.getElementById("quimicosFormTiempo").value;

    const fechaCompleta = fecha + "T" + hora;

    const timestamp = new Date(fechaCompleta).getTime();

    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fechaCompleta) ||
       !Number.isFinite(timestamp) ||
       timestamp > Date.now()){
      errorFormulario(
        "Selecciona una fecha y hora válidas que no sean futuras."
      );
      return;
    }

    if(p.alternado){
      const periodos = Array.isArray(registros.periodos191)
        ? registros.periodos191 : [];

      const activo = periodos.find(x =>
        x.id === id && !x.hasta
      );

      if(activo){
        const desde = new Date(activo.desde).getTime();

        if(timestamp < desde){
          errorFormulario(
            "La medición es anterior a la conexión activa. " +
            "Para evitar un cálculo incorrecto, registra " +
            "una medición posterior al cambio de tótem."
          );
          return;
        }
      }
    }

    /* QUIMICOS_HISTORIAL_MEDICIONES_324 */

    const anterior = registros[id];

    if(anterior && anterior.fecha){
      const fechaAnterior = new Date(anterior.fecha).getTime();

      if(Number.isFinite(fechaAnterior) &&
         timestamp < fechaAnterior){
        errorFormulario(
          "La fecha de esta medición es anterior a la última " +
          "registrada. No se puede reemplazar el nivel actual " +
          "con una lectura más antigua."
        );
        return;
      }
    }

    const historialAnterior = registros.historialMediciones;

    const historial = Array.isArray(historialAnterior)
      ? historialAnterior.slice()
      : [];

    const registroMedicion = {
      id,
      litros,
      fecha:fechaCompleta,
      registradoEn:new Date().toISOString(),
      tipo:"MEDICION"
    };

    historial.push(registroMedicion);

    registros[id] = {litros,fecha:fechaCompleta};
    registros.historialMediciones = historial;

    try {
      guardar();
    } catch(err){
      if(anterior === undefined){
        delete registros[id];
      } else {
        registros[id] = anterior;
      }

      if(historialAnterior === undefined){
        delete registros.historialMediciones;
      } else {
        registros.historialMediciones = historialAnterior;
      }

      errorFormulario(
        "No se pudo guardar en este navegador. " +
        "Comprueba que el almacenamiento local esté disponible."
      );
      return;
    }

    cerrarModal();
    render();
  }

  /* QUIMICOS_CONEXION_191_370 */

  function cerrarConexion191(){
    document.getElementById("quimicosConexion191Modal")
      ?.classList.add("hidden");
  }

  function errorConexion191(mensaje){
    const el=document.getElementById("quimicosConexion191Error");
    if(!el)return;
    el.textContent=mensaje;
    el.classList.remove("hidden");
  }

  function activar(id){
    if(!["191-1","191-2"].includes(id))return;

    if(!registros[id]){
      alert("Primero registra el nivel de este tótem.");
      return;
    }

    if(activo191()===id){
      alert("Este tótem ya está conectado.");
      return;
    }

    const modal=document.getElementById("quimicosConexion191Modal");
    if(!modal)return;

    const ahora=fechaLocal(new Date());

    document.getElementById("quimicosConexion191Id").value=id;
    document.getElementById("quimicosConexion191Nombre").textContent=
      id==="191-1"?"Pozo 191 · Tótem 1":"Pozo 191 · Tótem 2";

    document.getElementById("quimicosConexion191Fecha").value=
      ahora.slice(0,10);

    document.getElementById("quimicosConexion191Hora").value=
      ahora.slice(11,16);

    document.getElementById("quimicosConexion191Error")
      ?.classList.add("hidden");

    modal.classList.remove("hidden");
  }

  /* QUIMICOS_FECHA_191_372 */
  function guardarConexion191(e){
    e.preventDefault();

    const id=document.getElementById("quimicosConexion191Id").value;
    const fecha=document.getElementById("quimicosConexion191Fecha").value;
    const hora=document.getElementById("quimicosConexion191Hora").value;

    if(!["191-1","191-2"].includes(id) || !registros[id]){
      errorConexion191("Tótem no válido o sin medición.");
      return;
    }

    if(activo191()===id){
      errorConexion191("Este tótem ya está conectado.");
      return;
    }

    const fechaCompleta=fecha+"T"+hora;
    const timestamp=new Date(fechaCompleta).getTime();

    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fechaCompleta) ||
       !Number.isFinite(timestamp) ||
       timestamp>Date.now()){
      errorConexion191("Selecciona una fecha y hora válidas, no futuras.");
      return;
    }

    const anterior=registros.periodos191;
    const periodos=Array.isArray(anterior)
      ? anterior.map(x=>({...x}))
      : [];

    let ultimaConexion=-Infinity;

    for(const x of periodos){
      const desde=new Date(x.desde).getTime();
      const hasta=x.hasta
        ? new Date(x.hasta).getTime()
        : null;

      if(!["191-1","191-2"].includes(x.id) ||
         !Number.isFinite(desde) ||
         (hasta!==null &&
           (!Number.isFinite(hasta) || hasta<desde))){
        errorConexion191("El historial de conexiones requiere revisión.");
        return;
      }

      ultimaConexion=Math.max(
        ultimaConexion,desde,
        hasta===null?-Infinity:hasta
      );
    }

    if(timestamp<=ultimaConexion){
      errorConexion191(
        "La conexión debe ser posterior al último cambio registrado."
      );
      return;
    }

    for(const x of periodos){
      if(!x.hasta)x.hasta=new Date(timestamp).toISOString();
    }

    periodos.push({
      id,
      desde:new Date(timestamp).toISOString(),
      hasta:null
    });

    const activoAnterior=registros.activo191;

    registros.periodos191=periodos;
    registros.activo191=id;

    try{
      guardar();
    }catch(err){
      if(anterior===undefined)delete registros.periodos191;
      else registros.periodos191=anterior;

      if(activoAnterior===undefined)delete registros.activo191;
      else registros.activo191=activoAnterior;

      errorConexion191("No se pudo guardar la conexión.");
      return;
    }

    cerrarConexion191();
    render();
  }


  /* QUIMICOS_RENDER_PUBLICO_465 */
  window.AdminQuimicosActualizar = function(){
    const vista = document.getElementById(
      "inyeccionQuimicosSubView"
    );

    if(!vista || vista.classList.contains("hidden")){
      return;
    }

    render();
  };

  function abrir(){
    document.getElementById("pozosView")?.classList.add("hidden");
    document.getElementById("inyeccionQuimicosSubView")?.classList.remove("hidden");
    render();
  }

  function volver(){
    document.getElementById("inyeccionQuimicosSubView")?.classList.add("hidden");
    document.getElementById("pozosView")?.classList.remove("hidden");
  }

  document.addEventListener("DOMContentLoaded",()=>{
    document.getElementById("quimicosFormulario")
      ?.addEventListener("submit",guardarFormulario);

    document.getElementById("quimicosFOFormulario")
      ?.addEventListener("submit",guardarFOQuimicos);

    document.getElementById("quimicosFOCancelar")
      ?.addEventListener("click",cerrarFOQuimicos);

    document.getElementById("quimicosFOCerrar")
      ?.addEventListener("click",cerrarFOQuimicos);

    document.getElementById("quimicosRecargaFormulario")
      ?.addEventListener("submit",guardarRecargaQuimicos);

    document.getElementById("quimicosCerrarRecarga")
      ?.addEventListener("click",cerrarRecargaQuimicos);

    document.getElementById("quimicosCancelarRecarga")
      ?.addEventListener("click",cerrarRecargaQuimicos);


    document.getElementById("quimicosCerrarHistorial")
      ?.addEventListener("click",cerrarHistorialQuimicos);

    document.getElementById("quimicosCancelar")
      ?.addEventListener("click",cerrarModal);

    document.getElementById("quimicosCerrarModal")
      ?.addEventListener("click",cerrarModal);

    document.getElementById("quimicosModal")
      ?.addEventListener("click",e=>{
        if(e.target.id === "quimicosModal") cerrarModal();
      });

    document.addEventListener("keydown",e=>{
      if(e.key === "Escape") cerrarModal();
    });


    document.getElementById("btnAbrirQuimicos")
      ?.addEventListener("click",abrir);

    document.getElementById("btnVolverProduccionQuimicos")
      ?.addEventListener("click",volver);

    /* QUIMICOS_CONEXION_191_370 */
    document.getElementById("quimicosConexion191Formulario")
      ?.addEventListener("submit",guardarConexion191);

    document.getElementById("quimicosConexion191Cerrar")
      ?.addEventListener("click",cerrarConexion191);

    document.getElementById("quimicosConexion191Cancelar")
      ?.addEventListener("click",cerrarConexion191);

    document.getElementById("quimicosRecipientes")
      ?.addEventListener("click",e=>{
        const medicion = e.target.closest("[data-quimicos-medicion]");
        const recarga = e.target.closest("[data-quimicos-recarga]");
        const activacion = e.target.closest("[data-quimicos-activar]");
        const historial = e.target.closest("[data-quimicos-historial]");
        const botonFO = e.target.closest("[data-quimicos-fo]");
        const reinicio = e.target.closest(
          "[data-quimicos-reiniciar]"
        );

        if(reinicio){
          reiniciarRecipienteQuimicos(
            reinicio.dataset.quimicosReiniciar
          );
          return;
        }


        if(botonFO) abrirFOQuimicos(
          botonFO.dataset.quimicosFo
        );
        if(medicion) registrar(medicion.dataset.quimicosMedicion);
        if(recarga) abrirRecargaQuimicos(
          recarga.dataset.quimicosRecarga
        );
        if(activacion) activar(activacion.dataset.quimicosActivar);
        if(historial) abrirHistorialQuimicos(
          historial.dataset.quimicosHistorial
        );
      });

    /* QUIMICOS_VISIBILIDAD_345 */
    document.addEventListener("visibilitychange",()=>{
      if(document.hidden) return;

      const vista=document.getElementById(
        "inyeccionQuimicosSubView"
      );

      if(vista && !vista.classList.contains("hidden")){
        render();
      }
    });

    setInterval(()=>{
      const vista = document.getElementById("inyeccionQuimicosSubView");
      if(vista && !vista.classList.contains("hidden")) render();
    },60000);
  });
})();
