name: Check-in Recorredores — Alerta 2 horas

on:
  schedule:
    - cron: '0,30 14-22 * * 1-5'
  workflow_dispatch:

jobs:
  checkin:
    runs-on: ubuntu-latest
    steps:
      - name: Verificar check-in de recorredores
        env:
          FIREBASE_DB_URL: ${{ secrets.FIREBASE_DB_URL }}
          UM_TOKEN: ${{ secrets.UM_TOKEN }}
          UM_INSTANCE: ${{ secrets.UM_INSTANCE }}
        run: |
          node << 'SCRIPT'
          const https = require('https');

          const FB_URL   = process.env.FIREBASE_DB_URL;
          const UM_TOKEN = process.env.UM_TOKEN;
          const UM_INST  = process.env.UM_INSTANCE;
          const WA_TO    = '120363427639300014@g.us'; // Grupo Pozos
          const RECORREDORES = ['Manrique', 'Cirilo', 'Juan Carlos'];
          const LIMITE_MS    = 2 * 60 * 60 * 1000;

          const ahoraUTC  = new Date();
          const ahoraMX   = new Date(ahoraUTC.getTime() - 6 * 60 * 60 * 1000);
          const horaMX    = ahoraMX.getHours();
          const minMX     = ahoraMX.getMinutes();
          const horaStr   = ahoraMX.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'});

          if(horaMX < 8 || horaMX >= 16){
            console.log(`Fuera de horario: ${horaMX}:${minMX < 10 ? '0'+minMX : minMX} hora México`);
            process.exit(0);
          }
          console.log(`Revisando check-in a las ${horaStr} hora México`);

          function firebaseGet(path){
            return new Promise((resolve, reject) => {
              https.get(`${FB_URL}/${path}.json`, res => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(null); } });
              }).on('error', reject);
            });
          }

          function enviarWA(msg){
            return new Promise((resolve, reject) => {
              const body = `token=${encodeURIComponent(UM_TOKEN)}&to=${encodeURIComponent(WA_TO)}&body=${encodeURIComponent(msg)}`;
              const opts = {
                hostname: 'api.ultramsg.com',
                path: `/${UM_INST}/messages/chat`,
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
              };
              const req = https.request(opts, res => {
                let d = '';
                res.on('data', c => d += c);
                res.on('end', () => { console.log('WA:', d); resolve(d); });
              });
              req.on('error', reject);
              req.write(body); req.end();
            });
          }

          async function main(){
            const reportes = await firebaseGet('reportes');
            if(!reportes){ console.log('Sin reportes en Firebase'); process.exit(0); }

            const arr = Object.values(reportes);
            const ahora = Date.now();
            const alertas = [];

            for(const rec of RECORREDORES){
              const propios = arr.filter(r => r.recorredor === rec && !r.esAlarma);
              if(!propios.length){ console.log(`${rec}: sin reportes`); continue; }

              const ultimo = propios.reduce((a, b) => new Date(a.fecha) > new Date(b.fecha) ? a : b);
              const diffMs  = ahora - new Date(ultimo.fecha).getTime();
              const diffMin = Math.round(diffMs / 60000);
              console.log(`${rec}: último reporte hace ${diffMin} min`);

              if(diffMs >= LIMITE_MS) alertas.push({ rec, diffMin, pozo: ultimo.pozo || '?' });
            }

            if(!alertas.length){ console.log('✅ Todos al día'); process.exit(0); }

            for(const a of alertas){
              const hrs  = Math.floor(a.diffMin / 60);
              const mins = a.diffMin % 60;
              const msg =
                `⚠️ *ALERTA CHECK-IN — CAMPO CUICHAPA*\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `👷 *${a.rec}* sin reporte en ${hrs > 0 ? hrs+'h ' : ''}${mins}min\n` +
                `📍 Último pozo: C-${a.pozo}\n` +
                `🕐 Hora: ${horaStr}\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `_Verificar estado del recorredor_`;

              console.log(`🚨 Alerta para ${a.rec}...`);
              await enviarWA(msg);
              await new Promise(r => setTimeout(r, 2000));
            }
            console.log(`🚨 ${alertas.length} alerta(s) enviadas al grupo`);
          }

          main().catch(e => { console.error(e); process.exit(1); });
          SCRIPT
