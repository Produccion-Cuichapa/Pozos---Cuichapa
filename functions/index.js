/**
 * Campo Cuichapa U-39 — Cloud Function: envío único WhatsApp
 * ─────────────────────────────────────────────────────────────
 * Único proceso autorizado para llamar UltraMsg.
 * El cliente (app móvil) solo escribe en Firebase.
 * Esta función escucha whatsappStatus:"pending" y envía UNA sola vez.
 *
 * Deploy:
 *   cd functions && npm install
 *   firebase deploy --only functions
 *
 * Configura con:
 *   firebase functions:config:set \
 *     ultramsg.instance="TU_INSTANCE_ID" \
 *     ultramsg.token="TU_TOKEN" \
 *     ultramsg.group="TU_GRUPO@g.us"
 */

'use strict';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const https     = require('https');

admin.initializeApp();

const DB        = admin.database();
const CFG       = () => functions.config().ultramsg || {};

// ── Constantes ────────────────────────────────────────────────
const REGISTRY_PATH  = '/whatsappSentRegistry';
const REPORTES_PATH  = '/reportes';
const MAX_ATTEMPTS   = 3;
const LOCK_TIMEOUT_MS= 90 * 1000; // 90s — si la CF muere, se libera

// ── Helper: HTTP POST a UltraMsg ─────────────────────────────
function ultraMsgPost(path, body){
  return new Promise(function(resolve, reject){
    var cfg = CFG();
    if(!cfg.instance) return reject(new Error('[WA_BACKEND] ultramsg.instance no configurado'));
    if(!cfg.token)    return reject(new Error('[WA_BACKEND] ultramsg.token no configurado'));
    if(!cfg.group)    return reject(new Error('[WA_BACKEND] ultramsg.group no configurado'));
    var host   = 'api.ultramsg.com';
        var full   = '/' + cfg.instance + path;
    var data   = Object.entries({ token: cfg.token, ...body })
                       .map(([k,v]) => encodeURIComponent(k)+'='+encodeURIComponent(v))
                       .join('&');
    var opts   = {
      hostname: host, port: 443, path: full, method: 'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    var req = https.request(opts, function(res){
      var chunks = [];
      res.on('data', function(c){ chunks.push(c); });
      res.on('end',  function(){
        try{
          var json = JSON.parse(Buffer.concat(chunks).toString());
          var ok   = json && (json.sent === 'true' || json.sent === true || json.id);
          resolve({ ok: !!ok, id: json.id || null, raw: json });
        }catch(e){ reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(25000, function(){ req.destroy(new Error('UltraMsg timeout')); });
    req.write(data);
    req.end();
  });
}

// ── Enviar texto ──────────────────────────────────────────────
function sendText(msg){
  var cfg = CFG();
  return ultraMsgPost('/messages/chat', {
    to:   cfg.group,
    body: msg
  });
}

// ── Enviar imagen base64 ──────────────────────────────────────
function sendImage(base64, caption){
  var cfg = CFG();
  return ultraMsgPost('/messages/image', {
    to:      cfg.group,
    image:   'data:image/jpeg;base64,' + base64,
    caption: caption || ''
  });
}

// ── Verificar y limpiar locks expirados ──────────────────────
async function clearExpiredLock(reportId){
  var snap   = await DB.ref(REGISTRY_PATH + '/' + reportId).once('value');
  var entry  = snap.val();
  if(!entry || entry.status !== 'sending') return false;
  var locked = entry.lockedAt || 0;
  if(Date.now() - locked > LOCK_TIMEOUT_MS){
    console.log('[WA_BACKEND] lock expired, clearing:', reportId);
    await DB.ref(REGISTRY_PATH + '/' + reportId).remove();
    return true; // lock cleared, can proceed
  }
  return false; // still locked
}

// ══════════════════════════════════════════════════════════════
// TRIGGER: /reportes/{reportId} onWrite
// ══════════════════════════════════════════════════════════════
exports.sendWhatsApp = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .database.ref(REPORTES_PATH + '/{reportId}')
  .onWrite(async function(change, context){

    var after = change.after.val();
    if(!after)        return null; // deleted
    if(after.esAlarma) return null; // alarms are handled separately

    // Only process 'pending' status
    if(after.whatsappStatus !== 'pending') return null;
    if(after.whatsappSent   === true)      return null;

    var reportId = context.params.reportId;
    var attempts = (after.whatsappAttempts || 0);
    if(attempts >= MAX_ATTEMPTS){
      console.log('[WA_BACKEND] max attempts reached:', reportId);
      await DB.ref(REPORTES_PATH + '/' + reportId).update({ whatsappStatus: 'blocked' });
      return null;
    }

    console.log('[WA_BACKEND] pending detected:', reportId);

    // ── STEP 1: Acquire lock via transaction ─────────────────
    var lockRef    = DB.ref(REGISTRY_PATH + '/' + reportId);
    var acquired   = false;

    var txResult = await lockRef.transaction(function(current){
      if(current !== null){
        // Check if it's an expired lock
        if(current.status === 'sending' &&
           current.lockedAt &&
           Date.now() - current.lockedAt > LOCK_TIMEOUT_MS){
          // Override expired lock
          acquired = true;
          return {
            status:   'sending',
            lockedAt:  Date.now(),
            lockedBy: 'cloud-function',
            reportId:  reportId
          };
        }
        // Lock exists and is valid — skip
        return; // abort transaction (undefined = abort)
      }
      // No lock exists — acquire it
      acquired = true;
      return {
        status:   'sending',
        lockedAt:  Date.now(),
        lockedBy: 'cloud-function',
        reportId:  reportId
      };
    });

    if(!acquired || !txResult.committed){
      console.log('[WA_BACKEND] duplicate skip (lock exists):', reportId);
      return null;
    }
    console.log('[WA_BACKEND] lock acquired:', reportId);

    // ── STEP 2: Mark report as 'sending' in Firebase ─────────
    await DB.ref(REPORTES_PATH + '/' + reportId).update({
      whatsappStatus:   'sending',
      whatsappLockedAt:  admin.database.ServerValue.TIMESTAMP,
      whatsappAttempts:  attempts + 1
    });

    // ── STEP 3: Send text to UltraMsg ────────────────────────
    var msg = after.msg || [
      '🚨 *ALARMA DE CAMPO*',
      'Tipo: ' + (after.tipo || 'Sin tipo'),
      'Recorredor: ' + (after.quien || after.recorredor || 'Sin nombre'),
      'Hora: ' + (after.hora || ''),
      'Lugar: ' + (after.lugar || ''),
      after.nota ? ('Nota: ' + after.nota) : ''
    ].filter(Boolean).join('\\n');
    var ultraId = null;
    var textOk  = false;

    try{
      console.log('[WA_BACKEND] sending UltraMsg text:', reportId);
      var textResult = await sendText(msg);
      textOk   = textResult.ok;
      ultraId  = textResult.id;
      if(!textOk) throw new Error('UltraMsg returned not-sent: ' + JSON.stringify(textResult.raw));
    }catch(err){
      console.error('[WA_BACKEND] failed text send:', reportId, err.message);
      await DB.ref(REPORTES_PATH + '/' + reportId).update({
        whatsappStatus:    'failed',
        lastWhatsappError:  err.message,
        whatsappFailedAt:   admin.database.ServerValue.TIMESTAMP
      });
      // Release lock so it can retry
      await lockRef.remove();
      console.log('[WA_BACKEND] failed, lock released:', reportId);
      return null;
    }

    // ── STEP 4: Send photos (best-effort, text already sent) ─
    var fotos       = after.fotos || [];
    var fotosOk     = true;
    var recorredor  = after.recorredor || '';
    var pozo        = after.pozo       || '';

    for(var i = 0; i < fotos.length; i++){
      try{
        var foto    = fotos[i];
        var src     = typeof foto === 'object' ? (foto.data || '') : foto;
        if(!src) continue;
        var base64  = src.includes(',') ? src.split(',')[1] : src;
        var caption = '📸 Foto '+(i+1)+' — C-'+pozo+' ('+recorredor+')';
        var imgResult = await sendImage(base64, caption);
        if(!imgResult.ok) fotosOk = false;
        // Small delay between photos
        if(i < fotos.length - 1) await new Promise(function(r){ setTimeout(r, 1500); });
      }catch(imgErr){
        console.error('[WA_BACKEND] photo failed:', i, imgErr.message);
        fotosOk = false;
      }
    }

    // ── STEP 5: Mark as sent + limpiar fotos base64 (FIX 0 Android) ─────
    // Las fotos ya fueron enviadas por UltraMsg.
    // Limpiarlas de Firebase impide que Android las descargue de nuevo.
    var sentAt = admin.database.ServerValue.TIMESTAMP;
    var nFotosEnviadas = (after.fotos || []).length;
    await DB.ref(REPORTES_PATH + '/' + reportId).update({
      whatsappStatus:       'sent',
      whatsappSent:          true,
      whatsappSentAt:        sentAt,
      whatsappTextStatus:   'sent',
      whatsappPhotoStatus:   fotosOk ? 'sent' : 'partial',
      ultraMsgResponseId:    ultraId  || null,
      fotos:                 null,          // FIX 0 Android: vaciar base64
      nFotos:                nFotosEnviadas // conservar solo el conteo
    });

    // Update registry to 'sent' (permanent — never retried)
    await lockRef.set({
      status:            'sent',
      sentAt:             Date.now(),
      reportId:           reportId,
      ultraMsgResponseId: ultraId || null
    });

    console.log('[WA_BACKEND] sent OK:', reportId, '| textOk:', textOk, '| fotosOk:', fotosOk);
    return null;
  });

// ══════════════════════════════════════════════════════════════
// TRIGGER: /alarmas/{alarmaId} onWrite (alarms keep same pattern)
// ══════════════════════════════════════════════════════════════
// ── Helper: clave de contenido para alarmas ──────────────────
// Previene duplicados aunque el alarmaId sea diferente.
// Ventana de 60 segundos + tipo + recorredor + coords redondeadas.
function _alarmContentKey(data){
  var tipo  = String(data.tipo  || '').toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,20);
  var quien = String(data.quien || '').toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,15);
  // Coordenadas: puntos -> 'p', signo menos -> 'n', 3 decimales (~111m)
  var coords = 'nocoords';
  if(data.lugar){
    var m = String(data.lugar).match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if(m){
      var lat = parseFloat(m[1]).toFixed(3).replace('-','n').replace('.','p');
      var lon = parseFloat(m[2]).toFixed(3).replace('-','n').replace('.','p');
      coords = lat + '_' + lon;
    }
  }
  var slot = Math.floor(Date.now() / 60000);
  var raw = 'alarm_content_' + tipo + '_' + quien + '_' + coords + '_' + slot;
  // Firebase no permite . # $ [ ] / en paths
  return raw.replace(/[.#$\[\]\/]/g, '_');
}

exports.sendAlarmWhatsApp = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .database.ref('/alarmas/{alarmaId}')
  .onWrite(async function(change, context){
    var after = change.after.val();
    if(!after) return null;
    if(after.whatsappStatus !== 'pending') return null;
    if(after.whatsappSent   === true)      return null;

    var alarmaId = context.params.alarmaId;
    console.log('[WA_BACKEND] pending detected alarm:', alarmaId);

    // ── LOCK 1: por ID de alarma (previene reentrada del mismo doc) ───
    var idLockRef = DB.ref(REGISTRY_PATH + '/alarm_id_' + alarmaId);
    var idAcquired = false;
    var idTx = await idLockRef.transaction(function(current){
      if(current !== null) return; // ya existe → abortar
      idAcquired = true;
      return { status:'sending', lockedAt:Date.now() };
    });
    if(!idAcquired || !idTx.committed){
      console.log('[WA_BACKEND] alarm id-lock skip:', alarmaId);
      return null;
    }

    // ── LOCK 2: por contenido (previene duplicados tipo/recorredor/coords/tiempo) ─
    var contentKey = _alarmContentKey(after);
    var contentRef = DB.ref('/alarmDedupeRegistry/' + contentKey);
    var contentAcquired = false;
    var contentTx = await contentRef.transaction(function(current){
      if(current !== null){
        console.log('[WA_BACKEND] alarm content-dedupe skip:', contentKey, current.status);
        return; // ya enviado o enviando en ventana 60s → abortar
      }
      contentAcquired = true;
      return { status:'sending', alarmaId:alarmaId, lockedAt:Date.now() };
    });
    if(!contentAcquired || !contentTx.committed){
      // Liberar id-lock ya que no vamos a enviar
      await idLockRef.set({ status:'content_skip', skippedAt:Date.now() });
      console.log('[WA_BACKEND] alarm content duplicate skip:', contentKey);
      // Marcar este alarmaId como sent para que no se reintente
      await DB.ref('/alarmas/'+alarmaId).update({
        whatsappStatus:'sent', whatsappSent:true,
        whatsappSentAt:admin.database.ServerValue.TIMESTAMP,
        skippedAsDuplicate:true
      });
      return null;
    }

    console.log('[WA_BACKEND] alarm sending:', alarmaId, 'contentKey:', contentKey);
    var msg = after.msg || [
      '🚨 *ALARMA DE CAMPO*',
      'Tipo: ' + (after.tipo || 'Sin tipo'),
      'Recorredor: ' + (after.quien || after.recorredor || 'Sin nombre'),
      'Hora: ' + (after.hora || ''),
      'Lugar: ' + (after.lugar || ''),
      after.nota ? ('Nota: ' + after.nota) : ''
    ].filter(Boolean).join('\\n');

    try{
      var result = await sendText(msg);
      if(!result.ok) throw new Error('UltraMsg alarm failed: ' + JSON.stringify(result.raw));

      // ── Marcar enviado en ambos registros ────────────────────
      await DB.ref('/alarmas/'+alarmaId).update({
        whatsappStatus:'sent', whatsappSent:true,
        whatsappSentAt:admin.database.ServerValue.TIMESTAMP
      });
      await idLockRef.set({ status:'sent', sentAt:Date.now() });
      await contentRef.set({ status:'sent', alarmaId:alarmaId, sentAt:Date.now() });
      console.log('[WA_BACKEND] alarm sent OK:', alarmaId);

    }catch(err){
      console.error('[WA_BACKEND] alarm send error:', alarmaId, err.message);
      try{
        await idLockRef.remove(); // liberar para reintento
        await DB.ref('/alarmas/'+alarmaId).update({
          whatsappStatus:'failed',
          lastWhatsappError: String(err.message).slice(0,200)
        });
        // contentRef se conserva 60s para no duplicar mientras se reintenta
      }catch(cleanupErr){
        console.error('[WA_BACKEND] cleanup error:', cleanupErr.message);
      }
    }
    return null;
  });

// ══════════════════════════════════════════════════════════════
// SCHEDULED: Retry failed reports every 10 minutes
// ══════════════════════════════════════════════════════════════
exports.retryFailedWhatsApp = functions
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.schedule('every 10 minutes')
  .onRun(async function(){
    var snap = await DB.ref(REPORTES_PATH)
      .orderByChild('whatsappStatus')
      .equalTo('failed')
      .once('value');

    if(!snap.exists()){
      console.log('[WA_BACKEND] retry: no failed reports');
      return null;
    }

    var updates = {};
    snap.forEach(function(child){
      var r = child.val();
      if((r.whatsappAttempts||0) < MAX_ATTEMPTS){
        // Reset to pending so the onWrite trigger picks it up
        updates[child.key + '/whatsappStatus'] = 'pending';
      }
    });

    if(Object.keys(updates).length){
      await DB.ref(REPORTES_PATH).update(updates);
      console.log('[WA_BACKEND] retry: reset', Object.keys(updates).length, 'reports to pending');
    }
    return null;
  });
