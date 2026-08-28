(function(){
  'use strict';

  const ReporteCampoExcel = {
    MESES: [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre'
    ],

    MESES_CORTOS: [
      'Ene','Feb','Mar','Abr','May','Jun',
      'Jul','Ago','Sep','Oct','Nov','Dic'
    ],

    clone(value){
      if(value === undefined || value === null){
        return value;
      }

      try{
        return JSON.parse(JSON.stringify(value));
      }catch(error){
        return value;
      }
    },

    clean(value){
      if(value === undefined || value === null){
        return '';
      }

      const txt = String(value)
        .replace(/\*/g, '')
        .trim();

      if(
        !txt ||
        txt === '-' ||
        txt === '—' ||
        /^n\/a$/i.test(txt)
      ){
        return '';
      }

      return txt;
    },

    normalizeWell(value){
      const raw = this.clean(value);

      if(!raw){
        return '';
      }

      return raw
        .replace(/^pozo[_\s-]*/i, '')
        .replace(/^C[-\s]*/i, '')
        .trim();
    },

    wellLabel(value){
      const well = this.normalizeWell(value);

      return well
        ? 'C-' + well
        : '';
    },

    numericWell(value){
      const well = this.normalizeWell(value);
      const match = well.match(/^(\d+)(.*)$/);

      if(!match){
        return [999999, well];
      }

      return [
        Number(match[1]),
        match[2] || ''
      ];
    },

    compareWells(a, b){
      const ka = this.numericWell(a);
      const kb = this.numericWell(b);

      if(ka[0] !== kb[0]){
        return ka[0] - kb[0];
      }

      return ka[1].localeCompare(kb[1]);
    },

    datePartsMexico(value){
      if(
        value === undefined ||
        value === null ||
        value === ''
      ){
        return null;
      }

      /*
       * FECHA PURA YYYY-MM-DD:
       * conservar exactamente el día escrito.
       *
       * No usar new Date('YYYY-MM-DD') porque JavaScript
       * lo interpreta como UTC y puede moverlo un día
       * al convertirlo a México.
       */
      if(typeof value === 'string'){
        const txt = value.trim();

        let m = txt.match(
          /^(\d{4})-(\d{2})-(\d{2})$/
        );

        if(m){
          return {
            year: Number(m[1]),
            month: Number(m[2]),
            day: Number(m[3]),
            iso: m[1] + '-' + m[2] + '-' + m[3]
          };
        }

        /*
         * También aceptar DD/MM/YYYY sin reinterpretarlo
         * mediante zona horaria.
         */
        m = txt.match(
          /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        );

        if(m){
          const dd = String(m[1]).padStart(2,'0');
          const mm = String(m[2]).padStart(2,'0');
          const yyyy = m[3];

          return {
            year: Number(yyyy),
            month: Number(mm),
            day: Number(dd),
            iso: yyyy + '-' + mm + '-' + dd
          };
        }
      }

      let raw = value;

      /*
       * Firebase puede almacenar timestamps en segundos.
       */
      if(
        typeof raw === 'number' &&
        raw > 0 &&
        raw < 100000000000
      ){
        raw *= 1000;
      }

      const date =
        raw instanceof Date
          ? raw
          : new Date(raw);

      if(Number.isNaN(date.getTime())){
        return null;
      }

      const formatter = new Intl.DateTimeFormat(
        'en-CA',
        {
          timeZone: 'America/Mexico_City',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }
      );

      const parts = {};

      formatter.formatToParts(date).forEach(part => {
        if(part.type !== 'literal'){
          parts[part.type] = part.value;
        }
      });

      return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        iso:
          parts.year + '-' +
          parts.month + '-' +
          parts.day
      };
    },

    reportDateCandidates(row){
      const valores = [
        row?.fechaISO,
        row?.fecha,
        row?.createdAt,
        row?.timestamp
      ];

      return valores
        .filter(v =>
          v !== undefined &&
          v !== null &&
          v !== ''
        )
        .map(v => this.datePartsMexico(v))
        .filter(Boolean);
    },

    reportDate(row){
      const fechas =
        this.reportDateCandidates(row);

      return fechas.length
        ? fechas[0]
        : null;
    },

    reportTime(row){
      const direct = this.clean(
        row?.hora ||
        row?.horaNivel
      );

      if(direct){
        return direct;
      }

      const raw =
        row?.createdAt ||
        row?.timestamp ||
        row?.fecha ||
        row?.fechaISO ||
        0;

      let valor = raw;

      if(
        typeof valor === 'number' &&
        valor > 0 &&
        valor < 100000000000
      ){
        valor *= 1000;
      }

      const date = new Date(valor);

      if(Number.isNaN(date.getTime())){
        return '';
      }

      return new Intl.DateTimeFormat(
        'es-MX',
        {
          timeZone: 'America/Mexico_City',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }
      ).format(date);
    },

    reportTimestamp(row){
      let raw =
        row?.createdAt ||
        row?.timestamp ||
        row?.fecha ||
        row?.fechaISO ||
        0;

      if(
        typeof raw === 'number' &&
        raw > 0 &&
        raw < 100000000000
      ){
        raw *= 1000;
      }

      const time = new Date(raw).getTime();

      return Number.isFinite(time)
        ? time
        : 0;
    },

    selectedReports(dateISO){
      const reports =
        window.AdminFirebase?.reportes || [];

      return reports.filter(row => {
        const fechas =
          this.reportDateCandidates(row);

        if(!fechas.length){
          return false;
        }

        const distintas = new Set(
          fechas.map(fecha => fecha.iso)
        );

        /*
         * SEGURIDAD:
         * Si un mismo registro afirma pertenecer a dos
         * fechas diferentes, no entra a ningún Excel.
         */
        if(distintas.size > 1){
          console.warn(
            '[REPORTE CAMPO] Registro rechazado por fechas contradictorias:',
            {
              pozo: row?.pozo || '',
              fecha: row?.fecha,
              fechaISO: row?.fechaISO,
              createdAt: row?.createdAt,
              timestamp: row?.timestamp,
              fechasDetectadas: Array.from(distintas)
            }
          );

          return false;
        }

        return fechas[0].iso === dateISO;
      });
    },

    parseMessage(row){
      if(
        window.AdminUtils &&
        typeof window.AdminUtils.parseMsg === 'function'
      ){
        try{
          return window.AdminUtils.parseMsg(row) || {};
        }catch(error){
          console.warn(
            '[REPORTE CAMPO] No se pudo interpretar mensaje:',
            error
          );
        }
      }

      return {};
    },

    message(row){
      return String(
        row?.msg ||
        row?.mensaje ||
        row?.message ||
        row?.texto ||
        ''
      );
    },

    firstValue(values){
      for(const value of values){
        const clean = this.clean(value);

        if(clean !== ''){
          return clean;
        }
      }

      return '';
    },

    regexValue(message, label){
      const escaped = label.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      const expression = new RegExp(
        '(?:^|[\\n·])\\s*' +
        escaped +
        '\\s*:\\s*' +
        '([-+]?\\d+(?:[.,]\\d+)?)',
        'i'
      );

      const match = String(message || '').match(expression);

      return match
        ? match[1].replace(',', '.')
        : '';
    },

    pressureValue(row, parsed, field, label){

      const value = this.firstValue([
        row?.co?.[field],
        row?.[field],
        parsed?.[field],
        this.regexValue(
          this.message(row),
          label
        )
      ]);

      if(value === ''){
        return '—';
      }

      let txt =
        String(value)
          .trim()
          .replace(/,/g, '.');

      /*
       * Quitar únicamente la unidad kg/cm².
       * Conserva números y rangos.
       */
      txt = txt
        .replace(
          /\s*kg\s*\/\s*cm(?:²|\^?2)?\s*/gi,
          ''
        )
        .trim();

      if(
        !txt ||
        txt === '-' ||
        txt === '—'
      ){
        return '—';
      }

      /*
       * Número simple.
       */
      if(
        /^[-+]?\d+(?:\.\d+)?$/.test(txt)
      ){
        const numeric = Number(txt);

        return Number.isFinite(numeric)
          ? numeric
          : txt;
      }

      /*
       * Rango numérico.
       */
      const rango = txt.match(
        /^([-+]?\d+(?:\.\d+)?)\s*-\s*([-+]?\d+(?:\.\d+)?)$/
      );

      if(rango){
        return rango[1] + '-' + rango[2];
      }

      return txt;
    },


    sapValue(row, parsed){
      const direct = this.firstValue([
        row?.co?.sap,
        row?.sap,
        parsed?.sap
      ]);

      if(direct){
        return direct;
      }

      const match = this.message(row).match(
        /\bSAP\s*:\s*([A-Z0-9/-]+)/i
      );

      return match
        ? match[1].toUpperCase()
        : '—';
    },

    statusValue(row, parsed){
      const direct = this.firstValue([
        row?.co?.estatus,
        row?.estatus,
        row?.estadoPozo,
        parsed?.estatus
      ]);

      if(direct){
        return direct;
      }

      const match = this.message(row).match(
        /(?:Estatus|Estado del pozo)\s*:\s*([^\n]+)/i
      );

      return match
        ? this.clean(match[1])
        : '—';
    },

    personValue(row){
      return this.firstValue([
        row?.recorredor,
        row?.usuario,
        row?.user,
        row?.nombre
      ]) || '—';
    },

    modeValue(row){
      return this.clean(
        row?.modo ||
        row?.tipo ||
        row?.mode
      ).toLowerCase();
    },

    isNote(row){
      const mode = this.modeValue(row);
      const msg = this.message(row);

      return (
        mode === 'nota' ||
        mode === 'nota_campo' ||
        mode.includes('nota') ||
        /NOTA\s+DE\s+CAMPO/i.test(msg)
      );
    },

    isOperational(row){
      const mode = this.modeValue(row);
      const msg = this.message(row);

      /*
       * REPORTE DE CAMPO:
       * Solo considerar Control Operativo real.
       * Una visita genérica no debe alimentar presiones.
       */
      return (
        mode === 'co' ||
        /CONTROL\s+OPERATIVO/i.test(msg)
      );
    },

    observationFromMessage(row){
      const lines = this.message(row)
        .split(/\r?\n/)
        .map(line => line.trim());

      const observations = [];

      lines.forEach(line => {
        if(/^📝/.test(line)){
          const clean = line
            .replace(/^📝\s*/, '')
            .trim();

          if(clean){
            observations.push(clean);
          }
        }
      });

      return observations.join('\n');
    },

    observationValue(row){
      const direct = this.firstValue([
        row?.observaciones,
        row?.observacion,
        row?.obs,
        row?.co?.observaciones,
        row?.nivel?.observaciones,
        this.observationFromMessage(row)
      ]);

      if(
        !direct ||
        /^(sin observaciones?|ninguna|n\/a|na)$/i.test(direct)
      ){
        return '';
      }

      return direct;
    },

    noteValue(row){
      const direct = this.firstValue([
        row?.nota,
        row?.observaciones,
        row?.observacion,
        row?.obs,
        row?.texto,
        row?.descripcion
      ]);

      if(direct){
        return direct;
      }

      const ignored = [
        /^📋/,
        /^🛢\s*Pozo/i,
        /^👷/,
        /^📅/,
        /^═+$/,
        /^GPS:/i,
        /^🗺/,
        /^✅\s*Dentro/i,
        /^📸/
      ];

      return this.message(row)
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => {
          if(!line){
            return false;
          }

          if(/NOTA\s+DE\s+CAMPO/i.test(line)){
            return false;
          }

          return !ignored.some(regex =>
            regex.test(line)
          );
        })
        .join('\n')
        .trim();
    },

    operationType(row){
      const mode = this.modeValue(row);
      const msg = this.message(row);

      if(
        mode === 'guardia' ||
        /NIVELES?\s+DE\s+GUARDIA/i.test(msg)
      ){
        return 'Niveles de guardia';
      }

      if(this.isOperational(row)){
        return 'Control operativo';
      }

      return this.clean(mode) || 'Reporte';
    },

    dateLong(dateISO){
      const parts = String(dateISO)
        .split('-')
        .map(Number);

      if(parts.length !== 3){
        return dateISO;
      }

      return (
        parts[2] +
        ' de ' +
        this.MESES[parts[1] - 1] +
        ' de ' +
        parts[0]
      );
    },

    outputName(dateISO){
      const parts = String(dateISO)
        .split('-')
        .map(Number);

      return (
        'Reporte_Campo_Cuichapa_' +
        String(parts[2]).padStart(2, '0') +
        this.MESES_CORTOS[parts[1] - 1] +
        parts[0] +
        '.xlsx'
      );
    },

    captureRowStyle(worksheet, rowNumber, maxColumn){
      const row = worksheet.getRow(rowNumber);

      return {
        height: row.height,
        cells: Array.from(
          {length: maxColumn},
          (_, index) => {
            const cell = row.getCell(index + 1);

            return {
              style: this.clone(cell.style),
              numFmt: cell.numFmt,
              alignment: this.clone(cell.alignment),
              border: this.clone(cell.border),
              fill: this.clone(cell.fill),
              font: this.clone(cell.font)
            };
          }
        )
      };
    },

    applyRowStyle(row, snapshot){
      if(!snapshot){
        return;
      }

      if(snapshot.height){
        row.height = snapshot.height;
      }

      snapshot.cells.forEach((source, index) => {
        const cell = row.getCell(index + 1);

        if(source.style){
          cell.style = this.clone(source.style);
        }

        if(source.numFmt){
          cell.numFmt = source.numFmt;
        }

        if(source.alignment){
          cell.alignment = this.clone(
            source.alignment
          );
        }

        if(source.border){
          cell.border = this.clone(source.border);
        }

        if(source.fill){
          cell.fill = this.clone(source.fill);
        }

        if(source.font){
          cell.font = this.clone(source.font);
        }
      });
    },

    replaceRows(
      worksheet,
      startRow,
      rows,
      maxColumn,
      footerText
    ){
      const dataStyle = this.captureRowStyle(
        worksheet,
        startRow,
        maxColumn
      );

      const footerStyle = footerText
        ? this.captureRowStyle(
            worksheet,
            worksheet.rowCount,
            maxColumn
          )
        : null;

      const removeCount = Math.max(
        0,
        worksheet.rowCount - startRow + 1
      );

      if(removeCount){
        worksheet.spliceRows(
          startRow,
          removeCount
        );
      }

      rows.forEach(values => {
        const row = worksheet.addRow(values);
        this.applyRowStyle(row, dataStyle);
      });

      if(!rows.length){
        const emptyValues = new Array(maxColumn)
          .fill(null);

        emptyValues[1] =
          'Sin registros para la fecha seleccionada';

        const row = worksheet.addRow(emptyValues);
        this.applyRowStyle(row, dataStyle);

        row.getCell(2).font = {
          ...row.getCell(2).font,
          italic: true,
          color: {
            argb: 'FF6B7280'
          }
        };
      }

      if(footerText){
        const footerValues = new Array(maxColumn)
          .fill(null);

        footerValues[1] = footerText;

        const footer = worksheet.addRow(
          footerValues
        );

        this.applyRowStyle(
          footer,
          footerStyle
        );

        worksheet.mergeCells(
          footer.number,
          2,
          footer.number,
          maxColumn
        );
      }
    },

    buildData(reports, dateISO){

      /*
       * BARRERA FINAL DE FECHA.
       * Aunque el llamador ya filtre, buildData vuelve a
       * rechazar cualquier registro que no pertenezca
       * exactamente al día solicitado.
       */
      reports = (reports || []).filter(row => {
        const fecha = this.reportDate(row);
        return fecha && fecha.iso === dateISO;
      });
      const pressures = reports
        .filter(row => this.isOperational(row))
        .map(row => {
          const parsed = this.parseMessage(row);

          return {
            source: row,
            timestamp: this.reportTimestamp(row),
            pozo: this.wellLabel(row.pozo),
            sap: this.sapValue(row, parsed),
            hora: this.reportTime(row),
            recorredor: this.personValue(row),
            ptp: this.pressureValue(
              row,
              parsed,
              'ptp',
              'PTP'
            ),
            ptr: this.pressureValue(
              row,
              parsed,
              'ptr',
              'PTR'
            ),
            lbn: this.pressureValue(
              row,
              parsed,
              'lbn',
              'LBN'
            ),
            ldd: this.pressureValue(
              row,
              parsed,
              'ldd',
              'LDD'
            ),
            estatus: this.statusValue(row, parsed)
          };
        })
        .filter(row => {
          if(!row.pozo){
            return false;
          }

          return (
            row.ptp !== '—' ||
            row.ptr !== '—' ||
            row.lbn !== '—' ||
            row.ldd !== '—' ||
            row.sap !== '—'
          );
        })
        .sort((a, b) => {
          const byWell = this.compareWells(
            a.pozo,
            b.pozo
          );

          if(byWell !== 0){
            return byWell;
          }

          return a.timestamp - b.timestamp;
        });

      const latestMap = new Map();

      pressures.forEach(row => {
        const previous = latestMap.get(row.pozo);

        if(
          !previous ||
          row.timestamp >= previous.timestamp
        ){
          latestMap.set(row.pozo, row);
        }
      });

      const latest = Array.from(
        latestMap.values()
      ).sort((a, b) =>
        this.compareWells(a.pozo, b.pozo)
      );

      const observations = reports
        .filter(row => !this.isNote(row))
        .map(row => ({
          source: row,
          timestamp: this.reportTimestamp(row),
          hora: this.reportTime(row),
          pozo: this.wellLabel(row.pozo),
          recorredor: this.personValue(row),
          tipo: this.operationType(row),
          observacion: this.observationValue(row)
        }))
        .filter(row =>
          row.observacion && row.pozo
        )
        .sort((a, b) =>
          a.timestamp - b.timestamp
        );

      /*
       * NOTAS DE CAMPO DESACTIVADAS PARA ESTE REPORTE.
       * No entran en ninguna hoja derivada.
       */
      const notes = [];

      return {
        pressures,
        latest,
        observations,
        notes
      };
    },

    async loadTemplate(){
      if(typeof ExcelJS === 'undefined'){
        throw new Error(
          'La librería ExcelJS aún no está disponible.'
        );
      }

      const response = await fetch(
        '/templates/Reporte_Campo_Cuichapa.xlsx?v=' +
        Date.now(),
        { cache: 'no-store' }
      );

      if(!response.ok){
        throw new Error(
          'No se pudo cargar la plantilla Excel.'
        );
      }

      const buffer = await response.arrayBuffer();
      const workbook = new ExcelJS.Workbook();

      await workbook.xlsx.load(buffer);

      return workbook;
    },

    fillSummary(worksheet, dateISO, data){
      worksheet.getCell('B4').value =
        'Fecha del reporte: ' +
        this.dateLong(dateISO);

      worksheet.getCell('B7').value =
        new Set(
          data.pressures.map(row => row.pozo)
        ).size;

      worksheet.getCell('D7').value =
        data.pressures.length;

      worksheet.getCell('B11').value =
        data.observations.length;

      worksheet.getCell('D11').value =
        data.notes.length;
    },
      fillPressures(worksheet, dateISO, data){

        worksheet.getCell('B3').value =
          'Campo Cuichapa · ' +
          this.dateLong(dateISO) +
          ' · Valores en kg/cm²';

        const nomenclatura =
          'PTP = Presión Tubería Producción · ' +
          'PTR = Presión Tubería Revestimiento · ' +
          'LBN = Nivel de Línea · ' +
          'LDD = Presión Línea de Descarga · ' +
          '“—” = dato no capturado en el reporte';

        try{
          worksheet.unMergeCells('B4:J4');
        }catch(e){}

        try{
          worksheet.mergeCells('B4:J4');
        }catch(e){}

        const celda =
          worksheet.getCell('B4');

        celda.value =
          nomenclatura;

        celda.alignment = {
          horizontal:'left',
          vertical:'middle',
          wrapText:true
        };

        celda.font = {
          ...(celda.font || {}),
          italic:true,
          size:10
        };

        worksheet.getRow(4).height = 28;

        /*
         * Guardar el estilo original de una fila de datos
         * antes de eliminar el cuadro viejo de la plantilla.
         */
        this._pressureRowStyle =
          this.captureRowStyle(
            worksheet,
            6,
            10
          );

        const rows =
          data.pressures.map(row => [
            null,
            row.pozo,
            row.sap,
            row.hora,
            row.recorredor,
            row.ptp,
            row.ptr,
            row.lbn,
            row.ldd,
            row.estatus
          ]);

        /*
         * PRESIONES POR POZO:
         * La fila 6 es el modelo de estilo y también debe ser
         * la primera fila real de datos.
         *
         * Solamente se eliminan las filas posteriores para evitar
         * espacios vacíos, cuadros antiguos y filas residuales.
         */
        const ultimaFila = worksheet.rowCount;

        if(ultimaFila > 6){
          worksheet.spliceRows(
            7,
            ultimaFila - 6
          );
        }

        if(rows.length){

          rows.forEach((values, index) => {
            const numeroFila = 6 + index;
            const fila = worksheet.getRow(numeroFila);

            values.forEach((value, colIndex) => {
              fila.getCell(colIndex + 1).value = value;
            });

            this.applyRowStyle(
              fila,
              this._pressureRowStyle
            );

            fila.height = 20;
          });

        }else{

          /*
           * Sin registros:
           * conservar la fila modelo, pero sin información anterior.
           */
          const filaModelo = worksheet.getRow(6);

          for(let col = 1; col <= 10; col++){
            filaModelo.getCell(col).value = null;
          }

          this.applyRowStyle(
            filaModelo,
            this._pressureRowStyle
          );

          filaModelo.height = 20;
        }

        /*
         * Limitar físicamente la impresión a la última fila real.
         * Evita páginas vacías o espacios residuales al imprimir.
         */
        const ultimaFilaReal =
          rows.length
            ? 5 + rows.length
            : 6;

        worksheet.pageSetup =
          worksheet.pageSetup || {};

        worksheet.pageSetup.printArea =
          `A1:J${ultimaFilaReal}`;

        if(Array.isArray(worksheet.rowBreaks)){
          worksheet.rowBreaks = [];
        }

        /*
         * LIMPIEZA FINAL:
         * La nomenclatura debe existir únicamente arriba.
         *
         * Si la plantilla conserva alguna nomenclatura
         * antigua debajo de la tabla, se elimina.
         */
        worksheet.eachRow((row, rowNumber) => {

          if(rowNumber <= 5){
            return;
          }

          row.eachCell(cell => {

            const txt =
              String(
                cell.value || ''
              );

            if(
              txt.includes('PTP = Presión Tubería Producción') ||
              txt.includes('PTR = Presión Tubería Revestimiento') ||
              txt.includes('LBN = Nivel de Línea') ||
              txt.includes('LDD = Presión Línea de Descarga')
            ){
              cell.value = '';
            }

          });

        });
      },



    fillLatest(worksheet, dateISO, data){
      worksheet.getCell('B3').value =
        'Campo Cuichapa · ' +
        this.dateLong(dateISO);

      const rows = data.latest.map(row => [
        null,
        row.pozo,
        row.sap,
        row.hora,
        row.recorredor,
        row.ptp,
        row.ptr,
        row.lbn,
        row.ldd
      ]);

      this.replaceRows(
        worksheet,
        6,
        rows,
        9
      );
    },

    fillObservations(worksheet, dateISO, data){
      worksheet.getCell('B3').value =
        'Campo Cuichapa · ' +
        this.dateLong(dateISO);

      const rows = data.observations.map(row => [
        null,
        row.hora,
        row.pozo,
        row.recorredor,
        row.tipo,
        row.observacion
      ]);

      this.replaceRows(
        worksheet,
        6,
        rows,
        6
      );

      worksheet.eachRow((row, rowNumber) => {
        if(rowNumber >= 6){
          row.getCell(6).alignment = {
            ...row.getCell(6).alignment,
            wrapText: true,
            vertical: 'top'
          };

          row.height = Math.max(
            row.height || 18,
            36
          );
        }
      });
    },

    fillNotes(worksheet, dateISO, data){
      worksheet.getCell('B3').value =
        'Campo Cuichapa · ' +
        this.dateLong(dateISO);

      const rows = data.notes.map(row => [
        null,
        row.hora,
        row.recorredor,
        row.nota
      ]);

      this.replaceRows(
        worksheet,
        6,
        rows,
        4
      );

      worksheet.eachRow((row, rowNumber) => {
        if(rowNumber >= 6){
          row.getCell(4).alignment = {
            ...row.getCell(4).alignment,
            wrapText: true,
            vertical: 'top'
          };

          row.height = Math.max(
            row.height || 18,
            36
          );
        }
      });
    },


    fillInjectionEquipment(workbook, dateISO, data){

      const normalizar = valor =>
        String(valor || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g,'')
          .toLowerCase();

      const relacionado = texto => {
        const t = normalizar(texto);

        return (

          /*
           * REGLA PRINCIPAL:
           * cualquier nota que mencione INYECCIÓN.
           *
           * normalizar() elimina acentos:
           * "inyección" -> "inyeccion"
           */
          /\binyeccion\b/.test(t) ||

          /*
           * Variantes relacionadas con equipos inyectores,
           * aunque no escriban literalmente "inyección".
           */
          /\binyector/.test(t) ||
          /\binyectora/.test(t) ||

          /*
           * Tótem / errores comunes.
           */
          /\btotem\b/.test(t) ||
          /\btoten\b/.test(t) ||

          /*
           * Dosificación química.
           */
          /\bdosificador/.test(t) ||
          /\bdosificadora/.test(t)

        );
      };

      const registros = [];

      (data.observations || []).forEach(row => {

        const src = row.source || {};

        const textos = [
          row.observacion,
          src.observaciones,
          src.observacion,
          src.obs,
          src.mensaje,
          src.msg,
          src.message,
          src.texto,
          src.descripcion
        ]
        .filter(Boolean)
        .map(String);

        const textoBusqueda =
          textos.join('\n').trim();

        if(
          textoBusqueda &&
          relacionado(textoBusqueda)
        ){
          registros.push({
            fecha: dateISO,
            hora: row.hora || '',
            pozo: row.pozo || '—',
            recorredor: row.recorredor || '',
            tipo: row.tipo || 'OBSERVACIÓN',

            /*
             * Mostrar primero la observación limpia.
             * Si no existe, conservar el texto original.
             */
            observacion:
              String(
                row.observacion ||
                src.observaciones ||
                src.observacion ||
                src.obs ||
                src.mensaje ||
                src.msg ||
                src.texto ||
                src.descripcion ||
                ''
              ).trim()
          });
        }
      });

      (data.notes || []).forEach(row => {

        const src = row.source || {};

        const textos = [
          row.nota,
          src.observaciones,
          src.observacion,
          src.obs,
          src.mensaje,
          src.msg,
          src.message,
          src.texto,
          src.descripcion
        ]
        .filter(Boolean)
        .map(String);

        const textoBusqueda =
          textos.join('\n').trim();

        if(
          textoBusqueda &&
          relacionado(textoBusqueda)
        ){
          registros.push({
            fecha: dateISO,
            hora: row.hora || '',
            pozo: row.pozo || '—',
            recorredor: row.recorredor || '',
            tipo: 'NOTA DE CAMPO',

            observacion:
              String(
                row.nota ||
                src.observaciones ||
                src.observacion ||
                src.obs ||
                src.mensaje ||
                src.msg ||
                src.texto ||
                src.descripcion ||
                ''
              ).trim()
          });
        }
      });

      let ws = workbook.getWorksheet(
        'Equipos de inyección'
      );

      if(ws){
        workbook.removeWorksheet(ws.id);
      }

      ws = workbook.addWorksheet(
        'Equipos de inyección'
      );

      ws.mergeCells('A1:F1');

      ws.getCell('A1').value =
        'EQUIPOS DE INYECCIÓN — SEGUIMIENTO OPERATIVO';

      ws.getCell('A1').font = {
        bold:true,
        size:16
      };

      ws.mergeCells('A2:F2');

      ws.getCell('A2').value =
        'Campo Cuichapa · ' +
        this.dateLong(dateISO);

      const headers = [
        'Fecha',
        'Hora',
        'Pozo',
        'Recorredor',
        'Tipo',
        'Observación / Nota'
      ];

      const header = ws.getRow(4);

      headers.forEach((txt, i) => {
        const c = header.getCell(i + 1);

        c.value = txt;

        c.font = {
          bold:true,
          color:{argb:'FFFFFFFF'}
        };

        c.fill = {
          type:'pattern',
          pattern:'solid',
          fgColor:{argb:'FF2F5FA7'}
        };

        c.alignment = {
          horizontal:'center',
          vertical:'middle'
        };
      });

      if(!registros.length){

        ws.mergeCells('A5:F5');

        ws.getCell('A5').value =
          'Sin registros relacionados con equipos de inyección.';

      }else{

        registros.forEach(item => {

          const row = ws.addRow([
            item.fecha,
            item.hora,
            item.pozo,
            item.recorredor,
            item.tipo,
            item.observacion
          ]);

          row.getCell(6).alignment = {
            vertical:'top',
            wrapText:true
          };

          row.height = 36;
        });
      }

      ws.columns = [
        {width:14},
        {width:14},
        {width:14},
        {width:22},
        {width:22},
        {width:70}
      ];

      ws.views = [{
        state:'frozen',
        ySplit:4
      }];

      return registros.length;
    },

    async downloadWorkbook(
      workbook,
      filename
    ){
      const buffer =
        await workbook.xlsx.writeBuffer();

      const blob = new Blob(
        [buffer],
        {
          type:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1500);
    },

    async generate(){
      const dateInput = document.getElementById(
        'reporteCampoFecha'
      );

      const button = document.getElementById(
        'reporteCampoGenerar'
      );

      const status = document.getElementById(
        'reporteCampoStatus'
      );

      const dateISO = dateInput?.value || '';

      if(!dateISO){
        alert('Selecciona la fecha del reporte.');
        return;
      }

      const reports = this.selectedReports(
        dateISO
      ).filter(row => {
        const fechaReal = this.reportDate(row);
        return fechaReal && fechaReal.iso === dateISO;
      });

      /*
       * SEGURIDAD DE FECHA:
       * Ningún dato de otro día puede entrar al Excel.
       * Si se solicita 2026-08-26, solamente se utilizan
       * registros cuya fecha real sea 2026-08-26.
       */
      const contaminados = reports.filter(row => {
        const fechaReal = this.reportDate(row);
        return !fechaReal || fechaReal.iso !== dateISO;
      });

      if(contaminados.length){
        throw new Error(
          'Se detectaron registros fuera de la fecha solicitada. ' +
          'La generación fue cancelada por seguridad.'
        );
      }

      if(!reports.length){
        alert(
          'No existen reportes para la fecha seleccionada.'
        );
        return;
      }

      if(button){
        button.disabled = true;
        button.textContent =
          'Generando Excel…';
      }

      if(status){
        status.textContent =
          'Leyendo reportes de Firebase…';
      }

      try{
        const data = this.buildData(reports, dateISO);
        const workbook =
          await this.loadTemplate();

        const summary = workbook.getWorksheet(
          'Resumen'
        );

        const pressures = workbook.getWorksheet(
          'Presiones por Pozo'
        );

        const latest = workbook.getWorksheet(
          'Resumen por Pozo'
        );

        const observations = workbook.getWorksheet(
          'Observaciones de Campo'
        );

        /*
         * NOTAS DE CAMPO ELIMINADA DEL REPORTE FINAL.
         */
        const notesSheet = workbook.getWorksheet('Notas de Campo');

        if(notesSheet){
          workbook.removeWorksheet(notesSheet.id);
        }

        if(
          !summary ||
          !pressures ||
          !latest ||
          !observations
        ){
          throw new Error(
            'La plantilla no contiene todas las hojas requeridas.'
          );
        }

        this.fillSummary(
          summary,
          dateISO,
          data
        );

        this.fillPressures(
          pressures,
          dateISO,
          data
        );

        this.fillLatest(
          latest,
          dateISO,
          data
        );

        this.fillObservations(
          observations,
          dateISO,
          data
        );

          const totalEquiposInyeccion =
            this.fillInjectionEquipment(
              workbook,
              dateISO,
              data
            );


        if(status){
          status.textContent =
            'Preparando descarga…';
        }

        await this.downloadWorkbook(
          workbook,
          this.outputName(dateISO).replace(
            /\.xlsx$/i,
            '_PRUEBA_' + Date.now() + '.xlsx'
          )
        );

        if(status){
          status.textContent =
            data.pressures.length +
            ' registros de presión · ' +
            data.observations.length +
            ' observaciones · Fecha: ' +
            dateISO;
        }

      }catch(error){
        console.error(
          '[REPORTE CAMPO EXCEL]',
          error
        );

        if(status){
          status.textContent =
            'Error: ' + error.message;
        }

        alert(
          'No se pudo generar el reporte: ' +
          error.message
        );

      }finally{
        if(button){
          button.disabled = false;
          button.textContent =
            'Generar Excel';
        }
      }
    },

    todayMexico(){
      const parts = this.datePartsMexico(
        new Date()
      );

      return parts
        ? parts.iso
        : '';
    },

    injectUI(){
      if(
        document.getElementById(
          'reporteCampoCard'
        )
      ){
        return;
      }

      const heading = Array.from(
        document.querySelectorAll('h2')
      ).find(element =>
        /Documentos operativos/i.test(
          element.textContent || ''
        )
      );

      if(!heading){
        console.warn(
          '[REPORTE CAMPO] No se encontró la vista Documentos.'
        );
        return;
      }

      const panel = heading.closest('.panel') ||
        heading.parentElement?.parentElement ||
        heading.parentElement;

      const grid =
        panel?.querySelector('.export-grid') ||
        panel?.querySelector('.documents-grid') ||
        panel;

      if(!grid){
        return;
      }

      const card = document.createElement('article');

      card.id = 'reporteCampoCard';
      card.className = 'export-card';

      card.innerHTML = `
        <h3>Reporte diario de campo</h3>

        <p>
          Genera presiones, última lectura por pozo,
          observaciones y notas de campo.
        </p>

        <label
          for="reporteCampoFecha"
          style="
            display:block;
            margin:12px 0 6px;
            font-size:12px;
            font-weight:800;
          "
        >
          Fecha del reporte
        </label>

        <input
          type="date"
          id="reporteCampoFecha"
          value="${this.todayMexico()}"
          style="
            width:100%;
            box-sizing:border-box;
            padding:11px 12px;
            border:1px solid var(--border);
            border-radius:10px;
            background:var(--surface);
            color:var(--txt);
            font:inherit;
            margin-bottom:10px;
          "
        >

        <button
          type="button"
          id="reporteCampoGenerar"
          class="primary-btn"
          style="width:100%"
        >
          Generar Excel
        </button>

        <div
          id="reporteCampoStatus"
          class="muted"
          style="
            margin-top:9px;
            min-height:18px;
            font-size:11px;
            line-height:1.4;
          "
        ></div>
      `;

      grid.appendChild(card);

      document.getElementById(
        'reporteCampoGenerar'
      )?.addEventListener(
        'click',
        () => this.generate()
      );
    },

    init(){
      const run = () => {
        this.injectUI();
      };

      if(document.readyState === 'loading'){
        document.addEventListener(
          'DOMContentLoaded',
          run,
          {
            once: true
          }
        );
      }else{
        run();
      }

      setTimeout(run, 1200);
    }
  };

  window.ReporteCampoExcel =
    ReporteCampoExcel;

  ReporteCampoExcel.init();
})();
