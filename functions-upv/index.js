'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const https = require('https');
const querystring = require('querystring');

admin.initializeApp();

const DB = admin.database();

const UPV_PATH = '/upvReportesPrueba';
const REGISTRY_PATH = '/upvWhatsappSentRegistry';

function CFG(){
  return functions.config().ultramsg || {};
}

function ultraPostChat(mensaje){

  const cfg = CFG();

  if(!cfg.instance){
    throw new Error(
      'ultramsg.instance no configurado en pozos-upv'
    );
  }

  if(!cfg.token){
    throw new Error(
      'ultramsg.token no configurado en pozos-upv'
    );
  }

  /*
   * PROTECCIÓN CRÍTICA:
   * UPV SOLO acepta upv_group.
   *
   * JAMÁS usamos cfg.group como fallback.
   */
  if(!cfg.upv_group){
    throw new Error(
      'ultramsg.upv_group no configurado en pozos-upv'
    );
  }

  const payload = querystring.stringify({
    token: cfg.token,
    to: cfg.upv_group,
    body: mensaje
  });

  return new Promise((resolve,reject) => {

    const req = https.request(
      {
        hostname: 'api.ultramsg.com',
        port: 443,
        path:
          '/' +
          cfg.instance +
          '/messages/chat',
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
          'Content-Length':
            Buffer.byteLength(payload)
        }
      },
      res => {

        let raw = '';

        res.on(
          'data',
          chunk => raw += chunk
        );

        res.on(
          'end',
          () => {

            let json = null;

            try{
              json = JSON.parse(raw);
            }catch(e){}

            if(
              res.statusCode >= 200 &&
              res.statusCode < 300
            ){
              return resolve({
                ok:true,
                statusCode:res.statusCode,
                raw:json || raw
              });
            }

            reject(
              new Error(
                'UltraMsg HTTP ' +
                res.statusCode +
                ': ' +
                raw
              )
            );
          }
        );
      }
    );

    req.on('error', reject);

    req.setTimeout(
      25000,
      () => {
        req.destroy(
          new Error('UltraMsg timeout')
        );
      }
    );

    req.write(payload);
    req.end();
  });
}


exports.sendUpvWhatsApp =
functions
  .runWith({
    timeoutSeconds:60,
    memory:'256MB'
  })
  .database
  .ref(
    UPV_PATH + '/{reportId}'
  )
  .onCreate(
    async (snap, context) => {

      const reportId =
        context.params.reportId;

      const data =
        snap.val();

      if(!data){
        return null;
      }


      /*
       * Solo registros creados por UPV.
       */
      if(
        String(
          data.origenApp || ''
        ).toUpperCase() !== 'UPV'
      ){
        console.warn(
          '[UPV-WA] origenApp inválido:',
          reportId
        );

        return null;
      }


      /*
       * SEGURIDAD:
       * mientras whatsappStatus no sea "pending",
       * la Function NO envía.
       *
       * Esto permite desplegar primero sin activar
       * todos los reportes de golpe.
       */
      if(
        data.whatsappStatus !== 'pending'
      ){
        console.log(
          '[UPV-WA] ignorado por status:',
          reportId,
          data.whatsappStatus
        );

        return null;
      }


      const mensaje =
        String(
          data.mensajeWhatsapp || ''
        ).trim();

      if(!mensaje){

        await snap.ref.update({
          whatsappStatus:'failed',
          whatsappError:
            'mensajeWhatsapp vacío'
        });

        return null;
      }


      /*
       * DEDUPE POR ID.
       */
      const lockRef =
        DB.ref(
          REGISTRY_PATH +
          '/' +
          reportId
        );

      const tx =
        await lockRef.transaction(
          current => {

            if(
              current &&
              (
                current.status === 'sending' ||
                current.status === 'sent'
              )
            ){
              return;
            }

            return {
              status:'sending',
              lockedAt:
                admin.database.ServerValue.TIMESTAMP
            };
          }
        );


      if(!tx.committed){

        console.log(
          '[UPV-WA] duplicado bloqueado:',
          reportId
        );

        return null;
      }


      try{

        const result =
          await ultraPostChat(
            mensaje
          );


        await lockRef.set({
          status:'sent',
          sentAt:
            admin.database.ServerValue.TIMESTAMP
        });


        await snap.ref.update({
          whatsappStatus:'sent',
          whatsappSentAt:
            admin.database.ServerValue.TIMESTAMP,
          whatsappError:null
        });


        console.log(
          '[UPV-WA] enviado:',
          reportId,
          result.statusCode
        );


        return null;

      }catch(error){

        console.error(
          '[UPV-WA] error:',
          reportId,
          error.message
        );


        await lockRef.set({
          status:'failed',
          failedAt:
            admin.database.ServerValue.TIMESTAMP,
          error:
            String(error.message || error)
              .slice(0,500)
        });


        await snap.ref.update({
          whatsappStatus:'failed',
          whatsappError:
            String(error.message || error)
              .slice(0,500)
        });


        return null;
      }
    }
  );
