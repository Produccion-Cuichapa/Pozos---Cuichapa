(function instalarPortadaUPVSegura(){
  'use strict';

  if(window.__upvPortadaSeguraV4){
    return;
  }

  window.__upvPortadaSeguraV4 = true;

  function normalizar(valor){
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function texto(elemento){
    if(!elemento) return '';

    return normalizar(
      elemento.textContent ||
      elemento.getAttribute?.('aria-label') ||
      elemento.getAttribute?.('data-company') ||
      elemento.getAttribute?.('data-empresa') ||
      ''
    );
  }

  function candidatos(){
    return Array.from(
      document.querySelectorAll(
        'button, a, article, li, [role="button"], ' +
        '[data-company], [data-empresa], ' +
        '.company-card, .empresa-card, ' +
        '.option-card, .menu-card'
      )
    );
  }

  function buscarEmpresa(nombre){
    var objetivo = normalizar(nombre);
    var lista = candidatos();

    return lista.find(function(elemento){
      return texto(elemento) === objetivo;
    }) || lista.find(function(elemento){
      var contenido = texto(elemento);

      return (
        contenido.includes(objetivo) &&
        contenido.length <= objetivo.length + 80
      );
    }) || null;
  }

  function obtenerTarjeta(elemento){
    if(!elemento) return null;

    return elemento.closest(
      '.company-card, .empresa-card, .option-card, ' +
      '.menu-card, article, li, button, a, [role="button"]'
    ) || elemento;
  }

  function ancestroComun(a, b){
    var actual = a;

    while(actual && actual !== document.body){
      if(actual.contains(b)){
        return actual;
      }

      actual = actual.parentElement;
    }

    return null;
  }

  function liberarAncestros(elemento){
    var actual = elemento?.parentElement;

    while(actual && actual !== document.body){
      actual.classList.add('upv-layout-liberado');
      actual = actual.parentElement;
    }
  }

  function eliminarPortadaArtificial(){
    document.querySelectorAll(
      '.upv-fullscreen-root, #upvFullscreenLanding'
    ).forEach(function(elemento){
      /*
       * Antes de quitar la portada artificial, devolver cualquier
       * tarjeta original que hubiera sido movida dentro de ella.
       */
      elemento.querySelectorAll(
        '.upv-company-card'
      ).forEach(function(tarjeta){
        document.body.appendChild(tarjeta);
      });

      elemento.remove();
    });

    document.querySelectorAll(
      '.upv-original-landing-hidden'
    ).forEach(function(elemento){
      elemento.classList.remove(
        'upv-original-landing-hidden'
      );
    });

    document.body.classList.remove(
      'upv-fullscreen-active',
      'upv-portada-activa'
    );
  }

  function encontrarPantalla(petro, ipep){
    var comun = ancestroComun(petro, ipep);

    if(comun){
      var actual = comun;

      while(
        actual.parentElement &&
        actual.parentElement !== document.body
      ){
        var contenido = texto(actual.parentElement);

        if(
          contenido.includes('UPV') &&
          contenido.includes('SELECCIONA TU EMPRESA')
        ){
          actual = actual.parentElement;
        }else{
          break;
        }
      }

      return actual;
    }

    return document.querySelector(
      '.landing, .welcome, .home, .screen, main'
    ) || document.body;
  }

  function preparar(){
    eliminarPortadaArtificial();

    var petroElemento = buscarEmpresa('PETROSMART');
    var ipepElemento = buscarEmpresa('IPEP');
    var atoElemento = buscarEmpresa('ATO');

    var petro = obtenerTarjeta(petroElemento);
    var ipep = obtenerTarjeta(ipepElemento);
    var ato = obtenerTarjeta(atoElemento);

    if(ato){
      ato.style.display = 'none';
      ato.setAttribute('hidden', '');
      ato.classList.add('upv-company-ato-hidden');
    }

    if(!petro || !ipep){
      return false;
    }

    petro.classList.add(
      'upv-company-choice',
      'upv-company-choice-petrosmart'
    );

    ipep.classList.add(
      'upv-company-choice',
      'upv-company-choice-ipep'
    );

    petro.setAttribute(
      'aria-label',
      'PETROSMART'
    );

    ipep.setAttribute(
      'aria-label',
      'IPEP'
    );

    var grid = ancestroComun(petro, ipep);

    if(grid){
      grid.classList.add('upv-company-choice-grid');
    }

    var pantalla = encontrarPantalla(petro, ipep);

    pantalla.classList.add('upv-landing-renovada');

    liberarAncestros(pantalla);

    document.body.classList.add(
      'upv-cuichapa-theme',
      'upv-landing-segura'
    );

    var titulo = Array.from(
      pantalla.querySelectorAll(
        'h1, h2, h3, strong, p, span, div'
      )
    ).find(function(elemento){
      return texto(elemento) === 'UPV';
    });

    if(titulo){
      titulo.classList.add('upv-titulo-principal');
    }

    var selectorTitulo = Array.from(
      pantalla.querySelectorAll(
        'h1, h2, h3, h4, strong, p, span, div'
      )
    ).find(function(elemento){
      return texto(elemento) === 'SELECCIONA TU EMPRESA';
    });

    if(selectorTitulo){
      selectorTitulo.classList.add(
        'upv-selector-titulo'
      );
    }

    var instalar =
      document.getElementById('installBtn') ||
      Array.from(
        document.querySelectorAll('button, a')
      ).find(function(elemento){
        return texto(elemento).includes('INSTALAR UPV');
      });

    if(instalar){
      instalar.classList.add('upv-install-renovado');
    }

    console.log(
      '[UPV] Portada segura instalada: PETROSMART e IPEP.'
    );

    return true;
  }

  function iniciar(){
    if(preparar()){
      return;
    }

    var intentos = 0;

    var timer = setInterval(function(){
      intentos += 1;

      if(preparar() || intentos >= 30){
        clearInterval(timer);
      }
    }, 250);
  }

  if(document.readyState === 'loading'){
    document.addEventListener(
      'DOMContentLoaded',
      iniciar,
      {once:true}
    );
  }else{
    iniciar();
  }
})();
