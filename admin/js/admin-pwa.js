(function(){
  'use strict';

  const EMBEDDED_VERSION = '2026.07.19.045207';
  const VERSION_URL = './version.json';
  const SW_URL = './sw.js';
  const CHECK_INTERVAL = 30 * 60 * 1000;

  let deferredInstallPrompt = null;
  let registration = null;
  let reloading = false;
  let updateAvailable = false;

  function isStandalone(){
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function isIOS(){
    return /iphone|ipad|ipod/i.test(
      navigator.userAgent
    );
  }

  function shortVersion(value){
    return String(value || '')
      .replace(/^20/, '')
      .replace(/\.(\d{6})$/, ' · $1')
      .replace(/\./g, '.');
  }

  function createInterface(){
    if(document.getElementById('adminPwaTools')){
      return;
    }

    const tools = document.createElement('div');
    tools.id = 'adminPwaTools';
    tools.className = 'admin-pwa-tools';
    tools.innerHTML = `
      <span
        id="adminPwaVersion"
        class="admin-pwa-version"
        title="Versión instalada">
        v${shortVersion(EMBEDDED_VERSION)}
      </span>

      <button
        type="button"
        class="admin-pwa-menu-toggle"
        data-pwa-menu-toggle
        aria-label="Opciones de la aplicación"
        aria-expanded="false"
        title="Opciones">
        ⚙
      </button>

      <div
        class="admin-pwa-menu"
        data-pwa-menu
        hidden>

        <button
          type="button"
          class="admin-pwa-button secondary"
          data-pwa-install
          hidden>
          ⬇ Instalar
        </button>

        <button
          type="button"
          class="admin-pwa-button"
          data-pwa-update>
          ↻ Actualizar
        </button>
      </div>
    `;

    const toast = document.createElement('div');
    toast.id = 'adminPwaToast';
    toast.className = 'admin-pwa-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <strong>Nueva versión disponible</strong>
      <p>
        Actualiza Cuichapa Control para utilizar
        los cambios más recientes.
      </p>

      <div class="admin-pwa-toast-actions">
        <button
          type="button"
          class="admin-pwa-toast-update"
          data-pwa-apply>
          Actualizar ahora
        </button>

        <button
          type="button"
          class="admin-pwa-toast-later"
          data-pwa-later>
          Más tarde
        </button>
      </div>
    `;

    document.body.appendChild(tools);
    document.body.appendChild(toast);

    const menuToggle = tools.querySelector(
      '[data-pwa-menu-toggle]'
    );

    const menu = tools.querySelector(
      '[data-pwa-menu]'
    );

    if(menuToggle && menu){
      menuToggle.addEventListener('click', function(event){
        event.stopPropagation();

        const willOpen = menu.hidden;

        menu.hidden = !willOpen;
        menuToggle.setAttribute(
          'aria-expanded',
          String(willOpen)
        );

        tools.classList.toggle(
          'menu-open',
          willOpen
        );
      });

      menu.addEventListener('click', function(event){
        event.stopPropagation();
      });

      document.addEventListener('click', function(){
        menu.hidden = true;

        menuToggle.setAttribute(
          'aria-expanded',
          'false'
        );

        tools.classList.remove('menu-open');
      });

      document.addEventListener('keydown', function(event){
        if(event.key !== 'Escape'){
          return;
        }

        menu.hidden = true;

        menuToggle.setAttribute(
          'aria-expanded',
          'false'
        );

        tools.classList.remove('menu-open');
      });
    }

    tools
      .querySelector('[data-pwa-install]')
      .addEventListener('click', installApp);

    tools
      .querySelector('[data-pwa-update]')
      .addEventListener('click', manualUpdate);

    toast
      .querySelector('[data-pwa-apply]')
      .addEventListener('click', applyUpdate);

    toast
      .querySelector('[data-pwa-later]')
      .addEventListener('click', hideUpdateToast);

    configureInstallButton();
  }

  function configureInstallButton(){
    const button = document.querySelector(
      '[data-pwa-install]'
    );

    if(!button){
      return;
    }

    if(isStandalone()){
      button.hidden = true;
      return;
    }

    button.hidden = false;

    if(deferredInstallPrompt){
      button.textContent = '⬇ Instalar';
      return;
    }

    if(isIOS()){
      button.textContent = 'Cómo instalar';
      return;
    }

    button.textContent = '⬇ Instalar';
  }

  async function installApp(){
    if(isIOS() && !deferredInstallPrompt){
      alert(
        'Para instalar Cuichapa Control en iPhone o iPad:\n\n' +
        '1. Abre el botón Compartir de Safari.\n' +
        '2. Selecciona “Agregar a pantalla de inicio”.\n' +
        '3. Confirma con “Agregar”.'
      );
      return;
    }

    if(!deferredInstallPrompt){
      alert(
        'El navegador todavía no ha habilitado la instalación automática.\n\n' +
        'En Edge:\n' +
        '1. Abre el menú de tres puntos.\n' +
        '2. Entra a Aplicaciones.\n' +
        '3. Selecciona “Instalar Cuichapa Control”.\n\n' +
        'En Chrome:\n' +
        '1. Abre el menú de tres puntos.\n' +
        '2. Selecciona “Transmitir, guardar y compartir”.\n' +
        '3. Pulsa “Instalar Cuichapa Control”.\n\n' +
        'También revisa si aparece el icono de instalación al final de la barra de direcciones.'
      );
      return;
    }

    deferredInstallPrompt.prompt();

    try{
      await deferredInstallPrompt.userChoice;
    }finally{
      deferredInstallPrompt = null;
      configureInstallButton();
    }
  }

  function showUpdateToast(){
    updateAvailable = true;

    const toast = document.getElementById(
      'adminPwaToast'
    );

    if(toast){
      toast.classList.add('show');
    }
  }

  function hideUpdateToast(){
    const toast = document.getElementById(
      'adminPwaToast'
    );

    if(toast){
      toast.classList.remove('show');
    }
  }

  async function readRemoteVersion(){
    const response = await fetch(
      VERSION_URL + '?t=' + Date.now(),
      {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      }
    );

    if(!response.ok){
      throw new Error(
        'No fue posible consultar la versión.'
      );
    }

    return response.json();
  }

  async function checkVersion(showMessage){
    try{
      const remote = await readRemoteVersion();
      const version = String(remote.version || '');

      if(
        version &&
        version !== EMBEDDED_VERSION
      ){
        showUpdateToast();

        if(registration){
          await registration.update();
        }

        return true;
      }

      if(showMessage){
        alert(
          'Cuichapa Control ya está actualizado.\n\n' +
          'Versión: ' + EMBEDDED_VERSION
        );
      }

      return false;
    }catch(error){
      console.warn(
        '[PWA] No se pudo consultar la versión:',
        error
      );

      if(showMessage){
        alert(
          navigator.onLine
            ? 'No fue posible comprobar la actualización.'
            : 'No hay conexión. Se conservará la versión instalada.'
        );
      }

      return false;
    }
  }

  async function manualUpdate(){
    const updateButton = document.querySelector(
      '[data-pwa-update]'
    );

    if(updateButton){
      updateButton.disabled = true;
      updateButton.textContent = 'Revisando…';
    }

    try{
      if(registration){
        await registration.update();
      }

      const changed = await checkVersion(false);

      if(!changed && !updateAvailable){
        alert(
          'Cuichapa Control ya está actualizado.\n\n' +
          'Versión: ' + EMBEDDED_VERSION
        );
      }
    }catch(error){
      console.error('[PWA] Error de actualización:', error);

      alert(
        'No fue posible revisar la actualización.'
      );
    }finally{
      if(updateButton){
        updateButton.disabled = false;
        updateButton.textContent = '↻ Actualizar';
      }
    }
  }

  function applyUpdate(){
    hideUpdateToast();

    if(
      registration &&
      registration.waiting
    ){
      registration.waiting.postMessage({
        type: 'SKIP_WAITING'
      });

      return;
    }

    /*
     * El version.json ya confirmó una publicación nueva.
     * Recargar fuerza la descarga de index y archivos actuales.
     */
    window.location.replace(
      window.location.pathname +
      '?updated=' + Date.now() +
      window.location.hash
    );
  }

  function watchRegistration(reg){
    if(reg.waiting){
      showUpdateToast();
    }

    reg.addEventListener('updatefound', function(){
      const worker = reg.installing;

      if(!worker){
        return;
      }

      worker.addEventListener(
        'statechange',
        function(){
          if(
            worker.state === 'installed' &&
            navigator.serviceWorker.controller
          ){
            showUpdateToast();
          }
        }
      );
    });
  }

  async function registerServiceWorker(){
    if(!('serviceWorker' in navigator)){
      return;
    }

    try{
      registration =
        await navigator.serviceWorker.register(
          SW_URL,
          {
            scope: './',
            updateViaCache: 'none'
          }
        );

      watchRegistration(registration);

      await registration.update();
    }catch(error){
      console.error(
        '[PWA] Error registrando Service Worker:',
        error
      );
    }
  }

  window.addEventListener(
    'beforeinstallprompt',
    function(event){
      event.preventDefault();
      deferredInstallPrompt = event;
      configureInstallButton();
    }
  );

  window.addEventListener(
    'appinstalled',
    function(){
      deferredInstallPrompt = null;

      const button = document.querySelector(
        '[data-pwa-install]'
      );

      if(button){
        button.hidden = true;
      }
    }
  );

  navigator.serviceWorker &&
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      function(){
        if(reloading){
          return;
        }

        reloading = true;
        window.location.reload();
      }
    );

  document.addEventListener(
    'visibilitychange',
    function(){
      if(document.visibilityState === 'visible'){
        if(registration){
          registration.update();
        }

        checkVersion(false);
      }
    }
  );

  window.addEventListener('online', function(){
    if(registration){
      registration.update();
    }

    checkVersion(false);
  });

  document.addEventListener(
    'DOMContentLoaded',
    async function(){
      createInterface();
      await registerServiceWorker();
      await checkVersion(false);

      window.setInterval(
        function(){
          if(registration){
            registration.update();
          }

          checkVersion(false);
        },
        CHECK_INTERVAL
      );
    }
  );
})();
