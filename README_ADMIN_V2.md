# Admin v2 - Pozos Cuichapa

## Qué es

Plataforma administrativa separada de la app de campo.

La app actual queda igual:

```text
/
```

El admin entra aquí:

```text
/admin/
```

## Archivos incluidos

```text
admin/
  index.html
  css/admin.css
  js/config.js
  js/utils.js
  js/firebase.js
  js/auth.js
  js/ui.js
  js/dashboard.js
  js/reportes.js
  js/alarmas.js
  js/exportar.js
  js/app.js
```

## Cómo subirlo en Cloud Shell

Desde tu proyecto:

```bash
cd ~/Pozos---Cuichapa
```

Sube o copia la carpeta `admin/` a la raíz del proyecto.

Luego:

```bash
firebase deploy --only hosting
```

Abre:

```text
https://pozos-cuichapa.web.app/admin/
```

## Usuarios iniciales

Todos traen contraseña temporal `1234`:

- Admin
- AntonioS
- JaimeG
- IngDuctos
- Almacenista
- JorgeGill

Cámbialas en:

```text
admin/js/config.js
```

## Qué incluye la FASE 1

- Login de plataforma
- Dashboard
- Reportes en tiempo real
- Alarmas en tiempo real
- Filtros por fecha, búsqueda y modo
- Exportación CSV
- Detalle completo del registro
- Conexión al mismo Firebase de Pozos Cuichapa

## Importante

Este admin NO toca la app de campo.
No modifica `index.html`.
No cambia GPS.
No cambia WhatsApp.
No cambia offline.
No cambia fotos de la app.
