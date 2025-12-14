# Control de Tránsito 🚦

PWA para el registro de operativos de control de tránsito con Dashboard de métricas.

## Características

- 📊 **Dashboard** con KPIs en tiempo real
- 📝 **Formulario** optimizado para móvil con botones +/-
- 📈 **Gráficos** de distribución de infracciones
- 📋 **Historial** con función de copiar reporte
- ☁️ **Google Sheets** como base de datos

## Stack

- Frontend: Vanilla JS + Chart.js
- Backend: Google Apps Script
- Database: Google Sheets
- PWA: Service Worker + Manifest

## Instalación

1. Clona el repositorio
2. Configura Google Sheets (ver `google-sheets/apps-script.js`)
3. Actualiza la URL del API en `client/js/api.js`
4. Sirve los archivos del directorio `client/`

## Desarrollo Local

```bash
npm install
npm run server
```

Abre http://localhost:3001

## Deploy

La carpeta `client/` puede desplegarse en cualquier hosting estático (Vercel, Netlify, GitHub Pages).
