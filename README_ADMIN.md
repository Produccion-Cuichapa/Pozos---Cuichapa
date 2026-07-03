# Admin Firebase - Pozos Cuichapa

## Archivos

Coloca estos archivos en la raíz de tu proyecto:

- admin.html
- admin/admin.css
- admin/admin.js

## Paso clave

Abre `admin/admin.js` y pega tu configuración real de Firebase en:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Normalmente esa config ya está en tu `index.html` o en tu archivo de configuración actual.

## Login inicial

Usuarios iniciales:

- AntonioS / 1234
- JaimeG / 1234
- IngDuctos / 1234
- Almacenista / 1234
- JorgeGill / 1234
- Supervisor / 1234
- Admin / 1234

Cambia esas contraseñas en `AUTH_USERS`.

## Deploy en Firebase Hosting

```bash
firebase deploy --only hosting
```

Después abre:

```text
https://TU-PROYECTO.web.app/admin.html
```

## Qué incluye

- Login local con sessionStorage
- Dashboard
- Reportes
- Alarmas
- Filtros por fecha, recorredor, pozo y modo
- Exportar CSV
- Vista JSON de detalle
- Lectura de `/reportes`
- Lectura de `/alarmas`
