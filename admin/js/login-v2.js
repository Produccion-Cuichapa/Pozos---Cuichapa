(function () {
  'use strict';

  function initLoginV2() {
    const password = document.getElementById('loginPass');
    const toggle = document.getElementById('loginTogglePass');
    const user = document.getElementById('loginUser');
    const login = document.getElementById('loginBtn');

    if (password && toggle) {
      toggle.addEventListener('click', function () {
        const hidden = password.type === 'password';

        password.type = hidden ? 'text' : 'password';
        toggle.textContent = hidden ? 'Ocultar' : 'Ver';
        toggle.setAttribute(
          'aria-label',
          hidden ? 'Ocultar contraseña' : 'Mostrar contraseña'
        );
      });
    }

    if (user) {
      user.addEventListener('change', function () {
        const error = document.getElementById('loginError');

        if (error) {
          error.textContent = '';
        }
      });
    }

    if (password && login) {
      password.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          login.click();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initLoginV2
    );
  } else {
    initLoginV2();
  }
})();
