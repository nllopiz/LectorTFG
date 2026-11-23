# WebMili · Lector TFG

Lector web dedicado a un trabajo final de grado. El documento está incluido en `index.html` y se muestra al abrir la aplicación; no hay carga de archivos ni cuentas.

## Funcionalidades

- Portada, introducción, cuatro capítulos y conclusión.
- Índice generado desde los encabezados, con navegación lateral responsive.
- Tema claro/oscuro y tamaño de lectura ajustable; las preferencias se guardan en el dispositivo.
- Reproducción integrada de enlaces de YouTube y Spotify, con opción para abrirlos en el servicio original.
- Navegación por teclado y soporte para movimiento reducido.

## Ejecución local

Los módulos JavaScript necesitan un servidor estático; no abras `index.html` directamente con `file://`.

```powershell
python -m http.server 8080
```

Abre <http://localhost:8080>.

Para editar el contenido del TFG, modifica las secciones de `index.html`. Las fuentes y sus licencias están en `assets/fonts/`.

## Pruebas

```powershell
npm test
```

Las pruebas actuales cubren el reconocimiento de enlaces multimedia y las preferencias de lectura.

## Estructura

```text
├─ index.html
├─ css/app.css
├─ js/
│  ├─ app.js
│  ├─ document.js
│  ├─ links.js
│  ├─ storage.js
│  └─ theme-init.js
├─ assets/
│  ├─ favicon.svg
│  └─ fonts/
└─ tests/
   ├─ links.test.mjs
   └─ storage.test.mjs
```
